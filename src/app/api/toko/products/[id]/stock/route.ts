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
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengubah stok" }, { status: 403 });
        }

        const userId = parseInt(session.user.id);

        const { id: idStr } = await context.params;
        const productId = parseInt(idStr);
        if (isNaN(productId)) {
            return NextResponse.json({ message: "ID produk tidak valid" }, { status: 400 });
        }

        const body = await request.json();
        const { type, quantity, notes, location } = body;
        // location: "gudang" (default) | "toko"
        const stockLocation = location === "toko" ? "toko" : "gudang";

        if (!type || !["in", "out", "transfer"].includes(type)) {
            return NextResponse.json({ message: "Jenis pergerakan stok tidak valid (in/out/transfer)" }, { status: 400 });
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

        // Hitung perubahan stok berdasarkan lokasi
        let newStockGdg = product.stockGdg;
        let newStockToko = product.stockToko;

        if (type === "transfer") {
            // Transfer: gudang→toko (default) atau toko→gudang
            const from = location === "toko" ? "toko" : "gudang";
            const to = from === "gudang" ? "toko" : "gudang";

            if (from === "gudang") {
                if (product.stockGdg < qty) {
                    return NextResponse.json({ message: `Stok Gudang tidak cukup. Sisa: ${product.stockGdg}` }, { status: 400 });
                }
                newStockGdg = product.stockGdg - qty;
                newStockToko = product.stockToko + qty;
            } else {
                if (product.stockToko < qty) {
                    return NextResponse.json({ message: `Stok Toko tidak cukup. Sisa: ${product.stockToko}` }, { status: 400 });
                }
                newStockToko = product.stockToko - qty;
                newStockGdg = product.stockGdg + qty;
            }

            const newStock = newStockGdg + newStockToko;

            // Update stok produk atomik
            const updatedProduct = await prisma.storeProduct.update({
                where: { id: productId },
                data: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
            });

            // Log 2 mutasi yang saling terkait
            const refText = `Transfer ${from === "gudang" ? "Gudang → Toko" : "Toko → Gudang"}`;
            await prisma.storeStockMovement.createMany({
                data: [
                    { productId, type: "out", quantity: qty, reference: `${refText} (keluar dari ${from === "gudang" ? "Gudang" : "Toko"})`, notes: notes || null, operatorId: userId },
                    { productId, type: "in", quantity: qty, reference: `${refText} (masuk ke ${to === "toko" ? "Toko" : "Gudang"})`, notes: notes || null, operatorId: userId },
                ],
            });

            return NextResponse.json({
                data: {
                    productId, sku: updatedProduct.sku, name: updatedProduct.name,
                    previousStock: product.stockGdg + product.stockToko, currentStock: newStock,
                    stockGdg: newStockGdg, stockToko: newStockToko,
                    change: 0, type: "transfer", from, to,
                    notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString(),
                },
                message: `Transfer ${qty} unit dari ${from === "gudang" ? "Gudang" : "Toko"} ke ${to === "toko" ? "Toko" : "Gudang"} berhasil. Stok: Gudang ${newStockGdg}, Toko ${newStockToko}`,
            });
        }

        if (type === "in") {
            // Stok masuk → pilih lokasi tujuan
            if (stockLocation === "toko") {
                newStockToko = product.stockToko + qty;
            } else {
                newStockGdg = product.stockGdg + qty;
            }
        } else {
            // Stok keluar → kurangi dari lokasi yang dipilih dulu
            if (stockLocation === "toko") {
                if (product.stockToko >= qty) {
                    newStockToko = product.stockToko - qty;
                } else {
                    const sisa = qty - product.stockToko;
                    newStockToko = 0;
                    newStockGdg = Math.max(0, product.stockGdg - sisa);
                }
            } else {
                if (product.stockGdg >= qty) {
                    newStockGdg = product.stockGdg - qty;
                } else {
                    const sisa = qty - product.stockGdg;
                    newStockGdg = 0;
                    newStockToko = Math.max(0, product.stockToko - sisa);
                }
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
                reference: type === "in" ? `Penambahan Manual (${stockLocation === "toko" ? "Toko" : "Gudang"})` : `Pengurangan Manual (${stockLocation === "toko" ? "Toko" : "Gudang"})`,
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
