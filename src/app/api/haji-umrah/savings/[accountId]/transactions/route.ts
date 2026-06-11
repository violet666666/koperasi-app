import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

function generateTxNo(): string {
    const year = new Date().getFullYear();
    const random = randomBytes(4).readUInt32BE(0) % 1_000_000_000;
    return `HU-${year}-${random.toString().padStart(9, "0")}`;
}

// GET /api/haji-umrah/savings/[accountId]/transactions — Riwayat transaksi
export async function GET(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        // Verify account is haji/umrah type
        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: { product: true },
        });
        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        const where = { accountId: id, status: "completed" };

        const [transactions, total] = await Promise.all([
            prisma.savingsTransaction.findMany({
                where,
                include: {
                    member: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
                orderBy: { transactionDate: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsTransaction.count({ where }),
        ]);

        return NextResponse.json({
            data: transactions,
            meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to fetch transactions" }, { status: 500 });
    }
}

// POST /api/haji-umrah/savings/[accountId]/transactions — Setoran (deposit)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const userId = Number((session.user as Record<string, unknown>).id);

        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        }

        const body = await request.json();
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = body;

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Jumlah setoran harus lebih dari 0" }, { status: 400 });
        }

        // Fetch account with product
        const account = await prisma.savingsAccount.findUnique({
            where: { id },
            include: {
                member: { select: { id: true, name: true, branchId: true } },
                product: true,
            },
        });

        if (!account || !HAJI_UMRAH_TYPES.includes(account.product.type)) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        if (account.status !== "active") {
            return NextResponse.json({ message: "Rekening sudah ditutup" }, { status: 400 });
        }

        // ── Calculate admin fee ──
        let adminFee = 0;
        const product = account.product;
        if (product.adminFeeType && product.adminFeeValue) {
            const feeValue = Number(product.adminFeeValue);
            if (product.adminFeeType === "percent") {
                adminFee = Math.round(amount * feeValue / 100);
            } else {
                adminFee = feeValue;
            }
        }

        const currentBalance = Number(account.balance);
        const balanceAfter = currentBalance + amount;

        const txNo = generateTxNo();

        // Parse date — WIB handling
        let txDate: Date;
        if (transactionDate) {
            const raw = String(transactionDate);
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                txDate = new Date(raw + "T12:00:00+07:00");
            } else {
                txDate = new Date(raw);
            }
        } else {
            txDate = new Date();
        }

        const typeLabel = product.type === "tabungan_haji" ? "Haji" : "Umrah";

        // ── ATOMIC TRANSACTION ─────────────────────────────────────────
        const [transaction] = await prisma.$transaction(async (tx) => {
            // 1. Create SavingsTransaction (deposit)
            const savingsTx = await tx.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: id,
                    memberId: account.memberId,
                    productId: account.productId,
                    branchId: account.member.branchId,
                    type: "deposit",
                    amount,
                    balanceBefore: currentBalance,
                    balanceAfter,
                    paymentMethod: paymentMethod || "cash",
                    cashBankAccountId: cashBankAccountId ?? null,
                    referenceNo: referenceNo ?? null,
                    notes: notes ?? `Setoran Tabungan ${typeLabel}`,
                    transactionDate: txDate,
                    createdById: userId,
                },
                include: {
                    member: { select: { id: true, name: true } },
                    account: { include: { product: true } },
                },
            });

            // 2. Update account balance
            await tx.savingsAccount.update({
                where: { id },
                data: { balance: balanceAfter },
            });

            // 3. CashBank posting — deposit amount
            if (cashBankAccountId) {
                const cashBank = await tx.cashBankAccount.findUnique({
                    where: { id: cashBankAccountId },
                });
                if (cashBank) {
                    const cbBefore = Number(cashBank.currentBalance);
                    const cbAfter = cbBefore + amount;

                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `CBT-${txNo}`,
                            accountId: cashBankAccountId,
                            branchId: account.member.branchId,
                            type: "in",
                            category: "savings",
                            amount,
                            balanceBefore: cbBefore,
                            balanceAfter: cbAfter,
                            referenceType: "SavingsTransaction",
                            referenceId: savingsTx.id,
                            unitType: "simpan_pinjam",
                            description: `Setoran Tabungan ${typeLabel} — ${account.member.name} (${txNo})`,
                            transactionDate: txDate,
                            createdById: userId,
                        },
                    });

                    // Update CB balance
                    await tx.cashBankAccount.update({
                        where: { id: cashBankAccountId },
                        data: { currentBalance: cbAfter },
                    });

                    // 4. Admin fee — separate CashBankTransaction (revenue for koperasi)
                    if (adminFee > 0) {
                        const feeCbBefore = Number(
                            (await tx.cashBankAccount.findUnique({ where: { id: cashBankAccountId } }))!.currentBalance
                        );
                        const feeCbAfter = feeCbBefore + adminFee;

                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `CBT-${txNo}-FEE`,
                                accountId: cashBankAccountId,
                                branchId: account.member.branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: adminFee,
                                balanceBefore: feeCbBefore,
                                balanceAfter: feeCbAfter,
                                referenceType: "SavingsTransaction",
                                referenceId: savingsTx.id,
                                unitType: "haji_umrah",
                                description: `Admin Fee Tabungan ${typeLabel} — ${account.member.name} (${txNo})`,
                                transactionDate: txDate,
                                createdById: userId,
                            },
                        });

                        await tx.cashBankAccount.update({
                            where: { id: cashBankAccountId },
                            data: { currentBalance: feeCbAfter },
                        });
                    }
                }
            }

            return [savingsTx];
        });
        // ───────────────────────────────────────────────────────────────

        // Check target reached
        const target = Number(account.targetAmount ?? product.targetAmount ?? 0);
        const isTargetReached = target > 0 && balanceAfter >= target;

        return NextResponse.json({
            data: transaction,
            meta: {
                adminFee,
                balanceAfter,
                target,
                progress: target > 0 ? Math.min(100, Math.round((balanceAfter / target) * 10000) / 100) : 0,
                isTargetReached,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to create transaction" },
            { status: 500 }
        );
    }
}
