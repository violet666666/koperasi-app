# Billing Piutang Detection Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/billing/generate` reliably detect ALL outstanding potong-gaji receivables (fixes members like "Bimasyah" being invisible), eliminate the stale-snapshot trap via a Refresh capability, and fix the mobile POS-M- double-count — all backed by unit tests.

**Architecture:** Extract the capture/dedup logic from the route handler into pure, DB-free functions in `src/lib/services/billing.ts` (`extractSaleNo`, `buildBillingItems`) so they are unit-testable. The route becomes a thin DB-fetch + pure-transform + persist layer. A new `/refresh` endpoint re-captures a draft's items fresh. No schema change.

**Tech Stack:** Next.js 16 route handlers, Prisma 6, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-16-billing-piutang-detection-fix-design.md`

**Refinement vs spec:** generate keeps its overlap-reject (with a clearer message pointing to Refresh) rather than auto-refreshing; Refresh is a dedicated endpoint. This separates "create new period" from "update existing draft" cleanly.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create (tests) | `src/__tests__/billing-detection.test.ts` | Pure-function tests for `extractSaleNo` + `buildBillingItems` |
| Modify | `src/lib/services/billing.ts` | Add `SALE_NO_RE`, `extractSaleNo`, `buildBillingItems` + types |
| Modify | `src/app/api/billing/generate/route.ts` | Use pure fn + cross-period dedup + clearer overlap message |
| Modify | `src/app/api/billing/[periodId]/process/route.ts` | Use `extractSaleNo` (POS-M- fix) |
| Modify | `src/app/api/billing/[periodId]/route.ts` | DELETE branch uses `extractSaleNo` (POS-M- fix) |
| Create | `src/app/api/billing/[periodId]/refresh/route.ts` | Re-capture a draft's items fresh |
| Modify | `src/app/(protected)/tagihan/page.tsx` | "Refresh" button on drafts |

---

## Task 1: `extractSaleNo` pure function (TDD)

**Files:**
- Create: `src/__tests__/billing-detection.test.ts`
- Modify: `src/lib/services/billing.ts` (append)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/billing-detection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractSaleNo } from "@/lib/services/billing";

describe("extractSaleNo", () => {
  it("matches web toko prefix TK-", () => {
    expect(extractSaleNo("Piutang toko (Potongan Gaji) - TK-16062026-0033"))
      .toBe("TK-16062026-0033");
  });
  it("matches resto RS- and cafe CF-", () => {
    expect(extractSaleNo("... RS-16062026-0029")).toBe("RS-16062026-0029");
    expect(extractSaleNo("... CF-11062026-0059")).toBe("CF-11062026-0059");
  });
  it("matches mobile prefix POS-M- (the bug fix)", () => {
    expect(extractSaleNo("Piutang toko (Mobile Potong Gaji) - POS-M-16062026-0001"))
      .toBe("POS-M-16062026-0001");
  });
  it("matches playstation PS-, resto_cafe RC-, coffe_latar CL-", () => {
    expect(extractSaleNo("x PS-16062026-0001")).toBe("PS-16062026-0001");
    expect(extractSaleNo("x RC-16062026-0001")).toBe("RC-16062026-0001");
    expect(extractSaleNo("x CL-16062026-0001")).toBe("CL-16062026-0001");
  });
  it("returns null when no saleNo present", () => {
    expect(extractSaleNo("Pembayaran cuci_mobil - Walk-in")).toBeNull();
    expect(extractSaleNo(null)).toBeNull();
    expect(extractSaleNo(undefined)).toBeNull();
    expect(extractSaleNo("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: FAIL — `extractSaleNo is not a function` / not exported.

- [ ] **Step 3: Implement minimal code**

Append to `src/lib/services/billing.ts` (after `toggleMemberItems`):

```ts
// ── Billing capture: pure, DB-free logic (unit-tested) ──────────────
// SaleNo prefixes used across POS routes. POS-M- = mobile toko (was missing → double-count bug).
export const SALE_NO_RE =
  /(TK-\d{8}-\d{4}|POS-M-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;

/** Extract a StoreSale saleNo from a UnitTransaction description, or null. */
export function extractSaleNo(
  description: string | null | undefined
): string | null {
  if (!description) return null;
  const m = description.match(SALE_NO_RE);
  return m ? m[1] : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/billing-detection.test.ts src/lib/services/billing.ts
git commit -m "feat(billing): add extractSaleNo pure function with POS-M- prefix coverage"
```

---

## Task 2: `buildBillingItems` pure function (TDD)

**Files:**
- Modify: `src/__tests__/billing-detection.test.ts`
- Modify: `src/lib/services/billing.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/billing-detection.test.ts`:

```ts
import { buildBillingItems } from "@/lib/services/billing";

const ut = (over: Partial<Record<string, unknown>> & { id: number }) => ({
  id: over.id,
  memberId: over.memberId ?? 1,
  unitType: over.unitType ?? "toko",
  description: over.description ?? null,
  amount: over.amount ?? 50000,
  isPaid: over.isPaid ?? false,
  status: over.status ?? "completed",
  member: over.member ?? { name: "Anggota", nrp: "1" },
});
const ss = (over: Partial<Record<string, unknown>> & { id: number }) => ({
  id: over.id,
  saleNo: over.saleNo ?? "TK-16062026-0001",
  memberId: over.memberId ?? 1,
  unitType: over.unitType ?? "toko",
  totalAmount: over.totalAmount ?? 50000,
  metadata: over.metadata ?? null,
  member: over.member ?? { name: "Anggota", nrp: "1" },
});

describe("buildBillingItems", () => {
  it("I1 completeness: emits one item per outstanding UnitTransaction", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, amount: 10000 }), ut({ id: 2, amount: 20000 }), ut({ id: 3, amount: 30000 })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.transactionSource === "unit_transaction")).toBe(true);
  });

  it("I2 settled excluded: isPaid UT is NOT emitted (defense-in-depth)", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, isPaid: true }), ut({ id: 2, isPaid: false })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("I1 status filter: non-completed UT excluded", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, status: "voided" }), ut({ id: 2, status: "completed" })],
      storeSales: [], excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("I3 cross-period dedup: UT id in excludedTxIds is NOT emitted", () => {
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1 }), ut({ id: 2 })],
      storeSales: [], excludedTxIds: new Set([1]), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(2);
  });

  it("Source 2 gap: StoreSale with no matching UT is emitted as store_sale", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, saleNo: "TK-16062026-0007", totalAmount: 44000 })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("store_sale");
    expect(items[0].transactionId).toBe(9);
    expect(items[0].amount).toBe(44000);
  });

  it("I3 POS-M- NO double-count: StoreSale + UT referencing same saleNo → 1 item", () => {
    const saleNo = "POS-M-16062026-0001";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, description: `Piutang toko (Mobile Potong Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionSource).toBe("unit_transaction");
  });

  it("I3 TK- NO double-count (regression): StoreSale + UT → 1 item", () => {
    const saleNo = "TK-16062026-0033";
    const items = buildBillingItems({
      unitTransactions: [ut({ id: 1, description: `Piutang toko (Potongan Gaji) - ${saleNo}` })],
      storeSales: [ss({ id: 9, saleNo })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(1);
  });

  it("I4 voided StoreSale excluded", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, metadata: { isVoided: true } })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });

  it("I2 settled StoreSale excluded (defense)", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9, metadata: { isSettled: true } })],
      excludedTxIds: new Set(), excludedSaleIds: new Set(),
    });
    expect(items).toHaveLength(0);
  });

  it("excludedSaleIds skips that StoreSale", () => {
    const items = buildBillingItems({
      unitTransactions: [],
      storeSales: [ss({ id: 9 }), ss({ id: 10 })],
      excludedTxIds: new Set(), excludedSaleIds: new Set([9]),
    });
    expect(items).toHaveLength(1);
    expect(items[0].transactionId).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: FAIL — `buildBillingItems is not a function`.

- [ ] **Step 3: Implement `buildBillingItems`**

Append to `src/lib/services/billing.ts`:

```ts
// ── buildBillingItems: capture + dedup, pure transform (no DB) ──────
export interface BillingCaptureUT {
  id: number;
  memberId: number;
  unitType: string | null;
  description: string | null;
  amount: number;
  isPaid: boolean;
  status: string;
  member?: { name: string | null; nrp: string | null } | null;
}
export interface BillingCaptureSS {
  id: number;
  saleNo: string;
  memberId: number;
  unitType: string | null;
  totalAmount: number;
  metadata: unknown;
  member?: { name: string | null; nrp: string | null } | null;
}
export interface BillingCaptureInput {
  unitTransactions: BillingCaptureUT[];
  storeSales: BillingCaptureSS[];
  excludedTxIds: Set<number>;
  excludedSaleIds: Set<number>;
}
export interface BillingItemDraft {
  memberId: number;
  memberName: string;
  memberNrp: string | null;
  unitType: string | null;
  transactionId: number;
  // string (not a narrow union) so haji/umrah "savings_account" items can be pushed
  // into the same array by the route without a TS error.
  transactionSource: string;
  description: string;
  amount: number;
}

const CAPTURE_UNIT_LABELS: Record<string, string> = {
  toko: "Toko", resto: "Resto", resto_cafe: "Resto & Cafe",
  cafe_lsp: "Cafe LSP", coffe_latar: "Coffee Latar",
  playstation: "PlayStation", play_station: "PlayStation",
  cuci_mobil: "Cuci Mobil", carwash: "Cuci Mobil",
  barbershop: "Barbershop", fitness: "Fitness", laundry: "Laundry",
  fotocopy: "Fotocopy", simpan_pinjam: "Simpan Pinjam", aset: "Aset",
};

/**
 * Build billing items from fetched UnitTransactions + StoreSales.
 * Pure: deterministic, no side effects, no DB. Callers fetch rows + excluded sets.
 * Invariants enforced: I1 completeness, I2 settled excluded, I3 no double-count,
 * I4 voided excluded. See spec §3.
 */
export function buildBillingItems(input: BillingCaptureInput): BillingItemDraft[] {
  const items: BillingItemDraft[] = [];
  const coveredSaleNos = new Set<string>();

  // Source 1: UnitTransactions
  for (const ut of input.unitTransactions) {
    if (ut.isPaid) continue;                       // I2 settled excluded (defense-in-depth)
    if (ut.status !== "completed") continue;       // I1 only completed receivables
    if (input.excludedTxIds.has(ut.id)) continue;  // I3 cross-period dedup
    const saleNo = extractSaleNo(ut.description);
    if (saleNo) coveredSaleNos.add(saleNo);
    items.push({
      memberId: ut.memberId,
      memberName: ut.member?.name ?? "Unknown",
      memberNrp: ut.member?.nrp ?? null,
      unitType: ut.unitType,
      transactionId: ut.id,
      transactionSource: "unit_transaction",
      description: ut.description ?? "",
      amount: ut.amount,
    });
  }

  // Source 2: StoreSale gap (not voided, not settled, not covered, not excluded)
  for (const ss of input.storeSales) {
    if (input.excludedSaleIds.has(ss.id)) continue; // I3 cross-period dedup
    const meta = ss.metadata as Record<string, unknown> | null;
    if (meta?.isVoided) continue;                   // I4 voided excluded
    if (meta?.isSettled) continue;                  // I2 settled excluded (defense)
    if (coveredSaleNos.has(ss.saleNo)) continue;    // I3 dedup vs UnitTransaction
    const label = CAPTURE_UNIT_LABELS[ss.unitType ?? ""] ?? ss.unitType ?? "Unit";
    items.push({
      memberId: ss.memberId,
      memberName: ss.member?.name ?? "Unknown",
      memberNrp: ss.member?.nrp ?? null,
      unitType: ss.unitType,
      transactionId: ss.id,
      transactionSource: "store_sale",
      description: `Piutang ${label} (Potongan Gaji) - ${ss.saleNo}`,
      amount: ss.totalAmount,
    });
  }

  return items;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/billing-detection.test.ts`
Expected: PASS (all 16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/billing-detection.test.ts src/lib/services/billing.ts
git commit -m "feat(billing): add buildBillingItems pure capture/dedup function with tests"
```

---

## Task 3: Refactor `generate/route.ts` to use pure fn + cross-period dedup

**Files:**
- Modify: `src/app/api/billing/generate/route.ts`

- [ ] **Step 1: Add imports + cross-period exclusion + replace inline capture**

In `src/app/api/billing/generate/route.ts`:

(a) Add import at top (after `import { calculateBillingPeriod }`):

```ts
import { buildBillingItems } from "@/lib/services/billing";
```

(b) Replace the overlap `existing` block's 409 response (lines ~59-64) with a clearer message that points to Refresh:

```ts
    if (existing) {
      const isDraft = existing.status === "draft";
      return NextResponse.json(
        {
          message: isDraft
            ? `Draft untuk periode tumpang-tindih sudah ada (${existing.periodLabel}). Buka draft tersebut lalu klik "Refresh" untuk memperbarui transaksi terbaru, atau hapus draft lalu generate ulang.`
            : `Periode tumpang-tindih sudah ada dan berstatus Diproses (${existing.periodLabel}).`,
          data: existing,
        },
        { status: 409 }
      );
    }
```

(c) Replace the entire inline capture section (the `SALE_NO_RE`, `UNIT_LABELS`, Source 1, `coveredSaleNos`, Source 2, `gapStoreSales`, and the `items.push` loops — roughly lines 70-218 of the original) with:

```ts
    // WIB date boundaries
    const startUTC = periodStart;
    const endUTC = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Cross-period dedup: transactions already claimed by another (non-deleted) period
    // must not be re-added. Prevents the same receivable appearing in two billing runs.
    const claimedItems = await prisma.billingItem.findMany({
      where: { billingPeriod: { NOT: { status: "deleted" } } },
      select: { transactionId: true, transactionSource: true },
    });
    const excludedTxIds = new Set<number>();
    const excludedSaleIds = new Set<number>();
    for (const it of claimedItems) {
      if (it.transactionId == null) continue;
      if (it.transactionSource === "store_sale") excludedSaleIds.add(it.transactionId);
      else excludedTxIds.add(it.transactionId);
    }

    // Source 1: UnitTransaction piutang (outstanding, completed, in window)
    const unitTransactions = await prisma.unitTransaction.findMany({
      where: {
        paymentMethod: "salary_cut",
        isPaid: false,
        status: "completed",
        transactionDate: { gte: startUTC, lte: endUTC },
        memberId: { not: null },
      },
      select: {
        id: true, memberId: true, unitType: true, description: true,
        amount: true, isPaid: true, status: true,
        member: { select: { name: true, nrp: true } },
      },
    });

    // Source 2: salary_cut StoreSales in window (void/settled/exclusion filtered in buildBillingItems)
    const storeSales = await prisma.storeSale.findMany({
      where: {
        paymentMethod: "salary_cut",
        memberId: { not: null },
        createdAt: { gte: startUTC, lte: endUTC },
      },
      select: {
        id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true,
        metadata: true,
        member: { select: { name: true, nrp: true } },
      },
    });

    const items = buildBillingItems({
      unitTransactions: unitTransactions.map((ut) => ({
        id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description,
        amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status,
        member: ut.member,
      })),
      storeSales: storeSales.map((s) => ({
        id: s.id, saleNo: s.saleNo, memberId: s.memberId!, unitType: s.unitType,
        totalAmount: Number(s.totalAmount), metadata: s.metadata, member: s.member,
      })),
      excludedTxIds,
      excludedSaleIds,
    });

    // Source 3: Haji/Umrah savings accounts with monthly target (unchanged)
    const hajiUmrahAccounts = await prisma.savingsAccount.findMany({
      where: {
        status: "active",
        monthlyTarget: { not: null },
        product: { type: { in: ["tabungan_haji", "tabungan_umrah"] }, isActive: true, deletedAt: null },
      },
      select: { id: true, memberId: true, monthlyTarget: true, product: { select: { type: true, name: true } }, member: { select: { name: true, nrp: true } } },
    });
    for (const sa of hajiUmrahAccounts) {
      if (!sa.memberId) continue;
      const typeLabel = sa.product.type === "tabungan_haji" ? "Haji" : "Umrah";
      items.push({
        memberId: sa.memberId,
        memberName: sa.member?.name ?? "Unknown",
        memberNrp: sa.member?.nrp ?? null,
        unitType: "haji_umrah",
        transactionId: sa.id,
        transactionSource: "savings_account",
        description: `Setoran Tabungan ${typeLabel} - ${sa.member?.name ?? "Unknown"}`,
        amount: Number(sa.monthlyTarget),
      });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada transaksi piutang untuk periode ini" },
        { status: 400 }
      );
    }
```

(Keep the rest of the original function: the `memberMap` grouping, `totalAmount`, and `prisma.billingPeriod.create(...)` with `billingItems: { create: items.map(...) }` unchanged — they already consume the `items` array shape.)

- [ ] **Step 2: Typecheck + run all billing tests**

Run: `npx vitest run src/__tests__/billing-period.test.ts src/__tests__/billing-detection.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p tsconfig.json` (or `npm run lint`)
Expected: no errors in `generate/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/generate/route.ts
git commit -m "fix(billing): generate uses buildBillingItems + cross-period dedup, clearer overlap msg"
```

---

## Task 4: Fix `process` + DELETE routes to use `extractSaleNo` (POS-M-)

**Files:**
- Modify: `src/app/api/billing/[periodId]/process/route.ts`
- Modify: `src/app/api/billing/[periodId]/route.ts`

- [ ] **Step 1: process route — replace inline regex**

In `src/app/api/billing/[periodId]/process/route.ts`:

Add import near top:
```ts
import { extractSaleNo } from "@/lib/services/billing";
```

Replace the block (original lines ~64-93):
```ts
      const SALE_NO_RE = /(TK-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;
      const settledAt = new Date().toISOString();

      for (const item of itemsToSettle) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
          const match = item.description?.match(SALE_NO_RE);
          if (match) {
            const saleNo = match[1];
```
with:
```ts
      const settledAt = new Date().toISOString();

      for (const item of itemsToSettle) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
          const saleNo = extractSaleNo(item.description);
          if (saleNo) {
```

- [ ] **Step 2: DELETE route — replace inline regex**

In `src/app/api/billing/[periodId]/route.ts`:

Add import near top (after `import { auth } from "@/lib/auth";`):
```ts
import { extractSaleNo } from "@/lib/services/billing";
```

Inside the `$transaction`, replace (original line ~71 and ~80):
```ts
        const SALE_NO_RE = /(TK-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;
```
→ delete this line entirely.

And replace:
```ts
            const match = item.description?.match(SALE_NO_RE);
            if (match) {
              const saleNo = match[1];
```
with:
```ts
            const saleNo = extractSaleNo(item.description);
            if (saleNo) {
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/billing/[periodId]/process/route.ts src/app/api/billing/[periodId]/route.ts
git commit -m "fix(billing): process + DELETE use extractSaleNo (POS-M- mobile double-count fix)"
```

---

## Task 5: New `/refresh` endpoint

**Files:**
- Create: `src/app/api/billing/[periodId]/refresh/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/billing/[periodId]/refresh/route.ts`:

```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildBillingItems } from "@/lib/services/billing";

// POST /api/billing/[periodId]/refresh — Re-capture a DRAFT period's items from current data.
// Fixes the stale-snapshot problem: transactions made AFTER the period was first generated
// are now included. Preserves per-item isMarkedPaid by matching (transactionSource, transactionId).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;
    const id = parseInt(periodId);

    const period = await prisma.billingPeriod.findUnique({
      where: { id },
      include: { billingItems: true },
    });
    if (!period) {
      return NextResponse.json({ message: "Period tidak ditemukan" }, { status: 404 });
    }
    if (period.status !== "draft") {
      return NextResponse.json({ message: "Hanya draft yang bisa di-refresh" }, { status: 400 });
    }

    const startUTC = period.periodStart;
    const endUTC = new Date(period.periodEnd.getTime() + 24 * 60 * 60 * 1000 - 1);

    // Cross-period dedup: exclude transactions claimed by OTHER periods (not this one).
    const claimedItems = await prisma.billingItem.findMany({
      where: { billingPeriodId: { not: id } },
      select: { transactionId: true, transactionSource: true },
    });
    const excludedTxIds = new Set<number>();
    const excludedSaleIds = new Set<number>();
    for (const it of claimedItems) {
      if (it.transactionId == null) continue;
      if (it.transactionSource === "store_sale") excludedSaleIds.add(it.transactionId);
      else excludedTxIds.add(it.transactionId);
    }

    const [unitTransactions, storeSales, hajiUmrahAccounts] = await Promise.all([
      prisma.unitTransaction.findMany({
        where: { paymentMethod: "salary_cut", isPaid: false, status: "completed", transactionDate: { gte: startUTC, lte: endUTC }, memberId: { not: null } },
        select: { id: true, memberId: true, unitType: true, description: true, amount: true, isPaid: true, status: true, member: { select: { name: true, nrp: true } } },
      }),
      prisma.storeSale.findMany({
        where: { paymentMethod: "salary_cut", memberId: { not: null }, createdAt: { gte: startUTC, lte: endUTC } },
        select: { id: true, saleNo: true, memberId: true, unitType: true, totalAmount: true, metadata: true, member: { select: { name: true, nrp: true } } },
      }),
      prisma.savingsAccount.findMany({
        where: { status: "active", monthlyTarget: { not: null }, product: { type: { in: ["tabungan_haji", "tabungan_umrah"] }, isActive: true, deletedAt: null } },
        select: { id: true, memberId: true, monthlyTarget: true, product: { select: { type: true } }, member: { select: { name: true, nrp: true } } },
      }),
    ]);

    const items = buildBillingItems({
      unitTransactions: unitTransactions.map((ut) => ({ id: ut.id, memberId: ut.memberId!, unitType: ut.unitType, description: ut.description, amount: Number(ut.amount), isPaid: ut.isPaid, status: ut.status, member: ut.member })),
      storeSales: storeSales.map((s) => ({ id: s.id, saleNo: s.saleNo, memberId: s.memberId!, unitType: s.unitType, totalAmount: Number(s.totalAmount), metadata: s.metadata, member: s.member })),
      excludedTxIds, excludedSaleIds,
    });
    for (const sa of hajiUmrahAccounts) {
      if (!sa.memberId) continue;
      const typeLabel = sa.product.type === "tabungan_haji" ? "Haji" : "Umrah";
      items.push({ memberId: sa.memberId, memberName: sa.member?.name ?? "Unknown", memberNrp: sa.member?.nrp ?? null, unitType: "haji_umrah", transactionId: sa.id, transactionSource: "savings_account", description: `Setoran Tabungan ${typeLabel} - ${sa.member?.name ?? "Unknown"}`, amount: Number(sa.monthlyTarget) });
    }

    // Preserve isMarkedPaid for items that still exist (matched by source + txId).
    const prevMarked = new Set<string>();
    for (const it of period.billingItems) {
      if (it.isMarkedPaid && it.transactionId != null) prevMarked.add(`${it.transactionSource}:${it.transactionId}`);
    }

    const memberMap = new Map<number, { name: string; nrp: string | null }>();
    for (const it of items) {
      if (!memberMap.has(it.memberId)) memberMap.set(it.memberId, { name: it.memberName, nrp: it.memberNrp });
    }
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

    const before = period.billingItems.length;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.billingItem.deleteMany({ where: { billingPeriodId: id } });
      if (items.length > 0) {
        await tx.billingItem.createMany({
          data: items.map((it) => ({
            billingPeriodId: id,
            memberId: it.memberId,
            memberName: it.memberName,
            memberNrp: it.memberNrp,
            unitType: it.unitType,
            transactionId: it.transactionId,
            transactionSource: it.transactionSource,
            description: it.description,
            amount: it.amount,
            isMarkedPaid: prevMarked.has(`${it.transactionSource}:${it.transactionId}`),
          })),
        });
      }
      return tx.billingPeriod.update({
        where: { id },
        data: { totalMembers: memberMap.size, totalAmount },
        include: { billingItems: true },
      });
    });

    return NextResponse.json({
      message: `Draft di-refresh: ${before} → ${items.length} item (${memberMap.size} anggota).`,
      data: updated,
    });
  } catch (error) {
    console.error("POST /api/billing/[periodId]/refresh error:", error);
    return NextResponse.json({ message: "Failed to refresh period" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/billing/[periodId]/refresh/route.ts
git commit -m "feat(billing): add /refresh endpoint to re-capture draft items from current data"
```

---

## Task 6: UI "Refresh" button on drafts

**Files:**
- Modify: `src/app/(protected)/tagihan/page.tsx`

- [ ] **Step 1: Add Refresh state + handler**

In `src/app/(protected)/tagihan/page.tsx`:

(a) Add `RefreshCw` to the lucide-react import list (line ~20-33):
```ts
  RefreshCw,
```
(add it among the imported icons)

(b) Add state next to `const [processing, setProcessing] = React.useState(false);`:
```ts
  const [refreshing, setRefreshing] = React.useState(false);
```

(c) Add handler after `handleSettle` (after line ~225):
```ts
  const handleRefresh = async () => {
    if (!period) return;
    if (!confirm(`Refresh draft ${period.periodLabel}?\n\nTransaksi potong-gaji terbaru dalam periode ini akan ditambahkan. Item yang sudah ditandai lunas dipertahankan.`)) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/${period.id}/refresh`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || "Gagal refresh");
      } else {
        await fetchPeriod(period.id);
        fetchPeriods();
      }
    } catch {
      setError("Gagal refresh");
    } finally {
      setRefreshing(false);
    }
  };
