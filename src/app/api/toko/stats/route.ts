import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/stats - Dashboard stats from real data (filtered by unitType)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || null;

        // Use UTC+7 (WIB) for "today" boundary to match Indonesian business hours
        const now = new Date();
        const wibOffset = 7 * 60; // WIB is UTC+7
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const wibNow = new Date(utcMs + wibOffset * 60000);
        const todayStart = new Date(
            wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(),
            0, 0, 0, 0
        );
        // Convert back to UTC for the database query
        const todayStartUTC = new Date(todayStart.getTime() - wibOffset * 60000);

        const unitFilter = unitType ? { unitType } : {};
        const productFilter = unitType ? { unitType, isActive: true, deletedAt: null } : { isActive: true, deletedAt: null };

        // Shared filter: exclude voided sales via JSON path (same pattern as shu-calculator.ts)
        const notVoidedFilter = {
            ...unitFilter,
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
        };

        // ── Queries ──────────────────────────────────────────────────────────
        // Today's queries: findMany with select (small dataset, per-row void check in JS)
        // All-time queries: aggregate on DB side (no full table loaded into memory)
        const [totalProducts, totalStock, todaySales, todayItems, allTimeStats, allTimeItemsStats] = await Promise.all([
            prisma.storeProduct.count({ where: productFilter }),
            prisma.storeProduct.aggregate({
                where: productFilter,
                _sum: { stock: true },
            }),
            // Today's sales — findMany needed for per-row metadata void filtering
            prisma.storeSale.findMany({
                where: { ...unitFilter, createdAt: { gte: todayStartUTC } },
                select: { totalAmount: true, metadata: true },
            }),
            // Today's items — findMany needed for per-row metadata void filtering
            prisma.storeSale.findMany({
                where: { ...unitFilter, createdAt: { gte: todayStartUTC } },
                select: { metadata: true, items: { select: { quantity: true } } },
            }),
            // All-time sales total & count — aggregate on DB (excludes voided via JSON path filter)
            prisma.storeSale.aggregate({
                _sum: { totalAmount: true },
                _count: true,
                where: notVoidedFilter,
            }),
            // All-time items sold — aggregate on DB (excludes voided via JSON path filter)
            prisma.storeSaleItem.aggregate({
                _sum: { quantity: true },
                where: {
                    sale: notVoidedFilter,
                },
            }),
        ]);

        // Helper: filter out voided sales (for today's findMany results)
        // Generic preserves the input type through the filter so downstream .reduce() can access selected fields.
        const filterActive = <T extends { metadata: unknown }>(sales: T[]): T[] =>
            sales.filter((s) => {
                if (!s.metadata) return true;
                const meta = typeof s.metadata === "object" ? s.metadata : JSON.parse(s.metadata as string);
                return !(meta as Record<string, unknown>).isVoided;
            });

        // ── Today's calculations ──
        const activeTodaySales = filterActive(todaySales);
        const activeTodayItems = filterActive(todayItems);
        const todaySalesTotal = activeTodaySales.reduce((sum: number, s: (typeof todaySales)[number]) => sum + Number(s.totalAmount || 0), 0);
        const todayItemsSold = activeTodayItems.reduce((sum: number, s: (typeof todayItems)[number]) => sum + s.items.reduce((is: number, i: { quantity: number }) => is + (i.quantity || 0), 0), 0);

        // ── All-time calculations (already aggregated on DB side, voided excluded) ──
        const allTimeSalesTotal = Number(allTimeStats._sum.totalAmount || 0);
        const allTimeSalesCount = allTimeStats._count;
        const allTimeItemsSold = Number(allTimeItemsStats._sum.quantity || 0);

        return NextResponse.json({
            data: {
                totalProducts,
                totalStock: totalStock._sum.stock || 0,
                todaySales: todaySalesTotal,
                todaySalesCount: activeTodaySales.length,
                totalSales: allTimeSalesTotal,
                totalSalesCount: allTimeSalesCount,
                todayItemsSold,
                allTimeItemsSold,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/stats error:", error);
        return NextResponse.json(
            { message: "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
