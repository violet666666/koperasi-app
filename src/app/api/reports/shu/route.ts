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
    { key: "audit", label: "Dana Audit", percentage: 10, description: "Biaya audit koperasi" },
    { key: "pendidikan", label: "Dana Pendidikan", percentage: 5, description: "Pendidikan perkoperasian" },
    { key: "sosial", label: "Dana Sosial", percentage: 5, description: "Kegiatan sosial" },
];

// AD-ART Pasal 42 — SHU Allocation for Non-Member revenue
const SHU_ALLOCATIONS_NON_MEMBER = [
    { key: "cadangan", label: "Dana Cadangan", percentage: 60, description: "Dana cadangan koperasi" },
    { key: "pengurus", label: "Dana Pengurus", percentage: 10, description: "Imbalan jasa pengurus" },
    { key: "pegawai", label: "Dana Pegawai", percentage: 10, description: "Kesejahteraan pegawai/karyawan" },
    { key: "pendidikan1", label: "Dana Pendidikan", percentage: 10, description: "Dana Pendidikan Koperasi" },
    { key: "sosial", label: "Dana Sosial", percentage: 10, description: "Dana Sosial Koperasi" },
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
        // Default assumption: 80% income from members, 20% from non-members for display purposes
        // Real implementation should split Net Income based on exact Journal types
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
        // Jasa Modal (25%) — proportional to simpanan pokok + wajib balance
        // Jasa Pelayanan (25%) — proportional to loan interest paid/admin fee paid
        const jasaSimpananPool = Math.round((memberNetIncome * 25) / 100);
        const jasaUsahaPool = Math.round((memberNetIncome * 25) / 100);

        // Get active members with their savings and loan data
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
                .reduce((sum, sa) => sum + toNum(sa.balance), 0) + Number(m.tabunganWajib || 0);

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
            memberNetIncome,
            nonMemberNetIncome,
            memberSharePercent: 50, // 25% jasa usaha + 25% jasa simpanan
            allocationsMember,
            allocationsNonMember,
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
