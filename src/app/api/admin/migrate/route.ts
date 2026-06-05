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

        // Backfill: Set trackStock=false for non-inventory units (resto, cafe_lsp)
        const backfillNonInventory = await prisma.$executeRaw`
            UPDATE store_products SET track_stock = false
            WHERE unit_type IN ('resto', 'resto_cafe', 'coffe_latar', 'cafe_lsp')
            AND track_stock = true AND deleted_at IS NULL
        `;
        results.push(`Set trackStock=false for ${backfillNonInventory} non-inventory products (resto/cafe_lsp)`);

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

        // ── Billing tables (if missing) ────────────────────────────────
        const billingPeriodExists = await tableExists("billing_periods");
        if (!billingPeriodExists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE billing_periods (
                    id SERIAL PRIMARY KEY,
                    period_start DATE NOT NULL,
                    period_end DATE NOT NULL,
                    period_label TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'draft',
                    total_members INTEGER NOT NULL DEFAULT 0,
                    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
                    processed_by_id INTEGER,
                    processed_at TIMESTAMP(3),
                    created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
                )
            `);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_billing_periods_status ON billing_periods(status)`);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_billing_periods_dates ON billing_periods(period_start, period_end)`);
            results.push("Created billing_periods table");
        } else {
            results.push("billing_periods table already exists");
        }

        const billingItemsExists = await tableExists("billing_items");
        if (!billingItemsExists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE billing_items (
                    id SERIAL PRIMARY KEY,
                    billing_period_id INTEGER NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE,
                    member_id INTEGER NOT NULL REFERENCES members(id),
                    member_name TEXT NOT NULL,
                    member_nrp TEXT,
                    unit_type TEXT,
                    transaction_id INTEGER,
                    transaction_source TEXT,
                    description TEXT,
                    amount DECIMAL(15,2) NOT NULL,
                    is_marked_paid BOOLEAN NOT NULL DEFAULT false,
                    paid_at TIMESTAMP(3),
                    paid_by_id INTEGER,
                    created_at TIMESTAMP(3) NOT NULL DEFAULT NOW()
                )
            `);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_billing_items_period_member ON billing_items(billing_period_id, member_id)`);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_billing_items_member ON billing_items(member_id)`);
            results.push("Created billing_items table");
        } else {
            results.push("billing_items table already exists");
        }

        // ── Kitchen Orders table (if missing) ────────────────────────────
        const kitchenOrdersExists = await tableExists("kitchen_orders");
        if (!kitchenOrdersExists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE kitchen_orders (
                    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    unit_type TEXT NOT NULL,
                    sale_id TEXT,
                    table_number INTEGER,
                    queue_number TEXT,
                    status TEXT NOT NULL DEFAULT 'pending',
                    items JSONB NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    started_at TIMESTAMP(3),
                    completed_at TIMESTAMP(3),
                    served_at TIMESTAMP(3)
                )
            `);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_kitchen_orders_unit_status ON kitchen_orders(unit_type, status, created_at)`);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_kitchen_orders_sale_id ON kitchen_orders(sale_id)`);
            results.push("Created kitchen_orders table");
        } else {
            results.push("kitchen_orders table already exists");
        }

        // ── F&B Menu Management: store_categories table ──────────────────
        const storeCatExists = await tableExists("store_categories");
        if (!storeCatExists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE store_categories (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit_type TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    CONSTRAINT store_categories_name_unit_type_unique UNIQUE (name, unit_type)
                )
            `);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_store_categories_unit_active ON store_categories(unit_type, is_active)`);
            results.push("Created store_categories table");
        } else {
            results.push("store_categories table already exists");
        }

        // F&B fields on store_products
        const fbColumns: [string, string][] = [
            ["category_id", "INTEGER"],
            ["menu_type", "TEXT"],
            ["tax_type", "TEXT DEFAULT 'inclusive'"],
            ["tax_rate", "DECIMAL(5,2) DEFAULT 11.0"],
            ["pos_color", "TEXT"],
            ["variant_group_id", "TEXT"],
        ];
        for (const [col, type] of fbColumns) {
            const exists = await columnExists("store_products", col);
            if (!exists) {
                await prisma.$executeRawUnsafe(`ALTER TABLE store_products ADD COLUMN ${col} ${type}`);
                results.push(`Added store_products.${col} (${type})`);
            } else {
                results.push(`store_products.${col} already exists`);
            }
        }

        // ── LoanPayment void fields ──────────────────────────────────
        const hasPaymentStatus = await columnExists("loan_payments", "status");
        if (!hasPaymentStatus) {
            await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'completed'`;
            await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN voided_at TIMESTAMP`;
            await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN voided_by_id INTEGER`;
            await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN void_reason TEXT`;
            results.push("Added loan_payments void tracking fields (status, voided_at, voided_by_id, void_reason)");
        } else {
            results.push("loan_payments void fields already exist");
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

async function tableExists(table: string): Promise<boolean> {
    const result = await prisma.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = ${table}
        ) as exists
    `;
    return result[0].exists;
}
