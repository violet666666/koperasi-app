# Laba Kotor per Unit + Fix Tabel Per-Unit SHU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah card "Laba Kotor per Unit" (Toko/Resto & Cafe/Cafe LSP) di Laporan SHU yang dihitung dari `StoreSaleItem` (harga jual − HPP), dan perbaiki tabel "Pendapatan Per Unit" yang ada (filter void benar + dedup CB mirror).

**Architecture:** Pure helper `aggregateGrossProfit()` (array-in/array-out, teruji unit-test) + fetcher tipis `computeUnitGrossProfit()` baca Prisma (filter void di JS, hindari Prisma JSON NULL bug). Card baru via API passthrough. Fix kalkulator terkandung di section `unitBreakdown` saja — ganti 2 query `groupBy` (filter void buggy) → `findMany`+agregasi JS, dan hapus merge CB `pendapatan_toko`/`pendapatan_unit` yang dobel.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 6 / Vitest + happy-dom / Radix+shadcn UI.

## Global Constraints

- **Branch `railway-migration` AUTO-DEPLOY ke prod (primkoppol.site).** Task 5 (fix kalkulator) mengubah angka SHU produksi. Jalankan diagnostic before/after (Task 6) LOKAL vs prod Neon dulu untuk validasi sebelum commit. Jika ragu, buat feature branch (`git checkout -b feat/laba-kotor-per-unit`) untuk Task 1–4 (card, aman) lalu cherry-pick/PR untuk Task 5. Konfirmasi user sebelum push jika sempat.
- **TDD:** tulis test gagal dulu → implementasi → test lulus → commit. Pola repo (lihat `__tests__/billing-detection.test.ts`).
- **Vitest command:** `npx vitest run <path>` (single file) atau `npm run test` (semua).
- **Filter void StoreSale:** JANGAN pakai `NOT: { metadata: { path: ["isVoided"], equals: true } }` di Prisma (bug JSON NULL, lihat CLAUDE.md gotcha). Saring di JS: `!((metadata as any)?.isVoided)`.
- **Roll-up alias unit:** `resto_cafe` & `coffe_latar` → `resto` (via `STORE_SALE_ALIASES` di `src/lib/constants/units.ts`). Unit kanonik: `toko`, `resto` (label "Resto & Cafe"), `cafe_lsp`. Tidak ada unit "Coffe Latar".
- **Decimal → number:** konversi via `Number(d)` (Prisma Decimal punya `valueOf`). Helper `num()` di fetcher.
- **Pre-existing failing tests (BUKAN regresi):** `split-bill`, `batch-navigation`, `floor-plan`, `queue-system`. Jika gagal, buktikan bukan punya Anda via `git stash` + retest.
- **Spec:** `docs/superpowers/specs/2026-06-30-laba-kotor-per-unit-design.md`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `src/lib/constants/units.ts` (MODIFY) | Tambah `canonicalStoreUnitType(ut)` — pure helper alias→canonical. |
| `src/__tests__/units-canonical.test.ts` (NEW) | Unit-test `canonicalStoreUnitType`. |
| `src/lib/services/shu-gross-profit.ts` (NEW) | Types + `getPeriodRange` + `aggregateGrossProfit` (pure) + `computeUnitGrossProfit` (fetcher) + constants. |
| `src/__tests__/shu-gross-profit.test.ts` (NEW) | Unit-test pure helper. |
| `src/app/api/reports/shu/route.ts` (MODIFY) | Panggil `computeUnitGrossProfit`, passthrough `unitGrossProfit`. |
| `src/app/(protected)/laporan/shu/page.tsx` (MODIFY) | Tambah card "Laba Kotor per Unit" + type di interface. |
| `src/lib/services/shu-calculator.ts` (MODIFY) | Fix section `unitBreakdown`: findMany+JS (void benar) + hapus merge CB. |
| `scripts/diagnose-shu-hpp-per-unit.ts` (EXISTS) | Verifikasi before/after. |
| `scripts/diagnose-shu-unit-revenue-duplikasi.ts` (EXISTS) | Verifikasi dedup. |

---

## Task 1: Helper `canonicalStoreUnitType` di units.ts

**Files:**
- Modify: `src/lib/constants/units.ts` (tambah di akhir file)
- Test: `src/__tests__/units-canonical.test.ts`

