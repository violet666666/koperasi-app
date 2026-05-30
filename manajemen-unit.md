# Manajemen Unit — Code Review & Audit

> **Route:** `/manajemen-unit` | **Audit Date:** 2026-05-30 | **Branch:** `railway-migration`
> **Role:** Operator-only (`manage_all` permission)

---

## 1. Architecture Overview

### File Structure (14 files)

```
src/app/(protected)/manajemen-unit/
├── page.tsx                          # Dashboard — card grid of all 9 units
└── [unitSlug]/page.tsx               # Detail — stats, products, transactions per unit

src/app/api/manajemen-unit/
├── stats/route.ts                    # GET — aggregated stats for all units
└── [unitSlug]/
    ├── stats/route.ts                # GET — per-unit detail stats + 7-day chart
    ├── products/route.ts             # GET — paginated product listing
    └── transactions/route.ts         # GET — paginated transaction listing

src/lib/
├── constants/units.ts                # UNIT_TYPES registry (9 units) + helpers
└── services/manajemen-unit.ts        # Pure business logic (aggregateUnitStats, computeUnitDetail)

src/__tests__/
├── manajemen-unit.test.ts            # Tests for aggregateUnitStats
├── manajemen-unit-detail.test.ts     # Tests for computeUnitDetail
└── unit-constants.test.ts            # Tests for UNIT_TYPES helpers
```

### Data Flow

```
Main Dashboard (/manajemen-unit)
  │
  ├─→ GET /api/manajemen-unit/stats
  │     ├─ Queries StoreProduct, StoreSale, UnitTransaction per unitType (parallel)
  │     ├─ Calls aggregateUnitStats() → { totalUnits, totalProducts, totalTransactions, totalRevenue, units[] }
  │     └─ Returns AggregatedStats
  │
  └─→ Renders 4 summary cards + 9 unit cards linking to /manajemen-unit/{slug}

Unit Detail (/manajemen-unit/[unitSlug])
  │
  ├─→ GET /api/manajemen-unit/{slug}/stats     ─→ stat cards + bar chart
  ├─→ GET /api/manajemen-unit/{slug}/products   ─→ product table
  └─→ GET /api/manajemen-unit/{slug}/transactions ─→ transaction table
      (3 fetches in parallel via Promise.all)
```

### Unit Registry (UNIT_TYPES)

| Key | Label | Slug | Category | Icon |
|-----|-------|------|----------|------|
| `toko` | Toko PRIMKOPPOL | `toko` | store | Store |
| `cafe_lsp` | Cafe LSP | `cafe-lsp` | store | Coffee |
| `resto` | Resto & Cafe | `resto` | store | UtensilsCrossed |
| `cuci_mobil` | Cuci Mobil & Motor | `cuci-mobil` | service | Car |
| `barbershop` | Barbershop | `barbershop` | service | Scissors |
| `fitness` | Fitness | `fitness` | service | Dumbbell |
| `playstation` | Play Station | `playstation` | service | Gamepad2 |
| `fotocopy` | Fotocopy | `fotocopy` | service | Printer |
| `laundry` | Laundry | `laundry` | service | Shirt |

**Slug mapping:** `cafe_lsp` ↔ `cafe-lsp`, `cuci_mobil` ↔ `cuci-mobil` (underscore ↔ hyphen)

---

## 2. Security Review

### ✅ Auth Pattern (All 4 API endpoints)

All endpoints use consistent auth:

```typescript
const session = await auth();
if (!session?.user?.id) return 401;
const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
if (!permissions.includes("manage_all")) return 403;
```

| Endpoint | Auth | Permission | Status |
|----------|------|------------|--------|
| `GET /api/manajemen-unit/stats` | ✅ session + manage_all | Operator-only | OK |
| `GET /api/manajemen-unit/[slug]/stats` | ✅ session + manage_all | Operator-only | OK |
| `GET /api/manajemen-unit/[slug]/products` | ✅ session + manage_all | Operator-only | OK |
| `GET /api/manajemen-unit/[slug]/transactions` | ✅ session + manage_all | Operator-only | OK |

### ✅ Slug Validation

Both `[unitSlug]` endpoints validate via `slugToUnitType()` → returns `null` for invalid slugs → 404 response.

### ✅ Voided Transaction Filtering

