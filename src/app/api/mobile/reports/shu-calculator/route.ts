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

function toNum(d: Decimal | number): number {
    return typeof d === "number" ? d : Number(d);
}

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        const startDate = new Date(year, 0, 1).toISOString();
        const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

        // 1. Calculate Net Income
        const journalLines = await prisma.journalLine.findMany({
            where: {
                journal: {
                    transactionDate: { gte: startDate, lte: endDate },
                    isPosted: true,
                },
            },
            include: { account: { select: { type: true } } },
        });

        let totalIncome = 0;
        let totalExpense = 0;

        for (const line of journalLines) {
            const { account } = line;
            const debit = toNum(line.debit);
            const credit = toNum(line.credit);

            if (account.type === "income") totalIncome += (credit - debit);
            else if (account.type === "expense") totalExpense += (debit - credit);
        }

        const netIncome = Math.max(0, totalIncome - totalExpense);

        // 2. Alokasi Global (Member vs Non-Member logic disederhanakan 100% untuk app ini kecuali ditentukan lain)
        const allocations = SHU_ALLOCATIONS_MEMBER.map((alloc) => ({
            ...alloc,
            amount: Math.round((netIncome * alloc.percentage) / 100),
        }));

        // 3. Kalkulasi Spesifik per Anggota
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

            // Integrasikan tabunganWajib eks-sistem
            const totalSimpanan = savingsAccountBalance + toNum(m.tabunganWajib || 0);

            // Loan contribution: principalPaid (karena bunga 0%)
            const paymentContrib = m.loanPayments.reduce((sum, lp) => sum + toNum(lp.principalPortion) + toNum(lp.interestPortion), 0);
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
                netIncome,
                allocations,
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
