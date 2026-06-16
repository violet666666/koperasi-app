/**
 * Stage 2 regression check: run the REAL buildBillingItems (which now prefers
 * ut.saleNo) against the live Mei-Juni window data (saleNo column backfilled)
 * and confirm Bimasyah is STILL detected as 7 items — i.e., switching the
 * dedup from description-regex to the saleNo column did NOT regress detection.
 */
import { PrismaClient } from "@prisma/client";
import { buildBillingItems } from "../src/lib/services/billing";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const period = await prisma.billingPeriod.findFirst({
    where: { status: "draft", periodLabel: { contains: "Mei" } },
  });
  if (!period) { console.log("No draft Mei period"); return; }
  const startUTC = period.periodStart;
  const endUTC = new Date(period.periodEnd.getTime() + 86400000 - 1);

  const claimedItems = await prisma.billingItem.findMany({
    where: { billingPeriodId: { not: period.id } },
    select: { transactionId: true, transactionSource: true },
  });
  const excludedTxIds = new Set<number>();
  const excludedSaleIds = new Set<number>();
  for (const it of claimedItems) {
    if (it.transactionId == null) continue;
    if (it.transactionSource === "store_sale") excludedSaleIds.add(it.transactionId);
    else excludedTxIds.add(it.transactionId);
  }

  const [uts, sales] = await Promise.all([
    prisma.unitTransaction.findMany({
      where: { paymentMethod: "salary_cut", isPaid: false, status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
      select: { id: true, memberId: true, unitType: true, description: true, saleNo: true, amount: true, isPaid: true, status: true, member: { select: { name: true, nrp: true } } },
    }),
    prisma.storeSale.findMany({
      where: { paymentMethod: "salary_cut", memberId: { not: null }, createdAt: { gte: startUTC, lte: endUTC } },
      select: { id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true, metadata: true, member: { select: { name: true, nrp: true } } },
    }),
  ]);

  // how many UTs now have the saleNo column populated (post-backfill)?
  const withCol = uts.filter((u) => u.saleNo).length;

  const items = buildBillingItems({
    unitTransactions: uts.map((ut) => ({ id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description, saleNo: ut.saleNo, amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status, member: ut.member })),
    storeSales: sales.map((s) => ({ id: s.id, saleNo: s.saleNo, memberId: s.memberId!, unitType: s.unitType, totalAmount: Number(s.totalAmount), metadata: s.metadata, member: s.member })),
    excludedTxIds, excludedSaleIds,
  });

  const bima = items.filter((i) => i.memberName.toLowerCase().includes("bima"));
  console.log(`UTs in window: ${uts.length} (saleNo column set: ${withCol})`);
  console.log(`buildBillingItems total items: ${items.length}`);
  console.log(`BIMASYAH: ${bima.length} items, Rp${bima.reduce((s, i) => s + i.amount, 0).toLocaleString("id-ID")}`);
  console.log(bima.length === 7 ? "✅ Stage 2 regression OK — Bimasyah still 7 (column primary, no regression)." : "⚠️  Bimasyah count changed — investigate.");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
