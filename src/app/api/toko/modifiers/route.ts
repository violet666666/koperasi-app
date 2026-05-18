import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateModifierGroup } from "@/lib/modifiers";

export const dynamic = "force-dynamic";

// GET /api/toko/modifiers?productId=X — Get modifiers for a product
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const productId = searchParams.get("productId");
        if (!productId) {
            return NextResponse.json({ message: "productId is required" }, { status: 400 });
        }

        const product = await prisma.storeProduct.findUnique({ where: { id: parseInt(productId) }, select: { unitType: true } });
        if (!product) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }
        const userUnitType = (session.user as { unitType?: string }).unitType;
        if ((session.user.role as string) !== "operator" && userUnitType && product.unitType !== userUnitType) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const settingKey = `modifiers_product_${productId}`;
        const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });

        if (!setting?.value) {
            return NextResponse.json({ groups: [], isDefault: true });
        }

        try {
            const config = JSON.parse(setting.value as string);
            return NextResponse.json({ groups: config.groups || [], isDefault: false });
        } catch {
            return NextResponse.json({ groups: [], isDefault: true });
        }
    } catch (error) {
        console.error("[Modifiers] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/toko/modifiers — Save modifiers for a product
export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { productId, groups } = body;

        if (!productId) {
            return NextResponse.json({ message: "productId is required" }, { status: 400 });
        }

        const product = await prisma.storeProduct.findUnique({ where: { id: parseInt(productId) }, select: { unitType: true } });
        if (!product) {
            return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
        }
        const userUnitType = (session.user as { unitType?: string }).unitType;
        if (role !== "operator" && userUnitType && product.unitType !== userUnitType) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        if (!Array.isArray(groups)) {
            return NextResponse.json({ message: "groups must be an array" }, { status: 400 });
        }

        // Validate each group
        for (const group of groups) {
            const validation = validateModifierGroup(group);
            if (!validation.valid) {
                return NextResponse.json({
                    message: `Invalid modifier group "${group.name || group.id}"`,
                    errors: validation.errors,
                }, { status: 400 });
            }
        }

        const settingKey = `modifiers_product_${productId}`;
        await prisma.appSetting.upsert({
            where: { key: settingKey },
            update: { value: JSON.stringify({ groups }) },
            create: { key: settingKey, value: JSON.stringify({ groups }) },
        });

        return NextResponse.json({ message: "Modifiers saved", groups });
    } catch (error) {
        console.error("[Modifiers] PUT error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
