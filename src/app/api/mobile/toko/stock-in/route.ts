import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../middleware";
import { logAudit } from "@/lib/audit-logger";
import { canAccessUnit } from "@/lib/mobile-auth-scope";

export async function POST(request: Request) {
    try {
        const user = await getMobileUserWithScope(request);
        if (!user) return unauthorizedResponse();
        if (!["operator", "admin", "kasir"].includes(user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { productId, quantity, purchasePrice, batchNo, expiryDate, supplierName } = body;

        if (!productId || !quantity || quantity <= 0) {
            return NextResponse.json({ message: "Produk dan jumlah wajib diisi" }, { status: 400 });
        }

        // ── Unit-scope guard (Task 4): hoisted pre-tx read ────────────
        // The tx body re-fetches the product for the HPP update; this read
        // exists only to resolve unitType for the scope check.
        const scopeProduct = await prisma.storeProduct.findUnique({
            where: { id: productId },
            select: { id: true, unitType: true },
        });
        if (!scopeProduct) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }
        const unitOk = canAccessUnit(user, scopeProduct.unitType || "toko");
        if (!unitOk.allowed) {
            return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const product = await tx.storeProduct.findUnique({ where: { id: productId } });
            if (!product) throw new Error("Produk tidak ditemukan");

            const oldStock = product.stock || 0;
            const oldCost = Number(product.costPrice) || 0;
            const newStock = oldStock + quantity;

            if (purchasePrice && purchasePrice > 0) {
                // HPP Moving Average only when purchase price is provided
                const newCostPrice = (oldStock * oldCost + quantity * purchasePrice) / newStock;

                await tx.storeProduct.update({
                    where: { id: productId },
                    data: {
                        stockGdg: { increment: quantity },
                        stock: newStock,
                        costPrice: Math.round(newCostPrice),
                    },
                });

                // Stock movement record
                await tx.storeStockMovement.create({
                    data: {
                        productId,
                        type: "in",
                        quantity,
                        reason: "stock_in",
                        reasonNote: `Stok masuk via Mobile oleh ${user.name}`,
                        costAtTime: Math.round(newCostPrice),
                        operatorId: parseInt(user.id),
                    },
                });

                // Create batch if batchNo provided
                if (batchNo) {
                    await tx.stockBatch.create({
                        data: {
                            productId,
                            batchNo,
                            purchasePrice,
                            quantity,
                            originalQuantity: quantity,
                            expiryDate: expiryDate ? new Date(expiryDate) : null,
                            supplierName: supplierName || null,
                            isActive: true,
                            unitType: product.unitType || "toko",
                        },
                    });
                }

                return { newStock, newCostPrice: Math.round(newCostPrice) };
            } else {
                // No purchase price — just update stock, don't recalculate HPP
                await tx.storeProduct.update({
                    where: { id: productId },
                    data: {
                        stockGdg: { increment: quantity },
                        stock: newStock,
                    },
                });

                await tx.storeStockMovement.create({
                    data: {
                        productId,
                        type: "in",
                        quantity,
                        reason: "stock_in",
                        reasonNote: `Stok masuk via Mobile oleh ${user.name} (tanpa HPP)`,
                        costAtTime: oldCost,
                        operatorId: parseInt(user.id),
                    },
                });

                return { newStock, newCostPrice: oldCost };
            }
        });

        // Audit log
        try {
            await logAudit({
                userId: parseInt(user.id),
                userName: user.name,
                userRole: user.role,
                action: "UPDATE",
                module: "Toko",
                description: `Stok masuk (Mobile) +${quantity} unit produk #${productId}${purchasePrice ? `, HPP: Rp ${purchasePrice.toLocaleString()}` : ""}`,
                targetId: productId,
                targetType: "StoreProduct",
                newData: { newStock: result.newStock, costPrice: result.newCostPrice },
                metadata: { type: "stock_in", source: "mobile", quantity, productId, purchasePrice: purchasePrice || null, batchNo: batchNo || null },
                unitType: "toko",
            });
        } catch (e) { /* audit failure must not break response */ }

        return NextResponse.json({ data: result, message: "Stok masuk berhasil" });
    } catch (error) {
        console.error("POST /api/mobile/toko/stock-in error:", error);
        return NextResponse.json({ message: "Gagal menambah stok" }, { status: 500 });
    }
}
