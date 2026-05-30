# Unit Insights Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 advanced insights to the Manajemen Unit detail page: Peak Hours (hourly transaction distribution), Profit Margin (cost vs revenue for store units), and Weekly Comparison (this week vs last week dual-bar chart).

**Architecture:** Extend the existing detail stats API (`[unitSlug]/stats/route.ts`) with new queries and computations. Reuse weekly data for peak hours (filter to today, group by WIB hour). Add new StoreSaleItem query for profit calculation. Extend weekly range from 7 to 14 days for comparison. Add pure helper functions to the service layer with tests.

**Tech Stack:** Next.js 15 Route Handlers, Prisma ORM, NeonDB (PostgreSQL), shadcn/ui (Card, Badge), Vitest, existing WIB timezone pattern.

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `src/lib/services/manajemen-unit.ts` | Modify | Add PeakHour type, computePeakHours, computeProfitFromItems helpers |
| 2 | `src/__tests__/manajemen-unit-peakhours-profit.test.ts` | Create | Tests for computePeakHours and computeProfitFromItems |
| 3 | `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Modify | Add profit query, extend weekly range, compute peak hours + profit + comparison |
| 4 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Modify | Add peak hours chart, profit card, weekly comparison dual bars |
| 5 | `manajemen-unit.md` | Modify | Document Phase 2 features |

---

### Task 1: Service Layer — Types + Pure Helpers + Tests

**Files:**
- Modify: `src/lib/services/manajemen-unit.ts`
- Create: `src/__tests__/manajemen-unit-peakhours-profit.test.ts`

- [ ] **Step 1: Add types and helpers to service layer**

In `src/lib/services/manajemen-unit.ts`, add the following AFTER the `computeUnitDetail` function (after line 56) and BEFORE `aggregateUnitStats`:

```typescript
// --- Phase 2: Peak Hours ---

export interface PeakHour {
  hour: number;
  transactions: number;
  revenue: number;
}

/**
 * Groups transaction records by WIB hour.
 * Only includes records within business hours (minHour–maxHour).
 * @param records — Array of { date, amount } with UTC timestamps
 * @param wibOffset — WIB offset in minutes (420 for UTC+7)
 */
export function computePeakHours(
  records: Array<{ date: Date; amount: number }>,
  wibOffset: number,
  minHour = 6,
  maxHour = 22,
): PeakHour[] {
  const hourMap = new Map<number, { transactions: number; revenue: number }>();
  for (let h = minHour; h <= maxHour; h++) {
    hourMap.set(h, { transactions: 0, revenue: 0 });
  }

  for (const r of records) {
    const wibDate = new Date(r.date.getTime() + wibOffset * 60000);
    const hour = wibDate.getHours();
    const entry = hourMap.get(hour);
    if (entry) {
      entry.transactions += 1;
      entry.revenue += r.amount;
    }
  }

  return Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, data]) => ({ hour, ...data }));
}

// --- Phase 2: Profit Metrics ---

/**
 * Computes profit metrics from sale items.
 * Items must have unitPrice and costPrice already converted to numbers.
 */
export function computeProfitFromItems(
  items: Array<{ unitPrice: number; costPrice: number; quantity: number; productId: number }>,
): {
  todayProfit: number;
  productProfits: Map<number, { profit: number; revenue: number; quantity: number }>;
} {
  let todayProfit = 0;
  const productProfits = new Map<number, { profit: number; revenue: number; quantity: number }>();

  for (const item of items) {
    const itemRevenue = item.unitPrice * item.quantity;
    const itemProfit = (item.unitPrice - item.costPrice) * item.quantity;
    todayProfit += itemProfit;

    const existing = productProfits.get(item.productId) ?? { profit: 0, revenue: 0, quantity: 0 };
    existing.profit += itemProfit;
    existing.revenue += itemRevenue;
    existing.quantity += item.quantity;
    productProfits.set(item.productId, existing);
  }

  return { todayProfit, productProfits };
}
```

- [ ] **Step 2: Write tests for both helpers**

Create `src/__tests__/manajemen-unit-peakhours-profit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computePeakHours, computeProfitFromItems } from "@/lib/services/manajemen-unit";

