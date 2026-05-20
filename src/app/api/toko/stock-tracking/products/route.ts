import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";

// GET /api/toko/stock-tracking/products
// Fetch products by scope for stock tracking/opname
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as { name: string })?.name;

        if (!["admin", "operator"].includes(userRole)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userUnitType = (session.user.unitType as string) || null;
        const unitType = searchParams.get("unitType") || userUnitType || "toko";
        if (userRole !== "operator" && userUnitType && !isSameUnit(unitType, userUnitType)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const scope = searchParams.get("scope") || "all";
        const location = searchParams.get("location") || "toko";
        const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
        const productIds = searchParams.get("productIds")?.split(",").filter(Boolean) || [];

        const where: any = {
            unitType,
            isActive: true,
            deletedAt: null,
            isService: false,
        };

        if (scope === "category" && categories.length > 0) {
            where.category = { in: categories };
        } else if (scope === "specific" && productIds.length > 0) {
            where.id = { in: productIds };
        }

        const products = await prisma.storeProduct.findMany({
            where,
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                stockGdg: true,
                stockToko: true,
                costPrice: true,
                sellPrice: true,
            },
            orderBy: { name: "asc" },
        });

        const stockField = location === "gudang" ? "stockGdg" : "stockToko";

        const result = products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "",
            category: p.category || "",
            unit: p.unit || "pcs",
            stockSystem: stockField === "gudang" ? p.stockGdg : p.stockToko,
            costPrice: Number(p.costPrice) || 0,
            sellPrice: Number(p.sellPrice) || 0,
        }));

        return NextResponse.json({ products: result });
    } catch (error) {
        console.error("[stock-tracking/products] Error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data produk" },
            { status: 500 }
        );
    }
}
