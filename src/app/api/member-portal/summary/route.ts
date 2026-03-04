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
                principalOutstanding: true,
                interestOutstanding: true,
                monthlyInstallment: true,
                status: true,
                disbursementDate: true,
                lastDueDate: true,
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

        return NextResponse.json({
            data: {
                member: {
                    id: member.id,
                    memberNo: member.memberNo,
                    nrp: member.nrp,
                    name: member.name,
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
                        principalOutstanding: Number(l.principalOutstanding),
                        interestOutstanding: Number(l.interestOutstanding),
                        monthlyInstallment: Number(l.monthlyInstallment),
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