describe("computePeakHours", () => {
  const WIB_OFFSET = 7 * 60; // 420 minutes

  it("groups records by WIB hour", () => {
    // UTC 01:00 = WIB 08:00, UTC 05:00 = WIB 12:00
    const records = [
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 },
      { date: new Date("2026-05-30T01:30:00Z"), amount: 20000 },
      { date: new Date("2026-05-30T05:00:00Z"), amount: 15000 },
    ];
    const result = computePeakHours(records, WIB_OFFSET);

    expect(result.find(h => h.hour === 8)?.transactions).toBe(2);
    expect(result.find(h => h.hour === 8)?.revenue).toBe(30000);
    expect(result.find(h => h.hour === 12)?.transactions).toBe(1);
    expect(result.find(h => h.hour === 12)?.revenue).toBe(15000);
  });

  it("ignores records outside business hours (6–22)", () => {
    // UTC 22:00 = WIB 05:00 (before 06:00)
    // UTC 16:00 = WIB 23:00 (after 22:00)
    const records = [
      { date: new Date("2026-05-29T22:00:00Z"), amount: 5000 },
      { date: new Date("2026-05-30T16:00:00Z"), amount: 10000 },
    ];
    const result = computePeakHours(records, WIB_OFFSET);

    expect(result.every(h => h.transactions === 0)).toBe(true);
  });

  it("returns all business hours (6–22) even with no data", () => {
    const result = computePeakHours([], WIB_OFFSET);

    expect(result).toHaveLength(17); // hours 6 through 22 inclusive
    expect(result.every(h => h.transactions === 0)).toBe(true);
    expect(result[0].hour).toBe(6);
    expect(result[16].hour).toBe(22);
  });

  it("identifies peak hour by transaction count", () => {
    const records = [
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T04:00:00Z"), amount: 50000 }, // WIB 11:00
    ];
    const result = computePeakHours(records, WIB_OFFSET);
    const peak = result.reduce((max, h) => h.transactions > max.transactions ? h : max, result[0]);

    expect(peak.hour).toBe(8);
    expect(peak.transactions).toBe(3);
  });
});

