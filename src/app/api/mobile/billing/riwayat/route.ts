import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";

// GET /api/mobile/billing/riwayat — Paginated billing periods list
export async function GET(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json(
        { message: "Hanya Operator/Admin SP yang dapat mengakses Tagihan" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "10")));

    const where = {};

    const [periods, total] = await Promise.all([
      prisma.billingPeriod.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          periodLabel: true,
          status: true,
          totalMembers: true,
          totalAmount: true,
          processedAt: true,
          createdAt: true,
          processedBy: { select: { name: true } },
        },
      }),
      prisma.billingPeriod.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const data = periods.map((p) => ({
      id: p.id,
      periodLabel: p.periodLabel,
      status: p.status,
      totalMembers: p.totalMembers,
      totalAmount: Number(p.totalAmount),
      processedAt: p.processedAt?.toISOString() ?? null,
      processedBy: p.processedBy ? { name: p.processedBy.name } : null,
    }));

    return NextResponse.json({
      data,
      meta: { page, perPage, total, totalPages },
    });
  } catch (error) {
    console.error("GET /api/mobile/billing/riwayat error:", error);
    return NextResponse.json({ message: "Gagal mengambil riwayat tagihan" }, { status: 500 });
  }
}
