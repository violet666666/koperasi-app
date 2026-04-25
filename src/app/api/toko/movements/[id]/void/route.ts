import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * POST /api/toko/movements/[id]/void
 * Batalkan (void) sebuah entry mutasi stok manual.
 * 
 * Efek:
 * - Status entry diubah ke "voided"
 * - Stok produk dikembalikan ke semula (reverse)
 * - Entry baru TIDAK dibuat — user harus input ulang jika mau koreksi
 * 
 * Hanya Operator & Admin Toko yang bisa void.
 * Entry dari penjualan otomatis (reference: "Penjualan TK-...") TIDAK BISA di-void dari sini.
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

        const role = (session.user as any).role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan membatalkan mutasi stok" }, { status: 403 });
        }

        const { id: idStr } = await context.params;
        const movementId = parseInt(idStr);
        if (isNaN(movementId)) {
            return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
        }

        // Cari entry
        const movement = await prisma.storeStockMovement.findUnique({
            where: { id: movementId },
            include: { product: { select: { id: true, name: true, stock: true, stockGdg: true, stockToko: true } } },
        });

        if (!movement) {
            return NextResponse.json({ message: "Mutasi stok tidak ditemukan" }, { status: 404 });
        }

        if (movement.status === "voided") {
            return NextResponse.json({ message: "Mutasi ini sudah dibatalkan sebelumnya" }, { status: 400 });
        }

        // Cegah void entry otomatis dari penjualan
        if (movement.reference && movement.reference.startsWith("Penjualan ")) {
            return NextResponse.json({
                message: "Mutasi dari penjualan tidak bisa dibatalkan dari sini. Gunakan fitur void transaksi di halaman kasir."
            }, { status: 400 });
        }

        const userId = Number(session.user.id);

        // Parse optional reason
        let reason = "";
        try {
            const body = await request.json();
            reason = body.reason || "";
        } catch {
            // Body kosong = tanpa alasan (opsional)
        }

        // Determine the original location from reference text
        // References like "Penambahan Manual (Gudang)" or "Pengurangan Manual (Toko)"
        const refLower = (movement.reference || "").toLowerCase();
        const fromToko = refLower.includes("toko");
        const fromGudang = refLower.includes("gudang");

        // Use interactive transaction to prevent race conditions
        await prisma.$transaction(async (tx) => {
            // Re-read product inside transaction for fresh values
            const currentProduct = await tx.storeProduct.findUnique({
                where: { id: movement.productId },
            });
            if (!currentProduct) throw new Error("Produk tidak ditemukan");

            let newStockGdg = currentProduct.stockGdg;
            let newStockToko = currentProduct.stockToko;

            if (movement.type === "in") {
                // Original was stock-in → reverse = remove from where it was added
                if (fromToko) {
                    newStockToko = Math.max(0, currentProduct.stockToko - movement.quantity);
                } else {
                    // Default: stock-in went to gudang
                    newStockGdg = Math.max(0, currentProduct.stockGdg - movement.quantity);
                }
            } else {
                // Original was stock-out → reverse = add back to where it was taken from
                if (fromGudang) {
                    newStockGdg = currentProduct.stockGdg + movement.quantity;
                } else {
                    // Default: stock-out came from toko
                    newStockToko = currentProduct.stockToko + movement.quantity;
                }
            }

            const newStock = newStockGdg + newStockToko;

            await tx.storeStockMovement.update({
                where: { id: movementId },
                data: {
                    status: "voided",
                    voidedAt: new Date(),
                    voidedById: userId,
                    notes: (movement.notes || "") + ` [DIBATALKAN oleh ${session.user.name || "user"} pada ${new Date().toLocaleString("id-ID")}${reason ? ` — Alasan: ${reason}` : ""}]`,
                },
            });

            await tx.storeProduct.update({
                where: { id: movement.productId },
                data: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
            });
        });

        return NextResponse.json({
            message: `Mutasi stok "${movement.type === "in" ? "Masuk" : "Keluar"}" sebanyak ${movement.quantity} untuk ${movement.product.name} berhasil dibatalkan. Stok dikembalikan.`,
            data: {
                movementId,
                productName: movement.product.name,
                reversedQuantity: movement.quantity,
                type: movement.type,
                newStock,
                newStockGdg,
                newStockToko,
            },
        });
    } catch (error) {
        console.error("POST /api/toko/movements/[id]/void error:", error);
        return NextResponse.json({ message: "Gagal membatalkan mutasi stok" }, { status: 500 });
    }
}
