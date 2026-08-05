# Neraca Berbasis Ledger — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bangun ulang Neraca (`/laporan/neraca`) supaya menampilkan posisi keuangan per hari ini dari sumber ledger paling andal (simpanan/kas/pinjaman/aset + jurnal untuk hutang/modal), bukan murni dari `journal_lines` yang tidak lengkap.

**Architecture:** Service pure-function `buildBalanceSheet()` di `src/lib/services/neraca.ts` (mirror pola `shu-calculator.ts`). Pure helper array-in/array-out (teruji unit-test) + orchestrator tipis baca prisma. Route API panggil service; page konsumsi shape baru.

**Tech Stack:** Next.js 16 / TypeScript / Prisma 6 / Vitest. Reuse `calculateSystemSHU(year)` dari `src/lib/services/shu-calculator.ts` untuk SHU Tahun Berjalan.

## Global Constraints

- Saldo bersifat **snapshot "per hari ini"** (bukan historis). Hapus selector bulan/tahun.
- `Loan.principalOutstanding`/`interestOutstanding` adalah `Decimal` → konversi pakai `Number()`.
- Hindari bug `groupBy`+relation (CLAUDE.md): simpanan pakai 2-step findMany product → aggregate by `productId: { in: [...] }` (di orchestrator).
- Akun dikecualikan dari sumber jurnal untuk anti-dobel: liability **2101-2103** (sumber: SavingsAccount), equity **3103** (sumber: computed SHU).
- SHU Tahun Berjalan = **`calculateSystemSHU(currentYear).totalIncome − totalExpense`** (BUKAN `.netSurplus` karena di-`Math.max(0,…)`; kita butuh nilai negatif jika rugi).
- `formatCurrency` & format negatif `(…)` merah dipakai konsisten di kedua sisi.
- Branch kerja: `railway-migration`. Commit hanya bila user minta (default: jangan commit otomatis — jalankan langkah commit HANYA setelah konfirmasi user, atau ganti jadi `git add` saja). **Untuk plan ini, tiap akhir task lakukan `git add` lalu tanyakan user sebelum `git commit`.**

**Spec referensi:** `docs/superpowers/specs/2026-06-18-neraca-ledger-based-design.md`

---

## File Structure

| File | Tanggung jawab |
|---|---|
| NEW `src/lib/services/neraca.ts` | Types + pure helper (`mapSavingsByType`, `sumLoanReceivables`, `computeInventory`, `computeFixedAssets`, `buildEquityWithSelisih`, `assembleBalanceSheet`) + orchestrator `buildBalanceSheet()` + helper SQL `fetchJournalBalances()`. |
| NEW `src/__tests__/neraca.test.ts` | Unit-test pure helper + assembler. |
| MODIFY `src/app/api/reports/neraca/route.ts` | Hapus SQL lama; panggil `buildBalanceSheet()`. |
| MODIFY `src/app/(protected)/laporan/neraca/page.tsx` | Konsumsi shape baru; hapus selector; baris baru + selisih; update export. |

**Interfaces yang dipakai lintas task:**
- `BalanceSheetItem = { code: string; name: string; amount: number; source?: "ledger"|"journal"|"computed" }`
- `BalanceSheetResult` (definisi penuh di Task 5 / spec §7)

---

## Task 1: Types + `mapSavingsByType` (TDD)

**Files:**
- Create: `src/lib/services/neraca.ts`
- Test: `src/__tests__/neraca.test.ts`

**Interfaces:**
- Produces: `BalanceSheetItem`, `mapSavingsByType(rows: { productType: string; balance: number }[]): BalanceSheetItem[]`

- [ ] **Step 1: Write the failing test**

Buat `src/__tests__/neraca.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapSavingsByType } from "@/lib/services/neraca";

describe("mapSavingsByType", () => {
  it("groups pokok/wajib/sukarela ke akun 2101/2102/2103", () => {
    const rows = [
      { productType: "pokok", balance: 1_000_000 },
      { productType: "pokok", balance: 500_000 },
      { productType: "wajib", balance: 2_000_000 },
      { productType: "sukarela", balance: 300_000 },
    ];
    const items = mapSavingsByType(rows);
    expect(items).toContainEqual({ code: "2101", name: "Simpanan Pokok", amount: 1_500_000, source: "ledger" });
    expect(items).toContainEqual({ code: "2102", name: "Simpanan Wajib", amount: 2_000_000, source: "ledger" });
    expect(items).toContainEqual({ code: "2103", name: "Simpanan Sukarela", amount: 300_000, source: "ledger" });
  });

  it("menggabungkan type lain (haji/umrah/lainnya) ke baris Simpanan Lainnya", () => {
    const items = mapSavingsByType([
      { productType: "tabungan_haji", balance: 5_000_000 },
      { productType: "tabungan_umrah", balance: 1_000_000 },
      { productType: "lainnya", balance: 200_000 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toMatch(/Simpanan Lainnya/);
    expect(items[0].amount).toBe(6_200_000);
  });

  it("array kosong → array kosong", () => {
    expect(mapSavingsByType([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- neraca`
