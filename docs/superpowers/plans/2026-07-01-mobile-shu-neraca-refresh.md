# Mobile SHU Laba Kotor + Neraca Ledger Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the 2 stale mobile report screens to parity with web calculations — add a Laba Kotor per Unit card to mobile SHU, and switch mobile Neraca from broken journal-only SQL to the ledger-based `buildBalanceSheet()`.

**Architecture:** Endpoint-level fixes + 1 pure reshape helper. SHU endpoint gains a `computeUnitGrossProfit` passthrough (mirrors web `/api/reports/shu`). Neraca half of `/api/mobile/reports/financial` is replaced by `buildBalanceSheet()` reshaped via a pure `toMobileNeracaShape()` helper (laba-rugi half untouched). The mobile screens barely change — they already render the target shapes.

**Tech Stack:** Next.js 16 route handlers, Prisma 6, TypeScript, Vitest + happy-dom (pure helper), Expo 55 / React Native 0.83 (screens, manual verify only).

## Global Constraints

- **Branch:** `railway-migration` — **auto-deploys to prod (primkoppol.site) on push.** Commit freely; only push when ready.
- **Do NOT stage non-mine working-tree files:** `.claude/settings.local.json`, `mobile/app.json` are modified but NOT ours — stage only the files this plan touches.
- **Pure helper = TDD; UI = manual/expo verify** (repo has no React Native component-test harness — per CLAUDE.md "testable-UI pattern", extract logic to `src/lib/*` and unit-test there).
- **Pre-existing failing tests are NOT regressions:** `split-bill`, `batch-navigation`, `floor-plan`/`queue-system`. Prove a failure isn't yours with `git stash push <files>` + retest.
- **Pre-existing tsc errors are NOT regressions:** `api/mobile/toko/shifts/[id]` (async-params validator) + `prisma/seed-kas-bank-jatim.ts` + `prisma/seed-uat.ts`. `npm run build` still succeeds.
- **No transaction-number generation in this plan** (crypto.randomBytes rule N/A).
- **`StoreSaleItem.subtotal` is the line total** — but we do NOT re-aggregate; `computeUnitGrossProfit` already handles it correctly (`omzet += subtotal`, no `× qty`).
- **Run tests:** `npm run test` (or `npx vitest run <file>`). **Typecheck:** `npx tsc --noEmit`.

---

### Task 1: Pure helper `toMobileNeracaShape` (TDD)

**Files:**
- Create: `src/lib/services/mobile-neraca-shape.ts`
- Test: `src/__tests__/mobile-neraca-shape.test.ts`

**Interfaces:**
- Consumes: `BalanceSheetResult` + `BalanceSheetItem` from `@/lib/services/neraca` (already exported).
- Produces: `toMobileNeracaShape(bs)` + types `MobileNeracaItem`, `MobileNeracaShape` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

