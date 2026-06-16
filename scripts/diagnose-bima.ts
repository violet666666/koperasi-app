/**
 * DIAGNOSTIC (read-only): Investigate why salary_cut (potong-gaji) transactions
 * for a member are NOT detected by /api/billing/generate.
 *
 * Usage:  set -a && . ./.env && set +a && npx tsx scripts/diagnose-bima.ts [nameFragment]
 * Default nameFragment = "bima"
 *
 * Replicates the EXACT filters from src/app/api/billing/generate/route.ts
 * (Source 1: UnitTransaction, Source 2: StoreSale gap, Source 3: haji-umrah)
 * and classifies each transaction as DETECTED or EXCLUDED(reason).
 */
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: ["error"],
});

const fmtDate = (d: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "—";
const rp = (n: Prisma.Decimal | number | null | undefined) =>
  Number(n ?? 0).toLocaleString("id-ID");

// --- replicate calculateBillingPeriod (lib/services/billing.ts) ---
function calculateBillingPeriod(referenceDate: Date) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  let startMonth: number, startYear: number;
  if (referenceDate.getDate() >= 16) {
    startMonth = month; startYear = year;
  } else {
    startMonth = month - 1; startYear = year;
    if (startMonth < 0) { startMonth = 11; startYear--; }
  }
  const periodStart = new Date(startYear, startMonth, 16);
  let endMonth = startMonth + 1, endYear = startYear;
  if (endMonth > 11) { endMonth = 0; endYear++; }
  const periodEnd = new Date(endYear, endMonth, 15);
  return { periodStart, periodEnd, label: `${MONTHS[startMonth]}-${MONTHS[endMonth]} ${endYear}` };
}

