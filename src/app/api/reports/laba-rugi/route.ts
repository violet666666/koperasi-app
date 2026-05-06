import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "super_admin"];

function toNum(d: Decimal | number): number {
    return typeof d === "number" ? d : Number(d);
}

// GET /api/reports/laba-rugi - Income Statement from real journal aggregation
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const periodFrom =
            searchParams.get("periodFrom") ||
            new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
        const periodTo =
            searchParams.get("periodTo") || new Date().toISOString().split("T")[0];

        const startDate = new Date(periodFrom + "T00:00:00.000Z");
        const endDate = new Date(periodTo + "T23:59:59.999Z");

        // Get all journal lines in the period for income/expense accounts
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: startDate, lte: endDate },
                    isPosted: true,
                },
                account: {
                    type: { in: ["income", "expense"] },
                },
            },
            include: {
                account: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                        normalBalance: true,
                    },
                },
            },
        });

        // Aggregate by account
        const accountTotals: Record<
            number,
            { code: string; name: string; type: string; amount: number }
        > = {};

        for (const line of journalLines) {
            const { account } = line;
            if (!accountTotals[account.id]) {
                accountTotals[account.id] = {
                    code: account.code,
                    name: account.name,
                    type: account.type,
                    amount: 0,
                };
            }

            const debit = toNum(line.debit);
            const credit = toNum(line.credit);

            if (account.type === "income") {
                accountTotals[account.id].amount += credit - debit;
            } else {
                // expense
                accountTotals[account.id].amount += debit - credit;
            }
        }

        const allAccounts = Object.values(accountTotals);

        const revenueItems = allAccounts
            .filter((a) => a.type === "income" && a.amount !== 0)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.amount }));

        const expenseItems = allAccounts
            .filter((a) => a.type === "expense" && a.amount !== 0)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.amount }));

        const totalRevenue = revenueItems.reduce((sum, i) => sum + i.amount, 0);
        const totalExpense = expenseItems.reduce((sum, i) => sum + i.amount, 0);
        const netIncome = totalRevenue - totalExpense;

        const incomeStatement = {
            period: { from: periodFrom, to: periodTo },
            revenue: {
                items: revenueItems,
                total: totalRevenue,
            },
            expenses: {
                items: expenseItems,
                total: totalExpense,
            },
            netIncome,
        };

        return NextResponse.json({ data: incomeStatement });
    } catch (error) {
        console.error("GET /api/reports/laba-rugi error:", error);
        return NextResponse.json(
            { message: "Failed to generate income statement" },
            { status: 500 }
        );
    }
}
