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
        // 1. Toko Sales Income
        const allTokoSales = await prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate } },
            _sum: { totalAmount: true }
        });
        
        // 2. Unit Transactions Income
        const allUnitTx = await prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true },
            _sum: { amount: true }
        });

        // 3. Loan Interest Income
        const allLoanInterest = await prisma.loanPayment.aggregate({
            where: { paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });

        const totalIncome = Number(allTokoSales._sum.totalAmount || 0) + 
                            Number(allUnitTx._sum.amount || 0) + 
                            Number(allLoanInterest._sum.interestPortion || 0);

        const totalExpense = totalIncome * 0.4; // Assuming 40% expenses
        const netSurplus = totalIncome - totalExpense;

        // AD-ART Allocation
        const reserveFund = netSurplus * 0.20;
        const developmentFund = netSurplus * 0.25;
        const employeeBonus = netSurplus * 0.10;
        const educationFund = netSurplus * 0.05;
        const memberDividend = netSurplus * 0.40; // 40% untuk Jasa Anggota

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
            if (savingsContribution === 0) savingsContribution = 100000; 

            // Transaction contribution (Store + Unit + Loans)
            let loanContribution = 0;
            m.loans.forEach(l => { loanContribution += Number(l.totalAmount); });
            m.storeSales.forEach(s => { loanContribution += Number(s.totalAmount); });
            m.unitTransactions.forEach(u => { loanContribution += Number(u.amount); });
            if (loanContribution === 0) loanContribution = 50000; // small base

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

        // Calculate 50% Jasa Modal / 50% Jasa Usaha from Member Dividend
        const jasaModalPool = memberDividend * 0.50;
        const jasaUsahaPool = memberDividend * 0.50;

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
                    reserveFund,
                    educationFund,
                    employeeBonus,
                    memberDividend,
                    developmentFund,
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
