import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/products/quick-keys?unitType=cafe_lsp — fetch quick key product IDs
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || "toko";
        const key = `quick_keys_${unitType}`;

        const setting = await prisma.appSetting.findUnique({ where: { key } });
        const productIds: number[] = setting ? JSON.parse(setting.value) : [];

        return NextResponse.json({ data: productIds });
    } catch {
        return NextResponse.json({ data: [] });
    }
}

// PUT /api/toko/products/quick-keys?unitType=cafe_lsp — set quick key product IDs
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || "toko";
        const body = await request.json();
        const rawIds: number[] = body.productIds || [];

        if (rawIds.length > 12) {
            return NextResponse.json({ message: "Maksimal 12 Quick Keys" }, { status: 400 });
        }

        // Validate product IDs exist and belong to the unit
        let productIds = rawIds;
        if (productIds.length > 0) {
            const validProducts = await prisma.storeProduct.findMany({
                where: { id: { in: productIds }, unitType, isActive: true, deletedAt: null },
                select: { id: true },
            });
            const validIds = new Set(validProducts.map(p => p.id));
            productIds = productIds.filter(id => validIds.has(id));
        }

        const key = `quick_keys_${unitType}`;
        await prisma.appSetting.upsert({
            where: { key },
            update: { value: JSON.stringify(productIds) },
            create: { key, value: JSON.stringify(productIds), label: `Quick Keys for ${unitType}` },
        });

        return NextResponse.json({ data: productIds, message: "Quick Keys berhasil disimpan" });
    } catch {
        return NextResponse.json({ message: "Gagal menyimpan Quick Keys" }, { status: 500 });
    }
}
