# Manajemen Unit UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 remaining UX issues (pagination, transaction detail, stock threshold) and add insight export CSV to the Manajemen Unit detail page.

**Architecture:** Extend existing page component with pagination state and expandable transaction rows. Replace hardcoded stock threshold with per-product `minStock` field via raw SQL. Add CSV export button using in-memory Blob generation.

**Tech Stack:** Next.js 15, React hooks (useState, useEffect), Prisma ORM ($queryRaw), shadcn/ui (Button), lucide-react icons.

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Modify | Pagination state, expandable rows, export button |
| 2 | `src/app/api/manajemen-unit/stats/route.ts` | Modify | Use `min_stock` column instead of hardcoded 5 |
| 3 | `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Modify | Use `min_stock` column instead of hardcoded 5 |
| 4 | `manajemen-unit.md` | Modify | Update docs |
| 5 | `OPERATOR.md` | Modify | Update docs |

---

### Task 1: Pagination UI for Products & Transactions

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Add pagination state and import**

Find the state declarations (around line 81-87):

```typescript
  const [stats, setStats] = React.useState<UnitDetailStats | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [productTotal, setProductTotal] = React.useState(0);
  const [txTotal, setTxTotal] = React.useState(0);
```

Add two new state variables after them:

```typescript
  const [productPage, setProductPage] = React.useState(1);
  const [txPage, setTxPage] = React.useState(1);
