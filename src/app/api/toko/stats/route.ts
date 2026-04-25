import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/toko/stats - Dashboard stats from real data
export async function GET() {
    try {
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

        const [totalProducts, totalStock, todaySales, allSales, todayItems, allItems] = await Promise.all([
            prisma.storeProduct.count({ where: { isActive: true, deletedAt: null } }),
            prisma.storeProduct.aggregate({
                where: { isActive: true, deletedAt: null },
                _sum: { stock: true },
            }),
            // FIX Bug #4: Fetch semua, lalu filter voided secara manual
            prisma.storeSale.findMany({
                where: { createdAt: { gte: todayStart } },
                select: { totalAmount: true, metadata: true },
            }),
            prisma.storeSale.findMany({
                select: { totalAmount: true, metadata: true },
            }),
            // Jumlah item terjual hari ini
            prisma.storeSale.findMany({
                where: { createdAt: { gte: todayStart } },
                select: { metadata: true, items: { select: { quantity: true } } },
            }),
            // Jumlah item terjual semua
            prisma.storeSale.findMany({
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

