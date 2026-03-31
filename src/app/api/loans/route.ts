import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paginationSchema } from "@/lib/validations";

// GET /api/loans - List active loans
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
        });

        const memberId = searchParams.get("memberId");
        const branchId = searchParams.get("branchId");
        const status = searchParams.get("status");

        const where = {
            ...(memberId && { memberId: parseInt(memberId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(status && { status }),
        };

        const [loans, total, activeStats, paidOffCount] = await Promise.all([
            prisma.loan.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    branch: { select: { id: true, name: true } },
                    _count: { select: { schedules: { where: { status: { in: ["paid"] } } } } },
                },
                orderBy: { createdAt: "desc" },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.loan.count({ where }),
            prisma.loan.aggregate({
                _sum: { principalOutstanding: true, interestOutstanding: true },
                _count: { _all: true },
                where: { ...where, status: "active" }
            }),
            prisma.loan.count({ where: { ...where, status: "paid_off" } })
        ]);

        return NextResponse.json({
            data: loans,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
                stats: {
                    totalOutstanding: Number(activeStats._sum.principalOutstanding || 0) + Number(activeStats._sum.interestOutstanding || 0),
                    activeCount: activeStats._count._all || 0,
                    paidOffCount: paidOffCount || 0
                }
            },
        });
    } catch (error) {
        console.error("GET /api/loans error:", error);
        return NextResponse.json(
            { message: "Failed to fetch loans" },
            { status: 500 }
        );
    }
}
