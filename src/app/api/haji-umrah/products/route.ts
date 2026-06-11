import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/products — List haji/umrah savings products
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const products = await prisma.savingsProduct.findMany({
            where: {
                type: { in: HAJI_UMRAH_TYPES },
                deletedAt: null,
            },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({ data: products });
    } catch (error) {
        console.error("GET /api/haji-umrah/products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}

// POST /api/haji-umrah/products — Create haji/umrah savings product
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = (session.user as Record<string, unknown>).role?.name || (session.user as Record<string, unknown>).role;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Forbidden — operator only" }, { status: 403 });
        }

        const body = await request.json();
        const { code, name, type, minimumAmount, targetAmount, adminFeeType, adminFeeValue, linkedBankName, isActive } = body;

        // Validate type
        if (!HAJI_UMRAH_TYPES.includes(type)) {
            return NextResponse.json(
                { message: `Type harus salah satu: ${HAJI_UMRAH_TYPES.join(", ")}` },
                { status: 400 }
            );
        }

        // Check duplicate code
        const existing = await prisma.savingsProduct.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json(
                { message: `Kode produk "${code}" sudah digunakan` },
                { status: 409 }
            );
        }

        const product = await prisma.savingsProduct.create({
            data: {
                code,
                name,
                type,
                isMandatory: false,
                depositPeriod: "monthly",
                minimumAmount: minimumAmount ?? 0,
                canWithdraw: false,
                allowEarlyWithdraw: false,
                targetAmount: targetAmount ?? null,
                adminFeeType: adminFeeType ?? null,
                adminFeeValue: adminFeeValue ?? null,
                linkedBankName: linkedBankName ?? "BSI",
                isActive: isActive ?? true,
            },
        });

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/products error:", error);
        return NextResponse.json(
            { message: "Failed to create product" },
            { status: 500 }
        );
    }
}
