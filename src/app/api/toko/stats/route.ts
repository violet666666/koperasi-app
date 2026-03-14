import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/toko/stats - Dashboard stats from real data
export async function GET() {
    try {
        const [totalProducts, totalStock, todaySalesResult, allTimeSalesResult] = await Promise.all([
            prisma.storeProduct.count({ where: { isActive: true, deletedAt: null } }),
            prisma.storeProduct.aggregate({
                where: { isActive: true, deletedAt: null },
                _sum: { stock: true },
            }),
            // Today's sales
            prisma.storeSale.aggregate({
                where: {
                    createdAt: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
                _sum: { totalAmount: true },
                _count: true,
            }),
            // All-time sales
            prisma.storeSale.aggregate({
                _sum: { totalAmount: true },
                _count: true,
            }),
        ]);

        return NextResponse.json({
            data: {
                totalProducts,
                totalStock: totalStock._sum.stock || 0,
                todaySales: Number(todaySalesResult._sum.totalAmount || 0),
                todaySalesCount: todaySalesResult._count || 0,
                totalSales: Number(allTimeSalesResult._sum.totalAmount || 0),
                totalSalesCount: allTimeSalesResult._count || 0,
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
