import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/billing/[periodId]/process — Settle billing period
// Body: { memberIds?: number[] } — if provided, only settle these members. If omitted, settle all.
export async function POST(
  request: Request,
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
    const body = await request.json().catch(() => ({}));
    const selectedMemberIds: number[] | null = body.memberIds?.length ? body.memberIds : null;

    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
      include: { billingItems: true },
    });

    if (!period) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    if (period.status !== "draft") {
      return NextResponse.json({ message: "Period sudah diproses" }, { status: 400 });
    }

    // Filter items by selected members (or all if none specified)
    const itemsToSettle = selectedMemberIds
      ? period.billingItems.filter((item) => selectedMemberIds.includes(item.memberId))
      : period.billingItems;

    const settledAmount = itemsToSettle.reduce((sum, i) => sum + Number(i.amount), 0);
    const settledMembers = new Set(itemsToSettle.map((i) => i.memberId)).size;
    const totalItems = period.billingItems.length;
    const isFullSettle = !selectedMemberIds || itemsToSettle.length === totalItems;

    // Process in transaction: mark paid on source transactions + update items + update period
    await prisma.$transaction(async (tx) => {
      // 1. Update all selected billing items: mark as paid
      await tx.billingItem.updateMany({
        where: {
          billingPeriodId: period.id,
          ...(selectedMemberIds ? { memberId: { in: selectedMemberIds } } : {}),
        },
        data: { isMarkedPaid: true, paidAt: new Date(), paidById: userId },
      });

      // 2. Update source transactions for ALL items being settled
      for (const item of itemsToSettle) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
        }
      }

      // 3. Update period status
      if (isFullSettle) {
        await tx.billingPeriod.update({
          where: { id: period.id },
          data: {
            status: "processed",
            processedById: userId,
            processedAt: new Date(),
            totalMembers: period.billingItems.length,
            totalAmount: settledAmount,
          },
        });
      } else {
        // Partial settle: update totals but keep as draft for remaining items
        const remainingItems = period.billingItems.filter(
          (item) => !selectedMemberIds!.includes(item.memberId)
        );
        await tx.billingPeriod.update({
          where: { id: period.id },
          data: {
            totalMembers: period.billingItems.length,
            totalAmount: settledAmount,
          },
        });
      }
    });

    return NextResponse.json({
      message: isFullSettle
        ? `Period berhasil diproses. ${settledMembers} anggota (${itemsToSettle.length} item) dilunaskan.`
        : `${settledMembers} anggota (${itemsToSettle.length} item) dilunaskan. Period masih draft untuk sisa anggota.`,
      settledMembers,
      settledItems: itemsToSettle.length,
      settledAmount,
      isFullSettle,
    });
  } catch (error) {
    console.error("POST /api/billing/[periodId]/process error:", error);
    return NextResponse.json({ message: "Failed to process period" }, { status: 500 });
  }
}
