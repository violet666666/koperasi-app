import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/billing/[periodId]/items/[itemId]/toggle — Toggle isMarkedPaid
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ periodId: string; itemId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { periodId, itemId } = await params;

    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
    });

    if (!period || period.status !== "draft") {
      return NextResponse.json({ message: "Cannot modify processed period" }, { status: 400 });
    }

    const item = await prisma.billingItem.findUnique({
      where: { id: parseInt(itemId) },
    });

    if (!item || item.billingPeriodId !== parseInt(periodId)) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    const updated = await prisma.billingItem.update({
      where: { id: item.id },
      data: {
        isMarkedPaid: !item.isMarkedPaid,
        paidById: !item.isMarkedPaid ? Number(session.user.id) : null,
        paidAt: !item.isMarkedPaid ? new Date() : null,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/billing/[periodId]/items/[itemId]/toggle error:", error);
    return NextResponse.json({ message: "Failed to toggle item" }, { status: 500 });
  }
}
