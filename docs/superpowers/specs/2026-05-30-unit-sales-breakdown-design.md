# Unit Sales Breakdown (Phase 3) — Design Spec

**Date:** 2026-05-30 | **Branch:** `railway-migration` | **Status:** Approved

## Goal

Replace the "Top 5 Produk Terlaris" insight (I-05) with a full product sales breakdown that lists ALL items sold, with configurable time range (today / 7 days / 30 days). Only applies to store units (toko, resto, cafe_lsp).

## Current State

- **I-05** shows top 5 products by quantity sold today via `StoreSaleItem.groupBy({ take: 5 })`
- Stats API already fetches `topProductItems` query (item 10 in Promise.all)
- UI renders a simple ranked list with quantity badges

## Design

### API Changes

**Endpoint:** `GET /api/manajemen-unit/[slug]/stats`

**New query parameter:** `range` — values: `today` (default), `7d`, `30d`

**Changes to existing `topProductItems` query (Promise.all item 10):**

- Remove `take: 5` — fetch ALL products
- Add `_sum: { unitPrice: true }` to compute per-product revenue
- Replace `todayStartUTC` with `rangeStartUTC` computed from `range` param:
  - `today` → same as current `todayStartUTC`
  - `7d` → `todayStartUTC - 6 days`
  - `30d` → `todayStartUTC - 29 days`

**New response field `allProductSales`:**

```json
{
  "allProductSales": [
    {
      "productId": 1,
      "name": "Nasi Goreng",
      "quantity": 15,
      "revenue": 225000
    }
  ],
  "salesRange": "today",
  "salesSummary": {
    "totalProducts": 10,
    "totalItems": 35,
    "totalRevenue": 635000
  }
}
```

**Backward compatibility:** Keep existing `topProducts` field (derived from `allProductSales` — take top 5 by quantity).

### Service Layer

No new pure helpers needed. The `allProductSales` computation is:
1. `StoreSaleItem.groupBy` by `productId` with `_sum: { quantity, unitPrice }`
2. Product name resolution via batch `StoreProduct.findMany({ where: { id: { in: [...] } } })`
3. Sort by quantity desc in JS

### UI Changes

**File:** `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

**Replace** the "Produk Terlaris Hari Ini" card (Trophy icon) with "Penjualan Produk":

1. **Range toggle** — 3 pill buttons: "Hari Ini", "7 Hari", "30 Hari"
2. **Scrollable product list** — max height `max-h-80 overflow-y-auto`
3. **Per item row:** rank number, product name, quantity badge, revenue amount, progress bar (% of total revenue)
4. **Footer:** summary line — total produk, total item, total revenue
5. **Empty state:** "Belum ada penjualan di periode ini"

**State changes:**
- Add `salesRange` state: `"today" | "7d" | "30d"` (default: `"today"`)
- When range changes → re-fetch stats API with `?range=${salesRange}`
- Only show for store units (`isStore` check already exists)

**Interactions:**
- Clicking range pill triggers `setSalesRange()` → useEffect re-fetches `/api/manajemen-unit/${unitSlug}/stats?range=${salesRange}`
- Stats response includes `salesRange` to confirm which range was used

### Data Flow

```
User clicks "7 Hari" pill
  → setSalesRange("7d")
  → useEffect detects salesRange change
  → fetch /api/manajemen-unit/{slug}/stats?range=7d
  → API computes rangeStartUTC = today - 6 days
  → StoreSaleItem.groupBy (no take limit, date >= rangeStartUTC)
  → Resolve product names via findMany
  → Return allProductSales + salesSummary
  → UI renders scrollable list sorted by quantity desc
```

### Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Accept `range` param, extend query, add `allProductSales` + `salesSummary` |
| 2 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Replace Top 5 card with Full Sales card + range toggle + scrollable list |
| 3 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Add `salesRange` state + re-fetch effect |
| 4 | `manajemen-unit.md` | Document Phase 3 feature |

### Performance Notes

- `StoreSaleItem.groupBy` without `take` limit: for 30 days, worst case ~100 product IDs × 30 days = manageable. No N+1 — single groupBy query.
- Product name resolution: batch `findMany` with `where: { id: { in: [...] } }` instead of individual `findUnique` (improvement over existing pattern).
- Range re-fetch: only re-fetches stats, not products/transactions tabs.

### Out of Scope

- Per-product margin in the list (already in `topProfitProducts` for profit view)
- Sorting by revenue/margin (default sort by quantity, could add later)
- Export per-range (CSV export already includes today's data)
- Service unit sales breakdown (no StoreSaleItem for service units)
