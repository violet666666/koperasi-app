# Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the top performance bottlenecks across database, API, and frontend without breaking any existing functionality.

**Architecture:** Additive-only changes — database indexes are non-breaking (`CREATE INDEX CONCURRENTLY` equivalent via `prisma db push`), query optimizations replace slow queries with faster equivalents that return identical data, and frontend optimizations use lazy loading patterns. No schema breaking changes, no API contract changes.

**Tech Stack:** PostgreSQL, Prisma ORM, Next.js App Router, React Native/Expo

---

## Safety Principles

1. **Every task is independently deployable** — each one makes the system faster without depending on other tasks.
2. **No API contract changes** — same request/response shapes, just faster.
3. **No schema breaking changes** — only adding indexes and optional fields.
4. **`prisma db push` not `prisma migrate`** — this project uses push-based schema management.
5. **Test after each task** — verify the affected page/API still works correctly.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add 20+ missing `@@index` declarations |
| `src/lib/services/shu-calculator.ts` | Replace sequential queries with `Promise.all` + `aggregate` instead of `findMany` |
| `src/app/api/dashboard-stats/route.ts` | Add in-memory cache with 60s TTL |
| `src/app/api/mobile/summary/route.ts` | Merge sequential queries into existing `Promise.all` waves |
| `next.config.ts` | Add `optimizePackageImports` for heavy libraries |
| `src/lib/export-utils.ts` | Change to dynamic imports for `xlsx` and `jspdf` |
| `src/app/(protected)/master/import-data/page.tsx` | Dynamic import `xlsx` |
| `src/app/(protected)/toko/produk/import/page.tsx` | Dynamic import `xlsx` |
| `src/app/api/dashboard-stats/route.ts` | Replace `findMany`+JS filter with `aggregate` for store sales |

---

### Task 1: Add Missing Database Indexes

**Files:**
- Modify: `prisma/schema.prisma` (add `@@index` declarations)

This is the single highest-impact, lowest-risk change. Indexes are additive — they don't change data, only speed up reads. PostgreSQL creates them concurrently.

- [ ] **Step 1: Add indexes to models that lack them**

Add these `@@index` lines immediately before each model's closing `}` (or after existing `@@index` lines):

**LoanApplication** (after line 441, before `}`):
```prisma
  @@index([status])
  @@index([memberId])
  @@index([branchId])
  @@index([status, branchId])
```

**Journal** — find `model Journal` and add after its existing indexes or before `@@map`:
```prisma
  @@index([transactionDate])
  @@index([periodId])
  @@index([isPosted])
```

**JournalLine** — find `model JournalLine` and add:
```prisma
  @@index([accountId])
  @@index([journalId])
```

**SavingsAccount** — find `model SavingsAccount` and add:
```prisma
  @@index([memberId])
  @@index([status])
  @@index([memberId, status])
```

**SavingsTransaction** — find `model SavingsTransaction` and verify existing indexes, add if missing:
```prisma
  @@index([memberId])
  @@index([periodId])
  @@index([memberId, status])
```

**CashBankTransaction** — verify existing indexes at lines 401-403, add if missing:
```prisma
  @@index([branchId])
  @@index([category])
  @@index([accountId, transactionDate])
```

**StoreSale** — find `model StoreSale` and add:
```prisma
  @@index([memberId])
  @@index([createdAt])
  @@index([unitType, createdAt])
```

**StoreSaleItem** — verify existing indexes at lines 901-902, add:
```prisma
  @@index([saleId, productId])
```

**Member** — verify existing indexes at lines 274-276, add:
```prisma
  @@index([branchId])
  @@index([branchId, status])
```

**PayrollPeriod** — find `model PayrollPeriod` and add:
```prisma
  @@index([status])
```

**PayrollSlip** — find `model PayrollSlip` and add:
```prisma
  @@index([periodId])
  @@index([memberId])
```

**ApprovalRequest** — find `model ApprovalRequest` and add:
```prisma
  @@index([status])
  @@index([type])
  @@index([type, status])
```

**Receipt** — find `model Receipt` and add:
```prisma
  @@index([memberId])
  @@index([receiptDate])
```

**User** — find `model User` and add:
```prisma
  @@index([roleId])
  @@index([memberId])
  @@index([isActive])
```

- [ ] **Step 2: Push schema changes to database**

Run:
```bash
npx prisma db push
```

Expected: Output shows "Your database is now in sync with your Prisma schema." All indexes created successfully.

