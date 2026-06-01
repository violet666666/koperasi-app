import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UNIT_TYPES, unitTypeFilter, storeSaleUnitTypeFilter } from "@/lib/constants/units";
import { aggregateUnitStats, computeWIBBoundaries, type RawUnitStats } from "@/lib/services/manajemen-unit";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Only operator with manage_all can access this endpoint
    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // WIB today boundary — uses computeWIBBoundaries for correct @db.Date handling
    const {
      todayStartUTC, yesterdayStartUTC,
      todayDateUTC, tomorrowDateUTC, yesterdayDateUTC,
    } = computeWIBBoundaries();

    const unitTypes = Object.keys(UNIT_TYPES);

    // Fetch stats per unitType in parallel
    const rawStats: RawUnitStats[] = await Promise.all(
      unitTypes.map(async (unitType) => {
        const utFilter = unitTypeFilter(unitType);
        const ssFilter = storeSaleUnitTypeFilter(unitType);
        const isStoreUnit = ["toko", "resto", "cafe_lsp"].includes(unitType);

        const [productCount, activeProductCount, lowStockCount, todaySales, todayUnitTxCount] =
          await Promise.all([
            // Product count (always use exact unitType — products are stored with canonical types)
            prisma.storeProduct.count({
              where: { unitType, deletedAt: null },
            }),
            // Active product count
            prisma.storeProduct.count({
              where: { unitType, isActive: true, deletedAt: null },
            }),
            // Low stock count (stock <= min_stock per product)
            isStoreUnit
              ? prisma.$queryRaw<[{ count: bigint }]>`
                  SELECT COUNT(*)::int as count FROM store_products
                  WHERE unit_type = ${unitType}
                    AND is_active = true
                    AND deleted_at IS NULL
                    AND stock <= COALESCE(min_stock, 5)
                `.then(r => Number(r[0].count))
              : Promise.resolve(0),
            // Today's store sales revenue — uses alias filter + DateTime field
            prisma.storeSale.aggregate({
              _sum: { totalAmount: true },
              _count: true,
              where: {
                unitType: ssFilter as string,
                createdAt: { gte: todayStartUTC },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
              },
            }),
            // Today's unit transactions count — uses alias filter + @db.Date field
            prisma.unitTransaction.count({
              where: {
                unitType: utFilter,
                transactionDate: { gte: todayDateUTC, lt: tomorrowDateUTC },
                status: { not: "voided" },
              },
            }),
          ]);

        // Service revenue from UnitTransaction (alias-aware, @db.Date)
        const serviceRevenueResult = await prisma.unitTransaction.aggregate({
          _sum: { amount: true },
          where: {
            unitType: utFilter,
            transactionDate: { gte: todayDateUTC, lt: tomorrowDateUTC },
            status: { not: "voided" },
          },
        });

        const storeRevenue = Number(todaySales._sum.totalAmount ?? 0);
        const serviceRevenue = Number(serviceRevenueResult._sum.amount ?? 0);
        const serviceTxCount = todayUnitTxCount;

        // Yesterday revenue for trend comparison (both sources)
        const yesterdayStoreRevenue = await prisma.storeSale.aggregate({
          _sum: { totalAmount: true },
          where: {
            unitType: ssFilter as string,
            createdAt: { gte: yesterdayStartUTC, lt: todayStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
        });

        const yesterdayServiceRevenue = await prisma.unitTransaction.aggregate({
          _sum: { amount: true },
          where: {
            unitType: utFilter,
            transactionDate: { gte: yesterdayDateUTC, lt: todayDateUTC },
            status: { not: "voided" },
          },
        });

        const yesterdayRevenue =
          Number(yesterdayStoreRevenue._sum.totalAmount ?? 0) +
          Number(yesterdayServiceRevenue._sum.amount ?? 0);

        return {
          unitType,
          productCount,
          activeProductCount,
          todayTransactionCount: todaySales._count + serviceTxCount,
          todayRevenue: storeRevenue + serviceRevenue,
          yesterdayRevenue,
          lowStockCount,
        };
      })
    );

    const result = aggregateUnitStats(rawStats);

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("GET /api/manajemen-unit/stats error:", error);
    return NextResponse.json({ message: "Failed to fetch unit stats" }, { status: 500 });
  }
}
