import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification, getNotificationRecipients } from "@/lib/notifications";
import { logAuditFromRequest } from "@/lib/audit-logger";
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
            const refText = `Transfer ${from === "gudang" ? "Gudang → Toko" : "Toko → Gudang"}`;

            const updatedProduct = await prisma.$transaction(async (tx) => {
                const updated = await tx.storeProduct.update({
                    where: { id: productId },
                    data: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
                });
                await tx.storeStockMovement.createMany({
                    data: [
                        { productId, type: "out", quantity: qty, reference: `${refText} (keluar dari ${from === "gudang" ? "Gudang" : "Toko"})`, notes: notes || null, operatorId: userId, reason: "transfer" },
                        { productId, type: "in", quantity: qty, reference: `${refText} (masuk ke ${to === "toko" ? "Toko" : "Gudang"})`, notes: notes || null, operatorId: userId, reason: "transfer" },
                    ],
                });
                return updated;
            });

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "UPDATE",
                    module: "Toko",
                    description: `Transfer stok ${qty} unit ${product.name} (${from === "gudang" ? "Gudang → Toko" : "Toko → Gudang"})`,
                    targetId: productId,
                    targetType: "StoreProduct",
                    oldData: { stock: effectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko },
                    newData: { stock: newStock, stockGdg: newStockGdg, stockToko: newStockToko },
                    metadata: { type: "transfer", quantity: qty, from, to, notes: notes || null },
                    unitType: product.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                data: { productId, sku: updatedProduct.sku, name: updatedProduct.name, previousStock: effectiveStock, currentStock: newStock, stockGdg: newStockGdg, stockToko: newStockToko, change: 0, type: "transfer", from, to, notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString() },
                message: `Transfer ${qty} unit berhasil. Stok: Gudang ${newStockGdg}, Toko ${newStockToko}`,
            });
        }

        // ─── STOCK IN (with HPP Moving Average + StockBatch) ───
        if (type === "in") {
            const hargaBeli = purchasePrice ? parseFloat(purchasePrice) : null;

            // Create StockBatch + update product + log movement in transaction
            // Product data is re-read inside the transaction to prevent stale HPP calculation
            const result = await prisma.$transaction(async (tx) => {
                // Re-read product inside transaction for accurate HPP calculation
                const freshProduct = await tx.storeProduct.findUnique({ where: { id: productId, deletedAt: null } });
                if (!freshProduct) throw new Error("Produk tidak ditemukan");

                const freshEffectiveStock = freshProduct.stockGdg + freshProduct.stockToko;
                let freshStockGdg = freshProduct.stockGdg;
                let freshStockToko = freshProduct.stockToko;

                if (stockLocation === "toko") {
                    freshStockToko = freshProduct.stockToko + qty;
                } else {
                    freshStockGdg = freshProduct.stockGdg + qty;
                }
                const freshNewStock = freshStockGdg + freshStockToko;

                // Snapshot costPrice from fresh data
                const costBefore = Number(freshProduct.costPrice) || 0;

                // Check excluded categories
                const isExcluded = await isExcludedCategory(freshProduct.unitType, freshProduct.category);

                let newCostPrice = costBefore;
                let newSellPrice = Number(freshProduct.sellPrice);

                if (hargaBeli && hargaBeli > 0 && !isExcluded && costBefore > 0) {
                    // HPP Moving Average formula
                    newCostPrice = (freshEffectiveStock * costBefore + qty * hargaBeli) / (freshEffectiveStock + qty);
                    newSellPrice = await calculateSellPrice(newCostPrice, freshProduct.unitType);
                } else if (hargaBeli && hargaBeli > 0 && !isExcluded && costBefore === 0) {
                    // First purchase — set directly
                    newCostPrice = hargaBeli;
                    newSellPrice = await calculateSellPrice(newCostPrice, freshProduct.unitType);
                }

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
                        unitType: freshProduct.unitType,
                        notes: notes || null,
                    },
                });

                // Update product stock + costPrice
                const updated = await tx.storeProduct.update({
                    where: { id: productId },
                    data: {
                        stock: freshNewStock,
                        stockGdg: freshStockGdg,
                        stockToko: freshStockToko,
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

                return { updated, batch, freshEffectiveStock, freshNewStock, freshStockGdg, freshStockToko, newCostPrice, newSellPrice };
            });

            // Notify admins about stock-in
            try {
                const adminIds = await getNotificationRecipients(product.unitType);
                if (adminIds.length > 0) {
                    await createNotification({
                        userId: adminIds,
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
                                userId: adminIds,
                                type: "expiring_soon",
                                title: "Batch Hampir Expired",
                                message: `${product.name} batch ${result.batch.batchNo || result.batch.id} — expired dalam ${daysUntilExpiry} hari`,
                                data: { batchId: result.batch.id, productId, daysLeft: daysUntilExpiry, unitType: product.unitType },
                            });
                        }
                    }
                }
            } catch (e) { /* non-critical */ }

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "UPDATE",
                    module: "Toko",
                    description: `Stok masuk +${qty} unit ${product.name} (${stockLocation})${hargaBeli ? `, HPP: Rp ${Math.round(result.newCostPrice).toLocaleString()}` : ""}`,
                    targetId: productId,
                    targetType: "StoreProduct",
                    oldData: { stock: result.freshEffectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko, costPrice: Number(product.costPrice) },
                    newData: { stock: result.freshNewStock, stockGdg: result.freshStockGdg, stockToko: result.freshStockToko, costPrice: Math.round(result.newCostPrice) },
                    metadata: { type: "stock_in", quantity: qty, location: stockLocation, purchasePrice: hargaBeli || null, batchNo: result.batch.batchNo, supplierName: supplierName || null },
                    unitType: product.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                data: {
                    productId, sku: result.updated.sku, name: result.updated.name,
                    previousStock: result.freshEffectiveStock, currentStock: result.freshNewStock,
                    stockGdg: result.freshStockGdg, stockToko: result.freshStockToko,
                    change: qty, type: "in",
                    costPrice: result.newCostPrice, sellPrice: result.newSellPrice,
                    batchId: result.batch.id,
                    notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString(),
                },
                message: `Stok masuk berhasil. Stok: ${result.freshNewStock} (Gudang: ${result.freshStockGdg}, Toko: ${result.freshStockToko})${hargaBeli ? `. HPP: Rp ${Math.round(result.newCostPrice).toLocaleString()}` : ""}`,
            }, { status: 200 });
        }

        // ─── STOCK OUT / OUT_WRITEOFF ───
        // Re-read inside transaction to prevent race condition
        const costSnapshot = Number(product.costPrice) || 0;
        const movementReason = type === "out_writeoff" ? reason : "adjustment";
        const movementReasonNote = type === "out_writeoff" ? reasonNote : null;
        const refLabel = type === "out_writeoff"
            ? `Stok Keluar: ${reasonLabel(reason)} (${stockLocation === "toko" ? "Toko" : "Gudang"})`
            : `Pengurangan Manual (${stockLocation === "toko" ? "Toko" : "Gudang"})`;

        const updatedProduct = await prisma.$transaction(async (tx) => {
            // Re-read product inside transaction for accurate stock deduction
            const freshProduct = await tx.storeProduct.findUnique({ where: { id: productId, deletedAt: null } });
            if (!freshProduct) throw new Error("Produk tidak ditemukan");

            let freshStockToko = freshProduct.stockToko;
            let freshStockGdg = freshProduct.stockGdg;

            if (stockLocation === "toko") {
                if (freshProduct.stockToko >= qty) {
                    freshStockToko = freshProduct.stockToko - qty;
                } else {
                    const sisa = qty - freshProduct.stockToko;
                    freshStockToko = 0;
                    freshStockGdg = Math.max(0, freshProduct.stockGdg - sisa);
                }
            } else {
                if (freshProduct.stockGdg >= qty) {
                    freshStockGdg = freshProduct.stockGdg - qty;
                } else {
                    const sisa = qty - freshProduct.stockGdg;
                    freshStockGdg = 0;
                    freshStockToko = Math.max(0, freshProduct.stockToko - sisa);
                }
            }

            const freshNewStock = freshStockGdg + freshStockToko;

            const updated = await tx.storeProduct.update({
                where: { id: productId },
                data: { stock: freshNewStock, stockGdg: freshStockGdg, stockToko: freshStockToko },
            });
            await tx.storeStockMovement.create({
                data: {
                    productId,
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
            return { updated, freshNewStock, freshStockGdg, freshStockToko, freshEffectiveStock: freshProduct.stockGdg + freshProduct.stockToko };
        });

        // Notifications
        try {
            if (type === "out_writeoff") {
                const adminIds = await getNotificationRecipients(product.unitType);
                if (adminIds.length > 0) {
                    await createNotification({
                        userId: adminIds,
                        type: "info",
                        title: "Stok Keluar",
                        message: `${product.name}: -${qty} unit — ${reasonLabel(reason)}${reasonNote ? ` (${reasonNote})` : ""}`,
                        data: { productId, unitType: product.unitType, reason },
                    });
                }
            }

            // Low stock alert (only when toko stock was affected)
            if (updatedProduct.updated.minStock && updatedProduct.updated.minStock > 0 && stockLocation === "toko" && updatedProduct.freshStockToko <= updatedProduct.updated.minStock) {
                const adminIds = await getNotificationRecipients(updatedProduct.updated.unitType);
                if (adminIds.length > 0) {
                    await createNotification({
                        userId: adminIds,
                        type: "low_stock",
                        title: "Stok Rendah",
                        message: `${updatedProduct.updated.name}: sisa ${updatedProduct.freshStockToko} di toko (min: ${updatedProduct.updated.minStock})`,
                        data: { productId: updatedProduct.updated.id, unitType: updatedProduct.updated.unitType },
                    });
                }
            }
        } catch (e) { /* notification failure must not break response */ }

        // Audit log
        try {
            const auditAction = type === "out_writeoff" ? "DELETE" : "UPDATE";
            const auditDesc = type === "out_writeoff"
                ? `Stok keluar -${qty} unit ${product.name} (${reasonLabel(reason)}, ${stockLocation})`
                : `Pengurangan stok -${qty} unit ${product.name} (${stockLocation})`;
            await logAuditFromRequest(request, session, {
                action: auditAction,
                module: "Toko",
                description: auditDesc,
                targetId: productId,
                targetType: "StoreProduct",
                oldData: { stock: updatedProduct.freshEffectiveStock, stockGdg: product.stockGdg, stockToko: product.stockToko },
                newData: { stock: updatedProduct.freshNewStock, stockGdg: updatedProduct.freshStockGdg, stockToko: updatedProduct.freshStockToko },
                metadata: { type: type, quantity: qty, location: stockLocation, reason: movementReason, reasonNotes: movementReasonNote || null },
                unitType: product.unitType,
            });
        } catch (e) { /* audit failure must not break response */ }

        return NextResponse.json({
            data: {
                productId: updatedProduct.updated.id, sku: updatedProduct.updated.sku, name: updatedProduct.updated.name,
                previousStock: updatedProduct.freshEffectiveStock, currentStock: updatedProduct.freshNewStock,
                stockGdg: updatedProduct.freshStockGdg, stockToko: updatedProduct.freshStockToko,
                change: -qty, type, reason: movementReason, reasonNote: movementReasonNote,
                notes: notes || null, updatedBy: userId, updatedAt: new Date().toISOString(),
            },
            message: `Stok keluar berhasil dicatat. Stok sekarang: ${updatedProduct.freshNewStock} (Gudang: ${updatedProduct.freshStockGdg}, Toko: ${updatedProduct.freshStockToko})`,
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
