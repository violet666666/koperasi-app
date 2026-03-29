import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const year = searchParams.get("year") || new Date().getFullYear().toString();
        const yearNum = parseInt(year);

        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);

        // Fetch all active members with their transactions AND savings accounts
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            include: {
                userAccount: { select: { name: true } },
                savingsTransactions: {
                    where: { transactionDate: { gte: startDate, lte: endDate } }
                },
                savingsAccounts: {
                    where: { status: "active" },
                    include: { product: { select: { type: true } } }
                },
                loans: {
                    where: { disbursementDate: { gte: startDate, lte: endDate } }
                },
                storeSales: {
                    where: { createdAt: { gte: startDate, lte: endDate } }
                },
                unitTransactions: {
                    where: { transactionDate: { gte: startDate, lte: endDate } }
                }
            }
        });

        // === SYSTEM-WIDE INCOME CALCULATION ===
        const tokoSalesMember = await prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null } },
            _sum: { totalAmount: true }
        });
        const tokoSalesNonMember = await prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: null },
            _sum: { totalAmount: true }
        });
        const allUnitTx = await prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true },
            _sum: { amount: true }
        });
        const allLoanInterest = await prisma.loanPayment.aggregate({
            where: { paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });

        const memberIncome = Number(tokoSalesMember._sum.totalAmount || 0) +
                             Number(allUnitTx._sum.amount || 0) +
                             Number(allLoanInterest._sum.interestPortion || 0);
        const nonMemberIncome = Number(tokoSalesNonMember._sum.totalAmount || 0);
        const totalIncome = memberIncome + nonMemberIncome;

        const totalExpense = totalIncome * 0.4;
        const memberExpense = totalIncome > 0 ? (memberIncome / totalIncome) * totalExpense : 0;
        const nonMemberExpense = totalIncome > 0 ? (nonMemberIncome / totalIncome) * totalExpense : 0;
        const memberSurplus = memberIncome - memberExpense;
        const nonMemberSurplus = nonMemberIncome - nonMemberExpense;
        const netSurplus = memberSurplus + nonMemberSurplus;

        // === AD-ART MEMBER ALLOCATION (100% of Member Surplus) ===
        // Cadangan 30%, Jasa Anggota 25%, Dana Pengurus 10%, Dana Pegawai 5%, Pendidikan 5%, Sosial 5%
        const mReserveFund = memberSurplus * 0.30;
        const mJasaUsaha = memberSurplus * 0.25;
        const mPengurus = memberSurplus * 0.10;
        const mEmployee = memberSurplus * 0.05;
        const mEducation = memberSurplus * 0.05;
        const mSocial = memberSurplus * 0.05;

        // Jasa Simpanan 20%: uses TOTAL net surplus WITH minimum floor
        const totalActiveSavBal = await prisma.savingsAccount.aggregate({
            where: { status: "active" }, _sum: { balance: true }
        });
        const sysTajib = await prisma.member.aggregate({
            where: { status: "active", deletedAt: null }, _sum: { tabunganWajib: true }
        });
        const totalSavingsCapital = Number(totalActiveSavBal._sum.balance || 0) + Number(sysTajib._sum.tabunganWajib || 0);
        const surplusBasedPool = netSurplus * 0.20;
        const minSavingsReturnPool = (totalSavingsCapital * 0.06) * 0.20;
        const mJasaModal = Math.max(surplusBasedPool, minSavingsReturnPool);

        // === AD-ART NON-MEMBER ALLOCATION ===
        // Cadangan 60%, Pendidikan 20%, Pegawai 10%, Sosial 10%
        const nmReserveFund = nonMemberSurplus * 0.60;
        const nmEmployee = nonMemberSurplus * 0.10;
        const nmEducation = nonMemberSurplus * 0.20;
        const nmSocial = nonMemberSurplus * 0.10;

        // === TOTAL COMBINED FUNDS ===
        const reserveFund = mReserveFund + nmReserveFund;
        const educationFund = mEducation + nmEducation;
        const employeeBonus = mEmployee + nmEmployee;
        const socialFund = mSocial + nmSocial;
        const pengurusFund = mPengurus;
        const jasaModalPool = mJasaModal;
        const jasaUsahaPool = mJasaUsaha;
        const memberDividend = jasaModalPool + jasaUsahaPool;

        // === INDIVIDUAL MEMBER CONTRIBUTIONS ===
        let totalSystemSavings = 0;
        let totalSystemTransactions = 0;

        const rawMemberStats = members.map(m => {
            // Savings contribution: deposits + tabunganWajib + simpanan pokok balance
            let savingsContribution = 0;
            m.savingsTransactions.forEach(tx => {
                if (tx.type === 'deposit') savingsContribution += Number(tx.amount);
            });
            savingsContribution += Number(m.tabunganWajib || 0);
            m.savingsAccounts.forEach(acc => {
                if (acc.product.type === 'pokok') {
                    savingsContribution += Number(acc.balance || 0);
                }
            });

            // Transaction contribution (Store + Unit + Loans)
            let loanContribution = 0;
            m.loans.forEach(l => { loanContribution += Number(l.totalAmount); });
            m.storeSales.forEach(s => { loanContribution += Number(s.totalAmount); });
            m.unitTransactions.forEach(u => { loanContribution += Number(u.amount); });

            totalSystemSavings += savingsContribution;
            totalSystemTransactions += loanContribution;

            return {
                id: m.id,
                memberNo: m.memberNo,
                name: m.userAccount?.name || m.name || "Anggota",
                savingsContribution,
                loanContribution,
                totalContribution: savingsContribution + loanContribution,
                shuAmount: 0,
                percentage: 0
            };
        });

        // === DISTRIBUTE SHU TO EACH MEMBER ===
        const memberSHU = rawMemberStats.map(m => {
            const modalPortion = totalSystemSavings > 0 ? (m.savingsContribution / totalSystemSavings) * jasaModalPool : 0;
            const usahaPortion = totalSystemTransactions > 0 ? (m.loanContribution / totalSystemTransactions) * jasaUsahaPool : 0;
            const myShu = modalPortion + usahaPortion;
            const myPercentage = memberDividend > 0 ? (myShu / memberDividend) * 100 : 0;

            return {
                ...m,
                modalPortion: Math.round(modalPortion),
                usahaPortion: Math.round(usahaPortion),
                shuAmount: Math.round(myShu),
                percentage: Number(myPercentage.toFixed(2))
            };
        }).sort((a, b) => b.shuAmount - a.shuAmount);

        // Determine status dynamically
        const hasAnyContribution = totalSystemSavings > 0 || totalSystemTransactions > 0;
        const status = hasAnyContribution ? "calculated" : "draft";

        return NextResponse.json({
            data: {
                shuData: {
                    year: yearNum,
                    status,
                    totalIncome,
                    totalExpense,
                    netSurplus,
                    memberIncome,
                    memberExpense,
                    memberSurplus,
                    nonMemberIncome,
                    nonMemberExpense,
                    nonMemberSurplus,
                    reserveFund,
                    educationFund,
                    employeeBonus,
                    pengurusFund,
                    socialFund,
                    memberDividend,
                    jasaModalPool,
                    jasaUsahaPool,
                    memberCount: members.length
                },
                memberSHU
            }
        });

    } catch (error) {
        console.error("SHU calculation error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
