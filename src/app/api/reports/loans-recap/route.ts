import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/loans-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");

        const where = {
            ...(branchId && { branchId: parseInt(branchId) }),
        };

        // Get loan summary by status
        const loansByStatus = await prisma.loan.groupBy({
            by: ["status"],
            where,
            _count: { id: true },
            _sum: {
                principalAmount: true,
                principalOutstanding: true,
                principalPaid: true,
            },
        });

        // Get applications summary
        const applicationsByStatus = await prisma.loanApplication.groupBy({
            by: ["status"],
            where,
            _count: { id: true },
            _sum: { amount: true },
        });

        const activeLoans = loansByStatus.find((l) => l.status === "active");
        const paidOffLoans = loansByStatus.find((l) => l.status === "paid_off");
        const overdueLoans = loansByStatus.find((l) => l.status === "overdue");

        const pendingApps = applicationsByStatus.find((a) => a.status === "submitted");
        const approvedApps = applicationsByStatus.find((a) => a.status === "approved");

        const recap = {
            branchId: branchId ? parseInt(branchId) : null,
            activeLoans: {
                count: activeLoans?._count.id || 0,
                principalAmount: Number(activeLoans?._sum.principalAmount || 0),
                outstandingAmount: Number(activeLoans?._sum.principalOutstanding || 0),
                paidAmount: Number(activeLoans?._sum.principalPaid || 0),
            },
            paidOffLoans: {
                count: paidOffLoans?._count.id || 0,
                principalAmount: Number(paidOffLoans?._sum.principalAmount || 0),
            },
            overdueLoans: {
                count: overdueLoans?._count.id || 0,
                outstandingAmount: Number(overdueLoans?._sum.principalOutstanding || 0),
            },
            applications: {
                pending: {
                    count: pendingApps?._count.id || 0,
                    amount: Number(pendingApps?._sum.amount || 0),
                },
                approved: {
                    count: approvedApps?._count.id || 0,
                    amount: Number(approvedApps?._sum.amount || 0),
                },
            },
            collectibilityRate: activeLoans ?
                ((Number(activeLoans._sum.principalPaid || 0) / Number(activeLoans._sum.principalAmount || 1)) * 100).toFixed(2) + "%" :
                "N/A",
        };

        return NextResponse.json({ data: recap });
    } catch (error) {
        console.error("GET /api/reports/loans-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate loans recap" },
            { status: 500 }
        );
    }
}
