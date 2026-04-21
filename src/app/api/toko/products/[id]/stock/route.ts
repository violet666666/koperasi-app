import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * FIX K-2: API Penyesuaian Stok Produk Toko
 * POST /api/toko/products/[id]/stock
 *
 * Body: { type: "in" | "out", quantity: number, notes?: string }
 *
 * - type "in"  : Stok Masuk (pembelian dari supplier, retur, dll)
 * - type "out" : Stok Keluar Manual (rusak, hilang, koreksi)
 *
 * Versi sebelumnya: TIDAK BISA (tombol UI tidak terhubung ke API apapun)
 * Setelah fix: Database diupdate langsung dan riwayat pergerakan bisa dilacak
 */
export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        const userId = session?.user?.id ? parseInt(session.user.id) : 1;

        const { id: idStr } = await context.params;
        const productId = parseInt(idStr);
        if (isNaN(productId)) {
            return NextResponse.json({ message: "ID produk tidak valid" }, { status: 400 });
        }

        const body = await request.json();
        const { type, quantity, notes } = body;

        if (!type || !["in", "out"].includes(type)) {
            return NextResponse.json({ message: "Jenis pergerakan stok tidak valid (in/out)" }, { status: 400 });
        }

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        // Cek produk ada
        const product = await prisma.storeProduct.findUnique({ where: { id: productId, deletedAt: null } });
        if (!product) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        // Validasi stok tidak minus untuk stok keluar
        const effectiveStock = product.stockGdg + product.stockToko;
        if (type === "out" && effectiveStock < qty) {
            return NextResponse.json({
                message: `Stok tidak mencukupi. Sisa stok: ${effectiveStock}`,
            }, { status: 400 });
        }

        // Hitung perubahan stok
        // Stok MASUK → masuk ke stockGdg (gudang/supplier)
        // Stok KELUAR → kurangi dari stockToko dulu, lalu stockGdg jika kurang
        let newStockGdg = product.stockGdg;
        let newStockToko = product.stockToko;

        if (type === "in") {
            newStockGdg = product.stockGdg + qty;
        } else {
            // Kurangi dari stockToko dulu
            if (product.stockToko >= qty) {
                newStockToko = product.stockToko - qty;
            } else {
                const sisaFromToko = product.stockToko;
                const kurangDariGdg = qty - sisaFromToko;
                newStockToko = 0;
                newStockGdg = Math.max(0, product.stockGdg - kurangDariGdg);
            }
        }

        const newStock = newStockGdg + newStockToko;

        // Update stok produk — SELALU sinkron ketiga field
        const updatedProduct = await prisma.storeProduct.update({
            where: { id: productId },
            data: {
                stock: newStock,
                stockGdg: newStockGdg,
                stockToko: newStockToko,
            },
        });

        // Insert log mutasi
        await prisma.storeStockMovement.create({
            data: {
                productId: updatedProduct.id,
                type: type,
                quantity: qty,
                reference: type === "in" ? "Penambahan Manual" : "Pengurangan Manual",
                notes: notes || null,
                operatorId: userId
            }
        });

        return NextResponse.json({
            data: {
                productId: updatedProduct.id,
                sku: updatedProduct.sku,
                name: updatedProduct.name,
                previousStock: product.stockGdg + product.stockToko,
                currentStock: newStock,
                stockGdg: newStockGdg,
                stockToko: newStockToko,
                change: type === "in" ? qty : -qty,
                type,
                notes: notes || null,
                updatedBy: userId,
                updatedAt: new Date().toISOString(),
            },
            message: `Stok ${type === "in" ? "masuk" : "keluar"} berhasil dicatat. Stok sekarang: ${newStock} (Gudang: ${newStockGdg}, Toko: ${newStockToko})`,
        }, { status: 200 });
    } catch (error) {
        console.error("POST /api/toko/products/[id]/stock error:", error);
        return NextResponse.json({ message: "Gagal memperbarui stok" }, { status: 500 });
    }
}
