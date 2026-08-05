# Haji & Umrah Test-Residue Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete all E2E Playwright test residue from the Haji & Umrah unit in the production Neon DB, leaving the unit pristine (only seed products + admin user remain) with Bank BRI correctly de-inflated.

**Architecture:** One Vitest-tested pure-functions module (`src/lib/services/hu-cleanup.ts`) holds all safety-critical logic (test-txn classification, balance-delta math, guard evaluation). A CLI script (`scripts/cleanup-hu-test-residue.ts`) owns DB I/O, calls the pure functions, enforces guards, writes a CSV backup, and performs the delete inside a single `prisma.$transaction`. Dry-run is the default; `--apply` mutates.

**Tech Stack:** Prisma 6, TypeScript, tsx (script runner), Vitest (unit tests). Neon PostgreSQL.

## Global Constraints

- **Target DB:** production Neon only. The script MUST abort unless `DATABASE_URL` contains `neon.tech`.
- **Dry-run is default.** `--apply` is required to mutate. Never run `--apply` without a prior reviewed dry-run.
- **One transaction.** All deletes + the Bank BRI balance adjustment run inside a single `prisma.$transaction([...])`; any error rolls everything back.
- **Leaf-first deletion order** to satisfy FK constraints (see Task 2 step 4 for exact order).
- **Guards abort before any write:** mixed-account (non-test txn on an H&U account), non-voided bagi-hasil distribution, non-voided talangan loan, test product with refs, CB-row-count out of band `[30, 60]`.
- **Identification is dynamic** (re-derived from live DB each run), never hardcoded IDs.
- **Preserve:** member 776, user `adminhajiumrah@koperasi.com` (1612), seed products TH/TU/TLH/TLU.
- **Expected end state:** H&U accounts = 0, `unitType=haji_umrah` CB txns = 0, bagi-hasil distributions = 0, `unitType=haji_umrah` billing items = 0, test products = 0, Bank BRI (`CashBankAccount` 9) balance `1,424,980,787 → 1,418,651,787`.
- **Spec:** `docs/superpowers/specs/2026-06-25-hu-test-residue-cleanup-design.md` (authoritative inventory + design).

---

## File Structure

- **Create `src/lib/services/hu-cleanup.ts`** — pure functions: `isTestSavingsTxn`, `computeBalanceDeltas`, `evaluateGuards`, plus shared types. No Prisma, no I/O. Unit-tested.
- **Create `src/__tests__/hu-cleanup.test.ts`** — Vitest unit tests for the three pure functions.
- **Create `scripts/cleanup-hu-test-residue.ts`** — CLI: identification queries, guard enforcement, CSV backup, transactional delete, post-run verification.
- **Existing (keep, do not modify):** `scripts/diagnose-hu-*.ts` (4 read-only audit probes), the spec doc.

---

## Task 1: Pure safety functions (TDD)

**Files:**
- Create: `src/lib/services/hu-cleanup.ts`
- Test: `src/__tests__/hu-cleanup.test.ts`

**Interfaces:**
- Produces: `isTestSavingsTxn(txn: SavingsTxnRow): boolean`, `computeBalanceDeltas(rows: CashBankRow[]): Map<number, BalanceDelta>`, `evaluateGuards(input: GuardInput): GuardViolation[]`, and types `SavingsTxnRow`, `CashBankRow`, `BalanceDelta`, `GuardInput`, `GuardViolation`. Task 2 consumes these.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/hu-cleanup.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isTestSavingsTxn,
  computeBalanceDeltas,
  evaluateGuards,
  type SavingsTxnRow,
  type CashBankRow,
} from "@/lib/services/hu-cleanup";

