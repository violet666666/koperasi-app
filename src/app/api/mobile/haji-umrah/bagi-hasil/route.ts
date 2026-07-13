import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// GET /api/mobile/haji-umrah/bagi-hasil — List distributions + summary (READ-ONLY)
// Mirror of web GET /api/haji-umrah/bagi-hasil with mobile auth.
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "20");

        const where = status ? { status } : {};
        const [distributions, total] = await Promise.all([
            prisma.bagiHasilDistribution.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
                include: { _count: { select: { items: true } } },
            }),
            prisma.bagiHasilDistribution.count({ where }),
        ]);

        return NextResponse.json({
            data: distributions.map((d) => ({
                id: d.id,
                distributionNo: d.distributionNo,
                periodLabel: d.periodLabel,
                periodStart: d.periodStart,
                periodEnd: d.periodEnd,
                totalBsiAmount: Number(d.totalBsiAmount),
                memberRate: Number(d.memberRate),
                memberPoolAmount: Number(d.memberPoolAmount),
                spreadAmount: Number(d.spreadAmount),
                totalBalanceSnapshot: Number(d.totalBalanceSnapshot),
                memberCount: d.memberCount,
                status: d.status,
                processedAt: d.processedAt,
                voidedAt: d.voidedAt,
                itemCount: d._count.items,
                createdAt: d.createdAt,
            })),
            meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/bagi-hasil error:", error);
        return NextResponse.json({ message: "Gagal mengambil data bagi hasil" }, { status: 500 });
    }
}
