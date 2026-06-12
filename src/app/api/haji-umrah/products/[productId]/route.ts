import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// PUT /api/haji-umrah/products/[productId] — Update haji/umrah product
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        const unitType = (session.user as Record<string, unknown>).unitType;
        if (roleName !== "operator" && !(roleName === "admin" && unitType === "haji_umrah")) {
            return NextResponse.json({ message: "Forbidden — operator or haji_umrah admin only" }, { status: 403 });
        }

        const { productId } = await params;
        const id = parseInt(productId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid productId" }, { status: 400 });
        }

        const body = await request.json();
        const { name, minimumAmount, targetAmount, adminFeeType, adminFeeValue, linkedBankName, isActive } = body;

        // Verify product exists and is haji/umrah type
        const existing = await prisma.savingsProduct.findUnique({ where: { id } });
        if (!existing || !HAJI_UMRAH_TYPES.includes(existing.type)) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }

        const product = await prisma.savingsProduct.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(minimumAmount !== undefined && { minimumAmount }),
                ...(targetAmount !== undefined && { targetAmount }),
                ...(adminFeeType !== undefined && { adminFeeType }),
                ...(adminFeeValue !== undefined && { adminFeeValue }),
                ...(linkedBankName !== undefined && { linkedBankName }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json({ data: product });
    } catch (error) {
        console.error("PUT /api/haji-umrah/products/[productId] error:", error);
        return NextResponse.json({ message: "Failed to update product" }, { status: 500 });
    }
}
