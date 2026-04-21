import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/toko/products/recalculate-prices
 * 
 * Hitung ulang harga jual SEMUA produk berdasarkan formula:
 *   sellPrice = ceil((costPrice * 1.02 * 1.11) / 100) * 100
 * 
 * Hanya produk dengan costPrice > 0 yang dihitung ulang.
 * Produk dengan costPrice = 0 akan dilewati (harga tetap).
 * 
 * Query params:
 *   ?preview=true  → Hanya tampilkan preview perubahan, TIDAK simpan ke DB
 *   ?preview=false  → Simpan perubahan ke DB (default)
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan menghitung ulang harga" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const isPreview = searchParams.get("preview") === "true";

        // Ambil semua produk aktif dengan costPrice > 0
        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                costPrice: { gt: 0 },
            },
            select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                sellPrice: true,
            },
            orderBy: { name: "asc" },
        });

        const changes: {
            id: number;
            sku: string;
            name: string;
            costPrice: number;
            oldSellPrice: number;
            newSellPrice: number;
            changed: boolean;
        }[] = [];

        let updatedCount = 0;
        let skippedCount = 0;

        for (const p of products) {
            const hpp = Number(p.costPrice);
            const currentSellPrice = Number(p.sellPrice);
            // Formula: ceil((HPP * 1.02 * 1.11) / 100) * 100
            const newSellPrice = Math.ceil((hpp * 1.02 * 1.11) / 100) * 100;

            const changed = currentSellPrice !== newSellPrice;

            changes.push({
                id: p.id,
                sku: p.sku,
                name: p.name,
                costPrice: hpp,
                oldSellPrice: currentSellPrice,
                newSellPrice,
                changed,
            });

            if (changed) {
                updatedCount++;
            } else {
                skippedCount++;
            }
        }

        // Jika bukan preview, update ke DB
        if (!isPreview) {
            const toUpdate = changes.filter(c => c.changed);
            const BATCH_SIZE = 100;

            for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
                const batch = toUpdate.slice(i, i + BATCH_SIZE);
                await Promise.all(
                    batch.map(item =>
                        prisma.storeProduct.update({
                            where: { id: item.id },
                            data: { sellPrice: item.newSellPrice },
                        })
                    )
                );
            }
        }

        // Ambil juga produk tanpa HPP (costPrice = 0)
        const noCostPrice = await prisma.storeProduct.count({
            where: { deletedAt: null, costPrice: { lte: 0 } },
        });

        return NextResponse.json({
            message: isPreview
                ? `Preview: ${updatedCount} produk akan diupdate harga jualnya. ${skippedCount} sudah sesuai.`
                : `${updatedCount} produk berhasil diupdate harga jualnya. ${skippedCount} sudah sesuai formula.`,
            data: {
                mode: isPreview ? "preview" : "committed",
                formula: "ceil((HPP × 1.02 × 1.11) / 100) × 100",
                totalWithHPP: products.length,
                updated: updatedCount,
                alreadyCorrect: skippedCount,
                noHPP: noCostPrice,
                changes: changes.filter(c => c.changed).slice(0, 100), // Max 100 untuk response
            },
        });
    } catch (error) {
        console.error("POST /api/toko/products/recalculate-prices error:", error);
        return NextResponse.json({ message: "Gagal menghitung ulang harga" }, { status: 500 });
    }
}
