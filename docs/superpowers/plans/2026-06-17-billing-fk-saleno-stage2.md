# Billing FK saleNo (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the fragile regex saleNo dedup with an explicit `UnitTransaction.saleNo` column (regex demoted to backward-compat fallback), backfill existing rows, and add a read-only audit of stale processed periods.

**Architecture:** Add nullable indexed `saleNo String?` to `UnitTransaction` (denormalized natural key, matching BillingItem/BagiHasil snapshot philosophy). `buildBillingItems` dedups via `ut.saleNo ?? extractSaleNo(ut.description)`. The 3 toko-family salary_cut write sites set the column at creation. A one-off backfill parses legacy descriptions. An audit script reports (no writes) the financial gap in processed periods.

**Tech Stack:** Prisma 6 + Neon PostgreSQL, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-17-billing-fk-saleno-stage2-design.md`

---

### Task 1: Schema — add `UnitTransaction.saleNo`

**Files:**
- Modify: `prisma/schema.prisma` (UnitTransaction model, ~line 823)

- [ ] **Step 1: Add the column + index**

In `model UnitTransaction`, after the `notes String?` line (line 835), add:

```prisma
  saleNo            String?   @map("sale_no")            // linked StoreSale.saleNo (toko-family salary_cut only)
```

In the model's indexes (after `@@index([status])`, ~line 856), add:

```prisma
  @@index([saleNo])
```

- [ ] **Step 2: Generate the migration**

Stop the dev server on `:3000` first (it holds the Prisma DLL → `prisma generate` EPERMs). Then:

```bash
npx prisma migrate dev --name add_unit_transaction_saleno --create-only
```

Verify: a new file appears under `prisma/migrations/<ts>_add_unit_transaction_saleno/migration.sql` containing:

```sql
ALTER TABLE "unit_transactions" ADD COLUMN "sale_no" TEXT;
CREATE INDEX "unit_transactions_sale_no_idx" ON "unit_transactions"("sale_no");
```

- [ ] **Step 3: Apply migration + regenerate client**

```bash
npx prisma migrate dev   # applies + regenerates Prisma client
```

If the dev server is still running and `prisma generate` EPERMs, stop it and retry. Verify: `npx tsc --noEmit` shows no NEW errors related to `saleNo`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add UnitTransaction.saleNo column + index (Stage 2)"
```

---

### Task 2: `buildBillingItems` prefers `ut.saleNo` (TDD)

**Files:**
- Modify: `src/lib/services/billing.ts` (`BillingCaptureUT`, `buildBillingItems`)
- Test: `src/__tests__/billing-detection.test.ts` (`UTOver`, `ut()` factory, new tests)

- [ ] **Step 1: Write the failing tests**

In the test file, extend `UTOver` (line 30) and the `ut()` factory (line 35):

```ts
type UTOver = {
  id: number; memberId?: number; unitType?: string; description?: string | null;
  saleNo?: string | null;
  amount?: number; isPaid?: boolean; status?: string;
  member?: { name: string | null; nrp: string | null };
};
const ut = (over: UTOver) => ({
  id: over.id,
  memberId: over.memberId ?? 1,
  unitType: over.unitType ?? "toko",
  description: over.description ?? null,
  saleNo: over.saleNo ?? null,
  amount: over.amount ?? 50000,
  isPaid: over.isPaid ?? false,
  status: over.status ?? "completed",
  member: over.member ?? { name: "Anggota", nrp: "1" },
});
```

Add three tests inside `describe("buildBillingItems", ...)` (after the existing POS-M- no-double-count test):

