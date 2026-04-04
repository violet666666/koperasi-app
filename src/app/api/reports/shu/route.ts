import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// AD-ART Pasal 42 — SHU Allocation for Members
const SHU_ALLOCATIONS_MEMBER = [
    { key: "jasa_modal", label: "Jasa Modal (Simpanan)", percentage: 25, description: "Dibagi berdasar proporsi simpanan anggota" },
    { key: "jasa_pelayanan", label: "Jasa Pelayanan (Pinjaman)", percentage: 25, description: "Dibagi berdasar kontribusi pinjaman" },
    { key: "pengurus", label: "Dana Pengurus", percentage: 10, description: "Imbalan jasa pengurus" },
    { key: "pegawai", label: "Dana Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
    { key: "pembangunan", label: "Dana Pembangunan Daerah Kerja", percentage: 10, description: "Pembangunan daerah kerja" },
    { key: "audit", label: "Dana Audit", percentage: 10, description: "Biaya audit PRIMKOPPOL" },
    { key: "pendidikan", label: "Dana Pendidikan", percentage: 5, description: "Pendidikan PRIMKOPPOL" },
    { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Kegiatan sosial" },
];

// AD-ART Pasal 42 — SHU Allocation for Non-Member revenue
const SHU_ALLOCATIONS_NON_MEMBER = [
    { key: "cadangan", label: "Dana Cadangan", percentage: 60, description: "Dana cadangan PRIMKOPPOL" },
    { key: "pengurus", label: "Dana Pengurus", percentage: 10, description: "Imbalan jasa pengurus" },
    { key: "pegawai", label: "Dana Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
    { key: "pendidikan1", label: "Dana Pendidikan", percentage: 10, description: "Dana Pendidikan PRIMKOPPOL" },
    { key: "sosial", label: "Dana Sosial", percentage: 10, description: "Dana Sosial PRIMKOPPOL" },
];

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

// GET /api/reports/shu - Real SHU Report based on journal aggregation
// Supports: ?year=2026 (full year) or ?year=2026&month=3 (specific month)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthParam = searchParams.get("month"); // 1-12 or null/all
        const isAllMonths = !monthParam || monthParam === "all";
        const month = isAllMonths ? null : parseInt(monthParam);

        // 1. Build date range — either a specific month or the full year
        let startDate: Date;
        let endDate: Date;
        let periodLabel: string;

        if (!isAllMonths && month !== null) {
            // Specific month: e.g., month=3 → March 1 to March 31
            startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // day=0 gives last day of previous month
            const monthName = new Date(year, month - 1).toLocaleDateString("id-ID", { month: "long" });
            periodLabel = `${monthName} ${year}`;
        } else {
            startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
            periodLabel = `Tahun ${year}`;
        }

        // Get all journal lines for the year, grouped by account type
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: startDate, lte: endDate },
                    // isPosted: true dilonggarkan karena pada data awal mungkin jurnal belum ada flag posted yang benar
                },
            },
            include: {
                account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
            },
        });

        // Aggregate income and expenses
        let totalIncome = 0;
        let totalExpense = 0;
        const incomeDetails: { code: string; name: string; amount: number }[] = [];
        const expenseDetails: { code: string; name: string; amount: number }[] = [];
        const incomeAccounts: Record<string, { code: string; name: string; amount: number }> = {};
        const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

        if (journalLines.length > 0) {
            for (const line of journalLines) {
                const { account } = line;
                const debit = toNum(line.debit);
                const credit = toNum(line.credit);

                if (account.type === "income") {
                    const amount = credit - debit;
                    totalIncome += amount;
                    if (!incomeAccounts[account.code]) {
                        incomeAccounts[account.code] = { code: account.code, name: account.name, amount: 0 };
                    }
                    incomeAccounts[account.code].amount += amount;
                } else if (account.type === "expense") {
                    const amount = debit - credit;
                    totalExpense += amount;
                    if (!expenseAccounts[account.code]) {
                        expenseAccounts[account.code] = { code: account.code, name: account.name, amount: 0 };
                    }
                    expenseAccounts[account.code].amount += amount;
                }
            }

            // Build income/expense detail arrays
            for (const key of Object.keys(incomeAccounts)) {
                incomeDetails.push(incomeAccounts[key]);
            }
            for (const key of Object.keys(expenseAccounts)) {
                expenseDetails.push(expenseAccounts[key]);
            }
        } else {
            // FALLBACK: If no formal journal entries exist, derive Income/Expense from CashBank and StoreSales
            
            // 1. Get Expenses mostly from Biaya Operasional
            const expensesTx = await prisma.cashBankTransaction.findMany({
                where: { transactionDate: { gte: startDate, lte: endDate }, category: "biaya_operasional" }
            });
            let cbExpenseTotal = 0;
            expensesTx.forEach(tx => cbExpenseTotal += toNum(tx.amount));
            totalExpense += cbExpenseTotal;
            if (cbExpenseTotal > 0) {
                expenseDetails.push({ code: "CB-EXP", name: "Biaya Operasional (Kas & Bank)", amount: cbExpenseTotal });
            }

            // 2. Derive Income from "Lainnya" transactions that are inward and aren't obviously capital/liabilities
            const incomeTx = await prisma.cashBankTransaction.findMany({
                where: { 
                    transactionDate: { gte: startDate, lte: endDate }, 
                    category: "lainnya",
                    type: "in"
                }
            });
            let cbIncomeTotal = 0;
            incomeTx.forEach(tx => {
                const desc = (tx.description || "").toLowerCase();
                // Exclude common descriptors for equity/liability/asset transfers
                if (!desc.includes("saldo") && !desc.includes("simpan") && !desc.includes("potongan") && !desc.includes("ansuran") && !desc.includes("sp")) {
                    cbIncomeTotal += toNum(tx.amount);
                }
            });
            totalIncome += cbIncomeTotal;
            if (cbIncomeTotal > 0) {
                incomeDetails.push({ code: "CB-INC", name: "Pendapatan Lainnya (Kas & Bank)", amount: cbIncomeTotal });
            }

            // 3. Add Store Sales Gross Revenue as Income (Fallback since COGS might not be calculated properly without journals)
            try {
                const storeSalesInc = await prisma.storeSale.aggregate({
                    where: { createdAt: { gte: startDate, lte: endDate } },
                    _sum: { totalAmount: true }
                });
                const storeIncTotal = toNum(storeSalesInc._sum.totalAmount);
                if (storeIncTotal > 0) {
                    totalIncome += storeIncTotal;
                    incomeDetails.push({ code: "ST-INC", name: "Pendapatan Toko / Minimarket", amount: storeIncTotal });
                }
            } catch (e) {
                // Ignore if StoreSale table doesn't exist
            }
        }

        const netIncome = Math.max(0, totalIncome - totalExpense); // This is the SHU, ensure it's not negative for distribution

        // 2. Calculate allocations per AD-ART Pasal 42
        const memberNetIncome = Math.round(netIncome * 0.8);
        const nonMemberNetIncome = Math.round(netIncome * 0.2);

        const allocationsMember = SHU_ALLOCATIONS_MEMBER.map((alloc) => ({
            category: alloc.label,
            percentage: alloc.percentage,
            amount: Math.round((memberNetIncome * alloc.percentage) / 100),
            description: alloc.description,
            key: alloc.key,
        }));

        const allocationsNonMember = SHU_ALLOCATIONS_NON_MEMBER.map((alloc) => ({
            category: alloc.label,
            percentage: alloc.percentage,
            amount: Math.round((nonMemberNetIncome * alloc.percentage) / 100),
            description: alloc.description,
            key: alloc.key,
        }));

        // 3. Calculate per-member SHU
        const jasaSimpananPool = Math.round((memberNetIncome * 25) / 100);
        const jasaUsahaPool = Math.round((memberNetIncome * 25) / 100);

        // Get active members with their savings, loan data, AND shop purchases
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: {
                id: true,
                memberNo: true,
                name: true,
                tabunganWajib: true,
                savingsAccounts: {
                    where: { status: "active" },
                    include: { product: { select: { type: true } } },
                },
                loans: {
                    where: { status: { in: ["active", "overdue", "paid_off"] } },
                    select: { principalPaid: true, principalAmount: true },
                },
                loanPayments: {
                    where: {
                        paymentDate: { gte: startDate, lte: endDate },
                    },
                    select: { principalPortion: true, interestPortion: true },
                },
            },
        });

        // Get shop purchase totals per member (Belanja)
        let memberPurchases: Record<number, number> = {};
        try {
            const sales = await prisma.storeSale.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    memberId: { not: null },
                },
                select: { memberId: true, totalAmount: true },
            });
            for (const sale of sales) {
                if (sale.memberId) {
                    memberPurchases[sale.memberId] = (memberPurchases[sale.memberId] || 0) + toNum(sale.totalAmount);
                }
            }
        } catch (e) {
            // Sale model might not exist yet — gracefully fallback
            console.log("Sale model not available for SHU belanja calculation");
        }

        // Also get UnitTransaction totals per member
        try {
            const unitTx = await prisma.unitTransaction.findMany({
                where: {
                    transactionDate: { gte: startDate, lte: endDate },
                },
                select: { memberId: true, amount: true },
            });
            for (const tx of unitTx) {
                if (tx.memberId) {
                    memberPurchases[tx.memberId] = (memberPurchases[tx.memberId] || 0) + toNum(tx.amount);
                }
            }
        } catch (e) {
            console.log("UnitTransaction query error for SHU calculation");
        }

        // Calculate totals for proportional distribution
        let totalSavingsAll = 0;
        let totalLoanContribAll = 0;
        let totalPurchasesAll = 0;

        const memberData = members.map((m) => {
            // Savings: pokok + wajib accounts + tabunganWajib field
            const savingsBalance = m.savingsAccounts
                .filter((sa) => sa.product.type === "pokok" || sa.product.type === "wajib")
                .reduce((sum, sa) => sum + toNum(sa.balance), 0) + Number(m.tabunganWajib || 0);

            // Loan contribution: principalPaid across ALL loans (since interest is 0%, bunga tidak relevan)
            // Use actual payments if available, otherwise use loan.principalPaid
            const paymentContrib = m.loanPayments.reduce(
                (sum, lp) => sum + toNum(lp.principalPortion) + toNum(lp.interestPortion), 0
            );
            const loanPrincipalPaid = m.loans.reduce(
                (sum, l) => sum + toNum(l.principalPaid), 0
            );
            // Use whichever is larger (payments this year vs total principalPaid)
            const loanContrib = Math.max(paymentContrib, loanPrincipalPaid);

            // Purchases (Belanja)
            const purchases = memberPurchases[m.id] || 0;

            totalSavingsAll += savingsBalance;
            totalLoanContribAll += loanContrib;
            totalPurchasesAll += purchases;

            return {
                memberNo: m.memberNo,
                name: m.name,
                savingsBalance,
                loanContrib,
                purchases,
            };
        });

        // Distribute SHU to each member
        // Jasa Modal (25%): proportional to savings
        // Jasa Usaha (25%): proportional to loan payments + purchases (total transaksi)
        const memberShu = memberData.map((m) => {
            const savingsContribution =
                totalSavingsAll > 0
                    ? Math.round((m.savingsBalance / totalSavingsAll) * jasaSimpananPool)
                    : 0;
            
            const totalTransaksi = m.loanContrib + m.purchases;
            const totalTransaksiAll = totalLoanContribAll + totalPurchasesAll;
            const loanContribution =
                totalTransaksiAll > 0
                    ? Math.round((totalTransaksi / totalTransaksiAll) * jasaUsahaPool)
                    : 0;
            
            const totalContribution = m.savingsBalance + totalTransaksi;
            const shuShare = savingsContribution + loanContribution;

            return {
                memberNo: m.memberNo,
                name: m.name,
                savingsContribution,
                loanContribution,
                purchaseContribution: m.purchases,
                totalContribution,
                shuShare,
            };
        });

        const shuReport = {
            totalShu: netIncome,
            period: String(year),
            month: month ?? 0, // 0 means all months
            periodLabel, // e.g. "Maret 2026" or "Tahun 2026"
            totalIncome,
            totalExpense,
            memberNetIncome,
            nonMemberNetIncome,
            memberSharePercent: 50, // 25% jasa usaha + 25% jasa simpanan
            allocationsMember,
            allocationsNonMember,
            incomeDetails: incomeDetails.sort((a, b) => b.amount - a.amount),
            expenseDetails: expenseDetails.sort((a, b) => b.amount - a.amount),
            memberShu: memberShu.sort((a, b) => b.shuShare - a.shuShare),
        };

        return NextResponse.json({ data: shuReport });
    } catch (error) {
        console.error("GET /api/reports/shu error:", error);
        return NextResponse.json(
            { message: "Failed to generate SHU report" },
            { status: 500 }
        );
    }
}