All queries correctly exclude voided data:
- StoreSale: `NOT: { metadata: { path: ["isVoided"], equals: true } }`
- UnitTransaction: `status: { not: "voided" }`

---

## 3. Bugs Found & Fixed

### Issue #1 — Dead Navigation Link (FIXED)

**Severity:** MEDIUM | **File:** `src/lib/constants/navigation.ts`

**Problem:** Nav menu had "Pengaturan Unit" child pointing to `/manajemen-unit/pengaturan` but no page file existed. Clicking the link would show a 404 or blank page.

**Fix:** Removed the dead nav entry. Only "Dashboard Unit" remains.

---

### Issue #2 — No Error State in UI (FIXED)

**Severity:** MEDIUM | **Files:** Both page components

**Problem:** When API fetch fails, both pages silently show empty data with no user-facing error message. The `catch` block only `console.error`s — the user sees skeleton loading disappear but no data and no explanation.

**Fix:** Added `error` state to both pages. On fetch failure, shows a red error banner: "Gagal memuat data unit. Silakan coba lagi."

---

### Issue #3 — No HTTP Status Check (FIXED)

**Severity:** LOW | **File:** `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

**Problem:** Detail page fetches 3 APIs in parallel but calls `.json()` without checking `res.ok`. A 403 or 500 response would produce confusing JSON parse errors instead of meaningful error messages.

**Fix:** Added status check after `Promise.all` fetch with error logging.

---

### Issue #4 — Unused Imports & Dead Variables (FIXED)

**Severity:** LOW | **File:** `[unitSlug]/page.tsx`

**Problems:**
- `import Link from "next/link"` — imported but never used
- `import { PageHeader }` — imported but never used
- `const unitType = Object.entries(UNIT_TYPES).find(...)?.[0]` — computed inside useEffect but never referenced
- `productPage` and `txPage` state — initialized but never used (fetch always uses hardcoded `page=1`)

**Fix:** Removed all unused imports, dead variable, and unused pagination state.

---

## 4. Known Issues (Not Fixed — Documented)

### Issue #5 — Double Revenue Counting for Store Units

**Severity:** HIGH (data accuracy) | **File:** `src/app/api/manajemen-unit/stats/route.ts`

**Problem:** The stats API counts revenue from BOTH `StoreSale` and `UnitTransaction` for every unitType:

```typescript
const storeRevenue = Number(todaySales._sum.totalAmount ?? 0);
const serviceRevenue = await prisma.unitTransaction.aggregate({
    _sum: { amount: true },
    where: { unitType, transactionDate: { gte: todayStartUTC }, status: { not: "voided" } },
});
todayRevenue: storeRevenue + Number(serviceRevenue._sum.amount ?? 0),
```

For store units (`toko`, `resto`, `cafe_lsp`), StoreSale records already represent ALL revenue. If UnitTransaction records also exist for the same unit, revenue is double-counted.

**Same issue in:** `[unitSlug]/stats/route.ts` (detail page).

**Recommendation:** Only query `UnitTransaction` for service-type units, not store-type:

```typescript
// Only count service revenue for non-store units
const isStoreUnit = ["toko", "resto", "cafe_lsp"].includes(unitType);
const serviceRevenue = !isStoreUnit
    ? await prisma.unitTransaction.aggregate({ ... })
    : { _sum: { amount: 0 } };
