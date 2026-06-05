import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { storeSaleUnitTypeFilter } from "@/lib/constants/units";

/**
 * PUT /api/toko/products/bulk
 * Bulk update products — admin/operator only
 *
 * Body:
 * {
 *   ids: number[],
 *   action: "zero_stock" | "zero_price" | "zero_all" | "set_stock" | "set_price" | "set_category" | "set_unit" | "deactivate" | "activate",
 *   value?: number | string  // untuk set_stock, set_price, set_category
 * }
 */
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan melakukan aksi massal" }, { status: 403 });
        }

        const userId = Number(session.user.id);
        const unitType = (session.user as any).unitType || "toko";
        const body = await request.json();
        const { ids, action, value, category, stockGdg, stockToko } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: "Pilih minimal 1 produk" }, { status: 400 });
        }

        if (!action) {
            return NextResponse.json({ message: "Aksi tidak valid" }, { status: 400 });
        }

        const numericIds = ids.map(Number);

        // Validate all products belong to the user's unit (use alias-aware filter)
        const unitFilter = storeSaleUnitTypeFilter(unitType);
        const unitProducts = await prisma.storeProduct.findMany({
            where: { id: { in: numericIds }, unitType: unitFilter },
            select: { id: true },
        });
        const validIds = unitProducts.map(p => p.id);
        if (validIds.length === 0) {
            return NextResponse.json({ message: "Tidak ada produk valid di unit Anda" }, { status: 400 });
        }

        let updateData: Record<string, unknown> = {};
        let actionLabel = "";
        let isStockAction = false;

        switch (action) {
            case "zero_stock":
                updateData = { stock: 0, stockGdg: 0, stockToko: 0 };
                actionLabel = "Stok dinolkan";
                isStockAction = true;
                break;
            case "zero_price":
                updateData = { sellPrice: 0, costPrice: 0 };
                actionLabel = "Harga dinolkan";
                break;
            case "zero_all":
                updateData = { stock: 0, stockGdg: 0, stockToko: 0, sellPrice: 0, costPrice: 0 };
                actionLabel = "Stok & harga dinolkan";
                isStockAction = true;
                break;
            case "set_stock": {
                // Support both old format (single value) and new format (separate stockGdg/stockToko)
                const hasSeparate = stockGdg !== undefined || stockToko !== undefined;
                const gdgVal = stockGdg !== undefined ? Number(stockGdg) : undefined;
                const tokoVal = stockToko !== undefined ? Number(stockToko) : undefined;
                const totalVal = value !== undefined ? Number(value) : undefined;

                if (hasSeparate) {
                    if ((gdgVal !== undefined && (isNaN(gdgVal) || gdgVal < 0)) ||
                        (tokoVal !== undefined && (isNaN(tokoVal) || tokoVal < 0))) {
                        return NextResponse.json({ message: "Nilai stok tidak valid" }, { status: 400 });
                    }
                } else if (totalVal === undefined || isNaN(totalVal) || totalVal < 0) {
                    return NextResponse.json({ message: "Nilai stok harus diisi" }, { status: 400 });
                }

                const productsForSet = await prisma.storeProduct.findMany({
                    where: { id: { in: validIds } },
                    select: { id: true, stockGdg: true, stockToko: true, stock: true },
                });

                await prisma.$transaction(async (tx) => {
                    for (const p of productsForSet) {
                        let newGdg: number, newToko: number;

                        if (hasSeparate) {
                            // New format: use provided values, keep existing for omitted fields
                            newGdg = gdgVal !== undefined ? gdgVal : Number(p.stockGdg);
                            newToko = tokoVal !== undefined ? tokoVal : Number(p.stockToko);
                        } else {
                            // Legacy format: distribute total proportionally
                            const newStockVal = totalVal!;
                            const totalCurrent = Number(p.stockGdg) + Number(p.stockToko);
                            if (totalCurrent === 0) {
                                newGdg = newStockVal;
                                newToko = 0;
                            } else {
                                const gdgRatio = Number(p.stockGdg) / totalCurrent;
                                newGdg = Math.round(newStockVal * gdgRatio);
                                newToko = newStockVal - newGdg;
                            }
                        }

                        const newTotal = newGdg + newToko;
                        const diff = newTotal - (p.stock || 0);

                        await tx.storeProduct.update({
                            where: { id: p.id },
                            data: { stock: newTotal, stockGdg: newGdg, stockToko: newToko },
                        });

                        if (diff !== 0) {
                            await tx.storeStockMovement.create({
                                data: {
                                    productId: p.id,
                                    type: diff > 0 ? "in" : "out",
                                    quantity: Math.abs(diff),
                                    reference: `Set Stok Massal (Gdg:${newGdg}, Toko:${newToko})`,
                                    notes: `Sebelumnya: Gdg=${p.stockGdg}, Toko=${p.stockToko}`,
                                    operatorId: userId,
                                },
                            });
                        }
                    }
                });

                const desc = hasSeparate
                    ? `Stok diset (Gudang: ${gdgVal ?? 'tetap'}, Toko: ${tokoVal ?? 'tetap'}) untuk ${productsForSet.length} produk`
                    : `Stok diset ke ${totalVal} untuk ${productsForSet.length} produk`;
                return NextResponse.json({
                    message: desc,
                    data: { count: productsForSet.length },
                });
            }
            case "set_price":
                if (value === undefined || value === null) {
                    return NextResponse.json({ message: "Nilai harga harus diisi" }, { status: 400 });
                }
                if (Number(value) < 0) {
                    return NextResponse.json({ message: "Harga tidak boleh negatif" }, { status: 400 });
                }
                updateData = { sellPrice: Number(value) };
                actionLabel = `Harga diset ke ${value}`;
                break;
            case "set_category":
                const categoryValue = category || value;
                if (!categoryValue || typeof categoryValue !== "string" || !categoryValue.trim()) {
                    return NextResponse.json({ message: "Kategori harus diisi" }, { status: 400 });
                }
                updateData = { category: categoryValue.trim() };
                actionLabel = `Kategori diset ke "${categoryValue.trim()}"`;
                break;
            case "set_unit":
                const unitValue = typeof value === "string" ? value.trim() : "";
                if (!unitValue) {
                    return NextResponse.json({ message: "Satuan harus diisi" }, { status: 400 });
                }
                updateData = { unit: unitValue };
                actionLabel = `Satuan diset ke "${unitValue}"`;
                break;
            case "deactivate":
                updateData = { isActive: false };
                actionLabel = "Produk dinonaktifkan";
                break;
            case "activate":
                updateData = { isActive: true };
                actionLabel = "Produk diaktifkan";
                break;
            default:
                return NextResponse.json({ message: `Aksi '${action}' tidak dikenal` }, { status: 400 });
        }

        const result = await prisma.storeProduct.updateMany({
            where: { id: { in: validIds } },
            data: updateData,
        });

        // Create stock movement records for stock-changing bulk actions
        if (isStockAction) {
            const affectedProducts = await prisma.storeProduct.findMany({
                where: { id: { in: validIds } },
                select: { id: true },
            });
            await prisma.storeStockMovement.createMany({
                data: affectedProducts.map((p) => ({
                    productId: p.id,
                    type: "in",
                    quantity: 0,
                    reference: `Aksi Massal: ${actionLabel}`,
                    notes: `Otomatis dari bulk action`,
                    operatorId: userId,
                })),
            });
        }

        return NextResponse.json({
            message: `${actionLabel} untuk ${result.count} produk`,
            data: { count: result.count },
        });
    } catch (error) {
        console.error("PUT /api/toko/products/bulk error:", error);
        return NextResponse.json({ message: "Gagal memproses aksi massal" }, { status: 500 });
    }
}