```ts
  it("I3 ut.saleNo is the primary dedup key (no regex on description needed)", () => {
    const saleNo = "TK-17062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo, description: "Piutang toko - no saleNo text here" })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("unit_transaction");
  });

  it("I3 ut.saleNo takes precedence over a different saleNo in description", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo: "TK-17062026-0002", description: "Piutang toko - TK-17062026-0099" })],
      storeSales: [ss({ id: 9, saleNo: "TK-17062026-0002" })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    // covered by ut.saleNo (0002); StoreSale 0002 deduped → 1 item
    expect(items).toHaveLength(1);
  });

  it("fallback: null ut.saleNo still dedups via extractSaleNo(description)", () => {
    const saleNo = "POS-M-17062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, saleNo: null, description: `Piutang toko (Mobile Potong Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: the 3 new tests FAIL (current `buildBillingItems` ignores `ut.saleNo`, so the StoreSale is NOT deduped → 2 items).

- [ ] **Step 3: Implement — prefer `ut.saleNo`**

In `src/lib/services/billing.ts`:

(a) Add to `BillingCaptureUT` (after `description: string | null;`):

```ts
  saleNo: string | null;
```

(b) In `buildBillingItems`, Source 1, change:

```ts
    const saleNo = extractSaleNo(ut.description);
```

to:

```ts
    const saleNo = ut.saleNo ?? extractSaleNo(ut.description);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: all tests PASS (18 total: 5 extractSaleNo + 13 buildBillingItems).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/billing.ts src/__tests__/billing-detection.test.ts
git commit -m "feat(billing): buildBillingItems prefers ut.saleNo, regex as fallback (Stage 2)"
```

---

### Task 3: Wire `saleNo` select in generate + refresh routes

**Files:**
- Modify: `src/app/api/billing/generate/route.ts` (~lines 100, 122)
- Modify: `src/app/api/billing/[periodId]/refresh/route.ts` (~lines 57, 71)

- [ ] **Step 1: generate route — add to select + map**

In `generate/route.ts`, the `unitTransactions` `select` (line 100), add `saleNo: true,`:

```ts
      select: {
        id: true, memberId: true, unitType: true, description: true, saleNo: true,
        amount: true, isPaid: true, status: true,
        member: { select: { name: true, nrp: true } },
      },
```

In the `unitTransactions.map((ut) => ({ ... }))` (line 121), add `saleNo: ut.saleNo,`:

```ts
      unitTransactions: unitTransactions.map((ut) => ({
        id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description,
        saleNo: ut.saleNo,
        amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status,
        member: ut.member,
      })),
```

- [ ] **Step 2: refresh route — add to select + map**

In `refresh/route.ts`, the `unitTransaction` `select` (line 57), add `saleNo: true,`:

```ts
        select: { id: true, memberId: true, unitType: true, description: true, saleNo: true, amount: true, isPaid: true, status: true, member: { select: { name: true, nrp: true } } },
```

In the `unitTransactions.map((ut) => ({ ... }))` (line 70), add `saleNo: ut.saleNo,`:

```ts
      unitTransactions: unitTransactions.map((ut) => ({
        id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description,
        saleNo: ut.saleNo,
        amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status, member: ut.member,
      })),
```

- [ ] **Step 3: Verify build**

Run: `npx next build` (or `npx tsc --noEmit` on the two files)
Expected: no NEW type errors (the map objects now satisfy `saleNo: string | null`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/generate/route.ts src/app/api/billing/[periodId]/refresh/route.ts
git commit -m "feat(billing): select + map ut.saleNo in generate and refresh (Stage 2)"
```

---

### Task 4: Set `saleNo` at the 3 toko-family write sites

**Files:**
- Modify: `src/app/api/toko/sales/route.ts` (~line 734, salary_cut UT create)
- Modify: `src/app/api/mobile/toko/route.ts` (~line 322)
- Modify: `src/app/api/toko/split-bill/route.ts` (~line 364)

- [ ] **Step 1: toko/sales — set saleNo**

In the `data:` of the salary_cut `tx.unitTransaction.create` (line 735), add `saleNo,` next to `description:`:

```ts
                    data: {
                        transactionNo: `${unitPrefix}-UTG-${Date.now().toString(36).toUpperCase()}`,
                        memberId: memberId,
                        unitType: unitType,
                        description: `Piutang ${unitType} (Potongan Gaji) - ${saleNo}`,
                        saleNo,
                        amount: totalAmount,
                        transactionDate: now,
                        paymentMethod: "salary_cut",
                        isPaid: false,
                        notes: `Auto-generated dari penjualan kasir. No. Transaksi: ${saleNo}`,
                        createdById: userId,
                    },
```

- [ ] **Step 2: mobile/toko — set saleNo**

In the salary_cut `tx.unitTransaction.create` `data:` (line 323), add `saleNo,`:

```ts
                    data: {
                        transactionNo: `MB-UTG-${Date.now().toString(36).toUpperCase()}`,
                        memberId: Number(memberId), unitType,
                        description: `Piutang ${unitType} (Mobile Potong Gaji) - ${saleNo}`,
                        saleNo,
                        amount: totalAmount, transactionDate: now,
                        paymentMethod: "salary_cut",
                        isPaid: false,
                        notes: `Auto-generated dari penjualan kasir mobile. No. Transaksi: ${saleNo}`,
                        createdById: userId,
                    },
```

- [ ] **Step 3: split-bill — set saleNo**

In the salary_cut `tx.unitTransaction.create` `data:` (line 365), add `saleNo,`:

```ts
                        data: {
                            transactionNo: `${unitPrefix}-UTG-${Date.now().toString(36).toUpperCase()}-${sales.length}`,
                            memberId: payment.memberId,
                            unitType: unitTypeVal,
                            description: `Piutang ${unitTypeVal} (Potongan Gaji) - Split ${groupId} - ${saleNo}`,
                            saleNo,
                            amount: paymentAmount,
                            transactionDate: now,
                            paymentMethod: "salary_cut",
                            isPaid: false,
                            notes: `Auto-generated dari penjualan kasir. Split Bill Group: ${groupId}. No. Transaksi: ${saleNo}`,
                            createdById: userId,
                        },
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no NEW type errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/toko/sales/route.ts src/app/api/mobile/toko/route.ts src/app/api/toko/split-bill/route.ts
git commit -m "feat(toko): set UnitTransaction.saleNo on salary_cut creation (web/mobile/split)"
```

---

### Task 5: Backfill legacy rows from description

**Files:**
- Create: `scripts/backfill-saleno.ts`

- [ ] **Step 1: Write the backfill script**

```ts
/**
 * Backfill UnitTransaction.saleNo for legacy toko-family salary_cut rows by
 * parsing the description with extractSaleNo. Idempotent: only updates rows
 * where saleNo IS NULL and a saleNo is extractable. READ the dry-run count first.
 */
import { PrismaClient } from "@prisma/client";
import { extractSaleNo } from "../src/lib/services/billing";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const DRY = process.env.DRY !== "0"; // dry-run by default
  const candidates = await prisma.unitTransaction.findMany({
    where: { saleNo: null, paymentMethod: "salary_cut" },
    select: { id: true, description: true },
  });
  const toUpdate: { id: number; saleNo: string }[] = [];
  for (const ut of candidates) {
    const sn = extractSaleNo(ut.description);
    if (sn) toUpdate.push({ id: ut.id, saleNo: sn });
  }
  console.log(`Candidates (saleNo IS NULL, salary_cut): ${candidates.length}`);
  console.log(`Extractable saleNo: ${toUpdate.length}`);
  if (DRY) { console.log("(dry-run; set DRY=0 to apply)"); return; }
  let n = 0;
  for (const u of toUpdate) {
    await prisma.unitTransaction.update({ where: { id: u.id }, data: { saleNo: u.saleNo } });
    n++;
  }
  console.log(`Updated ${n} rows.`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Dry-run locally**

Run: `npx tsx scripts/backfill-saleno.ts`
Expected: prints candidate + extractable counts, no writes.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-saleno.ts
git commit -m "feat(scripts): backfill UnitTransaction.saleNo from legacy descriptions (idempotent)"
```

---

### Task 6: Audit stale processed periods (read-only)

**Files:**
- Create: `scripts/audit-stale-periods.ts`

- [ ] **Step 1: Write the audit script**

For each `BillingPeriod` with `status = "processed"`: compute the fresh capture for its window and report salary_cut transactions made AFTER `period.createdAt` (the missed gap) + estimated uncollected total. **No writes.**

```ts
/**
 * Read-only audit: for each processed BillingPeriod, report salary_cut transactions
 * in its window that were made AFTER the period was generated (missed by the stale
 * snapshot). NO writes — purely informational for manual remediation decisions.
 */
import { PrismaClient } from "@prisma/client";
import { extractSaleNo } from "../src/lib/services/billing";
const prisma = new PrismaClient({ log: ["error"] });

async function main() {
  const periods = await prisma.billingPeriod.findMany({
    where: { status: "processed" },
    orderBy: { periodStart: "asc" },
    include: { _count: { select: { billingItems: true } } },
  });
  console.log(`Processed periods: ${periods.length}\n`);
  for (const p of periods) {
    const startUTC = p.periodStart;
    const endUTC = new Date(p.periodEnd.getTime() + 86400000 - 1);
    const uts = await prisma.unitTransaction.findMany({
      where: { paymentMethod: "salary_cut", status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
      select: { id: true, amount: true, transactionDate: true },
    });
    const madeAfter = uts.filter((u) => new Date(u.transactionDate) > p.createdAt);
    const gap = madeAfter.reduce((s, u) => s + Number(u.amount), 0);
    const capturedItems = p._count.billingItems;
    console.log(`Period #${p.id} "${p.periodLabel}" [generated ${p.createdAt.toISOString().slice(0,10)}]`);
    console.log(`   window txns (fresh): ${uts.length}  |  billingItems at gen: ${capturedItems}`);
    console.log(`   txns made AFTER generation (potential gap): ${madeAfter.length}  |  est. uncollected: Rp${gap.toLocaleString("id-ID")}\n`);
  }
  console.log("NOTE: read-only. No data changed. Re-settlement is a manual decision (out of scope).");
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it (read-only)**

Run: `npx tsx scripts/audit-stale-periods.ts`
Expected: prints a per-period report; no writes.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-stale-periods.ts
git commit -m "feat(scripts): read-only audit of stale processed billing periods"
```

---

### Task 7: Deploy + verify

- [ ] **Step 1: Local full-suite check**

Run: `npx vitest run src/__tests__/billing-detection.test.ts` → all pass.
Run: `npx next build` → succeeds (ignoreBuildErrors:true; no NEW saleNo errors).

- [ ] **Step 2: Push + deploy**

```bash
git push origin railway-migration
```

Railway auto-deploys. The Prisma migration runs on deploy (Railway runs `prisma migrate deploy` per build, OR apply manually if the build doesn't).

- [ ] **Step 3: Backfill on prod**

After deploy, run the backfill against prod (`DRY=0`), then re-run the audit.

- [ ] **Step 4: Regression check**

On prod, refresh the Mei-Juni draft → Bimasyah STILL = 7 items (the fallback + new column both detect it). Run `audit-stale-periods.ts` → report any financial gap to the operator for manual decision.

- [ ] **Step 5: Update records**

Update `memory/billing-piutang-detection-fix.md` + `.remember` + `CLAUDE.md` gotcha (note saleNo column is now primary; regex is fallback). Mark Stage 2 complete.

---

## Self-Review notes

- Spec coverage: §3.1→Task1, §3.2→Task2, §3.3→Task3+4 (wait — §3.3 writes sites = Task4; §3.2 capture = Task2; route selects = Task3 ✓), §3.4→Task5, §3.5→Task6, §6 deploy→Task7. All spec sections covered.
- The `extractSaleNo` import in scripts works because `src/lib/services/billing.ts` is plain TS (no server-only). Stage 1's verify script already replicated it inline to avoid import friction — but Task 5/6 import directly; if `tsx` chokes on the `@/` alias, use a relative path `../src/lib/services/billing` (already shown).
- `BillingCaptureUT.saleNo` is non-optional `string | null` (not `?`) so route `.map()` callers must always provide it — Task 3 wires both. The `ut()` test factory provides `null` default so existing tests still compile.