Expected: FAIL ("Failed to resolve import … neraca" / function not defined).

- [ ] **Step 3: Write minimal implementation**

Buat `src/lib/services/neraca.ts`:
```ts
import prisma from "@/lib/prisma";
import { calculateSystemSHU } from "./shu-calculator";

export interface BalanceSheetItem {
  code: string;
  name: string;
  amount: number;
  source?: "ledger" | "journal" | "computed";
}

const SAVINGS_TYPE_TO_ACCOUNT: Record<string, { code: string; name: string }> = {
  pokok: { code: "2101", name: "Simpanan Pokok" },
  wajib: { code: "2102", name: "Simpanan Wajib" },
  sukarela: { code: "2103", name: "Simpanan Sukarela" },
};

export function mapSavingsByType(rows: { productType: string; balance: number }[]): BalanceSheetItem[] {
  const sums: Record<string, number> = {};
  for (const r of rows) sums[r.productType] = (sums[r.productType] ?? 0) + r.balance;

  const items: BalanceSheetItem[] = [];
  let lainnya = 0;
  for (const [type, amt] of Object.entries(sums)) {
    const acc = SAVINGS_TYPE_TO_ACCOUNT[type];
    if (acc) {
      items.push({ code: acc.code, name: acc.name, amount: amt, source: "ledger" });
    } else {
      lainnya += amt;
    }
  }
  items.sort((a, b) => a.code.localeCompare(b.code));
  if (lainnya > 0) {
    items.push({ code: "21XX", name: "Simpanan Lainnya (Haji/Umrah/dll)", amount: lainnya, source: "ledger" });
  }
  return items;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- neraca`
Expected: PASS (3 tests).

- [ ] **Step 5: Stage**

```bash
git add src/lib/services/neraca.ts src/__tests__/neraca.test.ts
```
(Tanyakan user sebelum `git commit`.)

---

## Task 2: `sumLoanReceivables` (TDD)

**Files:**
- Modify: `src/lib/services/neraca.ts`
- Test: `src/__tests__/neraca.test.ts`

**Interfaces:**
- Produces: `LoanReceivables = { principal: number; interest: number; writtenOff: number }`, `sumLoanReceivables(loans): LoanReceivables`

- [ ] **Step 1: Write the failing test** — tambahkan ke `neraca.test.ts`:
```ts
import { sumLoanReceivables } from "@/lib/services/neraca";

describe("sumLoanReceivables", () => {
  it("memisahkan active (pokok+bunga) vs written_off (pokok saja, baris terpisah)", () => {
    const loans = [
      { status: "active", principalOutstanding: 10_000_000, interestOutstanding: 1_000_000 },
      { status: "active", principalOutstanding: 5_000_000, interestOutstanding: 200_000 },
      { status: "written_off", principalOutstanding: 2_000_000, interestOutstanding: 0 },
      { status: "paid_off", principalOutstanding: 0, interestOutstanding: 0 },
    ];
    expect(sumLoanReceivables(loans)).toEqual({
      principal: 15_000_000,
      interest: 1_200_000,
      writtenOff: 2_000_000,
    });
  });

  it("array kosong → semua 0", () => {
    expect(sumLoanReceivables([])).toEqual({ principal: 0, interest: 0, writtenOff: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- neraca` → FAIL (sumLoanReceivables not defined).

- [ ] **Step 3: Write minimal implementation** — tambahkan ke `neraca.ts`:
```ts
export interface LoanReceivables {
  principal: number;      // 1201
  interest: number;       // 1202
  writtenOff: number;     // baris terpisah non-realisable
}

export function sumLoanReceivables(
  loans: { status: string; principalOutstanding: number; interestOutstanding: number }[],
): LoanReceivables {
  let principal = 0;
  let interest = 0;
  let writtenOff = 0;
  for (const l of loans) {
    if (l.status === "written_off") {
      writtenOff += l.principalOutstanding;
    } else {
      principal += l.principalOutstanding;
      interest += l.interestOutstanding;
    }
  }
  return { principal, interest, writtenOff };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- neraca` → PASS.

- [ ] **Step 5: Stage** — `git add src/lib/services/neraca.ts src/__tests__/neraca.test.ts`

---

## Task 3: `computeInventory` + `computeFixedAssets` (TDD)

**Files:**
- Modify: `src/lib/services/neraca.ts`
- Test: `src/__tests__/neraca.test.ts`

**Interfaces:**
- Produces: `computeInventory(products): number`, `FixedAssetSummary = { gross; accumulatedDepreciation; net }`, `computeFixedAssets(assets): FixedAssetSummary`

