import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/haji-umrah/talangan — List talangan loans + stats
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "all"; // active, paid_off, all
        const type = searchParams.get("type") || ""; // talangan_haji, talangan_umrah
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        // Build where clause — filter loans that are linked to H&U savings accounts
        const whereClause: Record<string, unknown> = {
            linkedSavingsAccountId: { not: null },
        };

        if (status !== "all") {
            whereClause.status = status;
        }

        if (search) {
            whereClause.member = {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { nrp: { contains: search, mode: "insensitive" } },
                ],
            };
        }

        // Type filter via productSnapshot JSON field
        if (type) {
            whereClause.productSnapshot = { path: ["type"], equals: type };
        }

        const [loans, total] = await Promise.all([
            prisma.loan.findMany({
                where: whereClause,
                include: {
                    member: { select: { id: true, name: true, nrp: true } },
                    application: {
                        select: {
                            applicationNo: true,
                            status: true,
                            product: { select: { code: true, name: true, type: true } },
                        },
                    },
                    linkedSavingsAccount: {
                        select: {
                            accountNo: true,
                            balance: true,
                            targetAmount: true,
                            product: { select: { name: true, type: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.loan.count({ where: whereClause }),
        ]);

        // Compute stats
        const statsWhere = { linkedSavingsAccountId: { not: null } };
        const [activeCount, activeLoans, paidLoans, totalOutstanding] = await Promise.all([
            prisma.loan.count({ where: { ...statsWhere, status: "active" } }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "active" },
                select: { principalOutstanding: true },
            }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "paid_off" },
                select: { principalPaid: true },
            }),
            // Total paid this month
            prisma.loanPayment.findMany({
                where: {
                    loan: { linkedSavingsAccountId: { not: null } },
                    status: "completed",
                    createdAt: {
                        gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                    },
                },
                select: { amount: true },
            }),
        ]);

        const outstanding = activeLoans.reduce((sum, l) => sum + Number(l.principalOutstanding), 0);
        const paidThisMonth = totalOutstanding.reduce((sum, p) => sum + Number(p.amount), 0);

        // Count gap-detected accounts
        const gapAccounts = await prisma.savingsAccount.findMany({
            where: {
                status: "active",
                product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
                targetAmount: { not: null },
            },
            select: { id: true, balance: true, targetAmount: true, talanganLoans: { where: { status: "active" }, select: { id: true } } },
        });
        const gapDetected = gapAccounts.filter(
            (a) => Number(a.targetAmount) > Number(a.balance) && a.talanganLoans.length === 0
        ).length;

        const data = loans.map((loan) => ({
            loanId: loan.id,
            loanNo: loan.loanNo,
            memberId: loan.memberId,
            memberName: loan.member.name,
            memberNrp: loan.member.nrp,
            productType: (loan.application?.product?.type as string) || null,
            productName: loan.application?.product?.name || null,
            principalAmount: Number(loan.principalAmount),
            interestAmount: Number(loan.interestAmount),
            totalAmount: Number(loan.totalAmount),
            outstanding: Number(loan.principalOutstanding),
            status: loan.status,
            tenorMonths: loan.tenorMonths,
            monthlyInstallment: Number(loan.monthlyInstallment),
            disbursementDate: loan.disbursementDate,
            savingsAccountNo: loan.linkedSavingsAccount?.accountNo || null,
            savingsBalance: loan.linkedSavingsAccount ? Number(loan.linkedSavingsAccount.balance) : null,
            savingsTarget: loan.linkedSavingsAccount ? Number(loan.linkedSavingsAccount.targetAmount) : null,
            applicationStatus: loan.application?.status || null,
        }));

        return NextResponse.json({
            stats: {
                totalActive: activeCount,
                totalOutstanding: outstanding,
                paidThisMonth,
                gapDetected,
                totalPaidOff: paidLoans.length,
                totalRecords: total,
            },
            data,
            pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/talangan error:", error);
        return NextResponse.json({ message: "Failed to fetch talangan data" }, { status: 500 });
    }
}
