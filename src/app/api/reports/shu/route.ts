import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

// AD-ART Pasal 42 — SHU Allocation for Members
const SHU_ALLOCATIONS_MEMBER = [
    { key: "cadangan", label: "Cadangan", percentage: 25, description: "Dana cadangan koperasi (Pasal 43)" },
    { key: "jasa_usaha", label: "Jasa Usaha Anggota", percentage: 30, description: "Dibagi berdasar kontribusi bunga pinjaman anggota" },
    { key: "jasa_simpanan", label: "Jasa Simpanan (Pokok & Wajib)", percentage: 20, description: "Dibagi berdasar proporsi simpanan pokok & wajib anggota" },
    { key: "pengurus_pengawas", label: "Dana Pengurus & Pengawas", percentage: 7.5, description: "Imbalan jasa pengurus dan pengawas" },
    { key: "kesejahteraan", label: "Dana Kesejahteraan Pegawai", percentage: 7.5, description: "Kesejahteraan pegawai/karyawan koperasi" },
    { key: "pendidikan", label: "Dana Pendidikan Koperasi", percentage: 5, description: "Pendidikan perkoperasian anggota" },
    { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Dana kegiatan sosial koperasi" },
];

// AD-ART Pasal 42 — SHU Allocation for Non-Member revenue
const SHU_ALLOCATIONS_NON_MEMBER = [
    { key: "cadangan", label: "Dana Cadangan", percentage: 60 },
    { key: "pendidikan1", label: "Dana Pendidikan Koperasi", percentage: 10 },
    { key: "kesejahteraan", label: "Dana Kesejahteraan Pegawai", percentage: 10 },
    { key: "pendidikan2", label: "Dana Pendidikan Koperasi (2)", percentage: 10 },
    { key: "sosial", label: "Dana Sosial", percentage: 10 },
];

function toNum(d: Decimal | number): number {
    return typeof d === "number" ? d : Number(d);
}

// GET /api/reports/shu - Real SHU Report based on journal aggregation
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        // 1. Calculate Net Income from journal entries for the year
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);

        // Get all journal lines for the year, grouped by account type
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: startDate, lte: endDate },
                    isPosted: true,
                },
            },
            include: {
                account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } },
            },
        });

        // Aggregate income and expenses
        let totalIncome = 0;
        let totalExpense = 0;
        const incomeAccounts: Record<string, { code: string; name: string; amount: number }> = {};
        const expenseAccounts: Record<string, { code: string; name: string; amount: number }> = {};

        for (const line of journalLines) {
            const { account } = line;
            const debit = toNum(line.debit);
            const credit = toNum(line.credit);

            if (account.type === "income") {
                // Income normal balance is credit
                const amount = credit - debit;
                totalIncome += amount;
                if (!incomeAccounts[account.code]) {
                    incomeAccounts[account.code] = { code: account.code, name: account.name, amount: 0 };
                }
                incomeAccounts[account.code].amount += amount;
            } else if (account.type === "expense") {
                // Expense normal balance is debit
                const amount = debit - credit;
                totalExpense += amount;
                if (!expenseAccounts[account.code]) {
                    expenseAccounts[account.code] = { code: account.code, name: account.name, amount: 0 };
                }
                expenseAccounts[account.code].amount += amount;
            }
        }

        const netIncome = totalIncome - totalExpense; // This is the SHU

        // 2. Calculate allocations per AD-ART Pasal 42
        const allocations = SHU_ALLOCATIONS_MEMBER.map((alloc) => ({
            category: alloc.label,
            percentage: alloc.percentage,
            amount: Math.round((netIncome * alloc.percentage) / 100),
            description: alloc.description,
            key: alloc.key,
        }));

        // 3. Calculate per-member SHU
        // jasa_simpanan (20%) — proportional to simpanan pokok + wajib balance
        // jasa_usaha (30%) — proportional to loan interest paid during the year
        const jasaSimpananPool = Math.round((netIncome * 20) / 100);
        const jasaUsahaPool = Math.round((netIncome * 30) / 100);

        // Get active members with their savings and loan data
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: {
                id: true,
                memberNo: true,
                name: true,
                savingsAccounts: {
                    where: { status: "active" },
                    include: { product: { select: { type: true } } },
                },
                loanPayments: {
                    where: {
                        paymentDate: { gte: startDate, lte: endDate },
                    },
                    select: { interestPortion: true },
                },
            },
        });

        // Calculate totals for proportional distribution
        let totalSavingsAll = 0;
        let totalInterestPaidAll = 0;

        const memberData = members.map((m) => {
            const savingsBalance = m.savingsAccounts
                .filter((sa) => sa.product.type === "pokok" || sa.product.type === "wajib")
                .reduce((sum, sa) => sum + toNum(sa.balance), 0);

            const interestPaid = m.loanPayments.reduce(
                (sum, lp) => sum + toNum(lp.interestPortion),
                0
            );

            totalSavingsAll += savingsBalance;
            totalInterestPaidAll += interestPaid;

            return {
                memberNo: m.memberNo,
                name: m.name,
                savingsBalance,
                interestPaid,
            };
        });

        // Distribute SHU to each member
        const memberShu = memberData.map((m) => {
            const savingsContribution =
                totalSavingsAll > 0
                    ? Math.round((m.savingsBalance / totalSavingsAll) * jasaSimpananPool)
                    : 0;
            const loanContribution =
                totalInterestPaidAll > 0
                    ? Math.round((m.interestPaid / totalInterestPaidAll) * jasaUsahaPool)
                    : 0;
            const totalContribution = m.savingsBalance + m.interestPaid;
            const shuShare = savingsContribution + loanContribution;

            return {
                memberNo: m.memberNo,
                name: m.name,
                savingsContribution: savingsContribution,
                loanContribution: loanContribution,
                totalContribution,
                shuShare,
            };
        });

        const shuReport = {
            totalShu: netIncome,
            period: String(year),
            totalIncome,
            totalExpense,
            memberSharePercent: 50, // 30% jasa usaha + 20% jasa simpanan
            allocations,
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
