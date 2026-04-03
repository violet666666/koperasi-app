import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

const SHU_ALLOCATIONS_MEMBER = [
    { key: "jasa_modal", label: "Jasa Modal (Simpanan)", percentage: 25 },
    { key: "jasa_pelayanan", label: "Jasa Pelayanan (Pinjaman)", percentage: 25 },
    { key: "pengurus", label: "Dana Pengurus", percentage: 10 },
    { key: "pegawai", label: "Dana Pegawai", percentage: 10 },
    { key: "pembangunan", label: "Dana Pembangunan DK", percentage: 10 },
    { key: "audit", label: "Dana Audit", percentage: 10 },
    { key: "pendidikan", label: "Dana Pendidikan", percentage: 5 },
    { key: "sosial", label: "Dana Sosial", percentage: 5 },
];

function toNum(d: Decimal | number | null | undefined): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(d);
}

// GET /api/mobile/reports/shu-calculator
// Supports: ?year=2026 (full year) or ?year=2026&month=3 (specific month, 1-12)
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthParam = searchParams.get("month"); // "1"-"12" or null/"all"
        const isAllMonths = !monthParam || monthParam === "all";
        const month = isAllMonths ? null : parseInt(monthParam);

        // Build date range
        let startDate: Date;
        let endDate: Date;
        let periodLabel: string;

        if (!isAllMonths && month !== null) {
            startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
            const monthName = new Date(year, month - 1).toLocaleDateString("id-ID", { month: "long" });
            periodLabel = `${monthName} ${year}`;
        } else {
            startDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
            periodLabel = `Tahun ${year}`;
        }

        // 1. Try to calculate Net Income from formal journal entries
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: startDate, lte: endDate },
                    isPosted: true,
                },
            },
            include: { account: { select: { type: true, code: true, name: true, normalBalance: true } } },
        });

        let totalIncome = 0;
        let totalExpense = 0;
        const incomeDetails: { code: string; name: string; amount: number }[] = [];
        const expenseDetails: { code: string; name: string; amount: number }[] = [];

        if (journalLines.length > 0) {
            // Use formal journal entries
            const incomeAccounts: Record<string, { code: string; name: string; amount: number }> = {};
            const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

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

            for (const key of Object.keys(incomeAccounts)) incomeDetails.push(incomeAccounts[key]);
            for (const key of Object.keys(expenseAccounts)) expenseDetails.push(expenseAccounts[key]);
        } else {
            // FALLBACK: Derive from CashBankTransaction + StoreSale (same logic as web API)

            // Expenses: biaya_operasional category
            const expensesTx = await prisma.cashBankTransaction.findMany({
                where: { transactionDate: { gte: startDate, lte: endDate }, category: "biaya_operasional" }
            });
            let cbExpenseTotal = 0;
            expensesTx.forEach(tx => cbExpenseTotal += toNum(tx.amount));
            totalExpense += cbExpenseTotal;
            if (cbExpenseTotal > 0) {
                expenseDetails.push({ code: "CB-EXP", name: "Biaya Operasional (Kas & Bank)", amount: cbExpenseTotal });
            }

            // Income: "lainnya" category, type="in", exclude equity/liability-like descriptions
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
                if (!desc.includes("saldo") && !desc.includes("simpan") && !desc.includes("potongan") && !desc.includes("ansuran") && !desc.includes("sp")) {
                    cbIncomeTotal += toNum(tx.amount);
                }
            });
            totalIncome += cbIncomeTotal;
            if (cbIncomeTotal > 0) {
                incomeDetails.push({ code: "CB-INC", name: "Pendapatan Lainnya (Kas & Bank)", amount: cbIncomeTotal });
            }

            // Store sales gross revenue
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
                // Ignore if StoreSale table inaccessible
            }
        }

        const netIncome = Math.max(0, totalIncome - totalExpense);

        // 2. Alokasi SHU
        const allocations = SHU_ALLOCATIONS_MEMBER.map((alloc) => ({
            ...alloc,
            amount: Math.round((netIncome * alloc.percentage) / 100),
        }));

        // 3. Per-member calculation
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: {
                id: true, memberNo: true, name: true, tabunganWajib: true,
                savingsAccounts: {
                    where: { status: "active" },
                    include: { product: { select: { type: true } } },
                },
                loans: {
                    where: { status: { in: ["active", "overdue", "paid_off"] } },
                    select: { principalPaid: true },
                },
                loanPayments: {
                    where: { paymentDate: { gte: startDate, lte: endDate } },
                    select: { principalPortion: true, interestPortion: true },
                },
            },
        });

        let totalSavingsAll = 0;
        let totalLoanContribAll = 0;

        const memberData = members.map((m) => {
            const savingsAccountBalance = m.savingsAccounts
                .filter((sa) => sa.product.type === "pokok" || sa.product.type === "wajib")
                .reduce((sum, sa) => sum + toNum(sa.balance), 0);

            const totalSimpanan = savingsAccountBalance + toNum(m.tabunganWajib || 0);

            const paymentContrib = m.loanPayments.reduce(
                (sum, lp) => sum + toNum(lp.principalPortion) + toNum(lp.interestPortion), 0
            );
            const loanPrincipalPaid = m.loans.reduce((sum, l) => sum + toNum(l.principalPaid), 0);
            const loanContrib = Math.max(paymentContrib, loanPrincipalPaid);

            totalSavingsAll += totalSimpanan;
            totalLoanContribAll += loanContrib;

            return {
                id: m.id,
                memberNo: m.memberNo,
                name: m.name,
                totalSavings: totalSimpanan,
                totalLoanContrib: loanContrib,
                jasaModalRawProp: 0,
                jasaUsahaProp: 0,
                totalShu: 0,
            };
        });

        const allocationModal = allocations.find(a => a.key === "jasa_modal")?.amount || 0;
        const allocationUsaha = allocations.find(a => a.key === "jasa_pelayanan")?.amount || 0;

        memberData.forEach((m) => {
            if (totalSavingsAll > 0) {
                m.jasaModalRawProp = Math.round((m.totalSavings / totalSavingsAll) * allocationModal);
            }
            if (totalLoanContribAll > 0) {
                m.jasaUsahaProp = Math.round((m.totalLoanContrib / totalLoanContribAll) * allocationUsaha);
            }
            m.totalShu = m.jasaModalRawProp + m.jasaUsahaProp;
        });

        memberData.sort((a, b) => b.totalShu - a.totalShu);
        const topMembers = memberData.slice(0, 10);

        return NextResponse.json({
            data: {
                year,
                month: month ?? 0,
                periodLabel,
                netIncome,
                totalIncome,
                totalExpense,
                allocations,
                incomeDetails: incomeDetails.sort((a, b) => b.amount - a.amount),
                expenseDetails: expenseDetails.sort((a, b) => b.amount - a.amount),
                topMembers,
                summary: {
                    totalSavingsAll,
                    totalLoanContribAll,
                }
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/reports/shu-calculator error:", error);
        return NextResponse.json({ message: "Gagal memproses kalkulasi SHU" }, { status: 500 });
    }
}
