import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildBillingItems } from "@/lib/services/billing";

// POST /api/billing/[periodId]/refresh — Re-capture a DRAFT period's items from current data.
// Fixes the stale-snapshot problem: transactions made AFTER the period was first generated
// are now included. Preserves per-item isMarkedPaid by matching (transactionSource, transactionId).
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
    const id = parseInt(periodId);

    const period = await prisma.billingPeriod.findUnique({
      where: { id },
      include: { billingItems: true },
    });
    if (!period) {
      return NextResponse.json({ message: "Period tidak ditemukan" }, { status: 404 });
    }
    if (period.status !== "draft") {
      return NextResponse.json({ message: "Hanya draft yang bisa di-refresh" }, { status: 400 });
    }

    const startUTC = period.periodStart;
    const endUTC = new Date(period.periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Cross-period dedup: exclude transactions claimed by OTHER periods (not this one),
    // so the refreshed period keeps its own items but never steals another period's.
    const claimedItems = await prisma.billingItem.findMany({
      where: { billingPeriodId: { not: id } },
      select: { transactionId: true, transactionSource: true },
    });
    const excludedTxIds = new Set<number>();
    const excludedSaleIds = new Set<number>();
    for (const it of claimedItems) {
      if (it.transactionId == null) continue;
      if (it.transactionSource === "store_sale") excludedSaleIds.add(it.transactionId);
      else excludedTxIds.add(it.transactionId);
    }

    const [unitTransactions, storeSales, hajiUmrahAccounts] = await Promise.all([
      prisma.unitTransaction.findMany({
        where: { paymentMethod: "salary_cut", isPaid: false, status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
        select: { id: true, memberId: true, unitType: true, description: true, amount: true, isPaid: true, status: true, member: { select: { name: true, nrp: true } } },
      }),
      prisma.storeSale.findMany({
        where: { paymentMethod: "salary_cut", memberId: { not: null }, createdAt: { gte: startUTC, lte: endUTC } },
        select: { id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true, metadata: true, member: { select: { name: true, nrp: true } } },
      }),
      prisma.savingsAccount.findMany({
        where: { status: "active", monthlyTarget: { not: null }, product: { type: { in: ["tabungan_haji", "tabungan_umrah"] }, isActive: true, deletedAt: null } },
        select: { id: true, memberId: true, monthlyTarget: true, product: { select: { type: true } }, member: { select: { name: true, nrp: true } } },
      }),
    ]);

    const items = buildBillingItems({
      unitTransactions: unitTransactions.map((ut) => ({
        id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description,
        amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status, member: ut.member,
      })),
      storeSales: storeSales.map((s) => ({
        id: s.id, saleNo: s.saleNo, memberId: s.memberId!, unitType: s.unitType,
        totalAmount: Number(s.totalAmount), metadata: s.metadata, member: s.member,
      })),
      excludedTxIds,
      excludedSaleIds,
    });
    for (const sa of hajiUmrahAccounts) {
      if (!sa.memberId) continue;
      const typeLabel = sa.product.type === "tabungan_haji" ? "Haji" : "Umrah";
      items.push({
        memberId: sa.memberId,
        memberName: sa.member?.name ?? "Unknown",
        memberNrp: sa.member?.nrp ?? null,
        unitType: "haji_umrah",
        transactionId: sa.id,
        transactionSource: "savings_account",
        description: `Setoran Tabungan ${typeLabel} - ${sa.member?.name ?? "Unknown"}`,
        amount: Number(sa.monthlyTarget),
      });
    }

    // Preserve isMarkedPaid for items that still exist (matched by source + txId).
    const prevMarked = new Set<string>();
    for (const it of period.billingItems) {
      if (it.isMarkedPaid && it.transactionId != null) {
        prevMarked.add(`${it.transactionSource}:${it.transactionId}`);
      }
    }

    const memberMap = new Map<number, { name: string; nrp: string | null }>();
    for (const it of items) {
      if (!memberMap.has(it.memberId)) memberMap.set(it.memberId, { name: it.memberName, nrp: it.memberNrp });
    }
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

    const before = period.billingItems.length;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.billingItem.deleteMany({ where: { billingPeriodId: id } });
      if (items.length > 0) {
        await tx.billingItem.createMany({
          data: items.map((it) => ({
            billingPeriodId: id,
            memberId: it.memberId,
            memberName: it.memberName,
            memberNrp: it.memberNrp,
            unitType: it.unitType,
            transactionId: it.transactionId,
            transactionSource: it.transactionSource,
            description: it.description,
            amount: it.amount,
            isMarkedPaid: prevMarked.has(`${it.transactionSource}:${it.transactionId}`),
          })),
        });
      }
      return tx.billingPeriod.update({
        where: { id },
        data: { totalMembers: memberMap.size, totalAmount },
        include: { billingItems: true },
      });
    });

    return NextResponse.json({
      message: `Draft di-refresh: ${before} → ${items.length} item (${memberMap.size} anggota).`,
      data: updated,
    });
  } catch (error) {
    console.error("POST /api/billing/[periodId]/refresh error:", error);
    return NextResponse.json({ message: "Failed to refresh period" }, { status: 500 });
  }
}
