# Manajemen Unit — Flexible Date Filter & Data Connection Fix

> **Date:** 2026-05-30 | **Branch:** `railway-migration`
> **Approach:** Extend Existing APIs (Approach A)

---

## 1. Problem Statement

### 1.1 Current Issues

1. **Dashboard (`/manajemen-unit`) — hardcoded "today" only.** No date parameters accepted. Revenue, transactions, trend — all fixed to today.
2. **Detail page (`/manajemen-unit/[slug]`) — range only affects product sales.** The `?range=7d|30d` param only changes the "Penjualan Produk" card. Stat cards, peak hours, payment methods, profit, weekly chart — all remain "today".
3. **Transactions API — no date filter at all.** Returns all-time records paginated, but UI says "Tidak ada transaksi hari ini" (misleading).
4. **Store check hardcoded.** `["toko", "resto", "cafe_lsp"].includes(unitType)` in 4 places instead of using `UNIT_TYPES[type].category === "store"`.
5. **Wasted queries.** Store units query `unitTransaction` and service units query `storeSale` — results thrown away.
6. **Naming inconsistency.** Fields named `todayRevenue`, `todayTransactions` etc. but will become range-scoped.

### 1.2 Goals

- Add a **global date range filter** (Hari Ini / Minggu Ini / Bulan Ini / Custom) to BOTH pages
- Make ALL metrics respect the selected range: stat cards, transactions, charts, payment breakdown, peak hours, profit
- Fix data disconnections and improve code quality (DRY store check, eliminate wasted queries)
- Maintain backward compatibility (default = "today")

---

## 2. Design

### 2.1 Range Parameter Specification

| Preset | Value | Date Range | Trend Comparison |
|--------|-------|------------|------------------|
| Hari Ini | `today` | Start of today (WIB) → now | vs yesterday |
| Minggu Ini | `week` | Start of current week (Monday WIB) → now | vs previous week same days |
| Bulan Ini | `month` | Start of current month (1st WIB) → now | vs previous month same days |
| Custom | `custom` | User-selected `from` → `to` | vs equivalent prior period |

**API Parameter Format:**
```
?range=today|week|month|custom&from=2026-05-15&to=2026-05-30
```

- `range` defaults to `"today"` if not provided (backward compatible)
- `from` and `to` are only required when `range=custom`
- `from` and `to` are ISO date strings (`YYYY-MM-DD`), interpreted as WIB dates

**WIB Boundary Helper:**
A shared utility function computes the start/end UTC timestamps from the range parameter:

```typescript
function resolveDateRange(range: string, from?: string, to?: string): {
  startUTC: Date;   // inclusive start
  endUTC: Date;     // exclusive end (= start of next day)
  // For trend comparison — the previous equivalent period
  prevStartUTC: Date;
  prevEndUTC: Date;
  rangeLabel: string; // "Hari Ini" | "Minggu Ini" | "Bulan Ini" | "15 Mei – 30 Mei"
}
```

### 2.2 Trend Comparison Logic

| Range | Current Period | Comparison Period | Trend Label |
|-------|---------------|-------------------|-------------|
| today | Today | Yesterday | "vs kemarin" |
| week | Mon→Today | Previous Mon→Same weekday offset | "vs minggu lalu" |
| month | 1st→Today | Previous month 1st→Same day offset | "vs bulan lalu" |
| custom | from→to | (to-from) days before from | "vs periode sebelumnya" |

### 2.3 API Changes

#### 2.3.1 Dashboard Stats API (`GET /api/manajemen-unit/stats`)

**Current:** No parameters, always "today".

**New:** Accepts `?range=today|week|month|custom&from=...&to=...`

**Response changes:**
```typescript
interface AggregatedStats {
  totalUnits: number;
  totalProducts: number;
  totalTransactions: number;  // now range-scoped, not "today" only
  totalRevenue: number;       // now range-scoped
  rangeLabel: string;         // NEW: "Hari Ini" | "Minggu Ini" | etc.
  units: UnitSummary[];
}

interface UnitSummary {
  // ... existing fields ...
  transactionCount: number;     // RENAMED from todayTransactionCount
  revenue: number;              // RENAMED from todayRevenue
  previousRevenue: number;      // RENAMED from yesterdayRevenue (now generic)
  revenueTrend: number | null;  // computed vs previousRevenue
  // REMOVED: todayTransactionCount, todayRevenue, yesterdayRevenue
}
```

**Optimization:** Use `isStoreUnit()` helper from unit constants instead of hardcoded array. Skip unnecessary queries based on unit category.

#### 2.3.2 Detail Stats API (`GET /api/manajemen-unit/[slug]/stats`)

**Current:** `?range=today|7d|30d` — only affects product sales.

**New:** `?range=today|week|month|custom&from=...&to=...` — affects ALL metrics.

**All metrics now respect the range:**

| Metric | Currently | After Change |
|--------|-----------|--------------|
| Stat cards (revenue, transactions) | Today only | Range-scoped |
| Weekly chart | Fixed 14 days | Show days within range (max 30) |
| Peak hours | Today only | Within range (but capped at 7 days for perf) |
| Payment breakdown | Today only | Range-scoped |
| Profit | Today only | Range-scoped |
| Product sales | Already range-aware | Already works, just align range values |