- [ ] **Step 3: Verify indexes exist**

Run:
```bash
npx prisma studio
```

Open a table (e.g., `loan_applications`) and verify theIndexes tab shows new indexes. Alternatively, query:
```sql
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;
```

Expected: New indexes visible for `loan_applications`, `journals`, `savings_accounts`, etc.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "perf: add 25+ missing database indexes for frequently queried columns"
```

---

### Task 2: SHU Calculator — Parallelize Sequential Queries

**Files:**
- Modify: `src/lib/services/shu-calculator.ts` (lines 59-198)

Current: 15+ sequential `await` calls. Target: 3 parallel batches.

- [ ] **Step 1: Identify the 3 independent query groups**

The SHU calculator has 3 groups that can each be parallelized internally:

**Group A — Income/Expense (lines 59-158):**
- `journalLine.findMany` (line 59) — if results exist, this is the sole source
- Fallback queries (lines 90-155) — only run if journalLines is empty

**Group B — Member Ratio (lines 163-198):**
- `storeSale.aggregate` member (line 167)
- `storeSale.aggregate` non-member (line 171)
- `loanPayment.aggregate` interest (line 179) — **duplicate of line 110, reuse result**
- `unitTransaction.aggregate` member (line 185)
- `unitTransaction.aggregate` non-member (line 189)

**Group C — Per-member calculations (lines 207+):**
- The big `member.findMany` with 5 includes — runs after Groups A & B

- [ ] **Step 2: Parallelize Group B and eliminate duplicate query**

Replace lines 163-198 with a single `Promise.all`. Also, move the `loanPayment.aggregate` from line 110 to be reused in Group B (eliminate duplicate).

Find the section starting with `// 2. Hitung Rasio Member vs Non-Member` and replace the sequential queries with:

```typescript
    // 2. Hitung Rasio Member vs Non-Member berdasarkan Omzet (parallel)
    const [
        storeSalesMember,
        storeSalesNonMember,
        // Reuse loanInterest if already computed in fallback, otherwise compute here
        loanInterestForRatio,
        unitTxMember,
        unitTxNonMember,
    ] = await Promise.all([
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: { not: null }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }
        }),
        prisma.storeSale.aggregate({
            where: { createdAt: { gte: startDate, lte: endDate }, memberId: null, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
            _sum: { totalAmount: true }
        }),
        // Reuse interestTotal from fallback if available, otherwise query
        Promise.resolve({ _sum: { interestPortion: interestTotal } }),
        prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: { not: null } },
            _sum: { amount: true }
        }),
        prisma.unitTransaction.aggregate({
            where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed", memberId: null },
            _sum: { amount: true }
        }),
    ]);

    memberGrossIncome += toNum(storeSalesMember._sum.totalAmount);
    nonMemberGrossIncome += toNum(storeSalesNonMember._sum.totalAmount);
    memberGrossIncome += toNum(loanInterestForRatio._sum.interestPortion);
    memberGrossIncome += toNum(unitTxMember._sum.amount);
    nonMemberGrossIncome += toNum(unitTxNonMember._sum.amount);
```

**Important:** The variable `interestTotal` is already computed in the fallback block (line 114). If the journal path is taken (line 71: `if (journalLines.length > 0)`), `interestTotal` won't exist. Need to declare it at the top of the function:

Add near line 58 (before the journal lines query):
```typescript
    let interestTotal = 0;
```

Then in the fallback block (line 114), change `const interestTotal` to just use the already-declared variable.

- [ ] **Step 3: Parallelize the fallback block queries**

In the fallback `else` block (starting line 89), wrap the independent queries in `Promise.all`:

