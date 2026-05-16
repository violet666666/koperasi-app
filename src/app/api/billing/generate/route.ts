import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateBillingPeriod } from "@/lib/services/billing";

// POST /api/billing/generate — Generate draft billing period
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { periodStart, periodEnd, periodLabel } = calculateBillingPeriod(new Date());

    // Check if draft already exists for this period
    const existing = await prisma.billingPeriod.findFirst({
      where: {
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Billing period already exists", data: existing },
        { status: 409 }
      );
    }

    // WIB date boundaries
    const startUTC = periodStart;
    const endUTC = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Fetch unpaid salary_cut transactions in period
    const [unitTransactions, storeSales] = await Promise.all([
      prisma.unitTransaction.findMany({
        where: {
          paymentMethod: "salary_cut",
          isPaid: false,
          status: "completed",
          transactionDate: { gte: startUTC, lte: endUTC },
          memberId: { not: null },
        },
        select: {
          id: true, memberId: true, unitType: true, description: true,
          amount: true, member: { select: { name: true, nrp: true } },
        },
      }),
      prisma.storeSale.findMany({
        where: {
          paymentMethod: "salary_cut",
          unitType: { in: ["toko", "resto", "cafe_lsp", "playstation"] },
          createdAt: { gte: startUTC, lte: endUTC },
          NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
        },
        select: {
          id: true, unitType: true, totalAmount: true, memberId: true,
          member: { select: { name: true, nrp: true } },
        },
      }),
    ]);

    if (unitTransactions.length === 0 && storeSales.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada transaksi piutang untuk periode ini" },
        { status: 400 }
      );
    }

    // Build billing items
    const items: {
      memberId: number;
      memberName: string;
      memberNrp: string | null;
      unitType: string | null;
      transactionId: number;
      transactionSource: string;
      description: string;
      amount: number;
    }[] = [];

    for (const tx of unitTransactions) {
      if (!tx.memberId) continue;
      items.push({
        memberId: tx.memberId,
        memberName: tx.member?.name ?? "Unknown",
        memberNrp: tx.member?.nrp ?? null,
        unitType: tx.unitType,
        transactionId: tx.id,
        transactionSource: "unit_transaction",
        description: tx.description,
        amount: Number(tx.amount),
      });
    }

    for (const sale of storeSales) {
      if (!sale.memberId) continue;
      items.push({
        memberId: sale.memberId,
        memberName: sale.member?.name ?? "Unknown",
        memberNrp: sale.member?.nrp ?? null,
        unitType: sale.unitType,
        transactionId: sale.id,
        transactionSource: "store_sale",
        description: `Penjualan ${sale.unitType}`,
        amount: Number(sale.totalAmount),
      });
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