- [ ] **Step 1: Write the failing test** — tambahkan ke `neraca.test.ts`:
```ts
import { computeInventory, computeFixedAssets } from "@/lib/services/neraca";

describe("computeInventory", () => {
  it("stock × costPrice, skip service & non-track", () => {
    const products = [
      { stock: 10, costPrice: 5000, trackStock: true, isService: false },   // 50.000
      { stock: 2, costPrice: 100000, trackStock: true, isService: false },  // 200.000
      { stock: 5, costPrice: 10000, trackStock: false, isService: false },  // skip
      { stock: 3, costPrice: 20000, trackStock: true, isService: true },    // skip
    ];
    expect(computeInventory(products)).toBe(250_000);
  });
  it("abaikan stock negatif", () => {
    expect(computeInventory([{ stock: -1, costPrice: 5000, trackStock: true, isService: false }])).toBe(0);
  });
});

describe("computeFixedAssets", () => {
  it("gross - accumulated = net", () => {
    const assets = [
      { acquisitionCost: 50_000_000, accumulatedDepreciation: 10_000_000 },
      { acquisitionCost: 30_000_000, accumulatedDepreciation: 5_000_000 },
    ];
    expect(computeFixedAssets(assets)).toEqual({
      gross: 80_000_000,
      accumulatedDepreciation: 15_000_000,
      net: 65_000_000,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- neraca` → FAIL.

- [ ] **Step 3: Write minimal implementation** — tambahkan ke `neraca.ts`:
```ts
export function computeInventory(
  products: { stock: number; costPrice: number; trackStock: boolean; isService: boolean }[],
): number {
  let total = 0;
  for (const p of products) {
    if (!p.trackStock || p.isService) continue;
    if (p.stock > 0) total += p.stock * p.costPrice;
  }
  return total;
}

export interface FixedAssetSummary {
  gross: number;
  accumulatedDepreciation: number;
  net: number;
}

export function computeFixedAssets(
  assets: { acquisitionCost: number; accumulatedDepreciation: number }[],
): FixedAssetSummary {
  let gross = 0;
  let accumulatedDepreciation = 0;
  for (const a of assets) {
    gross += a.acquisitionCost;
    accumulatedDepreciation += a.accumulatedDepreciation;
  }
  return { gross, accumulatedDepreciation, net: gross - accumulatedDepreciation };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- neraca` → PASS.

- [ ] **Step 5: Stage** — `git add src/lib/services/neraca.ts src/__tests__/neraca.test.ts`

---

## Task 4: `buildEquityWithSelisih` (TDD)

**Files:**
- Modify: `src/lib/services/neraca.ts`
- Test: `src/__tests__/neraca.test.ts`

**Interfaces:**
- Produces: `EquityResult = { items; shuBerjalan; selisih; totalEquity; isBalanced }`, `buildEquityWithSelisih(params): EquityResult`

- [ ] **Step 1: Write the failing test** — tambahkan ke `neraca.test.ts`:
```ts
import { buildEquityWithSelisih, type BalanceSheetItem } from "@/lib/services/neraca";

const item = (code: string, amount: number): BalanceSheetItem => ({ code, name: code, amount });

describe("buildEquityWithSelisih", () => {
  it("balanced: aset = kewajiban + ekuitas → tanpa baris selisih", () => {
    // aset 100, kewajiban 60, modal 20, shu 20 → equity 40, total 100, balanced
    const r = buildEquityWithSelisih({ modalItems: [item("3101", 20)], shuBerjalan: 20, totalAssets: 100, totalLiabilities: 60 });
    expect(r.selisih).toBe(0);
    expect(r.isBalanced).toBe(true);
    expect(r.totalEquity).toBe(40);
    expect(r.items.find(i => i.code === "31XX")).toBeUndefined();
  });

  it("unbalanced: tambah baris Selisih sebagai plug di ekuitas", () => {
    // aset 100, kewajiban 60, modal+shu = 20 → equity sebelum 20, selisih = 100-60-20 = 20
    const r = buildEquityWithSelisih({ modalItems: [item("3101", 10)], shuBerjalan: 10, totalAssets: 100, totalLiabilities: 60 });
    expect(r.selisih).toBe(20);
    expect(r.isBalanced).toBe(false);
    expect(r.items.find(i => i.code === "31XX")).toEqual({ code: "31XX", name: "Selisih Penyesuaian (beda data/jurnal)", amount: 20, source: "computed" });
    expect(r.totalEquity).toBe(40); // 20 + 20 plug
  });

  it("selisih negatif juga plug (ekuita berkurang)", () => {
    const r = buildEquityWithSelisih({ modalItems: [], shuBerjalan: 0, totalAssets: 50, totalLiabilities: 80 });
    expect(r.selisih).toBe(-30);
    expect(r.isBalanced).toBe(false);
    expect(r.totalEquity).toBe(-30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- neraca` → FAIL.