#### 2.3.3 Transactions API (`GET /api/manajemen-unit/[slug]/transactions`)

**Current:** No date filter. Returns all-time.

**New:** Accepts `?from=YYYY-MM-DD&to=YYYY-MM-DD` for date range filtering.

When `from`/`to` are provided, filter `createdAt` / `transactionDate` within the range.

#### 2.3.4 Products API — No changes needed.

Products are catalog data, not time-scoped.

### 2.4 UI Changes

#### 2.4.1 Shared Filter Component

A new `<DateRangeFilter>` component used on both pages:

```
┌─────────────────────────────────────────────────────────────────┐
│ [Hari Ini]  [Minggu Ini]  [Bulan Ini]  [📅 Custom]             │
└─────────────────────────────────────────────────────────────────┘
```

- **Pill buttons** for presets (active state highlighted)
- **Custom** opens a date picker (from → to)
- On change: refetch all data with new range parameter
- Label updates dynamically: "Pendapatan Hari Ini" → "Pendapatan Minggu Ini" etc.

#### 2.4.2 Dashboard Page (`/manajemen-unit`)

**Changes:**
1. Add `<DateRangeFilter>` below page header
2. Summary card labels become dynamic: "Transaksi Minggu Ini" instead of hardcoded "Transaksi Hari Ini"
3. Fetch URL changes from `/api/manajemen-unit/stats` to `/api/manajemen-unit/stats?range=X`
4. Unit card labels update accordingly

#### 2.4.3 Detail Page (`/manajemen-unit/[slug]`)

**Changes:**
1. Replace the product-sales-only range toggle with the global `<DateRangeFilter>`
2. Remove the existing `salesRange` state — replaced by global `range` state
3. All stat card labels become dynamic
4. Transactions tab passes date range to API
5. Weekly chart adapts to show days within the selected range
6. Peak hours shows distribution across the selected period (capped at 7 days)
7. Empty state text changes: "Tidak ada transaksi hari ini" → "Tidak ada transaksi dalam periode ini"

### 2.5 Code Quality Fixes (Bundled)

| Fix | Description |
|-----|-------------|
| **DRY store check** | Add `isStoreUnit(unitType: string): boolean` to `units.ts`, replace all 4 hardcoded arrays |
| **Eliminate wasted queries** | Only run storeSale query for store units, only run unitTransaction for service units |
| **Shared WIB helper** | Extract `resolveDateRange()` to `src/lib/date-helpers.ts` — reused by all 3 APIs |
| **Rename fields** | `todayRevenue` → `revenue`, `todayTransactionCount` → `transactionCount` (with backward compat mapping in service layer) |

### 2.6 Service Layer Changes

**File:** `src/lib/services/manajemen-unit.ts`

1. Update `RawUnitStats` interface: rename `todayTransactionCount` → `transactionCount`, `todayRevenue` → `revenue`, `yesterdayRevenue` → `previousRevenue`
2. Update `aggregateUnitStats()`: compute trend from `revenue` vs `previousRevenue`
3. Update `RawUnitDetail` similarly
4. Add `resolveDateRange()` to `src/lib/date-helpers.ts`

### 2.7 Performance Considerations

| Concern | Mitigation |
|---------|------------|
| Month-long queries for peak hours | Cap peak hours at max 7 days of raw data. For month range, aggregate daily instead of hourly |
| Month-long profit calculation | Use `groupBy` instead of `findMany` for longer ranges to reduce memory |
| Custom range up to 365 days | Limit custom range max to 90 days |

---

## 3. Scope

### In Scope
- ✅ Date range filter on dashboard + detail pages
- ✅ All metrics respect selected range
- ✅ Transactions API date filtering
- ✅ DRY store check refactor
- ✅ Eliminate wasted queries
- ✅ Dynamic labels
- ✅ Trend comparison for all ranges

### Out of Scope
- ❌ Real-time WebSocket/polling (use manual refresh)
- ❌ New API endpoints
- ❌ Database schema changes
- ❌ Mobile app changes

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `src/lib/constants/units.ts` | Add `isStoreUnit()` helper |
| `src/lib/date-helpers.ts` | Add `resolveDateRange()` helper |
| `src/lib/services/manajemen-unit.ts` | Update interfaces, rename fields |
| `src/app/api/manajemen-unit/stats/route.ts` | Accept range params, use helpers |
| `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | All metrics respect range |
| `src/app/api/manajemen-unit/[unitSlug]/transactions/route.ts` | Add date filter params |
| `src/app/(protected)/manajemen-unit/page.tsx` | Add filter bar, dynamic labels |
| `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Global filter, remove product-only range |
| New: `src/components/date-range-filter.tsx` | Shared filter component |

---

## 5. Implementation Order

1. **Foundation:** `isStoreUnit()` helper + `resolveDateRange()` helper
2. **Service layer:** Update interfaces, rename fields
3. **APIs:** Dashboard stats → Detail stats → Transactions
4. **UI:** Shared filter component → Dashboard page → Detail page
5. **Tests:** Update existing tests + new date range tests
