/**
 * Backfill productType and trackStock for existing StoreProduct rows.
 *
 * When prisma db push adds columns with @default values, existing rows get NULL.
 * This script sets:
 *   productType = "finished" WHERE productType IS NULL
 *   trackStock   = true       WHERE trackStock IS NULL
 *
 * Usage: npx tsx prisma/backfill-product-types.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Backfilling productType and trackStock...");

    const [typeResult, stockResult] = await Promise.all([
        prisma.$executeRaw`
            UPDATE store_products
            SET product_type = 'finished'
            WHERE product_type IS NULL AND deleted_at IS NULL
        `,
        prisma.$executeRaw`
            UPDATE store_products
            SET track_stock = true
            WHERE track_stock IS NULL AND deleted_at IS NULL
        `,
    ]);

    console.log(`Updated productType for ${typeResult} rows`);
    console.log(`Updated trackStock for ${stockResult} rows`);

    // Verify
    const nullType = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count FROM store_products
        WHERE product_type IS NULL AND deleted_at IS NULL
    `;
    const nullStock = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::int as count FROM store_products
        WHERE track_stock IS NULL AND deleted_at IS NULL
    `;

    console.log(`\nVerification:`);
    console.log(`  Rows with NULL productType: ${nullType[0].count}`);
    console.log(`  Rows with NULL trackStock: ${nullStock[0].count}`);

    if (Number(nullType[0].count) === 0 && Number(nullStock[0].count) === 0) {
        console.log("\nAll rows backfilled successfully!");
    } else {
        console.log("\nWARNING: Some rows still have NULL values!");
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