- [ ] **Step 3: Write minimal implementation** — tambahkan ke `neraca.ts`:
```ts
export interface EquityResult {
  items: BalanceSheetItem[];
  shuBerjalan: number;
  selisih: number;
  totalEquity: number;
  isBalanced: boolean;
}

export function buildEquityWithSelisih(params: {
  modalItems: BalanceSheetItem[]; // 3101/3102 dari jurnal (excl 3103)
  shuBerjalan: number;
  totalAssets: number;
  totalLiabilities: number;
}): EquityResult {
  const items: BalanceSheetItem[] = [...params.modalItems];
  if (params.shuBerjalan !== 0) {
    items.push({ code: "3103", name: "SHU Tahun Berjalan", amount: params.shuBerjalan, source: "computed" });
  }
  const equityBeforeSelisih = items.reduce((s, i) => s + i.amount, 0);
  const selisih = params.totalAssets - params.totalLiabilities - equityBeforeSelisih;
  const isBalanced = Math.abs(selisih) < 1;
  if (!isBalanced) {
    items.push({ code: "31XX", name: "Selisih Penyesuaian (beda data/jurnal)", amount: selisih, source: "computed" });
  }
  const totalEquity = equityBeforeSelisih + (isBalanced ? 0 : selisih);
  return { items, shuBerjalan: params.shuBerjalan, selisih, totalEquity, isBalanced };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- neraca` → PASS.

- [ ] **Step 5: Stage** — `git add src/lib/services/neraca.ts src/__tests__/neraca.test.ts`

---

## Task 5: `assembleBalanceSheet` pure assembler + `BalanceSheetResult` type (TDD)

**Files:**
- Modify: `src/lib/services/neraca.ts`
- Test: `src/__tests__/neraca.test.ts`

**Interfaces:**
- Produces: `BalanceSheetResult` (type), `assembleBalanceSheet(parts): BalanceSheetResult`

- [ ] **Step 1: Write the failing test** — tambahkan ke `neraca.test.ts`:
```ts
import { assembleBalanceSheet } from "@/lib/services/neraca";

describe("assembleBalanceSheet", () => {
  it("menyusun aset lancar + tetap, pasiva, dan identitas selisih", () => {
    const r = assembleBalanceSheet({
      asOf: "2026-06-18",
      cashItems: [{ code: "1103", name: "Bank BRI", amount: 2_900_000_000, source: "ledger" }],
      loanRec: { principal: 5_000_000_000, interest: 200_000_000, writtenOff: 100_000_000 },
      inventory: 50_000_000,
      fixed: { gross: 80_000_000, accumulatedDepreciation: 15_000_000, net: 65_000_000 },
      savingsItems: [{ code: "2102", name: "Simpanan Wajib", amount: 6_000_000_000, source: "ledger" }],
      hutangItems: [{ code: "2201", name: "Hutang Usaha", amount: 100_000_000, source: "journal" }],
      modalItems: [{ code: "3101", name: "Modal Disetor", amount: 500_000_000, source: "journal" }],
      shuBerjalan: 1_700_000_000,
    });
    // aset lancar = 2.9B + 5B + 200M + 50M + 100M(writtenOff) = 8.25B ; tetap net 65M → totalAssets 8.315B
    expect(r.assets.totalAssets).toBe(8_315_000_000);
    expect(r.assets.accumulatedDepreciation).toBe(15_000_000);
    expect(r.liabilities.totalLiabilities).toBe(6_100_000_000);
    // equity sebelum selisih = 500M + 1.7B = 2.2B ; selisih = 8.315B - 6.1B - 2.2B = 15M
    expect(r.equity.selisih).toBe(15_000_000);
    expect(r.isBalanced).toBe(false);
    expect(r.equity.totalEquity).toBe(2_215_000_000);
    expect(r.assets.current.find(i => i.code === "1299")?.amount).toBe(100_000_000); // writtenOff muncul
  });

  it("balanced jika angka pas", () => {
    const r = assembleBalanceSheet({
      asOf: "2026-06-18",
      cashItems: [{ code: "1101", name: "Kas", amount: 100, source: "ledger" }],
      loanRec: { principal: 0, interest: 0, writtenOff: 0 },
      inventory: 0,
      fixed: { gross: 0, accumulatedDepreciation: 0, net: 0 },
      savingsItems: [{ code: "2102", name: "Wajib", amount: 60, source: "ledger" }],
      hutangItems: [],
      modalItems: [{ code: "3101", name: "Modal", amount: 20, source: "journal" }],
      shuBerjalan: 20,
    });
    expect(r.isBalanced).toBe(true);
    expect(r.equity.selisih).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- neraca` → FAIL.

