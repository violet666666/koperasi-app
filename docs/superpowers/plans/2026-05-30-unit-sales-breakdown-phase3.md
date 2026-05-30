# Unit Sales Breakdown Phase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Top 5 products insight with a full product sales breakdown listing ALL items sold, with configurable time range (today / 7 days / 30 days). Store units only.

**Architecture:** Extend existing detail stats API to accept `range` param, remove `take: 5` limit from groupBy query, resolve product names via batch `findMany`. Replace UI card with range toggle + scrollable list. No new endpoints needed.

**Tech Stack:** Next.js 15 Route Handlers, Prisma ORM (groupBy, findMany), React hooks (useState, useEffect), shadcn/ui, existing WIB timezone pattern.

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Modify | Accept range param, extend groupBy, build allProductSales + salesSummary |
| 2 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Modify | Add salesRange state, re-fetch effect, replace Top 5 card with full sales card |
| 3 | `manajemen-unit.md` | Modify | Document Phase 3 feature |

---

### Task 1: Extend Detail Stats API — Range Param + Full Product Sales

**Files:**
- Modify: `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`

- [ ] **Step 1: Parse `range` query parameter and compute rangeStartUTC**

In `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`, the function signature is:

```typescript
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitSlug: string }> }
) {
```

Change `_request` to `request` (remove the underscore). Then AFTER the `todayStartUTC` computation (line 34) and BEFORE the `twoWeeksAgoUTC` line (line 37), add the range parameter parsing:

```typescript
    // Parse range parameter for product sales breakdown (Phase 3)
    const url = new URL(request.url);
    const range = url.searchParams.get("range") ?? "today";
    const validRange = range === "7d" || range === "30d" ? range : "today";
    const rangeDays = validRange === "30d" ? 30 : validRange === "7d" ? 7 : 1;
    const rangeStartUTC = rangeDays > 1
      ? new Date(todayStartUTC.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000)
      : todayStartUTC;
```

- [ ] **Step 2: Replace topProductItems query to fetch ALL products with revenue**

Find the existing query #10 in the Promise.all (lines 105-120):

```typescript
        // 10. Top 5 products by quantity sold (today, store units only)
        isStore
          ? prisma.storeSaleItem.groupBy({
              by: ["productId"],
              _sum: { quantity: true },
              orderBy: { _sum: { quantity: "desc" } },
              take: 5,
              where: {
                sale: {
                  unitType,
                  createdAt: { gte: todayStartUTC },
                  NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
                },
              },
            })
          : Promise.resolve([]),
```

Replace with:

```typescript
        // 10. All products sold by quantity (range-aware, store units only)
        isStore
          ? prisma.storeSaleItem.groupBy({
              by: ["productId"],
              _sum: { quantity: true, unitPrice: true },
              orderBy: { _sum: { quantity: "desc" } },
              where: {
                sale: {
                  unitType,
                  createdAt: { gte: rangeStartUTC },
                  NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
                },
              },
            })
          : Promise.resolve([]),
```

Key changes: removed `take: 5`, added `_sum: { unitPrice: true }`, changed `todayStartUTC` to `rangeStartUTC`.

- [ ] **Step 3: Resolve all product names via batch findMany and build allProductSales**

Find the existing "Resolve top product names" block (lines 250-265):

```typescript
    // Resolve top product names
    const topProducts = topProductItems.length > 0
      ? await Promise.all(
          (topProductItems as Array<{ productId: number; _sum: { quantity: number | null } }>).map(async (item) => {
            const product = await prisma.storeProduct.findUnique({
              where: { id: item.productId },
              select: { name: true },
            });
            return {
              productId: item.productId,
              name: product?.name ?? "Unknown",
              quantity: Number(item._sum.quantity ?? 0),
            };
          })
        )
      : [];
```

Replace with:

