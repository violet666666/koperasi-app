import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// POST /api/admin/revert-backfill — Reverse the backfill-loan-cash that corrupted balances
// Deletes all [BACKFILL] CashBankTransaction records and restores account balances
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "dryRun" | "execute" = body.mode === "execute" ? "execute" : "dryRun";

    try {
        // Find all [BACKFILL] CashBankTransaction records
        const backfillTransactions = await prisma.cashBankTransaction.findMany({
            where: { description: { contains: "[BACKFILL]" } },
            include: { account: { select: { id: true, name: true, code: true, accountNumber: true, currentBalance: true } } },
        });

        if (backfillTransactions.length === 0) {
            return NextResponse.json({ message: "Tidak ada transaksi [BACKFILL] ditemukan.", total: 0 });
        }

        // Group by account and sum amounts
        const byAccount = new Map<number, { account: any; totalOut: number; totalIn: number; count: number }>();
        const loanIds: number[] = [];

        for (const tx of backfillTransactions) {
            const accId = tx.accountId;
            if (!byAccount.has(accId)) {
                byAccount.set(accId, { account: tx.account, totalOut: 0, totalIn: 0, count: 0 });
            }
            const entry = byAccount.get(accId)!;
            entry.count++;
            if (tx.type === "out") {
                entry.totalOut += Number(tx.amount);
            } else {
                entry.totalIn += Number(tx.amount);
            }

            // Collect loan IDs from referenceId
            if (tx.referenceType === "Loan" && tx.referenceId) {
                loanIds.push(tx.referenceId);
            }
        }

        if (mode === "dryRun") {
            return NextResponse.json({
                mode: "dryRun",
                message: "Preview — tambahkan mode: 'execute' untuk menjalankan",
                totalBackfillTransactions: backfillTransactions.length,
                affectedLoans: loanIds.length,
                accounts: Array.from(byAccount.entries()).map(([id, data]) => ({
                    accountId: id,
                    accountName: data.account.name,
                    accountNo: data.account.code,
                    currentBalance: Number(data.account.currentBalance),
                    totalBackfillOut: data.totalOut,
                    totalBackfillIn: data.totalIn,
                    correctedBalance: Number(data.account.currentBalance) + data.totalOut - data.totalIn,
                    transactionCount: data.count,
                })),
            });
        }

        // Execute: revert in a transaction
        const result = await prisma.$transaction(async (tx) => {
            let deletedCount = 0;
            let loansCleared = 0;

            // For each affected account, restore balance
            for (const [accId, data] of byAccount) {
                const correction = data.totalOut - data.totalIn;
                const currentBal = Number(data.account.currentBalance);
                const newBalance = currentBal + correction;

                await tx.cashBankAccount.update({
                    where: { id: accId },
                    data: { currentBalance: newBalance },
                });
            }

            // Clear disbursementCashBankId on affected loans
            if (loanIds.length > 0) {
                const updateResult = await tx.loan.updateMany({
                    where: { id: { in: loanIds }, disbursementCashBankId: { not: null } },
                    data: { disbursementCashBankId: null },
                });
                loansCleared = updateResult.count;
            }

            // Delete all [BACKFILL] transactions
            const deleteResult = await tx.cashBankTransaction.deleteMany({
                where: { description: { contains: "[BACKFILL]" } },
            });
            deletedCount = deleteResult.count;

            return { deletedCount, loansCleared, accountsCorrected: byAccount.size };
        });

        return NextResponse.json({
            mode: "execute",
            message: `Berhasil menghapus ${result.deletedCount} transaksi [BACKFILL] dan mengembalikan saldo ${result.accountsCorrected} akun.`,
            ...result,
            accounts: Array.from(byAccount.entries()).map(([id, data]) => ({
                accountId: id,
                accountName: data.account.name,
                accountNo: data.account.code,
                previousBalance: Number(data.account.currentBalance),
                correctionAmount: data.totalOut - data.totalIn,
                newBalance: Number(data.account.currentBalance) + data.totalOut - data.totalIn,
            })),
        });
    } catch (error: any) {
        console.error("[revert-backfill]", error);
        return NextResponse.json(
            { message: "Gagal menjalankan revert backfill", error: error.message },
            { status: 500 }
        );
    }
}