**Interfaces:**
- Produces: `canonicalStoreUnitType(ut: string | null | undefined): string` — return unit kanonik (`"toko"`/`"resto"`/`"cafe_lsp"`/`"playstation"`/...). Alias `resto_cafe` & `coffe_latar` → `"resto"`. Null/undefined → `"toko"`. Unknown → dikembalikan apa adanya.

- [ ] **Step 1: Write the failing test**

Buat `src/__tests__/units-canonical.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canonicalStoreUnitType } from "@/lib/constants/units";

describe("canonicalStoreUnitType", () => {
  it("mengembalikan canonical untuk alias resto", () => {
    expect(canonicalStoreUnitType("resto_cafe")).toBe("resto");
    expect(canonicalStoreUnitType("coffe_latar")).toBe("resto");
    expect(canonicalStoreUnitType("resto")).toBe("resto");
  });
  it("mengembalikan canonical untuk unit tanpa alias", () => {
    expect(canonicalStoreUnitType("toko")).toBe("toko");
    expect(canonicalStoreUnitType("cafe_lsp")).toBe("cafe_lsp");
  });
  it("null/undefined/empty → toko (default store)", () => {
    expect(canonicalStoreUnitType(null)).toBe("toko");
    expect(canonicalStoreUnitType(undefined)).toBe("toko");
    expect(canonicalStoreUnitType("")).toBe("toko");
  });
  it("unknown unit → dikembalikan apa adanya", () => {
    expect(canonicalStoreUnitType("cuci_mobil")).toBe("cuci_mobil");
    expect(canonicalStoreUnitType("fitness")).toBe("fitness");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/units-canonical.test.ts`
Expected: FAIL — `canonicalStoreUnitType is not a function` (belum diekspor).

- [ ] **Step 3: Write minimal implementation**

Tambah di akhir `src/lib/constants/units.ts`:
```ts
/**
 * Map sebuah unitType StoreSale (mungkin alias) ke bentuk kanoniknya.
 * Alias (resto_cafe, coffe_latar → resto) di-roll-up. Null/undefined → "toko".
 * Unknown → dikembalikan apa adanya.
 * Dipakai untuk agregasi per-unit agar alias tidak terbelah menjadi row terpisah.
 */
export function canonicalStoreUnitType(ut: string | null | undefined): string {
  if (!ut) return "toko";
  for (const [canonical, aliases] of Object.entries(STORE_SALE_ALIASES)) {
    if ((aliases as string[]).includes(ut)) return canonical;
  }
  return ut;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/units-canonical.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/units.ts src/__tests__/units-canonical.test.ts
git commit -m "feat(units): add canonicalStoreUnitType helper for alias rollup"
```

---

## Task 2: Pure helper `aggregateGrossProfit` + fetcher `computeUnitGrossProfit`

**Files:**
- Create: `src/lib/services/shu-gross-profit.ts`
- Test: `src/__tests__/shu-gross-profit.test.ts`

**Interfaces:**
- Consumes: `prisma` dari `@/lib/prisma`; `UNIT_TYPES`, `STORE_SALE_ALIASES` dari `@/lib/constants/units`.
- Produces:
  - `getPeriodRange(year: number, month?: number | null): { start: Date; end: Date }`
  - `aggregateGrossProfit(items: GrossProfitItem[], unitGroups: UnitGroup[]): GrossProfitRow[]` (pure)
  - `computeUnitGrossProfit(year: number, month?: number | null): Promise<GrossProfitRow[]>` (fetcher)
  - `STORE_UNIT_GROUPS: UnitGroup[]`, `ALL_STORE_UNIT_TYPES: string[]`
  - Types: `GrossProfitItem`, `UnitGroup`, `GrossProfitRow`.

- [ ] **Step 1: Write the failing test**