`src/__tests__/mobile-neraca-shape.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toMobileNeracaShape } from "@/lib/services/mobile-neraca-shape";
import type { BalanceSheetResult } from "@/lib/services/neraca";

function fixture(over: Partial<BalanceSheetResult> = {}): BalanceSheetResult {
  return {
    asOf: "2026-07-01",
    assets: {
      current: [
        { code: "1101", name: "Kas", amount: 50_000_000, source: "ledger" },
        { code: "1201", name: "Piutang Pinjaman", amount: 80_000_000, source: "ledger" },
        { code: "1301", name: "Persediaan", amount: 20_000_000, source: "ledger" },
      ],
      fixedGross: [{ code: "1400", name: "Aset Tetap", amount: 30_000_000, source: "ledger" }],
      accumulatedDepreciation: 5_000_000,
      totalAssets: 175_000_000, // 150 current+fixed.net(25) → 175
    },
    liabilities: {
      savings: [
        { code: "2101", name: "Simpanan Pokok", amount: 60_000_000, source: "ledger" },
        { code: "2102", name: "Simpanan Wajib", amount: 40_000_000, source: "ledger" },
      ],
      other: [{ code: "2201", name: "Hutang Usaha", amount: 10_000_000, source: "journal" }],
      totalLiabilities: 110_000_000,
    },
    equity: {
      items: [
        { code: "3101", name: "Modal Disetor", amount: 50_000_000, source: "journal" },
        { code: "3103", name: "SHU Tahun Berjalan", amount: 15_000_000, source: "computed" },
      ],
      shuBerjalan: 15_000_000,
      selisih: 0,
      totalEquity: 65_000_000,
    },
    isBalanced: true,
    meta: { generatedAt: "2026-07-01", note: "x" },
    ...over,
  } as BalanceSheetResult;
}

describe("toMobileNeracaShape", () => {
  it("maps current assets and totals consistently", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.assets.current).toHaveLength(3);
    expect(m.assets.totalCurrentAssets).toBe(150_000_000);
    expect(m.assets.totalAssets).toBe(175_000_000);
    // totalCurrent + totalFixed(net) === totalAssets
    expect(Math.abs(m.assets.totalAssets - (m.assets.totalCurrentAssets + m.assets.totalFixedAssets))).toBeLessThan(1);
  });

  it("adds accumulated depreciation row (negative) when non-zero", () => {
    const m = toMobileNeracaShape(fixture());
    const dep = m.assets.fixed.find((i) => i.code === "1499");
    expect(dep).toBeDefined();
    expect(dep!.amount).toBe(-5_000_000);
    // fixed total = gross 30jt + (-5jt) = 25jt
    expect(m.assets.totalFixedAssets).toBe(25_000_000);
  });

  it("does NOT add depreciation row when accumulation is zero", () => {
    const m = toMobileNeracaShape(fixture({
      assets: { current: [], fixedGross: [], accumulatedDepreciation: 0, totalAssets: 0 },
    }));
    expect(m.assets.fixed.find((i) => i.code === "1499")).toBeUndefined();
  });

  it("concats savings + other into shortTerm", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.liabilities.shortTerm).toHaveLength(3);
    expect(m.liabilities.shortTerm.map((i) => i.code)).toEqual(["2101", "2102", "2201"]);
    expect(m.liabilities.totalLiabilities).toBe(110_000_000);
    expect(m.liabilities.longTerm).toEqual([]);
  });

  it("passes equity items + computes totalLiabilitiesAndEquity", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.equity.items.map((i) => i.code)).toEqual(["3101", "3103"]);
    expect(m.equity.totalEquity).toBe(65_000_000);
    expect(m.totalLiabilitiesAndEquity).toBe(175_000_000); // 110 + 65
    // balanced fixture → totals match
    expect(Math.abs(m.assets.totalAssets - m.totalLiabilitiesAndEquity)).toBeLessThan(1);
  });

  it("drops the `source` field from items", () => {
    const m = toMobileNeracaShape(fixture());
    expect((m.assets.current[0] as any).source).toBeUndefined();
    expect((m.equity.items[0] as any).source).toBeUndefined();
  });

  it("handles empty balance sheet without crashing", () => {
    const m = toMobileNeracaShape(fixture({
      assets: { current: [], fixedGross: [], accumulatedDepreciation: 0, totalAssets: 0 },
      liabilities: { savings: [], other: [], totalLiabilities: 0 },
      equity: { items: [], shuBerjalan: 0, selisih: 0, totalEquity: 0 },
    }));
    expect(m.assets.totalAssets).toBe(0);
    expect(m.totalLiabilitiesAndEquity).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/mobile-neraca-shape.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/services/mobile-neraca-shape"` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

