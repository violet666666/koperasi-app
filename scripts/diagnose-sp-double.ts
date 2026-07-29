/**
 * READ-ONLY diagnostic: detect SP loan double-data in production.
 * No mutations. Safe to run against prod Neon.
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-sp-double.ts
 */
import prisma from "../src/lib/prisma";

async function main() {
  console.log("\n=== 1. LOAN STATUS DISTRIBUTION ===");
  const byStatus = await prisma.loan.groupBy({
    by: ["status"],
    _count: true,
  });
  console.table(byStatus);

  console.log("\n=== 2. LOAN BY loanNo PREFIX (first 6 chars) ===");
  const allLoans = await prisma.loan.findMany({
    select: { loanNo: true, status: true, memberId: true, principalAmount: true, principalOutstanding: true, createdAt: true },
  });
  const prefixCount: Record<string, number> = {};
  for (const l of allLoans) {
    const p = (l.loanNo || "(none)").slice(0, 6);
    prefixCount[p] = (prefixCount[p] || 0) + 1;
  }
  console.table(prefixCount);

  console.log("\n=== 3. MEMBERS WITH MULTIPLE LOANS ===");
  const loanPerMember: Record<number, number> = {};
  const activePerMember: Record<number, number> = {};
  for (const l of allLoans) {
    loanPerMember[l.memberId] = (loanPerMember[l.memberId] || 0) + 1;
    if (l.status === "active") activePerMember[l.memberId] = (activePerMember[l.memberId] || 0) + 1;
  }
  const multi = Object.entries(loanPerMember).filter(([, n]) => n > 1);
  const multiActive = Object.entries(activePerMember).filter(([, n]) => n > 1);
  console.log(`Members with >1 loan (any status): ${multi.length}`);
  console.log(`Members with >1 ACTIVE loan (potential double): ${multiActive.length}`);

  console.log("\n=== 4. SAMPLE 10 MEMBERS WITH >1 ACTIVE LOAN ===");
  const sampleIds = multiActive.slice(0, 10).map(([id]) => Number(id));
  if (sampleIds.length) {
    const members = await prisma.member.findMany({
      where: { id: { in: sampleIds } },
      select: { id: true, name: true, nrp: true, memberNo: true },
    });
    for (const m of members) {
      const loans = allLoans.filter(l => l.memberId === m.id);
      console.log(`\n[#${m.id}] ${m.name} (NRP ${m.nrp}): ${loans.length} loans`);
      for (const l of loans) {
        console.log(`   ${l.loanNo} | status=${l.status} | pokok=${l.principalAmount} | sisa=${l.principalOutstanding} | dibuat=${l.createdAt?.toISOString().slice(0,10)}`);
      }
    }
  } else {
    console.log("(none — no member has >1 active loan)");
  }

  console.log("\n=== 5. SPECIFIC NRPs FROM SP_0726JULI.xlsx ===");
  const nrps = ["74110018", "75050252", "84051293", "87011378", "72090602"];
  for (const nrp of nrps) {
    const m = await prisma.member.findFirst({
      where: { OR: [{ nrp }, { memberNo: nrp }] },
      select: { id: true, name: true, nrp: true, memberNo: true },
    });
    if (!m) { console.log(`NRP ${nrp}: ❌ TIDAK ADA member`); continue; }
    const loans = await prisma.loan.findMany({
      where: { memberId: m.id },
      select: { loanNo: true, status: true, principalAmount: true, principalOutstanding: true, disbursementDate: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\nNRP ${nrp} = ${m.name} (id ${m.id}): ${loans.length} loan(s)`);
    for (const l of loans) {
      console.log(`   ${l.loanNo} | ${l.status} | pokok=${l.principalAmount} | sisa=${l.principalOutstanding} | tgl=${l.disbursementDate?.toISOString().slice(0,10)} | dibuat=${l.createdAt?.toISOString().slice(0,10)}`);
    }
  }

  console.log("\n=== 6. IMPORT BATCHES (vs_sp undo history) ===");
  const batchCount = await prisma.importBatch.count();
  console.log(`Total ImportBatch records: ${batchCount}`);
  if (batchCount > 0) {
    const batches = await prisma.importBatch.findMany({
      select: { batchNo: true, type: true, period: true, totalRows: true, successCount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.table(batches.map(b => ({ batchNo: b.batchNo, type: b.type, period: b.period, rows: b.totalRows, ok: b.successCount, when: b.createdAt?.toISOString().slice(0,10) })));
  }

  console.log("\n=== 7. RECENT LOAN CREATION (last 60 days) ===");
  const since = new Date(Date.now() - 60 * 86400 * 1000);
  const recent = await prisma.loan.findMany({
    where: { createdAt: { gte: since } },
    select: { loanNo: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Loans created in last 60 days: ${recent.length}`);
  const recentPrefix: Record<string, number> = {};
  for (const l of recent) { const p = (l.loanNo||"").slice(0,6); recentPrefix[p]=(recentPrefix[p]||0)+1; }
  console.table(recentPrefix);

  console.log("\nDONE.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