Buat `src/__tests__/shu-gross-profit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { aggregateGrossProfit, getPeriodRange } from "@/lib/services/shu-gross-profit";
import type { GrossProfitItem, UnitGroup } from "@/lib/services/shu-gross-profit";

const GROUPS: UnitGroup[] = [
  { unitType: "toko", label: "Toko PRIMKOPPOL", aliases: ["toko"] },
  { unitType: "resto", label: "Resto & Cafe", aliases: ["resto", "resto_cafe", "coffe_latar"] },
  { unitType: "cafe_lsp", label: "Cafe LSP", aliases: ["cafe_lsp"] },
];

const item = (over: Partial<GrossProfitItem>): GrossProfitItem => ({
  subtotal: 10000, costPrice: 6000, quantity: 1, productCostPrice: 6000, unitType: "toko", ...over,
});

describe("getPeriodRange", () => {
  it("full year saat month kosong", () => {
    const { start, end } = getPeriodRange(2026);
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
  it("single month saat month diisi", () => {
    const { start, end } = getPeriodRange(2026, 2);
    expect(start.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("aggregateGrossProfit", () => {
  it("menghitung omzet/hpp/laba/margin dasar untuk 1 unit", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 10000, costPrice: 6000, quantity: 2, productCostPrice: 6000 }),
    ], GROUPS);
    const toko = rows.find(r => r.unitType === "toko")!;
    expect(toko.omzet).toBe(20000);
    expect(toko.hpp).toBe(12000);
    expect(toko.labaKotor).toBe(8000);
    expect(toko.margin).toBe(40);
    expect(toko.itemCount).toBe(1);
  });

  it("roll-up alias resto_cafe & coffe_latar ke resto", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "resto", subtotal: 50000, costPrice: 10000, quantity: 1 }),
      item({ unitType: "resto_cafe", subtotal: 30000, costPrice: 5000, quantity: 1 }),
      item({ unitType: "coffe_latar", subtotal: 20000, costPrice: 3000, quantity: 1 }),
    ], GROUPS);
    const resto = rows.find(r => r.unitType === "resto")!;
    expect(resto.omzet).toBe(100000);
    expect(resto.hpp).toBe(18000);
    expect(resto.itemCount).toBe(3);
  });

  it("fallback productCostPrice saat item costPrice 0/null", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 10000, costPrice: 0, productCostPrice: 4000, quantity: 2 }),
      item({ unitType: "toko", subtotal: 5000, costPrice: null as unknown as number, productCostPrice: 2500, quantity: 1 }),
    ], GROUPS);
    const toko = rows.find(r => r.unitType === "toko")!;
    // 4000*2 + 2500*1 = 10500
    expect(toko.hpp).toBe(10500);
  });

  it("margin 0 (bukan NaN) saat omzet 0", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "cafe_lsp", subtotal: 0, costPrice: 0, quantity: 0 }),
    ], GROUPS);
    const lsp = rows.find(r => r.unitType === "cafe_lsp")!;
    expect(lsp.omzet).toBe(0);
    expect(lsp.margin).toBe(0);
    expect(Number.isNaN(lsp.margin)).toBe(false);
  });

  it("urut omzet descending", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "cafe_lsp", subtotal: 5000, quantity: 1 }),
      item({ unitType: "toko", subtotal: 50000, quantity: 1 }),
      item({ unitType: "resto", subtotal: 20000, quantity: 1 }),
    ], GROUPS);
    expect(rows.map(r => r.unitType)).toEqual(["toko", "resto", "cafe_lsp"]);
  });

  it("skip item yg unitType-nya bukan store group (mis. cuci_mobil)", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 10000, quantity: 1 }),
      item({ unitType: "cuci_mobil", subtotal: 99999, quantity: 1 }),
    ], GROUPS);
    expect(rows.find(r => r.unitType === "cuci_mobil")).toBeUndefined();
    expect(rows.find(r => r.unitType === "toko")!.omzet).toBe(10000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/shu-gross-profit.test.ts`
Expected: FAIL — modul `@/lib/services/shu-gross-profit` tidak ditemukan.

- [ ] **Step 3: Write minimal implementation**

