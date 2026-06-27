/**
 * Haji & Umrah test-residue cleanup.
 * Spec:  docs/superpowers/specs/2026-06-25-hu-test-residue-cleanup-design.md
 *
 * Usage:
 *   npx tsx scripts/cleanup-hu-test-residue.ts            # DRY-RUN (default, no writes)
 *   npx tsx scripts/cleanup-hu-test-residue.ts --apply    # DELETE inside one transaction
 *
 * Identification is dynamic. Six guards abort before any write. --apply writes
 * a CSV backup first, then deletes leaf-first in one prisma.$transaction,
 * then prints verification assertions.
 */
import { PrismaClient, type PrismaPromise } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  computeBalanceDeltas,
  evaluateGuards,
  type CashBankRow,
  type SavingsTxnRow,
} from "../src/lib/services/hu-cleanup";

const prisma = new PrismaClient({ log: ["error"] });
const APPLY = process.argv.includes("--apply");
const rupiah = (n: unknown) => "Rp " + Number(String(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const sep = "═".repeat(78);

async function main() {
  const url = process.env.DATABASE_URL || "";
  // Guard anti-bypass: parse URL & cek hostname presisi (bukan substring check
  // yang bisa di-bypass via path/query/subdomain spt "neon.tech.evil.com").
  let dbHost = "";
  try {
    dbHost = new URL(url).hostname;
  } catch {
    console.error("ABORT: DATABASE_URL tidak valid (tidak bisa di-parse). Tidak akan run.");
    process.exit(1);
  }
  if (!dbHost.endsWith(".neon.tech")) {
    console.error(`ABORT: host DATABASE_URL "${dbHost}" bukan *.neon.tech (production). Tidak akan run.`);
    process.exit(1);
  }

  console.log(sep);
  console.log(`  H&U TEST-RESIDUE CLEANUP — MODE: ${APPLY ? "⚡ APPLY (menghapus data)" : "🔍 DRY-RUN (no writes)"}`);
  console.log(sep);
  console.log("  DB:", url.replace(/:[^:@]+@/, ":****@"), "\n");

  // ── Identification (dynamic) ──────────────────────────────────────────────
  const huSavingsProducts = await prisma.savingsProduct.findMany({
    where: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
    select: { id: true, code: true, type: true },
  });
  const huSavingsProductIds = huSavingsProducts.map((p) => p.id);

  const huAccounts = await prisma.savingsAccount.findMany({
    where: { productId: { in: huSavingsProductIds } },
    select: { id: true, accountNo: true, memberId: true, balance: true },
  });
  const huAccountIds = huAccounts.map((a) => a.id);

  const huSavingsTxns = huAccountIds.length
    ? await prisma.savingsTransaction.findMany({
        where: { accountId: { in: huAccountIds } },
        select: { id: true, transactionNo: true, notes: true, createdById: true, accountId: true },
      })
    : [];
  const huSavingsTxnIds = huSavingsTxns.map((t) => t.id);

  const cbToDelete = await prisma.cashBankTransaction.findMany({
    where: {
      OR: [
        { unitType: "haji_umrah" },
        { referenceType: { contains: "savings", mode: "insensitive" }, referenceId: { in: huSavingsTxnIds } },
      ],
    },
    select: { id: true, transactionNo: true, type: true, amount: true, accountId: true, unitType: true, description: true },
  });
  const cbIds = cbToDelete.map((c) => c.id);

  const bagiDists = await prisma.bagiHasilDistribution.findMany({
    where: {
      OR: [
        { periodLabel: { contains: "E2E", mode: "insensitive" } },
        { periodLabel: { contains: "TEST", mode: "insensitive" } },
        { status: "voided" },
      ],
    },
    select: { id: true, distributionNo: true, periodLabel: true, status: true },
  });
  const bagiDistIds = bagiDists.map((d) => d.id);

  const talanganProducts = await prisma.loanProduct.findMany({
    where: { type: { in: ["talangan_haji", "talangan_umrah"] } },
    select: { id: true },
  });
  const talanganProductIds = talanganProducts.map((p) => p.id);
  const talanganApps = talanganProductIds.length
    ? await prisma.loanApplication.findMany({
        where: {
          productId: { in: talanganProductIds },
          OR: [
            { notes: { contains: "E2E", mode: "insensitive" } },
            { notes: { contains: "Playwright", mode: "insensitive" } },
            { linkedSavingsAccountId: { in: huAccountIds } },
          ],
        },
        include: { loan: { select: { id: true, status: true } } },
      })
    : [];
  const talanganAppIds = talanganApps.map((a) => a.id);
  const talanganLoanLinks = talanganApps
    .map((a) => (a.loan ? { id: a.loan.id, status: a.loan.status } : null))
    .filter((x): x is { id: number; status: string } => x !== null);
  const talanganLoanIds = talanganLoanLinks.map((l) => l.id);

  const testProducts = await prisma.savingsProduct.findMany({
    where: {
      OR: [
        { code: { in: ["TEST_COMPREHENSIVE", "TEST_ADMIN_CRUD", "ADMIN_CRUD_TEST", "ADMIN_SETUP_TEST"] } },
        { code: { contains: "TEST", mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true },
  });
  const testProductIds = testProducts.map((p) => p.id);
  const testProductRefs = await Promise.all(
    testProductIds.map(async (pid) => ({
      id: pid,
      accounts: await prisma.savingsAccount.count({ where: { productId: pid } }),
      txns: await prisma.savingsTransaction.count({ where: { productId: pid } }),
    }))
  );

  const huBillingItems = await prisma.billingItem.findMany({
    where: { unitType: "haji_umrah" },
    select: { id: true },
  });
  const huBillingItemIds = huBillingItems.map((b) => b.id);

  // ── Guards ────────────────────────────────────────────────────────────────
  const txnsByAccount = new Map<number, SavingsTxnRow[]>();
  for (const t of huSavingsTxns) {
    const arr = txnsByAccount.get(t.accountId) ?? [];
    arr.push({ id: t.id, transactionNo: t.transactionNo, notes: t.notes, createdById: t.createdById });
    txnsByAccount.set(t.accountId, arr);
  }
  const violations = evaluateGuards({
    huAccounts: huAccountIds.map((id) => ({ id, txns: txnsByAccount.get(id) ?? [] })),
    bagiDistStatuses: bagiDists.map((d) => ({ id: d.id, status: d.status })),
    talanganLoanStatuses: talanganLoanLinks,
    testProductRefs,
    cbCount: cbIds.length,
  });

  // ── Balance deltas ────────────────────────────────────────────────────────
  const cbForDelta: CashBankRow[] = cbToDelete.map((c) => ({
    id: c.id, transactionNo: c.transactionNo, type: c.type, amount: Number(c.amount), accountId: c.accountId,
  }));
  const deltas = computeBalanceDeltas(cbForDelta);

  // ── Print manifest ────────────────────────────────────────────────────────
  console.log("MANIFEST:");
  console.log(`  H&U savings accounts      : ${huAccountIds.length}  ${huAccounts.map((a) => a.accountNo + "(m" + a.memberId + ", bal " + rupiah(a.balance) + ")").join(", ")}`);
  console.log(`  Savings transactions      : ${huSavingsTxnIds.length}`);
  console.log(`  CashBank rows to delete   : ${cbIds.length}`);
  console.log(`  Bagi-hasil distributions  : ${bagiDistIds.length}  ${bagiDists.map((d) => d.distributionNo + "(" + d.status + ")").join(", ")}`);
  console.log(`  Talangan loans            : ${talanganLoanIds.length}  apps=${talanganAppIds.length}`);
  console.log(`  Test products             : ${testProductIds.length}  ${testProducts.map((p) => p.code).join(", ")}`);
  console.log(`  Billing items (haji_umrah): ${huBillingItemIds.length}`);
  console.log(`  Balance adjustment per CashBankAccount:`);
  for (const [acctId, d] of deltas) {
    const adj = d.net > 0 ? `decrement ${rupiah(d.net)}` : d.net < 0 ? `increment ${rupiah(-d.net)}` : "no change (net 0)";
    console.log(`    acct ${acctId}: in=${rupiah(d.inSum)} out=${rupiah(d.outSum)} → ${adj}`);
  }
  console.log("");

  if (violations.length > 0) {
    console.log("🛑 GUARD VIOLATIONS — aborting, no writes performed:");
    for (const v of violations) console.log("   -", JSON.stringify(v));
    process.exit(1);
  }
  console.log("✅ Guards passed.\n");

  if (!APPLY) {
    console.log("🔍 DRY-RUN complete. Re-run with --apply to execute the deletion.");
    return;
  }

  // ── Backup (CSV) ──────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(process.cwd(), "scripts", "backups");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `hu-residue-${ts}.csv`);
  const lines: string[] = ["table,id,transactionNo,accountId,type,amount,notesOrDescription"];
  for (const t of huSavingsTxns) lines.push(`savingsTransaction,${t.id},${t.transactionNo},,,${""},${(t.notes || "").replace(/,/g, ";")}`);
  for (const c of cbToDelete) lines.push(`cashBankTransaction,${c.id},${c.transactionNo},${c.accountId},${c.type},${c.amount},${(c.description || "").replace(/,/g, ";")}`);
  for (const d of bagiDists) lines.push(`bagiHasilDistribution,${d.id},${d.distributionNo},,,,${d.periodLabel}(${d.status})`);
  for (const a of talanganApps) lines.push(`loanApplication,${a.id},${a.applicationNo},,,,${(a.notes || "").replace(/,/g, ";")}`);
  for (const l of talanganLoanLinks) lines.push(`loan,${l.id},,,,,${l.status}`);
  for (const p of testProducts) lines.push(`savingsProduct,${p.id},${p.code},,,,,`);
  for (const b of huBillingItems) lines.push(`billingItem,${b.id},,,,,`);
  for (const a of huAccounts) lines.push(`savingsAccount,${a.id},${a.accountNo},,,${a.balance},member${a.memberId}`);
  writeFileSync(backupPath, lines.join("\n"), "utf8");
  console.log(`📁 Backup written: ${backupPath} (${lines.length - 1} rows)\n`);

  // ── Delete (one transaction, leaf-first) ──────────────────────────────────
  const ops: PrismaPromise<unknown>[] = [];

  // 1. bagi-hasil items (plain-Int FK, no cascade) then distributions
  if (bagiDistIds.length) {
    ops.push(prisma.bagiHasilItem.deleteMany({ where: { distributionId: { in: bagiDistIds } } }));
    ops.push(prisma.bagiHasilDistribution.deleteMany({ where: { id: { in: bagiDistIds } } }));
  }
  // 2. talangan subtree: allocations -> payments -> schedules -> loan -> application
  if (talanganLoanIds.length) {
    const loanPayments = await prisma.loanPayment.findMany({ where: { loanId: { in: talanganLoanIds } }, select: { id: true } });
    const loanPaymentIds = loanPayments.map((p) => p.id);
    if (loanPaymentIds.length) ops.push(prisma.loanPaymentAllocation.deleteMany({ where: { paymentId: { in: loanPaymentIds } } }));
    ops.push(prisma.loanPayment.deleteMany({ where: { id: { in: loanPaymentIds } } }));
    ops.push(prisma.loanSchedule.deleteMany({ where: { loanId: { in: talanganLoanIds } } }));
    ops.push(prisma.loan.deleteMany({ where: { id: { in: talanganLoanIds } } }));
  }
  if (talanganAppIds.length) ops.push(prisma.loanApplication.deleteMany({ where: { id: { in: talanganAppIds } } }));
  // 3. Bank balance adjustments (BEFORE deleting the CB rows they came from)
  for (const [acctId, d] of deltas) {
    if (d.net === 0) continue;
    ops.push(prisma.cashBankAccount.update({
      where: { id: acctId },
      data: { currentBalance: d.net > 0 ? { decrement: d.net } : { increment: -d.net } },
    }));
  }
  // 4. cash bank rows
  if (cbIds.length) ops.push(prisma.cashBankTransaction.deleteMany({ where: { id: { in: cbIds } } }));
  // 5. billing items
  if (huBillingItemIds.length) ops.push(prisma.billingItem.deleteMany({ where: { id: { in: huBillingItemIds } } }));
  // 6. savings transactions
  if (huSavingsTxnIds.length) ops.push(prisma.savingsTransaction.deleteMany({ where: { id: { in: huSavingsTxnIds } } }));
  // 7. savings accounts
  if (huAccountIds.length) ops.push(prisma.savingsAccount.deleteMany({ where: { id: { in: huAccountIds } } }));
  // 8. test products
  if (testProductIds.length) ops.push(prisma.savingsProduct.deleteMany({ where: { id: { in: testProductIds } } }));

  console.log(`⚡ Applying ${ops.length} ops in one transaction...`);
  await prisma.$transaction(ops);
  console.log("✅ Transaction committed.\n");

  // ── Verification ──────────────────────────────────────────────────────────
  console.log(sep + "\n  POST-RUN VERIFICATION\n" + sep);
  const v = {
    huAccounts: await prisma.savingsAccount.count({ where: { productId: { in: huSavingsProductIds } } }),
    huCb: await prisma.cashBankTransaction.count({ where: { unitType: "haji_umrah" } }),
    bagi: await prisma.bagiHasilDistribution.count(),
    huBilling: await prisma.billingItem.count({ where: { unitType: "haji_umrah" } }),
    testProducts: await prisma.savingsProduct.count({ where: { code: { contains: "TEST", mode: "insensitive" } } }),
    bri: await prisma.cashBankAccount.findUnique({ where: { id: 9 }, select: { currentBalance: true } }),
    adminUser: await prisma.user.count({ where: { email: "adminhajiumrah@koperasi.com" } }),
    seedProducts: await prisma.savingsProduct.count({ where: { code: { in: ["TH", "TU"] } } }),
  };
  console.log(`  H&U savings accounts       : ${v.huAccounts}  (expect 0)`);
  console.log(`  CB txns unitType=haji_umrah: ${v.huCb}  (expect 0)`);
  console.log(`  BagiHasilDistribution total : ${v.bagi}  (expect 0)`);
  console.log(`  BillingItems haji_umrah    : ${v.huBilling}  (expect 0)`);
  console.log(`  Test products (code ~TEST) : ${v.testProducts}  (expect 0)`);
  console.log(`  Bank BRI (acct 9) balance  : ${rupiah(v.bri?.currentBalance)}  (expect Rp 1.418.651.787)`);
  console.log(`  adminhajiumrah user kept   : ${v.adminUser}  (expect 1)`);
  console.log(`  seed products TH/TU kept   : ${v.seedProducts}  (expect 2)`);
  console.log("");
  const ok = v.huAccounts === 0 && v.huCb === 0 && v.bagi === 0 && v.huBilling === 0 && v.testProducts === 0 && v.adminUser === 1 && v.seedProducts === 2;
  console.log(ok ? "🎉 CLEANUP SUCCESS — all assertions met." : "⚠️  Some assertions did not match expectations — review above.");
  if (!ok) process.exit(1);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
