import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/admin/migrate-loan-cash-account
 *
 * Migrate loan disbursement CashBankTransactions from wrong account (Bank BRI)
 * to the correct account (KAS-002 Kas Tunai).
 *
 * Mode "dryRun": preview only — shows what would be moved
 * Mode "execute": actually moves the transactions
 */
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user || !["operator", "admin", "admin_sp"].includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: "dryRun" | "execute" = body.mode === "execute" ? "execute" : "dryRun";

    try {
        // Find the correct account: KAS-002
        const targetAccount = await prisma.cashBankAccount.findFirst({
            where: { branchId: 10, isActive: true, type: "cash", code: "KAS-002" },
        });

        if (!targetAccount) {
            return NextResponse.json({ message: "KAS-002 tidak ditemukan" }, { status: 404 });
        }

        // Find all loan disbursement transactions NOT in KAS-002
        const wrongAccountTxs = await prisma.cashBankTransaction.findMany({
            where: {
                category: "pencairan_pinjaman",
                referenceType: "Loan",
                accountId: { not: targetAccount.id },
            },
            include: {
                account: { select: { id: true, name: true, code: true, currentBalance: true } },
            },
        });

        if (wrongAccountTxs.length === 0) {
            return NextResponse.json({
                message: "Semua transaksi pencairan pinjaman sudah di akun yang benar.",
                total: 0,
            });
        }

        // Group by source account
        const bySourceAccount = new Map<number, { account: any; txIds: number[]; totalAmount: number }>();
        for (const tx of wrongAccountTxs) {
            const accId = tx.accountId;
            if (!bySourceAccount.has(accId)) {
                bySourceAccount.set(accId, { account: tx.account, txIds: [], totalAmount: 0 });
            }
            const entry = bySourceAccount.get(accId)!;
            entry.txIds.push(tx.id);
            entry.totalAmount += Number(tx.amount);
        }

        const totalAmountToMove = wrongAccountTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);

        if (mode === "dryRun") {
            return NextResponse.json({
                mode: "dryRun",
                message: "Preview — tambahkan mode: 'execute' untuk menjalankan",
                transactionsToMove: wrongAccountTxs.length,
                totalAmountToMove,
                targetAccount: {
                    id: targetAccount.id,
                    code: targetAccount.code,
                    name: targetAccount.name,
                    currentBalance: Number(targetAccount.currentBalance),
                    newBalance: Number(targetAccount.currentBalance) - totalAmountToMove,
                },
                sourceAccounts: Array.from(bySourceAccount.entries()).map(([id, data]) => ({
                    accountId: id,
                    code: data.account.code,
                    name: data.account.name,
                    currentBalance: Number(data.account.currentBalance),
                    amountToReturn: data.totalAmount,
                    newBalance: Number(data.account.currentBalance) + data.totalAmount,
                    txCount: data.txIds.length,
                })),
                transactions: wrongAccountTxs.map(tx => ({
                    id: tx.id,
                    txNo: tx.transactionNo,
                    amount: Number(tx.amount),
                    fromAccount: tx.account?.code,
                    description: tx.description?.substring(0, 80),
                })),
            });
        }

        // Execute migration
        const result = await prisma.$transaction(async (tx) => {
            let movedCount = 0;

            // 1. For each source account: return the money (+)
            for (const [sourceAccId, data] of bySourceAccount) {
                const currentBal = Number(data.account.currentBalance);
                await tx.cashBankAccount.update({
                    where: { id: sourceAccId },
                    data: { currentBalance: currentBal + data.totalAmount },
                });
            }

            // 2. For target account: deduct the money (-)
            const targetCurrentBal = Number(targetAccount.currentBalance);
            await tx.cashBankAccount.update({
                where: { id: targetAccount.id },
                data: { currentBalance: targetCurrentBal - totalAmountToMove },
            });

            // 3. Move each transaction to target account and recalculate balances
            // Since we already adjusted the account-level balances,
            // we just need to update the accountId on each transaction
            for (const transaction of wrongAccountTxs) {
                await tx.cashBankTransaction.update({
                    where: { id: transaction.id },
                    data: { accountId: targetAccount.id },
                });
                movedCount++;
            }

            // 4. Update loan disbursementCashBankId to target account
            const loanIds = wrongAccountTxs
                .filter(t => t.referenceId)
                .map(t => t.referenceId!);

            if (loanIds.length > 0) {
                await tx.loan.updateMany({
                    where: { id: { in: loanIds } },
                    data: { disbursementCashBankId: targetAccount.id },
                });
            }

            return { movedCount, loanIdsUpdated: loanIds.length };
        });

        return NextResponse.json({
            mode: "execute",
            message: `Berhasil memindahkan ${result.movedCount} transaksi pencairan ke KAS-002.`,
            ...result,
            totalAmountMoved: totalAmountToMove,
            sourceAccounts: Array.from(bySourceAccount.entries()).map(([id, data]) => ({
                accountId: id,
                code: data.account.code,
                name: data.account.name,
                returnedAmount: data.totalAmount,
            })),
        });
    } catch (error: any) {
        console.error("[migrate-loan-cash-account]", error);
        return NextResponse.json(
            { message: "Gagal migrasi", error: error.message },
            { status: 500 }
        );
    }
}
