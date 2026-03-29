import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

const SHU_ALLOCATIONS_MEMBER = [
    { key: "jasa_modal", label: "Jasa Simpanan (Modal)", percentage: 20 },
    { key: "jasa_pelayanan_simpan_pinjam", label: "Jasa Usaha Anggota", percentage: 25 },
    { key: "cadangan", label: "Cadangan Koperasi", percentage: 30 },
    { key: "pengurus", label: "Jasa Pengurus", percentage: 10 },
    { key: "kesejahteraan_karyawan", label: "Kesejahteraan Karyawan", percentage: 5 },
    { key: "pendidikan", label: "Dana Pendidikan", percentage: 5 },
    { key: "sosial", label: "Dana Sosial", percentage: 2.5 },
    { key: "pembangunan", label: "Dana Pembangunan DK", percentage: 2.5 },
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
                loanPayments: {
                    where: { paymentDate: { gte: startDate, lte: endDate } },
                    select: { interestPortion: true },
                },
            },
        });

        let totalSavingsAll = 0;
        let totalInterestPaidAll = 0;

        const memberData = members.map((m) => {
            const savingsAccountBalance = m.savingsAccounts
                .filter((sa) => sa.product.type === "pokok" || sa.product.type === "wajib")
                .reduce((sum, sa) => sum + toNum(sa.balance), 0);

            // Integrasikan tabunganWajib eks-sistem
            const totalSimpanan = savingsAccountBalance + toNum(m.tabunganWajib || 0);

            const interestPaid = m.loanPayments.reduce((sum, lp) => sum + toNum(lp.interestPortion), 0);
            
            totalSavingsAll += totalSimpanan;
            totalInterestPaidAll += interestPaid;

            return {
                id: m.id,
                memberNo: m.memberNo,
                name: m.name,
                totalSavings: totalSimpanan,
                totalInterestPaid: interestPaid,
                jasaModalRawProp: 0,
                jasaUsahaProp: 0,
                totalShu: 0,
            };
        });

        const allocationModal = allocations.find(a => a.key === "jasa_modal")?.amount || 0;
        const allocationUsaha = allocations.find(a => a.key === "jasa_pelayanan_simpan_pinjam")?.amount || 0;

        // Terapkan Rule 6% Floor Rate Web Apps
        const interestRateMin = 0.06;
        let deficitJasaModal = 0;

        memberData.forEach((m) => {
            if (totalSavingsAll > 0) {
                const proportionalShare = (m.totalSavings / totalSavingsAll) * allocationModal;
                const minimumShare = m.totalSavings * interestRateMin;
                
                m.jasaModalRawProp = Math.max(proportionalShare, minimumShare);
                // Hitung defisit yg harus ditambal Cadangan jika pro rata kurang dari 6%
                if (minimumShare > proportionalShare) {
                    deficitJasaModal += (minimumShare - proportionalShare);
                }
            }
            if (totalInterestPaidAll > 0) {
                m.jasaUsahaProp = Math.round((m.totalInterestPaid / totalInterestPaidAll) * allocationUsaha);
            }
            m.totalShu = Math.round(m.jasaModalRawProp + m.jasaUsahaProp);
        });

        // Potong alokasi Cadangan jika menambal floor 6%
        const cadanganIndex = allocations.findIndex(a => a.key === "cadangan");
        if (cadanganIndex !== -1 && deficitJasaModal > 0) {
            allocations[cadanganIndex].amount = Math.max(0, allocations[cadanganIndex].amount - Math.round(deficitJasaModal));
        }
        
        const jasaModalIndex = allocations.findIndex(a => a.key === "jasa_modal");
        if (jasaModalIndex !== -1 && deficitJasaModal > 0) {
           allocations[jasaModalIndex].amount += Math.round(deficitJasaModal);
        }

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
                    totalInterestPaidAll,
                }
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/reports/shu-calculator error:", error);
        return NextResponse.json({ message: "Gagal memproses kalkulasi SHU" }, { status: 500 });
    }
}
