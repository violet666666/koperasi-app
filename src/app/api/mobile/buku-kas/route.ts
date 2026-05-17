import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/buku-kas — Buku Kas for mobile operators
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const url = new URL(request.url);
        const accountId = url.searchParams.get("accountId");
        const month = url.searchParams.get("month");
        const year = url.searchParams.get("year");

        const now = new Date();
        const filterYear = year ? parseInt(year) : now.getFullYear();
        const filterMonth = month ? parseInt(month) : now.getMonth() + 1;

        const startDate = new Date(filterYear, filterMonth - 1, 1);
        const endDate = new Date(filterYear, filterMonth, 0);

        const where: Record<string, unknown> = {
            transactionDate: { gte: startDate, lte: endDate },
        };

        if (accountId && accountId !== "all") {
            where.accountId = parseInt(accountId);
        }

        // Opening balance
        let openingBalance = 0;
        if (accountId && accountId !== "all") {
            const lastPriorTx = await prisma.cashBankTransaction.findFirst({
                where: {
                    accountId: parseInt(accountId),
                    transactionDate: { lt: startDate },
                },
                orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
                select: { balanceAfter: true },
            });
            if (lastPriorTx) {
                openingBalance = Number(lastPriorTx.balanceAfter);
            }
        }

        // Transactions
        const transactions = await prisma.cashBankTransaction.findMany({
            where,
            include: {
                account: { select: { id: true, code: true, name: true, type: true } },
            },
            orderBy: [{ transactionDate: "asc" }, { id: "asc" }],
        });

        let runningBalance = openingBalance;
        const entries = transactions.map((tx) => {
            const amount = Number(tx.amount);
            const debit = tx.type === "in" ? amount : 0;
            const credit = tx.type === "out" ? amount : 0;
            runningBalance += debit - credit;

            return {
                id: tx.id,
                transactionDate: tx.transactionDate.toISOString(),
                transactionNo: tx.transactionNo,
                description: tx.description || "-",
                category: tx.category,
                debit,
                credit,
                saldo: runningBalance,
                accountName: tx.account?.name,
            };
        });

        const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
        const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

        // Accounts for filter
        const accounts = await prisma.cashBankAccount.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, code: true, name: true, type: true },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({
            data: {
                period: { month: filterMonth, year: filterYear },
                openingBalance,
                closingBalance: openingBalance + totalDebit - totalCredit,
                totalDebit,
                totalCredit,
                entries,
                accounts: accounts.map((a) => ({
                    id: a.id,
                    code: a.code,
                    name: a.name,
                    type: a.type,
                })),
            },
        });
    } catch (error: any) {
        console.error("GET /api/mobile/buku-kas error:", error);
        return NextResponse.json({ message: "Gagal memuat Buku Kas" }, { status: 500 });
    }
}
