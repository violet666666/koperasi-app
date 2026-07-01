import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";
import { buildBalanceSheet } from "@/lib/services/neraca";
import { toMobileNeracaShape } from "@/lib/services/mobile-neraca-shape";

interface AccountRow {
    id: number;
    code: string;
    name: string;
    type: string;
    category: string | null;
    normal_balance: string;
    balance: number;
    ytd_balance: number;
}

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
        const yearStart = new Date(new Date(asOfDate).getFullYear(), 0, 1).toISOString().split("T")[0];

        const startDate = new Date(yearStart + "T00:00:00.000Z");
        const endDate = new Date(asOfDate + "T23:59:59.999Z");

        // Single SQL query: all-time balance (neraca) + YTD balance (laba-rugi) in one pass
        const results = await prisma.$queryRaw<AccountRow[]>`
            SELECT
                a.id, a.code, a.name, a.type, a.category, a.normal_balance,
                SUM(CASE WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
                    ELSE jl.credit - jl.debit END)::float as balance,
                SUM(CASE WHEN j.transaction_date >= ${startDate} AND a.type IN ('income', 'expense')
                    THEN CASE WHEN a.type = 'income' THEN jl.credit - jl.debit
                         WHEN a.type = 'expense' THEN jl.debit - jl.credit
                         ELSE 0 END
                    ELSE 0 END)::float as ytd_balance
            FROM journal_lines jl
            JOIN journals j ON jl.journal_id = j.id
            JOIN accounts a ON jl.account_id = a.id
            WHERE j.transaction_date <= ${endDate}
              AND j.is_posted = true
              AND a.is_detail = true
            GROUP BY a.id, a.code, a.name, a.type, a.category, a.normal_balance
            HAVING SUM(CASE WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
                        ELSE jl.credit - jl.debit END) <> 0
                OR SUM(CASE WHEN j.transaction_date >= ${startDate} AND a.type IN ('income', 'expense')
                    THEN CASE WHEN a.type = 'income' THEN jl.credit - jl.debit
                         WHEN a.type = 'expense' THEN jl.debit - jl.credit
                         ELSE 0 END
                    ELSE 0 END) <> 0
            ORDER BY a.code
        `;

        // --- Susun Laba Rugi ---
        const revenueItems = results
            .filter((a) => a.type === "income" && a.ytd_balance !== 0)
            .map((a) => ({ code: a.code, name: a.name, amount: a.ytd_balance }));

        const expenseItems = results
            .filter((a) => a.type === "expense" && a.ytd_balance !== 0)
            .map((a) => ({ code: a.code, name: a.name, amount: a.ytd_balance }));

        const totalRevenue = revenueItems.reduce((sum, i) => sum + i.amount, 0);
        const totalExpense = expenseItems.reduce((sum, i) => sum + i.amount, 0);
        const netIncome = totalRevenue - totalExpense;

        // --- Neraca (ledger-based, via buildBalanceSheet) ---
        // Mengganti perhitungan journal-only lama (bug: simpanan = 0).
        // Laba-rugi (di atas) tetap memakai journal YTD.
        const balanceSheet = await buildBalanceSheet();
        const neraca = toMobileNeracaShape(balanceSheet);

        return NextResponse.json({
            data: {
                period: asOfDate,
                labaRugi: {
                    revenue: { items: revenueItems, total: totalRevenue },
                    expenses: { items: expenseItems, total: totalExpense },
                    netIncome,
                },
                neraca,
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/reports/financial error:", error);
        return NextResponse.json({ message: "Gagal memuat laporan finansial" }, { status: 500 });
    }
}
