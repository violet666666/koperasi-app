# Unit Insights Phase 1 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 key insights to the Manajemen Unit feature: Revenue Trend (↑/↓%), Top 5 Products, and Payment Method Breakdown.

**Architecture:** Extend existing stats APIs to include additional computed data (yesterday revenue for trend, payment breakdown, top products). Extend UI pages to display the new data. No new endpoints or pages needed — purely enrichment of existing ones.

**Tech Stack:** Next.js 15 Route Handlers, Prisma ORM, NeonDB (PostgreSQL), shadcn/ui (Card, Badge), Recharts (bar/donut chart), existing WIB timezone pattern.

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `src/lib/services/manajemen-unit.ts` | Modify | Add types for trend, payment breakdown, top products |
| 2 | `src/app/api/manajemen-unit/stats/route.ts` | Modify | Add yesterday revenue per unit for trend calculation |
| 3 | `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Modify | Add payment breakdown + top products queries |
| 4 | `src/app/(protected)/manajemen-unit/page.tsx` | Modify | Show trend badge (↑/↓%) on each unit card |
| 5 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Modify | Show insights section in Ringkasan tab |

---

### Task 1: Extend Service Layer Types + Stats API with Trend Data

**Files:**
- Modify: `src/lib/services/manajemen-unit.ts`
- Modify: `src/app/api/manajemen-unit/stats/route.ts`

- [ ] **Step 1: Add new fields to service types**

In `src/lib/services/manajemen-unit.ts`, add `yesterdayRevenue` and `revenueTrend` to the interfaces:

Add to `RawUnitStats` (after `todayRevenue`):
```typescript
  yesterdayRevenue: number;
```

Add to `UnitSummary` (after `todayRevenue`):
```typescript
  yesterdayRevenue: number;
  revenueTrend: number | null; // percentage change, null if yesterday was 0
```

Update `aggregateUnitStats` function to compute `revenueTrend` and pass through `yesterdayRevenue`. Replace the entire function:

```typescript
export function aggregateUnitStats(rawStats: RawUnitStats[]): AggregatedStats {
  const units: UnitSummary[] = rawStats.map((raw) => {
    const config = UNIT_TYPES[raw.unitType];
    const trend = raw.yesterdayRevenue > 0
      ? Math.round(((raw.todayRevenue - raw.yesterdayRevenue) / raw.yesterdayRevenue) * 100)
      : null;
    return {
      unitType: raw.unitType,
      label: config?.label ?? raw.unitType,
      category: config?.category ?? "service",
      slug: config?.slug ?? unitTypeToSlug(raw.unitType),
      productCount: raw.productCount,
      activeProductCount: raw.activeProductCount,
      todayTransactionCount: raw.todayTransactionCount,
      todayRevenue: raw.todayRevenue,
      yesterdayRevenue: raw.yesterdayRevenue,
      revenueTrend: trend,
      lowStockCount: raw.lowStockCount,
    };
  });

  return {
    totalUnits: units.length,
    totalProducts: units.reduce((sum, u) => sum + u.productCount, 0),
    totalTransactions: units.reduce((sum, u) => sum + u.todayTransactionCount, 0),
    totalRevenue: units.reduce((sum, u) => sum + u.todayRevenue, 0),
    units,
  };
}
```

- [ ] **Step 2: Extend stats API to fetch yesterday's revenue**

In `src/app/api/manajemen-unit/stats/route.ts`, add yesterday boundary calculation AFTER `todayStartUTC`:

```typescript
    const yesterdayStartUTC = new Date(todayStartUTC.getTime() - 24 * 60 * 60 * 1000);
```

Then inside the `unitTypes.map` callback, after computing today's revenue and BEFORE the `return` statement, add the yesterday revenue queries. Insert this block after the `serviceTxCount` line and before the `return`:

```typescript
        // Yesterday revenue for trend comparison
        const yesterdayStoreRevenue = isStoreUnit
          ? await prisma.storeSale.aggregate({
              _sum: { totalAmount: true },
              where: {
                unitType,
                createdAt: { gte: yesterdayStartUTC, lt: todayStartUTC },
                NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
              },
            })
          : { _sum: { totalAmount: 0 as any } };

        const yesterdayServiceRevenue = !isStoreUnit
          ? await prisma.unitTransaction.aggregate({
              _sum: { amount: true },
              where: {
                unitType,
                transactionDate: { gte: yesterdayStartUTC, lt: todayStartUTC },
                status: { not: "voided" },
              },
            })
          : { _sum: { amount: 0 as any } };

        const yesterdayRevenue =
          Number(yesterdayStoreRevenue._sum.totalAmount ?? 0) +
          Number(yesterdayServiceRevenue._sum.amount ?? 0);