`src/lib/services/mobile-neraca-shape.ts`:
```ts
import type { BalanceSheetResult, BalanceSheetItem } from "./neraca";

export interface MobileNeracaItem {
  code: string;
  name: string;
  amount: number;
}

export interface MobileNeracaShape {
  assets: {
    current: MobileNeracaItem[];
    fixed: MobileNeracaItem[];
    totalCurrentAssets: number;
    totalFixedAssets: number;
    totalAssets: number;
  };
  liabilities: {
    shortTerm: MobileNeracaItem[];
    longTerm: MobileNeracaItem[];
    totalLiabilities: number;
  };
  equity: {
    items: MobileNeracaItem[];
    totalEquity: number;
  };
  totalLiabilitiesAndEquity: number;
}

const sum = (items: { amount: number }[]) => items.reduce((s, i) => s + i.amount, 0);

const strip = (items: BalanceSheetItem[]): MobileNeracaItem[] =>
  items.map((i) => ({ code: i.code, name: i.name, amount: i.amount }));

/**
 * Reshape canonical ledger BalanceSheetResult → mobile NeracaScreen shape.
 * Pure; unit-tested. `source` field dropped (screen only reads code/name/amount).
 */
export function toMobileNeracaShape(bs: BalanceSheetResult): MobileNeracaShape {
  const fixed: MobileNeracaItem[] = strip(bs.assets.fixedGross);
  if (bs.assets.accumulatedDepreciation !== 0) {
    fixed.push({ code: "1499", name: "Akumulasi Penyusutan", amount: -bs.assets.accumulatedDepreciation });
  }

  const current = strip(bs.assets.current);
  const totalCurrentAssets = sum(current);
  const totalFixedAssets = sum(fixed); // gross + (-accum) = net

  const shortTerm = strip([...bs.liabilities.savings, ...bs.liabilities.other]);

  return {
    assets: {
      current,
      fixed,
      totalCurrentAssets,
      totalFixedAssets,
      totalAssets: bs.assets.totalAssets,
    },
    liabilities: {
      shortTerm,
      longTerm: [],
      totalLiabilities: bs.liabilities.totalLiabilities,
    },
    equity: {
      items: strip(bs.equity.items),
      totalEquity: bs.equity.totalEquity,
    },
    totalLiabilitiesAndEquity: bs.liabilities.totalLiabilities + bs.equity.totalEquity,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/mobile-neraca-shape.test.ts`
Expected: PASS — 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/mobile-neraca-shape.ts src/__tests__/mobile-neraca-shape.test.ts
git commit -m "feat(neraca): add toMobileNeracaShape pure helper + tests"
```

---

### Task 2: SHU endpoint — add `unitGrossProfit`

**Files:**
- Modify: `src/app/api/mobile/reports/shu-calculator/route.ts`

**Interfaces:**
- Consumes: `computeUnitGrossProfit(year, month)` from `@/lib/services/shu-gross-profit` (returns `GrossProfitRow[]`).
- Produces: new `unitGrossProfit` field on the response `data` object (consumed by Task 4).

- [ ] **Step 1: Add import**

At the top of `src/app/api/mobile/reports/shu-calculator/route.ts`, after the existing `calculateSystemSHU` import (line 3), add:
```ts
import { computeUnitGrossProfit } from "@/lib/services/shu-gross-profit";
```

- [ ] **Step 2: Replace the single calculateSystemSHU call with parallel Promise.all**

Replace line 22 (`const result = await calculateSystemSHU(year, month);`) with:
```ts
// Hitung SHU kanonik + card Laba Kotor (non-fatal: jika gagal, card kosong).
// Mirror pola /api/reports/shu/route.ts.
const [result, unitGrossProfit] = await Promise.all([
  calculateSystemSHU(year, month),
  computeUnitGrossProfit(year, month).catch((err) => {
    console.error("computeUnitGrossProfit failed:", err);
    return [];
  }),
]);
```

- [ ] **Step 3: Add `unitGrossProfit` to the response data**

In the `NextResponse.json({ data: { ... } })` block, add `unitGrossProfit,` next to the existing `unitBreakdown: result.unitBreakdown,` line (around line 57):
```ts
unitBreakdown: result.unitBreakdown,
unitGrossProfit, // GrossProfitRow[] (toko/resto/cafe_lsp) atau [] jika gagal
```

- [ ] **Step 4: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors (pre-existing errors in `api/mobile/toko/shifts/[id]` + `prisma/seed-*.ts` are fine).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/reports/shu-calculator/route.ts
git commit -m "feat(mobile-shu): forward unitGrossProfit (Laba Kotor) to mobile"
```

---

### Task 3: Neraca endpoint — swap to ledger via `toMobileNeracaShape`

**Files:**
- Modify: `src/app/api/mobile/reports/financial/route.ts`