- [ ] **Step 3: Write minimal implementation** — tambahkan ke `neraca.ts`:
```ts
export interface BalanceSheetResult {
  asOf: string;
  assets: {
    current: BalanceSheetItem[];
    fixedGross: BalanceSheetItem[];
    accumulatedDepreciation: number;
    totalAssets: number;
  };
  liabilities: {
    savings: BalanceSheetItem[];
    other: BalanceSheetItem[];
    totalLiabilities: number;
  };
  equity: {
    items: BalanceSheetItem[];
    shuBerjalan: number;
    selisih: number;
    totalEquity: number;
  };
  isBalanced: boolean;
  meta: { generatedAt: string; note: string };
}

export interface BalanceSheetParts {
  asOf: string;
  cashItems: BalanceSheetItem[];
  loanRec: LoanReceivables;
  inventory: number;
  fixed: FixedAssetSummary;
  savingsItems: BalanceSheetItem[];
  hutangItems: BalanceSheetItem[];
  modalItems: BalanceSheetItem[];
  shuBerjalan: number;
}

export function assembleBalanceSheet(parts: BalanceSheetParts): BalanceSheetResult {
  const current: BalanceSheetItem[] = [
    ...parts.cashItems,
    { code: "1201", name: "Piutang Pinjaman Anggota", amount: parts.loanRec.principal, source: "ledger" },
    { code: "1202", name: "Piutang Bunga Pinjaman", amount: parts.loanRec.interest, source: "ledger" },
    { code: "1301", name: "Persediaan Barang Dagangan", amount: parts.inventory, source: "ledger" },
  ];
  if (parts.loanRec.writtenOff !== 0) {
    current.push({ code: "1299", name: "Piutang Dihapusbukukan (non-realisable)", amount: parts.loanRec.writtenOff, source: "ledger" });
  }
  const totalCurrent = current.reduce((s, i) => s + i.amount, 0);
  const fixedGross: BalanceSheetItem[] = parts.fixed.gross !== 0
    ? [{ code: "1400", name: "Aset Tetap (harga perolehan)", amount: parts.fixed.gross, source: "ledger" }]
    : [];
  const totalAssets = totalCurrent + parts.fixed.net;

  const liabilityItems = [...parts.savingsItems, ...parts.hutangItems];
  const totalLiabilities = liabilityItems.reduce((s, i) => s + i.amount, 0);

  const equity = buildEquityWithSelisih({
    modalItems: parts.modalItems,
    shuBerjalan: parts.shuBerjalan,
    totalAssets,
    totalLiabilities,
  });

  return {
    asOf: parts.asOf,
    assets: { current, fixedGross, accumulatedDepreciation: parts.fixed.accumulatedDepreciation, totalAssets },
    liabilities: { savings: parts.savingsItems, other: parts.hutangItems, totalLiabilities },
    equity: { items: equity.items, shuBerjalan: equity.shuBerjalan, selisih: equity.selisih, totalEquity: equity.totalEquity },
    isBalanced: equity.isBalanced,
    meta: {
      generatedAt: parts.asOf,
      note: "Posisi per hari ini. Saldo dari tabel ledger (simpanan/kas/pinjaman/aset) + jurnal (hutang/modal).",
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- neraca` → PASS.

- [ ] **Step 5: Stage** — `git add src/lib/services/neraca.ts src/__tests__/neraca.test.ts`

---

## Task 6: `fetchJournalBalances` + orchestrator `buildBalanceSheet()`

**Files:**
- Modify: `src/lib/services/neraca.ts`

**Interfaces:**
- Consumes: `calculateSystemSHU` dari `./shu-calculator`, `prisma` dari `@/lib/prisma`, semua helper Task 1-5.
- Produces: `buildBalanceSheet(): Promise<BalanceSheetResult>`

- [ ] **Step 1: Write implementation** — tambahkan ke `neraca.ts`. SQL memakai pola lama (GROUP BY normal_balance) tapi kita ambil liability+equity saja, lalu filter kode di JS:

