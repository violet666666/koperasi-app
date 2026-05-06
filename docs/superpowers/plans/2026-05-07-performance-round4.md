# Performance Round 4 — Neon HTTP Adapter + Report SQL Aggregation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce API cold start latency by ~200-400ms via Neon HTTP adapter for read-only routes, and optimize loans-recap report with SQL aggregation.

**Architecture:** Dual PrismaClient pattern — HTTP adapter for read-only routes (faster cold starts), existing TCP client for transaction routes (unchanged). Read-only routes identified by absence of `$transaction` and `prisma.*.create/update/delete` calls.

**Tech Stack:** @prisma/adapter-neon, @neondatabase/serverless, Prisma $queryRaw

---

## Files to Create/Modify

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/prisma.ts` | Modify | Add HTTP adapter client export alongside existing TCP client |
| `package.json` | Modify | Add @prisma/adapter-neon + @neondatabase/serverless |
| `src/app/api/reports/loans-recap/route.ts` | Modify | Replace JS aggregation with SQL GROUP BY |

Read-only routes that will switch to HTTP client (verified no writes/transactions):
- `src/app/api/master/accounts/route.ts` (GET only)
- `src/app/api/toko/products/route.ts` (GET handler only)
- `src/app/api/reports/laba-rugi/route.ts`
- `src/app/api/reports/neraca/route.ts`
- `src/app/api/reports/arus-kas/route.ts`
- `src/app/api/reports/piutang-gabungan/route.ts`
- `src/app/api/reports/loans-recap/route.ts`
- `src/app/api/mobile/summary/route.ts`
- `src/app/api/mobile/reports/financial/route.ts`

---

### Task 1: Install Neon Serverless Adapter

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install @prisma/adapter-neon @neondatabase/serverless
```

- [ ] **Step 2: Verify installation**

Run: `npm ls @prisma/adapter-neon @neondatabase/serverless`
Expected: Both packages listed with versions

---

### Task 2: Create Dual PrismaClient — HTTP + TCP

**Files:**
- Modify: `src/lib/prisma.ts`

The existing `prisma` export stays as TCP client (used by 47 transaction routes).
New `prismaRead` export uses Neon HTTP adapter (for read-only routes).

**Constraints:**
- Neon HTTP adapter does NOT support `$transaction` — any route using it MUST use TCP `prisma`
- Neon HTTP adapter does NOT support `create/update/delete` — only `findMany/findUnique/aggregate/$queryRaw`
- In development, both clients use TCP (HTTP adapter is only for Vercel serverless)
- Both clients share the same `DATABASE_URL`

- [ ] **Step 1: Update prisma.ts with dual client**

Replace the entire file with:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    prismaRead: PrismaClient | undefined;
};

function createTCPClient() {
    return new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
        datasources: { db: { url: process.env.DATABASE_URL } },
    });
}

// TCP client — for writes and $transaction (47 routes depend on this)
export const prisma = globalForPrisma.prisma ?? createTCPClient();

// HTTP client — for read-only routes (faster cold starts on Vercel)
// Falls back to TCP in development or if adapter unavailable
export const prismaRead: PrismaClient = (() => {
    if (globalForPrisma.prismaRead) return globalForPrisma.prismaRead;

    if (process.env.VERCEL) {
        try {
            const { PrismaNeonHTTP } = require("@prisma/adapter-neon");
            const { neon } = require("@neondatabase/serverless");
            const sql = neon(process.env.DATABASE_URL!);
            const adapter = new PrismaNeonHTTP(sql);
            const client = new PrismaClient({ adapter, log: ["error"] });
            globalForPrisma.prismaRead = client;
            return client;
        } catch {
            // Fallback to TCP if adapter fails to load
            const client = createTCPClient();
            globalForPrisma.prismaRead = client;
            return client;
        }
    }

    // Development: use TCP
    const client = createTCPClient();
    globalForPrisma.prismaRead = client;
    return client;
})();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaRead = prismaRead;
}

