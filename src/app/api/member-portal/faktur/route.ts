import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/member-portal/faktur — List billing periods with items for logged-in member
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !session.user.memberId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const memberId = session.user.memberId;

    // Find all billing items belonging to this member, grouped by period
    const periods = await prisma.billingPeriod.findMany({
      where: {
        billingItems: {
          some: { memberId },
        },
      },
      include: {
        billingItems: {
          where: { memberId },
          orderBy: [{ unitType: "asc" }],
        },
        processedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = periods.map((p) => ({
      id: p.id,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      periodLabel: p.periodLabel,
      status: p.status,
      processedAt: p.processedAt,
      processedByName: p.processedBy?.name ?? null,
      items: p.billingItems.map((item) => ({
        id: item.id,
        unitType: item.unitType,
        description: item.description,
        amount: Number(item.amount),
        isMarkedPaid: item.isMarkedPaid,
        paidAt: item.paidAt,
      })),
      totalAmount: p.billingItems.reduce((sum, i) => sum + Number(i.amount), 0),
      itemCount: p.billingItems.length,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/member-portal/faktur error:", error);
    return NextResponse.json({ message: "Failed to fetch faktur" }, { status: 500 });
  }
}
