import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType, getUnitLabel } from "@/lib/constants/units";
import { computeUnitDetail, type RawUnitDetail } from "@/lib/services/manajemen-unit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitSlug: string }> }
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

    const { unitSlug } = await params;
    const unitType = slugToUnitType(unitSlug);
    if (!unitType) {
      return NextResponse.json({ message: "Unit not found" }, { status: 404 });
    }

    // WIB today boundary
    const now = new Date();
    const wibOffset = 7 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibNow = new Date(utcMs + wibOffset * 60000);
    const todayStart = new Date(wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(), 0, 0, 0, 0);
    const todayStartUTC = new Date(todayStart.getTime() - wibOffset * 60000);

    // 7 days ago for weekly chart
    const weekAgoUTC = new Date(todayStartUTC.getTime() - 6 * 24 * 60 * 60 * 1000);

    const isStore = ["toko", "resto", "cafe_lsp"].includes(unitType);

    const [productCount, activeProductCount, stockResult, lowStockCount, todaySales, todayServiceTx, weekSales, weekServiceTx] =
      await Promise.all([
        prisma.storeProduct.count({ where: { unitType, deletedAt: null } }),
        prisma.storeProduct.count({ where: { unitType, isActive: true, deletedAt: null } }),
        prisma.storeProduct.aggregate({ where: { unitType, isActive: true, deletedAt: null }, _sum: { stock: true } }),
        isStore
          ? prisma.storeProduct.count({ where: { unitType, stock: { lte: 5 }, isActive: true, deletedAt: null } })
          : Promise.resolve(0),
        // Today store sales
        prisma.storeSale.aggregate({
          _sum: { totalAmount: true },
          _count: true,
          where: {
            unitType,
            createdAt: { gte: todayStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
        }),
        // Today service transactions
        prisma.unitTransaction.aggregate({
          _sum: { amount: true },
          _count: true,
          where: {
            unitType,
            transactionDate: { gte: todayStartUTC },
            status: { not: "voided" },
          },
        }),
        // Weekly store sales grouped by date
        prisma.storeSale.findMany({
          where: {
            unitType,
            createdAt: { gte: weekAgoUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
          select: { createdAt: true, totalAmount: true },
        }),
        // Weekly service transactions grouped by date
        prisma.unitTransaction.findMany({
          where: {
            unitType,
            transactionDate: { gte: weekAgoUTC },
            status: { not: "voided" },
          },
          select: { transactionDate: true, amount: true },
        }),
      ]);

    // Build weekly revenue map
    const weekMap = new Map<string, { revenue: number; transactions: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgoUTC.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      weekMap.set(key, { revenue: 0, transactions: 0 });
    }

    for (const s of weekSales) {
      const key = new Date(s.createdAt.getTime() + wibOffset * 60000).toISOString().slice(0, 10);
      const entry = weekMap.get(key);
      if (entry) {
        entry.revenue += Number(s.totalAmount);
        entry.transactions += 1;
      }
    }

    for (const t of weekServiceTx) {
      const key = new Date(t.transactionDate.getTime() + wibOffset * 60000).toISOString().slice(0, 10);
      const entry = weekMap.get(key);
      if (entry) {
        entry.revenue += Number(t.amount);
        entry.transactions += 1;
      }
    }

    const weekRevenue = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    const raw: RawUnitDetail = {
      productCount,
      activeProductCount,
      totalStock: Number(stockResult._sum.stock ?? 0),
      lowStockCount,
      todayTransactions: todaySales._count + todayServiceTx._count,
      todayRevenue: Number(todaySales._sum.totalAmount ?? 0) + Number(todayServiceTx._sum.amount ?? 0),
      weekRevenue,
    };

    const detail = computeUnitDetail(raw);

    return NextResponse.json({
      data: {
        unitType,
        label: getUnitLabel(unitType),
        ...detail,
      },
    });
  } catch (error) {
    console.error("GET /api/manajemen-unit/[unitSlug]/stats error:", error);
    return NextResponse.json({ message: "Failed to fetch unit stats" }, { status: 500 });
  }
}
