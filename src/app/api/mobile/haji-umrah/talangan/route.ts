import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// GET /api/mobile/haji-umrah/talangan — List talangan loans + stats
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "all";
        const type = searchParams.get("type") || "";
        const search = searchParams.get("search") || "";
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

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

        // Stats
        const statsWhere = { linkedSavingsAccountId: { not: null } };
        const [activeCount, activeLoans, paidLoans, paidThisMonthRows] = await Promise.all([
            prisma.loan.count({ where: { ...statsWhere, status: "active" } }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "active" },
                select: { principalOutstanding: true },
            }),
            prisma.loan.findMany({
                where: { ...statsWhere, status: "paid_off" },
                select: { principalPaid: true },
            }),
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

        const totalOutstanding = activeLoans.reduce((sum, l) => sum + Number(l.principalOutstanding), 0);
        const paidThisMonth = paidThisMonthRows.reduce((sum, p) => sum + Number(p.amount), 0);

        // Gap detected: H&U savings accounts with gap but no active talangan
        const gapAccounts = await prisma.savingsAccount.findMany({
            where: {
                status: "active",
                product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
                targetAmount: { not: null },
            },
            select: {
                id: true,
                balance: true,
                targetAmount: true,
                talanganLoans: { where: { status: "active" }, select: { id: true } },
            },
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
                totalOutstanding,
                paidThisMonth,
                gapDetected,
                totalPaidOff: paidLoans.length,
                totalRecords: total,
            },
            data,
            pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan error:", error);
        return NextResponse.json({ message: "Failed to fetch talangan data" }, { status: 500 });
    }
}
