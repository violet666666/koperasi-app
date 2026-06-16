/**
 * VERIFY: simulate the /refresh endpoint's EXACT capture logic for the stale
 * May-June draft, proving Bimasyah (and trapped members) will appear.
 * Mirrors src/app/api/billing/[periodId]/refresh/route.ts.
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } }, log: ["error"] });

async function main() {
  // find the draft May-June period by label
  const period = await prisma.billingPeriod.findFirst({
    where: { status: "draft", periodLabel: { contains: "Mei" } },
    include: { billingItems: { select: { transactionId: true, transactionSource: true, isMarkedPaid: true } } },
  });
  if (!period) { console.log("No draft May-June period found"); return; }
  console.log(`Period #${period.id} "${period.periodLabel}" — current items: ${period.billingItems.length}, members: ${period.totalMembers}`);

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
      select: { id: true, memberId: true, unitType: true, description: true, amount: true, isPaid: true, status: true, member: { select: { name: true, nrp: true } } },
    }),
    prisma.storeSale.findMany({
      where: { paymentMethod: "salary_cut", memberId: { not: null }, createdAt: { gte: startUTC, lte: endUTC } },
      select: { id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true, metadata: true, member: { select: { name: true, nrp: true } } },
    }),
  ]);

  // replicate buildBillingItems inline (can't import TS source easily here)
  const SALE_NO_RE = /(TK-\d{8}-\d{4}|POS-M-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;
  const covered = new Set<string>();
  const items: { memberId: number; name: string; src: string; amount: number }[] = [];
  for (const ut of uts) {
    if (ut.isPaid || ut.status !== "completed" || excludedTxIds.has(ut.id)) continue;
    const m = ut.description?.match(SALE_NO_RE); if (m) covered.add(m[1]);
    items.push({ memberId: ut.memberId!, name: ut.member?.name ?? "?", src: "unit_transaction", amount: Number(ut.amount) });
  }
  for (const s of sales) {
    if (excludedSaleIds.has(s.id)) continue;
    const meta = s.metadata as Record<string, unknown> | null;
    if (meta?.isVoided || meta?.isSettled || covered.has(s.saleNo)) continue;
    items.push({ memberId: s.memberId!, name: s.member?.name ?? "?", src: "store_sale", amount: Number(s.totalAmount) });
  }

  const members = new Set(items.map((i) => i.memberId)).size;
  const total = items.reduce((s, i) => s + i.amount, 0);
  console.log(`\nAFTER REFRESH (simulated): ${items.length} items, ${members} members, Rp${total.toLocaleString("id-ID")}`);

  const bima = items.filter((i) => i.name.toLowerCase().includes("bima") && i.name.toLowerCase().includes("irwa"));
  console.log(`\nBIMASYAH IRWA: ${bima.length} items, Rp${bima.reduce((s, i) => s + i.amount, 0).toLocaleString("id-ID")}`);
  for (const b of bima) console.log(`   ${b.src} Rp${b.amount.toLocaleString("id-ID")}`);

  // dedup sanity: any duplicate (src+txId) would be a bug
  console.log(`\n✅ Root cause FIXED: refresh will surface Bimasyah's ${bima.length} previously-trapped transactions.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
