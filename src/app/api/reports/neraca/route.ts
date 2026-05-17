import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

interface AccountRow {
    id: number;
    code: string;
    name: string;
    type: string;
    category: string | null;
    normal_balance: string;
    level: number;
    is_detail: boolean;
    balance: number;
}

// GET /api/reports/neraca - Balance Sheet via SQL aggregation
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
        const endDate = new Date(asOfDate + "T23:59:59.999Z");

        // Single SQL query with GROUP BY — replaces loading all journal lines into JS
        const results = await prisma.$queryRaw<AccountRow[]>`
            SELECT a.id, a.code, a.name, a.type, a.category, a.normal_balance,
                   a.level, a.is_detail,
                   SUM(CASE
                       WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
                       ELSE jl.credit - jl.debit
                   END)::float as balance
            FROM journal_lines jl
            JOIN journals j ON jl.journal_id = j.id
            JOIN accounts a ON jl.account_id = a.id
            WHERE j.transaction_date <= ${endDate}
              AND j.is_posted = true
              AND a.is_detail = true
            GROUP BY a.id, a.code, a.name, a.type, a.category, a.normal_balance,
                     a.level, a.is_detail
            HAVING SUM(CASE
                       WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
                       ELSE jl.credit - jl.debit
                   END) <> 0
            ORDER BY a.code
        `;

        // Assets
        const currentAssets = results
            .filter((a) => a.type === "asset" && a.category === "current_asset")
            .map((a) => ({
                code: a.code,
                name: a.name,
                amount: a.normal_balance === "credit" ? -a.balance : a.balance,
            }));

        const fixedAssets = results
            .filter((a) => a.type === "asset" && a.category === "fixed_asset")
            .map((a) => ({
                code: a.code,
                name: a.name,
                amount: a.normal_balance === "credit" ? -a.balance : a.balance,
            }));

        const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalAssets = totalCurrentAssets + totalFixedAssets;

        // Liabilities
        const currentLiabilities = results
            .filter((a) => a.type === "liability" && a.category === "current_liability")
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        const totalLiabilities = currentLiabilities.reduce((sum, a) => sum + a.amount, 0);

        // Equity
        const equityItems = results
            .filter((a) => a.type === "equity")
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        // SHU Tahun Berjalan (net income) for equity
        const incomeTotal = results
            .filter((a) => a.type === "income")
            .reduce((sum, a) => sum + a.balance, 0);
        const expenseTotal = results
            .filter((a) => a.type === "expense")
            .reduce((sum, a) => sum + a.balance, 0);
        const netIncome = incomeTotal - expenseTotal;

        const hasShuAccount = equityItems.some((e) => e.code === "3103");
        if (!hasShuAccount && netIncome !== 0) {
            equityItems.push({ code: "3103", name: "SHU Tahun Berjalan", amount: netIncome });
        }

        const totalEquity = equityItems.reduce((sum, a) => sum + a.amount, 0);

        const balanceSheet = {
            period: asOfDate,
            assets: {
                current: currentAssets,
                fixed: fixedAssets,
                totalCurrentAssets,
                totalFixedAssets,
                totalAssets,
            },
            liabilities: {
                shortTerm: currentLiabilities,
                longTerm: [],
                totalLiabilities,
            },
            equity: {
                items: equityItems,
                totalEquity,
            },
            totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
        };

        return NextResponse.json({ data: balanceSheet });
    } catch (error) {
        console.error("GET /api/reports/neraca error:", error);
        return NextResponse.json(
            { message: "Failed to generate balance sheet" },
            { status: 500 }
        );
    }
}