async function main() {
  const frag = (process.argv[2] || "bima").toLowerCase();
  const now = new Date();
  const { periodStart, periodEnd, label } = calculateBillingPeriod(now);
  // window exactly as generate/route.ts builds it
  const startUTC = periodStart;
  const endUTC = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

  console.log("\n========================================================");
  console.log(`Billing period (today ${now.toISOString().slice(0, 10)}): ${label}`);
  console.log(`Detection window: ${startUTC.toISOString()}  →  ${endUTC.toISOString()}`);
  console.log(`Member name fragment: "${frag}"`);
  console.log("========================================================");

  // 1. Find member(s)
  const members = await prisma.member.findMany({
    where: { name: { contains: frag, mode: "insensitive" } },
    select: { id: true, name: true, nrp: true, status: true, memberNo: true },
  });
  console.log(`\nMember(s) found: ${members.length}`);
  if (members.length === 0) {
    console.log("  ❌ No member matches. Try a different fragment as arg.");
    return;
  }
  for (const m of members) console.log(`  • #${m.id} ${m.name} (NRP ${m.nrp}, memberNo ${m.memberNo}, status=${m.status})`);

  // 2. Existing BillingPeriods — did this member ever get items?
  const periods = await prisma.billingPeriod.findMany({
    orderBy: { periodStart: "desc" },
    include: { billingItems: { select: { memberId: true, memberName: true, amount: true, transactionSource: true, description: true } } },
  });
  console.log(`\n--- BillingPeriods in DB: ${periods.length} ---`);
  const memberIds = new Set(members.map((m) => m.id));
  for (const p of periods) {
    const mine = p.billingItems.filter((i) => memberIds.has(i.memberId));
    console.log(`  [${p.status}] ${p.periodLabel} (${fmtDate(p.periodStart)}→${fmtDate(p.periodEnd)}) totalMembers=${p.totalMembers} | items for our member(s): ${mine.length}`);
    for (const it of mine) console.log(`       - src=${it.transactionSource} Rp${rp(it.amount)} :: ${it.description}`);
  }

  // 3. For each member: classify every UnitTransaction & salary_cut StoreSale
  for (const m of members) {
    console.log(`\n=========== Member #${m.id} ${m.name} ===========`);

    const uts = await prisma.unitTransaction.findMany({
      where: { memberId: m.id },
      orderBy: { transactionDate: "desc" },
      select: { id: true, transactionNo: true, unitType: true, paymentMethod: true, isPaid: true, paidDate: true, status: true, amount: true, transactionDate: true, description: true },
    });
    console.log(`  UnitTransactions: ${uts.length} total`);
    for (const u of uts) {
      const reasons: string[] = [];
      if (u.paymentMethod !== "salary_cut") reasons.push(`paymentMethod=${u.paymentMethod}`);
      if (u.isPaid) reasons.push(`isPaid=true(paidDate ${fmtDate(u.paidDate)})`);
      if (u.status !== "completed") reasons.push(`status=${u.status}`);
      const d = new Date(u.transactionDate);
      if (d < startUTC || d > endUTC) reasons.push(`date ${fmtDate(d)} OUTSIDE window`);
      if (u.memberId === null) reasons.push("memberId=null");
      const detected = reasons.length === 0;
      console.log(`    ${detected ? "✅ DETECTED" : "⬛ EXCLUDED"}  UT#${u.id} ${u.transactionNo} [${u.unitType}] ${u.paymentMethod} Rp${rp(u.amount)} ${fmtDate(u.transactionDate)} status=${u.status} isPaid=${u.isPaid}` + (reasons.length ? `  ← ${reasons.join(", ")}` : "") + (u.paymentMethod === "salary_cut" ? "" : ""));
    }

    const sales = await prisma.storeSale.findMany({
      where: { memberId: m.id, paymentMethod: "salary_cut" },
      orderBy: { createdAt: "desc" },
      select: { id: true, saleNo: true, unitType: true, paymentMethod: true, totalAmount: true, createdAt: true, metadata: true },
    });
    console.log(`  salary_cut StoreSales: ${sales.length}`);
    for (const s of sales) {
      const meta = s.metadata as Record<string, unknown> | null;
      const voided = !!meta?.isVoided;
      const settled = !!meta?.isSettled;
      const reasons: string[] = [];
      if (voided) reasons.push("voided");
      if (settled) reasons.push("isSettled=true");
      const c = new Date(s.createdAt);
      if (c < startUTC || c > endUTC) reasons.push(`createdAt ${c.toISOString().slice(0, 10)} OUTSIDE window`);
      console.log(`    SS#${s.id} ${s.saleNo} [${s.unitType}] Rp${rp(s.totalAmount)} ${c.toISOString().slice(0, 10)} meta=${JSON.stringify(meta)}` + (reasons.length ? `  ← ${reasons.join(", ")}` : "  (would be gap-detected if no matching UT)"));
    }
  }

  // 4. SYSTEMIC check: ALL salary_cut UnitTransactions grouped by (status, isPaid)
  console.log("\n--- SYSTEMIC: ALL salary_cut UnitTransactions by (status, isPaid) ---");
  const groups = await prisma.unitTransaction.groupBy({
    by: ["status", "isPaid"],
    where: { paymentMethod: "salary_cut" },
    _count: { _all: true },
    _sum: { amount: true },
  });
  for (const g of groups) {
    const inBilling = g.status === "completed" && g.isPaid === false;
    console.log(`  ${inBilling ? "✅ in billing" : "⬛ EXCLUDED   "} status=${g.status} isPaid=${g.isPaid} → ${g._count._all} tx, Rp${rp(g._sum.amount)}`);
  }

  // 5. Orphan salary_cut StoreSales (no matching UnitTransaction) within window
  console.log("\n--- Orphan salary_cut StoreSales in window (caught only by Source 2) ---");
  const orphans = await prisma.storeSale.findMany({
    where: { paymentMethod: "salary_cut", memberId: { not: null }, createdAt: { gte: startUTC, lte: endUTC } },
    select: { id: true, saleNo: true, unitType: true, memberId: true, totalAmount: true, createdAt: true, metadata: true, member: { select: { name: true } } },
  });
  const SALE_NO_RE = /(TK-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;
  const covered = new Set<string>();
  const windowUTs = await prisma.unitTransaction.findMany({
    where: { paymentMethod: "salary_cut", memberId: { not: null }, status: "completed", isPaid: false, transactionDate: { gte: startUTC, lte: endUTC } },
    select: { description: true },
  });
  for (const u of windowUTs) { const mm = u.description?.match(SALE_NO_RE); if (mm) covered.add(mm[1]); }
  console.log(`  StoreSales salary_cut in window: ${orphans.length}; covered saleNos (from UT desc): ${covered.size}`);
  for (const s of orphans) {
    const meta = s.metadata as Record<string, unknown> | null;
    const voided = !!meta?.isVoided;
    const isCovered = covered.has(s.saleNo);
    console.log(`    SS#${s.id} ${s.saleNo} [${s.unitType}] member=${s.member?.name} Rp${rp(s.totalAmount)} ${new Date(s.createdAt).toISOString().slice(0, 10)} voided=${voided} coveredByUT=${isCovered}`);
  }

  console.log("\n========================================================\n");
}

main()
  .catch((e) => { console.error("DIAG ERROR:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
