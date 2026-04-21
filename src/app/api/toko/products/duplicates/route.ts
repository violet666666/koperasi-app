import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/toko/products/duplicates
 * 
 * Deteksi produk duplikat berdasarkan kesamaan nama (case-insensitive,
 * abaikan spasi/angka di depan nama, dan normalisasi karakter).
 * 
 * Hanya mendeteksi — TIDAK menghapus.
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Ambil semua produk aktif
        const allProducts = await prisma.storeProduct.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                sku: true,
                name: true,
                category: true,
                stock: true,
                stockGdg: true,
                stockToko: true,
                sellPrice: true,
                costPrice: true,
                unit: true,
                isActive: true,
            },
            orderBy: { name: "asc" },
        });

        // Normalisasi nama untuk pencocokan:
        // - Lowercase
        // - Hapus angka di awal (misal "1 POP MIE" → "POP MIE")
        // - Trim spasi berlebih
        // - Hapus karakter khusus
        const normalize = (name: string): string => {
            return name
                .toLowerCase()
                .replace(/^\d+\s*/, "")       // Hapus angka di depan
                .replace(/[^a-z0-9\s]/g, "")  // Hapus karakter khusus
                .replace(/\s+/g, " ")          // Normalize spasi
                .trim();
        };

        // Group by normalized name
        const groups = new Map<string, typeof allProducts>();
        for (const p of allProducts) {
            const key = normalize(p.name);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(p);
        }

        // Filter hanya yang punya > 1 produk (duplikat)
        const duplicateGroups: {
            normalizedName: string;
            count: number;
            products: {
                id: number;
                sku: string;
                name: string;
                category: string | null;
                stockGdg: number;
                stockToko: number;
                totalStock: number;
                sellPrice: number;
                costPrice: number;
                isActive: boolean;
            }[];
        }[] = [];

        for (const [key, prods] of groups) {
            if (prods.length > 1) {
                duplicateGroups.push({
                    normalizedName: key,
                    count: prods.length,
                    products: prods.map(p => ({
                        id: p.id,
                        sku: p.sku,
                        name: p.name,
                        category: p.category,
                        stockGdg: p.stockGdg,
                        stockToko: p.stockToko,
                        totalStock: p.stockGdg + p.stockToko,
                        sellPrice: Number(p.sellPrice),
                        costPrice: Number(p.costPrice),
                        isActive: p.isActive,
                    })),
                });
            }
        }

        // Urutkan berdasarkan jumlah duplikat terbanyak
        duplicateGroups.sort((a, b) => b.count - a.count);

        return NextResponse.json({
            message: `Ditemukan ${duplicateGroups.length} grup produk duplikat dari total ${allProducts.length} produk.`,
            data: {
                totalProducts: allProducts.length,
                duplicateGroups: duplicateGroups.length,
                totalDuplicateProducts: duplicateGroups.reduce((sum, g) => sum + g.count, 0),
                groups: duplicateGroups,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/products/duplicates error:", error);
        return NextResponse.json({ message: "Gagal mendeteksi duplikasi produk" }, { status: 500 });
    }
}