```ts
interface JournalAccountRow {
  code: string;
  name: string;
  type: string;
  balance: number; // sudah dinormalisasi tanda per normal_balance
}

// Ambil saldo akun detail dari jurnal (liability + equity), normalisasi tanda.
async function fetchJournalBalances(): Promise<JournalAccountRow[]> {
  const rows = await prisma.$queryRaw<JournalAccountRow[]>`
    SELECT a.code, a.name, a.type,
           SUM(CASE
               WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit
           END)::float AS balance
    FROM journal_lines jl
    JOIN journals j ON jl.journal_id = j.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE j.is_posted = true
      AND a.is_detail = true
      AND a.type IN ('liability', 'equity')
    GROUP BY a.code, a.name, a.type
    HAVING SUM(CASE
               WHEN a.normal_balance = 'debit' THEN jl.debit - jl.credit
               ELSE jl.credit - jl.debit
           END) <> 0
  `;
  return rows.map((r) => ({ ...r, balance: Number(r.balance) }));
}

const EXCLUDED_LIABILITY_CODES = new Set(["2101", "2102", "2103", "21XX"]); // sumbernya SavingsAccount

export async function buildBalanceSheet(): Promise<BalanceSheetResult> {
  const asOf = new Date().toISOString().split("T")[0];

  const [cashAccounts, loans, storeProducts, assets, savingsAccounts, savingsProducts, journalRows] = await Promise.all([
    prisma.cashBankAccount.findMany({
      where: { isActive: true, deletedAt: null },
      select: { code: true, name: true, currentBalance: true },
    }),
    prisma.loan.findMany({
      where: { status: { in: ["active", "written_off"] } },
      select: { status: true, principalOutstanding: true, interestOutstanding: true },
    }),
    prisma.storeProduct.findMany({
      where: { deletedAt: null },
      select: { stock: true, costPrice: true, trackStock: true, isService: true },
    }),
    prisma.asset.findMany({
      where: { status: "active", deletedAt: null },
      select: { acquisitionCost: true, accumulatedDepreciation: true },
    }),
    prisma.savingsAccount.findMany({
      where: { status: "active" },
      select: { balance: true, productId: true },
    }),
    prisma.savingsProduct.findMany({ select: { id: true, type: true } }),
    fetchJournalBalances(),
  ]);

  // Simpanan (2-step hindari bug groupBy+relation)
  const prodTypeById = new Map(savingsProducts.map((p) => [p.id, p.type]));
  const savingsRows = savingsAccounts.map((a) => ({
    productType: prodTypeById.get(a.productId) ?? "lainnya",
    balance: Number(a.balance),
  }));
  const savingsItems = mapSavingsByType(savingsRows);

  // Kas & Bank (per akun)
  const cashItems: BalanceSheetItem[] = cashAccounts
    .filter((c) => Number(c.currentBalance) !== 0)
    .map((c) => ({ code: c.code, name: c.name, amount: Number(c.currentBalance), source: "ledger" as const }));

  const loanRec = sumLoanReceivables(
    loans.map((l) => ({
      status: l.status,
      principalOutstanding: Number(l.principalOutstanding),
      interestOutstanding: Number(l.interestOutstanding),
    })),
  );
  const inventory = computeInventory(
    storeProducts.map((p) => ({
      stock: p.stock,
      costPrice: Number(p.costPrice),
      trackStock: p.trackStock,
      isService: p.isService,
    })),
  );
  const fixed = computeFixedAssets(
    assets.map((a) => ({
      acquisitionCost: Number(a.acquisitionCost),
      accumulatedDepreciation: Number(a.accumulatedDepreciation),
    })),
  );

  // Hutang (liability jurnal, kecuali 2101-2103) & Modal (equity jurnal, kecuali 3103)
  const hutangItems: BalanceSheetItem[] = journalRows
    .filter((r) => r.type === "liability" && !EXCLUDED_LIABILITY_CODES.has(r.code))
    .map((r) => ({ code: r.code, name: r.name, amount: r.balance, source: "journal" as const }));
  const modalItems: BalanceSheetItem[] = journalRows
    .filter((r) => r.type === "equity" && r.code !== "3103")
    .map((r) => ({ code: r.code, name: r.name, amount: r.balance, source: "journal" as const }));

  // SHU Tahun Berjalan = laba bersih tahun berjalan (YTD full-year currentYear).
  // Pakai totalIncome - totalExpense (BUKAN netSurplus yang di-Math.max(0,…)).
  const currentYear = new Date().getFullYear();
  const shu = await calculateSystemSHU(currentYear);
  const shuBerjalan = Number(shu.totalIncome) - Number(shu.totalExpense);

  return assembleBalanceSheet({
    asOf,
    cashItems,
    loanRec,
    inventory,
    fixed,
    savingsItems,
    hutangItems,
    modalItems,
    shuBerjalan,
  });
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors in `src/lib/services/neraca.ts`. (Jika ada error import path `@/lib/prisma`, pastikan path alias sudah benar — sama dengan `shu-calculator.ts`.)

- [ ] **Step 3: Re-run unit tests (should still pass — orchestrator tidak di-unit-test, diverifikasi empiris di Task 9)**

Run: `npm test -- neraca`
Expected: PASS (semua test helper).

- [ ] **Step 4: Stage** — `git add src/lib/services/neraca.ts`

---

## Task 7: Rewrite API route

**Files:**
- Modify: `src/app/api/reports/neraca/route.ts` (seluruh file)

**Interfaces:**
- Consumes: `buildBalanceSheet` dari `@/lib/services/neraca`.
- Produces: `GET /api/reports/neraca` → `{ data: BalanceSheetResult }`.

- [ ] **Step 1: Ganti isi file** — `src/app/api/reports/neraca/route.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBalanceSheet } from "@/lib/services/neraca";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

