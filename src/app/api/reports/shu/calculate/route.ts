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

        // Fetch all members with their transactions for the given year
        const startDate = new Date(`${yearNum}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${yearNum}-12-31T23:59:59.999Z`);

        const members = await prisma.member.findMany({
            where: { status: "active" },
            include: {
                userAccount: { select: { name: true } },
                savingsTransactions: {
                    where: { transactionDate: { gte: startDate, lte: endDate } }
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

        // Calculate total cooperative income/expense (simplified for SHU demo based on real DB values)
        // 1. Toko Sales Income (Member vs Non-Member)
        const tokoSalesMember = await prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null } },
            _sum: { totalAmount: true }
        });
        const tokoSalesNonMember = await prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: null },
            _sum: { totalAmount: true }
        });
        
        // 2. Unit Transactions Income (Member only)
        const allUnitTx = await prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true },
            _sum: { amount: true }
        });

        // 3. Loan Interest Income (Member only)
        const allLoanInterest = await prisma.loanPayment.aggregate({
            where: { paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });

        const memberIncome = Number(tokoSalesMember._sum.totalAmount || 0) + 
                             Number(allUnitTx._sum.amount || 0) + 
                             Number(allLoanInterest._sum.interestPortion || 0);
                             
        const nonMemberIncome = Number(tokoSalesNonMember._sum.totalAmount || 0);

        const totalIncome = memberIncome + nonMemberIncome;

        // Expense Allocation (Assumption: Pro-rated across incomes)
        const totalExpense = totalIncome * 0.4; // Assuming 40% expenses total
        const memberExpense = totalIncome > 0 ? (memberIncome / totalIncome) * totalExpense : 0;
        const nonMemberExpense = totalIncome > 0 ? (nonMemberIncome / totalIncome) * totalExpense : 0;
        const memberSurplus = memberIncome - memberExpense;
        const nonMemberSurplus = nonMemberIncome - nonMemberExpense;
        const netSurplus = memberSurplus + nonMemberSurplus;

        // --- AD-ART MEMBER --- (100% of Member Surplus)
        // Per lampiran gambar parameter SHU Anggota:
        // 1. Jasa Anggota 25%, 2. Jasa Simpanan 20%, 3. Cadangan 30%,
        // 4. Dana Pengurus 10%, 5. Dana Pegawai 5%, 6. Dana Pendidikan 5%, 7. Dana Sosial 5%
        const mReserveFund = memberSurplus * 0.30;  // Cadangan
        const mJasaUsaha = memberSurplus * 0.25;    // Jasa Anggota
        const mJasaModal = memberSurplus * 0.20;    // Jasa Simpanan
        const mPengurus = memberSurplus * 0.10;     // Dana Pengurus
        const mEmployee = memberSurplus * 0.05;     // Dana Pegawai
        const mEducation = memberSurplus * 0.05;    // Dana Pendidikan
        const mSocial = memberSurplus * 0.05;       // Dana Sosial

        // --- AD-ART NON-MEMBER --- (100% of Non-Member Surplus)
        const nmReserveFund = nonMemberSurplus * 0.60;
        const nmEmployee = nonMemberSurplus * 0.10;
        const nmEducation = nonMemberSurplus * 0.20; // Type in AD-ART is 10%+10% combined
        const nmSocial = nonMemberSurplus * 0.10;

        // --- TOTAL FUNDS FOR DISTRIBUTION ---
        const reserveFund = mReserveFund + nmReserveFund;
        const educationFund = mEducation + nmEducation;
        const employeeBonus = mEmployee + nmEmployee;
        const socialFund = mSocial + nmSocial;
        const pengurusFund = mPengurus;
        
        const jasaModalPool = mJasaModal;
        const jasaUsahaPool = mJasaUsaha;
        const memberDividend = jasaModalPool + jasaUsahaPool; // For backward-compatibility sum

        // Calculate individual member contributions
        let totalSystemSavings = 0;
        let totalSystemTransactions = 0;

        const rawMemberStats = members.map(m => {
            // Savings contribution (Total Deposits)
            let savingsContribution = 0;
            m.savingsTransactions.forEach(tx => {
                if (tx.type === 'in') savingsContribution += Number(tx.amount);
            });
            // Also include their base balance
            // Removed logical dummy fallback to represent real calculations

            // Transaction contribution (Store + Unit + Loans)
            let loanContribution = 0;
            m.loans.forEach(l => { loanContribution += Number(l.totalAmount); });
            m.storeSales.forEach(s => { loanContribution += Number(s.totalAmount); });
            m.unitTransactions.forEach(u => { loanContribution += Number(u.amount); });
            // Removed dummy fallback to reflect true AD-ART zero contribution

            totalSystemSavings += savingsContribution;
            totalSystemTransactions += loanContribution;

            return {
                id: m.id,
                memberNo: m.memberNo,
                name: m.userAccount?.name || "Anggota",
                savingsContribution,
                loanContribution,
                totalContribution: savingsContribution + loanContribution,
                shuAmount: 0,
                percentage: 0
            };
        });

        // Calculation is handled above with jasaModalPool and jasaUsahaPool

        const memberSHU = rawMemberStats.map(m => {
            const modalPortion = totalSystemSavings > 0 ? (m.savingsContribution / totalSystemSavings) * jasaModalPool : 0;
            const usahaPortion = totalSystemTransactions > 0 ? (m.loanContribution / totalSystemTransactions) * jasaUsahaPool : 0;
            const myShu = modalPortion + usahaPortion;
            const myPercentage = memberDividend > 0 ? (myShu / memberDividend) * 100 : 0;

            return {
                ...m,
                shuAmount: Math.round(myShu),
                percentage: Number(myPercentage.toFixed(2))
            };
        }).sort((a, b) => b.shuAmount - a.shuAmount); // Sort by highest SHU

        return NextResponse.json({
            data: {
                shuData: {
                    year: yearNum,
                    status: "calculated",
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
