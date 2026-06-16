/**
 * Backfill UnitTransaction.saleNo for legacy toko-family salary_cut rows by
 * parsing the description with extractSaleNo. Idempotent: only updates rows
 * where saleNo IS NULL and a saleNo is extractable.
 *
 * DRY-run by default (prints counts, no writes). Apply with: DRY=0 npx tsx ...
 */
import { PrismaClient } from "@prisma/client";
import { extractSaleNo } from "../src/lib/services/billing";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const DRY = process.env.DRY !== "0";
  const candidates = await prisma.unitTransaction.findMany({
    where: { saleNo: null, paymentMethod: "salary_cut" },
    select: { id: true, description: true },
  });
  const toUpdate: { id: number; saleNo: string }[] = [];
  for (const ut of candidates) {
    const sn = extractSaleNo(ut.description);
    if (sn) toUpdate.push({ id: ut.id, saleNo: sn });
  }
  console.log(`Candidates (saleNo IS NULL, salary_cut): ${candidates.length}`);
  console.log(`Extractable saleNo: ${toUpdate.length}`);
  console.log(`No-match (non-toko / no saleNo text): ${candidates.length - toUpdate.length}`);
  if (DRY) {
    console.log("(dry-run; set DRY=0 to apply)");
    return;
  }
  let n = 0;
  for (const u of toUpdate) {
    await prisma.unitTransaction.update({ where: { id: u.id }, data: { saleNo: u.saleNo } });
    n++;
  }
  console.log(`✅ Updated ${n} rows.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