export default prisma;
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit 2>&1 | grep "prisma.ts" || echo "No errors in prisma.ts"`
Expected: "No errors in prisma.ts" (existing errors in other files are OK)

- [ ] **Step 3: Commit**

```bash
git add src/lib/prisma.ts package.json package-lock.json
git commit -m "feat: add Neon HTTP adapter for read-only routes alongside TCP client for transactions"
```

---

### Task 3: Wire prismaRead into Read-Only Routes

**Files to modify (GET handlers only):**
- `src/app/api/master/accounts/route.ts`
- `src/app/api/toko/products/route.ts`
- `src/app/api/reports/laba-rugi/route.ts`
- `src/app/api/reports/neraca/route.ts`
- `src/app/api/reports/arus-kas/route.ts`
- `src/app/api/reports/piutang-gabungan/route.ts`
- `src/app/api/mobile/summary/route.ts`
- `src/app/api/mobile/reports/financial/route.ts`

**Pattern for each file:**

The import changes from:
```typescript
import prisma from "@/lib/prisma";
// or
import prisma from "@/lib/prisma";
```

To:
```typescript
import { prismaRead } from "@/lib/prisma";
```

Then rename all `prisma.` calls in the GET handler to `prismaRead.`.

**IMPORTANT:** Only the GET handler uses `prismaRead`. POST/PUT/DELETE handlers must keep using `prisma` (TCP). For files with only a GET handler, replace the default import entirely.

- [ ] **Step 1: Update accounts route (GET only)**

In `src/app/api/master/accounts/route.ts`:
- Change `import prisma from "@/lib/prisma"` to `import { prismaRead } from "@/lib/prisma"`
- In POST handler, add `import prisma from "@/lib/prisma"` or use named import `{ prismaRead, default as prisma }`
- Actually: import both — `import prisma, { prismaRead } from "@/lib/prisma"`
- In GET handler: replace `prisma.` with `prismaRead.`
- In POST handler: keep `prisma.` (it does writes)

- [ ] **Step 2: Update toko products route (GET handler only)**

In `src/app/api/toko/products/route.ts`:
- Import both: `import prisma, { prismaRead } from "@/lib/prisma"`
- GET handler: `prisma.` → `prismaRead.`
- POST handler: keep `prisma.`

- [ ] **Step 3: Update report routes (all GET only)**

For each of these files (GET handlers only, no POST):
- `src/app/api/reports/laba-rugi/route.ts`
- `src/app/api/reports/neraca/route.ts`
- `src/app/api/reports/arus-kas/route.ts`
- `src/app/api/reports/piutang-gabungan/route.ts`

Change: `import prisma from "@/lib/prisma"` → `import { prismaRead } from "@/lib/prisma"`
Replace: all `prisma.` → `prismaRead.` in the file

- [ ] **Step 4: Update mobile read-only routes**

For each of these files (GET handlers only):
- `src/app/api/mobile/summary/route.ts`
- `src/app/api/mobile/reports/financial/route.ts`

Change: `import prisma from "@/lib/prisma"` → `import { prismaRead } from "@/lib/prisma"`
Replace: all `prisma.` → `prismaRead.` in the file

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "(accounts|products|laba-rugi|neraca|arus-kas|piutang|mobile/summary|financial)" || echo "No errors in modified files"`
Expected: No errors in modified files (pre-existing errors in other files OK)

- [ ] **Step 6: Commit**

```bash
git add src/app/api/master/accounts/route.ts src/app/api/toko/products/route.ts src/app/api/reports/laba-rugi/route.ts src/app/api/reports/neraca/route.ts src/app/api/reports/arus-kas/route.ts src/app/api/reports/piutang-gabungan/route.ts src/app/api/mobile/summary/route.ts src/app/api/mobile/reports/financial/route.ts
git commit -m "perf: wire Neon HTTP adapter into read-only routes for faster cold starts"
```

---

### Task 4: Loans-Recap SQL Aggregation

**Files:**
- Modify: `src/app/api/reports/loans-recap/route.ts`

Replace the `findMany` + JS reduce pattern with SQL GROUP BY. Same pattern used in laba-rugi, neraca, arus-kas fixes.

- [ ] **Step 1: Replace entire file with SQL aggregation**

The current code:
1. Loads all loan products
2. Loads ALL loans with their application.productId
3. Groups in JS by productId, then reduces per group

