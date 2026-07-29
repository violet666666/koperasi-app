/**
 * READ-ONLY diagnostic: scope cleanup of 149 SP-MGR duplicate loans (25 Jul 2026).
 * Also writes a local CSV backup (no DB writes).
 *   NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-sp-cleanup-scope.ts
 */
import prisma from "../src/lib/prisma";
import { writeFileSync } from "fs";

async function main() {
  // 1. All SP-MGR loans
  const spMgr = await prisma.loan.findMany({
    where: { loanNo: { startsWith: "SP-MGR/" } },
    include: {
      schedules: { select: { id: true, installmentNo: true, status: true } },
      payments: { select: { id: true, paymentNo: true, amount: true, status: true, journalId: true, cashBankAccountId: true } },
      application: { select: { id: true, applicationNo: true, status: true } },
    },
    orderBy: { loanNo: "asc" },
  });
  console.log(`\n=== SP-MGR loans: ${spMgr.length} ===`);

  // 2. CB/Journal linkage check
  const spMgrIds = spMgr.map(l => l.id);
  const withCashBank = spMgr.filter(l => l.disbursementCashBankId !== null);
  const withJournal = spMgr.filter(l => l.disbursementJournalId !== null);
  const paymentsWithJournal = spMgr.flatMap(l => l.payments.filter(p => p.journalId !== null || p.cashBankAccountId !== null));
  console.log(`Loans with disbursementCashBankId != null: ${withCashBank.length}`);
  console.log(`Loans with disbursementJournalId  != null: ${withJournal.length}`);
  console.log(`Payments on SP-MGR loans with journal/cashBank link: ${paymentsWithJournal.length}`);

  // CashBankTransaction referencing these loan ids?
  const cbRefs = await prisma.cashBankTransaction.findMany({
    where: { referenceId: { in: spMgrIds }, referenceType: { contains: "loan" } },
    select: { id: true, transactionNo: true, referenceType: true, referenceId: true, amount: true },
  });
  console.log(`CashBankTransaction referencing SP-MGR loan ids: ${cbRefs.length}`);

  // 3. Total outstanding (the inflated piutang)
  const totalOutstanding = spMgr.reduce((s, l) => s + Number(l.principalOutstanding), 0);
  console.log(`Total principalOutstanding of SP-MGR loans: Rp ${totalOutstanding.toLocaleString("id-ID")}`);

  // 4. Schedule + payment counts
  const totalSchedules = spMgr.reduce((s, l) => s + l.schedules.length, 0);
  const totalPayments = spMgr.reduce((s, l) => s + l.payments.length, 0);
  const totalApps = spMgr.filter(l => l.application).length;
  console.log(`Schedules: ${totalSchedules} | Payments: ${totalPayments} | Applications: ${totalApps}`);

  // 5. Confirm each SP-MGR has a duplicate SP-IMP counterpart (same member, principal within 1%)
  const allOtherLoans = await prisma.loan.findMany({
    where: { loanNo: { not: { startsWith: "SP-MGR/" } } },
    select: { id: true, loanNo: true, memberId: true, principalAmount: true, status: true },
  });
  let confirmedDup = 0, noCounterpart = 0;
  const noCounterpartList: string[] = [];
  for (const l of spMgr) {
    const counterpart = allOtherLoans.find(x =>
      x.memberId === l.memberId &&
      Math.abs(Number(x.principalAmount) - Number(l.principalAmount)) / Math.max(1, Number(l.principalAmount)) < 0.01
    );
    if (counterpart) confirmedDup++;
    else { noCounterpart++; noCounterpartList.push(`${l.loanNo} (member ${l.memberId}, pokok ${l.principalAmount})`); }
  }
  console.log(`\nConfirmed duplicate (has SP-IMP/PJM counterpart same member+principal±1%): ${confirmedDup}/${spMgr.length}`);
  console.log(`NO counterpart (needs manual review — might be legit new loan): ${noCounterpart}`);
  if (noCounterpartList.length) console.log("  " + noCounterpartList.slice(0, 20).join("\n  "));

  // 6. Status mix
  const byStatus: Record<string, number> = {};
  for (const l of spMgr) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
  console.log(`\nSP-MGR status mix:`, byStatus);

  // 7. CSV backup of the 149 + relations
  const csvLines: string[] = ["loan_id,loan_no,member_id,application_id,status,principal_amount,principal_outstanding,disbursement_cash_bank_id,disbursement_journal_id,schedule_count,payment_count,created_at"];
  for (const l of spMgr) {
    csvLines.push([
      l.id, l.loanNo, l.memberId, l.applicationId, l.status,
      l.principalAmount, l.principalOutstanding,
      l.disbursementCashBankId ?? "", l.disbursementJournalId ?? "",
      l.schedules.length, l.payments.length,
      l.createdAt?.toISOString(),
    ].join(","));
  }
  writeFileSync("qa/sp-mgr-cleanup-backup.csv", csvLines.join("\n"));
  console.log(`\nCSV backup written: qa/sp-mgr-cleanup-backup.csv (${spMgr.length} rows)`);

  // 8. Members still with >1 ACTIVE loan AFTER hypothetical SP-MGR removal
  const activeNonMgr = allOtherLoans.filter(l => l.status === "active");
  const perMember: Record<number, number> = {};
  for (const l of activeNonMgr) perMember[l.memberId] = (perMember[l.memberId] || 0) + 1;
  const stillMulti = Object.values(perMember).filter(n => n > 1).length;
  console.log(`\nMembers with >1 ACTIVE loan AFTER removing SP-MGR: ${stillMulti} (should be small — legit multi-loan members)`);

  console.log("\nDONE — read-only, no DB changes.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
