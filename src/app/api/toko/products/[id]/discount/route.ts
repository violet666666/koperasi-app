import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH /api/toko/products/[id]/discount — Update discount for a product
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const productId = parseInt(id);
        if (isNaN(productId)) {
            return NextResponse.json({ message: "Invalid product ID" }, { status: 400 });
        }

        const body = await request.json();
        const { discountType, discountValue } = body;

        // Validate
        if (discountType && !["percent", "fixed"].includes(discountType)) {
            return NextResponse.json(
                { message: "discountType harus 'percent' atau 'fixed'" },
                { status: 400 }
            );
        }

        if (discountType === "percent" && discountValue > 100) {
            return NextResponse.json(
                { message: "Diskon persen tidak boleh lebih dari 100%" },
                { status: 400 }
            );
        }

        const product = await prisma.storeProduct.findUnique({ where: { id: productId } });
        if (!product) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        const updated = await prisma.storeProduct.update({
            where: { id: productId },
            data: {
                discountType: discountType || null,
                discountValue: discountValue || 0,
            },
        });

        return NextResponse.json({
            data: {
                id: updated.id,
                name: updated.name,
                discountType: updated.discountType,
                discountValue: Number(updated.discountValue),
                sellPrice: Number(updated.sellPrice),
            },
        });
    } catch (error) {
        console.error("PATCH /api/toko/products/[id]/discount error:", error);
        return NextResponse.json(
            { message: "Gagal memperbarui diskon" },
            { status: 500 }
        );
    }
}
