import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updateSavingsProductSchema } from "@/lib/validations";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/master/savings-products/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const product = await prisma.savingsProduct.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!product) {
            return NextResponse.json(
                { message: "Produk simpanan tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: product });
    } catch (error) {
        console.error("GET /api/master/savings-products/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings product" },
            { status: 500 }
        );
    }
}

// PUT /api/master/savings-products/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const body = await request.json();
        const data = updateSavingsProductSchema.parse(body);

        const product = await prisma.savingsProduct.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!product) {
            return NextResponse.json(
                { message: "Produk simpanan tidak ditemukan" },
                { status: 404 }
            );
        }

        const updated = await prisma.savingsProduct.update({
            where: { id: parseInt(id) },
            data,
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/master/savings-products/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update savings product" },
            { status: 500 }
        );
    }
}

// DELETE /api/master/savings-products/[id]
export async function DELETE(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const product = await prisma.savingsProduct.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!product) {
            return NextResponse.json(
                { message: "Produk simpanan tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check if product has accounts
        const hasAccounts = await prisma.savingsAccount.count({
            where: { productId: parseInt(id) },
        });

        if (hasAccounts > 0) {
            return NextResponse.json(
                { message: "Produk tidak dapat dihapus karena sudah digunakan" },
                { status: 400 }
            );
        }

        await prisma.savingsProduct.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Produk berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/master/savings-products/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to delete savings product" },
            { status: 500 }
        );
    }
}
