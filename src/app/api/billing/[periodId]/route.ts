import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/billing/[periodId] — Get billing period detail
export async function GET(
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
    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
      include: {
        billingItems: { orderBy: [{ memberId: "asc" }, { unitType: "asc" }] },
        processedBy: { select: { name: true } },
      },
    });

    if (!period) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    return NextResponse.json({ data: period });
  } catch (error) {
    console.error("GET /api/billing/[periodId] error:", error);
    return NextResponse.json({ message: "Failed to fetch period" }, { status: 500 });
  }
}

// DELETE /api/billing/[periodId] — Delete billing period (draft or processed)
// For processed periods, reverses the isPaid status on source transactions.
export async function DELETE(
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
    const id = parseInt(periodId);

    const period = await prisma.billingPeriod.findUnique({
      where: { id },
      include: { billingItems: true },
    });
    if (!period) {
      return NextResponse.json({ message: "Period tidak ditemukan" }, { status: 404 });
    }

    // Reverse isPaid flags on any settled items (processed period OR partially-settled draft)
    const hasPaidItems = period.billingItems.some((i) => i.isMarkedPaid);
    if (period.status === "processed" || hasPaidItems) {
      await prisma.$transaction(async (tx) => {
        for (const item of period.billingItems) {
          if (!item.isMarkedPaid) continue;
          if (item.transactionSource === "unit_transaction" && item.transactionId) {
            await tx.unitTransaction.update({
              where: { id: item.transactionId },
              data: { isPaid: false, paidDate: null },
            });
          } else if (item.transactionSource === "store_sale" && item.transactionId) {
            // Reverse isSettled in StoreSale metadata
            const sale = await tx.storeSale.findUnique({
              where: { id: item.transactionId },
              select: { metadata: true },
            });
            if (sale) {
              const meta = (typeof sale.metadata === "string"
                ? JSON.parse(sale.metadata)
                : sale.metadata ?? {}) as Record<string, unknown>;
              const { isSettled, settledAt, ...rest } = meta;
              await tx.storeSale.update({
                where: { id: item.transactionId },
                data: { metadata: rest },
              });
            }
          }
        }
        await tx.billingPeriod.delete({ where: { id } });
      });
    } else {
      await prisma.billingPeriod.delete({ where: { id } });
    }

    return NextResponse.json({ message: `Billing period berhasil dihapus (${period.billingItems.length} item)` });
  } catch (error) {
    console.error("DELETE /api/billing/[periodId] error:", error);
    return NextResponse.json({ message: "Failed to delete period" }, { status: 500 });
  }
}
