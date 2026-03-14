import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

function toNum(d: Decimal | number): number {
    return typeof d === "number" ? d : Number(d);
}

// GET /api/reports/neraca - Balance Sheet from real journal aggregation
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
        const endDate = new Date(asOfDate + "T23:59:59.999Z");

        // Get all journal lines up to asOfDate
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { lte: endDate },
                    isPosted: true,
                },
            },
            include: {
                account: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                        category: true,
                        normalBalance: true,
                        level: true,
                        isDetail: true,
                    },
                },
            },
        });

        // Aggregate balances per account
        const accountBalances: Record<
            number,
            {
                code: string;
                name: string;
                type: string;
                category: string | null;
                normalBalance: string;
                level: number;
                isDetail: boolean;
                balance: number;
            }
        > = {};

        for (const line of journalLines) {
            const { account } = line;
            if (!accountBalances[account.id]) {
                accountBalances[account.id] = {
                    code: account.code,
                    name: account.name,
                    type: account.type,
                    category: account.category,
                    normalBalance: account.normalBalance,
                    level: account.level,
                    isDetail: account.isDetail,
                    balance: 0,
                };
            }

            const debit = toNum(line.debit);
            const credit = toNum(line.credit);

            // Calculate balance based on normal balance direction
            if (account.normalBalance === "debit") {
                accountBalances[account.id].balance += debit - credit;
            } else {
                accountBalances[account.id].balance += credit - debit;
            }
        }

        // Group accounts by type and category
        const detailAccounts = Object.values(accountBalances).filter((a) => a.isDetail && a.balance !== 0);

        // Assets
        const currentAssets = detailAccounts
            .filter((a) => a.type === "asset" && a.category === "current_asset")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({
                code: a.code,
                name: a.name,
                amount: a.normalBalance === "credit" ? -a.balance : a.balance,
            }));

        const fixedAssets = detailAccounts
            .filter((a) => a.type === "asset" && a.category === "fixed_asset")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({
                code: a.code,
                name: a.name,
                amount: a.normalBalance === "credit" ? -a.balance : a.balance,
            }));

        const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalAssets = totalCurrentAssets + totalFixedAssets;

        // Liabilities
        const currentLiabilities = detailAccounts
            .filter((a) => a.type === "liability" && a.category === "current_liability")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        const totalLiabilities = currentLiabilities.reduce((sum, a) => sum + a.amount, 0);

        // Equity
        const equityItems = detailAccounts
            .filter((a) => a.type === "equity")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        // Calculate SHU Tahun Berjalan (net income) for equity
        const incomeTotal = detailAccounts
            .filter((a) => a.type === "income")
            .reduce((sum, a) => sum + a.balance, 0);
        const expenseTotal = detailAccounts
            .filter((a) => a.type === "expense")
            .reduce((sum, a) => sum + a.balance, 0);
        const netIncome = incomeTotal - expenseTotal;

        // Check if SHU Tahun Berjalan account already exists in equity
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
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1, // floating point tolerance
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
