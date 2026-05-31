# Manajemen Unit — Code Review & Audit

> **Route:** `/manajemen-unit` | **Audit Date:** 2026-05-30 | **Branch:** `railway-migration`
> **Role:** Operator-only (`manage_all` permission)

---

## 1. Architecture Overview

### File Structure (16 files)

```
src/app/(protected)/manajemen-unit/
├── page.tsx                          # Dashboard — card grid of all 9 units + trend badges
└── [unitSlug]/page.tsx               # Detail — stats, products, transactions + insights per unit

src/app/api/manajemen-unit/
├── stats/route.ts                    # GET — aggregated stats for all units (incl. trend)
└── [unitSlug]/
    ├── stats/route.ts                # GET — per-unit detail stats + 14-day chart + insights
    ├── products/route.ts             # GET — paginated product listing
    └── transactions/route.ts         # GET — paginated transaction listing

src/lib/
├── constants/units.ts                # UNIT_TYPES registry (9 units) + helpers
└── services/manajemen-unit.ts        # Pure business logic (aggregateUnitStats, computeUnitDetail,
                                       #   computePeakHours, computeProfitFromItems)

src/__tests__/
├── manajemen-unit.test.ts            # Tests for aggregateUnitStats (6 tests)
├── manajemen-unit-detail.test.ts     # Tests for computeUnitDetail (4 tests)
├── manajemen-unit-peakhours-profit.test.ts  # Tests for peak hours + profit (8 tests)
└── unit-constants.test.ts            # Tests for UNIT_TYPES helpers (7+ tests)
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
| **N+1 queries in stats** | Stats API loops over 9 unitTypes, running 7 queries each (incl. yesterday revenue) = 63 total DB queries per request |
| **Extra sequential query** | In stats API, `serviceRevenue` and yesterday queries run AFTER the `Promise.all` block (not parallelized) |
| **Weekly data fetch 14 days** | `[unitSlug]/stats` fetches ALL StoreSale + UnitTransaction records for 14 days (Phase 2 extended from 7) just to group by date. Peak hours reuses this data (no extra query) |
| **Profit N+1 names** | Top 5 profitable products resolved via individual `findUnique` calls (same pattern as top products). Could use batch `findMany` with `where: { id: { in: [...] } }` |

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
| `manajemen-unit-peakhours-profit.test.ts` | computePeakHours (4) + computeProfitFromItems (4) | ✅ Covers WIB grouping, business hours, profit math, edge cases |
| `unit-constants.test.ts` | UNIT_TYPES helpers (7+ tests) | ✅ Covers slug↔unitType, getLabel, getStore/getService |

**Total:** 34 tests across 4 test files. No integration tests for API routes. No tests for the page components.

---

## 8. Summary

| Category | Count |
|----------|-------|
| **Bugs fixed in audit** | 4 (#1–#4) |
| **Issues fixed by Phase 1+2** | 3 (#5, #6, #7) |
| **Issues fixed by UX Polish** | 3 (#8, #9, #10) |
| **Bugs fixed in re-audit (30 Mei)** | 3 (#11, #12, #13) |
| **Known issues remaining** | 0 |
| **Critical** | 0 |
| **High** | 0 (all resolved) |
| **Medium** | 0 |
| **Low** | 0 |

**All known issues resolved. No remaining items.**

---

## 9. Unit Insights Feature (Phase 1 MVP — 30 Mei 2026)

### Fitur Baru

| ID | Insight | Lokasi | Deskripsi |
|---|---------|--------|-----------|
| **I-01** | Tren Pendapatan | Dashboard cards + Detail stats card | Bandingkan revenue hari ini vs kemarin. Tampilkan ↑/↓% badge. |
| **I-03** | Metode Pembayaran | Detail → Ringkasan tab | Progress bar breakdown: Tunai vs QRIS vs Potong Gaji |
| **I-05** | Top 5 Produk Terlaris | Detail → Ringkasan tab | Produk terlaris hari ini berdasarkan quantity (store units only) |

### Data Sources

| Insight | Query Pattern | Tables |
|---------|---------------|--------|
| Tren | `aggregate` today vs yesterday, same unit + void filter | StoreSale / UnitTransaction |
| Payment | `groupBy` paymentMethod, today | StoreSale.groupBy + UnitTransaction.groupBy |
| Top Products | StoreSaleItem.groupBy productId, sum quantity, take 5 | StoreSaleItem → StoreProduct (name lookup) |

### API Response Changes

**GET /api/manajemen-unit/stats** — each unit now includes:
```json
{
  "yesterdayRevenue": 1500000,
  "revenueTrend": 12
}
```
- `revenueTrend`: percentage change vs yesterday. `null` if yesterday revenue was 0.

**GET /api/manajemen-unit/{slug}/stats** — now includes:
```json
{
  "topProducts": [{ "productId": 1, "name": "Nasi Goreng", "quantity": 15 }],
  "paymentMethods": [{ "method": "cash", "label": "Tunai", "amount": 500000, "count": 8 }]
}
```

### Side-effect Fixes

Implementasi Phase 1 juga memperbaiki issue audit sebelumnya:
- **Issue #5 & #6 (HIGH)** — Double revenue/transaction counting untuk store units. Sekarang menggunakan `isStoreUnit` guard: store units hanya query `StoreSale`, service units hanya query `UnitTransaction`.
- **Issue #7 (LOW)** — Placeholder "Metode Pembayaran" card di detail page diganti dengan data real (progress bar breakdown).

### Implementation Commits

| Commit | Description |
|--------|-------------|
| `f08e333` | Revenue trend data (yesterday vs today) di stats API |
| `ba72396` | Payment breakdown + top products di detail stats API |
| `f2d94f6` | UI: trend badge, payment breakdown, top products |

### Phase 2 Insights (30 Mei 2026)

| ID | Insight | Lokasi | Deskripsi |
|---|---------|--------|-----------|
| **I-02** | Jam Ramai (Peak Hours) | Detail → Ringkasan tab | Bar chart distribusi transaksi per jam (06:00–22:00 WIB). Highlight jam puncak (amber). |
| **I-04** | Keuntungan (Profit) | Detail → Ringkasan tab | Total profit, margin %, top 3 produk paling menguntungkan. Store units only. |
| **I-06** | Perbandingan Mingguan | Detail → Ringkasan tab | Dual-bar chart: minggu ini vs minggu lalu per hari. |

#### Data Sources — Phase 2

| Insight | Query Pattern | Tables |
|---------|---------------|--------|
| Peak Hours | Filter weekly data to today, group by WIB hour (JS) | StoreSale.createdAt / UnitTransaction.transactionDate |
| Profit | StoreSaleItem.findMany today, computeProfitFromItems (pure) | StoreSaleItem (unitPrice, costPrice, quantity) → StoreProduct (name) |
| Weekly Comparison | Extend weekly range to 14 days, split in JS | Same as Phase 1 weekly chart |

#### API Response Changes — Phase 2

**GET /api/manajemen-unit/{slug}/stats** — now additionally includes:
```json
{
  "peakHours": [{ "hour": 8, "transactions": 5, "revenue": 75000 }],
  "prevWeekRevenue": [{ "date": "2026-05-17", "revenue": 500000, "transactions": 12 }],
  "todayProfit": 350000,
  "profitMargin": 23.5,
  "topProfitProducts": [{ "productId": 1, "name": "Nasi Goreng", "profit": 120000, "revenue": 180000, "margin": 66.67 }]
}
```
Note: `todayProfit`, `profitMargin`, and `topProfitProducts` are only present for store units.

#### Pure Helper Functions

| Function | File | Tests |
|----------|------|-------|
| `computePeakHours(records, wibOffset, minHour?, maxHour?)` | `manajemen-unit.ts` | 4 tests |
| `computeProfitFromItems(items)` | `manajemen-unit.ts` | 4 tests |

#### Spec Bugs Fixed During Implementation

- Profit test expectation: spec had `29000` but correct math is `36000` — `(7000×2) + (5000×3) + (7000×1)`
- Timezone: spec used `getHours()` (local time) → fixed to `getUTCHours()` to work correctly on both UTC servers and local dev machines

#### Phase 2 Implementation Commits

| Commit | Description |
|--------|-------------|
| `e7c47e2` | computePeakHours + computeProfitFromItems helpers with tests |
| `c1b2100` | Peak hours, profit metrics, weekly comparison in detail stats API |
| `299f5a6` | UI: peak hours chart, profit card, weekly comparison dual bars |

### Phase 3: Full Product Sales Breakdown (30 Mei 2026)

| ID | Insight | Lokasi | Deskripsi |
|---|---------|--------|-----------|
| **I-07** | Penjualan Produk Lengkap | Detail → Ringkasan tab | Daftar SEMUA item terjual dengan quantity, revenue, dan contribution %. Range: hari ini / 7 hari / 30 hari. Store units only. |

#### API Changes — Phase 3

**GET /api/manajemen-unit/{slug}/stats?range=today|7d|30d** — now additionally includes for store units:

```json
{
  "allProductSales": [
    { "productId": 1, "name": "Nasi Goreng", "quantity": 15, "revenue": 225000 }
  ],
  "salesRange": "today",
  "salesSummary": { "totalProducts": 10, "totalItems": 35, "totalRevenue": 635000 }
}
```

- `topProducts` still returned (top 5 by quantity) for backward compatibility
- `allProductSales` replaces Top 5 with full list, sorted by quantity desc
- Product names resolved via batch `findMany` (no N+1)
- Revenue computed from `StoreSaleItem.subtotal` (unitPrice × quantity − discount)

#### Phase 3 Implementation Commits

| Commit | Description |
|--------|-------------|
| `6a54660` | Stats API: range param, full product sales, batch name resolution |
| `8cd9779` | UI: range toggle, scrollable sales list, summary footer |

*Diperbarui: 30 Mei 2026*

---

## 10. Re-Audit Bugs (30 Mei 2026)

### Issue #11 — Sales Range Toggle Tidak Refetch "Hari Ini" (FIXED)

**Severity:** MEDIUM | **File:** `[unitSlug]/page.tsx`

**Problem:** Saat user ganti range ke 7d/30d lalu kembali ke "Hari Ini", useEffect melakukan early return karena guard `salesRange === "today"`. Data `allProductSales` masih menampilkan data range sebelumnya.

**Fix:** Ganti guard `salesRange === "today"` dengan `useRef` `isInitialMount` yang hanya skip refetch pada mount pertama.

---

### Issue #12 — Dashboard Tidak Cek `res.ok` (FIXED)

**Severity:** LOW | **File:** `manajemen-unit/page.tsx`

**Problem:** Dashboard page memanggil `.json()` tanpa cek `res.ok`. Response 403/500 bisa gagal parse.

**Fix:** Tambah `if (!res.ok) throw new Error(...)` sebelum `.json()`.

---

### Issue #13 — UI Hardcode Stock Threshold (FIXED)

**Severity:** LOW | **Files:** `[unitSlug]/page.tsx`, `products/route.ts`

**Problem:** Teks "≤ 5" dan highlight merah hardcoded, padahal API sudah gunakan `min_stock` per produk.

**Fix:**
- Teks diubah menjadi generik (tanpa angka threshold)
- Products API sekarang return `minStock` per produk
- Highlight merah menggunakan `p.stock <= (p.minStock ?? 5)`

---

### Missing Test Coverage — `revenueTrend` (FIXED)

3 test baru ditambahkan ke `manajemen-unit.test.ts`:
- Positive trend (+25%)
- Negative trend (-40%)
- Null trend (yesterday = 0)

**Total tests:** 34 (sebelumnya 31).

---

## 11. Deep Audit Fixes (30 Mei 2026 — Malam)

### Issue #14 — Dashboard Silently Fails pada Invalid Data (FIXED)

**Severity:** MEDIUM | **Files:** `manajemen-unit/page.tsx`, `[unitSlug]/page.tsx`

**Problem:** Ketika API mengembalikan response 200 tapi `json.data` undefined (misal format response berubah atau error handling middleware), dashboard tetap menampilkan semua nilai 0 tanpa peringatan. User tidak tahu apakah datanya memang 0 atau ada masalah koneksi.

**Fix:** Tambahkan `else setError("Data tidak valid dari server.")` setelah pengecekan `if (json.data)` pada kedua page.

---

### Issue #15 — Pagination Refetch Tanpa `res.ok` Validation (FIXED)

**Severity:** LOW | **File:** `[unitSlug]/page.tsx`

**Problem:** Dua useEffect untuk refetch produk dan transaksi saat halaman pagination berubah menggunakan `.then(res => res.json())` tanpa cek `res.ok`. Ini inkonsisten dengan fix #12 yang sudah menambahkan `res.ok` check pada dashboard dan initial data fetch.

**Fix:** Tambahkan `.then(res => { if (!res.ok) throw new Error(...); return res.json(); })` pada kedua pagination refetch useEffect.

*Diperbarui: 30 Mei 2026*

---

## 12. UI/UX Deep Audit & Fix (31 Mei 2026)

### Issue #16 — Dashboard Tidak Ada Filter Kategori (FIXED)

**Severity:** MEDIUM | **File:** `manajemen-unit/page.tsx`

**Problem:** Dashboard menampilkan semua unit tanpa opsi filter. Operator harus scroll untuk mencari unit tertentu.

**Fix:** Tambahkan filter buttons "Semua", "Toko/POS", "Layanan" di atas grid. Filter bekerja client-side karena data sudah dimuat seluruhnya.

---

### Issue #17 — Weekly Chart Tidak Gabungkan StoreSale + UnitTransaction (FIXED)

**Severity:** HIGH | **File:** `api/manajemen-unit/[unitSlug]/stats/route.ts`

**Problem:** Chart mingguan hanya menghitung salah satu source: StoreSale untuk store units ATAU UnitTransaction untuk service units. Unit "toko" yang memiliki kedua jenis transaksi (370 StoreSale + 51 UnitTransaction) hanya menampilkan satu sumber data.

**Fix:** Hapus `if (!isStore) continue` dan `if (isStore) continue` pada loop pembuatan weekMap. Semua transaksi dari kedua source sekarang di-merge untuk semua unit types.

---

### Issue #18 — Products Tab Tidak Ada Search Filter (FIXED)

**Severity:** MEDIUM | **File:** `[unitSlug]/page.tsx`

**Problem:** Tab produk menampilkan hingga 1.825 produk tanpa kemampuan pencarian. Backend sudah support search parameter tapi frontend tidak menyediakannya.

**Fix:** Tambahkan input search dengan ikon Search di atas tabel. Search menggunakan debounce 300ms untuk mengurangi API calls. Empty state menampilkan query yang dicari.

---

### Issue #19 — Transactions Tab Tidak Ada Date Filter (FIXED)

**Severity:** MEDIUM | **Files:** `[unitSlug]/page.tsx`, `api/[unitSlug]/transactions/route.ts`

**Problem:** Tab transaksi selalu menampilkan semua transaksi tanpa filter tanggal. Tidak ada cara untuk melihat transaksi hari ini saja atau dalam periode tertentu.

**Fix:**
- API: Tambahkan support `range` query parameter (today/7d/30d) dengan kalkulasi WIB timezone
- UI: Tambahkan filter buttons "Hari Ini", "7 Hari", "30 Hari" di atas tabel. Empty state menyesuaikan berdasarkan range yang dipilih.

---

### Issue #20-22 — Stats Card Minor Fixes (FIXED)

| # | Fix | Severity |
|---|-----|----------|
| #20 | Card "Produk" sekarang menampilkan "Layanan" untuk service units | LOW |
| #21 | Icon `TrendingDown` tidak tampil saat `todayRevenue=0` — diganti `Minus` icon | LOW |
| #22 | Peak hours empty state menampilkan konteks "lihat chart mingguan" | LOW |

*Diperbarui: 31 Mei 2026*