Replace lines 90-158 with:
```typescript
        const [expensesTx, incomeTx, loanInterestAgg, unitTx, storeSalesInc, soldItems] = await Promise.all([
            prisma.cashBankTransaction.findMany({
                where: { transactionDate: { gte: startDate, lte: endDate }, category: { in: ["biaya_operasional", "beban_operasional_unit"] } }
            }),
            prisma.cashBankTransaction.findMany({
                where: { transactionDate: { gte: startDate, lte: endDate }, category: "lainnya", type: "in" }
            }),
            prisma.loanPayment.aggregate({
                where: { paymentDate: { gte: startDate, lte: endDate } },
                _sum: { interestPortion: true }
            }),
            prisma.unitTransaction.aggregate({
                where: { transactionDate: { gte: startDate, lte: endDate }, isPaid: true, status: "completed" },
                _sum: { amount: true }
            }),
            prisma.storeSale.aggregate({
                where: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any },
                _sum: { totalAmount: true }
            }),
            prisma.storeSaleItem.findMany({
                where: { sale: { createdAt: { gte: startDate, lte: endDate }, NOT: { metadata: { path: ["isVoided"], equals: true } } as any } },
                include: { product: { select: { costPrice: true } } }
            }),
        ]);

        expensesTx.forEach(tx => totalExpense += toNum(tx.amount));
        if (totalExpense > 0) expenseAccounts["CB-EXP"] = { code: "CB-EXP", name: "Biaya Operasional (Kas & Unit)", amount: totalExpense };

        let cbIncomeTotal = 0;
        incomeTx.forEach(tx => {
            const desc = (tx.description || "").toLowerCase();
            if (!desc.includes("saldo") && !desc.includes("simpan") && !desc.includes("potong") && !desc.includes("angsur")) {
                cbIncomeTotal += toNum(tx.amount);
            }
        });
        totalIncome += cbIncomeTotal;
        if (cbIncomeTotal > 0) incomeAccounts["CB-INC"] = { code: "CB-INC", name: "Pendapatan Lainnya (Kas)", amount: cbIncomeTotal };

        interestTotal = toNum(loanInterestAgg._sum.interestPortion);
        if (interestTotal > 0) {
            totalIncome += interestTotal;
            incomeAccounts["LN-INC"] = { code: "LN-INC", name: "Pendapatan Jasa Pinjaman", amount: interestTotal };
        }

        const unitTxTotal = toNum(unitTx._sum.amount);
        if (unitTxTotal > 0) {
            totalIncome += unitTxTotal;
            incomeAccounts["UT-INC"] = { code: "UT-INC", name: "Pendapatan Usaha Jasa Unit", amount: unitTxTotal };
        }

        const storeIncTotal = toNum(storeSalesInc._sum.totalAmount);
        if (storeIncTotal > 0) {
            totalIncome += storeIncTotal;
            incomeAccounts["ST-INC"] = { code: "ST-INC", name: "Omzet Bruto Toko", amount: storeIncTotal };
        }

        let cogsTotal = 0;
        soldItems.forEach(item => {
            cogsTotal += item.quantity * toNum(item.product?.costPrice);
        });
        if (cogsTotal > 0) {
            totalExpense += cogsTotal;
            expenseAccounts["ST-COGS"] = { code: "ST-COGS", name: "HPP Toko (Modal Barang)", amount: cogsTotal };
        }
```

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "shu-calculator"
```

Expected: No errors related to shu-calculator.ts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/shu-calculator.ts
git commit -m "perf: parallelize SHU calculator queries with Promise.all, eliminate duplicate aggregate"
```

---

### Task 3: Dashboard Stats — Add Cache + Replace findMany with Aggregate

**Files:**
- Modify: `src/app/api/dashboard-stats/route.ts`

Current: 17 parallel queries on every request. Target: Cache results for 60 seconds + replace `findMany` with `aggregate` for store sales.

- [ ] **Step 1: Add in-memory cache at the top of the file**

Add after the imports (line 2):

```typescript
// In-memory cache for dashboard stats (60 second TTL)
let cachedStats: { data: any; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute
```

- [ ] **Step 2: Add cache check at the start of GET handler**

After `try {` (line 6), add:

```typescript
        // Return cached stats if still fresh
        const now = Date.now();
        if (cachedStats && (now - cachedStats.timestamp) < CACHE_TTL_MS) {
            return NextResponse.json({ data: cachedStats.data, cached: true });
        }
```

- [ ] **Step 3: Replace `storeSale.findMany` with `aggregate` for today's sales**

