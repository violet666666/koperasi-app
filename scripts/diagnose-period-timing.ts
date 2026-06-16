/**
 * VERIFY: Was the May-June BillingPeriod generated as a STALE snapshot
 * (before Bimasyah's transactions), and would regenerating NOW include him?
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ["error"] });

async function main() {
  // 1. BillingPeriod createdAt + item date range
  const periods = await prisma.billingPeriod.findMany({
    orderBy: { periodStart: "asc" },
    include: {
      _count: { select: { billingItems: true } },
      billingItems: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { createdAt: true, description: true },
      },
    },
  });
  console.log("\n=== BillingPeriod timing ===");
  for (const p of periods) {
    const earliestItem = p.billingItems[0];
    // latest transaction date captured = period generated roughly at this time
    console.log(`[${p.status}] "${p.periodLabel}" ${p.periodStart.toISOString().slice(0,10)}→${p.periodEnd.toISOString().slice(0,10)}`);
    console.log(`   period.createdAt = ${p.createdAt.toISOString()}`);
    console.log(`   items=${p._count.billingItems}  earliest item createdAt = ${earliestItem?.createdAt?.toISOString() ?? "—"}`);
  }

  // 2. SIMULATE generate for the May-June window (2026-05-16 → 2026-06-15) NOW
  const startUTC = new Date(2026, 4, 16);   // 2026-05-16 (local)
  const endUTC = new Date(new Date(2026, 5, 15).getTime() + 86400000 - 1); // 2026-06-15 end-of-day
  console.log(`\n=== SIMULATE generate for May-June window ${startUTC.toISOString().slice(0,10)} → ${endUTC.toISOString().slice(0,10)} ===`);

  const uts = await prisma.unitTransaction.findMany({
    where: { paymentMethod: "salary_cut", isPaid: false, status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
    select: { id: true, memberId: true, member: { select: { name: true } }, amount: true },
  });
  const memberCount = new Set(uts.map(u => u.memberId)).size;
  const total = uts.reduce((s, u) => s + Number(u.amount), 0);
  console.log(`   Source 1 (UnitTransaction): ${uts.length} items, ${memberCount} members, Rp${total.toLocaleString("id-ID")}`);

  const bimaItems = uts.filter(u => u.member?.name?.toLowerCase().includes("bima") && u.member?.name?.toLowerCase().includes("irwa"));
  console.log(`   BIMASYAH IRWA items if regenerated NOW: ${bimaItems.length} (Rp${bimaItems.reduce((s,i)=>s+Number(i.amount),0).toLocaleString("id-ID")})`);

  // 3. What % of those transactions happened AFTER the May-June period was created?
  const mayJune = periods.find(p => p.periodLabel.includes("Mei") || (p.periodStart.toISOString().slice(0,10) === "2026-05-16" || p.periodStart.toISOString().slice(5,10) === "05-15"));
  const genAt = mayJune?.createdAt;
  if (genAt) {
    const afterGen = uts.filter(u => { /* tx date */ return true; });
    // fetch tx dates for the window UTs
    const detailed = await prisma.unitTransaction.findMany({
      where: { id: { in: uts.map(u => u.id) } },
      select: { id: true, transactionDate: true },
    });
    const madeAfter = detailed.filter(d => new Date(d.transactionDate) > genAt).length;
    console.log(`\n   May-June period generated at: ${genAt.toISOString()}`);
    console.log(`   Transactions in window made AFTER generation (MISSING from stale draft): ${madeAfter} of ${detailed.length}`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