```typescript
    // Resolve all product sales with names (batch findMany — no N+1)
    type ProductSaleRow = { productId: number; _sum: { quantity: number | null; unitPrice: number | null } };
    const allProductSales: Array<{ productId: number; name: string; quantity: number; revenue: number }> = [];

    if ((topProductItems as ProductSaleRow[]).length > 0) {
      const items = topProductItems as ProductSaleRow[];
      const productIds = items.map(item => item.productId);

      const products = await prisma.storeProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      });
      const productMap = new Map(products.map(p => [p.id, p.name]));

      for (const item of items) {
        allProductSales.push({
          productId: item.productId,
          name: productMap.get(item.productId) ?? "Unknown",
          quantity: Number(item._sum.quantity ?? 0),
          revenue: Number(item._sum.unitPrice ?? 0),
        });
      }
    }

    // Derive top 5 from allProductSales (backward compatibility)
    const topProducts = allProductSales.slice(0, 5).map(p => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
    }));

    // Sales summary
    const salesSummary = {
      totalProducts: allProductSales.length,
      totalItems: allProductSales.reduce((s, p) => s + p.quantity, 0),
      totalRevenue: allProductSales.reduce((s, p) => s + p.revenue, 0),
    };
```

- [ ] **Step 4: Add new fields to API response**

Find the return statement (lines 307-318):

```typescript
    return NextResponse.json({
      data: {
        unitType,
        label: getUnitLabel(unitType),
        ...detail,
        topProducts,
        paymentMethods,
        peakHours,
        ...(isStore ? { todayProfit, profitMargin, topProfitProducts } : {}),
        prevWeekRevenue,
      },
    });
```

Replace with:

```typescript
    return NextResponse.json({
      data: {
        unitType,
        label: getUnitLabel(unitType),
        ...detail,
        topProducts,
        paymentMethods,
        peakHours,
        ...(isStore ? { todayProfit, profitMargin, topProfitProducts } : {}),
        prevWeekRevenue,
        ...(isStore ? { allProductSales, salesRange: validRange, salesSummary } : {}),
      },
    });
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/manajemen-unit/\[unitSlug\]/stats/route.ts
git commit -m "feat(manajemen-unit): add full product sales breakdown with range support to stats API"
```

---

### Task 2: Update Detail Page UI — Range Toggle + Full Sales List

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Update UnitDetailStats interface**

Find the `UnitDetailStats` interface (lines 31-48):

```typescript
interface UnitDetailStats {
  productCount: number;
  activeProductCount: number;
  totalStock: number;
  lowStockCount: number;
  todayTransactions: number;
  todayRevenue: number;
  avgTransactionValue: number;
  weekRevenue: { date: string; revenue: number; transactions: number }[];
  topProducts: { productId: number; name: string; quantity: number }[];
  paymentMethods: { method: string; label: string; amount: number; count: number }[];
  // Phase 2 insights
  peakHours: { hour: number; transactions: number; revenue: number }[];
  prevWeekRevenue?: { date: string; revenue: number; transactions: number }[];
  todayProfit?: number;
  profitMargin?: number;
  topProfitProducts?: { productId: number; name: string; profit: number; revenue: number; margin: number }[];
}
```

Replace with:

```typescript
interface UnitDetailStats {
  productCount: number;
  activeProductCount: number;
  totalStock: number;
  lowStockCount: number;
  todayTransactions: number;
  todayRevenue: number;
  avgTransactionValue: number;
  weekRevenue: { date: string; revenue: number; transactions: number }[];
  topProducts: { productId: number; name: string; quantity: number }[];
  paymentMethods: { method: string; label: string; amount: number; count: number }[];
  // Phase 2 insights
  peakHours: { hour: number; transactions: number; revenue: number }[];
  prevWeekRevenue?: { date: string; revenue: number; transactions: number }[];
  todayProfit?: number;
  profitMargin?: number;
  topProfitProducts?: { productId: number; name: string; profit: number; revenue: number; margin: number }[];
  // Phase 3 insights
  allProductSales?: { productId: number; name: string; quantity: number; revenue: number }[];
  salesRange?: "today" | "7d" | "30d";
  salesSummary?: { totalProducts: number; totalItems: number; totalRevenue: number };
}
```

- [ ] **Step 2: Add salesRange state**

After the `expandedTxId` state (line 90), add:

```typescript
  const [salesRange, setSalesRange] = React.useState<"today" | "7d" | "30d">("today");
```

- [ ] **Step 3: Add re-fetch effect for salesRange changes**

After the transactions page-change effect (after line 161), add a new useEffect:

