import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType, getUnitLabel } from "@/lib/constants/units";
import { computeUnitDetail, type RawUnitDetail, computePeakHours, computeProfitFromItems } from "@/lib/services/manajemen-unit";

export async function GET(
  request: Request,
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

    // Parse range parameter for product sales breakdown (Phase 3)
    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "today";
    const validRange = range === "7d" || range === "30d" ? range : "today";
    const rangeDays = validRange === "30d" ? 30 : validRange === "7d" ? 7 : 1;
    const rangeStartUTC = rangeDays > 1
      ? new Date(todayStartUTC.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000)
      : todayStartUTC;

    // 14 days ago for weekly comparison chart (Phase 2)
    const twoWeeksAgoUTC = new Date(todayStartUTC.getTime() - 13 * 24 * 60 * 60 * 1000);

    const isStore = ["toko", "resto", "cafe_lsp"].includes(unitType);

    const [productCount, activeProductCount, stockResult, lowStockCount, todaySales, todayServiceTx, weekSales, weekServiceTx, storePaymentBreakdown, topProductItems, profitItems] =
      await Promise.all([
        prisma.storeProduct.count({ where: { unitType, deletedAt: null } }),
        prisma.storeProduct.count({ where: { unitType, isActive: true, deletedAt: null } }),
        prisma.storeProduct.aggregate({ where: { unitType, isActive: true, deletedAt: null }, _sum: { stock: true } }),
        // Low stock count (stock <= min_stock per product)
        isStore
          ? prisma.$queryRaw<[{ count: bigint }]>`
              SELECT COUNT(*)::int as count FROM store_products
              WHERE unit_type = ${unitType}
                AND is_active = true
                AND deleted_at IS NULL
                AND stock <= min_stock
            `.then(r => Number(r[0].count))
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
            createdAt: { gte: twoWeeksAgoUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
          select: { createdAt: true, totalAmount: true },
        }),
        // Weekly service transactions grouped by date
        prisma.unitTransaction.findMany({
          where: {
            unitType,
            transactionDate: { gte: twoWeeksAgoUTC },
            status: { not: "voided" },
          },
          select: { transactionDate: true, amount: true },
        }),
        // 9. Payment method breakdown (today)
        prisma.storeSale.groupBy({
          by: ["paymentMethod"],
          _sum: { totalAmount: true },
          _count: true,
          where: {
            unitType,
            createdAt: { gte: todayStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
        }),
        // 10. All products sold by quantity (range-aware, store units only)
        isStore
          ? prisma.storeSaleItem.groupBy({
              by: ["productId"],
              _sum: { quantity: true, subtotal: true },
              orderBy: { _sum: { quantity: "desc" } },
              where: {
                sale: {
                  unitType,
                  createdAt: { gte: rangeStartUTC },
                  NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
                },
              },
            })
          : Promise.resolve([]),
        // 11. Profit items for store units (today)
        isStore
          ? prisma.storeSaleItem.findMany({
              where: {
                sale: {
                  unitType,
                  createdAt: { gte: todayStartUTC },
                  NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
                },
              },
              select: {
                unitPrice: true,
                costPrice: true,
                quantity: true,
                productId: true,
              },
            })
          : Promise.resolve([]),
      ]);

    // Build weekly revenue map
    const weekMap = new Map<string, { revenue: number; transactions: number }>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(twoWeeksAgoUTC.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      weekMap.set(key, { revenue: 0, transactions: 0 });
    }

    for (const s of weekSales) {
      if (!isStore) continue; // Skip for service units
      const key = new Date(s.createdAt.getTime() + wibOffset * 60000).toISOString().slice(0, 10);
      const entry = weekMap.get(key);
      if (entry) {
        entry.revenue += Number(s.totalAmount);
        entry.transactions += 1;
      }
    }

    for (const t of weekServiceTx) {
      if (isStore) continue; // Skip for store units
      const key = new Date(t.transactionDate.getTime() + wibOffset * 60000).toISOString().slice(0, 10);
      const entry = weekMap.get(key);
      if (entry) {
        entry.revenue += Number(t.amount);
        entry.transactions += 1;
      }
    }

    const allDays = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    const prevWeekRevenue = allDays.slice(0, 7).map(([date, data]) => ({ date, ...data }));
    const weekRevenue = allDays.slice(7).map(([date, data]) => ({ date, ...data }));

    // Peak hours: filter today's records from weekly data, group by WIB hour
    const todayWIB = wibNow.toISOString().slice(0, 10);
    const todayPeakRecords = (isStore
      ? weekSales.filter(s => {
          const wibDate = new Date(s.createdAt.getTime() + wibOffset * 60000);
          return wibDate.toISOString().slice(0, 10) === todayWIB;
        }).map(s => ({ date: s.createdAt, amount: Number(s.totalAmount) }))
      : weekServiceTx.filter(t => {
          const wibDate = new Date(t.transactionDate.getTime() + wibOffset * 60000);
          return wibDate.toISOString().slice(0, 10) === todayWIB;
        }).map(t => ({ date: t.transactionDate, amount: Number(t.amount) }))
    );
    const peakHours = computePeakHours(todayPeakRecords, wibOffset);

    // Profit metrics (store units only)
    let todayProfit = 0;
    let profitMargin = 0;
    let topProfitProducts: Array<{ productId: number; name: string; profit: number; revenue: number; margin: number }> = [];

    type ProfitItemRow = { unitPrice: number; costPrice: number | null; quantity: number; productId: number };
    if (isStore && (profitItems as ProfitItemRow[]).length > 0) {
      const normalizedItems = (profitItems as ProfitItemRow[]).map(item => ({
        unitPrice: Number(item.unitPrice),
        costPrice: Number(item.costPrice ?? 0),
        quantity: item.quantity,
        productId: item.productId,
      }));

      const profitResult = computeProfitFromItems(normalizedItems);
      todayProfit = profitResult.todayProfit;

      // Resolve top profit product names (top 5 by profit)
      const sorted = Array.from(profitResult.productProfits.entries())
        .sort(([, a], [, b]) => b.profit - a.profit)
        .slice(0, 5);

      const topProfitIds = sorted.map(([id]) => id);
      const topProfitProductsRows = await prisma.storeProduct.findMany({
        where: { id: { in: topProfitIds } },
        select: { id: true, name: true },
      });
      const topProfitNameMap = new Map(topProfitProductsRows.map(p => [p.id, p.name]));

      topProfitProducts = sorted.map(([productId, data]) => ({
        productId,
        name: topProfitNameMap.get(productId) ?? "Unknown",
        profit: data.profit,
        revenue: data.revenue,
        margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 10000) / 100 : 0,
      }));
    }

    // Use actual todayRevenue for margin calculation (includes discounts, taxes)
    const detailTodayRevenue = isStore
      ? Number(todaySales._sum.totalAmount ?? 0)
      : Number(todayServiceTx._sum.amount ?? 0);

    profitMargin = detailTodayRevenue > 0 && isStore
      ? Math.round((todayProfit / detailTodayRevenue) * 10000) / 100
      : 0;

    // Service payment breakdown for non-store units
    const servicePaymentBreakdown = !isStore
      ? await prisma.unitTransaction.groupBy({
          by: ["paymentMethod"],
          _sum: { amount: true },
          _count: true,
          where: {
            unitType,
            transactionDate: { gte: todayStartUTC },
            status: { not: "voided" },
          },
        })
      : [];

    // Resolve all product sales with names (batch findMany — no N+1)
    type ProductSaleRow = { productId: number; _sum: { quantity: number | null; subtotal: number | null } };
    const allProductSales: Array<{ productId: number; name: string; quantity: number; revenue: number }> = [];

    if ((topProductItems as ProductSaleRow[]).length > 0) {
      const items = topProductItems as ProductSaleRow[];
      const productIds = items.map(item => item.productId);

      const products = await prisma.storeProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map(p => [p.id, p.name]));

      for (const item of items) {
        allProductSales.push({
          productId: item.productId,
          name: productMap.get(item.productId) ?? "Unknown",
          quantity: Number(item._sum.quantity ?? 0),
          revenue: Number(item._sum.subtotal ?? 0),
        });
      }
    }

    // Derive top 5 from allProductSales (backward compatibility)
    const topProducts = allProductSales.slice(0, 5).map(p => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
    }));

    // Sales summary
    const salesSummary = {
      totalProducts: allProductSales.length,
      totalItems: allProductSales.reduce((s, p) => s + p.quantity, 0),
      totalRevenue: allProductSales.reduce((s, p) => s + p.revenue, 0),
    };

    // Combine payment breakdown from store + service
    const paymentMap = new Map<string, { amount: number; count: number }>();
    for (const p of storePaymentBreakdown as Array<{ paymentMethod: string; _sum: { totalAmount: number | null }; _count: number }>) {
      const method = p.paymentMethod || "cash";
      const existing = paymentMap.get(method) ?? { amount: 0, count: 0 };
      existing.amount += Number(p._sum.totalAmount ?? 0);
      existing.count += p._count;
      paymentMap.set(method, existing);
    }
    for (const p of servicePaymentBreakdown as Array<{ paymentMethod: string; _sum: { amount: number | null }; _count: number }>) {
      const method = p.paymentMethod || "cash";
      const existing = paymentMap.get(method) ?? { amount: 0, count: 0 };
      existing.amount += Number(p._sum.amount ?? 0);
      existing.count += p._count;
      paymentMap.set(method, existing);
    }
    const paymentMethods = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      label: method === "cash" ? "Tunai" : method === "qris" ? "QRIS" : method === "salary_cut" ? "Potong Gaji" : method,
      amount: data.amount,
      count: data.count,
    }));

    const raw: RawUnitDetail = {
      productCount,
      activeProductCount,
      totalStock: Number(stockResult._sum.stock ?? 0),
      lowStockCount,
      // Store units only count StoreSale; service units only count UnitTransaction
      todayTransactions: isStore
        ? todaySales._count
        : todayServiceTx._count,
      todayRevenue: isStore
        ? Number(todaySales._sum.totalAmount ?? 0)
        : Number(todayServiceTx._sum.amount ?? 0),
      weekRevenue,
    };

    const detail = computeUnitDetail(raw);

    return NextResponse.json({
      data: {
        unitType,
        label: getUnitLabel(unitType),
        ...detail,
        topProducts,
        paymentMethods,
        peakHours,
        ...(isStore ? { todayProfit, profitMargin, topProfitProducts } : {}),
        prevWeekRevenue,
        ...(isStore ? { allProductSales, salesRange: validRange, salesSummary } : {}),
      },
    });
  } catch (error) {
    console.error("GET /api/manajemen-unit/[unitSlug]/stats error:", error);
    return NextResponse.json({ message: "Failed to fetch unit stats" }, { status: 500 });
  }
}
