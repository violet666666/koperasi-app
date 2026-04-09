import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/master/loan-products/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const product = await prisma.loanProduct.findUnique({
            where: { id: parseInt(id) },
        });

        if (!product) {
            return NextResponse.json(
                { message: "Produk pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: product });
    } catch (error) {
        console.error("GET /api/master/loan-products/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch loan product" },
            { status: 500 }
        );
    }
}

// PUT /api/master/loan-products/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (session.user.role === "anggota" || session.user.role === "kasir") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.loanProduct.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing) {
            return NextResponse.json(
                { message: "Produk pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        const updated = await prisma.loanProduct.update({
            where: { id: parseInt(id) },
            data: {
                ...(body.code && { code: body.code }),
                ...(body.name && { name: body.name }),
                ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
                ...(body.interestMethod && { interestMethod: body.interestMethod }),
                ...(body.minAmount !== undefined && { minAmount: body.minAmount }),
                ...(body.maxAmount !== undefined && { maxAmount: body.maxAmount }),
                ...(body.minTenorMonths !== undefined && { minTenorMonths: body.minTenorMonths }),
                ...(body.maxTenorMonths !== undefined && { maxTenorMonths: body.maxTenorMonths }),
                ...(body.adminFeeType !== undefined && { adminFeeType: body.adminFeeType }),
                ...(body.adminFeeValue !== undefined && { adminFeeValue: body.adminFeeValue }),
                ...(body.lateFeeType !== undefined && { lateFeeType: body.lateFeeType }),
                ...(body.lateFeeValue !== undefined && { lateFeeValue: body.lateFeeValue }),
                ...(body.isCurrent !== undefined && { isCurrent: body.isCurrent }),
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/master/loan-products/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update loan product" },
            { status: 500 }
        );
    }
}