describe("isTestSavingsTxn", () => {
  it("flags explicit E2E marker notes (case-insensitive)", () => {
    expect(isTestSavingsTxn({ id: 1, transactionNo: "HU-2026-1", notes: "Test setoran E2E", createdById: 727 })).toBe(true);
    expect(isTestSavingsTxn({ id: 2, transactionNo: "HU-2026-2", notes: "Test setoran comprehensive E2E", createdById: 727 })).toBe(true);
    expect(isTestSavingsTxn({ id: 3, transactionNo: "HU-2026-3", notes: "e2E Test — talangan via Playwright", createdById: 727 })).toBe(true);
  });
  it("flags bagi-hasil interest by BH- prefix regardless of notes", () => {
    expect(isTestSavingsTxn({ id: 4, transactionNo: "BH-2026-862459170-0", notes: "Bagi Hasil BSI", createdById: 727 })).toBe(true);
  });
  it("flags generic default-note deposit only when created by a known test account (727/1612)", () => {
    expect(isTestSavingsTxn({ id: 5, transactionNo: "HU-2026-4", notes: "Setoran Tabungan Haji", createdById: 1612 })).toBe(true);
    expect(isTestSavingsTxn({ id: 6, transactionNo: "HU-2026-5", notes: "Setoran Tabungan Haji", createdById: 727 })).toBe(true);
    // real teller -> NOT test (guard will abort)
    expect(isTestSavingsTxn({ id: 7, transactionNo: "HU-2026-6", notes: "Setoran Tabungan Haji", createdById: 9999 })).toBe(false);
  });
  it("does not flag a real-looking txn by an unknown creator", () => {
    expect(isTestSavingsTxn({ id: 8, transactionNo: "HU-2026-7", notes: "Setoran bulanan", createdById: 9999 })).toBe(false);
    expect(isTestSavingsTxn({ id: 9, transactionNo: "HU-2026-8", notes: null, createdById: 9999 })).toBe(false);
  });
});

describe("computeBalanceDeltas", () => {
  it("returns empty map for no rows", () => {
    expect(computeBalanceDeltas([]).size).toBe(0);
  });
  it("sums inflows as positive net (delete -> decrement)", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 500000, accountId: 9 },
      { id: 2, transactionNo: "b", type: "in", amount: 2500, accountId: 9 },
    ];
    const d = computeBalanceDeltas(rows).get(9)!;
    expect(d.inSum).toBe(502500);
    expect(d.outSum).toBe(0);
    expect(d.net).toBe(502500);
  });
  it("nets a voided in/out pair to zero", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 3000, accountId: 9 },
      { id: 2, transactionNo: "b", type: "out", amount: 3000, accountId: 9 },
    ];
    expect(computeBalanceDeltas(rows).get(9)!.net).toBe(0);
  });
  it("groups by account and treats out as negative net", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "a", type: "in", amount: 100, accountId: 9 },
      { id: 2, transactionNo: "b", type: "out", amount: 40, accountId: 12 },
    ];
    const map = computeBalanceDeltas(rows);
    expect(map.get(9)!.net).toBe(100);
    expect(map.get(12)!.net).toBe(-40);
  });
  it("produces the documented Bank BRI net (in 6,338,000 / out 9,000 -> 6,329,000)", () => {
    const rows: CashBankRow[] = [
      { id: 1, transactionNo: "all-in", type: "in", amount: 6338000, accountId: 9 },
      { id: 2, transactionNo: "all-out", type: "out", amount: 9000, accountId: 9 },
    ];
    const d = computeBalanceDeltas(rows).get(9)!;
    expect(d.inSum).toBe(6338000);
    expect(d.outSum).toBe(9000);
    expect(d.net).toBe(6329000);
  });
});

