import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/billing/riwayat — List all billing periods
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const periods = await prisma.billingPeriod.findMany({
      orderBy: { createdAt: "desc" },
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
        _count: { select: { billingItems: true } },
      },
    });

    return NextResponse.json({ data: periods });
  } catch (error) {
    console.error("GET /api/billing/riwayat error:", error);
    return NextResponse.json({ message: "Failed to fetch billing history" }, { status: 500 });
  }
}
