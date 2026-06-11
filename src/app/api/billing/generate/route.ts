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

    // Strategy: collect piutang from two sources, then deduplicate by saleNo.
    // Source 1: UnitTransaction piutang records (salary_cut, unpaid, completed).
    // Source 2: StoreSales with salary_cut that have NO matching piutang UnitTransaction
    //           (covers the gap before POS piutang code was deployed).

    const SALE_NO_RE = /(TK-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;

    const UNIT_LABELS: Record<string, string> = {
      toko: "Toko", resto: "Resto", resto_cafe: "Resto & Cafe",
      cafe_lsp: "Cafe LSP", coffe_latar: "Coffee Latar",
      playstation: "PlayStation", play_station: "PlayStation",
      cuci_mobil: "Cuci Mobil", carwash: "Cuci Mobil",
      barbershop: "Barbershop", fitness: "Fitness", laundry: "Laundry",
      fotocopy: "Fotocopy", simpan_pinjam: "Simpan Pinjam", aset: "Aset",
    };

    // Source 1: Existing piutang UnitTransactions within period
    const unitTransactions = await prisma.unitTransaction.findMany({
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
    });

    // Build a set of saleNos already covered by UnitTransactions
    const coveredSaleNos = new Set<string>();
    for (const ut of unitTransactions) {
      const match = ut.description?.match(SALE_NO_RE);
      if (match) coveredSaleNos.add(match[1]);
    }

    // Source 2: StoreSales without matching piutang UnitTransaction.
    // StoreSale uses `createdAt` for date, void info is in metadata.isVoided.
    // Query without Prisma JSON NOT filter (it can exclude null metadata rows),
    // then filter voided in JavaScript.
    const allStoreSales = await prisma.storeSale.findMany({
      where: {
        paymentMethod: "salary_cut",
        memberId: { not: null },
        createdAt: { gte: startUTC, lte: endUTC },
      },
      select: {
        id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true,
        createdAt: true, metadata: true,
        member: { select: { name: true, nrp: true } },
      },
    });

    const uncoveredStoreSales = allStoreSales.filter((ss) => {
      const meta = ss.metadata as Record<string, unknown> | null;
      return !meta?.isVoided;
    });

    // Only StoreSales not already covered by UnitTransactions
    const gapStoreSales = uncoveredStoreSales.filter(
      (ss) => !coveredSaleNos.has(ss.saleNo)
    );

    // Build billing items from both sources
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

    // Items from UnitTransactions (primary source)
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

    // Items from StoreSales that lack piutang records (gap coverage)
    for (const ss of gapStoreSales) {
      if (!ss.memberId) continue;
      const label = UNIT_LABELS[ss.unitType] || ss.unitType;
      items.push({
        memberId: ss.memberId,
        memberName: ss.member?.name ?? "Unknown",
        memberNrp: ss.member?.nrp ?? null,
        unitType: ss.unitType,
        transactionId: ss.id,
        transactionSource: "store_sale",
        description: `Piutang ${label} (Potongan Gaji) - ${ss.saleNo}`,
        amount: Number(ss.totalAmount),
      });
    }

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