```

- [ ] **Step 2: Add the Refresh button (drafts only)**

In the `actions` of `<PageHeader>` (near the Hapus button, ~line 374-384), insert BEFORE the Hapus button:

```tsx
            {period && isDraft && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing || processing}
              >
                {refreshing ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 sm:mr-2" />}
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}
```

- [ ] **Step 3: Typecheck / build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/tagihan/page.tsx"
git commit -m "feat(tagihan): add Refresh button on drafts to pull latest potong-gaji transactions"
```

---

## Task 7: Verification

- [ ] **Step 1: Full unit test suite**

Run: `npm run test`
Expected: all pass (including new `billing-detection.test.ts`).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 3: Re-run Bimasyah diagnostic (root-cause confirmation, read-only)**

Run: `set -a && . ./.env && set +a && npx tsx scripts/diagnose-bima.ts bima`
Expected: BIMASYAH IRWA still shows 7 outstanding items in the May-June window (these are the ones Refresh will now capture).

- [ ] **Step 4: Manual flow (operator, on running app)**

1. Open `/tagihan`, select the "Mei-Juni 2026" draft.
2. Click **Refresh** → confirm item/member count increases (Bimasyah appears with ~Rp324.900).
3. Verify no duplicate items, settled/voided excluded.
4. (Optional) Generate a new June-July period → Bimasyah's 2 transactions from 2026-06-16 appear.

- [ ] **Step 5: Commit diagnostic scripts (optional, useful for future)**

```bash
git add scripts/diagnose-bima.ts scripts/diagnose-period-timing.ts
git commit -m "chore: add billing detection diagnostic scripts"
```

---

## Done criteria

- [ ] All 16 `billing-detection` tests pass; existing tests green.
- [ ] `generate`, `process`, DELETE no longer contain inline `SALE_NO_RE`.
- [ ] `/refresh` endpoint exists and is RBAC-guarded (`manage_all`).
- [ ] Refresh button shows only on drafts.
- [ ] Bimasyah (and the ~50 trapped members) appear after Refresh.
- [ ] `npm run lint` + `npm run build` clean.
