# Billing Piutang Detection Fix — Design Spec

> **Date:** 2026-06-16
> **Branch:** `railway-migration`
> **Scope:** Stage 1 — fix detection miss for potong-gaji receivables (e.g. member "Bimasyah")
> **Related:** `OPERATOR.md` §1 Tagihan Piutang, `src/app/api/billing/*`, `src/lib/services/billing.ts`

---

## 1. Problem Statement

### Symptom
Operator generates a billing period at `/tagihan`, but members who transacted with
`salary_cut` (potong gaji) are **missing** from the generated items — e.g. member
**BIMASYAH IRWA (#1564)**, who has 8 outstanding salary-cut transactions dated June 3–13,
appears in **none** of the existing billing periods.

### Root Cause (confirmed via DB evidence)
`POST /api/billing/generate` captures receivables as a **one-time point-in-time snapshot**:

- The "Mei-Juni 2026" draft was created (`createdAt`) on **2026-05-22**.
- **191 of 213** salary-cut transactions inside that period's date window were made
  *after* the snapshot — so they are **not** in the draft.
- A generated draft **blocks regeneration** (overlap check, `generate/route.ts:51-64`),
  so those late transactions are **trapped permanently** until the draft is deleted.

There is also a **conceptual inconsistency**: the *plafon piutang* validation
(`toko/sales`, `unit-layanan/sales`) sums **all** outstanding `salary_cut` with **no date
filter** (running balance), but billing `generate` filters by a **date-window snapshot**.
A member's "active tagihan" (for plafon) ≠ what billing collects.

### Secondary (latent) bug
Mobile POS salary-cut sales use saleNo prefix `POS-M-DDMMYYYY-NNNN`
(`mobile/toko/route.ts:162`), which the dedup regex `SALE_NO_RE`
(`generate/route.ts:75`, `process/route.ts:65`) does **not** match. Result: a single
mobile potong-gaji sale is captured **twice** (once via UnitTransaction, once via the
un-covered StoreSale gap). Not Bimasyah's issue (he used the website) but must be fixed.

### Tertiary (architectural)
Dedup relies on regex-extracting a saleNo from a free-text `description`. Brittle.
Deferred to Stage 2 (explicit FK).

---

## 2. Goals & Non-Goals

### Goals
1. **G1 — Completeness:** every outstanding salary-cut transaction
   (`paymentMethod="salary_cut"`, `isPaid=false`, `status="completed"`) inside the
   selected period window is captured when a period is generated or refreshed.
2. **G2 — No re-detection:** a settled transaction (`isPaid=true`) is **never** captured
   again.
3. **G3 — No double-count:** one physical transaction yields exactly one billing item
   (dedup StoreSale↔UnitTransaction, and across billing periods).
4. **G4 — Freshness:** a draft can be **refreshed** to re-capture current data, so no
   snapshot is ever stale. Processed periods remain immutable.
5. **G5 — Fix POS-M- mobile double-count.**
6. **G6 — Testability:** capture/dedup logic extracted to pure functions with unit tests
   (TDD).

### Non-Goals (Stage 2 / out of scope)
- Explicit FK `UnitTransaction.saleNo` → eliminate regex dedup (Stage 2).
- Audit/backfill of already-**processed** stale periods.
- Changing the 16–15 cycle / period model.
- Changing plafon validation semantics.

---

## 3. Invariants (enforced + tested)

| # | Invariant | Mechanism |
|---|-----------|-----------|
| I1 | All outstanding salary-cut tx in window captured | `isPaid=false, status="completed", transactionDate ∈ window` |
| I2 | Settled tx never re-detected | `isPaid=false` filter; settle sets `isPaid=true` |
| I3 | One tx → one item | dedup StoreSale↔UT (saleNo) + cross-period (txId not in other active BillingItems) |
| I4 | Voided sales excluded | `metadata.isVoided` filter in JS |
| I5 | Draft refreshable, processed immutable | refresh endpoint only on `status="draft"` |

---

## 4. Data Model — NO schema change (Stage 1)

Reuse existing columns:
- `BillingItem.transactionId` + `transactionSource` (`unit_transaction` | `store_sale` | `savings_account`) — cross-period dedup.
- `UnitTransaction.isPaid` — outstanding filter.
- `StoreSale.metadata.isVoided` / `isSettled` — voided/settled filter.

No migration required. (Neon uses `db push`; nothing to push.)

---

## 5. Design

### 5.1 Pure functions — `src/lib/services/billing.ts`

Extract the inline route logic into deterministic, DB-free, unit-testable functions:

```ts
// Complete saleNo prefixes (web + mobile). Added POS-M- (mobile).
export const SALE_NO_RE =
  /(TK-\d{8}-\d{4}|POS-M-\d{8}-\d{4}|MB-\d{8}-\d{4}|RS-\d{8}-\d{4}|PS-\d{8}-\d{4}|CF-\d{8}-\d{4}|CL-\d{8}-\d{4}|RC-\d{8}-\d{4})/;

export function extractSaleNo(description: string | null | undefined): string | null;

// Inputs are already-fetched DB rows (route does the DB work). Pure transform + dedup.
// NOTE: rows include isPaid/status so buildBillingItems can DEFENSIVELY re-filter
// (caller already filters at query level — defense-in-depth for a financial fn).
export interface BillingCaptureInput {
  unitTransactions: Array<{ id; memberId; unitType; description; amount; isPaid; status; member? }>;
  storeSales: Array<{ id; saleNo; memberId; unitType; totalAmount; metadata; createdAt; member? }>;
  excludedTxIds: Set<number>;   // UnitTransaction ids already in other active BillingItems (cross-period dedup)
  excludedSaleIds: Set<number>; // StoreSale ids already in other active BillingItems
}
export interface BillingItemDraft { memberId; memberName; memberNrp; unitType; transactionId; transactionSource; description; amount; }

export function buildBillingItems(input: BillingCaptureInput): BillingItemDraft[];
```

`buildBillingItems` implements Source 1 (UT) + Source 2 (StoreSale gap, deduped by
`coveredSaleNos = extractSaleNo(ut.description)` for each UT, **now including POS-M-**),
excluding voided StoreSales, ids in `excludedTxIds`/`excludedSaleIds`, and —
defensively — any UT with `isPaid=true` or `status!=="completed"` (I2 at the pure layer).

### 5.2 `generate/route.ts` changes

- Fetch windowed rows (as today).
- Build `excludedTxIds`/`excludedSaleIds` = ids already present in `BillingItem` of
  **other** non-deleted BillingPeriods (cross-period dedup → no re-add across runs).
- Call `buildBillingItems(...)`.
- **Idempotent refresh:** if a draft already exists for an overlapping window → instead
  of 409, **replace** its items with the freshly captured set (delete old items, create
  new), update `totalMembers`/`totalAmount`. Period id stable. `processed` periods still
  reject with 409.
- Haji/Umrah (Source 3) unchanged.

### 5.3 New endpoint — `POST /api/billing/[periodId]/refresh`

- Operator-only (`manage_all`).
- Only if `period.status === "draft"` (else 400).
- Re-runs capture for the period's own window, replaces items (same logic as 5.2 refresh).
- Returns updated period.

### 5.4 `process/route.ts` change

- Replace inline `SALE_NO_RE` with imported `extractSaleNo` (POS-M- fix). No logic change.

### 5.5 UI — `/tagihan`

- "Refresh" button on draft rows (calls `/refresh`). Visible only for `status="draft"`.
- Confirm dialog. Toast on success with item/member delta.

### 5.6 Backward compatibility
- Existing `processed` periods untouched (immutable).
- Existing draft (Mei-Juni) becomes refreshable → Bimasyah appears after refresh.

---

## 6. Testing (TDD — tests written FIRST)

New file `src/__tests__/billing-detection.test.ts` (pure-function tests, no DB):

1. `extractSaleNo` matches `TK-`, `RS-`, `CF-`, `CL-`, `PS-`, `RC-`, `POS-M-`.
2. **Completeness**: 3 outstanding UTs in window → 3 items.
3. **Settled excluded (I2, defense-in-depth)**: a UT passed in with `isPaid=true` (or
   `status!=="completed"`) → **not** emitted, even if the caller forgot to filter.
4. **Cross-period dedup (I3)**: UT id in `excludedTxIds` → not emitted.
5. **StoreSale gap**: salary-cut StoreSale with no matching UT → emitted as `store_sale` item.
6. **POS-M- no double-count**: StoreSale `POS-M-…` + UT whose description embeds same saleNo
   → exactly **1** item.
7. **Web TK- no double-count**: same for `TK-…` (regression).
8. **Voided StoreSale excluded**.
9. **Member grouping**: multiple items same member → distinct items (totals computed by caller).

Route-level (manual / E2E later): generate idempotent refresh, refresh endpoint RBAC,
processed period rejects refresh.

---

## 7. Verification Plan

1. `npm run test` — all billing-detection tests pass, existing tests green.
2. Re-run `scripts/diagnose-bima.ts` — Bimasyah classification unchanged (still outstanding).
3. After deploy/refresh: confirm Bimasyah appears in refreshed Mei-Juni draft (7 items,
   Rp324.900) via diagnostic or UI.
4. `npm run lint` + `npm run build` clean.

---

## 8. Rollout / Unblock Bimasyah

Once Stage 1 ships: operator opens `/tagihan` → clicks **Refresh** on "Mei-Juni 2026"
draft → items re-captured from current data → Bimasyah (and the other ~50 trapped members)
appear → settle as usual.

---

## 9. Stage 2 (deferred, separate PR)

- Add `UnitTransaction.saleNo String?` (FK-ish link to StoreSale) + populate on creation
  in `toko/sales`, `toko/split-bill`, `mobile/toko`.
- Replace regex dedup with exact-column match.
- Backfill existing rows by parsing descriptions.
- Audit already-processed stale periods for mis-recorded settlements.

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| Idempotent refresh changes item ids → UI references stale ids | UI refetches after refresh; items are recreated each refresh |
| Cross-period dedup excludes a tx stuck in a *deleted-but-not-yet* period | Dedup only considers non-deleted periods; deleted period items cascade-removed |
| `excludedTxIds` query large | Bounded by #active salary-cut tx; indexed by `memberId`/`transactionId` |
| Operator confusion "why did total change after refresh" | Toast shows delta; documentation in OPERATOR.md |
