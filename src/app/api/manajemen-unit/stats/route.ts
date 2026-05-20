import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UNIT_TYPES } from "@/lib/constants/units";
import { aggregateUnitStats, type RawUnitStats } from "@/lib/services/manajemen-unit";

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

    // WIB today boundary
    const now = new Date();
    const wibOffset = 7 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const wibNow = new Date(utcMs + wibOffset * 60000);
    const todayStart = new Date(wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(), 0, 0, 0, 0);
    const todayStartUTC = new Date(todayStart.getTime() - wibOffset * 60000);

    const unitTypes = Object.keys(UNIT_TYPES);

    // Fetch stats per unitType in parallel
    const rawStats: RawUnitStats[] = await Promise.all(
      unitTypes.map(async (unitType) => {
        const [productCount, activeProductCount, lowStockCount, todaySales, todayTransactions] =
          await Promise.all([
            // Product count
            prisma.storeProduct.count({
              where: { unitType, deletedAt: null },
            }),
            // Active product count
            prisma.storeProduct.count({
              where: { unitType, isActive: true, deletedAt: null },
            }),
            // Low stock count (stock <= 5 for store units)
            unitType === "toko" || unitType === "resto" || unitType === "cafe_lsp"
              ? prisma.storeProduct.count({
                  where: { unitType, stock: { lte: 5 }, isActive: true, deletedAt: null },
                })
              : Promise.resolve(0),
            // Today's store sales revenue (for store-type units)
            prisma.storeSale.aggregate({
              _sum: { totalAmount: true },
              _count: true,
              where: {
                unitType,
                createdAt: { gte: todayStartUTC },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
              },
            }),
            // Today's unit transactions (for service-type units)
            prisma.unitTransaction.count({
              where: {
                unitType,
                transactionDate: { gte: todayStartUTC },
                status: { not: "voided" },
              },
            }),
          ]);

        // For store units, revenue comes from StoreSale
        // For service units, revenue comes from UnitTransaction
        const storeRevenue = Number(todaySales._sum.totalAmount ?? 0);
        const storeTxCount = todaySales._count;

        // Get service transaction revenue if applicable
        const serviceRevenue = await prisma.unitTransaction.aggregate({
          _sum: { amount: true },
          where: {
            unitType,
            transactionDate: { gte: todayStartUTC },
            status: { not: "voided" },
          },
        });

        return {
          unitType,
          productCount,
          activeProductCount,
          todayTransactionCount: storeTxCount + todayTransactions,
          todayRevenue: storeRevenue + Number(serviceRevenue._sum.amount ?? 0),
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