Buat `src/lib/services/shu-gross-profit.ts`:
```ts
import prisma from "@/lib/prisma";
import { UNIT_TYPES, STORE_SALE_ALIASES } from "@/lib/constants/units";

export interface GrossProfitItem {
  subtotal: number;
  costPrice: number;        // item-level (0 jika null)
  quantity: number;
  productCostPrice: number; // fallback dari product (0 jika null)
  unitType: string | null;
}

export interface UnitGroup {
  unitType: string;
  label: string;
  aliases: string[];
}

export interface GrossProfitRow {
  unitType: string;
  label: string;
  omzet: number;
  hpp: number;
  labaKotor: number;
  margin: number;
  itemCount: number;
}

/** 3 unit store yg ditampilkan di card Laba Kotor. */
export const STORE_UNIT_GROUPS: UnitGroup[] = (["toko", "resto", "cafe_lsp"] as const).map((k) => ({
  unitType: k,
  label: UNIT_TYPES[k].label,
  aliases: STORE_SALE_ALIASES[k] ?? [k],
}));

/** Semua unitType StoreSale (canonical + alias) untuk query Prisma. */
export const ALL_STORE_UNIT_TYPES: string[] = STORE_UNIT_GROUPS.flatMap((g) => g.aliases);

/** Rentang periode SHU (UTC), konsisten dgn calculateSystemSHU. */
export function getPeriodRange(year: number, month?: number | null): { start: Date; end: Date } {
  if (month && month > 0) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
    };
  }
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/**
 * Pure helper: agregasi list item → baris laba kotor per grup unit.
 * Voided item HARUS sudah disaring pemanggil (helper murni terima item aktif).
 */
export function aggregateGrossProfit(items: GrossProfitItem[], unitGroups: UnitGroup[]): GrossProfitRow[] {
  const aliasToCanonical = new Map<string, string>();
  for (const g of unitGroups) {
    aliasToCanonical.set(g.unitType, g.unitType);
    for (const a of g.aliases) aliasToCanonical.set(a, g.unitType);
  }
  const acc: Record<string, { omzet: number; hpp: number; itemCount: number; label: string }> = {};
  for (const g of unitGroups) acc[g.unitType] = { omzet: 0, hpp: 0, itemCount: 0, label: g.label };

  for (const it of items) {
    const canonical = aliasToCanonical.get(it.unitType ?? "");
    if (!canonical || !acc[canonical]) continue; // skip non-store item
    const cp = it.costPrice > 0 ? it.costPrice : (it.productCostPrice ?? 0);
    acc[canonical].omzet += it.subtotal;
    acc[canonical].hpp += cp * it.quantity;
    acc[canonical].itemCount += 1;
  }

  return Object.entries(acc)
    .map(([unitType, v]) => ({
      unitType,
      label: v.label,
      omzet: v.omzet,
      hpp: v.hpp,
      labaKotor: v.omzet - v.hpp,
      margin: v.omzet > 0 ? Number((((v.omzet - v.hpp) / v.omzet) * 100).toFixed(2)) : 0,
      itemCount: v.itemCount,
    }))
    .sort((a, b) => b.omzet - a.omzet);
}

function num(d: unknown): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d);
}

/**
 * Fetcher: query StoreSaleItem untuk 3 unit store, saring voided di JS
 * (HINDARI Prisma JSON NULL bug pada filter path isVoided), lalu agregasi.
 */
export async function computeUnitGrossProfit(year: number, month?: number | null): Promise<GrossProfitRow[]> {
  const { start, end } = getPeriodRange(year, month);
  const items = await prisma.storeSaleItem.findMany({
    where: {
      sale: {
        createdAt: { gte: start, lte: end },
        unitType: { in: ALL_STORE_UNIT_TYPES },
      },
    },
    select: {
      subtotal: true,
      costPrice: true,
      quantity: true,
      sale: { select: { unitType: true, metadata: true } },
      product: { select: { costPrice: true } },
    },
  });

  const normalized: GrossProfitItem[] = items
    .filter((it) => !((it.sale?.metadata as any)?.isVoided))
    .map((it) => ({
      subtotal: num(it.subtotal),
      costPrice: num(it.costPrice),
      quantity: Number(it.quantity) || 0,
      productCostPrice: num(it.product?.costPrice),
      unitType: it.sale?.unitType ?? null,
    }));

  return aggregateGrossProfit(normalized, STORE_UNIT_GROUPS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/shu-gross-profit.test.ts`
Expected: PASS (8 tests: 2 getPeriodRange + 6 aggregateGrossProfit).