```typescript

  // Refetch stats when sales range changes (skip initial load — already fetched)
  React.useEffect(() => {
    if (!unitConfig || salesRange === "today") return;
    setLoading(true);
    fetch(`/api/manajemen-unit/${unitSlug}/stats?range=${salesRange}`)
      .then(res => res.json())
      .then(json => {
        if (json.data) setStats(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unitSlug, unitConfig, salesRange]);
```

- [ ] **Step 4: Update initial fetch URL to include range**

In the initial data fetch effect (line 101), change the stats fetch URL from:

```typescript
          fetch(`/api/manajemen-unit/${unitSlug}/stats`),
```

to:

```typescript
          fetch(`/api/manajemen-unit/${unitSlug}/stats?range=today`),
```

This is not strictly necessary since `today` is the default, but makes the intent explicit.

- [ ] **Step 5: Replace Top 5 products card with full sales breakdown**

Find the Top 5 products card (lines 471-491):

```tsx
          {stats?.topProducts && stats.topProducts.length > 0 && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <h3 className="font-semibold">Produk Terlaris Hari Ini</h3>
                </div>
                <div className="space-y-2">
                  {stats.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="secondary" className="text-xs">{p.quantity} terjual</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
```

Replace with:

```tsx
          {unitConfig.category === "store" && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold">Penjualan Produk</h3>
                  </div>
                  <div className="flex rounded-lg border overflow-hidden">
                    {([
                      { value: "today" as const, label: "Hari Ini" },
                      { value: "7d" as const, label: "7 Hari" },
                      { value: "30d" as const, label: "30 Hari" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSalesRange(opt.value)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          salesRange === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {stats?.allProductSales && stats.allProductSales.length > 0 ? (
                  <>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {stats.allProductSales.map((p, i) => {
                        const totalRevenue = stats.salesSummary?.totalRevenue ?? 1;
                        const pct = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
                        return (
                          <div key={p.productId}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-5 text-right">{i + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{p.name}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="secondary" className="text-xs">{p.quantity} terjual</Badge>
                                    <span className="text-xs text-muted-foreground">{formatCurrency(p.revenue)}</span>
                                  </div>
                                </div>
                                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500/60 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex gap-4">
                      <span>{stats.salesSummary?.totalProducts} produk</span>
                      <span>{stats.salesSummary?.totalItems} item terjual</span>
                      <span className="font-medium text-foreground">{formatCurrency(stats.salesSummary?.totalRevenue ?? 0)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada penjualan di periode ini</p>
                )}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add full product sales breakdown with range toggle to detail page"
```

---

### Task 3: Update Documentation

**Files:**
- Modify: `manajemen-unit.md`

- [ ] **Step 1: Add Phase 3 section to documentation**

In `manajemen-unit.md`, find the `*Diperbarui: 30 Mei 2026*` line at the end of the file. Before it, append:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add manajemen-unit.md
git commit -m "docs: document Phase 3 full product sales breakdown feature"
```

---

## Self-Review

### Spec Coverage
- [x] Full product sales list → Task 1 (API groupBy without limit) + Task 2 (UI scrollable list)
- [x] Configurable range (today/7d/30d) → Task 1 (range param) + Task 2 (range toggle)
- [x] Per-item revenue + contribution % → Task 2 (progress bar + revenue display)
- [x] Sales summary footer → Task 2 (totalProducts/totalItems/totalRevenue)
- [x] Store units only → Task 1 (`isStore` guard) + Task 2 (`unitConfig.category === "store"`)
- [x] Backward compatibility (`topProducts` preserved) → Task 1 (derived from allProductSales)
- [x] Documentation → Task 3

### Placeholder Scan
- No TBD/TODO found
- All steps contain complete code
- All file paths are exact

### Type Consistency
- `allProductSales` array shape `{ productId, name, quantity, revenue }` defined in API Task 1, consumed in UI Task 2 interface
- `salesRange` type `"today" | "7d" | "30d"` consistent across state, API param, and response
- `salesSummary` shape `{ totalProducts, totalItems, totalRevenue }` defined in API, consumed in UI
- `topProducts` still derived as `{ productId, name, quantity }` — same shape as before, backward compatible
- `rangeStartUTC` computed from `rangeDays` using same `todayStartUTC` base — consistent with existing date math pattern