describe("evaluateGuards", () => {
  const baseOk = {
    huAccounts: [{ id: 4336, txns: [
      { id: 5277, transactionNo: "HU-1", notes: "Test setoran E2E", createdById: 727 },
      { id: 5285, transactionNo: "HU-2", notes: "Setoran Tabungan Haji", createdById: 1612 },
      { id: 5293, transactionNo: "BH-2026-1-0", notes: "Bagi Hasil BSI", createdById: 727 },
    ] as SavingsTxnRow[] }],
    bagiDistStatuses: [{ id: 1, status: "voided" }],
    talanganLoanStatuses: [{ id: 3438, status: "voided" }],
    testProductRefs: [{ id: 12, accounts: 0, txns: 0 }],
    cbCount: 41,
  };

  it("passes (no violations) for the clean all-test surface", () => {
    expect(evaluateGuards(baseOk)).toEqual([]);
  });
  it("aborts when an H&U account has a non-test txn", () => {
    const v = evaluateGuards({ ...baseOk, huAccounts: [{ id: 4336, txns: [
      { id: 5277, transactionNo: "HU-1", notes: "Test setoran E2E", createdById: 727 },
      { id: 6000, transactionNo: "HU-3", notes: "Setoran bulanan real", createdById: 9999 },
    ] as SavingsTxnRow[] }] });
    expect(v.some((x) => x.type === "mixed_account" && x.accountId === 4336 && x.nonTestTxnIds.includes(6000))).toBe(true);
  });
  it("aborts when a bagi-hasil distribution is not voided", () => {
    const v = evaluateGuards({ ...baseOk, bagiDistStatuses: [{ id: 1, status: "voided" }, { id: 9, status: "processed" }] });
    expect(v.some((x) => x.type === "live_bagi_hasil" && x.distributionIds.includes(9))).toBe(true);
  });
  it("aborts when a talangan loan is not voided", () => {
    const v = evaluateGuards({ ...baseOk, talanganLoanStatuses: [{ id: 3438, status: "voided" }, { id: 999, status: "active" }] });
    expect(v.some((x) => x.type === "live_talangan_loan" && x.loanIds.includes(999))).toBe(true);
  });
  it("aborts when a test product still has accounts or txns", () => {
    const v = evaluateGuards({ ...baseOk, testProductRefs: [{ id: 12, accounts: 2, txns: 0 }] });
    expect(v.some((x) => x.type === "test_product_has_refs")).toBe(true);
  });
  it("aborts when CB row count is below the band", () => {
    const v = evaluateGuards({ ...baseOk, cbCount: 5 });
    expect(v.some((x) => x.type === "cb_count_out_of_band" && x.count === 5)).toBe(true);
  });
  it("aborts when CB row count is above the band", () => {
    const v = evaluateGuards({ ...baseOk, cbCount: 999 });
    expect(v.some((x) => x.type === "cb_count_out_of_band")).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/hu-cleanup.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/services/hu-cleanup"` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/services/hu-cleanup.ts`:

```typescript
/**
 * Pure helpers for the Haji & Umrah test-residue cleanup.
 * Spec: docs/superpowers/specs/2026-06-25-hu-test-residue-cleanup-design.md
 *
 * Framework-free + side-effect-free so they are unit-testable. The CLI script
 * (scripts/cleanup-hu-test-residue.ts) owns all DB I/O and calls these.
 */

/** User ids whose deposits on an H&U account are treated as test residue. */
export const ALLOWED_TEST_CREATOR_IDS = [727, 1612]; // operator, adminhajiumrah

const TEST_NOTES_PATTERNS = ["e2e", "test setoran", "playwright"];
const GENERIC_TEST_NOTE = "Setoran Tabungan Haji";

export type SavingsTxnRow = {
  id: number;
  transactionNo: string;
  notes: string | null;
  createdById: number;
};

export type CashBankRow = {
  id: number;
  transactionNo: string;
  type: string; // "in" | "out"
  amount: number;
  accountId: number;
};

export type BalanceDelta = { inSum: number; outSum: number; net: number };

/**
 * Whether a savings transaction looks like test residue. Used ONLY by the
 * "mixed account" guard — actual deletion removes the whole test account.
 * A generic-note deposit counts as test only if its creator is a known test
 * account; a deposit by any other (real) teller returns false so the guard
 * aborts rather than risk deleting real member activity.
 */
export function isTestSavingsTxn(txn: SavingsTxnRow): boolean {
  const notes = (txn.notes || "").toLowerCase();
  if (TEST_NOTES_PATTERNS.some((p) => notes.includes(p))) return true;
  if ((txn.transactionNo || "").startsWith("BH-")) return true; // bagi-hasil interest credit
  if (txn.notes === GENERIC_TEST_NOTE && ALLOWED_TEST_CREATOR_IDS.includes(txn.createdById)) return true;
  return false;
}

/**
 * Per-CashBankAccount net balance impact of a set of CB rows.
 *  - net > 0: rows inflated the account → deleting them must DECREMENT by net.
 *  - net < 0: rows deflated the account → deleting them must INCREMENT by |net|.
 *  - net = 0: voided in/out pair → no balance change.
 */
export function computeBalanceDeltas(rows: CashBankRow[]): Map<number, BalanceDelta> {
  const map = new Map<number, BalanceDelta>();
  for (const r of rows) {
    const d = map.get(r.accountId) ?? { inSum: 0, outSum: 0, net: 0 };
    const amt = Number(r.amount) || 0;
    if (r.type === "in") {
      d.inSum += amt;
      d.net += amt;
    } else if (r.type === "out") {
      d.outSum += amt;
      d.net -= amt;
    }
    map.set(r.accountId, d);
  }
  return map;
}

export const DEFAULT_CB_BAND = { min: 30, max: 60 };

export type GuardViolation =
  | { type: "mixed_account"; accountId: number; nonTestTxnIds: number[] }
  | { type: "live_bagi_hasil"; distributionIds: number[] }
  | { type: "live_talangan_loan"; loanIds: number[] }
  | { type: "test_product_has_refs"; products: { id: number; accounts: number; txns: number }[] }
  | { type: "cb_count_out_of_band"; count: number; min: number; max: number };

export type GuardInput = {
  huAccounts: { id: number; txns: SavingsTxnRow[] }[];
  bagiDistStatuses: { id: number; status: string }[];
  talanganLoanStatuses: { id: number; status: string }[];
  testProductRefs: { id: number; accounts: number; txns: number }[];
  cbCount: number;
  cbMin?: number;
  cbMax?: number;
};

/** Returns guard violations. The cleanup script aborts (no writes) if non-empty. */
export function evaluateGuards(input: GuardInput): GuardViolation[] {
  const v: GuardViolation[] = [];

  for (const acct of input.huAccounts) {
    const nonTest = acct.txns.filter((t) => !isTestSavingsTxn(t)).map((t) => t.id);
    if (nonTest.length > 0) v.push({ type: "mixed_account", accountId: acct.id, nonTestTxnIds: nonTest });
  }

  const liveBagi = input.bagiDistStatuses.filter((d) => d.status !== "voided").map((d) => d.id);
  if (liveBagi.length > 0) v.push({ type: "live_bagi_hasil", distributionIds: liveBagi });

  const liveLoans = input.talanganLoanStatuses.filter((l) => l.status !== "voided").map((l) => l.id);
  if (liveLoans.length > 0) v.push({ type: "live_talangan_loan", loanIds: liveLoans });

  const refdProducts = input.testProductRefs.filter((p) => p.accounts > 0 || p.txns > 0);
  if (refdProducts.length > 0) v.push({ type: "test_product_has_refs", products: refdProducts });

  const min = input.cbMin ?? DEFAULT_CB_BAND.min;
  const max = input.cbMax ?? DEFAULT_CB_BAND.max;
  if (input.cbCount < min || input.cbCount > max) {
    v.push({ type: "cb_count_out_of_band", count: input.cbCount, min, max });
  }

  return v;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/hu-cleanup.test.ts`
Expected: PASS — all tests in the 3 describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/hu-cleanup.ts src/__tests__/hu-cleanup.test.ts
git commit -m "feat(hu-cleanup): pure safety fns (test-txn classify, balance delta, guards)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: CLI cleanup script (dry-run + apply + backup + verify)

**Files:**
- Create: `scripts/cleanup-hu-test-residue.ts`

**Interfaces:**
- Consumes: `isTestSavingsTxn`, `computeBalanceDeltas`, `evaluateGuards`, types from `../src/lib/services/hu-cleanup`.
- Produces: a runnable script. Exit code 0 on success, non-zero on guard abort / DB error.

- [ ] **Step 1: Write the script**

Create `scripts/cleanup-hu-test-residue.ts`:

```typescript
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
  isTestSavingsTxn,
  type CashBankRow,
  type SavingsTxnRow,
} from "../src/lib/services/hu-cleanup";

const prisma = new PrismaClient({ log: ["error"] });
const APPLY = process.argv.includes("--apply");
const rupiah = (n: unknown) => "Rp " + Number(String(n)).toLocaleString("id-ID", { maximumFractionDigits: 0 });
const sep = "═".repeat(78);

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url.includes("neon.tech")) {
    console.error("ABORT: DATABASE_URL bukan host neon.tech (production). Tidak akan run.");
    console.error("      URL:", url.replace(/:[^:@]+@/, ":****@"));
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
  for (const p of testProducts) lines.push(`savingsProduct,${p.id},${p.code},,,,`);
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
```

- [ ] **Step 2: Run dry-run and verify the manifest matches the spec**

Run: `npx tsx scripts/cleanup-hu-test-residue.ts`
Expected output (MODE: DRY-RUN, Guards passed):
- H&U savings accounts: **1** (`HU-776-10-1715`, m776, bal Rp 5.800.000)
- Savings transactions: **20**
- CashBank rows to delete: **41**
- Bagi-hasil distributions: **3** (all voided)
- Talangan loans: **1**, apps: **1**
- Test products: **4** (`TEST_COMPREHENSIVE`, `TEST_ADMIN_CRUD`, `ADMIN_CRUD_TEST`, `ADMIN_SETUP_TEST`)
- Billing items (haji_umrah): **2**
- Balance adjustment acct 9: **decrement Rp 6.329.000**
- `✅ Guards passed.` then `🔍 DRY-RUN complete.`

If any number differs from the spec's §3.2/§3.3, STOP and reconcile before proceeding.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/cleanup-hu-test-residue.ts
git commit -m "feat(hu-cleanup): CLI script (dry-run + apply + CSV backup + verify)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Dry-run review gate (human checkpoint)

**Files:** none (validation only)

- [ ] **Step 1: Re-run dry-run in the user's terminal so they see live output**

Run: `npx tsx scripts/cleanup-hu-test-residue.ts`
The user reviews the printed manifest + `✅ Guards passed`.

- [ ] **Step 2: Confirm with the user before any `--apply`**

Present the manifest summary and ask: "Dry-run shows [N] rows to delete, Bank BRI −Rp 6.329.000, all guards passed. Proceed with `--apply`?" Do **not** run `--apply` until the user explicitly says yes. (This is a production mutation.)

---

## Task 4: Apply the deletion + verify

**Files:** none (execution only)

**Precondition:** Task 3 step 2 — user explicitly approved `--apply`.

- [ ] **Step 1: Run apply**

Run: `npx tsx scripts/cleanup-hu-test-residue.ts --apply`
Expected: prints backup path, `⚡ Applying N ops in one transaction...`, `✅ Transaction committed.`, then the POST-RUN VERIFICATION block ending with `🎉 CLEANUP SUCCESS — all assertions met.` and exit code 0.

If any verification line mismatches or the script errors, the transaction rolls back and nothing is deleted — report the output to the user.

- [ ] **Step 2: Independent audit — re-run the read-only diagnose scripts**

Run: `npx tsx scripts/diagnose-hu-test-residue.ts`
Expected: every section now shows counts of 0 (no test products, no test user residue beyond the kept admin account, no H&U accounts, no test savings txns, no bagi-hasil residue, no test CB txns). The "RINGKASAN" all read 0.

- [ ] **Step 3: Spot-check the app (optional, user-driven)**

User logs into `/haji-umrah` (operator) and confirms: Tabungan list empty, Talangan list empty, Bagi Hasil list empty, Laporan shows zero activity. Bank BRI balance in `/kas-bank` reflects the new Rp 1.418.651.787.

---

## Task 5: Final commit (backup file + any plan tweaks)

**Files:**
- Add (generated): `scripts/backups/hu-residue-<timestamp>.csv` — the pre-deletion snapshot. Keep it committed as the audit record of what was removed.

- [ ] **Step 1: Commit the backup snapshot**

```bash
git add scripts/backups/hu-residue-*.csv
git commit -m "chore(hu-cleanup): pre-deletion CSV snapshot of removed test residue

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 2: Mark all checkboxes complete and report summary to user**

Report: rows deleted per table, Bank BRI before→after, verification results, backup file path.

---

## Rollback (if needed)

The `--apply` run is a single transaction — if it threw, nothing was deleted. If it succeeded but must be reversed:
1. The CSV backup at `scripts/backups/hu-residue-<ts>.csv` contains every deleted row with its identifying fields.
2. Neon's point-in-time restore (Neon console) can roll the whole DB back to before the run if a fuller undo is required.
3. There is no script-level undo by design (test residue should not be restored); the CSV is the audit record, not a one-click restore.
