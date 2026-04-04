import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/dashboard-stats - Get aggregated dashboard statistics
export async function GET() {
    try {
        // Get current date for "today" calculations
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Execute all queries in parallel for performance
        const [
            totalActiveMembers,
            totalMembers,
            savingsStats,
            loansStats,
            todayTransactions,
            pendingApprovals,
            todayStoreSales,
        ] = await Promise.all([
            // Total active members
            prisma.member.count({
                where: { status: "active", deletedAt: null },
            }),

            // Total members (all statuses)
            prisma.member.count({
                where: { deletedAt: null },
            }),

            // Savings aggregation
            prisma.savingsAccount.aggregate({
                _sum: { balance: true },
                where: { status: "active" },
            }),

            // Loans aggregation
            prisma.loan.aggregate({
                _sum: { principalOutstanding: true },
                _count: { _all: true },
                where: { status: { in: ["active", "overdue"] } },
            }),

            // Today's savings transactions
            prisma.savingsTransaction.aggregate({
                _sum: { amount: true },
                _count: { _all: true },
                where: {
                    transactionDate: {
                        gte: today,
                        lt: tomorrow,
                    },
                },
            }),

            // Pending approvals count
            prisma.loanApplication.count({
                where: { status: "submitted" },
            }),

            // Today's store sales
            prisma.storeSale.aggregate({
                _sum: { totalAmount: true },
                _count: { _all: true },
                where: {
                    createdAt: { gte: today, lt: tomorrow },
                },
            }),
        ]);

        // Get counts by transaction type for today
        const [todayDeposits, todayWithdrawals] = await Promise.all([
            prisma.savingsTransaction.aggregate({
                _sum: { amount: true },
                _count: { _all: true },
                where: {
                    type: "deposit",
                    transactionDate: { gte: today, lt: tomorrow },
                },
            }),
            prisma.savingsTransaction.aggregate({
                _sum: { amount: true },
                _count: { _all: true },
                where: {
                    type: "withdrawal",
                    transactionDate: { gte: today, lt: tomorrow },
                },
            }),
        ]);

        // Calculate arrears (loans with overdue status)
        const arrearsStats = await prisma.loan.aggregate({
            _sum: { principalOutstanding: true },
            where: { status: "overdue" },
        });

        // Get today's loan payments
        const todayPayments = await prisma.loanPayment.aggregate({
            _sum: { amount: true },
            _count: { _all: true },
            where: {
                paymentDate: { gte: today, lt: tomorrow },
            },
        });

        // Total Tunjangan Kinerja (Tunkin)
        const tunkinStats = await prisma.member.aggregate({
            _sum: { tunlesKinerja: true },
            _count: { tunlesKinerja: true },
            where: { status: "active", deletedAt: null, tunlesKinerja: { not: null } },
        });

        // Total Tabungan Wajib from Member table (imported data)
        const tabunganWajibStats = await prisma.member.aggregate({
            _sum: { tabunganWajib: true },
            _count: { tabunganWajib: true },
            where: { status: "active", deletedAt: null, tabunganWajib: { not: null, gt: 0 } },
        });

        const savingsAccountBalance = Number(savingsStats._sum.balance) || 0;
        const totalTabunganWajib = Number(tabunganWajibStats._sum.tabunganWajib) || 0;

        const stats = {
            // Member stats
            totalMembers: totalMembers,
            activeMembers: totalActiveMembers,

            // Financial stats — combine SavingsAccount balances + tabunganWajib from Member
            totalSavings: savingsAccountBalance + totalTabunganWajib,
            totalTabunganWajib: totalTabunganWajib,
            totalSavingsAccount: savingsAccountBalance,
            membersWithTabunganWajib: tabunganWajibStats._count.tabunganWajib || 0,
            totalLoansOutstanding: Number(loansStats._sum.principalOutstanding) || 0,
            activeLoansCount: loansStats._count._all || 0,
            totalArrears: Number(arrearsStats._sum.principalOutstanding) || 0,

            // Today's activity
            todayDeposits: Number(todayDeposits._sum.amount) || 0,
            todayDepositsCount: todayDeposits._count._all || 0,
            todayWithdrawals: Number(todayWithdrawals._sum.amount) || 0,
            todayWithdrawalsCount: todayWithdrawals._count._all || 0,
            todayPayments: Number(todayPayments._sum.amount) || 0,
            todayPaymentsCount: todayPayments._count._all || 0,
            todayTransactionsCount: todayTransactions._count._all || 0,

            // Store sales today
            todayStoreSales: Number(todayStoreSales._sum.totalAmount) || 0,
            todayStoreSalesCount: Number(todayStoreSales._count) || 0,

            // Pending approvals
            pendingApprovals: pendingApprovals,

            // Tunkin stats
            totalTunkin: Number(tunkinStats._sum.tunlesKinerja) || 0,
            membersWithTunkin: tunkinStats._count.tunlesKinerja || 0,
        };

        return NextResponse.json({ data: stats });
    } catch (error) {
        console.error("GET /api/dashboard-stats error:", error);
        return NextResponse.json(
            { message: "Failed to fetch dashboard stats" },
            { status: 500 }
        );
    }
}
