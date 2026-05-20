import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

interface AccountRow {
    id: number;
    code: string;
    name: string;
    type: string;
    normal_balance: string;
    amount: number;
}

// GET /api/reports/laba-rugi - Income Statement via SQL aggregation
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

        // Single SQL query with GROUP BY — replaces loading all journal lines into JS
        const results = await prisma.$queryRaw<AccountRow[]>`
            SELECT a.id, a.code, a.name, a.type, a.normal_balance,
                   SUM(CASE
                       WHEN a.normal_balance = 'credit' THEN jl.credit - jl.debit
                       ELSE jl.debit - jl.credit
                   END)::float as amount
            FROM journal_lines jl
            JOIN journals j ON jl.journal_id = j.id
            JOIN accounts a ON jl.account_id = a.id
            WHERE j.transaction_date >= ${startDate}
              AND j.transaction_date <= ${endDate}
              AND j.is_posted = true
              AND a.type IN ('income', 'expense')
            GROUP BY a.id, a.code, a.name, a.type, a.normal_balance
            HAVING SUM(CASE
                       WHEN a.normal_balance = 'credit' THEN jl.credit - jl.debit
                       ELSE jl.debit - jl.credit
                   END) <> 0
            ORDER BY a.code
        `;

        const revenueItems = results
            .filter((a) => a.type === "income")
            .map((a) => ({ code: a.code, name: a.name, amount: a.amount }));

        const expenseItems = results
            .filter((a) => a.type === "expense")
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
