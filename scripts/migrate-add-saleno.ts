/**
 * Stage 2 schema migration (surgical, idempotent raw SQL).
 * Adds UnitTransaction.saleNo TEXT + index. Run once against the shared Neon DB
 * (dev + prod share one DB, so this applies live to prod immediately).
 *
 * Why raw SQL not `prisma migrate dev`: this Neon DB has no migration baseline
 * (built via db push historically) → migrate dev wants to RESET the schema.
 * Why not `db push`: full-diff could apply unexpected drift. This is surgical.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  console.log("Adding unit_transactions.sale_no column + index (idempotent)...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "unit_transactions" ADD COLUMN IF NOT EXISTS "sale_no" TEXT`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "unit_transactions_sale_no_idx" ON "unit_transactions"("sale_no")`);
  // sanity: confirm the column exists
  const res = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'unit_transactions' AND column_name = 'sale_no'"
  );
  console.log(res.length ? "✅ sale_no column present." : "❌ sale_no column MISSING.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