describe("computeProfitFromItems", () => {
  it("computes total profit and per-product breakdown", () => {
    const items = [
      { unitPrice: 15000, costPrice: 8000, quantity: 2, productId: 1 },
      { unitPrice: 10000, costPrice: 5000, quantity: 3, productId: 2 },
      { unitPrice: 15000, costPrice: 8000, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(29000); // (7000×2) + (5000×3) + (7000×1)
    expect(result.productProfits.get(1)?.profit).toBe(21000); // 7000×3
    expect(result.productProfits.get(2)?.profit).toBe(15000); // 5000×3
    expect(result.productProfits.get(1)?.revenue).toBe(45000); // 15000×3
  });

  it("handles zero cost price (100% margin)", () => {
    const items = [
      { unitPrice: 10000, costPrice: 0, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(10000);
  });

  it("handles negative profit (selling below cost)", () => {
    const items = [
      { unitPrice: 5000, costPrice: 8000, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(-3000);
  });

  it("handles empty items array", () => {
    const result = computeProfitFromItems([]);

    expect(result.todayProfit).toBe(0);
    expect(result.productProfits.size).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/manajemen-unit-peakhours-profit.test.ts`

Expected: All 8 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/manajemen-unit.ts src/__tests__/manajemen-unit-peakhours-profit.test.ts
git commit -m "feat(manajemen-unit): add computePeakHours + computeProfitFromItems helpers with tests"
```

---

### Task 2: Extend Detail Stats API — Queries + Computation

**Files:**
- Modify: `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`

- [ ] **Step 1: Extend date range for weekly comparison**

In `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`, find (line 37):

```typescript
    // 7 days ago for weekly chart
    const weekAgoUTC = new Date(todayStartUTC.getTime() - 6 * 24 * 60 * 60 * 1000);
```

Replace with:

```typescript
    // 14 days ago for weekly comparison chart (Phase 2)
    const twoWeeksAgoUTC = new Date(todayStartUTC.getTime() - 13 * 24 * 60 * 60 * 1000);
```

- [ ] **Step 2: Update import to include new helpers**

Find (line 5):

```typescript
import { computeUnitDetail, type RawUnitDetail } from "@/lib/services/manajemen-unit";
```

Replace with:

```typescript
import { computeUnitDetail, type RawUnitDetail, computePeakHours, computeProfitFromItems } from "@/lib/services/manajemen-unit";
```

- [ ] **Step 3: Update weekly queries to use twoWeeksAgoUTC**

In the Promise.all array, update the weekly store sales query (item 7). Change:

```typescript
            createdAt: { gte: weekAgoUTC },
```

to:

```typescript
            createdAt: { gte: twoWeeksAgoUTC },
```

Update the weekly service transactions query (item 8). Change:

```typescript
            transactionDate: { gte: weekAgoUTC },
```

to:

```typescript
            transactionDate: { gte: twoWeeksAgoUTC },
```

- [ ] **Step 4: Add profit items query to Promise.all**

In the same Promise.all array, add an 11th item AFTER the `topProductItems` query:

```typescript
        // 11. Profit items for store units (today)
        isStore
          ? prisma.storeSaleItem.findMany({
              where: {
                sale: {
                  unitType,
                  createdAt: { gte: todayStartUTC },
                  NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
                },
              },
              select: {
                unitPrice: true,
                costPrice: true,
                quantity: true,
                productId: true,
              },
            })
          : Promise.resolve([]),
```

Update the destructuring (line 41) to include `profitItems`:

```typescript
    const [productCount, activeProductCount, stockResult, lowStockCount, todaySales, todayServiceTx, weekSales, weekServiceTx, storePaymentBreakdown, topProductItems, profitItems] =
```

- [ ] **Step 5: Extend weekMap to 14 days and split**

Find the weekMap initialization:

```typescript
    const weekMap = new Map<string, { revenue: number; transactions: number }>();
    for (let i = 0; i < 7; i++) {
```

Replace with:

```typescript
    const weekMap = new Map<string, { revenue: number; transactions: number }>();
    for (let i = 0; i < 14; i++) {
```

Find the weekRevenue conversion:

```typescript
    const weekRevenue = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));
```

Replace with:

```typescript
    const allDays = Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b));

    const prevWeekRevenue = allDays.slice(0, 7).map(([date, data]) => ({ date, ...data }));
    const weekRevenue = allDays.slice(7).map(([date, data]) => ({ date, ...data }));
```

- [ ] **Step 6: Compute peak hours from today's records**

After the `weekRevenue`/`prevWeekRevenue` construction and BEFORE the service payment breakdown query, add:

```typescript
    // Peak hours: filter today's records from weekly data, group by WIB hour
    const todayWIB = wibNow.toISOString().slice(0, 10);
    const todayPeakRecords = (isStore
      ? weekSales.filter(s => {
          const wibDate = new Date(s.createdAt.getTime() + wibOffset * 60000);
          return wibDate.toISOString().slice(0, 10) === todayWIB;
        }).map(s => ({ date: s.createdAt, amount: Number(s.totalAmount) }))
      : weekServiceTx.filter(t => {
          const wibDate = new Date(t.transactionDate.getTime() + wibOffset * 60000);
          return wibDate.toISOString().slice(0, 10) === todayWIB;
        }).map(t => ({ date: t.transactionDate, amount: Number(t.amount) }))
    );
    const peakHours = computePeakHours(todayPeakRecords, wibOffset);
```

- [ ] **Step 7: Compute profit metrics**

After the peak hours computation and BEFORE the `paymentMap` construction, add:

```typescript
    // Profit metrics (store units only)
    let todayProfit = 0;
    let profitMargin = 0;
    let topProfitProducts: Array<{ productId: number; name: string; profit: number; revenue: number; margin: number }> = [];

    if (isStore && (profitItems as any[]).length > 0) {
      const normalizedItems = (profitItems as any[]).map((item: any) => ({
        unitPrice: Number(item.unitPrice),
        costPrice: Number(item.costPrice ?? 0),
        quantity: item.quantity,
        productId: item.productId,
      }));

      const profitResult = computeProfitFromItems(normalizedItems);
      todayProfit = profitResult.todayProfit;

      // Resolve top profit product names (top 5 by profit)
      const sorted = Array.from(profitResult.productProfits.entries())
        .sort(([, a], [, b]) => b.profit - a.profit)
        .slice(0, 5);

      topProfitProducts = await Promise.all(
        sorted.map(async ([productId, data]) => {
          const product = await prisma.storeProduct.findUnique({
            where: { id: productId },
            select: { name: true },
          });
          return {
            productId,
            name: product?.name ?? "Unknown",
            profit: data.profit,
            revenue: data.revenue,
            margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 10000) / 100 : 0,
          };
        })
      );
    }

    // Use actual todayRevenue for margin calculation (includes discounts, taxes)
    const detailTodayRevenue = isStore
      ? Number(todaySales._sum.totalAmount ?? 0)
      : Number(todayServiceTx._sum.amount ?? 0);

    profitMargin = detailTodayRevenue > 0 && isStore
      ? Math.round((todayProfit / detailTodayRevenue) * 10000) / 100
      : 0;
```

- [ ] **Step 8: Add to API response**

Find the return statement:

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
      },
    });
```

- [ ] **Step 9: Commit**

```bash
git add src/app/api/manajemen-unit/\[unitSlug\]/stats/route.ts
git commit -m "feat(manajemen-unit): add peak hours, profit metrics, and weekly comparison to detail stats API"
```

---

### Task 3: Update Detail Page UI — Peak Hours, Profit, Weekly Comparison

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Update UnitDetailStats interface**

Find the `UnitDetailStats` interface (around line 45) and replace entirely:

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

- [ ] **Step 2: Add new icon imports**

Find the lucide-react import block and add `Clock` and `Banknote`:

```typescript
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, ShoppingCart,
  BarChart3, AlertTriangle, Store, Coffee, UtensilsCrossed,
  Car, Scissors, Dumbbell, Gamepad2, Printer, Shirt, CreditCard, Trophy,
  Clock, Banknote,
} from "lucide-react";
```

- [ ] **Step 3: Add computation helpers for chart scaling**

Find the existing `maxRevenue` and `weekTotal` computations (around line 151-152):

```typescript
  const weekTotal = stats?.weekRevenue.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const maxRevenue = Math.max(...(stats?.weekRevenue.map((d) => d.revenue) ?? [1]), 1);
```

Replace with:

```typescript
  const weekTotal = stats?.weekRevenue.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const maxRevenue = Math.max(
    ...(stats?.weekRevenue.map((d) => d.revenue) ?? [1]),
    ...(stats?.prevWeekRevenue?.map((d) => d.revenue) ?? [1]),
    1,
  );
  const peakHourData = stats?.peakHours && stats.peakHours.some(h => h.transactions > 0) ? {
    maxTx: Math.max(...stats.peakHours.map(h => h.transactions), 1),
    peak: stats.peakHours.reduce((max, h) => h.transactions > max.transactions ? h : max, stats.peakHours[0]),
  } : null;
```

- [ ] **Step 4: Replace 7-day chart with dual-bar weekly comparison**

In the Ringkasan tab, find the "Pendapatan 7 Hari Terakhir" Card. Replace the card title and chart content. Change:

```tsx
              <h3 className="font-semibold mb-4">Pendapatan 7 Hari Terakhir</h3>
```

to:

```tsx
              <h3 className="font-semibold mb-4">Perbandingan Mingguan</h3>
```

Then replace the entire `<div className="flex items-end gap-1 h-40">` block (the bar chart) with:

```tsx
                  <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-muted-foreground/20 rounded" />
                      Minggu lalu
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-primary/80 rounded" />
                      Minggu ini
                    </div>
                  </div>
                  <div className="flex items-end gap-1 h-40">
                    {stats?.weekRevenue.map((day, i) => {
                      const prevDay = stats?.prevWeekRevenue?.[i];
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground">
                            {formatCurrency(day.revenue).replace("Rp", "").trim()}
                          </span>
                          <div className="flex gap-px items-end h-32 w-full">
                            {prevDay && (
                              <div
                                className="flex-1 bg-muted-foreground/20 rounded-t"
                                style={{ height: `${Math.max((prevDay.revenue / maxRevenue) * 100, prevDay.revenue > 0 ? 4 : 0)}%` }}
                                title={`Minggu lalu: ${formatCurrency(prevDay.revenue)}`}
                              />
                            )}
                            <div
                              className="flex-1 bg-primary/80 rounded-t"
                              style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, day.revenue > 0 ? 4 : 0)}%` }}
                              title={`Minggu ini: ${formatCurrency(day.revenue)}`}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            {new Date(day.date).toLocaleDateString("id-ID", { weekday: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
```

Keep the existing footer ("Total minggu ini: ...") as-is.

- [ ] **Step 5: Add peak hours chart section**

After the weekly comparison Card's closing `</Card>`, and BEFORE the 2-column grid, add:

```tsx
          {/* Peak Hours */}
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Jam Ramai Hari Ini</h3>
              </div>
              {loading ? (
                <div className="h-28 bg-muted rounded animate-pulse" />
              ) : peakHourData ? (
                <>
                  <div className="flex items-end gap-0.5 h-28">
                    {stats?.peakHours?.map((h) => (
                      <div key={h.hour} className="flex-1 flex flex-col items-center">
                        <div
                          className={`w-full rounded-t ${
                            h.hour === peakHourData.peak.hour ? "bg-amber-500" : "bg-primary/50"
                          }`}
                          style={{ height: `${Math.max((h.transactions / peakHourData.maxTx) * 100, h.transactions > 0 ? 4 : 0)}%` }}
                          title={`${h.hour}:00 — ${h.transactions} transaksi, ${formatCurrency(h.revenue)}`}
                        />
                        {h.hour % 3 === 0 && (
                          <span className="text-[9px] text-muted-foreground mt-0.5">{h.hour}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Puncak: <span className="font-medium text-foreground">{peakHourData.peak.hour}:00</span> ({peakHourData.peak.transactions} transaksi)
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini</p>
              )}
            </CardContent>
          </Card>
```

- [ ] **Step 6: Add profit overview section (store units only)**

After the existing Top Products card (the `<Trophy>` card), add:

```tsx
          {/* Profit overview (store units only) */}
          {stats?.todayProfit !== undefined && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Keuntungan Hari Ini</h3>
                  </div>
                  <Badge
                    variant={stats.profitMargin >= 20 ? "default" : stats.profitMargin > 0 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {stats.profitMargin?.toFixed(1)}% margin
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(stats.todayProfit)}</div>
                {stats.topProfitProducts && stats.topProfitProducts.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Produk paling menguntungkan:</p>
                    {stats.topProfitProducts.slice(0, 3).map((p, i) => (
                      <div key={p.productId} className="flex justify-between text-sm">
                        <span>
                          <span className="text-muted-foreground mr-1">{i + 1}.</span>
                          {p.name}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(p.profit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 7: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add peak hours chart, profit card, and weekly comparison to detail page"
```

---

### Task 4: Update Documentation

**Files:**
- Modify: `manajemen-unit.md`

- [ ] **Step 1: Add Phase 2 section to documentation**

In `manajemen-unit.md`, find the line `*Diperbarui: 30 Mei 2026*` at the end of the file. Before it, append:

```markdown
### Phase 2 Insights (30 Mei 2026)

| ID | Insight | Lokasi | Deskripsi |
|---|---------|--------|-----------|
| **I-02** | Jam Ramai (Peak Hours) | Detail → Ringkasan tab | Bar chart distribusi transaksi per jam (06:00–22:00 WIB). Highlight jam puncak. |
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
```

- [ ] **Step 2: Commit**

```bash
git add manajemen-unit.md
git commit -m "docs: document Unit Insights Phase 2 features"
```

---

## Self-Review

### Spec Coverage
- [x] I-02 Peak Hours → Task 1 (helper) + Task 2 (API computation) + Task 3 (UI chart)
- [x] I-04 Profit Margin → Task 1 (helper) + Task 2 (API query + computation) + Task 3 (UI card)
- [x] I-06 Weekly Comparison → Task 2 (extend range + split) + Task 3 (dual bars UI)
- [x] Documentation → Task 4

### Placeholder Scan
- No TBD/TODO found
- All steps contain complete code
- All file paths are exact

### Type Consistency
- `PeakHour` type (hour, transactions, revenue) defined in Task 1 service layer, used in Task 2 API, consumed in Task 3 UI interface
- `profitItems` query returns Prisma Decimal fields → normalized to `number` via `Number()` before calling `computeProfitFromItems`
- `prevWeekRevenue` type matches `weekRevenue` type (`{ date: string; revenue: number; transactions: number }[]`)
- `topProfitProducts` includes `margin` field (number, percentage to 2 decimals) matching UI display
- `computePeakHours` output shape matches UI `peakHours` interface field

### Performance Notes
- 11 parallel queries in Promise.all (was 10, added profit items for store units)
- Weekly queries fetch 14 days instead of 7 (same query, wider range — minimal overhead since select is lightweight)
- Peak hours reuses existing weekly data (no additional query — filters in JS)
- Profit product name resolution: up to 5 individual `findUnique` calls (same pattern as Phase 1 top products)
- Peak hours filtering adds O(n) scan over weekly records — negligible for 14 days of data
