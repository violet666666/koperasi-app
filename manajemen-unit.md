# Manajemen Unit — Audit & Documentation

> **Route:** `/manajemen-unit` | **Branch:** `railway-migration`
> **Role:** Operator-only (`manage_all` permission)
> **Updated:** 2 Juni 2026

---

## 1. Architecture Overview

### File Structure

```
src/app/(protected)/manajemen-unit/
├── page.tsx                          # Dashboard — card grid 9 units + trend badges
└── [unitSlug]/page.tsx               # Detail — stats, products, transactions + insights

src/app/api/manajemen-unit/
├── stats/route.ts                    # GET — aggregated stats for all units
└── [unitSlug]/
    ├── stats/route.ts                # GET — per-unit stats + 14-day chart + insights
    ├── products/route.ts             # GET — paginated product listing
    └── transactions/route.ts         # GET — paginated transaction listing

src/lib/
├── constants/units.ts                # UNIT_TYPES (9 units) + slug/name helpers + aliases
└── services/manajemen-unit.ts        # Pure business logic (aggregateUnitStats, computeUnitDetail,
                                       #   computePeakHours, computeProfitFromItems, computeWIBBoundaries)
```

### Data Flow

```
Dashboard (/manajemen-unit)
  └─→ GET /api/manajemen-unit/stats → 4 summary cards + 9 unit cards

Unit Detail (/manajemen-unit/[unitSlug])
  ├─→ GET /api/{slug}/stats       → stat cards + bar chart + insights
  ├─→ GET /api/{slug}/products    → product table (search, paginated)
  └─→ GET /api/{slug}/transactions → transaction table (date filter, paginated)
      (3 fetches in parallel via Promise.all)
```

### Unit Registry (9 units)

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

**Slug mapping:** underscore ↔ hyphen (`cafe_lsp` ↔ `cafe-lsp`, `cuci_mobil` ↔ `cuci-mobil`)
**DB aliases:** `play_station`, `resto_cafe`, `coffe_latar` → handled via `UNIT_TYPE_ALIASES`

---

## 2. Security Review

### ✅ Auth Pattern (All 4 endpoints)

```typescript
const session = await auth();
if (!session?.user?.id) return 401;
const permissions = session.user.permissions ?? [];
if (!permissions.includes("manage_all")) return 403;
```

| Endpoint | Auth | Status |
|----------|------|--------|
| `GET /api/manajemen-unit/stats` | ✅ session + manage_all | OK |
| `GET /api/manajemen-unit/[slug]/stats` | ✅ session + manage_all | OK |
| `GET /api/manajemen-unit/[slug]/products` | ✅ session + manage_all | OK |
| `GET /api/manajemen-unit/[slug]/transactions` | ✅ session + manage_all | OK |

### ✅ Additional Guards
- **Slug validation:** `slugToUnitType()` → null → 404
- **Voided filtering:** StoreSale `NOT: { metadata: { path: ["isVoided"], equals: true } }`, UnitTransaction `status: { not: "voided" }`

---

## 3. Unit Insights (6 features)

| ID | Insight | Lokasi | Ketersediaan |
|----|---------|--------|-------------|
| I-01 | Tren Pendapatan | Dashboard cards + Detail stats | Semua unit |
| I-02 | Jam Ramai | Detail → Ringkasan tab | Semua unit |
| I-03 | Metode Pembayaran | Detail → Ringkasan tab | Semua unit |
| I-04 | Keuntungan (Profit) | Detail → Ringkasan tab | Store units only |
| I-05 | Top 5 Produk Terlaris | Detail → Ringkasan tab | Store units only |
| I-06 | Perbandingan Mingguan | Detail → Ringkasan tab | Semua unit |

### API Response Shapes

**Dashboard stats** — each unit includes: `yesterdayRevenue`, `revenueTrend` (% change, null jika 0)

**Detail stats** — includes: `topProducts[]`, `paymentMethods[]`, `peakHours[]`, `prevWeekRevenue[]`, `todayProfit`, `profitMargin`, `topProfitProducts[]`, `allProductSales[]` (with range selector)

**Transactions API** — supports `?range=today|7d|30d` + pagination `?page=N&limit=25`

### Pure Helpers

| Function | File | Tests |
|----------|------|-------|
| `aggregateUnitStats()` | `manajemen-unit.ts` | 9 tests |
| `computeUnitDetail()` | `manajemen-unit.ts` | 4 tests |
| `computePeakHours()` | `manajemen-unit.ts` | 4 tests |
| `computeProfitFromItems()` | `manajemen-unit.ts` | 4 tests |
| `computeWIBBoundaries()` | `manajemen-unit.ts` | — |

---

## 4. Performance Notes

### ✅ Good Patterns
- **Parallel queries** — `Promise.all` untuk fetch 5 metrics per unit
- **3-way parallel fetch** — Detail page fetches stats + products + transactions simultaneously
- **Service layer** — Pure business logic di `manajemen-unit.ts` (testable, no side effects)
- **Select projection** — APIs gunakan `select` untuk limit returned fields
- **Batch name resolution** — Product names via `findMany` (bukan N+1 `findUnique`)

### ⚠️ Concerns
- **63 DB queries per dashboard request** — 7 queries × 9 units (loop, belum di-batch)
- **14-day fetch for weekly chart** — fetch ALL records lalu group di JS

---

## 5. Key Source Files

