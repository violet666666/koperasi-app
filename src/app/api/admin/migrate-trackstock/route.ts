import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/admin/migrate-trackstock — Set trackStock=false for F&B products
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "operator") {
            return NextResponse.json({ message: "Forbidden — operator only" }, { status: 403 });
        }

        // Count before
        const before = await prisma.storeProduct.groupBy({
            by: ["unitType", "trackStock"],
            where: {
                unitType: { in: ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"] },
                deletedAt: null,
                isActive: true,
            },
            _count: true,
        });

        // Run migration
        const result = await prisma.$executeRaw`
            UPDATE "StoreProduct"
            SET "trackStock" = false
            WHERE "unitType" IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
              AND "productType" = 'finished'
              AND "trackStock" = true
        `;

        // Count after
        const after = await prisma.storeProduct.groupBy({
            by: ["unitType", "trackStock"],
            where: {
                unitType: { in: ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"] },
                deletedAt: null,
                isActive: true,
            },
            _count: true,
        });

        return NextResponse.json({
            rowsUpdated: result,
            before: before.map(b => ({ unitType: b.unitType, trackStock: b.trackStock, count: b._count })),
            after: after.map(a => ({ unitType: a.unitType, trackStock: a.trackStock, count: a._count })),
        });
    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
