import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/member-portal/summary - Get member's complete summary
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = session.user.memberId;

        // Get member info
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: {
                branch: true,
            },
        });

        if (!member) {
            return NextResponse.json({ message: "Member not found" }, { status: 404 });
        }

        // Get savings accounts with balances
        const savingsAccounts = await prisma.savingsAccount.findMany({
            where: { memberId, status: "active" },
            include: {
                product: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                    },
                },
            },
        });

        const totalSavings = savingsAccounts.reduce(
            (sum, acc) => sum + Number(acc.balance),
            0
        );

        // Get active loans
        const loans = await prisma.loan.findMany({
            where: { memberId },
            select: {
                id: true,
                loanNo: true,
                principalAmount: true,
                principalPaid: true,
                interestPaid: true,
                principalOutstanding: true,
                interestOutstanding: true,
                monthlyInstallment: true,
                tenorMonths: true,
                status: true,
                disbursementDate: true,
                firstDueDate: true,
                lastDueDate: true,
                paidOffDate: true,
            },
        });

        const activeLoans = loans.filter((l) => l.status === "active");
        const totalOutstanding = activeLoans.reduce(
            (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding),
            0
        );

        // Get unit transactions summary
        const unitTransactions = await prisma.unitTransaction.findMany({
            where: { memberId },
            orderBy: { transactionDate: "desc" },
            take: 10,
        });

        const unitStats = await prisma.unitTransaction.groupBy({
            by: ["unitType"],
            where: { memberId },
            _sum: { amount: true },
            _count: { id: true },
        });

        const unpaidUnitTotal = await prisma.unitTransaction.aggregate({
            where: { memberId, isPaid: false },
            _sum: { amount: true },
            _count: { id: true },
        });

        // --- Real-time SHU Estimation ---
        const year = new Date().getFullYear();
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        const [sysTokoMember, sysTokoNonMember, sysUnit, sysLoanInt, myToko, myUnit, myLoan] = await Promise.all([
            // System-wide aggregates
            prisma.storeSale.aggregate({ where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null } }, _sum: { totalAmount: true } }),
            prisma.storeSale.aggregate({ where: { createdAt: { gte: startDate, lte: endDate }, memberId: null }, _sum: { totalAmount: true } }),
            prisma.unitTransaction.aggregate({ where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true }, _sum: { amount: true } }),
            prisma.loanPayment.aggregate({ where: { paymentDate: { gte: startDate, lte: endDate } }, _sum: { interestPortion: true } }),
            // My contributions
            prisma.storeSale.aggregate({ where: { memberId, createdAt: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } }),
            prisma.unitTransaction.aggregate({ where: { memberId, transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            prisma.loan.aggregate({ where: { memberId, disbursementDate: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } }),
        ]);

        // Income calculation
        const memberIncome = Number(sysTokoMember._sum.totalAmount || 0) + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
        const nonMemberIncome = Number(sysTokoNonMember._sum.totalAmount || 0);
        const totalIncome = memberIncome + nonMemberIncome;
        const totalExpense = totalIncome * 0.4; // Estimated 40% operating expenses
        const totalNetSurplus = totalIncome - totalExpense; // Total koperasi surplus

        // --- Calculate System-Wide Savings Capital ---
        // To prevent double counting between legacy `tabunganWajib` and new `savingsAccounts`
        const allRelevantMembers = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: { id: true, tabunganWajib: true, savingsAccounts: { select: { balance: true, product: { select: { type: true } } } } }
        });
        
        let totalSysSavings = 0;
        let mySavCont = 0;

        for (const m of allRelevantMembers) {
            let mSav = 0;
            let hasImportedWajib = false;
            for (const acc of m.savingsAccounts) {
                mSav += Number(acc.balance);
                if (acc.product.type === "wajib" && Number(acc.balance) > 0) hasImportedWajib = true;
            }
            if (!hasImportedWajib) mSav += Number(m.tabunganWajib || 0); // Legacy fallback
            
            totalSysSavings += mSav;
            if (m.id === memberId) mySavCont = mSav;
        }

        totalSysSavings = totalSysSavings || 1;
        const totalSavingsCapital = totalSysSavings;

        // --- Jasa Simpanan Pool (20%) ---
        // Based on TOTAL koperasi surplus, with a MINIMUM FLOOR based on estimated
        // 6% annual return on deployed savings capital (member savings fund ALL koperasi ops).
        // This ensures members with savings always see non-zero SHU even before store/unit income.
        const surplusBasedPool = totalNetSurplus * 0.20;
        const minSavingsReturnPool = (totalSavingsCapital * 0.06) * 0.20; // 6% return × 20% Jasa Simpanan
        const jasaModalPool = Math.max(surplusBasedPool, minSavingsReturnPool);

        // --- Jasa Anggota Pool (25%) ---
        // Based on member transaction surplus only (exact margin method).
        const memberExpense = totalIncome > 0 ? (memberIncome / totalIncome) * totalExpense : 0;
        const memberSurplus = memberIncome - memberExpense;

        // 1. Calculate Jasa Modal (Proportional Pool)
        const myModal = (mySavCont / totalSysSavings) * jasaModalPool;

        // 2. Calculate Jasa Usaha (Exact Margin Cashback Method)
        const memberSales = await prisma.storeSaleItem.findMany({
            where: { sale: { memberId, createdAt: { gte: startDate, lte: endDate } } },
            include: { product: { select: { costPrice: true } } }
        });
        const myTokoMargin = memberSales.reduce((sum: number, item: any) => {
            const cost = Number(item.product.costPrice || 0);
            const sell = Number(item.unitPrice || 0);
            return sum + ((sell - cost) * item.quantity);
        }, 0);

        const myUnitMargin = myUnit && myUnit._sum ? Number(myUnit._sum.amount || 0) * 0.8 : 0; // Assess 80% margin on unit services
        
        const myLoanInterestAgg = await prisma.loanPayment.aggregate({
            where: { memberId, paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });
        const myLoanMargin = Number(myLoanInterestAgg._sum.interestPortion || 0);

        const myTotalMargin = myTokoMargin + myUnitMargin + myLoanMargin;
        const myUsaha = myTotalMargin * 0.25; // 25% of member's explicit transaction margin

        // --- SHU Cuci Mobil: Rp 2.000 fix per transaksi anggota ---
        const CARWASH_BONUS_PER_TX = 2000;
        const myCarwashTxCount = await prisma.unitTransaction.count({
            where: {
                memberId,
                unitType: "cuci_mobil",
                status: "completed",
                transactionDate: { gte: startDate, lte: endDate },
            }
        });
        const myCarwashBonus = myCarwashTxCount * CARWASH_BONUS_PER_TX;

        const estimatedSHUTotal = Math.round(myModal + myUsaha + myCarwashBonus);
        const jasaModalPercent = totalSysSavings > 0 ? (mySavCont / totalSysSavings) * 100 : 0;
        const jasaUsahaPercent = totalIncome > 0 ? (myTotalMargin / totalIncome) * 100 : 0;

        return NextResponse.json({
            data: {
                member: {
                    id: member.id,
                    memberNo: member.memberNo,
                    nrp: member.nrp,
                    name: member.name,
                    category: member.category,
                    salary: member.salary ? Number(member.salary) : null,
                    tunlesKinerja: member.tunlesKinerja ? Number(member.tunlesKinerja) : null,
                    tabunganWajib: member.tabunganWajib ? Number(member.tabunganWajib) : null,
                    phone: member.phone,
                    email: member.email,
                    address: member.address,
                    joinDate: member.joinDate,
                    status: member.status,
                    branch: member.branch,
                },
                savings: {
                    accounts: savingsAccounts.map((acc) => ({
                        id: acc.id,
                        accountNo: acc.accountNo,
                        product: acc.product,
                        balance: Number(acc.balance),
                        status: acc.status,
                    })),
                    totalBalance: totalSavings,
                },
                loans: {
                    list: loans.map((l) => ({
                        ...l,
                        principalAmount: Number(l.principalAmount),
                        principalPaid: Number(l.principalPaid),
                        interestPaid: Number(l.interestPaid),
                        principalOutstanding: Number(l.principalOutstanding),
                        interestOutstanding: Number(l.interestOutstanding),
                        monthlyInstallment: Number(l.monthlyInstallment),
                        tenorMonths: l.tenorMonths,
                    })),
                    activeCount: activeLoans.length,
                    totalOutstanding,
                },
                unitTransactions: {
                    recent: unitTransactions.map((t) => ({
                        ...t,
                        amount: Number(t.amount),
                    })),
                    byUnit: unitStats.map((s) => ({
                        unitType: s.unitType,
                        totalAmount: Number(s._sum.amount || 0),
                        count: s._count.id,
                    })),
                    unpaidTotal: Number(unpaidUnitTotal._sum.amount || 0),
                    unpaidCount: unpaidUnitTotal._count.id,
                },
                estimatedSHU: {
                    total: estimatedSHUTotal,
                    jasaModal: Math.round(myModal),
                    jasaUsaha: Math.round(myUsaha),
                    carwashBonus: myCarwashBonus,
                    carwashCount: myCarwashTxCount,
                    jasaModalPercent,
                    jasaUsahaPercent,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/member-portal/summary error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member summary" },
            { status: 500 }
        );
    }
}