**Interfaces:**
- Consumes: `buildBalanceSheet` from `@/lib/services/neraca`; `toMobileNeracaShape` from Task 1.
- Produces: the `neraca` field of the response now reflects ledger balances (simpanan ≠ 0). Laba-rugi half unchanged.

- [ ] **Step 1: Add imports**

At the top of `src/app/api/mobile/reports/financial/route.ts`, after the existing imports (line 3), add:
```ts
import { buildBalanceSheet } from "@/lib/services/neraca";
import { toMobileNeracaShape } from "@/lib/services/mobile-neraca-shape";
```

- [ ] **Step 2: Replace the neraca assembly block with buildBalanceSheet + reshape**

Delete the entire neraca-assembly block — currently lines 72-98, from the comment `// --- Susun Neraca ---` through the line `const totalEquity = equityItems.reduce((sum, a) => sum + a.amount, 0);` — and replace with:
```ts
// --- Neraca (ledger-based, via buildBalanceSheet) ---
// Mengganti perhitungan journal-only lama (bug: simpanan = 0).
// Laba-rugi (di atas) tetap memakai journal YTD.
const balanceSheet = await buildBalanceSheet();
const neraca = toMobileNeracaShape(balanceSheet);
```

> The `labaRugi` block above (lines 59-70: `revenueItems`, `expenseItems`, `totalRevenue`, `totalExpense`, `netIncome`) MUST stay untouched.

- [ ] **Step 3: Confirm the response object still compiles**

The response `neraca` field (around line 108) already reads from variables `currentAssets`, `fixedAssets`, etc. — those no longer exist. Replace the entire `neraca: { assets: {...}, liabilities: {...}, equity: {...}, totalLiabilitiesAndEquity: ... }` literal in the response with:
```ts
neraca,
```
(the local const from Step 2). Leave `labaRugi: { ... }` and `period: asOfDate` untouched.

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit`
Expected: no new errors (the `AccountRow` interface at top of file is still used by the laba-rugi `$queryRaw` — leave it).
Run: `npx vitest run src/__tests__/mobile-neraca-shape.test.ts`
Expected: PASS 7/7 (unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/reports/financial/route.ts
git commit -m "fix(mobile-neraca): switch /financial neraca half to ledger buildBalanceSheet"
```

---

### Task 4: LaporanSHUScreen — Laba Kotor per Unit card

**Files:**
- Modify: `mobile/src/screens/operator/LaporanSHUScreen.tsx`

**Interfaces:**
- Consumes: `data.unitGrossProfit` (added in Task 2) — array of `{ unitType, label, omzet, hpp, labaKotor, margin, itemCount }`.

- [ ] **Step 1: Add the Laba Kotor card after the income/expense row**

In `mobile/src/screens/operator/LaporanSHUScreen.tsx`, find the closing of the income/expense row block — the `</View>` that ends `<View style={styles.inExRow}>...</View>` (around line 185), immediately before the `{/* Income Details */}` comment. Insert this block between them:
```tsx
{/* Laba Kotor per Unit */}
{Array.isArray(data.unitGrossProfit) && data.unitGrossProfit.length > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>🏷️ Laba Kotor per Unit</Text>
    <Text style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
      Pendapatan bersih item terjual = Omzet − HPP
    </Text>
    {data.unitGrossProfit.map((u: any) => (
      <View key={u.unitType} style={styles.detailRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.detailLabel}>{u.label}</Text>
          <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            Omzet {formatRupiah(u.omzet)} · HPP {formatRupiah(u.hpp)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#10B981" }}>
            {formatRupiah(u.labaKotor)}
          </Text>
          <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {u.margin}% margin
          </Text>
        </View>
      </View>
    ))}
  </View>
)}
```

This reuses existing styles (`section`, `sectionTitle`, `detailRow`, `detailLabel`) and the existing `formatRupiah` — no new imports or styles required.

- [ ] **Step 2: Typecheck the mobile project**

Run: `cd mobile && npx tsc --noEmit` (or `npx tsc -p mobile/tsconfig.json --noEmit` from repo root)
Expected: no new errors in `LaporanSHUScreen.tsx`. (`data` is typed `any`, so `data.unitGrossProfit` is fine.)