- [ ] **Step 5: Verifikasi fetcher vs prod (opsional, sebelum commit)**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-hpp-per-unit.ts`
Expected: card numbers muncul (Toko ~Rp 6.051.564 / Resto & Cafe ~Rp 40.651.180 / Cafe LSP ~Rp 8.700.756 untuk 2026). Catatan: diagnostic ini menghitung dgn logika sama → harus cocok.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/shu-gross-profit.ts src/__tests__/shu-gross-profit.test.ts
git commit -m "feat(shu): add gross-profit-per-unit pure helper + fetcher"
```

---

## Task 3: API passthrough `unitGrossProfit`

**Files:**
- Modify: `src/app/api/reports/shu/route.ts`

**Interfaces:**
- Consumes: `computeUnitGrossProfit(year, month)` dari Task 2.
- Produces: field `unitGrossProfit: GrossProfitRow[]` di response `data`.

- [ ] **Step 1: Tambah import + panggil fetcher (non-fatal)**

Edit `src/app/api/reports/shu/route.ts`. Di atas `export async function GET`, ubah import:
```ts
import { calculateSystemSHU } from "@/lib/services/shu-calculator";
import { computeUnitGrossProfit } from "@/lib/services/shu-gross-profit";
```

Ganti baris `const data = await calculateSystemSHU(year, month);` (baris ~22) menjadi:
```ts
        // Fetch data dari SSOT + card Laba Kotor (non-fatal: jika gagal, card kosong)
        const [data, unitGrossProfit] = await Promise.all([
            calculateSystemSHU(year, month),
            computeUnitGrossProfit(year, month).catch((err) => {
                console.error("computeUnitGrossProfit failed:", err);
                return [];
            }),
        ]);
```

- [ ] **Step 2: Tambah field ke response**

Di objek `shuReport` (setelah `unitBreakdown: data.unitBreakdown,` baris ~50), tambahkan:
```ts
            unitBreakdown: data.unitBreakdown,
            unitGrossProfit,
```

- [ ] **Step 3: Verifikasi build & route**

Run: `npx tsc --noEmit`
Expected: no type errors. (Jika `tsc` lambat, lompati ke Step 4 — vitest/next build akan tangkap.)

