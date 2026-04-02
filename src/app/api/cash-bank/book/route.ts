import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/cash-bank/book — Buku Kas (Cash Book) report
// Returns transactions for a specific account and period with running balance
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const month = searchParams.get("month"); // 1-12
        const year = searchParams.get("year");
        const category = searchParams.get("category");

        // Default to current month/year
        const now = new Date();
        const filterYear = year ? parseInt(year) : now.getFullYear();
        const filterMonth = month ? parseInt(month) : now.getMonth() + 1;

        // Build date range for the period
        const startDate = new Date(filterYear, filterMonth - 1, 1);
        const endDate = new Date(filterYear, filterMonth, 0); // Last day of month

        // Build where condition
        const where: Record<string, unknown> = {
            transactionDate: {
                gte: startDate,
                lte: endDate,
            },
        };

        if (accountId && accountId !== "all") {
            where.accountId = parseInt(accountId);
        }

        if (category && category !== "all") {
            where.category = category;
        }

        // Calculate opening balance (total of all transactions before this period)
        let openingBalance = 0;

        const priorWhere: Record<string, unknown> = {
            transactionDate: { lt: startDate },
        };
        if (accountId && accountId !== "all") {
            priorWhere.accountId = parseInt(accountId);
        }

        // Try to get the last transaction before this period for accurate balance
        if (accountId && accountId !== "all") {
            const lastPriorTx = await prisma.cashBankTransaction.findFirst({
                where: {
                    accountId: parseInt(accountId),
                    transactionDate: { lt: startDate },
                },
                orderBy: [
                    { transactionDate: "desc" },
                    { id: "desc" },
                ],
                select: { balanceAfter: true },
            });

            if (lastPriorTx) {
                openingBalance = Number(lastPriorTx.balanceAfter);
            } else {
                // Sum up prior transactions: in = +, out = -
                const priorTransactions = await prisma.cashBankTransaction.findMany({
                    where: priorWhere,
                    select: { type: true, amount: true },
                });
                openingBalance = priorTransactions.reduce((sum, tx) => {
                    const amt = Number(tx.amount);
                    return sum + (tx.type === "in" ? amt : -amt);
                }, 0);
            }
        } else {
            // "All accounts" mode — sum all prior transactions across all accounts
            const priorTransactions = await prisma.cashBankTransaction.findMany({
                where: priorWhere,
                select: { type: true, amount: true },
            });
            openingBalance = priorTransactions.reduce((sum, tx) => {
                const amt = Number(tx.amount);
                return sum + (tx.type === "in" ? amt : -amt);
            }, 0);
        }

        // Fetch transactions for the period
        const transactions = await prisma.cashBankTransaction.findMany({
            where,
            include: {
                account: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: [
                { transactionDate: "asc" },
                { id: "asc" },
            ],
        });

        // Calculate running balance
        let runningBalance = openingBalance;
        const entries = transactions.map((tx) => {
            const amount = Number(tx.amount);
            const debit = tx.type === "in" ? amount : 0;
            const credit = tx.type === "out" ? amount : 0;
            runningBalance = runningBalance + debit - credit;

            return {
                id: tx.id,
                transactionDate: tx.transactionDate.toISOString(),
                transactionNo: tx.transactionNo,
                description: tx.description || "-",
                category: tx.category,
                debit,
                credit,
                saldo: runningBalance,
                account: tx.account,
                createdBy: tx.createdBy,
            };
        });

        // Summary
        const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
        const closingBalance = openingBalance + totalDebit - totalCredit;

        // Fetch accounts for filter dropdown
        const accounts = await prisma.cashBankAccount.findMany({
            where: { isActive: true, deletedAt: null },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
            },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({
            data: {
                period: {
                    month: filterMonth,
                    year: filterYear,
                    label: `${new Date(filterYear, filterMonth - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`,
                },
                openingBalance,
                closingBalance,
                totalDebit,
                totalCredit,
                entries,
                accounts,
            },
        });
    } catch (error) {
        console.error("GET /api/cash-bank/book error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data Buku Kas" },
            { status: 500 }
        );
    }
}