- [ ] **Step 3: Manual verify (Expo)**

Run: `cd mobile && npx expo start`
On device/emulator, login as operator → Dashboard → Laporan SHU. Confirm:
- Card "🏷️ Laba Kotor per Unit" appears below the Pendapatan/Beban row.
- 3 rows (Toko / Resto & Cafe / Cafe Lsp) each show Omzet, HPP, Laba Kotor, margin%.
- Switching month/year pills updates the card.
- If the card data is empty for a period, the card is hidden (no crash).

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/operator/LaporanSHUScreen.tsx
git commit -m "feat(mobile-shu): add Laba Kotor per Unit card to LaporanSHU screen"
```

---

### Task 5 (optional): Diagnostic — parity vs prod Neon

**Files:**
- Create: `scripts/diagnose-mobile-neraca-shu-parity.ts`

- [ ] **Step 1: Write the diagnostic**

```ts
// scripts/diagnose-mobile-neraca-shu-parity.ts
// Jalankan: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-neraca-shu-parity.ts
import prisma from "../src/lib/prisma";
import { buildBalanceSheet } from "../src/lib/services/neraca";
import { toMobileNeracaShape } from "../src/lib/services/mobile-neraca-shape";
import { computeUnitGrossProfit } from "../src/lib/services/shu-gross-profit";

async function main() {
  const bs = await buildBalanceSheet();
  const m = toMobileNeracaShape(bs);
  console.log("=== NERACA (ledger → mobile shape) ===");
  console.log("totalAssets           :", m.assets.totalAssets);
  console.log("totalCurrentAssets    :", m.assets.totalCurrentAssets);
  console.log("totalFixedAssets (net):", m.assets.totalFixedAssets);
  console.log("totalLiabilities      :", m.liabilities.totalLiabilities);
  console.log("  savings rows        :", m.liabilities.shortTerm.filter((i) => ["2101","2102","2103","21XX"].includes(i.code)).map((i) => `${i.name}=${i.amount}`));
  console.log("totalEquity           :", m.equity.totalEquity);
  console.log("totalLiab+Equity      :", m.totalLiabilitiesAndEquity);
  console.log("isBalanced (bs)       :", bs.isBalanced, "| selisih:", bs.equity.selisih);
  console.log("consistency (assets = curr+fixed):", Math.abs(m.assets.totalAssets - (m.assets.totalCurrentAssets + m.assets.totalFixedAssets)) < 1);

  const gp = await computeUnitGrossProfit(new Date().getFullYear());
  console.log("\n=== LABA KOTOR per UNIT (year) ===");
  for (const r of gp) {
    console.log(`${r.label.padEnd(20)} omzet=${r.omzet} hpp=${r.hpp} laba=${r.labaKotor} margin=${r.margin}% items=${r.itemCount}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it (read-only vs prod)**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-neraca-shu-parity.ts`
Expected: `totalAssets` is a large realistic number (not 0); savings rows (Simpanan Pokok/Wajib/Sukarela) are non-zero; 3 Laba Kotor rows present. Capture output for the changelog.

- [ ] **Step 3: Commit**

```bash
git add scripts/diagnose-mobile-neraca-shu-parity.ts
git commit -m "docs(diag): add mobile neraca/shu parity diagnostic vs prod"
```

---

## Self-Review (controller notes)

- **Spec coverage:** SHU Laba Kotor → Tasks 2+4. Neraca ledger → Tasks 1+3. Diagnostic → Task 5. All spec sections mapped.
- **Type consistency:** `MobileNeracaShape` (Task 1) ↔ consumed in Task 3. `unitGrossProfit: GrossProfitRow[]` (Task 2) ↔ rendered fields in Task 4 (`label`, `omzet`, `hpp`, `labaKotor`, `margin`).
- **Placeholder scan:** none — all code blocks complete, exact paths, exact commands.
- **Risk:** Task 3 deletes a block and must preserve the laba-rugi half + the `AccountRow` interface (still used). Reviewer should confirm `labaRugi` JSON literal is intact post-edit.
