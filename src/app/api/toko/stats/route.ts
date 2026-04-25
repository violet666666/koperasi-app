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

        const [totalProducts, totalStock, todaySales, allSales, todayItems, allItems] = await Promise.all([
            prisma.storeProduct.count({ where: productFilter }),
            prisma.storeProduct.aggregate({
                where: productFilter,
                _sum: { stock: true },
            }),
            prisma.storeSale.findMany({
                where: { ...unitFilter, createdAt: { gte: todayStartUTC } },
                select: { totalAmount: true, metadata: true },
            }),
            prisma.storeSale.findMany({
                where: unitFilter,
                select: { totalAmount: true, metadata: true },
            }),
            prisma.storeSale.findMany({
                where: { ...unitFilter, createdAt: { gte: todayStartUTC } },
                select: { metadata: true, items: { select: { quantity: true } } },
            }),
            prisma.storeSale.findMany({
                where: unitFilter,
                select: { metadata: true, items: { select: { quantity: true } } },
            }),
        ]);

        // Helper: filter out voided sales
        const filterActive = (sales: any[]) =>
            sales.filter((s) => {
                if (!s.metadata) return true;
                const meta = typeof s.metadata === "object" ? s.metadata : JSON.parse(s.metadata as string);
                return !meta.isVoided;
            });

        const activeTodaySales = filterActive(todaySales);
        const activeAllSales = filterActive(allSales);
        const activeTodayItems = filterActive(todayItems);
        const activeAllItems = filterActive(allItems);

        const todaySalesTotal = activeTodaySales.reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
        const allTimeSalesTotal = activeAllSales.reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
        const todayItemsSold = activeTodayItems.reduce((sum: number, s: any) => sum + s.items.reduce((is: number, i: any) => is + (i.quantity || 0), 0), 0);
        const allTimeItemsSold = activeAllItems.reduce((sum: number, s: any) => sum + s.items.reduce((is: number, i: any) => is + (i.quantity || 0), 0), 0);

        return NextResponse.json({
            data: {
                totalProducts,
                totalStock: totalStock._sum.stock || 0,
                todaySales: todaySalesTotal,
                todaySalesCount: activeTodaySales.length,
                totalSales: allTimeSalesTotal,
                totalSalesCount: activeAllSales.length,
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