Replace lines 68-73 (the `findMany` for today's store sales):

```typescript
            // Today's store sales — use aggregate instead of findMany
            prisma.storeSale.aggregate({
                _sum: { totalAmount: true },
                _count: { _all: true },
                where: {
                    createdAt: { gte: today, lt: tomorrow },
                    NOT: { metadata: { path: ["isVoided"], equals: true } } as any,
                },
            }),
```

- [ ] **Step 4: Update response processing for the new aggregate result**

Since we changed from `findMany` (array) to `aggregate` (object), update the stats object. Replace lines 223-231:

```typescript
            // Store sales today (now from aggregate, no JS-side filtering needed)
            todayStoreSales: Number(todayStoreSales._sum.totalAmount) || 0,
            todayStoreSalesCount: todayStoreSales._count._all || 0,
```

And update the destructured variable name — it's now `todayStoreSales` (already correct).

- [ ] **Step 5: Store result in cache before returning**

Replace the return statement (line 252):

```typescript
        const result = { data: stats };
        cachedStats = { data: stats, timestamp: Date.now() };
        return NextResponse.json(result);
```

- [ ] **Step 6: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "dashboard-stats"
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/dashboard-stats/route.ts
git commit -m "perf: add 60s cache to dashboard stats, replace findMany with aggregate for store sales"
```

---

### Task 4: Mobile Summary — Merge Sequential Queries into Promise.all

**Files:**
- Modify: `src/app/api/mobile/summary/route.ts` (lines 233-277)

Current: 3 standalone sequential queries after Wave 2. Target: Merge into Wave 2's `Promise.all`.

- [ ] **Step 1: Find the standalone queries after Wave 2**

Lines 233-277 have 3 standalone awaits:
1. `savingsAccount.aggregate` (line 233)
2. `loanPayment.aggregate` (line 258)
3. `getCarwashBonusPerTx()` + `unitTransaction.count` (line 269-277)

- [ ] **Step 2: Move these into Wave 2's Promise.all**

Add these 3 queries to the end of the Wave 2 `Promise.all` array (around line 195). Add them as additional entries:

```typescript
            // SHU preview — merge into wave 2
            prisma.savingsAccount.aggregate({
                where: { status: "active", product: { type: { in: ["pokok", "wajib"] } } },
                _sum: { balance: true }
            }),
            prisma.loanPayment.aggregate({
                where: { memberId, paymentDate: { gte: startDate, lte: endDate } },
                _sum: { interestPortion: true }
            }),
            Promise.all([
                getCarwashBonusPerTx(),
                prisma.unitTransaction.count({
                    where: {
                        memberId,
                        unitType: "cuci_mobil",
                        status: "completed",
                        transactionDate: { gte: startDate, lte: endDate },
                    }
                }),
            ]),
```

Then destructure the additional results from the Wave 2 array.

- [ ] **Step 3: Remove the old standalone queries**

Delete the old lines 233-277 (the sequential standalone queries) since they're now in Wave 2. Update the variable references to use the new destructured names.

- [ ] **Step 4: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "summary"
```

Expected: No errors related to summary route.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/summary/route.ts
git commit -m "perf: merge mobile summary standalone queries into Wave 2 Promise.all"
```

---

### Task 5: next.config.ts — Add optimizePackageImports

**Files:**
- Modify: `next.config.ts`

This tells Next.js to tree-shake barrel imports from heavy libraries, reducing client bundle size by 30-50%.

- [ ] **Step 1: Add optimizePackageImports**

Replace the entire `next.config.ts` with:

```typescript
const nextConfig = {
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@expo/vector-icons",
      "ionicons",
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify build**

Run:
```bash
npx next build 2>&1 | tail -20
```

Expected: Build succeeds. Check the output for reduced bundle sizes on pages that import from these libraries.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "perf: add optimizePackageImports for lucide-react, recharts, date-fns to reduce bundle size"
```

---

### Task 6: Dynamic Import for XLSX and jsPDF

**Files:**
- Modify: `src/lib/export-utils.ts`
- Modify: `src/app/(protected)/master/import-data/page.tsx`
- Modify: `src/app/(protected)/toko/produk/import/page.tsx`

Current: `import * as XLSX from "xlsx"` (500KB+) eagerly loaded on every page that imports export-utils. Target: Load only on button click.

- [ ] **Step 1: Check export-utils.ts imports**

Read `src/lib/export-utils.ts` to find the xlsx and jspdf import lines.

- [ ] **Step 2: Convert static imports to dynamic imports in export-utils.ts**

Replace:
```typescript
import * as XLSX from "xlsx";
```
With nothing at the top level. Instead, inside each function that uses XLSX, add:
```typescript
const XLSX = await import("xlsx");
```

Make the functions `async` if they aren't already.

For jsPDF:
```typescript
const { default: jsPDF } = await import("jspdf");
const autoTable = (await import("jspdf-autotable")).default;
```

- [ ] **Step 3: Convert import-data page.tsx xlsx import**

In `src/app/(protected)/master/import-data/page.tsx`, replace:
```typescript
import * as XLSX from "xlsx";
```
With dynamic import inside the function that uses it:
```typescript
const XLSX = await import("xlsx");
```

- [ ] **Step 4: Convert toko produk import page.tsx xlsx import**

Same pattern in `src/app/(protected)/toko/produk/import/page.tsx`.

- [ ] **Step 5: Type-check**

Run:
```bash
npx tsc --noEmit 2>&1 | grep "export-utils\|import-data\|produk/import"
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/export-utils.ts src/app/(protected)/master/import-data/page.tsx src/app/(protected)/toko/produk/import/page.tsx
git commit -m "perf: dynamic import xlsx and jspdf — load only on export/import button click"
```

---

### Task 7: Add loading.tsx to Key Route Groups

**Files:**
- Create: `src/app/(protected)/loading.tsx`
- Create: `src/app/(public)/loading.tsx`

This adds streaming SSR and route-level loading UI for all pages. Zero risk — it's purely additive.

- [ ] **Step 1: Create protected loading.tsx**

Create `src/app/(protected)/loading.tsx`:

```tsx
export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
                <p className="text-sm text-muted-foreground">Memuat...</p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create public loading.tsx**

Create `src/app/(public)/loading.tsx` with the same content.

- [ ] **Step 3: Verify**

Navigate to any protected page (e.g., `/dashboard`). During page load, the spinner should briefly appear before content renders.

- [ ] **Step 4: Commit**

```bash
git add src/app/(protected)/loading.tsx src/app/(public)/loading.tsx
git commit -m "perf: add loading.tsx for streaming SSR on all protected and public routes"
```

---

### Task 8: Dashboard Cash Flow — Replace groupBy with Aggregate

**Files:**
- Modify: `src/app/api/dashboard-stats/route.ts`

Current: `cashBankTransaction.groupBy` by `["type", "transactionDate"]` returns one row per type per day for 7 months = ~420 rows. Target: Group by month instead.

- [ ] **Step 1: Replace the groupBy query**

Find the `cashBankTransaction.groupBy` (around line 153 in the modified file) and replace with monthly aggregation:

```typescript
            // Cash flow for the last 7 months — aggregate by month instead of per-day
            prisma.$queryRaw<Array<{ type: string; month: Date; total: bigint }>>`
                SELECT type,
                       DATE_TRUNC('month', transaction_date) as month,
                       SUM(amount) as total
                FROM cash_bank_transactions
                WHERE transaction_date >= ${sevenMonthsAgo}::timestamp
                GROUP BY type, DATE_TRUNC('month', transaction_date)
                ORDER BY month ASC
            `,
```

- [ ] **Step 2: Update the processing loop**

Replace the `cashFlowTxRaw.forEach` loop to use the monthly-aggregated data:

```typescript
        (cashFlowTxRaw as any[]).forEach(tx => {
            const txDate = new Date(tx.month);
            const key = `${txDate.getFullYear()}-${txDate.getMonth()}`;
            if (monthlyDataMap.has(key)) {
                const data = monthlyDataMap.get(key)!;
                const total = Number(tx.total || 0);
                if (tx.type === "in") data.simpanan += total;
                if (tx.type === "out") data.pencairan += total;
            }
        });
```

- [ ] **Step 3: Type-check and commit**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard-stats"
git add src/app/api/dashboard-stats/route.ts
git commit -m "perf: replace daily groupBy with monthly raw SQL aggregate for cash flow chart"
```

---

## Summary

| Task | Risk | Impact | Effort |
|------|------|--------|--------|
| 1. Database indexes | Very Low — additive only | Very High | 30 min |
| 2. SHU calculator parallel | Low — same data, faster | High | 1 hour |
| 3. Dashboard cache + aggregate | Low — same response shape | High | 30 min |
| 4. Mobile summary merge | Low — same data | Medium | 30 min |
| 5. optimizePackageImports | Very Low — Next.js feature | High | 10 min |
| 6. Dynamic import xlsx/jspdf | Low — lazy load on click | High | 30 min |
| 7. loading.tsx | Zero risk — additive | Medium | 10 min |
| 8. Cash flow monthly aggregate | Low — same chart data | Medium | 20 min |

**Total estimated effort: 3-4 hours**

**Execution order:** Tasks 1 → 5 → 7 → 3 → 8 → 2 → 4 → 6 (from lowest risk/highest impact to highest effort)
