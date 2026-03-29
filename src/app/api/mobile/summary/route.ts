import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/summary — Ringkasan lengkap data untuk Dashboard Mobile
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
            include: { member: true, role: true, branch: true },
        });

        if (!user) {
            return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
        }

        const memberId = user.memberId;
        const roleName = user.role.name;
        const isOperator = ["operator", "admin", "superadmin"].includes(roleName);
        const isKasir = roleName === "kasir";

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        if (isKasir) {
            const [todaySales, latestSales] = await Promise.all([
                prisma.storeSale.aggregate({
                    _sum: { totalAmount: true },
                    _count: { id: true },
                    where: { createdAt: { gte: todayStart } },
                }),
                prisma.storeSale.findMany({
                    take: 5,
                    orderBy: { createdAt: "desc" },
                    include: { items: { include: { product: { select: { name: true } } } } },
                }),
            ]);

            return NextResponse.json({
                data: {
                    type: "kasir",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                        branch: user.branch?.name,
                    },
                    today: {
                        salesTotal: Number(todaySales._sum.totalAmount || 0),
                        salesCount: todaySales._count.id,
                    },
                    latestSales: latestSales.map(s => ({
                        id: s.id,
                        saleNo: s.saleNo,
                        totalAmount: Number(s.totalAmount),
                        paymentMethod: s.paymentMethod,
                        timestamp: s.createdAt.toISOString(),
                        itemCount: s.items.length,
                    })),
                },
            });
        }

        // Jika operator/admin, kirim statistik koperasi global + aktivitas hari ini
        if (isOperator || (!memberId && roleName !== "anggota")) {
            const [
                totalMembers, totalSavings, totalLoans, totalArrears, pendingApprovals,
                totalTunkin, membersWithTunkin,
                todayDeposits, todayWithdrawals, todayPayments,
            ] = await Promise.all([
                prisma.member.count({ where: { status: "active", deletedAt: null } }),
                prisma.savingsAccount.aggregate({ _sum: { balance: true }, where: { status: "active" } }),
                prisma.loan.aggregate({ _sum: { principalOutstanding: true }, where: { status: { in: ["active", "overdue"] } } }),
                prisma.loan.aggregate({ _sum: { principalOutstanding: true }, where: { status: "overdue" } }),
                prisma.loanApplication.count({ where: { status: "submitted" } }),
                prisma.member.aggregate({ _sum: { tunlesKinerja: true }, where: { tunlesKinerja: { gt: 0 }, deletedAt: null } }),
                prisma.member.count({ where: { tunlesKinerja: { gt: 0 }, deletedAt: null } }),
                // Today deposits
                prisma.savingsTransaction.aggregate({
                    _sum: { amount: true }, _count: { id: true },
                    where: { type: "deposit", transactionDate: { gte: todayStart } },
                }),
                // Today withdrawals (pencairan pinjaman hari ini)
                prisma.loan.aggregate({
                    _sum: { principalAmount: true }, _count: { id: true },
                    where: { disbursementDate: { gte: todayStart } },
                }),
                // Today loan payments
                prisma.loanPayment.aggregate({
                    _sum: { amount: true }, _count: { id: true },
                    where: { paymentDate: { gte: todayStart } },
                }),
            ]);

            return NextResponse.json({
                data: {
                    type: "operator",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                        branch: user.branch?.name,
                    },
                    stats: {
                        totalMembers,
                        totalSavings: Number(totalSavings._sum.balance || 0),
                        totalLoansOutstanding: Number(totalLoans._sum.principalOutstanding || 0),
                        totalArrears: Number(totalArrears._sum.principalOutstanding || 0),
                        pendingApprovals,
                        totalTunkin: Number(totalTunkin._sum.tunlesKinerja || 0),
                        membersWithTunkin,
                    },
                    today: {
                        deposits: Number(todayDeposits._sum.amount || 0),
                        depositsCount: todayDeposits._count.id,
                        withdrawals: Number(todayWithdrawals._sum.principalAmount || 0),
                        withdrawalsCount: todayWithdrawals._count.id,
                        payments: Number(todayPayments._sum.amount || 0),
                        paymentsCount: todayPayments._count.id,
                    },
                },
            });
        }

        // Jika anggota biasa, kirim data personal
        // Guard: jika user belum terhubung dengan data member
        if (!memberId || !user.member) {
            return NextResponse.json({
                data: {
                    type: "member",
                    user: {
                        id: user.id, name: user.name, email: user.email,
                        role: user.role.name, roleDisplayName: user.role.displayName,
                        branch: user.branch?.name,
                    },
                    member: null,
                    savings: { accounts: [], totalBalance: 0 },
                    loans: { list: [], activeCount: 0, totalOutstanding: 0 },
                    unitCredit: { unpaidTotal: 0, unpaidCount: 0 },
                },
            });
        }

        const [savingsAccounts, loans, unitUnpaid] = await Promise.all([
            prisma.savingsAccount.findMany({
                where: { memberId, status: "active" },
                include: { product: { select: { name: true, type: true } } },
            }),
            prisma.loan.findMany({
                where: { memberId },
                select: {
                    id: true, loanNo: true, principalAmount: true, principalOutstanding: true,
                    interestOutstanding: true, monthlyInstallment: true, status: true, disbursementDate: true,
                },
            }),
            prisma.unitTransaction.aggregate({
                where: { memberId, isPaid: false },
                _sum: { amount: true }, _count: { id: true },
            }),
        ]);

        const totalSavingsBalance = savingsAccounts.reduce((s, a) => s + Number(a.balance), 0);
        const activeLoans = loans.filter((l) => l.status === "active" || l.status === "overdue");
        const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.principalOutstanding), 0);

        // --- Fast Estimated SHU Calculation ---
        const year = new Date().getFullYear();
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

        const [sysTokoMember, sysTokoNonMember, sysUnit, sysLoanInt, sysSavings, sysTajib, sysSimpananPokok, mySavings, myToko, myUnit, myLoan] = await Promise.all([
            prisma.storeSale.aggregate({ where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null } }, _sum: { totalAmount: true } }),
            prisma.storeSale.aggregate({ where: { createdAt: { gte: startDate, lte: endDate }, memberId: null }, _sum: { totalAmount: true } }),
            prisma.unitTransaction.aggregate({ where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true }, _sum: { amount: true } }),
            prisma.loanPayment.aggregate({ where: { paymentDate: { gte: startDate, lte: endDate } }, _sum: { interestPortion: true } }),
            prisma.savingsTransaction.aggregate({ where: { type: "in", transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            // System total Tabungan Wajib & Simpanan Pokok (all active members)
            prisma.member.aggregate({ where: { status: "active", deletedAt: null }, _sum: { tabunganWajib: true } }),
            prisma.savingsAccount.aggregate({ where: { status: "active", product: { type: "pokok" } }, _sum: { balance: true } }),
            
            prisma.savingsTransaction.aggregate({ where: { account: { memberId }, type: "in", transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            prisma.storeSale.aggregate({ where: { memberId, createdAt: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } }),
            prisma.unitTransaction.aggregate({ where: { memberId, transactionDate: { gte: startDate, lte: endDate } }, _sum: { amount: true } }),
            prisma.loan.aggregate({ where: { memberId, disbursementDate: { gte: startDate, lte: endDate } }, _sum: { totalAmount: true } })
        ]);

        const memberIncome = Number(sysTokoMember._sum.totalAmount || 0) + Number(sysUnit._sum.amount || 0) + Number(sysLoanInt._sum.interestPortion || 0);
        const nonMemberIncome = Number(sysTokoNonMember._sum.totalAmount || 0);
        const totalIncome = memberIncome + nonMemberIncome;

        const totalExpense = totalIncome * 0.4;
        const memberExpense = totalIncome > 0 ? (memberIncome / totalIncome) * totalExpense : 0;
        const memberSurplus = memberIncome - memberExpense;

        const jasaModalPool = memberSurplus * 0.20; // 20% from Member Surplus
        const jasaUsahaPool = memberSurplus * 0.25; // 25% from Member Surplus

        // System Denominators — include Tajib + Simpanan Pokok
        const totalSysSav = Number(sysSavings._sum.amount || 0) + Number(sysTajib._sum.tabunganWajib || 0) + Number(sysSimpananPokok._sum.balance || 0) || 1;

        // Member Numerators — include my Tajib + Simpanan Pokok
        const myTabWajib = Number(user.member.tabunganWajib || 0);
        const mySimpananPokokVal = savingsAccounts.filter(a => a.product.type === 'pokok').reduce((s, a) => s + Number(a.balance), 0);
        const mySavCont = Number(mySavings._sum.amount || 0) + myTabWajib + mySimpananPokokVal;
        
        // 1. Calculate Jasa Modal (Proportional Pool)
        const myModal = (mySavCont / totalSysSav) * jasaModalPool;

        // 2. Calculate Jasa Usaha (Exact Margin Cashback Method)
        const memberSales = await prisma.storeSaleItem.findMany({
            where: { sale: { memberId, createdAt: { gte: startDate, lte: endDate } } },
            include: { product: { select: { costPrice: true } } }
        });
        const myTokoMargin = memberSales.reduce((sum, item) => {
            const cost = Number(item.product.costPrice || 0);
            const sell = Number(item.unitPrice || 0);
            return sum + ((sell - cost) * item.quantity);
        }, 0);

        const myUnitMargin = Number(myUnit._sum.amount || 0) * 0.8; // Assess 80% margin on unit services
        
        const myLoanInterestAgg = await prisma.loanPayment.aggregate({
            where: { memberId, paymentDate: { gte: startDate, lte: endDate } },
            _sum: { interestPortion: true }
        });
        const myLoanMargin = Number(myLoanInterestAgg._sum.interestPortion || 0);

        const myTotalMargin = myTokoMargin + myUnitMargin + myLoanMargin;
        const myUsaha = myTotalMargin * 0.25; // 25% of member's explicit transaction margin

        const estimatedSHU = Math.round(myModal + myUsaha);

        return NextResponse.json({
            data: {
                type: "member",
                user: {
                    id: user.id, name: user.name, email: user.email,
                    role: user.role.name, roleDisplayName: user.role.displayName,
                    nrp: user.member.nrp, branch: user.branch?.name,
                },
                member: {
                    id: user.member.id, memberNo: user.member.memberNo,
                    name: user.member.name, salary: Number(user.member.salary || 0),
                    tunlesKinerja: Number(user.member.tunlesKinerja || 0),
                    tabunganWajib: Number(user.member.tabunganWajib || 0),
                },
                savings: {
                    accounts: savingsAccounts.map((a) => ({
                        id: a.id, accountNo: a.accountNo, balance: Number(a.balance), product: a.product,
                    })),
                    totalBalance: totalSavingsBalance,
                },
                loans: {
                    list: loans.map((l) => ({
                        ...l, principalAmount: Number(l.principalAmount), principalOutstanding: Number(l.principalOutstanding),
                        interestOutstanding: Number(l.interestOutstanding), monthlyInstallment: Number(l.monthlyInstallment),
                    })),
                    activeCount: activeLoans.length,
                    totalOutstanding,
                },
                unitCredit: {
                    unpaidTotal: Number(unitUnpaid._sum.amount || 0),
                    unpaidCount: unitUnpaid._count.id,
                },
                estimatedSHU,
            },
        });
    } catch (error: any) {
        console.error("GET /api/mobile/summary error:", error?.message || error);
        return NextResponse.json({ message: "Gagal memuat data", error: error?.message }, { status: 500 });
    }
}
