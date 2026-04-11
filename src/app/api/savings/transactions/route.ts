import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSavingsTransactionSchema, paginationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// Helper to generate transaction number
function generateTransactionNo(prefix: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `${prefix}-${year}-${random}`;
}

// GET /api/savings/transactions
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "createdAt",
            sortOrder: searchParams.get("sortOrder") || "desc",
        });

        const memberId = searchParams.get("memberId");
        const productId = searchParams.get("productId");
        const branchId = searchParams.get("branchId");
        const type = searchParams.get("type");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");

        const where = {
            ...(memberId && { memberId: parseInt(memberId) }),
            ...(productId && { productId: parseInt(productId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(type && { type }),
            ...(dateFrom && dateTo && {
                transactionDate: {
                    gte: new Date(dateFrom),
                    lte: new Date(dateTo),
                },
            }),
        };

        const [transactions, total] = await Promise.all([
            prisma.savingsTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    account: { include: { product: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { [query.sortBy || "createdAt"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.savingsTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/savings/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST /api/savings/transactions - Create deposit or withdrawal
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = (session.user as any).id as number;

        const body = await request.json();
        const data = createSavingsTransactionSchema.parse(body);

        const [member, product] = await Promise.all([
            prisma.member.findUnique({
                where: { id: data.memberId },
                select: { branchId: true, status: true },
            }),
            prisma.savingsProduct.findUnique({
                where: { id: data.productId },
                select: { id: true, name: true, type: true, canWithdraw: true },
            }),
        ]);

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        if (!product) {
            return NextResponse.json(
                { message: "Produk simpanan tidak ditemukan" },
                { status: 404 }
            );
        }

        // ── AD-ART Pasal 26: Blokir penarikan Simpanan Pokok & Wajib ──
        // Simpanan Pokok & Wajib TIDAK BOLEH ditarik selama anggota masih aktif.
        // Hanya dapat dikembalikan saat: meninggal dunia, berhenti, atau koperasi bubar.
        if (data.type === "withdrawal" && !product.canWithdraw && member.status === "active") {
            return NextResponse.json(
                {
                    message: `${product.name} tidak dapat ditarik selama anggota masih aktif (AD/ART Pasal 26). Hanya Simpanan Sukarela yang dapat ditarik sewaktu-waktu.`
                },
                { status: 400 }
            );
        }

        // Find or create savings account for member + product
        let account = await prisma.savingsAccount.findUnique({
            where: {
                memberId_productId: {
                    memberId: data.memberId,
                    productId: data.productId,
                },
            },
        });

        if (!account) {
            const accountNo = `SAV-${data.memberId}-${data.productId}`;
            account = await prisma.savingsAccount.create({
                data: {
                    accountNo,
                    memberId: data.memberId,
                    productId: data.productId,
                    branchId: member.branchId,
                    balance: 0,
                    openedDate: new Date(),
                },
            });
        }

        const currentBalance = Number(account.balance);

        // Validate withdrawal — cek saldo cukup
        if (data.type === "withdrawal" && data.amount > currentBalance) {
            return NextResponse.json(
                { message: `Saldo tidak mencukupi. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}` },
                { status: 400 }
            );
        }

        // Calculate new balance
        const balanceAfter =
            data.type === "deposit" || data.type === "interest"
                ? currentBalance + data.amount
                : currentBalance - data.amount;

        const txNo = generateTransactionNo("SIM");
        const txDate = data.transactionDate instanceof Date
            ? data.transactionDate
            : new Date(data.transactionDate);

        // ── ATOMIC TRANSACTION ─────────────────────────────────────────
        const [transaction] = await prisma.$transaction(async (tx) => {
            // 1. Buat SavingsTransaction
            const savingsTx = await tx.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: account!.id,
                    memberId: data.memberId,
                    productId: data.productId,
                    branchId: member.branchId,
                    type: data.type,
                    amount: data.amount,
                    balanceBefore: currentBalance,
                    balanceAfter,
                    paymentMethod: data.paymentMethod,
                    cashBankAccountId: data.cashBankAccountId ?? null,
                    referenceNo: data.referenceNo,
                    notes: data.notes,
                    transactionDate: txDate,
                    createdById: userId,
                },
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    account: { include: { product: true } },
                },
            });

            // 2. Update saldo rekening anggota
            await tx.savingsAccount.update({
                where: { id: account!.id },
                data: { balance: balanceAfter },
            });

            // 3. Posting ke Kas/Bank Koperasi (jika akun kas dipilih)
            if (data.cashBankAccountId) {
                const cashBank = await tx.cashBankAccount.findUnique({
                    where: { id: data.cashBankAccountId },
                });

                if (cashBank) {
                    const cashBalanceBefore = Number(cashBank.currentBalance);
                    // Setoran → kas koperasi masuk (in); Penarikan → kas koperasi keluar (out)
                    const cashType = (data.type === "deposit" || data.type === "interest") ? "in" : "out";
                    const cashBalanceAfter =
                        cashType === "in"
                            ? cashBalanceBefore + data.amount
                            : cashBalanceBefore - data.amount;

                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `CBT-${txNo}`,
                            accountId: data.cashBankAccountId,
                            branchId: member.branchId,
                            type: cashType,
                            category: "savings",
                            amount: data.amount,
                            balanceBefore: cashBalanceBefore,
                            balanceAfter: cashBalanceAfter,
                            referenceType: "SavingsTransaction",
                            referenceId: savingsTx.id,
                            description: `${data.type === "deposit" ? "Setoran" : data.type === "withdrawal" ? "Penarikan" : "Koreksi"} Simpanan — ${savingsTx.member?.name ?? "Anggota"} (${savingsTx.transactionNo})`,
                            transactionDate: txDate,
                            createdById: userId,
                        },
                    });

                    // Update saldo kas/bank koperasi
                    await tx.cashBankAccount.update({
                        where: { id: data.cashBankAccountId },
                        data: { currentBalance: cashBalanceAfter },
                    });
                }
            }

            return [savingsTx];
        });
        // ───────────────────────────────────────────────────────────────

        // Audit log
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Simpanan",
                description: `Transaksi ${data.type}: Rp ${data.amount.toLocaleString()} untuk anggota ${transaction.member?.name || data.memberId}`,
                targetId: String(transaction.id), targetType: "SavingsTransaction",
                newData: { transactionNo: transaction.transactionNo, type: data.type, amount: data.amount, balanceBefore: currentBalance, balanceAfter, cashBankAccountId: data.cashBankAccountId },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({ data: transaction }, { status: 201 });
    } catch (error) {
        console.error("POST /api/savings/transactions error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
