import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/admin/migrate — One-time migration to add hybrid inventory columns
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !["admin", "super_admin"].includes(session.user.role as string)) {
            return NextResponse.json({ message: "Forbidden — super_admin only" }, { status: 403 });
        }

        const results: string[] = [];

        // Add product_type column if missing
        const hasProductType = await columnExists("store_products", "product_type");
        if (!hasProductType) {
            await prisma.$executeRaw`
                ALTER TABLE store_products
                ADD COLUMN product_type TEXT DEFAULT 'finished'
            `;
            results.push("Added product_type column with DEFAULT 'finished'");
        } else {
            results.push("product_type column already exists");
        }

        // Add track_stock column if missing
        const hasTrackStock = await columnExists("store_products", "track_stock");
        if (!hasTrackStock) {
            await prisma.$executeRaw`
                ALTER TABLE store_products
                ADD COLUMN track_stock BOOLEAN DEFAULT true
            `;
            results.push("Added track_stock column with DEFAULT true");
        } else {
            results.push("track_stock column already exists");
        }

        // Add ingredient_product_id column to product_recipes if missing
        const hasIngredientFk = await columnExists("product_recipes", "ingredient_product_id");
        if (!hasIngredientFk) {
            await prisma.$executeRaw`
                ALTER TABLE product_recipes
                ADD COLUMN ingredient_product_id INTEGER
            `;
            results.push("Added ingredient_product_id column to product_recipes");
        } else {
            results.push("ingredient_product_id column already exists");
        }

        // Backfill NULL values
        const backfillType = await prisma.$executeRaw`
            UPDATE store_products SET product_type = 'finished'
            WHERE product_type IS NULL AND deleted_at IS NULL
        `;
        results.push(`Backfilled product_type for ${backfillType} rows`);

        const backfillStock = await prisma.$executeRaw`
            UPDATE store_products SET track_stock = true
            WHERE track_stock IS NULL AND deleted_at IS NULL
        `;
        results.push(`Backfilled track_stock for ${backfillStock} rows`);

        return NextResponse.json({ success: true, results });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

async function columnExists(table: string, column: string): Promise<boolean> {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column}
        ) as exists
    `;
    return result[0].exists;
}