Lalu jalankan dev server singkat atau andalkan Task 6. Cukup pastikan tidak ada error sintaks via:
Run: `npx vitest run src/__tests__/shu-gross-profit.test.ts src/__tests__/units-canonical.test.ts`
Expected: PASS (tidak ada regresi import).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/reports/shu/route.ts
git commit -m "feat(shu): expose unitGrossProfit in /api/reports/shu response"
```

---

## Task 4: UI card "Laba Kotor per Unit" di page.tsx

**Files:**
- Modify: `src/app/(protected)/laporan/shu/page.tsx`

**Interfaces:**
- Consumes: `data.unitGrossProfit` dari API (Task 3). Shape: `{ unitType, label, omzet, hpp, labaKotor, margin, itemCount }[]`.

- [ ] **Step 1: Tambah type di interface SHUData**

Di `src/app/(protected)/laporan/shu/page.tsx`, dalam interface `SHUData` (sekitar baris 96-116), tambahkan properti setelah `unitBreakdown?`:
```ts
    unitBreakdown?: UnitBreakdown[];
    unitGrossProfit?: UnitGrossProfit[];
}
```

Dan tambahkan interface baru di dekat interface `UnitBreakdown` (sekitar baris 118-126), setelahnya:
```ts
interface UnitGrossProfit {
    unitType: string;
    label: string;
    omzet: number;
    hpp: number;
    labaKotor: number;
    margin: number;
    itemCount: number;
}
```

- [ ] **Step 2: Tambah card sebelum tabel "Pendapatan Per Unit"**

Temukan komentar `{/* Per-Unit Revenue Breakdown */}` (sekitar baris 781). Sisipkan card baru **tepat di atasnya**:
```tsx
                    {/* Laba Kotor per Unit (Toko / Resto & Cafe / Cafe LSP) */}
                    {data.unitGrossProfit && data.unitGrossProfit.length > 0 && (
                        <Card className="print:border print:border-gray-300 print:shadow-none">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base print:text-black">
                                    Laba Kotor per Unit (Toko / Resto &amp; Cafe / Cafe LSP) — {periodDisplay}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border print:border-gray-300">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Unit Usaha</TableHead>
                                                <TableHead className="text-right">Omzet (Harga Jual)</TableHead>
                                                <TableHead className="text-right">HPP</TableHead>
                                                <TableHead className="text-right">Laba Kotor</TableHead>
                                                <TableHead className="text-right">Margin</TableHead>
                                                <TableHead className="text-right w-20">Item</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.unitGrossProfit.map((u) => (
                                                <TableRow key={u.unitType}>
                                                    <TableCell className="font-medium">{u.label}</TableCell>
                                                    <TableCell className="text-right tabular-nums text-emerald-600">{formatCurrency(u.omzet)}</TableCell>
                                                    <TableCell className="text-right tabular-nums text-red-600">{formatCurrency(u.hpp)}</TableCell>
                                                    <TableCell className={`text-right tabular-nums font-bold ${u.labaKotor >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                                        {formatCurrency(u.labaKotor)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums">{u.margin}%</TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">{u.itemCount}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Laba Kotor = Omzet (subtotal item) − HPP (cost price × qty). Pretax barang; tidak termasuk biaya operasional umum.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Per-Unit Revenue Breakdown */}
```

- [ ] **Step 3: Verifikasi tidak ada error compile**

Run: `npx tsc --noEmit`
Expected: no errors. (Komponen `Card`, `Table`, `formatCurrency` sudah di-import di file ini — lihat baris 6-27.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/laporan/shu/page.tsx"
git commit -m "feat(shu): add Laba Kotor per Unit card to Laporan SHU"
```

---

## Task 5: Fix `unitBreakdown` di shu-calculator.ts (void filter benar + dedup CB)

**Files:**
- Modify: `src/lib/services/shu-calculator.ts:428-562` (section unitBreakdown)
- Verify: `scripts/diagnose-shu-unit-revenue-duplikasi.ts`

**Interfaces:**
- Consumes: `canonicalStoreUnitType` dari Task 1; `STORE_SALE_ALIASES` dari units.ts.
- Produces: `unitBreakdown` dgn revenue benar (no double-count, void filter benar).

**CATATAN:** Task ini mengubah angka SHU produksi (cuci_mobil turun ~50%, toko naik). Jalankan diagnostic (Step 4) vs prod LOKAL sebelum commit untuk validasi.

- [ ] **Step 1: Update import units.ts**

Di `src/lib/services/shu-calculator.ts` baris 4, ubah:
```ts
import { UNIT_TYPES } from "@/lib/constants/units";
```
menjadi:
```ts
import { UNIT_TYPES, STORE_SALE_ALIASES } from "@/lib/constants/units";
import { canonicalStoreUnitType } from "@/lib/constants/units";
```

- [ ] **Step 2: Ganti Promise.all 6-query → 4-query (void filter benar via findMany)**

Temukan blok `const [storeSalesByUnit, unitTxByUnit, expenseByUnit, incomeByUnit, storeSalesByMethod, unitTxByMethod] = await Promise.all([ ... ]);` (baris ~430-497). Ganti **seluruh blok** dengan:
```ts
    const [storeSalesRaw, unitTxByUnit, expenseByUnit, unitTxByMethod] = await Promise.all([
        // StoreSale via findMany — HINDARI groupBy + filter void Prisma JSON NULL bug.
        // Satu findMany melayani aggregasi by-unit DAN by-method.
        prisma.storeSale.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: { unitType: true, totalAmount: true, paymentMethod: true, metadata: true },
        }),
        prisma.unitTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
        // Pengeluaran per unit dari Kas & Bank — blacklist approach (termasuk NULL unitType)
        prisma.cashBankTransaction.groupBy({
            by: ['unitType'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                type: "out",
                category: { notIn: NON_EXPENSE_CATEGORIES },
            },
            _sum: { amount: true },
            _count: true,
        }),
        prisma.unitTransaction.groupBy({
            by: ['unitType', 'paymentMethod'],
            where: {
                transactionDate: { gte: startDate, lte: endDate },
                isPaid: true,
                status: "completed",
            },
            _sum: { amount: true },
            _count: true,
        }),
    ]);

    // Agregasi StoreSale di JS: saring voided (filter benar), roll-up alias, by-unit + by-method
    const activeStoreSales = storeSalesRaw.filter(s => !((s.metadata as any)?.isVoided));
    const storeUnitAgg: Record<string, { revenue: number; count: number }> = {};
    const storeMethodAgg: Record<string, Record<string, { amount: number; count: number }>> = {};
    for (const s of activeStoreSales) {
        const ut = canonicalStoreUnitType(s.unitType);
        const amt = toNum(s.totalAmount);
        if (!storeUnitAgg[ut]) storeUnitAgg[ut] = { revenue: 0, count: 0 };
        storeUnitAgg[ut].revenue += amt;
        storeUnitAgg[ut].count += 1;
        const m = s.paymentMethod || "cash";
        if (!storeMethodAgg[ut]) storeMethodAgg[ut] = {};
        if (!storeMethodAgg[ut][m]) storeMethodAgg[ut][m] = { amount: 0, count: 0 };
        storeMethodAgg[ut][m].amount += amt;
        storeMethodAgg[ut][m].count += 1;
    }
```
(Dihapus: `storeSalesByUnit` groupBy, `incomeByUnit` query, `storeSalesByMethod` groupBy — semuanya diganti.)

- [ ] **Step 3: Update konsumen — method breakdown loop**

Temukan blok (baris ~521-526):
```ts
    for (const s of storeSalesByMethod) {
        addMethodEntry(s.unitType || "toko", s.paymentMethod, toNum(s._sum.totalAmount), s._count);
    }
    for (const u of unitTxByMethod) {
        addMethodEntry(u.unitType, u.paymentMethod, toNum(u._sum.amount), u._count);
    }
```
Ganti dengan:
```ts
    for (const [ut, methods] of Object.entries(storeMethodAgg)) {
        for (const [m, v] of Object.entries(methods)) {
            addMethodEntry(ut, m, v.amount, v.count);
        }
    }
    for (const u of unitTxByMethod) {
        addMethodEntry(u.unitType, u.paymentMethod, toNum(u._sum.amount), u._count);
    }
```

- [ ] **Step 4: Update konsumen — revenue merge (DEDUP: hapus incomeByUnit)**

Temukan blok (baris ~542-562):
```ts
    // Merge revenue dari StoreSale, UnitTransaction, dan CB income ke satu map
    const unitRevenueMap: Record<string, { revenue: number; txCount: number }> = {};
    for (const s of storeSalesByUnit) {
        const ut = s.unitType || "toko";
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(s._sum.totalAmount);
        unitRevenueMap[ut].txCount += s._count;
    }
    for (const u of unitTxByUnit) {
        const ut = u.unitType;
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(u._sum.amount);
        unitRevenueMap[ut].txCount += u._count;
    }
    // Merge CB income per unitType (pendapatan_toko, pendapatan_unit, dll.)
    for (const i of incomeByUnit) {
        const ut = i.unitType || "simpan_pinjam";
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(i._sum.amount);
        unitRevenueMap[ut].txCount += i._count;
    }
```
Ganti dengan:
```ts
    // Revenue per unit: StoreSale (source of truth utk store) + UnitTransaction (service).
    // CB pendapatan_toko/pendapatan_unit DIHAPUS — itu mirror dari StoreSale/UnitTransaction
    // (dobel-hitung, lihat docs/superpowers/specs/2026-06-30-laba-kotor-per-unit-design.md Bug A).
    const unitRevenueMap: Record<string, { revenue: number; txCount: number }> = {};
    for (const [ut, v] of Object.entries(storeUnitAgg)) {
        unitRevenueMap[ut] = { revenue: v.revenue, txCount: v.count };
    }
    for (const u of unitTxByUnit) {
        const ut = u.unitType;
        if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
        unitRevenueMap[ut].revenue += toNum(u._sum.amount);
        unitRevenueMap[ut].txCount += u._count;
    }
```

- [ ] **Step 5: Cek tidak ada referensi sisa ke variabel yg dihapus**

Run: `npx tsc --noEmit`
Expected: no errors. Jika ada error `storeSalesByUnit`/`storeSalesByMethod`/`incomeByUnit` not defined → cari & hapus referensi sisa (seharusnya hanya di blok yg sudah diganti).

- [ ] **Step 6: Jalankan full unit test suite (no regressions)**

Run: `npm run test`
Expected: PASS semua kecuali pre-existing failures (`split-bill`, `batch-navigation`, `floor-plan`, `queue-system`). Jika failure baru, `git stash` + retest untuk buktikan.

- [ ] **Step 7: Verifikasi before/after via diagnostic prod (LOKAL, sebelum commit)**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-unit-revenue-duplikasi.ts`
Expected:
- Section [A] — cuci_mobil: `UnitTx` ≈ `CB-income` (tetap, ini sifat data), TAPI setelah fix kalkulator, `unitBreakdown` revenue cuci_mobil = UnitTx saja (~Rp 87jt, bukan 174jt). Diagnostic ini mengukur sumber data mentah; konfirmasi langsung via API page (Task 6).
- Section [B] — bukti tumpang-tindih tetap ada (3851+2539 baris match) → membuktikan dedup diperlukan.

Verifikasi angka `unitBreakdown` baru via script tambahan singkat (opsional) atau andalkan Task 6.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/shu-calculator.ts
git commit -m "fix(shu): dedup CB mirror + correct void filter in unitBreakdown revenue"
```

---

## Task 6: Final verification & diagnostics

**Files:** — (verification only)

- [ ] **Step 1: Full test suite + lint**

Run: `npm run test && npm run lint`
Expected: tests pass (kecuali pre-existing); lint no new errors.

- [ ] **Step 2: Diagnostic Laba Kotor (card) vs prod**

Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-hpp-per-unit.ts`
Expected: 3 baris unit dgn angka (Toko ~Rp 6jt laba / Resto ~Rp 40jt / Cafe LSP ~Rp 8,7jt untuk 2026). Card UI harus menampilkan angka yg sama.

- [ ] **Step 3: Build production**

Run: `npm run build`
Expected: build sukses (prisma generate + next build). Tangani error type jika ada.

- [ ] **Step 4: Verifikasi manual di staging/prod (opsional, post-deploy)**

Buka `/laporan/shu` di primkoppol.site (setelah deploy). Konfirmasi:
- Card "Laba Kotor per Unit" muncul dgn 3 baris (Toko/Resto & Cafe/Cafe LSP).
- Tabel "Pendapatan Per Unit": cuci_mobil ~Rp 87jt (bukan 174jt); toko/resto/cafe_lsp revenue muncul (bukan 0).
- Tidak ada console error.

- [ ] **Step 5: Update memory & changelog**

Update memori `shu-pendapatan-dobel-hitung-2026.md` (status: FIXED untuk tabel per-unit; summary card Total Pendapatan masih open). Tambah changelog di `SHU-BUG-AND-UPDATE.md` Section baru (format: tanggal, fix, bukti).

- [ ] **Step 6: Final commit (docs)**

```bash
git add SHU-BUG-AND-UPDATE.md
git commit -m "docs(shu): document laba-kotor card + per-unit dedup fix"
```

---

## Self-Review (post-write)

**Spec coverage:**
- Spec §5.1 pure helper `aggregateGrossProfit` → Task 2 ✓
- Spec §5.2 fetcher `computeUnitGrossProfit` → Task 2 ✓
- Spec §5.3 (a) void filter fix → Task 5 Step 2 ✓
- Spec §5.3 (b) dedup → Task 5 Step 4 ✓
- Spec §5.4 UI card → Task 4 ✓
- Spec §6 API passthrough → Task 3 ✓
- Spec §7 testing → Task 1, 2 (unit) + Task 5 Step 6-7, Task 6 (diagnostic) ✓
- Spec §12 open questions: export Excel/PDF = tidak dulu (card tidak ditambah ke `shuExportColumns`, benar); penempatan di atas tabel → Task 4 menempatkan di atas ✓

**Placeholder scan:** tidak ada TBD/TODO. Semua step punya code/commands lengkap.

**Type consistency:**
- `GrossProfitRow` (Task 2) = `{ unitType, label, omzet, hpp, labaKotor, margin, itemCount }` → konsisten dgn API (Task 3) & UI `UnitGrossProfit` (Task 4). ✓
- `canonicalStoreUnitType` (Task 1) dipakai di Task 5 Step 2. ✓
- `computeUnitGrossProfit(year, month)` signature konsisten Task 2 ↔ Task 3. ✓

**Catatan risiko:** Task 5 mengubah angka prod. Global Constraint (branch auto-deploy) sudah memandu verifikasi lokal dulu.
