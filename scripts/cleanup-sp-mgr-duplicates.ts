/**
 * PRODUCTION CLEANUP — delete 149 SP-MGR phantom duplicate loans (import-migrasi 25 Jul 2026).
 * Idempotent + self-guarding: re-verifies safety at runtime, aborts WITHOUT mutation if any check fails.
 * Backup: qa/sp-mgr-cleanup-backup.csv (already written by diagnose-sp-cleanup-scope.ts).
 *
 *   NODE_ENV=production npx tsx --env-file=.env scripts/cleanup-sp-mgr-duplicates.ts
 *
 * FK order per batch: LoanSchedule → Loan → LoanApplication
 *   (Loan.applicationId → LoanApplication is RESTRICT, so Loan must go first).
 */
import prisma from "../src/lib/prisma";

const SAFE = { CB: 0, JOURNAL: 0, PAYMENT_LINK: 0, CB_REF: 0 };
const BATCH = 25;

async function main() {
  console.log("=== SP-MGR DUPLICATE CLEANUP ===");

  // 0. Snapshot before
  const beforeActive = await prisma.loan.count({ where: { status: "active" } });
  const beforeMulti = await countMultiActive();
  console.log(`BEFORE: ${await prisma.loan.count({ where: { loanNo: { startsWith: "SP-MGR/" } } })} SP-MGR loans | ${beforeActive} total active | ${beforeMulti} members w/ >1 active`);

  // 1. Load targets
  const targets = await prisma.loan.findMany({
    where: { loanNo: { startsWith: "SP-MGR/" } },
    select: { id: true, loanNo: true, memberId: true, applicationId: true, principalAmount: true, principalOutstanding: true, status: true, disbursementCashBankId: true, disbursementJournalId: true },
  });
  if (targets.length === 0) {
    console.log("No SP-MGR loans found — nothing to clean. Exiting.");
    return;
  }
  console.log(`Targets: ${targets.length} SP-MGR loans`);

  // 2. RUNTIME SAFETY RE-VERIFY (abort without mutation if any fail)
  const ids = targets.map(t => t.id);
  const appIds = targets.map(t => t.applicationId).filter(Boolean) as number[];

  const cbLinked = targets.filter(t => t.disbursementCashBankId !== null).length;
  const jLinked = targets.filter(t => t.disbursementJournalId !== null).length;
  const paymentsLinked = await prisma.loanPayment.count({
    where: { loanId: { in: ids }, OR: [{ journalId: { not: null } }, { cashBankAccountId: { not: null } }] },
  });
  const cbRefs = await prisma.cashBankTransaction.count({
    where: { referenceId: { in: ids }, referenceType: { contains: "loan" } },
  });
  // Extra: block if any other Loan compensates against these (talangan) or approval pending
  const compensatedBy = await prisma.loan.count({ where: { compensatedLoanId: { in: ids } } });
  const pendingApproval = await prisma.approvalRequest.count({
    where: { referenceType: "loan_application", referenceId: { in: appIds }, status: "pending" },
  });

  console.log(`Re-verify — CB-linked: ${cbLinked} | Journal-linked: ${jLinked} | payment-w-journal: ${paymentsLinked} | CB-refs: ${cbRefs} | compensated-by: ${compensatedBy} | pending-approval: ${pendingApproval}`);

  const abort =
    cbLinked > SAFE.CB || jLinked > SAFE.JOURNAL || paymentsLinked > SAFE.PAYMENT_LINK ||
    cbRefs > SAFE.CB_REF || compensatedBy > 0 || pendingApproval > 0;
  if (abort) {
    console.error("❌ ABORTED — safety check failed. NO DATA CHANGED. Investigate above counters.");
    process.exit(2);
  }
  console.log("✓ Safety checks passed.");

  // 3. Confirm every target has a non-SP-MGR counterpart (same member + principal ±1%)
  const counterparts = await prisma.loan.findMany({
    where: { loanNo: { not: { startsWith: "SP-MGR/" } }, memberId: { in: targets.map(t => t.memberId) } },
    select: { memberId: true, principalAmount: true },
  });
  const noCounterpart = targets.filter(t => !counterparts.some(c =>
    c.memberId === t.memberId &&
    Math.abs(Number(c.principalAmount) - Number(t.principalAmount)) / Math.max(1, Number(t.principalAmount)) < 0.01
  ));
  if (noCounterpart.length > 0) {
    console.error(`❌ ABORTED — ${noCounterpart.length} SP-MGR loans have NO counterpart (might be legit). First: ${noCounterpart[0].loanNo}`);
    process.exit(2);
  }
  console.log(`✓ All ${targets.length} confirmed have a counterpart.`);

  // 4. Transactional batch delete
  let deletedLoans = 0, deletedSchedules = 0, deletedApps = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    const batchIds = batch.map(b => b.id);
    const batchAppIds = batch.map(b => b.applicationId).filter(Boolean) as number[];
    await prisma.$transaction(async (tx) => {
      const s = await tx.loanSchedule.deleteMany({ where: { loanId: { in: batchIds } } });
      const l = await tx.loan.deleteMany({ where: { id: { in: batchIds } } });
      const a = await tx.loanApplication.deleteMany({ where: { id: { in: batchAppIds } } });
      deletedSchedules += s.count; deletedLoans += l.count; deletedApps += a.count;
    });
    process.stdout.write(`.`);
  }
  console.log(`\nDeleted: ${deletedLoans} loans | ${deletedSchedules} schedules | ${deletedApps} applications`);

  // 5. Audit log (best-effort)
  try {
    const opUser = await prisma.user.findFirst({
      where: { role: { name: "operator" } },
      select: { id: true, name: true },
    });
    await prisma.auditLog.create({
      data: {
        userId: opUser?.id ?? 1,
        userName: opUser?.name ?? "system",
        userRole: "operator",
        action: "DELETE",
        module: "Loan_Migrasi",
        description: `Cleanup ${deletedLoans} duplikat loan SP-MGR (phantom import-migrasi 25 Jul 2026). Tidak sentuh CB/Jurnal.`,
        newData: { deletedLoans, deletedSchedules, deletedApps, backup: "qa/sp-mgr-cleanup-backup.csv" },
        ipAddress: "cleanup-script",
      },
    });
    console.log("✓ Audit log written.");
  } catch (e) {
    console.warn("Audit log skipped:", (e as Error).message);
  }

  // 6. Snapshot after
  const afterActive = await prisma.loan.count({ where: { status: "active" } });
  const afterMulti = await countMultiActive();
  const afterSpMgr = await prisma.loan.count({ where: { loanNo: { startsWith: "SP-MGR/" } } });
  console.log(`\nAFTER: ${afterSpMgr} SP-MGR loans | ${afterActive} total active | ${afterMulti} members w/ >1 active`);
  console.log(`Delta: active -${beforeActive - afterActive} | multi-active -${beforeMulti - afterMulti}`);
  console.log("\nDONE. Backup di qa/sp-mgr-cleanup-backup.csv.");
}

async function countMultiActive(): Promise<number> {
  const active = await prisma.loan.findMany({ where: { status: "active" }, select: { memberId: true } });
  const per: Record<number, number> = {};
  for (const l of active) per[l.memberId] = (per[l.memberId] || 0) + 1;
  return Object.values(per).filter(n => n > 1).length;
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
