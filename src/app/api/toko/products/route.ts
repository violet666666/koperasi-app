import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/products - List store products
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const unitType = searchParams.get("unitType") || null;

        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(unitType && { unitType: unitType }),
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
                discountType: p.discountType,
                discountValue: Number(p.discountValue),
                costPrice: Number(p.costPrice),
                stock: p.stock,
                stockGdg: p.stockGdg,
                stockToko: p.stockToko,
                minStock: p.minStock,
                unit: p.unit,
                isService: p.isService,
                unitType: p.unitType,
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
        const session = await auth();
        const userId = session?.user?.id ? parseInt(session.user.id) : null;

        const body = await request.json();
        const { sku, name, category, costPrice, sellPrice, discountType, discountValue, stock, stockGdg, stockToko, minStock, unit, isService } = body;

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
                discountType: discountType || null,
                discountValue: discountValue || 0,
                stock: stock || 0,
                stockGdg: stockGdg || 0,
                stockToko: stockToko || 0,
                minStock: minStock || 5,
                unit: unit || "pcs",
                isService: isService || false,
            },
        });

        // Insert log inisialisasi jika mengisi sisa stok pada produk baru
        if (product.stock > 0 && !product.isService) {
            await prisma.storeStockMovement.create({
                 data: {
                     productId: product.id,
                     type: "in",
                     quantity: product.stock,
                     reference: "Stok Awal Produk Baru",
                     notes: "Inisialisasi sistem",
                     operatorId: userId
                 }
            });
        }

        return NextResponse.json({ data: product }, { status: 201 });
    } catch (error) {
        console.error("POST /api/toko/products error:", error);
        return NextResponse.json(
            { message: "Failed to create product" },
            { status: 500 }
        );
    }
}