// GET /api/reports/neraca - Balance Sheet berbasis ledger (snapshot per hari ini)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const balanceSheet = await buildBalanceSheet();
    return NextResponse.json({ data: balanceSheet });
  } catch (error) {
    console.error("GET /api/reports/neraca error:", error);
    return NextResponse.json(
      { message: "Failed to generate balance sheet" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify types compile** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Smoke test API (butuh dev server ATAU cek via build)**

Opsional (butuh `npm run dev` + login operator): `GET /api/reports/neraca` harus 200 dan `data.assets.totalAssets` ≠ 0. Jika tidak jalan dev server, andalkan verifikasi empiris di Task 9.

- [ ] **Step 4: Stage** — `git add src/app/api/reports/neraca/route.ts`

---

## Task 8: Rewrite page UI

**Files:**
- Modify: `src/app/(protected)/laporan/neraca/page.tsx` (seluruh file)

**Interfaces:**
- Consumes: `BalanceSheetResult` dari `@/lib/services/neraca` (via `reportsApi.neraca()`).

- [ ] **Step 1: Ganti isi file** — `src/app/(protected)/laporan/neraca/page.tsx`:
```tsx
"use client";

import * as React from "react";
import { reportsApi } from "@/lib/api";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";
import type { BalanceSheetItem, BalanceSheetResult } from "@/lib/services/neraca";

const fmt = (n: number, negativeParens = true) =>
  negativeParens && n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n);

export default function NeracaPage() {
  const [data, setData] = React.useState<BalanceSheetResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError("");
      try {
        const response = await reportsApi.neraca();
        setData(response.data as BalanceSheetResult);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat neraca");
        setData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const buildExportRows = () => {
    if (!data) return [];
    const rows: Record<string, unknown>[] = [];
    const push = (ket: string, jumlah: number) => rows.push({ keterangan: ket, jumlah });
    push("=== AKTIVA LANCAR ===", 0);
    data.assets.current.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("=== AKTIVA TETAP ===", 0);
    data.assets.fixedGross.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("(–) Akumulasi Penyusutan", -data.assets.accumulatedDepreciation);
    push("Total Aktiva", data.assets.totalAssets);
    push("=== KEWAJIBAN ===", 0);
    data.liabilities.savings.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    data.liabilities.other.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("Total Kewajiban", data.liabilities.totalLiabilities);
    push("=== EKUITAS ===", 0);
    data.equity.items.forEach((i) => push(`${i.code} - ${i.name}`, i.amount));
    push("Total Ekuitas", data.equity.totalEquity);
    push("Total Pasiva", data.liabilities.totalLiabilities + data.equity.totalEquity);
    return rows;
  };

  const exportCols: ExportColumn[] = [
    { header: "Keterangan", key: "keterangan", width: 42 },
    { header: "Jumlah (Rp)", key: "jumlah", width: 22, format: (v) => (v === 0 ? "" : formatCurrency(Number(v))) },
  ];
  const periodLabel = data ? `Per ${data.asOf}` : "";

  const renderItem = (i: BalanceSheetItem, negativeParens = true) => (
    <TableRow key={i.code + i.name}>
      <TableCell className="font-mono text-sm">{i.code}</TableCell>
      <TableCell>{i.name}</TableCell>
      <TableCell className={`text-right tabular-nums ${i.amount < 0 ? "text-red-600" : ""}`}>{fmt(i.amount, negativeParens)}</TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laporan Neraca"
        description="Posisi keuangan per hari ini (berbasis ledger)"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!data} onClick={() => exportToExcel(buildExportRows(), exportCols, `Neraca_${data?.asOf ?? ""}`, "Neraca")}>
              <Download className="mr-2 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!data} onClick={() => exportToPDF(buildExportRows(), exportCols, `Laporan Neraca ${periodLabel}`, `Neraca_${data?.asOf ?? ""}`)}>
              <FileText className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">{periodLabel || "Memuat…"}</span>
          {data && !data.isBalanced && (
            <Badge variant="destructive">Tidak balance — selisih {formatCurrency(Math.abs(data.equity.selisih))}</Badge>
          )}
          {data?.meta?.note && <span className="text-xs text-muted-foreground">{data.meta.note}</span>}
        </CardContent>
      </Card>

      {error && <Card><CardContent className="p-4 text-sm text-red-600">{error}</CardContent></Card>}

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* AKTIVA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> AKTIVA</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Aktiva Lancar</TableCell></TableRow>
                  {data.assets.current.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Aktiva Tetap</TableCell></TableRow>
                  {data.assets.fixedGross.map((i) => renderItem(i))}
                  {data.assets.accumulatedDepreciation !== 0 && (
                    <TableRow><TableCell className="font-mono text-sm">1403</TableCell><TableCell>(–) Akumulasi Penyusutan</TableCell><TableCell className="text-right tabular-nums text-red-600">{fmt(-data.assets.accumulatedDepreciation)}</TableCell></TableRow>
                  )}
                  <TableRow className="bg-primary/10 font-bold"><TableCell colSpan={2}>TOTAL AKTIVA</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.assets.totalAssets)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* PASIVA */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> PASIVA</CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama Akun</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Kewajiban — Simpanan</TableCell></TableRow>
                  {data.liabilities.savings.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Kewajiban — Lainnya</TableCell></TableRow>
                  {data.liabilities.other.map((i) => renderItem(i))}
                  <TableRow className="bg-muted/30"><TableCell colSpan={3} className="font-semibold">Ekuitas</TableCell></TableRow>
                  {data.equity.items.map((i) => renderItem(i))}
                  <TableRow className="bg-primary/10 font-bold"><TableCell colSpan={2}>TOTAL PASIVA</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(data.liabilities.totalLiabilities + data.equity.totalEquity)}</TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile** — `npx tsc --noEmit` → no errors. (Catatan: jika `Badge` belum ada di `@/components/ui/badge`, hapus import Badge & ganti badge dengan `<span className="text-xs text-red-600">`.)

- [ ] **Step 3: Lint** — `npm run lint` → no new errors in neraca page.

- [ ] **Step 4: Stage** — `git add "src/app/(protected)/laporan/neraca/page.tsx"`

---

## Task 9: Empirical verification (wajib) + final build

**Files:** none (verification only)

- [ ] **Step 1: Jalankan unit tests full**

Run: `npm test`
Expected: semua suite PASS (termasuk `neraca.test.ts`).

- [ ] **Step 2: Verifikasi `buildBalanceSheet()` terhadap DB produksi**

Jalankan one-off read-only via tsx (mirror pola verifikasi sebelumnya):
```bash
npx tsx -e 'import { PrismaClient } from "@prisma/client"; async function main(){ const p = new PrismaClient(); try { const { buildBalanceSheet } = await import("./src/lib/services/neraca"); const bs = await buildBalanceSheet(); console.log("asOf:", bs.asOf); console.log("Total Aset:", bs.assets.totalAssets.toLocaleString("id-ID")); console.log("  - current:", bs.assets.current.length, "items"); console.log("Total Kewajiban:", bs.liabilities.totalLiabilities.toLocaleString("id-ID")); console.log("Total Ekuitas:", bs.equity.totalEquity.toLocaleString("id-ID")); console.log("SHU berjalan:", bs.equity.shuBerjalan.toLocaleString("id-ID")); console.log("Selisih:", bs.equity.selisih.toLocaleString("id-ID"), "| isBalanced:", bs.isBalanced); console.log("Simpanan lines:", bs.liabilities.savings.map(s => s.code+"="+s.amount.toLocaleString("id-ID"))); } finally { await p.$disconnect(); } } main();'
```
Expected (target verifikasi):
- `Total Kewajiban` ≈ **Rp 9.341.154.850** (mendekati saldo simpanan nyata — bukti simpanan masuk).
- `Total Aset` sekarang besar (kas ≈ Rp 2,92 M + piutang pinjaman + persediaan + aset tetap), bukan Rp 177 jt.
- `Simpanan lines` berisi 2101/2102/2103 dengan angka mendekati saldo per product type.
- `Selisih` mungkin ≠ 0 (data-quality) — itu OK & ditampilkan honest.

Catatan: `buildBalanceSheet` mengimpor `prisma` singleton yang baca `DATABASE_URL` dari `.env` (sama seperti `seed.ts`). Jangan lakukan `git commit` untuk one-off ini.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build sukses tanpa type error di route/page neraca.

- [ ] **Step 4: (Opsional) Smoke test UI**

`npm run dev` → login operator → `/laporan/neraca` → pastikan: tidak ada selector bulan/tahun, baris Simpanan muncul dengan angka besar, badge "Tidak balance" muncul hanya jika selisih ≠ 0, export Excel/PDF jalan.

- [ ] **Step 5: Stage semua + tanyakan user untuk commit final**

```bash
git add -A
```
Laporkan hasil verifikasi ke user. Tanyakan apakah ingin commit (pesan: `feat(neraca): rebuild balance sheet from ledger sources (snapshot)`).

---

## Self-Review (dilakukan penulis plan)

**1. Spec coverage:**
- §4 arsitektur/file → Task 1-8 ✓
- §5 sumber & mapping → Task 6 (`buildBalanceSheet`) + helpers ✓
- §6 ekuitas & selisih → Task 4 (`buildEquityWithSelisih`) ✓
- §7 output shape → Task 5 (`BalanceSheetResult`) ✓
- §8 UI → Task 8 ✓
- §9 testing → Task 1-5 unit tests ✓
- §10 verifikasi empiris → Task 9 ✓
- §11 risiko: blacklist SHU (reuse `calculateSystemSHU`), anti-dobel (exclude 2101-2103 & 3103), Decimal→Number, selisih honest, paralel `Promise.all` — semua tertangani ✓

**2. Placeholder scan:** tidak ada TBD/TODO; semua step berisi kode lengkap.

**3. Type consistency:** `BalanceSheetItem`, `LoanReceivables`, `FixedAssetSummary`, `EquityResult`, `BalanceSheetResult`, `BalanceSheetParts` konsisten lintas task. Nama fungsi: `mapSavingsByType`, `sumLoanReceivables`, `computeInventory`, `computeFixedAssets`, `buildEquityWithSelisih`, `assembleBalanceSheet`, `buildBalanceSheet` — dipakai konsisten.

**Catatan risiko tersisa (dilaporkan, bukan blocking):**
- `calculateSystemSHU(currentYear)` memakai range 1 Jan–31 Des tahun berjalan (bukan "sampai hari ini"). Transaksi bertanggal masa depan (jarang) ikut terhitung. Acceptable untuk v1.
- `Asset` model field konstan; jika ada aset dengan `status` lain (`under_maintenance`), hanya `active` yang dihitung — sesuai spec.
- Pinjaman `written_off` ditampilkan sebagai aset (per pilihan user) → memperbesar aset & memunculkan selisih yang menyerap ketidakseimbangan. Honest.
