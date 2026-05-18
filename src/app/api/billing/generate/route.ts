import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateBillingPeriod } from "@/lib/services/billing";

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
      return NextResponse.json(
        { message: "Billing period already exists", data: existing },
        { status: 409 }
      );
    }

    // WIB date boundaries
    const startUTC = periodStart;
    const endUTC = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Backfill missing piutang UnitTransactions for salary_cut StoreSales.
    // Some older sales may not have piutang records if the POS code was
    // deployed mid-day. Find StoreSales without matching piutang and create them.
    const storeSales = await prisma.storeSale.findMany({
      where: {
        paymentMethod: "salary_cut",
        status: { not: "voided" },
        memberId: { not: null },
        transactionDate: { lte: endUTC },
      },
      select: { id: true, saleNo: true, memberId: true, member: { select: { name: true } }, totalAmount: true, transactionDate: true, createdById: true },
    });

    if (storeSales.length > 0) {
      const existingPiutang = await prisma.unitTransaction.findMany({
        where: {
          paymentMethod: "salary_cut",
          status: { in: ["completed", "pending"] },
          notes: { startsWith: "Auto-generated dari penjualan kasir" },
        },
        select: { description: true },
      });
      const coveredSaleNos = new Set(existingPiutang.map((ut) => {
        const match = ut.description?.match(/(TK-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/);
        return match ? match[1] : null;
      }).filter(Boolean));

      const missingSales = storeSales.filter((ss) => !coveredSaleNos.has(ss.saleNo));
      if (missingSales.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const ss of missingSales) {
            await tx.unitTransaction.create({
              data: {
                transactionNo: `TK-UTG-${Date.now().toString(36).toUpperCase()}-${ss.id}`,
                memberId: ss.memberId!,
                unitType: "toko",
                description: `Piutang toko (Potongan Gaji) - ${ss.saleNo}`,
                amount: ss.totalAmount,
                transactionDate: ss.transactionDate,
                paymentMethod: "salary_cut",
                isPaid: false,
                notes: `Auto-generated dari penjualan kasir. No. Transaksi: ${ss.saleNo}`,
                createdById: ss.createdById,
              },
            });
          }
        });
      }
    }

    // Fetch ALL unpaid salary_cut UnitTransactions up to end of period.
    // Only use UnitTransaction — NOT StoreSale — because toko POS already
    // creates a UnitTransaction (piutang) for every salary_cut StoreSale.
    // Querying both would cause double-counting.
    const unitTransactions = await prisma.unitTransaction.findMany({
      where: {
        paymentMethod: "salary_cut",
        isPaid: false,
        status: "completed",
        transactionDate: { lte: endUTC },
        memberId: { not: null },
      },
      select: {
        id: true, memberId: true, unitType: true, description: true,
        amount: true, member: { select: { name: true, nrp: true } },
      },
    });

    if (unitTransactions.length === 0) {
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