| File | Responsibility |
|------|---------------|
| `src/app/(protected)/manajemen-unit/page.tsx` | Dashboard page — unit card grid + category filter |
| `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Unit detail — stats + products + transactions + insights |
| `src/app/api/manajemen-unit/stats/route.ts` | Aggregated stats API |
| `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Per-unit stats API (11 parallel queries, 14-day chart) |
| `src/app/api/manajemen-unit/[unitSlug]/products/route.ts` | Products listing (search, paginated) |
| `src/app/api/manajemen-unit/[unitSlug]/transactions/route.ts` | Transactions listing (date filter, paginated) |
| `src/lib/constants/units.ts` | Unit type registry + helpers + aliases |
| `src/lib/services/manajemen-unit.ts` | Pure business logic |

---

## 6. Test Coverage

| Test File | Tests | Covers |
|-----------|-------|--------|
| `manajemen-unit.test.ts` | 9 | aggregateUnitStats totals, mapping, empty, unknown, zero, revenueTrend |
| `manajemen-unit-detail.test.ts` | 4 | computeUnitDetail avg value, zero guard, rounding |
| `manajemen-unit-peakhours-profit.test.ts` | 8 | computePeakHours (WIB, business hours) + computeProfitFromItems |
| `unit-constants.test.ts` | 7+ | slug↔unitType, getLabel, getStore/getService |

**Total:** 34 tests across 4 files. No integration/API route tests.

---

## 7. Issues Resolved (All Closed)

### Audit Phase 1 (30 Mei)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | MEDIUM | Dead nav link `/manajemen-unit/pengaturan` | Removed nav entry |
| 2 | MEDIUM | No error state in UI | Added error banner |
| 3 | LOW | No `res.ok` check before `.json()` | Added status check |
| 4 | LOW | Unused imports & dead variables | Removed |
| 5 | HIGH | Double revenue counting (store units) | `isStoreUnit` guard |
| 6 | MEDIUM | Store tx count inflation | Same fix as #5 |
| 7 | LOW | Placeholder payment method card | Replaced with real data |
| 8 | LOW | Transaction detail not rendered | Added expandable rows + dialog |
| 9 | LOW | No pagination UI | Added page navigation |
| 10 | LOW | Hardcoded stock threshold ≤5 | Dynamic `min_stock` per product |

### Re-Audit (30 Mei)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 11 | MEDIUM | Sales range toggle tidak refetch "Hari Ini" | `useRef isInitialMount` guard |
| 12 | LOW | Dashboard tidak cek `res.ok` | Added check |
| 13 | LOW | Hardcode stock threshold text | Dynamic per product |

### Deep Audit (30-31 Mei)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 14 | MEDIUM | Dashboard silently fails on invalid data | Added error state for undefined data |
| 15 | LOW | Pagination refetch tanpa `res.ok` | Added check |
| 16 | MEDIUM | Dashboard tidak ada filter kategori | Added "Semua/Toko/Layanan" buttons |
| 17 | HIGH | Weekly chart tidak merge StoreSale + UnitTransaction | Merged both sources for all unit types |

### UI/UX Fixes (31 Mei)

| # | Severity | Fix |
|---|----------|-----|
| 18 | MEDIUM | Added product search filter with 300ms debounce |
| 19 | MEDIUM | Added transaction date filter (today/7d/30d) + API `range` param |
| 20 | LOW | "Produk" → "Layanan" for service units |
| 21 | LOW | Clean trend icon (Minus saat revenue=0) |
| 22 | LOW | Peak hours contextual empty state |

### Data Sync Fix (1 Juni)

| # | Root Cause | Fix |
|---|------------|-----|
| RC-1 | `@db.Date` timezone mismatch — WIB filter vs UTC midnight | `computeWIBBoundaries()` separate for Date vs DateTime |
| RC-2 | Missing unitType alias — `play_station`, `resto_cafe`, `coffe_latar` | `UNIT_TYPE_ALIASES` + `unitTypeFilter()` |
| RC-3 | Store/service split too rigid | Merge both sources for all units |
| RC-4 | Profit null costPrice → fake 100% margin | Filter out null costPrice |
| RC-5 | Payment breakdown not range-aware | Range-aware filter |
| RC-6 | Trend compared vs weekly avg including today | Compare vs prev 6 days |

### SHU Beban Fix (31 Mei)

| # | Root Cause | Fix |
|---|------------|-----|
| — | Journal path ignored CB expenses (Rp 2.58B missed) | CB non-journaled merge with dedup |
| — | NULL unitType on 99% expenses | Group as "Beban Umum (Belum Dialokasi)" |
| — | Whitelist `EXPENSE_CATEGORIES` too narrow | Blacklist `NON_EXPENSE_CATEGORIES` |

**All 22+6 issues resolved. Zero remaining.**

---

## 8. Key Technical Insight: Timezone

`UnitTransaction.transactionDate` menggunakan `@db.Date` → stored as UTC midnight (`2026-06-01T00:00:00.000Z`). Filter WIB midnight (`todayStartUTC = 2026-05-31T17:00:00.000Z`) akan salah include transaksi kemarin.

**Fix:** Gunakan pure UTC midnight untuk `@db.Date` fields:
```typescript
todayDateUTC = new Date(Date.UTC(year, month, date))  // matches @db.Date storage
tomorrowDateUTC = new Date(Date.UTC(year, month, date + 1))
// Filter: { gte: todayDateUTC, lt: tomorrowDateUTC }
```

`computeWIBBoundaries()` di `manajemen-unit.ts` meng-handle kedua jenis field.

*Diperbarui: 2 Juni 2026*
