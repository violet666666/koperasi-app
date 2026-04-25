import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * PUT /api/toko/products/bulk
 * Bulk update products — admin/operator only
 *
 * Body:
 * {
 *   ids: number[],
 *   action: "zero_stock" | "zero_price" | "zero_all" | "set_stock" | "set_price" | "set_category" | "deactivate" | "activate",
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
        const body = await request.json();
        const { ids, action, value, category } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: "Pilih minimal 1 produk" }, { status: 400 });
        }

        if (!action) {
            return NextResponse.json({ message: "Aksi tidak valid" }, { status: 400 });
        }

        const numericIds = ids.map(Number);
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
            case "set_stock":
                if (value === undefined || value === null) {
                    return NextResponse.json({ message: "Nilai stok harus diisi" }, { status: 400 });
                }
                if (Number(value) < 0) {
                    return NextResponse.json({ message: "Stok tidak boleh negatif" }, { status: 400 });
                }
                // Preserve stockGdg/stockToko distribution when setting stock
                // Read current products first to maintain ratio
                const productsForSet = await prisma.storeProduct.findMany({
                    where: { id: { in: numericIds } },
                    select: { id: true, stockGdg: true, stockToko: true, stock: true },
                });
                const newStockVal = Number(value);
                for (const p of productsForSet) {
                    const totalCurrent = p.stock || 1;
                    const gdgRatio = Number(p.stockGdg) / totalCurrent;
                    const newGdg = Math.round(newStockVal * gdgRatio);
                    const newToko = newStockVal - newGdg;
                    await prisma.storeProduct.update({
                        where: { id: p.id },
                        data: { stock: newStockVal, stockGdg: newGdg, stockToko: newToko },
                    });
                    // Create movement record
                    await prisma.storeStockMovement.create({
                        data: {
                            productId: p.id, type: "in", quantity: newStockVal,
                            reference: `Set Stok Massal ke ${newStockVal}`,
                            notes: `Sebelumnya: ${p.stock}`, operatorId: userId,
                        },
                    });
                }
                return NextResponse.json({
                    message: `Stok diset ke ${value} untuk ${productsForSet.length} produk`,
                    data: { count: productsForSet.length },
                });
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
            where: { id: { in: numericIds } },
            data: updateData,
        });

        // Create stock movement records for stock-changing bulk actions
        if (isStockAction) {
            const affectedProducts = await prisma.storeProduct.findMany({
                where: { id: { in: numericIds } },
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
