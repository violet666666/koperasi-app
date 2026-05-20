import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/billing/current — Get current or latest billing period
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

    const period = await prisma.billingPeriod.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        billingItems: {
          orderBy: [{ memberId: "asc" }, { unitType: "asc" }],
        },
        processedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ data: period });
  } catch (error) {
    console.error("GET /api/billing/current error:", error);
    return NextResponse.json({ message: "Failed to fetch billing period" }, { status: 500 });
  }
}
