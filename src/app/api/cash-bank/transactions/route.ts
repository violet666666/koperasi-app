import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createCashBankTransactionSchema, paginationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

// Helper to generate transaction number
function generateTransactionNo(type: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const prefix = type === "in" ? "CBM" : "CBK"; // Masuk / Keluar
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `${prefix}-${year}-${random}`;
}

// GET /api/cash-bank/transactions
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
        });

        const accountId = searchParams.get("accountId");
        const branchId = searchParams.get("branchId");
        const type = searchParams.get("type");
        const category = searchParams.get("category");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");

        const where: any = {
            ...(accountId && { accountId: accountId.includes(",") ? { in: accountId.split(",").map(n => parseInt(n)).filter(n => !isNaN(n)) } : parseInt(accountId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(type && { type }),
            ...(category && { category }),
            ...(dateFrom && dateTo && {
                transactionDate: {
                    gte: new Date(dateFrom),
                    lte: new Date(dateTo),
                },
            }),
        };

        const [transactions, total] = await Promise.all([
            prisma.cashBankTransaction.findMany({
                where,
                include: {
                    account: { select: { id: true, code: true, name: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.cashBankTransaction.count({ where }),
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
        console.error("GET /api/cash-bank/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}

// POST /api/cash-bank/transactions
export async function POST(request: Request) {
    try {
        const session = await auth();
        const userId = session?.user?.id ? parseInt(session.user.id) : undefined;
        
        let finalUserId = userId;
        if (!finalUserId) {
             const firstUser = await prisma.user.findFirst({ where: { isActive: true } });
             if (firstUser) finalUserId = firstUser.id;
        }

        if (!finalUserId) {
             return NextResponse.json(
                 { message: "Unauthorized. User ID not found." },
                 { status: 401 }
             );
        }

        const body = await request.json();
        const data = createCashBankTransactionSchema.parse(body);

        const account = await prisma.cashBankAccount.findUnique({
            where: { id: data.accountId },
        });

        if (!account) {
            return NextResponse.json(
                { message: "Akun kas/bank tidak ditemukan" },
                { status: 404 }
            );
        }

        const currentBalance = Number(account.currentBalance);

        // Validate for outgoing
        if (data.type === "out" && data.amount > currentBalance) {
            return NextResponse.json(
                { message: "Saldo tidak mencukupi" },
                { status: 400 }
            );
        }

        const balanceAfter =
            data.type === "in"
                ? currentBalance + data.amount
                : currentBalance - data.amount;

        // ================================================================
        // SPLIT LEDGER LOGIC (Cuci Mobil)
        // ================================================================
        const isCuciMobilPendapatan = 
            data.unitType === "cuci_mobil" && 
            data.category === "pendapatan_unit" && 
            data.type === "in";

        const MITRA_SHARE_PERCENT = 0.5;  // 50% ke mitra
        const SHU_ANGGOTA_AMOUNT = 2000;  // Rp2.000 dari jatah koperasi

        let mitraShare = 0;
        let shuAnggota = 0;
        let netKoperasi = data.amount;

        if (isCuciMobilPendapatan) {
            mitraShare = Math.floor(data.amount * MITRA_SHARE_PERCENT);
            const koperasiGross = data.amount - mitraShare;
            
            if (data.memberId) {
                shuAnggota = Math.min(SHU_ANGGOTA_AMOUNT, koperasiGross);
            }
            netKoperasi = koperasiGross - shuAnggota;
        }

        // ================================================================
        // ATOMIC TRANSACTION
        // ================================================================
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create the main CashBankTransaction
            const transaction = await tx.cashBankTransaction.create({
                data: {
                    transactionNo: generateTransactionNo(data.type),
                    accountId: data.accountId,
                    branchId: account.branchId,
                    type: data.type,
                    category: data.category,
                    amount: data.amount,
                    balanceBefore: currentBalance,
                    balanceAfter,
                    description: data.description,
                    transactionDate: data.transactionDate,
                    unitType: data.unitType || null,
                    memberId: data.memberId || null,
                    createdById: finalUserId!,
                },
                include: {
                    account: true,
                },
            });

            // 2. Update account balance
            await tx.cashBankAccount.update({
                where: { id: data.accountId },
                data: { currentBalance: balanceAfter },
            });

            // 3. Split Ledger for Cuci Mobil — record mitra hutang
            if (isCuciMobilPendapatan && mitraShare > 0) {
                // Record hutang mitra as a separate CashBankTransaction (type=out, virtual)
                // This doesn't actually move money out of the bank — it's a liability marker
                await tx.cashBankTransaction.create({
                    data: {
                        transactionNo: generateTransactionNo("out") + "-MITRA",
                        accountId: data.accountId,
                        branchId: account.branchId,
                        type: "out",
                        category: "hutang_mitra",
                        amount: mitraShare,
                        balanceBefore: balanceAfter,
                        balanceAfter: balanceAfter, // saldo tetap — ini virtual/liability
                        description: `[AUTO] Hutang Mitra Cuci Mobil (50% dari ${data.description || "Pendapatan CM"})`,
                        transactionDate: data.transactionDate,
                        unitType: "cuci_mobil",
                        referenceType: "cash_bank_split",
                        referenceId: transaction.id,
                        createdById: finalUserId!,
                    },
                });
            }

            // 4. SHU Anggota — credit Rp2.000 to TabunganSejahtera
            if (isCuciMobilPendapatan && shuAnggota > 0 && data.memberId) {
                const now = new Date(data.transactionDate);
                const tahun = now.getFullYear();
                const bulan = now.getMonth() + 1;

                await tx.tabunganSejahteraHistory.upsert({
                    where: {
                        memberId_tahun_bulan: {
                            memberId: data.memberId,
                            tahun,
                            bulan,
                        },
                    },
                    update: {
                        kasMasuk: { increment: shuAnggota },
                        saldoAkhir: { increment: shuAnggota },
                    },
                    create: {
                        memberId: data.memberId,
                        tahun,
                        bulan,
                        kasMasuk: shuAnggota,
                        kasKeluar: 0,
                        saldoAkhir: shuAnggota,
                    },
                });
            }

            return {
                transaction,
                splitInfo: isCuciMobilPendapatan ? {
                    totalMasuk: data.amount,
                    mitraShare,
                    shuAnggota,
                    netKoperasi,
                } : null,
            };
        });

        return NextResponse.json({ 
            data: result.transaction, 
            splitInfo: result.splitInfo,
            message: result.splitInfo 
                ? `Transaksi berhasil! Hutang Mitra: Rp${mitraShare.toLocaleString("id-ID")}, SHU Anggota: Rp${shuAnggota.toLocaleString("id-ID")}`
                : "Transaksi berhasil dicatat",
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/cash-bank/transactions error:", error);
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
