import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/admin/migrate — Schema sync: add missing columns to NeonDB
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !["operator", "admin"].includes(session.user.role as string)) {
            return NextResponse.json({ message: "Forbidden — operator/admin only" }, { status: 403 });
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

        // ── Member table columns ──────────────────────────────────────
        const memberColumns: [string, string][] = [
            ["occupation", "TEXT"],
            ["golongan", "TEXT"],
            ["kesatuan", "TEXT"],
            ["employee_type", "TEXT"],
            ["no_rekening", "TEXT"],
            ["salary", "DECIMAL(15,2)"],
            ["tunles_kinerja", "DECIMAL(15,2)"],
            ["sisa_gaji", "DECIMAL(15,2)"],
            ["tabungan_wajib", "DECIMAL(15,2)"],
            ["plafon_piutang", "DECIMAL(15,2) DEFAULT 0"],
        ];
        for (const [col, type] of memberColumns) {
            const exists = await columnExists("members", col);
            if (!exists) {
                await prisma.$executeRawUnsafe(`ALTER TABLE members ADD COLUMN ${col} ${type}`);
                results.push(`Added members.${col} (${type})`);
            } else {
                results.push(`members.${col} already exists`);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

// GET /api/admin/migrate — Diagnostic: check product counts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id || !["operator", "admin"].includes(session.user.role as string)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const [total, byType, byActive, byDeleted] = await Promise.all([
            prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::int as count FROM store_products`,
            prisma.$queryRaw<{ unit_type: string; count: bigint }[]>`
                SELECT unit_type, COUNT(*)::int as count FROM store_products GROUP BY unit_type
            `,
            prisma.$queryRaw<{ is_active: boolean; count: bigint }[]>`
                SELECT is_active, COUNT(*)::int as count FROM store_products GROUP BY is_active
            `,
            prisma.$queryRaw<{ deleted: string; count: bigint }[]>`
                SELECT CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END as deleted, COUNT(*)::int as count
                FROM store_products GROUP BY CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END
            `,
        ]);

        return NextResponse.json({
            totalProducts: Number(total[0].count),
            byUnitType: Object.fromEntries(byType.map(r => [r.unit_type, Number(r.count)])),
            byActive: Object.fromEntries(byActive.map(r => [String(r.is_active), Number(r.count)])),
            byDeleted: Object.fromEntries(byDeleted.map(r => [r.deleted, Number(r.count)])),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
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
