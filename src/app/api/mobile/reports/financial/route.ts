import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

function toNum(d: Decimal | number): number {
    return typeof d === "number" ? d : Number(d);
}

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get("asOfDate") || new Date().toISOString().split("T")[0];
        
        // Pengecekan tahun yang sama
        const yearStart = new Date(new Date(asOfDate).getFullYear(), 0, 1).toISOString().split("T")[0];

        const startDate = new Date(yearStart + "T00:00:00.000Z");
        const endDate = new Date(asOfDate + "T23:59:59.999Z");

        // 1. Fetch all journal lines up to the endDate
        const allJournalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { lte: endDate },
                    isPosted: true,
                },
            },
            include: {
                journal: { select: { transactionDate: true } },
                account: {
                    select: {
                        id: true, code: true, name: true, type: true, 
                        category: true, normalBalance: true, isDetail: true,
                    },
                },
            },
        });

        // Kumpulkan data
        const accountBalances: Record<number, any> = {};

        for (const line of allJournalLines) {
            const { account } = line;
            if (!accountBalances[account.id]) {
                accountBalances[account.id] = {
                    ...account, balance: 0, 
                    // YTD balance for Income Statement (only within this year)
                    ytdBalance: 0,
                };
            }

            const debit = toNum(line.debit);
            const credit = toNum(line.credit);

            // Neraca: All Time balance
            if (account.normalBalance === "debit") {
                accountBalances[account.id].balance += debit - credit;
            } else {
                accountBalances[account.id].balance += credit - debit;
            }

            // Laba Rugi: Year-to-Date only
            if (line.journal.transactionDate >= startDate) {
                if (account.type === "income") {
                    accountBalances[account.id].ytdBalance += credit - debit;
                } else if (account.type === "expense") {
                    accountBalances[account.id].ytdBalance += debit - credit;
                }
            }
        }

        const detailAccounts = Object.values(accountBalances).filter((a) => a.isDetail && (a.balance !== 0 || a.ytdBalance !== 0));

        // --- Susun Laba Rugi ---
        const revenueItems = detailAccounts
            .filter((a) => a.type === "income" && a.ytdBalance !== 0)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.ytdBalance }));

        const expenseItems = detailAccounts
            .filter((a) => a.type === "expense" && a.ytdBalance !== 0)
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.ytdBalance }));

        const totalRevenue = revenueItems.reduce((sum, i) => sum + i.amount, 0);
        const totalExpense = expenseItems.reduce((sum, i) => sum + i.amount, 0);
        const netIncome = totalRevenue - totalExpense;

        // --- Susun Neraca ---
        const currentAssets = detailAccounts
            .filter((a) => a.type === "asset" && a.category === "current_asset")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.normalBalance === "credit" ? -a.balance : a.balance }));
        const fixedAssets = detailAccounts
            .filter((a) => a.type === "asset" && a.category === "fixed_asset")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.normalBalance === "credit" ? -a.balance : a.balance }));

        const totalCurrentAssets = currentAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalFixedAssets = fixedAssets.reduce((sum, a) => sum + a.amount, 0);
        const totalAssets = totalCurrentAssets + totalFixedAssets;

        const currentLiabilities = detailAccounts
            .filter((a) => a.type === "liability" && a.category === "current_liability")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        const totalLiabilities = currentLiabilities.reduce((sum, a) => sum + a.amount, 0);

        const equityItems = detailAccounts
            .filter((a) => a.type === "equity")
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((a) => ({ code: a.code, name: a.name, amount: a.balance }));

        // Insert SHU Berjalan ke Ekuitas jika belum ada
        const hasShuAccount = equityItems.some((e) => e.code === "3103");
        if (!hasShuAccount && netIncome !== 0) {
            equityItems.push({ code: "3103", name: "SHU Tahun Berjalan", amount: netIncome });
        }
        const totalEquity = equityItems.reduce((sum, a) => sum + a.amount, 0);

        return NextResponse.json({
            data: {
                period: asOfDate,
                labaRugi: {
                    revenue: { items: revenueItems, total: totalRevenue },
                    expenses: { items: expenseItems, total: totalExpense },
                    netIncome,
                },
                neraca: {
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
                }
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/reports/financial error:", error);
        return NextResponse.json({ message: "Gagal memuat laporan finansial" }, { status: 500 });
    }
}
