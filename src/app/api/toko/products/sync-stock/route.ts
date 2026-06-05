import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { storeSaleUnitTypeFilter } from "@/lib/constants/units";

/**
 * POST /api/toko/products/sync-stock
 * 
 * Sinkronisasi field `stock` (total) agar = stockGdg + stockToko
 * untuk SEMUA produk yang datanya tidak konsisten.
 * 
 * Hanya operator yang dapat menjalankan ini.
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role !== "operator") {
            return NextResponse.json({ message: "Hanya operator yang dapat menjalankan sinkronisasi stok" }, { status: 403 });
        }

        // Ambil semua produk aktif — filter by unit
        const unitType = (session.user as any).unitType || "toko";
        const allProducts = await prisma.storeProduct.findMany({
            where: { deletedAt: null, unitType: storeSaleUnitTypeFilter(unitType) },
            select: { id: true, stock: true, stockGdg: true, stockToko: true, name: true, sku: true },
        });

        // Filter yang tidak sinkron: stock != stockGdg + stockToko
        const outOfSync = allProducts.filter(p => p.stock !== (p.stockGdg + p.stockToko));

        if (outOfSync.length === 0) {
            return NextResponse.json({
                message: "Semua produk sudah sinkron. Tidak ada yang perlu diperbaiki.",
                data: { fixed: 0, total: allProducts.length },
            });
        }

        // Fix setiap produk yang tidak sinkron
        const fixes: { id: number; sku: string; name: string; before: { stock: number; stockGdg: number; stockToko: number }; after: number }[] = [];

        for (const p of outOfSync) {
            const correctTotal = p.stockGdg + p.stockToko;
            await prisma.storeProduct.update({
                where: { id: p.id },
                data: { stock: correctTotal },
            });
            fixes.push({
                id: p.id,
                sku: p.sku,
                name: p.name,
                before: { stock: p.stock, stockGdg: p.stockGdg, stockToko: p.stockToko },
                after: correctTotal,
            });
        }

        return NextResponse.json({
            message: `${fixes.length} produk berhasil disinkronkan dari total ${allProducts.length} produk.`,
            data: {
                fixed: fixes.length,
                total: allProducts.length,
                details: fixes.slice(0, 50), // Tampilkan max 50 detail
            },
        });
    } catch (error) {
        console.error("POST /api/toko/products/sync-stock error:", error);
        return NextResponse.json({ message: "Gagal menjalankan sinkronisasi stok" }, { status: 500 });
    }
}
