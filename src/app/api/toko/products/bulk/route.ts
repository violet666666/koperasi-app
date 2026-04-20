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
 *   action: "zero_stock" | "zero_price" | "zero_all" | "set_stock" | "set_price" | "deactivate" | "activate",
 *   value?: number  // untuk set_stock dan set_price
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

        const body = await request.json();
        const { ids, action, value } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: "Pilih minimal 1 produk" }, { status: 400 });
        }

        if (!action) {
            return NextResponse.json({ message: "Aksi tidak valid" }, { status: 400 });
        }

        let updateData: Record<string, unknown> = {};
        let actionLabel = "";

        switch (action) {
            case "zero_stock":
                updateData = { stock: 0, stockGdg: 0, stockToko: 0 };
                actionLabel = "Stok dinolkan";
                break;
            case "zero_price":
                updateData = { price: 0, costPrice: 0 };
                actionLabel = "Harga dinolkan";
                break;
            case "zero_all":
                updateData = { stock: 0, stockGdg: 0, stockToko: 0, price: 0, costPrice: 0 };
                actionLabel = "Stok & harga dinolkan";
                break;
            case "set_stock":
                if (value === undefined || value === null) {
                    return NextResponse.json({ message: "Nilai stok harus diisi" }, { status: 400 });
                }
                updateData = { stock: Number(value), stockToko: Number(value), stockGdg: 0 };
                actionLabel = `Stok diset ke ${value}`;
                break;
            case "set_price":
                if (value === undefined || value === null) {
                    return NextResponse.json({ message: "Nilai harga harus diisi" }, { status: 400 });
                }
                updateData = { price: Number(value) };
                actionLabel = `Harga diset ke ${value}`;
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

        const result = await prisma.shopProduct.updateMany({
            where: { id: { in: ids.map(Number) } },
            data: updateData,
        });

        return NextResponse.json({
            message: `${actionLabel} untuk ${result.count} produk`,
            data: { count: result.count },
        });
    } catch (error) {
        console.error("PUT /api/toko/products/bulk error:", error);
        return NextResponse.json({ message: "Gagal memproses aksi massal" }, { status: 500 });
    }
}
