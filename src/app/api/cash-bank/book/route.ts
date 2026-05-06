import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "super_admin"];

// Check if a description represents an opening balance row
function isOpeningBalanceDescription(desc: string): boolean {
    const lower = (desc || "").toLowerCase();
    return (
        lower.includes("saldo bulan") ||
        lower === "saldo" ||
        lower.includes("saldo awal") ||
        lower.includes("sisa awal") ||
        lower.includes("sisa setelah serah terima")
    );
}

// GET /api/cash-bank/book — Buku Kas (Cash Book) report
// Returns transactions for a specific account and period with running balance
// Supports month=all to show all months, or month=1-12 for specific month
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get("accountId");
        const month = searchParams.get("month"); // 1-12 or "all"
        const year = searchParams.get("year");
        const category = searchParams.get("category");

        // Pagination parameters
        const page = Math.max(1, Math.floor(Number(searchParams.get("page") || 1)) || 1);
        const perPage = Math.min(200, Math.max(1, Math.floor(Number(searchParams.get("perPage") || 50))) || 50);
        const isExport = searchParams.get("export") === "true";

        const now = new Date();
        const filterYear = year ? parseInt(year) : now.getFullYear();
        const isAllMonths = month === "all" || !month;

        // Build date range for the period
        let startDate: Date;
        let endDate: Date;
        let periodLabel: string;

        if (isAllMonths) {
            // All months for the selected year
            startDate = new Date(filterYear, 0, 1); // Jan 1
            endDate = new Date(filterYear, 11, 31, 23, 59, 59, 999); // Dec 31
            periodLabel = `Tahun ${filterYear}`;
        } else {
            const filterMonth = parseInt(month!);
            startDate = new Date(filterYear, filterMonth - 1, 1);
            endDate = new Date(filterYear, filterMonth, 0, 23, 59, 59, 999);
            periodLabel = new Date(filterYear, filterMonth - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
        }

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

        // ================================================================
        // OPENING BALANCE CALCULATION
        // ================================================================
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
            // "All accounts" mode
            const priorTransactions = await prisma.cashBankTransaction.findMany({
                where: priorWhere,
                select: { type: true, amount: true },
            });
            openingBalance = priorTransactions.reduce((sum, tx) => {
                const amt = Number(tx.amount);
                return sum + (tx.type === "in" ? amt : -amt);
            }, 0);
        }

        // ================================================================
        // FETCH TRANSACTIONS FOR THE PERIOD
        // ================================================================
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

        // ================================================================
        // DETECT SALDO AWAL ROWS WITHIN THIS PERIOD
        // ================================================================
        // If openingBalance is 0 and the earliest transactions contain "saldo awal / sisa setelah serah terima",
        // these ARE the opening balances and should be treated as such.
        let detectedOpeningBalance = 0;
        const saldoAwalTxIds = new Set<number>();

        if (openingBalance === 0 && transactions.length > 0) {
            // Find all "saldo awal" type transactions in this period
            for (const tx of transactions) {
                const desc = tx.description || "";
                if (isOpeningBalanceDescription(desc)) {
                    detectedOpeningBalance += Number(tx.amount) * (tx.type === "in" ? 1 : -1);
                    saldoAwalTxIds.add(tx.id);
                }
            }

            if (detectedOpeningBalance > 0) {
                openingBalance = detectedOpeningBalance;
            }
        }

        // ================================================================
        // BUILD ENTRIES WITH RUNNING BALANCE
        // ================================================================
        // Filter out saldo awal transactions from entries (they're now part of openingBalance)
        const filteredTransactions = transactions.filter((tx) => !saldoAwalTxIds.has(tx.id));
        
        let runningBalance = openingBalance;
        const entries = filteredTransactions.map((tx) => {
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

        // ================================================================
        // SUMMARY (computed from ALL entries, before pagination)
        // ================================================================
        const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
        const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
        const closingBalance = openingBalance + totalDebit - totalCredit;

        // ================================================================
        // PAGINATION (applied after running balance calculation)
        // ================================================================
        const totalEntries = entries.length;
        const totalPages = Math.max(1, Math.ceil(totalEntries / perPage));
        const paginatedEntries = isExport
            ? entries
            : entries.slice((page - 1) * perPage, page * perPage);

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

        // Find the latest transaction date for smart default month detection
        const latestTx = await prisma.cashBankTransaction.findFirst({
            orderBy: { transactionDate: "desc" },
            select: { transactionDate: true },
        });

        // ================================================================
        // PER-ACCOUNT OPENING BALANCE BREAKDOWN (for summary cards)
        // ================================================================
        let accountOpeningBreakdown: { accountName: string; balance: number }[] = [];
        if ((!accountId || accountId === "all") && detectedOpeningBalance > 0) {
            // Group saldo awal transactions by account
            const saldoAwalTxs = transactions.filter((tx) => saldoAwalTxIds.has(tx.id));
            const grouped: Record<string, number> = {};
            for (const tx of saldoAwalTxs) {
                const accName = tx.account?.name || "Unknown";
                const amt = Number(tx.amount) * (tx.type === "in" ? 1 : -1);
                grouped[accName] = (grouped[accName] || 0) + amt;
            }
            accountOpeningBreakdown = Object.entries(grouped).map(([name, bal]) => ({
                accountName: name,
                balance: bal,
            }));
        }

        return NextResponse.json({
            data: {
                period: {
                    month: isAllMonths ? 0 : parseInt(month!),
                    year: filterYear,
                    label: periodLabel,
                },
                openingBalance,
                closingBalance,
                totalDebit,
                totalCredit,
                entries: paginatedEntries,
                accounts,
                accountOpeningBreakdown,
                latestTransactionDate: latestTx?.transactionDate?.toISOString() || null,
                pagination: {
                    page,
                    perPage,
                    total: totalEntries,
                    totalPages,
                },
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