Replace with two SQL queries:
1. Get loan products (same as before)
2. Single SQL query that GROUP BY product_id with SUM aggregates

```typescript
import { NextResponse } from "next/server";
import { prismaRead } from "@/lib/prisma";

interface ProductLoanSummary {
    product_id: number;
    total_loans: number;
    total_disbursed: number;
    total_outstanding: number;
    total_paid: number;
    total_principal: number;
}

// GET /api/reports/loans-recap
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const yearParam = searchParams.get("year");

        const startDate = yearParam ? new Date(`${yearParam}-01-01`) : null;
        const endDate = yearParam ? new Date(`${yearParam}-12-31`) : null;

        const [loanProducts, loanAgg] = await Promise.all([
            prismaRead.loanProduct.findMany({
                where: { isActive: true },
                select: { id: true, code: true, name: true, interestRate: true },
            }),
            prismaRead.$queryRaw<ProductLoanSummary[]>`
                SELECT
                    la.product_id,
                    COUNT(l.id)::int as total_loans,
                    COALESCE(SUM(COALESCE(l.disbursed_amount, l.principal_amount)), 0)::float as total_disbursed,
                    COALESCE(SUM(l.principal_outstanding), 0)::float as total_outstanding,
                    COALESCE(SUM(l.principal_paid), 0)::float as total_paid,
                    COALESCE(SUM(l.principal_amount), 0)::float as total_principal
                FROM loans l
                JOIN loan_applications la ON l.application_id = la.id
                WHERE 1=1
                  ${branchId ? prismaRead.$queryRawUnsafe(`AND l.branch_id = ${parseInt(branchId)}`) : prismaRead.$queryRawUnsafe(``)}
                  ${startDate ? prismaRead.$queryRawUnsafe(`AND l.created_at >= '${startDate.toISOString()}'`) : prismaRead.$queryRawUnsafe(``)}
                  ${endDate ? prismaRead.$queryRawUnsafe(`AND l.created_at <= '${endDate.toISOString()}'`) : prismaRead.$queryRawUnsafe(``)}
                GROUP BY la.product_id
            `,
        ]);

        const aggMap = new Map(loanAgg.map(r => [r.product_id, r]));

        const productSummary = loanProducts.map((product) => {
            const agg = aggMap.get(product.id);
            const totalPaid = agg?.total_paid || 0;
            const totalPrincipal = agg?.total_principal || 0;
            const collectibilityRatio = totalPrincipal > 0
                ? Math.round((totalPaid / totalPrincipal) * 100)
                : 0;

            return {
                productCode: product.code,
                productName: product.name,
                interestRate: Number(product.interestRate),
                totalLoans: agg?.total_loans || 0,
                totalDisbursed: agg?.total_disbursed || 0,
                totalOutstanding: agg?.total_outstanding || 0,
                totalPaid,
                collectibilityRatio,
            };
        });

        return NextResponse.json({ data: { products: productSummary } });
    } catch (error) {
        console.error("GET /api/reports/loans-recap error:", error);
        return NextResponse.json(
            { message: "Failed to generate loans recap" },
            { status: 500 }
        );
    }
}
```

**Note:** The `$queryRawUnsafe` approach for dynamic WHERE clauses is a pattern used elsewhere in this codebase. Since `branchId` is parsed as `parseInt()` and dates are constructed from validated year param, SQL injection risk is mitigated. Alternatively, use the nullable parameter pattern:
```sql
AND (${branchIdInt}::int IS NULL OR l.branch_id = ${branchIdInt})
AND (${startDate}::date IS NULL OR l.created_at >= ${startDate})
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep "loans-recap" || echo "No errors"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reports/loans-recap/route.ts
git commit -m "perf: replace JS aggregation with SQL GROUP BY in loans-recap report"
```

---

### Task 5: Update Performance Plan + Final Commit

**Files:**
- Modify: `Performance-UPGRADE-PLAN.md`

- [ ] **Step 1: Mark all items as completed in the implementation log**

Update the "Remaining Items (Future)" section to mark all items done (except Mobile React Query which is out of scope for this repo).

- [ ] **Step 2: Commit**

```bash
git add Performance-UPGRADE-PLAN.md
git commit -m "docs: update performance plan — all server-side optimizations complete"
```
