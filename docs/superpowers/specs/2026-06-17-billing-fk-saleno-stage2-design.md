# Billing FK saleNo (Stage 2) — Design Spec

> Date: 2026-06-17 · Branch: `railway-migration` · Predecessor: `2026-06-16-billing-piutang-detection-fix-design.md`

## 1. Context & Motivation

Stage 1 (shipped + production-verified 2026-06-16) fixed the **stale-snapshot** bug that hid member "Bimasyah IRWA" and ~50 others from `/tagihan`. It introduced pure functions `extractSaleNo` + `buildBillingItems` + a `/refresh` endpoint + `POS-M-` regex coverage.

Stage 1's dedup still relies on a **regex** (`SALE_NO_RE`) parsing a StoreSale's `saleNo` out of a `UnitTransaction.description` **text string**. This is fragile:

- Every new POS prefix (e.g. a future unit) requires editing the regex and risks a re-introduction of the original `POS-M-` double-count bug.
- Two other subsystems (`void-request`/`void-approve`) already depend on the same text-embedding (`description: { contains: storeSale.saleNo }`), so the fragile contract spans more than billing.
- The link between a toko `StoreSale` and its salary-cut `UnitTransaction` is implicit (text) rather than a real column.

Stage 2 makes the link explicit with a real column and demotes the regex to a backward-compat fallback. **It is a robustness refactor, not a bug fix** — Stage 1 already resolves the active defect.

## 2. Data Model Today

- `UnitTransaction` — has `transactionNo` (its own unique ref), `description` (free text), `paymentMethod` (`cash`/`qris`/`salary_cut`), `isPaid`, `status`. **No saleNo field.**
- `StoreSale` — has `saleNo` (unique). **No relation to UnitTransaction.**
- `BillingItem` — `transactionId Int?` + `transactionSource String?` (plain-Int FK snapshot pattern; same philosophy as `BagiHasilDistribution`, see schema comment lines 1496–1500).

**Where saleNo enters UT.description** (toko-family salary_cut only — a StoreSale AND a UnitTransaction are both created):

| Site | Description written |
|------|--------------------|
| `api/toko/sales/route.ts:739` | `Piutang ${unitType} (Potongan Gaji) - ${saleNo}` (web) |
| `api/mobile/toko/route.ts:326` | `Piutang ${unitType} (Mobile Potong Gaji) - ${saleNo}` (mobile, `POS-M-`) |
| `api/toko/split-bill/route.ts:369` | `Piutang ${unitTypeVal} (Potongan Gaji) - Split ${groupId} - ${saleNo}` (split) |

**Non-toko units** (`unit-layanan`: barbershop, cuci_mobil, fotocopy, playstation, fitness, laundry, resto, cafe) create a UnitTransaction as the **sole** record — no StoreSale, no saleNo, no dedup needed. `api/unit-layanan/sales/route.ts:249` + `api/mobile/unit-layanan/route.ts:201` therefore need **no** change.

## 3. Design (chosen)

**Field type: `saleNo String?` (denormalized natural key)** — decided 2026-06-17.
Matches the codebase snapshot philosophy (plain key, no strict relation). `saleNo` is already the natural key used everywhere; a relation (`saleId Int?` → StoreSale) was rejected as more invasive (back-relation on StoreSale + orphan risk on StoreSale delete).

### 3.1 Schema

```prisma
model UnitTransaction {
  ...
  saleNo   String?  @map("sale_no")   // linked StoreSale.saleNo (toko-family salary_cut only)
  ...
  @@index([saleNo])
}
```

Nullable: only toko-family salary_cut rows get a value; all other rows stay null. Indexed for the dedup `IN`/lookup.

### 3.2 Capture dedup (`src/lib/services/billing.ts`)

`BillingCaptureUT` gains `saleNo?: string | null`. In `buildBillingItems`, Source 1:

```ts
const saleNo = ut.saleNo ?? extractSaleNo(ut.description);
if (saleNo) coveredSaleNos.add(saleNo);
```

The regex becomes a **fallback** for rows not yet backfilled (or any backfill miss). `extractSaleNo` stays exported and tested. Source 2 (StoreSale gap) is unchanged — it dedups against `coveredSaleNos`, now populated primarily from the column.

### 3.3 Write sites

The 3 toko-family salary_cut UnitTransaction creations set `saleNo: saleNo` alongside `description`. (The `description` text is kept for human readability + the immutable `BillingItem` snapshot; we do NOT strip the saleNo from description.)

### 3.4 Backfill (one-off)

A script parses existing toko-family `UnitTransaction` rows with `extractSaleNo(description)` and sets `saleNo` where it resolves. Idempotent (only updates rows where `saleNo IS NULL` and a saleNo is extractable). Implemented as `scripts/backfill-saleno.ts` (run once against prod) OR folded into the existing `api/admin/migrate` endpoint pattern.

### 3.5 Audit of stale processed periods (read-only)

`scripts/audit-stale-periods.ts` — for each `BillingPeriod` with `status = "processed"`, recompute the fresh capture window (`buildBillingItems`-equivalent at the period's date range) and report:
- items/members captured at generation time vs. fresh now,
- count + total of salary_cut transactions made **after** `period.createdAt` (the "missed" gap),
- estimated uncollected receivables per period.

**No writes.** The report is handed to the operator; remediation of any financial gap is a manual decision (re-settling processed periods is explicitly OUT of scope — it touches CashBankTransaction/StoreSale.isSettled/UnitTransaction.isPaid and risks corrupting the BRI balance).

## 4. Out of Scope

- Replacing `description: { contains: saleNo }` in `void-request`/`void-approve` with exact `saleNo` lookup. (Nice follow-up; flagged, not done.)
- Removing `extractSaleNo` entirely. It stays as the backward-compat fallback + for parsing immutable `BillingItem.description` snapshots in `process`/`DELETE` routes.
- Auto re-settlement of stale processed periods (see §3.5).
- `BillingItem` schema change. `BillingItem.description` already embeds the saleNo at capture time; `process`/`DELETE` keep parsing it via `extractSaleNo`. No change.

## 5. Invariants (unchanged from Stage 1)

I1 completeness · I2 settled excluded · I3 no double-count (now via `ut.saleNo` primary + saleNo/cross-period) · I4 voided excluded. The fallback regex preserves I3 for legacy rows.

## 6. Risk & Deployment

- **Schema change on Neon**: use `prisma migrate dev` (migration files) — NOT `prisma db push` (times out on Neon per `stock-fix-migration` gotcha). Generate the migration locally, then apply.
- **Dev server DLL lock** (PID holds prisma DLL): stop `:3000` or use the `npx next build` read-only workaround before `prisma generate`.
- **No data loss**: `saleNo` is additive + nullable; capture dedup keeps the regex fallback, so a partial backfill cannot regress detection (Bimasyah stays detected).

## 7. Verification

- Unit tests: `buildBillingItems` prefers `ut.saleNo`; fallback path still works; Bimasyah-equivalent case stays at 7 items.
- Backfill idempotency: re-running changes 0 rows.
- Prod: after migration + backfill, `/tagihan` Mei-Juni draft refresh still yields Bimasyah = 7 items (regression check), and the audit report runs clean (read-only).