```

---

### Issue #6 — Store Transaction Count Includes Service Count

**Severity:** MEDIUM (data accuracy) | **File:** `src/app/api/manajemen-unit/stats/route.ts`

**Problem:** `todayTransactionCount: storeTxCount + todayTransactions` adds StoreSale count + UnitTransaction count. For store units, this could inflate transaction counts if UnitTransaction records exist for the same unit.

**Recommendation:** Same fix as Issue #5 — only count UnitTransaction for service-type units.

---

### Issue #7 — Placeholder "Metode Pembayaran" Card

**Severity:** LOW (UX) | **File:** `[unitSlug]/page.tsx`

**Problem:** The Ringkasan tab has a "Metode Pembayaran" card that only shows the text "Data detail metode pembayaran tersedia di tab Transaksi". This is an empty placeholder with no actual data.

**Recommendation:** Either (a) aggregate payment methods from transaction data and show a breakdown (cash vs transfer vs QRIS), or (b) remove the placeholder card entirely.

---

### Issue #8 — Transaction Detail Not Fully Rendered

**Severity:** LOW (UX) | **File:** `[unitSlug]/page.tsx`

**Problem:** The `Transaction` interface has `items` (POS line items), `description` (service description), and `memberName` (for service transactions), but the transactions table only shows 4 columns: No. Transaksi, Jumlah, Metode, Waktu. None of the detailed data is rendered.

**Recommendation:** Add expandable rows or a detail dialog showing:
- For POS transactions: item breakdown (product name × quantity × price)
- For service transactions: member name, description

---

### Issue #9 — No Pagination UI Despite API Support

**Severity:** LOW (UX) | **Files:** Both API + UI

**Problem:** Products API supports `?page=1&limit=50` and Transactions API supports `?page=1&limit=25`. Both return `pagination: { page, limit, total, totalPages }`. But the UI always fetches page 1 and never shows pagination controls. If a unit has >50 products or >25 transactions, the user can only see the first page.

**Recommendation:** Add pagination controls (Previous/Next buttons) using the `productTotal`/`txTotal` state already fetched from the API.

---

### Issue #10 — Low Stock Threshold Hardcoded

**Severity:** LOW (configurability) | **Files:** Both stats APIs

**Problem:** Low stock threshold is hardcoded to `stock: { lte: 5 }`. Different product types may need different thresholds (e.g., high-volume items might need alert at 20, while low-volume at 2).

**Recommendation:** Make threshold configurable per unit or per product category.

---

## 5. Performance Notes

### ✅ Good Patterns

| Pattern | Detail |
|---------|--------|
| **Parallel queries** | Stats API uses `Promise.all` to fetch 5 metrics per unit concurrently |
| **3-way parallel fetch** | Detail page fetches stats + products + transactions simultaneously |
| **Service layer extraction** | Pure business logic in `manajemen-unit.ts` — testable, no side effects |
| **Select projection** | APIs use `select` to limit returned fields (not full model) |
| **Soft-delete filtering** | `deletedAt: null` filter on StoreProduct queries |

### ⚠️ Performance Concerns

| Concern | Detail |
|---------|--------|
| **N+1 queries in stats** | Stats API loops over 9 unitTypes, running 6 queries each = 54 total DB queries per request |
| **Extra sequential query** | In stats API, `serviceRevenue` query runs AFTER the `Promise.all` block (not parallelized) |
| **Weekly data fetch all** | `[unitSlug]/stats` fetches ALL StoreSale + UnitTransaction records for 7 days (could be thousands) just to group by date |

---

## 6. Key Source Files

| File | Responsibility |
|------|---------------|
| `src/app/(protected)/manajemen-unit/page.tsx` | Dashboard page — unit card grid |
| `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Unit detail — stats + products + transactions |
| `src/app/api/manajemen-unit/stats/route.ts` | Aggregated stats API |
| `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Per-unit stats API |
| `src/app/api/manajemen-unit/[unitSlug]/products/route.ts` | Products listing API |
| `src/app/api/manajemen-unit/[unitSlug]/transactions/route.ts` | Transactions listing API |
| `src/lib/constants/units.ts` | Unit type registry + helpers |
| `src/lib/services/manajemen-unit.ts` | Pure business logic |

---

## 7. Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `manajemen-unit.test.ts` | aggregateUnitStats (6 tests) | ✅ Covers totals, mapping, empty, unknown, zero |
| `manajemen-unit-detail.test.ts` | computeUnitDetail (4 tests) | ✅ Covers avg value, zero guard, rounding |
| `unit-constants.test.ts` | UNIT_TYPES helpers (7+ tests) | ✅ Covers slug↔unitType, getLabel, getStore/getService |

**Missing tests:** No integration tests for API routes. No tests for the page components.

---

## 8. Summary

| Category | Count |
|----------|-------|
| **Bugs fixed in this audit** | 4 (#1–#4) |
| **Known issues documented** | 6 (#5–#10) |
| **Critical** | 0 |
| **High** | 1 (double revenue counting) |
| **Medium** | 2 (transaction count, error handling) |
| **Low** | 3 (placeholder, detail rendering, pagination, threshold) |

**Priority fix recommendation:**
1. **Issue #5 & #6** (HIGH) — Double counting of revenue/transactions for store units
2. **Issue #9** (LOW) — Add pagination UI
3. **Issue #8** (LOW) — Show transaction detail in expandable rows

*Diperbarui: 30 Mei 2026*
