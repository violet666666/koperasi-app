// Read-only diagnostic for POST /api/billing/[periodId]/process failures.
// Checks every record the route touches — no writes.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const periods = await prisma.billingPeriod.findMany({
    where: { status: "draft" },
    include: { billingItems: true },
    orderBy: { id: "desc" },
  });
  console.log(`Draft periods: ${periods.length}`);

  for (const p of periods) {
    console.log(`\n=== Period #${p.id} "${p.periodLabel}" — ${p.billingItems.length} items ===`);
    const units = [...new Set(p.billingItems.map((i) => i.unitType || "toko"))];
    console.log(`units: ${units.join(", ")}`);

    for (const item of p.billingItems) {
      const tag = `  item#${item.id} member=${item.memberId} src=${item.transactionSource} txId=${item.transactionId} unit=${item.unitType}`;
      if (item.transactionSource === "unit_transaction" && item.transactionId) {
        const ut = await prisma.unitTransaction.findUnique({ where: { id: item.transactionId }, select: { id: true, isPaid: true } });
        if (!ut) { console.log(`${tag} -> ❌ unitTransaction MISSING`); continue; }
        console.log(`${tag} -> UT ok (isPaid=${ut.isPaid})`);
      } else if (item.transactionSource === "store_sale" && item.transactionId) {
        const s = await prisma.storeSale.findUnique({ where: { id: item.transactionId }, select: { id: true } });
        console.log(`${tag} -> ${s ? "Sale ok" : "❌ storeSale MISSING"}`);
      } else if (item.transactionSource === "savings_account" && item.transactionId) {
        const a = await prisma.savingsAccount.findUnique({ where: { id: item.transactionId }, select: { id: true, status: true, balance: true, productId: true, branchId: true } });
        if (!a) { console.log(`${tag} -> ❌ savingsAccount MISSING`); continue; }
        console.log(`${tag} -> SA status=${a.status} balance=${a.balance} productId=${a.productId} branchId=${a.branchId}`);
        const prod = a.productId ? await prisma.savingsProduct.findUnique({ where: { id: a.productId }, select: { type: true } }) : null;
        console.log(`    product: ${prod ? prod.type : "❌ MISSING"}`);
      } else {
        console.log(`${tag} -> (no transactionId, generic item)`);
      }
    }

    // Unit accounts the settle step would use
    for (const ut of units) {
      const bank = await prisma.cashBankAccount.findFirst({ where: { type: "bank", isActive: true, unitTypes: { array_contains: ut } as any }, orderBy: { id: "asc" }, select: { id: true, branchId: true, unitTypes: true } });
      const cash = await prisma.cashBankAccount.findFirst({ where: { type: "cash", isActive: true, unitTypes: { array_contains: ut } as any }, orderBy: { id: "asc" }, select: { id: true, branchId: true, unitTypes: true } });
      console.log(`  unit "${ut}" -> bank=${bank ? `#${bank.id} (branchId=${bank.branchId})` : "none"} cash=${cash ? `#${cash.id} (branchId=${cash.branchId})` : "none"}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
