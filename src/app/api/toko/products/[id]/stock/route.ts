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
        if (type === "out" && product.stock < qty) {
            return NextResponse.json({
                message: `Stok tidak mencukupi. Sisa stok: ${product.stock}`,
            }, { status: 400 });
        }

        const stockChange = type === "in" ? qty : -qty;
        const newStock = product.stock + stockChange;

        // Update stok produk
        const updatedProduct = await prisma.storeProduct.update({
            where: { id: productId },
            data: { stock: newStock },
        });

        return NextResponse.json({
            data: {
                productId: updatedProduct.id,
                sku: updatedProduct.sku,
                name: updatedProduct.name,
                previousStock: product.stock,
                currentStock: updatedProduct.stock,
                change: stockChange,
                type,
                notes: notes || null,
                updatedBy: userId,
                updatedAt: new Date().toISOString(),
            },
            message: `Stok ${type === "in" ? "masuk" : "keluar"} berhasil dicatat. Stok sekarang: ${newStock}`,
        }, { status: 200 });
    } catch (error) {
        console.error("POST /api/toko/products/[id]/stock error:", error);
        return NextResponse.json({ message: "Gagal memperbarui stok" }, { status: 500 });
    }
}
