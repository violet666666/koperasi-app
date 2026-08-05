import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";

// GET /api/mobile/billing/current — Get current/latest billing period
export async function GET(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json(
        { message: "Hanya Operator/Admin SP yang dapat mengakses Tagihan" },
        { status: 403 }
      );
    }

    const period = await prisma.billingPeriod.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { billingItems: true } },
        processedBy: { select: { name: true } },
      },
    });

    if (!period) {
      return NextResponse.json({ data: null, meta: { daysRemaining: 0, nextBillingDate: "" } });
    }

    const daysRemaining = Math.max(
      0,
      Math.ceil(
        (new Date(period.periodEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    const nextBillingDate = new Date(
      new Date(period.periodEnd).getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    const markedCount = period.billingItems.filter((i) => i.isMarkedPaid).length;
    const unpaidCount = period.billingItems.filter((i) => !i.isMarkedPaid).length;

    return NextResponse.json({
      data: {
        id: period.id,
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        periodLabel: period.periodLabel,
        status: period.status,
        totalMembers: period.totalMembers,
        totalAmount: Number(period.totalAmount),
        processedBy: period.processedBy ? { name: period.processedBy.name } : null,
        processedAt: period.processedAt?.toISOString() ?? null,
      },
      meta: { daysRemaining, nextBillingDate },
    });
  } catch (error) {
    console.error("GET /api/mobile/billing/current error:", error);
    return NextResponse.json({ message: "Gagal mengambil data tagihan" }, { status: 500 });
  }
}