```

Then update the `return` object to include `yesterdayRevenue`:

```typescript
        return {
          unitType,
          productCount,
          activeProductCount,
          todayTransactionCount: storeTxCount + serviceTxCount,
          todayRevenue: storeRevenue + Number(serviceRevenue._sum.amount ?? 0),
          yesterdayRevenue,
          lowStockCount,
        };
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/manajemen-unit.ts src/app/api/manajemen-unit/stats/route.ts
git commit -m "feat(manajemen-unit): add revenue trend data (yesterday vs today) to stats API"
```

---

### Task 2: Extend Detail Stats API with Payment Breakdown + Top Products

**Files:**
- Modify: `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`

- [ ] **Step 1: Add payment breakdown query**

In `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`, find the large `Promise.all` block that fetches 8 queries. Add 2 new queries to the array (making it 10 total):

After the `weekServiceTx` query (the 8th item), add these as the 9th and 10th items in the Promise.all array:

```typescript
        // Payment method breakdown (today)
        prisma.storeSale.groupBy({
          by: ["paymentMethod"],
          _sum: { totalAmount: true },
          _count: true,
          where: {
            unitType,
            createdAt: { gte: todayStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
        }),
        // Top 5 products by quantity sold (today, store units only)
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

Update the destructuring to match (add `paymentBreakdown, topProductItems`):

```typescript
    const [productCount, activeProductCount, stockResult, lowStockCount, todaySales, todayServiceTx, weekSales, weekServiceTx, paymentBreakdown, topProductItems] =
```

- [ ] **Step 2: Also fetch service payment breakdown for service units**

After the Promise.all block and BEFORE the `weekMap` construction, add:

```typescript
    // Service payment breakdown for non-store units
    const servicePaymentBreakdown = !isStore
      ? await prisma.unitTransaction.groupBy({
          by: ["paymentMethod"],
          _sum: { amount: true },
          _count: true,
          where: {
            unitType,
            transactionDate: { gte: todayStartUTC },
            status: { not: "voided" },
          },
        })
      : [];
```

- [ ] **Step 3: Resolve top product names**

After `weekRevenue` construction and BEFORE the `raw` object, add:

```typescript
    // Resolve top product names
    const topProducts = topProductItems.length > 0
      ? await Promise.all(
          topProductItems.map(async (item) => {
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

- [ ] **Step 4: Build payment method summary**

After topProducts construction, add:

```typescript
    // Combine payment breakdown from store + service
    const paymentMap = new Map<string, { amount: number; count: number }>();

    for (const p of paymentBreakdown as Array<{ paymentMethod: string; _sum: { totalAmount: number | null }; _count: number }>) {
      const method = p.paymentMethod || "cash";
      const existing = paymentMap.get(method) ?? { amount: 0, count: 0 };
      existing.amount += Number(p._sum.totalAmount ?? 0);
      existing.count += p._count;
      paymentMap.set(method, existing);
    }

    for (const p of servicePaymentBreakdown as Array<{ paymentMethod: string; _sum: { amount: number | null }; _count: number }>) {
      const method = p.paymentMethod || "cash";
      const existing = paymentMap.get(method) ?? { amount: 0, count: 0 };
      existing.amount += Number(p._sum.amount ?? 0);
      existing.count += p._count;
      paymentMap.set(method, existing);
    }

    const paymentMethods = Array.from(paymentMap.entries()).map(([method, data]) => ({
      method,
      label: method === "cash" ? "Tunai" : method === "qris" ? "QRIS" : method === "salary_cut" ? "Potong Gaji" : method,
      amount: data.amount,
      count: data.count,
    }));
```

- [ ] **Step 5: Add to response**

Update the return statement to include `topProducts` and `paymentMethods`. Find the existing `return NextResponse.json({ data: { ... } })` and add after `...detail`:

```typescript
    return NextResponse.json({
      data: {
        unitType,
        label: getUnitLabel(unitType),
        ...detail,
        topProducts,
        paymentMethods,
      },
    });
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/manajemen-unit/\[unitSlug\]/stats/route.ts
git commit -m "feat(manajemen-unit): add payment breakdown + top products to detail stats API"
```

---

### Task 3: Update Main Dashboard UI — Trend Badge on Unit Cards

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/page.tsx`

- [ ] **Step 1: Update AggregatedStats interface to include new fields**

In the local `AggregatedStats` interface (around line 33), update the `units` array type to include:

```typescript
interface AggregatedStats {
  totalUnits: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  units: {
    unitType: string;
    label: string;
    category: string;
    slug: string;
    productCount: number;
    activeProductCount: number;
    todayTransactionCount: number;
    todayRevenue: number;
    yesterdayRevenue: number;
    revenueTrend: number | null;
    lowStockCount: number;
  }[];
}
```

- [ ] **Step 2: Add trend badge import**

Add `TrendingDown` to the lucide-react imports (alongside existing `TrendingUp`):

```typescript
import {
  Layers, Package, TrendingUp, TrendingDown, ShoppingBag,
  Store, Coffee, UtensilsCrossed, Car, Scissors,
  Dumbbell, Gamepad2, Printer, Shirt,
  ArrowRight, AlertTriangle,
} from "lucide-react";
```

- [ ] **Step 3: Add trend badge to each unit card**

Inside the unit card rendering (where `unitStat` is used), find the "Pendapatan hari ini" section. Replace the revenue display with a version that includes the trend indicator. Find:

```tsx
                      <div className="col-span-2">
                        <span className="block text-foreground font-medium">
                          {formatCurrency(unitStat?.todayRevenue ?? 0)}
                        </span>
                        Pendapatan hari ini
                      </div>
```

Replace with:

```tsx
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-foreground font-medium">
                            {formatCurrency(unitStat?.todayRevenue ?? 0)}
                          </span>
                          {unitStat?.revenueTrend !== null && unitStat?.revenueTrend !== undefined && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                              unitStat.revenueTrend >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {unitStat.revenueTrend >= 0
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />
                              }
                              {unitStat.revenueTrend >= 0 ? "+" : ""}{unitStat.revenueTrend}%
                            </span>
                          )}
                        </div>
                        Pendapatan hari ini
                      </div>
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/page.tsx"
git commit -m "feat(manajemen-unit): show revenue trend badge (↑/↓%) on unit cards"
```

---

### Task 4: Update Detail Page UI — Insights Section in Ringkasan Tab

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Update UnitDetailStats interface**

Add new fields to the local `UnitDetailStats` interface (around line 44):

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
}
```

- [ ] **Step 2: Add TrendingDown import**

Add `TrendingDown` to the lucide-react import (alongside existing `TrendingUp`):

```typescript
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, ShoppingCart,
  BarChart3, AlertTriangle, Store, Coffee, UtensilsCrossed,
  Car, Scissors, Dumbbell, Gamepad2, Printer, Shirt, CreditCard, Trophy,
} from "lucide-react";
```

- [ ] **Step 3: Replace placeholder "Metode Pembayaran" card with real payment breakdown**

Find the Ringkasan tab section. Replace the "Metode Pembayaran" placeholder card with real data. Find the card that says "Data detail metode pembayaran tersedia di tab Transaksi" and replace it with:

```tsx
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Metode Pembayaran Hari Ini</h3>
                </div>
                {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                  <div className="space-y-2">
                    {stats.paymentMethods.map((pm) => {
                      const total = stats.paymentMethods.reduce((s, p) => s + p.amount, 0);
                      const pct = total > 0 ? Math.round((pm.amount / total) * 100) : 0;
                      return (
                        <div key={pm.method} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{pm.label}</span>
                            <span className="text-muted-foreground">{formatCurrency(pm.amount)} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini</p>
                )}
              </CardContent>
            </Card>
```

- [ ] **Step 4: Add Top Products section below the 2-card grid**

After the closing `</div>` of the 2-card grid (Stok + Metode Pembayaran), add a new section for Top Products. This only shows for store units. Insert after the grid:

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

- [ ] **Step 5: Add trend indicator to Pendapatan stat card**

Find the stat card for "Pendapatan Hari Ini" (the one with `icon={TrendingUp}`). Replace it with a version that includes yesterday comparison:

```tsx
<StatCard
  title="Pendapatan Hari Ini"
  value={formatCurrency(stats?.todayRevenue ?? 0)}
  icon={stats && stats.todayRevenue >= (stats?.weekRevenue?.reduce((s, d) => s + (d.revenue), 0) / 7 || 0) ? TrendingUp : TrendingDown}
  sub={stats?.weekRevenue ? `${formatCurrency(stats.weekRevenue.reduce((s, d) => s + d.revenue, 0))} minggu ini` : undefined}
/>
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add payment breakdown, top products, and trend indicator to detail page"
```

---

### Task 5: Update manajemen-unit.md Documentation

**Files:**
- Modify: `manajemen-unit.md`

- [ ] **Step 1: Add insights section to documentation**

Append a new section at the end of `manajemen-unit.md`, before the "*Diperbarui*" line:

```markdown
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
  "revenueTrend": 12  // percentage, null if yesterday was 0
}
```

**GET /api/manajemen-unit/{slug}/stats** — now includes:
```json
{
  "topProducts": [{ "productId": 1, "name": "Nasi Goreng", "quantity": 15 }],
  "paymentMethods": [{ "method": "cash", "label": "Tunai", "amount": 500000, "count": 8 }]
}
```
```

- [ ] **Step 2: Commit**

```bash
git add manajemen-unit.md
git commit -m "docs: document Unit Insights Phase 1 MVP feature"
```

---

## Self-Review

### Spec Coverage
- [x] I-01 Revenue Trend → Task 1 (API) + Task 3 (main UI) + Task 4 (detail UI)
- [x] I-03 Payment Breakdown → Task 2 (API) + Task 4 (detail UI)
- [x] I-05 Top Products → Task 2 (API) + Task 4 (detail UI)
- [x] Documentation → Task 5

### Placeholder Scan
- No TBD/TODO found
- All steps contain complete code
- All file paths are exact

### Type Consistency
- `yesterdayRevenue: number` and `revenueTrend: number | null` defined in Task 1 service layer, used in Task 3 UI
- `topProducts` and `paymentMethods` defined in Task 2 API, consumed in Task 4 UI with matching interface
- Payment label mapping (`cash` → `Tunai`, `qris` → `QRIS`, `salary_cut` → `Potong Gaji`) matches existing pattern from `export-utils.ts`
