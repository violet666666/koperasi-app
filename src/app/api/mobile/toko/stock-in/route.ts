import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

export async function POST(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();
        if (!["operator", "admin", "kasir"].includes(user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { productId, quantity, purchasePrice, batchNo, expiryDate, supplierName } = body;

        if (!productId || !quantity || quantity <= 0) {
            return NextResponse.json({ message: "Produk dan jumlah wajib diisi" }, { status: 400 });
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

        return NextResponse.json({ data: result, message: "Stok masuk berhasil" });
    } catch (error) {
        console.error("POST /api/mobile/toko/stock-in error:", error);
        return NextResponse.json({ message: "Gagal menambah stok" }, { status: 500 });
    }
}
