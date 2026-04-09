import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/toko/movements - Rekapan riwayat masuk keluar stok produk
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "200");
        const productId = searchParams.get("productId");

        const whereClause: any = {};
        if (productId) {
            whereClause.productId = parseInt(productId);
        }

        const movements = await prisma.storeStockMovement.findMany({
            where: whereClause,
            include: {
                product: { select: { id: true, sku: true, name: true, stock: true } },
                operator: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        // Map to standard UI shape
        const formatted = movements.map(m => ({
            id: m.id,
            date: m.createdAt,
            productSku: m.product.sku,
            productName: m.product.name,
            type: m.type,
            quantity: m.quantity,
            notes: (m.reference ? m.reference + (m.notes ? " - " + m.notes : "") : m.notes) || "-",
            operator: m.operator?.name || "System",
        }));

        return NextResponse.json({ data: formatted });
    } catch (error) {
        console.error("GET /api/toko/movements error:", error);
        return NextResponse.json({ message: "Failed to fetch stock movements" }, { status: 500 });
    }
}
