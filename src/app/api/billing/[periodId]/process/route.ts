import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/billing/[periodId]/process — Settle billing period
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
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

    const { periodId } = await params;
    const userId = Number(session.user.id);

    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
      include: { billingItems: true },
    });

    if (!period) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    if (period.status !== "draft") {
      return NextResponse.json({ message: "Period already processed" }, { status: 400 });
    }

    const markedItems = period.billingItems.filter((item) => item.isMarkedPaid);

    // Process in transaction: mark paid on source transactions + update period
    await prisma.$transaction(async (tx) => {
      for (const item of markedItems) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
        }
        // StoreSale doesn't have isPaid field — skip for now
        // (salary_cut StoreSales are tracked via metadata)
      }

      await tx.billingPeriod.update({
        where: { id: period.id },
        data: {
          status: "processed",
          processedById: userId,
          processedAt: new Date(),
          totalMembers: period.billingItems.length,
          totalAmount: markedItems.reduce((sum, i) => sum + Number(i.amount), 0),
        },
      });
    });

    return NextResponse.json({ message: "Period processed successfully" });
  } catch (error) {
    console.error("POST /api/billing/[periodId]/process error:", error);
    return NextResponse.json({ message: "Failed to process period" }, { status: 500 });
  }
}
