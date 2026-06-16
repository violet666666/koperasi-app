/**
 * READ-ONLY audit: for each processed BillingPeriod, report salary_cut
 * transactions in its window that were made AFTER the period was generated
 * (missed by the stale snapshot — the original root cause). Estimates the
 * uncollected receivables gap. NO writes — purely informational; re-settlement
 * of processed periods is a manual decision (out of scope).
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const periods = await prisma.billingPeriod.findMany({
    where: { status: "processed" },
    orderBy: { periodStart: "asc" },
    include: { _count: { select: { billingItems: true } } },
  });
  console.log(`Processed periods: ${periods.length}\n`);
  let totalGap = 0;
  for (const p of periods) {
    const startUTC = p.periodStart;
    const endUTC = new Date(p.periodEnd.getTime() + 86400000 - 1);
    const uts = await prisma.unitTransaction.findMany({
      where: { paymentMethod: "salary_cut", status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
      select: { id: true, amount: true, transactionDate: true },
    });
    const madeAfter = uts.filter((u) => new Date(u.transactionDate) > p.createdAt);
    const gap = madeAfter.reduce((s, u) => s + Number(u.amount), 0);
    totalGap += gap;
    console.log(`Period #${p.id} "${p.periodLabel}" [generated ${p.createdAt.toISOString().slice(0, 10)}]`);
    console.log(`   window txns (fresh): ${uts.length}  |  billingItems captured: ${p._count.billingItems}`);
    console.log(`   txns made AFTER generation (potential gap): ${madeAfter.length}  |  est. uncollected: Rp${gap.toLocaleString("id-ID")}\n`);
  }
  console.log(`TOTAL estimated uncollected across processed periods: Rp${totalGap.toLocaleString("id-ID")}`);
  console.log("\nNOTE: read-only. No data changed. Re-settlement is a manual decision (out of scope).");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
