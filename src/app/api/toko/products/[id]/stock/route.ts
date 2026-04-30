import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

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
        const { type, quantity, notes, location, purchasePrice, batchNo, expiryDate, supplierName, reason, reasonNote } = body;
        const stockLocation = location === "toko" ? "toko" : "gudang";

        const validTypes = ["in", "out", "transfer", "out_writeoff"];
        if (!type || !validTypes.includes(type)) {
            return NextResponse.json({ message: "Jenis pergerakan stok tidak valid" }, { status: 400 });
        }

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        // out_writeoff validation
        if (type === "out_writeoff" && !reason) {
            return NextResponse.json({ message: "Alasan stok keluar wajib diisi" }, { status: 400 });
        }
        if (type === "out_writeoff" && reason === "other" && !reasonNote?.trim()) {
            return NextResponse.json({ message: "Catatan wajib diisi untuk alasan 'Lainnya'" }, { status: 400 });
        }

        const product = await prisma.storeProduct.findUnique({ where: { id: productId, deletedAt: null } });
        if (!product) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        const effectiveStock = product.stockGdg + product.stockToko;
        if ((type === "out" || type === "out_writeoff") && effectiveStock < qty) {
            return NextResponse.json({ message: `Stok tidak mencukupi. Sisa stok: ${effectiveStock}` }, { status: 400 });
        }

        let newStockGdg = product.stockGdg;
        let newStockToko = product.stockToko;

        // ─── TRANSFER ───
        if (type === "transfer") {
            const from = location === "toko" ? "toko" : "gudang";
            const to = from === "gudang" ? "toko" : "gudang";

            if (from === "gudang") {
                if (product.stockGdg < qty) return NextResponse.json({ message: `Stok Gudang tidak cukup. Sisa: ${product.stockGdg}` }, { status: 400 });
                newStockGdg = product.stockGdg - qty;
                newStockToko = product.stockToko + qty;
            } else {
                if (product.stockToko < qty) return NextResponse.json({ message: `Stok Toko tidak cukup. Sisa: ${product.stockToko}` }, { status: 400 });
                newStockToko = product.stockToko - qty;
                newStockGdg = product.stockGdg + qty;
            }

            const newStock = newStockGdg + newStockToko;
            const updatedProduct = await prisma.storeProduct.update({
                where: { id: productId },
                data: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
            });

            const refText = `Transfer ${from === "gudang" ? "Gudang → Toko" : "Toko → Gudang"}`;
            await prisma.storeStockMovement.createMany({
                data: [
                    { productId, type: "out", quantity: qty, reference: `${refText} (keluar dari ${from === "gudang" ? "Gudang" : "Toko"})`, notes: notes || null, operatorId: userId, reason: "transfer" },
                    { productId, type: "in", quantity: qty, reference: `${refText} (masuk ke ${to === "toko" ? "Toko" : "Gudang"})`, notes: notes || null, operatorId: userId, reason: "transfer" },
                ],
            });

            return NextResponse.json({
                data: { productId, sku: updatedProduct.sku, name: updatedProduct.name, previousStock: effectiveStock, currentStock: newStock, stockGdg: newStockGdg, stockToko: newStockToko, change: 0, type: "transfer", from, to, notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString() },
                message: `Transfer ${qty} unit berhasil. Stok: Gudang ${newStockGdg}, Toko ${newStockToko}`,
            });
        }

        // ─── STOCK IN (with HPP Moving Average + StockBatch) ───
        if (type === "in") {
            const hargaBeli = purchasePrice ? parseFloat(purchasePrice) : null;

            if (stockLocation === "toko") {
                newStockToko = product.stockToko + qty;
            } else {
                newStockGdg = product.stockGdg + qty;
            }
            const newStock = newStockGdg + newStockToko;

            // Snapshot costPrice before update
            const costBefore = Number(product.costPrice) || 0;

            // Check excluded categories
            const isExcluded = await isExcludedCategory(product.unitType, product.category);

            let newCostPrice = costBefore;
            let newSellPrice = Number(product.sellPrice);

            if (hargaBeli && hargaBeli > 0 && !isExcluded && costBefore > 0) {
                // HPP Moving Average formula
                newCostPrice = (effectiveStock * costBefore + qty * hargaBeli) / (effectiveStock + qty);
                newSellPrice = await calculateSellPrice(newCostPrice, product.unitType);
            } else if (hargaBeli && hargaBeli > 0 && !isExcluded && costBefore === 0) {
                // First purchase — set directly
                newCostPrice = hargaBeli;
                newSellPrice = await calculateSellPrice(newCostPrice, product.unitType);
            }

            // Create StockBatch + update product + log movement in transaction
            const result = await prisma.$transaction(async (tx) => {
                // Auto-generate batch number if not provided
                let finalBatchNo = batchNo || null;
                if (!finalBatchNo) {
                    const today = new Date();
                    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
                    const prefix = `BATCH-${dateStr}-`;
                    const todayBatches = await tx.stockBatch.findMany({
                        where: { batchNo: { startsWith: prefix } },
                        select: { batchNo: true },
                    });
                    const maxSeq = todayBatches.reduce((max, b) => {
                        const seq = parseInt(b.batchNo?.replace(prefix, "") || "0", 10);
                        return seq > max ? seq : max;
                    }, 0);
                    finalBatchNo = `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
                }

                // Create batch
                const batch = await tx.stockBatch.create({
                    data: {
                        productId,
                        batchNo: finalBatchNo,
                        purchasePrice: hargaBeli || costBefore || 0,
                        quantity: qty,
                        originalQuantity: qty,
                        expiryDate: expiryDate ? new Date(expiryDate) : null,
                        supplierName: supplierName || null,
                        location: stockLocation,
                        unitType: product.unitType,
                        notes: notes || null,
                    },
                });

                // Update product stock + costPrice
                const updated = await tx.storeProduct.update({
                    where: { id: productId },
                    data: {
                        stock: newStock,
                        stockGdg: newStockGdg,
                        stockToko: newStockToko,
                        costPrice: newCostPrice,
                        sellPrice: newSellPrice,
                    },
                });

                // Log movement
                await tx.storeStockMovement.create({
                    data: {
                        productId: updated.id,
                        type: "in",
                        quantity: qty,
                        reference: `Stok Masuk (${stockLocation === "toko" ? "Toko" : "Gudang"})`,
                        notes: notes || null,
                        operatorId: userId,
                        batchId: batch.id,
                        costAtTime: costBefore,
                        reason: "stock_in",
                    },
                });

                return { updated, batch };
            });

            // Notify admins about stock-in
            try {
                const admins = await prisma.user.findMany({
                    where: { role: { name: { in: ["admin", "operator", "super_admin"] } }, isActive: true },
                    select: { id: true },
                });
                if (admins.length > 0) {
                    await createNotification({
                        userId: admins.map((a) => a.id),
                        type: "stock_in",
                        title: "Stok Masuk",
                        message: `${product.name}: +${qty} unit${hargaBeli ? ` (HPP: Rp ${hargaBeli.toLocaleString()})` : ""} — Batch ${result.batch.batchNo || result.batch.id}`,
                        data: { productId, batchId: result.batch.id, unitType: product.unitType },
                    });

                    // Expiry warning if batch expires within 90 days
                    if (result.batch.expiryDate) {
                        const daysUntilExpiry = Math.ceil((new Date(result.batch.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysUntilExpiry > 0 && daysUntilExpiry <= 90) {
                            await createNotification({
                                userId: admins.map((a) => a.id),
                                type: "expiring_soon",
                                title: "Batch Hampir Expired",
                                message: `${product.name} batch ${result.batch.batchNo || result.batch.id} — expired dalam ${daysUntilExpiry} hari`,
                                data: { batchId: result.batch.id, productId, daysLeft: daysUntilExpiry, unitType: product.unitType },
                            });
                        }
                    }
                }
            } catch (e) { /* non-critical */ }

            return NextResponse.json({
                data: {
                    productId, sku: result.updated.sku, name: result.updated.name,
                    previousStock: effectiveStock, currentStock: newStock,
                    stockGdg: newStockGdg, stockToko: newStockToko,
                    change: qty, type: "in",
                    costPrice: newCostPrice, sellPrice: newSellPrice,
                    batchId: result.batch.id,
                    notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString(),
                },
                message: `Stok masuk berhasil. Stok: ${newStock} (Gudang: ${newStockGdg}, Toko: ${newStockToko})${!isExcluded && hargaBeli ? `. HPP: Rp ${Math.round(newCostPrice).toLocaleString()}` : ""}`,
            }, { status: 200 });
        }

        // ─── STOCK OUT / OUT_WRITEOFF ───
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

        const newStock = newStockGdg + newStockToko;
        const costSnapshot = Number(product.costPrice) || 0;

        const updatedProduct = await prisma.storeProduct.update({
            where: { id: productId },
            data: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
        });

        const movementReason = type === "out_writeoff" ? reason : "adjustment";
        const movementReasonNote = type === "out_writeoff" ? reasonNote : null;
        const refLabel = type === "out_writeoff"
            ? `Stok Keluar: ${reasonLabel(reason)} (${stockLocation === "toko" ? "Toko" : "Gudang"})`
            : `Pengurangan Manual (${stockLocation === "toko" ? "Toko" : "Gudang"})`;

        await prisma.storeStockMovement.create({
            data: {
                productId: updatedProduct.id,
                type: "out",
                quantity: qty,
                reference: refLabel,
                notes: notes || movementReasonNote || null,
                operatorId: userId,
                reason: movementReason,
                reasonNote: movementReasonNote,
                costAtTime: costSnapshot,
            },
        });

        // Notifications
        try {
            if (type === "out_writeoff") {
                const admins = await prisma.user.findMany({
                    where: { role: { name: { in: ["admin", "operator", "super_admin"] } }, isActive: true },
                    select: { id: true },
                });
                if (admins.length > 0) {
                    await createNotification({
                        userId: admins.map((a) => a.id),
                        type: "info",
                        title: "Stok Keluar",
                        message: `${product.name}: -${qty} unit — ${reasonLabel(reason)}${reasonNote ? ` (${reasonNote})` : ""}`,
                        data: { productId, unitType: product.unitType, reason },
                    });
                }
            }

            // Low stock alert
            if (updatedProduct.minStock && updatedProduct.minStock > 0 && newStockToko <= updatedProduct.minStock) {
                const admins = await prisma.user.findMany({
                    where: { role: { name: { in: ["admin", "operator", "super_admin"] } }, isActive: true },
                    select: { id: true },
                });
                if (admins.length > 0) {
                    await createNotification({
                        userId: admins.map((a) => a.id),
                        type: "low_stock",
                        title: "Stok Rendah",
                        message: `${updatedProduct.name}: sisa ${newStockToko} di toko (min: ${updatedProduct.minStock})`,
                        data: { productId: updatedProduct.id, unitType: updatedProduct.unitType },
                    });
                }
            }
        } catch (e) { /* notification failure must not break response */ }

        return NextResponse.json({
            data: {
                productId: updatedProduct.id, sku: updatedProduct.sku, name: updatedProduct.name,
                previousStock: effectiveStock, currentStock: newStock,
                stockGdg: newStockGdg, stockToko: newStockToko,
                change: -qty, type, reason: movementReason, reasonNote: movementReasonNote,
                notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString(),
            },
            message: `Stok keluar berhasil dicatat. Stok sekarang: ${newStock} (Gudang: ${newStockGdg}, Toko: ${newStockToko})`,
        }, { status: 200 });
    } catch (error) {
        console.error("POST /api/toko/products/[id]/stock error:", error);
        return NextResponse.json({ message: "Gagal memperbarui stok" }, { status: 500 });
    }
}

// ─── Helper Functions ───

function reasonLabel(reason: string): string {
    const labels: Record<string, string> = {
        damaged: "Rusak / Hilang",
        expired: "Kadaluarsa",
        internal_use: "Pemakaian Internal",
        other: "Lainnya",
    };
    return labels[reason] || reason;
}

async function isExcludedCategory(unitType: string, category: string | null): Promise<boolean> {
    if (!category) return false;
    try {
        const setting = await prisma.appSetting.findUnique({
            where: { key: `${unitType}_excluded_categories` },
        });
        if (!setting) return false;
        const excluded: string[] = JSON.parse(setting.value);
        return excluded.some((c) => c.toLowerCase() === category.toLowerCase());
    } catch {
        return false;
    }
}

async function calculateSellPrice(costPrice: number, unitType: string): Promise<number> {
    try {
        const [markupSetting, ppnSetting] = await Promise.all([
            prisma.appSetting.findUnique({ where: { key: `${unitType}_markup_percent` } }),
            prisma.appSetting.findUnique({ where: { key: `${unitType}_ppn_percent` } }),
        ]);
        const markup = parseFloat(markupSetting?.value || "2") / 100;
        const ppn = parseFloat(ppnSetting?.value || "0") / 100;
        return Math.ceil((costPrice * (1 + markup) * (1 + ppn)) / 100) * 100;
    } catch {
        return Math.ceil(costPrice * 1.02 / 100) * 100;
    }
}
