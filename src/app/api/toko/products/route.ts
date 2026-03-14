import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/toko/products - List store products
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";

        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { sku: { contains: search, mode: "insensitive" as const } },
                    ],
                }),
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                category: p.category,
                price: Number(p.sellPrice),
                costPrice: Number(p.costPrice),
                stock: p.stock,
                minStock: p.minStock,
                unit: p.unit,
            })),
        });
    } catch (error) {
        console.error("GET /api/toko/products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}

// POST /api/toko/products - Create a new product
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sku, name, category, costPrice, sellPrice, stock, minStock, unit } = body;

        if (!sku || !name || sellPrice === undefined) {
            return NextResponse.json(
                { message: "SKU, name, and sellPrice are required" },
                { status: 400 }
            );
        }

        const product = await prisma.storeProduct.create({
            data: {
                sku,
                name,
                category: category || null,
                costPrice: costPrice || 0,
                sellPrice,
                stock: stock || 0,
                minStock: minStock || 5,
                unit: unit || "pcs",
            },
        });

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/toko/products error:", error);
        return NextResponse.json(
            { message: "Failed to create product" },
            { status: 500 }
        );
    }
}
