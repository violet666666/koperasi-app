import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateBillingPeriod, buildBillingItems } from "@/lib/services/billing";

// POST /api/billing/generate — Generate draft billing period
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Accept optional custom date range from request body
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    try {
      const body = await request.json();
      if (body.periodStart && body.periodEnd) {
        periodStart = new Date(body.periodStart);
        periodEnd = new Date(body.periodEnd);
        if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
          return NextResponse.json({ message: "Format tanggal tidak valid" }, { status: 400 });
        }
        if (periodStart > periodEnd) {
          return NextResponse.json({ message: "Tanggal mulai harus sebelum tanggal akhir" }, { status: 400 });
        }
        const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
        periodLabel = `${periodStart.getDate()} ${months[periodStart.getMonth()].substring(0, 3)} - ${periodEnd.getDate()} ${months[periodEnd.getMonth()].substring(0, 3)} ${periodEnd.getFullYear()}`;
      } else {
        const calc = calculateBillingPeriod(new Date());
        periodStart = calc.periodStart;
        periodEnd = calc.periodEnd;
        periodLabel = calc.periodLabel;
      }
    } catch {
      // No body or invalid JSON — use default calculation
      const calc = calculateBillingPeriod(new Date());
      periodStart = calc.periodStart;
      periodEnd = calc.periodEnd;
      periodLabel = calc.periodLabel;
    }

    // Check if draft already exists for this period
    const existing = await prisma.billingPeriod.findFirst({
      where: {
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });

    if (existing) {
      const isDraft = existing.status === "draft";
      return NextResponse.json(
        {
          message: isDraft
            ? `Draft untuk periode tumpang-tindih sudah ada (${existing.periodLabel}). Buka draft tersebut lalu klik "Refresh" untuk memperbarui transaksi terbaru, atau hapus draft lalu generate ulang.`
            : `Periode tumpang-tindih sudah ada dan berstatus Diproses (${existing.periodLabel}).`,
          data: existing,
        },
        { status: 409 }
      );
    }

    // WIB date boundaries
    const startUTC = periodStart;
    const endUTC = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Cross-period dedup: a transaction already claimed by ANY existing BillingPeriod
    // (BillingItem cascades on period delete, so every item belongs to a live period)
    // must not be re-added — prevents the same receivable appearing in two billing runs.
    const claimedItems = await prisma.billingItem.findMany({
      select: { transactionId: true, transactionSource: true },
    });
    const excludedTxIds = new Set<number>();
    const excludedSaleIds = new Set<number>();
    for (const it of claimedItems) {
      if (it.transactionId == null) continue;
      if (it.transactionSource === "store_sale") excludedSaleIds.add(it.transactionId);
      else excludedTxIds.add(it.transactionId);
    }

    // Source 1: UnitTransaction piutang (outstanding, completed, in window)
    const unitTransactions = await prisma.unitTransaction.findMany({
      where: {
        paymentMethod: "salary_cut",
        isPaid: false,
        status: "completed",
        transactionDate: { gte: startUTC, lte: endUTC },
        memberId: { not: null },
      },
      select: {
        id: true, memberId: true, unitType: true, description: true, saleNo: true,
        amount: true, isPaid: true, status: true,
        member: { select: { name: true, nrp: true } },
      },
    });

    // Source 2: salary_cut StoreSales in window (void/settled/exclusion filtered in buildBillingItems)
    const storeSales = await prisma.storeSale.findMany({
      where: {
        paymentMethod: "salary_cut",
        memberId: { not: null },
        createdAt: { gte: startUTC, lte: endUTC },
      },
      select: {
        id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true,
        metadata: true,
        member: { select: { name: true, nrp: true } },
      },
    });

    const items = buildBillingItems({
      unitTransactions: unitTransactions.map((ut) => ({
        id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description,
        saleNo: ut.saleNo,
        amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status,
        member: ut.member,
      })),
      storeSales: storeSales.map((s) => ({
        id: s.id, saleNo: s.saleNo, memberId: s.memberId!, unitType: s.unitType,
        totalAmount: Number(s.totalAmount), metadata: s.metadata, member: s.member,
      })),
      excludedTxIds,
      excludedSaleIds,
    });

    // Source 3: Haji/Umrah savings accounts with monthly target
    const hajiUmrahAccounts = await prisma.savingsAccount.findMany({
      where: {
        status: "active",
        monthlyTarget: { not: null },
        product: {
          type: { in: ["tabungan_haji", "tabungan_umrah"] },
          isActive: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        memberId: true,
        monthlyTarget: true,
        product: { select: { type: true, name: true } },
        member: { select: { name: true, nrp: true } },
      },
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

    if (items.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada transaksi piutang untuk periode ini" },
        { status: 400 }
      );
    }

    // Group by member for totals
    const memberMap = new Map<number, { name: string; nrp: string | null; total: number }>();
    for (const item of items) {
      const existing = memberMap.get(item.memberId);
      if (existing) {
        existing.total += item.amount;
      } else {
        memberMap.set(item.memberId, { name: item.memberName, nrp: item.memberNrp, total: item.amount });
      }
    }

    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

    // Create period with items in transaction
    const period = await prisma.billingPeriod.create({
      data: {
        periodStart,
        periodEnd,
        periodLabel,
        status: "draft",
        totalMembers: memberMap.size,
        totalAmount,
        billingItems: {
          create: items.map((item) => ({
            memberId: item.memberId,
            memberName: item.memberName,
            memberNrp: item.memberNrp,
            unitType: item.unitType,
            transactionId: item.transactionId,
            transactionSource: item.transactionSource,
            description: item.description,
            amount: item.amount,
          })),
        },
      },
      include: { billingItems: true },
    });

    return NextResponse.json({ data: period }, { status: 201 });
  } catch (error) {
    console.error("POST /api/billing/generate error:", error);
    return NextResponse.json({ message: "Failed to generate billing period" }, { status: 500 });
  }
}