```

Add `ChevronDown`, `ChevronRight`, and `Download` to the lucide-react import:

```typescript
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, ShoppingCart,
  BarChart3, AlertTriangle, Store, Coffee, UtensilsCrossed,
  Car, Scissors, Dumbbell, Gamepad2, Printer, Shirt, CreditCard, Trophy,
  Clock, Banknote, ChevronDown, ChevronRight, Download,
} from "lucide-react";
```

- [ ] **Step 2: Split fetch into initial load + page change effects**

Replace the single `React.useEffect` (lines 89-127, the one with `fetchData` and `Promise.all`) with three separate effects:

```typescript
  // Initial data fetch (all 3 APIs in parallel)
  React.useEffect(() => {
    if (!unitConfig) return;
    setProductPage(1);
    setTxPage(1);
    setLoading(true);
    async function fetchData() {
      try {
        const [statsRes, prodRes, txRes] = await Promise.all([
          fetch(`/api/manajemen-unit/${unitSlug}/stats`),
          fetch(`/api/manajemen-unit/${unitSlug}/products?page=1&limit=50`),
          fetch(`/api/manajemen-unit/${unitSlug}/transactions?page=1&limit=25`),
        ]);

        if (!statsRes.ok || !prodRes.ok || !txRes.ok) {
          console.error("API error:", { stats: statsRes.status, products: prodRes.status, transactions: txRes.status });
        }

        const [statsJson, prodJson, txJson] = await Promise.all([
          statsRes.json(),
          prodRes.json(),
          txRes.json(),
        ]);

        if (statsJson.data) setStats(statsJson.data);
        if (prodJson.data) {
          setProducts(prodJson.data);
          setProductTotal(prodJson.pagination?.total ?? 0);
        }
        if (txJson.data) {
          setTransactions(txJson.data);
          setTxTotal(txJson.pagination?.total ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch unit detail:", error);
        setError("Gagal memuat data unit. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [unitSlug, unitConfig]);

  // Refetch products on page change (skip page 1 — already loaded)
  React.useEffect(() => {
    if (!unitConfig || productPage === 1) return;
    fetch(`/api/manajemen-unit/${unitSlug}/products?page=${productPage}&limit=50`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setProducts(json.data);
          setProductTotal(json.pagination?.total ?? 0);
        }
      })
      .catch(console.error);
  }, [unitSlug, unitConfig, productPage]);

  // Refetch transactions on page change (skip page 1)
  React.useEffect(() => {
    if (!unitConfig || txPage === 1) return;
    fetch(`/api/manajemen-unit/${unitSlug}/transactions?page=${txPage}&limit=25`)
      .then(res => res.json())
      .then(json => {
        if (json.data) {
          setTransactions(json.data);
          setTxTotal(json.pagination?.total ?? 0);
        }
      })
      .catch(console.error);
  }, [unitSlug, unitConfig, txPage]);
```

- [ ] **Step 3: Add pagination controls below Products table**

Find the Products `TabsContent` (the one with `<TableHead>Nama</TableHead>`). After the closing `</Card>` tag of the products table card (but still inside the TabsContent), add:

```tsx
          {productTotal > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Menampilkan {((productPage - 1) * 50) + 1}–{Math.min(productPage * 50, productTotal)} dari {productTotal} produk
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage(p => p - 1)}
                >
                  ← Sebelumnya
                </Button>
                <span className="text-xs text-muted-foreground">
                  Hal {productPage}/{Math.ceil(productTotal / 50)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage >= Math.ceil(productTotal / 50)}
                  onClick={() => setProductPage(p => p + 1)}
                >
                  Selanjutnya →
                </Button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Add pagination controls below Transactions table**

Find the Transactions `TabsContent` (the one with `<TableHead>No. Transaksi</TableHead>`). After the closing `</Card>` tag of the transactions table card, add:

```tsx
          {txTotal > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Menampilkan {((txPage - 1) * 25) + 1}–{Math.min(txPage * 25, txTotal)} dari {txTotal} transaksi
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage(p => p - 1)}
                >
                  ← Sebelumnya
                </Button>
                <span className="text-xs text-muted-foreground">
                  Hal {txPage}/{Math.ceil(txTotal / 25)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage >= Math.ceil(txTotal / 25)}
                  onClick={() => setTxPage(p => p + 1)}
                >
                  Selanjutnya →
                </Button>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add pagination controls for products and transactions tables"
```

---

### Task 2: Transaction Detail — Expandable Rows

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Add expandedTxId state**

After the `txPage` state (added in Task 1), add:

```typescript
  const [expandedTxId, setExpandedTxId] = React.useState<number | null>(null);
```

- [ ] **Step 2: Replace transaction table rows with expandable version**

Find the Transactions `TableBody` (inside the `TabsContent value="transaksi"`). Replace the entire `TableBody` content:

```tsx
                  <TableBody>
                    {transactions.map((tx) => (
                      <React.Fragment key={tx.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                        >
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {expandedTxId === tx.id
                                ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              }
                              {tx.transactionNo}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{tx.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(tx.date).toLocaleString("id-ID")}
                          </TableCell>
                        </TableRow>
                        {expandedTxId === tx.id && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 px-8 py-3">
                              {tx.type === "pos" && tx.items && tx.items.length > 0 ? (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Detail Item:</p>
                                  {tx.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span>{item.productName} × {item.quantity}</span>
                                      <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : tx.type === "service" ? (
                                <div className="space-y-1 text-sm">
                                  {tx.memberName && (
                                    <p><span className="text-muted-foreground mr-1">Anggota:</span>{tx.memberName}</p>
                                  )}
                                  {tx.description && (
                                    <p><span className="text-muted-foreground mr-1">Keterangan:</span>{tx.description}</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">Tidak ada detail tambahan</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add expandable transaction rows with item/service detail"
```

---

### Task 3: Use Per-Product minStock for Low Stock Threshold

**Files:**
- Modify: `src/app/api/manajemen-unit/stats/route.ts`
- Modify: `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`

- [ ] **Step 1: Update main stats API**

In `src/app/api/manajemen-unit/stats/route.ts`, find the low stock count query (inside the inner `Promise.all`):

```typescript
            // Low stock count (stock <= 5 for store units)
            unitType === "toko" || unitType === "resto" || unitType === "cafe_lsp"
              ? prisma.storeProduct.count({
                  where: { unitType, stock: { lte: 5 }, isActive: true, deletedAt: null },
                })
              : Promise.resolve(0),
```

Replace with:

```typescript
            // Low stock count (stock <= min_stock per product)
            unitType === "toko" || unitType === "resto" || unitType === "cafe_lsp"
              ? prisma.$queryRaw<[{ count: bigint }]>`
                  SELECT COUNT(*)::int as count FROM store_products
                  WHERE unit_type = ${unitType}
                    AND is_active = true
                    AND deleted_at IS NULL
                    AND stock <= min_stock
                `.then(r => Number(r[0].count))
              : Promise.resolve(0),
```

- [ ] **Step 2: Update detail stats API**

In `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts`, find the low stock count query (item 4 in the `Promise.all`):

```typescript
        // Low stock count (stock <= 5)
        isStore
          ? prisma.storeProduct.count({
              where: { unitType, stock: { lte: 5 }, isActive: true, deletedAt: null },
            })
          : Promise.resolve(0),
```

Replace with:

```typescript
        // Low stock count (stock <= min_stock per product)
        isStore
          ? prisma.$queryRaw<[{ count: bigint }]>`
              SELECT COUNT(*)::int as count FROM store_products
              WHERE unit_type = ${unitType}
                AND is_active = true
                AND deleted_at IS NULL
                AND stock <= min_stock
            `.then(r => Number(r[0].count))
          : Promise.resolve(0),
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/manajemen-unit/stats/route.ts src/app/api/manajemen-unit/\[unitSlug\]/stats/route.ts
git commit -m "fix(manajemen-unit): use per-product minStock instead of hardcoded threshold"
```

---

### Task 4: Export Insight CSV Button

**Files:**
- Modify: `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx`

- [ ] **Step 1: Add export CSV function**

Add this function BEFORE the `return` statement (after the `peakHourData` computation, around line 152):

```typescript
  function handleExportCSV() {
    if (!stats || !unitConfig) return;
    const today = new Date().toLocaleDateString("id-ID");
    const lines: string[] = [
      `Laporan Insight Unit - ${unitConfig.label} - ${today}`,
      "",
      "RINGKASAN",
      `Pendapatan Hari Ini,${stats.todayRevenue}`,
      `Transaksi Hari Ini,${stats.todayTransactions}`,
      `Rata-rata Transaksi,${stats.avgTransactionValue}`,
      ...(stats.todayProfit !== undefined ? [
        `Keuntungan Hari Ini,${stats.todayProfit}`,
        `Margin Keuntungan,${stats.profitMargin ?? 0}%`,
      ] : []),
      "",
      "METODE PEMBAYARAN",
      "Metode,Jumlah,Jumlah Transaksi",
      ...stats.paymentMethods.map(pm => `${pm.label},${pm.amount},${pm.count}`),
      "",
    ];

    if (stats.topProducts.length > 0) {
      lines.push(
        "PRODUK TERLARIS",
        "Nama,Jumlah Terjual",
        ...stats.topProducts.map(p => `${p.name},${p.quantity}`),
        "",
      );
    }

    if (stats.peakHours) {
      const activeHours = stats.peakHours.filter(h => h.transactions > 0);
      if (activeHours.length > 0) {
        lines.push(
          "JAM RAMAI",
          "Jam,Transaksi,Pendapatan",
          ...activeHours.map(h => `${h.hour}:00,${h.transactions},${h.revenue}`),
          "",
        );
      }
    }

    if (stats.topProfitProducts && stats.topProfitProducts.length > 0) {
      lines.push(
        "PRODUK PALING MENGUNTUNGKAN",
        "Nama,Keuntungan,Pendapatan,Margin%",
        ...stats.topProfitProducts.map(p => `${p.name},${p.profit},${p.revenue},${p.margin}`),
        "",
      );
    }

    lines.push(
      "PENDAPATAN 7 HARI",
      "Tanggal,Pendapatan,Transaksi",
      ...stats.weekRevenue.map(d => `${d.date},${d.revenue},${d.transactions}`),
    );

    const bom = "﻿";
    const blob = new Blob([bom + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insight-${unitConfig.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
```

- [ ] **Step 2: Add export button to Ringkasan tab**

At the top of the Ringkasan `TabsContent`, BEFORE the weekly comparison Card, add:

```tsx
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!stats}>
              <Download className="h-4 w-4 mr-1" /> Export Laporan
            </Button>
          </div>
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx"
git commit -m "feat(manajemen-unit): add CSV export for unit insight report"
```

---

### Task 5: Update Documentation

**Files:**
- Modify: `manajemen-unit.md`
- Modify: `OPERATOR.md`

- [ ] **Step 1: Update manajemen-unit.md — mark issues as fixed**

In `manajemen-unit.md`, find the "Remaining priority fixes" section:

```markdown
**Remaining priority fixes:**
1. **Issue #9** (LOW) — Add pagination UI for products + transactions
2. **Issue #8** (LOW) — Show transaction detail in expandable rows
3. **Issue #10** (LOW) — Configurable stock threshold
```

Replace with:

```markdown
**Remaining priority fixes:**
~~1. **Issue #9** (LOW) — Add pagination UI~~ → **FIXED** — Pagination controls added to Products + Transactions tabs
~~2. **Issue #8** (LOW) — Show transaction detail~~ → **FIXED** — Expandable rows with item breakdown (POS) / member+description (service)
~~3. **Issue #10** (LOW) — Configurable stock threshold~~ → **FIXED** — Uses per-product `min_stock` column via `$queryRaw`

**All known issues resolved. No remaining items.**
```

- [ ] **Step 2: Update OPERATOR.md**

In `OPERATOR.md`, find the "Known Remaining Issues" table (Section 9.5):

```markdown
### 9.5 Known Remaining Issues

| Issue | Severity | Deskripsi |
|-------|----------|-----------|
| #8 | LOW | Transaction detail not fully rendered (items/description/member) |
| #9 | LOW | No pagination UI for products (max 50) and transactions (max 25) |
| #10 | LOW | Low stock threshold hardcoded to ≤ 5 |
```

Replace with:

```markdown
### 9.5 UX Polish (30 Mei 2026)

| Fix | Deskripsi |
|-----|-----------|
| Pagination UI | Products (50/page) dan Transactions (25/page) sekarang memiliki navigasi halaman |
| Transaction Detail | Baris expandable: POS menampilkan item breakdown, service menampilkan member + keterangan |
| Configurable Stock | Menggunakan `min_stock` per produk (default 5) bukan hardcoded threshold |
| Export CSV | Tombol "Export Laporan" di tab Ringkasan — download CSV dengan semua insight data |

All known issues resolved.
```

- [ ] **Step 3: Commit**

```bash
git add manajemen-unit.md OPERATOR.md
git commit -m "docs: mark issues #8 #9 #10 as fixed, document UX polish features"
```

---

## Self-Review

### Spec Coverage
- [x] Issue #9 (Pagination) → Task 1 (state + effects + controls)
- [x] Issue #8 (Transaction Detail) → Task 2 (expandable rows)
- [x] Issue #10 (Stock Threshold) → Task 3 (min_stock via $queryRaw)
- [x] Export CSV → Task 4 (button + CSV generation)
- [x] Documentation → Task 5

### Placeholder Scan
- No TBD/TODO found
- All steps contain complete code
- All file paths are exact

### Type Consistency
- `productPage` and `txPage` are `number` state — used in URL params and disabled checks
- `expandedTxId` is `number | null` — matches `tx.id` (number)
- Transaction `items` array matches existing interface (`{ productName: string; quantity: number; price: number }[]`)
- `$queryRaw` returns `[{ count: bigint }]` — converted to `number` via `Number(r[0].count)`
- Export function uses `stats` fields that match `UnitDetailStats` interface

### Performance Notes
- Pagination: separate useEffects for page changes — only refetches the changed dataset, not stats
- Stock threshold: `$queryRaw` is a single SQL query — no N+1, no JS-side filtering
- CSV export: in-memory Blob — no server round-trip, no file system writes
- Expandable rows: React.Fragment with conditional render — no extra API calls
