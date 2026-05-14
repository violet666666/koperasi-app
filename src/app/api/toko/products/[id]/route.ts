import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET single product
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const product = await prisma.storeProduct.findUnique({ where: { id } });
        if (!product || product.deletedAt) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

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

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengubah produk" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const existing = await prisma.storeProduct.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        const body = await request.json();
        const updateData: Record<string, unknown> = {};

        if (body.name !== undefined) updateData.name = body.name;
        if (body.sku !== undefined) {
            updateData.sku = body.sku;
            const skuConflict = await prisma.storeProduct.findFirst({
                where: { sku: body.sku, NOT: { id }, deletedAt: null, isActive: true },
            });
            if (skuConflict) {
                return NextResponse.json(
                    { message: `SKU "${body.sku}" sudah digunakan oleh produk "${skuConflict.name}"` },
                    { status: 409 }
                );
            }
        }
        if (body.price !== undefined) {
            const p = Number(body.price);
            if (isNaN(p) || p < 0) return NextResponse.json({ message: "Harga Jual tidak valid" }, { status: 400 });
            updateData.sellPrice = p;
        }
        if (body.costPrice !== undefined) {
            const c = Number(body.costPrice);
            if (isNaN(c) || c < 0) return NextResponse.json({ message: "Harga Modal tidak valid" }, { status: 400 });
            updateData.costPrice = c;
        }
        if (body.minStock !== undefined) {
            const m = Number(body.minStock);
            if (isNaN(m) || m < 0) return NextResponse.json({ message: "Min. Stok tidak valid" }, { status: 400 });
            updateData.minStock = m;
        }
        if (body.category !== undefined) updateData.category = body.category;
        if (body.unit !== undefined) updateData.unit = body.unit;
        if (body.isActive !== undefined) updateData.isActive = body.isActive;
        if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null;
        if (body.trackStock !== undefined) updateData.trackStock = !!body.trackStock;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "Tidak ada data yang diubah" }, { status: 400 });
        }

        const product = await prisma.storeProduct.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ data: product, message: "Produk berhasil diperbarui" });
    } catch (error: any) {
        console.error("PUT /api/toko/products/[id] error:", error);
        if (error?.code === "P2002") {
            return NextResponse.json({ message: "SKU sudah digunakan. Gunakan kode produk yang berbeda." }, { status: 409 });
        }
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
            data: { isActive: false, deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Produk berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/toko/products/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus produk" }, { status: 500 });
    }
}
