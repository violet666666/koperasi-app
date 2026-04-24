import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET single product
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        const product = await prisma.storeProduct.findUnique({ where: { id } });
        if (!product) return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });

        return NextResponse.json({ data: product });
    } catch (error) {
        console.error("GET /api/toko/products/[id] error:", error);
        return NextResponse.json({ message: "Gagal memuat produk" }, { status: 500 });
    }
}

// PUT update product (admin/operator only)
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Only admin and operator can edit products
        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengubah produk" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        const body = await request.json();
        const updateData: Record<string, unknown> = {};

        // Fields that can be updated
        if (body.name !== undefined) updateData.name = body.name;
        if (body.sku !== undefined) updateData.sku = body.sku;
        if (body.price !== undefined) updateData.sellPrice = Number(body.price);
        if (body.costPrice !== undefined) updateData.costPrice = Number(body.costPrice);
        if (body.stock !== undefined) updateData.stock = Number(body.stock);
        if (body.stockGdg !== undefined) updateData.stockGdg = Number(body.stockGdg);
        if (body.stockToko !== undefined) updateData.stockToko = Number(body.stockToko);
        if (body.minStock !== undefined) updateData.minStock = Number(body.minStock);
        if (body.category !== undefined) updateData.category = body.category;
        if (body.unit !== undefined) updateData.unit = body.unit;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "Tidak ada data yang diubah" }, { status: 400 });
        }

        const product = await prisma.storeProduct.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ data: product, message: "Produk berhasil diperbarui" });
    } catch (error) {
        console.error("PUT /api/toko/products/[id] error:", error);
        return NextResponse.json({ message: "Gagal memperbarui produk" }, { status: 500 });
    }
}

// DELETE product (admin/operator only)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan menghapus produk" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        await prisma.storeProduct.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ message: "Produk berhasil dinonaktifkan" });
    } catch (error) {
        console.error("DELETE /api/toko/products/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus produk" }, { status: 500 });
    }
}
