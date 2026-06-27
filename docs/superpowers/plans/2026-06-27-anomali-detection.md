# Deteksi Anomali Otomatis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/laporan/anomali` page that auto-scans for 5 classes of data-quality anomalies distorting SHU/Neraca, each with an estimated SHU impact, so pengurus can prioritize corrections.

**Architecture:** Pure detection engine (`anomaly-detector.ts`) → operator-only API (`/api/reports/anomali`) → UI page (`/laporan/anomali`). Engine reuses `detectCategoryMismatch` for D1 (synergy with the prevention feature). On-demand scan, no background infra.

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Prisma 6 / Vitest / Playwright. UI uses existing shadcn components + `reportsApi` client pattern.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-anomali-detection-design.md`
- TDD for all pure logic (Vitest, `src/__tests__/`). RED → GREEN → commit.
- DB-coupled code verified via Playwright e2e (Task 6), not unit tests (no test DB).
- Operator-only: API guards via `session.user.permissions.includes("manage_all")`.
- Reuse `detectCategoryMismatch` from `src/lib/services/cash-bank-category-guard.ts` (do NOT reimplement).
- Run scripts/tests with `NODE_ENV=production npx tsx --env-file=.env ...` to suppress Prisma query log noise.
- Commit messages: `feat(anomali): ...` / `test(anomali): ...` / `fix(anomali): ...`. End with `Co-Authored-By: Claude <noreply@anthropic.com>`.
- File header: this is web app code — `new Date()` / `Date.UTC` are allowed (the `Date.now` restriction only applies to Workflow scripts).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/services/anomaly-detector.ts` (NEW) | Types, constants, pure helpers, pure builders, DB detectors, orchestrator `scanAnomalies` |
| `src/__tests__/anomaly-detector.test.ts` (NEW) | Unit tests for pure helpers, builders, summarizer |
| `src/app/api/reports/anomali/route.ts` (NEW) | GET handler, operator auth, calls `scanAnomalies` |
| `src/app/(protected)/laporan/anomali/page.tsx` (NEW) | UI: period selector, summary cards, anomaly list, filters |
| `src/lib/api/services.ts` (MOD) | Add `reportsApi.anomali()` method |
| `src/lib/constants/navigation.ts` (MOD) | Add "Deteksi Anomali" menu item (operator-only) to both Laporan groups |
| `e2e/anomali.spec.ts` (NEW) | Playwright: page loads, anomalies render, 401 for non-operator |

**Shared types (defined Task 1, consumed later):**

```typescript
interface TxRow {
    id: number;
    transactionNo: string;
    amount: Decimal | number;     // Prisma Decimal — coerce with toNum()
    category: string | null;
    description: string | null;
    transactionDate: Date;
}
interface AccountRow { id: number; code: string; name: string; currentBalance: Decimal | number; }
```

---

## Task 1: Pure engine core — types, constants, helpers, builders (TDD)

**Files:**
- Create: `src/lib/services/anomaly-detector.ts`
- Test: `src/__tests__/anomaly-detector.test.ts`

**Interfaces:**
- Produces: `DetectorId`, `Severity`, `ImpactDirection`, `Anomaly`, `AnomalyScanResult` types; constants `OUTLIER_FLOOR`, `OUTLIER_MEDIAN_MULT`, `UNJOURNALED_FLOOR`, `EXPENSE_CATEGORIES_AT_RISK`, `KNOWN_CATEGORIES`; helpers `isKnownCategory`, `isOutlier`, `makeAnomalyId`, `toNum`, `computeMedian`; builders `buildD1Anomaly`, `buildD2Anomaly`, `buildD3Anomaly`, `buildD4Anomaly`, `buildD5Anomaly`. (DB detectors + orchestrator come in Task 2 — leave them out of this file for now.)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/anomaly-detector.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
    isKnownCategory, isOutlier, makeAnomalyId, computeMedian,
    buildD1Anomaly, buildD2Anomaly, buildD4Anomaly,
    OUTLIER_FLOOR, OUTLIER_MEDIAN_MULT,
} from "@/lib/services/anomaly-detector";

describe("isKnownCategory", () => {
    it("true untuk kategori canonical", () => {
        expect(isKnownCategory("biaya_operasional")).toBe(true);
        expect(isKnownCategory("transfer")).toBe(true);
    });
    it("false untuk null, undefined, legacy, typo", () => {
        expect(isKnownCategory(null)).toBe(false);
        expect(isKnownCategory(undefined)).toBe(false);
        expect(isKnownCategory("operational")).toBe(false);
        expect(isKnownCategory("biaya")).toBe(false);
    });
});

describe("isOutlier", () => {
    it("true saat >= OUTLIER_FLOOR", () => {
        expect(isOutlier(OUTLIER_FLOOR, 1_000_000)).toBe(true);
        expect(isOutlier(OUTLIER_FLOOR + 1, 0)).toBe(true);
    });
    it("true saat > OUTLIER_MEDIAN_MULT × median (di bawah floor)", () => {
        expect(isOutlier(15_000_000, 1_000_000)).toBe(true); // 15× median
    });
    it("false saat kecil & dekat median", () => {
        expect(isOutlier(1_500_000, 1_000_000)).toBe(false);
    });
});

describe("makeAnomalyId", () => {
    it("stabil & unik per detector+entity", () => {
        expect(makeAnomalyId("D1", "cashbank_tx", 42)).toBe("D1-cashbank_tx-42");
        expect(makeAnomalyId("D1", "cashbank_tx", 42)).toBe(makeAnomalyId("D1", "cashbank_tx", 42));
        expect(makeAnomalyId("D2", "cashbank_account", 42)).not.toBe(makeAnomalyId("D1", "cashbank_tx", 42));
    });
});

describe("computeMedian", () => {
    it("median ganjil & genap", () => {
        expect(computeMedian([1, 2, 3])).toBe(2);
        expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
    });
    it("0 untuk array kosong", () => {
        expect(computeMedian([])).toBe(0);
    });
});

describe("builders", () => {
    const tx = { id: 5, transactionNo: "CBK-2026-1", amount: 500_000_000, category: "biaya_operasional", description: "ambil kas bri", transactionDate: new Date("2026-04-29") };

    it("buildD1Anomaly: impact = amount, direction inflates_beban", () => {
        const a = buildD1Anomaly(tx, { suggestedCategory: "transfer" });
        expect(a.detector).toBe("D1");
        expect(a.severity).toBe("high");
        expect(a.estimatedShuImpact).toBe(500_000_000);
        expect(a.impactDirection).toBe("inflates_beban");
        expect(a.suggestedAction).toContain("Transfer");
    });
    it("buildD2Anomaly: impact = 0, direction distorts_neraca", () => {
        const a = buildD2Anomaly({ id: 9, code: "BRI", name: "Bank BRI", currentBalance: -5_000_000 });
        expect(a.detector).toBe("D2");
        expect(a.severity).toBe("high");
        expect(a.estimatedShuImpact).toBe(0);
        expect(a.impactDirection).toBe("distorts_neraca");
        expect(a.amount).toBe(5_000_000);
    });
    it("buildD4Anomaly: impact = 0 (konservatif)", () => {
        const a = buildD4Anomaly({ ...tx, category: "operational" });
        expect(a.detector).toBe("D4");
        expect(a.estimatedShuImpact).toBe(0);
        expect(a.impactDirection).toBe("none");
        expect(a.title).toContain("operational");
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/anomaly-detector.test.ts`
Expected: FAIL — "Failed to resolve import … anomaly-detector" (module does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/services/anomaly-detector.ts`:

```typescript
/**
 * Deteksi anomali kualitas data yang mendistorsi SHU/Neraca.
 * Spec: docs/superpowers/specs/2026-06-27-anomali-detection-design.md
 *
 * PURE core (helpers + builders) di file ini — unit-testable.
 * DB detectors + orchestrator ditambahkan di Task 2.
 */
import { CASH_BANK_CATEGORIES } from "@/lib/constants";
import type { CategoryMismatch } from "./cash-bank-category-guard";

export type DetectorId = "D1" | "D2" | "D3" | "D4" | "D5";
export type Severity = "high" | "medium" | "low";
export type ImpactDirection = "inflates_beban" | "inflates_income" | "distorts_neraca" | "none";

export interface Anomaly {
    id: string;
    detector: DetectorId;
    severity: Severity;
    title: string;
    description: string;
    entityType: "cashbank_tx" | "cashbank_account";
    entityId: number;
    entityLabel: string;
    amount: number;
    estimatedShuImpact: number;
    impactDirection: ImpactDirection;
    suggestedAction: string;
}

export interface AnomalyScanResult {
    anomalies: Anomaly[];
    summary: {
        total: number;
        bySeverity: Record<Severity, number>;
        totalShuImpact: number;
        period: { year: number; month: number | null };
        scannedAt: string;
    };
}

// ── Konstanta konfigurable (spec §6) ──────────────────────────────────────
export const OUTLIER_FLOOR = 50_000_000;
export const OUTLIER_MEDIAN_MULT = 10;
export const UNJOURNALED_FLOOR = 25_000_000;

export const EXPENSE_CATEGORIES_AT_RISK = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"] as const;

// DRY: derive dari sumber canonical, bukan hardcode duplikat.
export const KNOWN_CATEGORIES = new Set(Object.keys(CASH_BANK_CATEGORIES));

// ── Tipe row bersama ──────────────────────────────────────────────────────
export interface TxRow {
    id: number;
    transactionNo: string;
    amount: any;
    category: string | null;
    description: string | null;
    transactionDate: Date;
}
export interface AccountRow {
    id: number;
    code: string;
    name: string;
    currentBalance: any;
}

// ── Pure helpers ──────────────────────────────────────────────────────────
export function toNum(d: any): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(String(d));
}

export function isKnownCategory(category: string | null | undefined): boolean {
    return !!category && KNOWN_CATEGORIES.has(category);
}

export function isOutlier(amount: number, median: number): boolean {
    return amount >= OUTLIER_FLOOR || (median > 0 && amount > OUTLIER_MEDIAN_MULT * median);
}

export function makeAnomalyId(detector: DetectorId, entityType: string, entityId: number): string {
    return `${detector}-${entityType}-${entityId}`;
}

export function computeMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Builders (pure mappers) ───────────────────────────────────────────────
export function buildD1Anomaly(tx: TxRow, mismatch: CategoryMismatch): Anomaly {
    const amt = toNum(tx.amount);
    const kind = mismatch.suggestedCategory === "transfer" ? "transfer" : "pencairan pinjaman";
    const label = mismatch.suggestedCategory === "transfer" ? "Transfer Antar Kas/Bank" : "Pencairan Pinjaman";
    return {
        id: makeAnomalyId("D1", "cashbank_tx", tx.id),
        detector: "D1",
        severity: "high",
        title: `Salah kategori: ${kind} dicatat sebagai ${tx.category}`,
        description: `Transaksi ${tx.transactionNo} "${tx.description ?? ""}" sebesar Rp ${amt.toLocaleString("id-ID")} dikategorikan ${tx.category}, namun deskripsi mengindikasikan ${kind}. Kategori expense ini menggelembungkan beban SHU.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: amt,
        impactDirection: "inflates_beban",
        suggestedAction: `Reklassifikasi ke ${label}`,
    };
}

export function buildD2Anomaly(a: AccountRow): Anomaly {
    const bal = toNum(a.currentBalance);
    return {
        id: makeAnomalyId("D2", "cashbank_account", a.id),
        detector: "D2",
        severity: "high",
        title: `Saldo akun negatif: ${a.name}`,
        description: `Akun ${a.name} (${a.code}) memiliki saldo Rp ${bal.toLocaleString("id-ID")}. Saldo negatif mengindikasikan error pencatatan/transaksi ganda.`,
        entityType: "cashbank_account",
        entityId: a.id,
        entityLabel: `${a.code} • ${a.name} • saldo Rp ${bal.toLocaleString("id-ID")}`,
        amount: Math.abs(bal),
        estimatedShuImpact: 0,
        impactDirection: "distorts_neraca",
        suggestedAction: "Audit transaksi akun ini; saldo negatif = error/pencatatan ganda",
    };
}

export function buildD3Anomaly(tx: TxRow, median: number): Anomaly {
    const amt = toNum(tx.amount);
    const reason = amt >= OUTLIER_FLOOR
        ? `≥ Rp ${OUTLIER_FLOOR.toLocaleString("id-ID")}`
        : `> ${OUTLIER_MEDIAN_MULT}× median (Rp ${median.toLocaleString("id-ID")})`;
    return {
        id: makeAnomalyId("D3", "cashbank_tx", tx.id),
        detector: "D3",
        severity: "medium",
        title: `Transaksi outlier: Rp ${amt.toLocaleString("id-ID")}`,
        description: `Transaksi ${tx.transactionNo} "${tx.description ?? ""}" sebesar Rp ${amt.toLocaleString("id-ID")} (${reason}). Jauh di atas transaksi tipikal — review manual.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Review manual — nilai jauh di atas transaksi tipikal",
    };
}

export function buildD4Anomaly(tx: TxRow): Anomaly {
    const amt = toNum(tx.amount);
    const cat = tx.category ?? "(null)";
    return {
        id: makeAnomalyId("D4", "cashbank_tx", tx.id),
        detector: "D4",
        severity: "medium",
        title: `Kategori tak terdaftar: "${cat}"`,
        description: `Transaksi ${tx.transactionNo} punya kategori "${cat}" yang tidak ada di daftar kategori valid.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Tetapkan kategori yang valid",
    };
}

export function buildD5Anomaly(tx: TxRow): Anomaly {
    const amt = toNum(tx.amount);
    return {
        id: makeAnomalyId("D5", "cashbank_tx", tx.id),
        detector: "D5",
        severity: "low",
        title: `Transaksi besar belum dijurnal: Rp ${amt.toLocaleString("id-ID")}`,
        description: `Transaksi keluar ${tx.transactionNo} sebesar Rp ${amt.toLocaleString("id-ID")} belum memiliki jurnal akuntansi (journalId=null).`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Verifikasi apakah perlu dijurnal",
    };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/anomaly-detector.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/anomaly-detector.ts src/__tests__/anomaly-detector.test.ts
git commit -m "feat(anomali): pure engine core (types, helpers, builders) + tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: DB detectors + orchestrator `scanAnomalies`

**Files:**
- Modify: `src/lib/services/anomaly-detector.ts` (append detectors + orchestrator)
- Test: `src/__tests__/anomaly-detector.test.ts` (add test for `summarizeAnomalies`)

**Interfaces:**
- Consumes: builders + helpers from Task 1; `detectCategoryMismatch` from `cash-bank-category-guard`; `PrismaClient` from `@prisma/client`.
- Produces: `detectD1…detectD5(prisma, ctx)`, `summarizeAnomalies(anomalies, period)`, `scanAnomalies(prisma, year, month?)` → `Promise<AnomalyScanResult>`. Used by the API route (Task 3).

- [ ] **Step 1: Write the failing test for the pure summarizer**

Append to `src/__tests__/anomaly-detector.test.ts`:

```typescript
import { summarizeAnomalies, buildD1Anomaly, buildD3Anomaly } from "@/lib/services/anomaly-detector";

describe("summarizeAnomalies", () => {
    it("menghitung total, bySeverity, dan totalShuImpact dengan benar", () => {
        const anomalies = [
            buildD1Anomaly({ id: 1, transactionNo: "A", amount: 500_000_000, category: "biaya_operasional", description: "ambil tunai", transactionDate: new Date("2026-04-29") }, { suggestedCategory: "transfer" }),
            buildD3Anomaly({ id: 2, transactionNo: "B", amount: 60_000_000, category: "beban_unit", description: "x", transactionDate: new Date("2026-05-01") }, 1_000_000),
            buildD3Anomaly({ id: 3, transactionNo: "C", amount: 55_000_000, category: "beban_unit", description: "y", transactionDate: new Date("2026-05-02") }, 1_000_000),
        ];
        const summary = summarizeAnomalies(anomalies, { year: 2026, month: null });
        expect(summary.total).toBe(3);
        expect(summary.bySeverity.high).toBe(1);
        expect(summary.bySeverity.medium).toBe(2);
        expect(summary.bySeverity.low).toBe(0);
        expect(summary.totalShuImpact).toBe(500_000_000); // hanya D1 berdampak
        expect(summary.period).toEqual({ year: 2026, month: null });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/anomaly-detector.test.ts`
Expected: FAIL — `summarizeAnomalies` is not exported (does not exist yet).

- [ ] **Step 3: Append detectors + orchestrator to `anomaly-detector.ts`**

Append at end of file:

```typescript
import { detectCategoryMismatch } from "./cash-bank-category-guard";
import type { PrismaClient } from "@prisma/client";

const TX_SELECT = { id: true, transactionNo: true, amount: true, category: true, description: true, transactionDate: true } as const;

function buildPeriod(year: number, month: number | null) {
    if (month) {
        return {
            startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
            endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        };
    }
    return {
        startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function summarizeAnomalies(anomalies: Anomaly[], period: { year: number; month: number | null }): AnomalyScanResult["summary"] {
    const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    let totalShuImpact = 0;
    for (const a of anomalies) {
        bySeverity[a.severity]++;
        totalShuImpact += a.estimatedShuImpact;
    }
    return { total: anomalies.length, bySeverity, totalShuImpact, period, scannedAt: new Date().toISOString() };
}

// ── DB detectors ──────────────────────────────────────────────────────────
export async function detectD1(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, category: { in: [...EXPENSE_CATEGORIES_AT_RISK] } },
        select: TX_SELECT,
    });
    const out: Anomaly[] = [];
    for (const tx of txs) {
        const m = detectCategoryMismatch("out", tx.category, tx.description);
        if (m) out.push(buildD1Anomaly(tx as TxRow, m));
    }
    return out;
}

export async function detectD2(prisma: PrismaClient): Promise<Anomaly[]> {
    const accts = await prisma.cashBankAccount.findMany({
        where: { currentBalance: { lt: 0 } },
        select: { id: true, code: true, name: true, currentBalance: true },
    });
    return accts.map((a) => buildD2Anomaly(a as AccountRow));
}

export async function detectD3(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const all = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate } },
        select: { amount: true },
    });
    const median = computeMedian(all.map((t) => toNum(t.amount)));
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate } },
        select: TX_SELECT,
    });
    return txs.filter((t) => isOutlier(toNum(t.amount), median)).map((t) => buildD3Anomaly(t as TxRow, median));
}

export async function detectD4(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate } },
        select: TX_SELECT,
    });
    return txs.filter((t) => !isKnownCategory(t.category)).map((t) => buildD4Anomaly(t as TxRow));
}

export async function detectD5(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, amount: { gte: UNJOURNALED_FLOOR } },
        select: TX_SELECT,
    });
    return txs.map((t) => buildD5Anomaly(t as TxRow));
}

// ── Orchestrator ──────────────────────────────────────────────────────────
export async function scanAnomalies(prisma: PrismaClient, year: number, month: number | null = null): Promise<AnomalyScanResult> {
    const { startDate, endDate } = buildPeriod(year, month);
    const period = { year, month };
    let anomalies: Anomaly[] = [];

    // Tiap detector di-try-catch: satu gagal ≠ seluruh scan hancur.
    const runners: [string, () => Promise<Anomaly[]>][] = [
        ["D1", () => detectD1(prisma, startDate, endDate)],
        ["D2", () => detectD2(prisma)],
        ["D3", () => detectD3(prisma, startDate, endDate)],
        ["D4", () => detectD4(prisma, startDate, endDate)],
        ["D5", () => detectD5(prisma, startDate, endDate)],
    ];
    for (const [name, run] of runners) {
        try {
            anomalies = anomalies.concat(await run());
        } catch (e) {
            console.error(`[anomali] detector ${name} gagal:`, e);
        }
    }

    anomalies.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.amount - a.amount);
    return { anomalies, summary: summarizeAnomalies(anomalies, period) };
}
```

- [ ] **Step 4: Run tests + type check**

Run: `npx vitest run src/__tests__/anomaly-detector.test.ts`
Expected: PASS (all, including new `summarizeAnomalies` test).

Run: `npx tsc --noEmit 2>&1 | grep anomaly-detector || echo "anomaly-detector.ts type-clean"`
Expected: "anomaly-detector.ts type-clean" (no errors in this file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/anomaly-detector.ts src/__tests__/anomaly-detector.test.ts
git commit -m "feat(anomali): DB detectors D1-D5 + scanAnomalies orchestrator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: API route + `reportsApi.anomali` client method

**Files:**
- Create: `src/app/api/reports/anomali/route.ts`
- Modify: `src/lib/api/services.ts` (add `anomali` method to `reportsApi`)

**Interfaces:**
- Consumes: `scanAnomalies` from Task 2; `auth` from `@/lib/auth`; `prisma` from `@/lib/prisma`.
- Produces: `GET /api/reports/anomali?year=&month=` → `{ data: AnomalyScanResult }`; 401 non-operator; 500 on error. Client method `reportsApi.anomali(params)`.

- [ ] **Step 1: Create the API route**

Create `src/app/api/reports/anomali/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { scanAnomalies } from "@/lib/services/anomaly-detector";

// GET /api/reports/anomali?year=2026&month=6  (month opsional)
export async function GET(request: Request) {
    try {
        const session = await auth();
        const perms = (session?.user?.permissions ?? []) as string[];
        if (!session?.user || !perms.includes("manage_all")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthRaw = searchParams.get("month");
        const month = monthRaw && monthRaw !== "all" ? parseInt(monthRaw) : null;

        const result = await scanAnomalies(prisma, year, month);
        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/reports/anomali error:", error);
        return NextResponse.json({ message: "Failed to scan anomalies" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Add the client method**

In `src/lib/api/services.ts`, inside the `reportsApi` object, right after the `shu` method (around line 267), add:

```typescript
    anomali: (params?: { year?: number; month?: number | "all" }) =>
        api.get<{ data: import("@/lib/services/anomaly-detector").AnomalyScanResult }>("/reports/anomali", { params }),
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit 2>&1 | grep -E "reports/anomali|api/services" || echo "type-clean"`
Expected: "type-clean".

- [ ] **Step 4: Manual smoke test (read-only, hits prod Neon)**

Run: `NODE_ENV=production npx tsx --env-file=.env -e "import('./src/lib/services/anomaly-detector.ts').then(async m => { const { PrismaClient } = await import('@prisma/client'); const p = new PrismaClient({log:['error']}); const r = await m.scanAnomalies(p, 2026); console.log('total:', r.summary.total, 'bySeverity:', r.summary.bySeverity, 'shuImpact:', r.summary.totalShuImpact); await p.\$disconnect(); })"`

Note: if `tsx -e` import of `.ts` is flaky in your env, skip this and rely on Task 6 e2e. Expected: prints `total: N bySeverity: { high: ..., medium: ..., low: ... } shuImpact: <number>` with `high >= 0`. (After the earlier reclassify fix, D1 should find 0 remaining misclassified — if `high` from D1 is 0, that confirms the data fix held.)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reports/anomali/route.ts src/lib/api/services.ts
git commit -m "feat(anomali): operator-only scan API + reportsApi.anomali client

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: UI page `/laporan/anomali`

**Files:**
- Create: `src/app/(protected)/laporan/anomali/page.tsx`

**Interfaces:**
- Consumes: `reportsApi.anomali` (Task 3); `AnomalyScanResult`/`Anomaly` types; existing UI components (`Card`, `Select`, `Badge`, `Button`); `formatCurrency`.
- Produces: operator-only page at `/laporan/anomali`.

- [ ] **Step 1: Create the page**

Create `src/app/(protected)/laporan/anomali/page.tsx`:

```tsx
"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, AlertTriangle, ShieldAlert, SearchCheck } from "lucide-react";
import { reportsApi } from "@/lib/api";
import { formatCurrency } from "@/lib/constants";
import type { Anomaly, AnomalyScanResult, Severity } from "@/lib/services/anomaly-detector";

const SEV_STYLE: Record<Severity, { label: string; cls: string }> = {
    high: { label: "🔴 HIGH", cls: "bg-red-100 text-red-800 border-red-300" },
    medium: { label: "🟠 MEDIUM", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    low: { label: "🟡 LOW", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
};

const MONTHS = ["Semua bulan", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function AnomaliPage() {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = React.useState(String(currentYear));
    const [selectedMonth, setSelectedMonth] = React.useState("all"); // "all" | "1".."12"
    const [data, setData] = React.useState<AnomalyScanResult | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [filterSeverity, setFilterSeverity] = React.useState<"all" | Severity>("all");
    const [filterDetector, setFilterDetector] = React.useState<"all" | "D1" | "D2" | "D3" | "D4" | "D5">("all");

    const fetchData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const params: { year: number; month?: number | "all" } = { year: parseInt(selectedYear) };
            if (selectedMonth !== "all") params.month = parseInt(selectedMonth);
            const res = await reportsApi.anomali(params);
            setData((res as any).data as AnomalyScanResult);
        } catch (e) {
            console.error("Failed to fetch anomali:", e);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, [selectedYear, selectedMonth]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    const all = data?.anomalies ?? [];
    const filtered = all.filter(
        (a) => (filterSeverity === "all" || a.severity === filterSeverity) && (filterDetector === "all" || a.detector === filterDetector),
    );
    const grouped: Record<Severity, Anomaly[]> = { high: [], medium: [], low: [] };
    filtered.forEach((a) => grouped[a.severity].push(a));

    return (
        <div className="space-y-6">
            <PageHeader title="Deteksi Anomali" description="Pindai otomatis anomali kualitas data yang mendistorsi SHU & Neraca" />

            {/* Period selector + rescan */}
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="mb-1 block text-sm font-medium">Tahun</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{[0, 1, 2].map((o) => { const y = currentYear - o; return <SelectItem key={y} value={String(y)}>{y}</SelectItem>; })}</SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium">Bulan</label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={i === 0 ? "all" : String(i)}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Pindai ulang
                </Button>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memindai...</div>
            ) : !data ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">Gagal memuat. Periksa koneksi atau hak akses.</CardContent></Card>
            ) : data.summary.total === 0 ? (
                <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
                    <SearchCheck className="h-10 w-10 text-emerald-500" />
                    <p className="text-lg font-medium">Tidak ada anomali terdeteksi 🎉</p>
                    <p className="text-sm text-muted-foreground">Periode {data.summary.period.year}{data.summary.period.month ? ` bulan ${data.summary.period.month}` : ""} bersih.</p>
                </CardContent></Card>
            ) : (
                <>
                    {/* Summary cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <SummaryCard title="Total Anomali" value={String(data.summary.total)} icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} />
                        <SummaryCard title="🔴 High" value={String(data.summary.bySeverity.high)} icon={<ShieldAlert className="h-5 w-5 text-red-500" />} />
                        <SummaryCard title="🟠 Medium / 🟡 Low" value={`${data.summary.bySeverity.medium} / ${data.summary.bySeverity.low}`} />
                        <SummaryCard title="Estimasi Dampak SHU" value={formatCurrency(data.summary.totalShuImpact)} highlight />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-3">
                        <Select value={filterSeverity} onValueChange={(v) => setFilterSeverity(v as any)}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua severity</SelectItem>
                                <SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={filterDetector} onValueChange={(v) => setFilterDetector(v as any)}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Detector" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua detector</SelectItem>
                                {["D1", "D2", "D3", "D4", "D5"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Anomaly list grouped by severity */}
                    {(["high", "medium", "low"] as Severity[]).map((sev) =>
                        grouped[sev].length === 0 ? null : (
                            <div key={sev} className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground">{SEV_STYLE[sev].label} ({grouped[sev].length})</h3>
                                <div className="space-y-2">
                                    {grouped[sev].map((a) => (
                                        <Card key={a.id}>
                                            <CardContent className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className={SEV_STYLE[a.severity].cls}>{a.detector}</Badge>
                                                        <span className="font-medium">{a.title}</span>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{a.description}</p>
                                                    <p className="text-xs text-muted-foreground">{a.entityLabel}</p>
                                                </div>
                                                <div className="flex flex-col items-start gap-1 sm:items-end">
                                                    {a.estimatedShuImpact > 0 && (
                                                        <span className="text-sm font-semibold text-red-600">Dampak SHU: {formatCurrency(a.estimatedShuImpact)}</span>
                                                    )}
                                                    <span className="text-xs text-muted-foreground">→ {a.suggestedAction}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ),
                    )}
                </>
            )}
        </div>
    );
}

function SummaryCard({ title, value, icon, highlight }: { title: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">{icon}{title}</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-bold ${highlight ? "text-red-600" : ""}`}>{value}</p></CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit 2>&1 | grep "laporan/anomali" || echo "type-clean"`
Expected: "type-clean".

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/laporan/anomali/page.tsx"
git commit -m "feat(anomali): operator UI page with summary cards + grouped list

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Navigation menu item (operator-only)

**Files:**
- Modify: `src/lib/constants/navigation.ts` — add `{ title: "Deteksi Anomali", href: "/laporan/anomali", roles: ["operator"] }` to BOTH Laporan `children` arrays (≈line 208 and ≈line 604).

**Note:** Route access is gated by the API (401 for non-operators) + this menu filter. `layout.tsx` needs no change — `/laporan/*` is already reachable by operator, and the API guards data.

- [ ] **Step 1: Add to the first Laporan group**

In `src/lib/constants/navigation.ts`, find the first Laporan `children` (the one containing `{ title: "SHU", href: "/laporan/shu" }` around line 212). Add after the `Piutang Gabungan` line (≈line 216), before the `Gaji & Slip` line:

```typescript
                    { title: "Deteksi Anomali", href: "/laporan/anomali", roles: ["operator"] },
```

- [ ] **Step 2: Add to the second Laporan group**

Find the second Laporan `children` (around line 604, also containing `{ title: "SHU", href: "/laporan/shu" }`). Add after its `Piutang Gabungan` line (≈line 612):

```typescript
                    { title: "Deteksi Anomali", href: "/laporan/anomali", roles: ["operator"] },
```

- [ ] **Step 3: Type check + run existing nav unit test**

Run: `npx tsc --noEmit 2>&1 | grep "navigation.ts" || echo "type-clean"`
Expected: "type-clean".

Run: `npx vitest run src/__tests__/batch-navigation.test.ts 2>&1 | tail -5`
Expected: This test has a PRE-EXISTING failure (proven via git stash earlier — unrelated to this work). Confirm the failure is unchanged (same assertion). If a NEW failure appears referencing "Deteksi Anomali", the item count assertion needs the new item — update the test's expected count by +1 for the operator nav group and commit that test update together.

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants/navigation.ts
# (also add src/__tests__/batch-navigation.test.ts if you updated the expected count)
git commit -m "feat(anomali): add Deteksi Anomali to Laporan nav (operator-only)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: E2E verification (Playwright) + push

**Files:**
- Create: `e2e/anomali.spec.ts`

**Context:** Run AFTER deploy to `primkoppol.site` (the `railway-migration` branch auto-deploys). Use the operator test account from `akun-primkoppol.md` (`operator@koperasi.com` / `password123`). Login uses `#email` / `#password` selectors (per CLAUDE.md gotcha).

- [ ] **Step 1: Write the e2e spec**

Create `e2e/anomali.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const BASE = "https://www.primkoppol.site";

test("anomali page loads for operator and renders scan result", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", "operator@koperasi.com");
    await page.fill("#password", "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });

    await page.goto(`${BASE}/laporan/anomali`);
    // Header muncul
    await expect(page.getByRole("heading", { name: "Deteksi Anomali" })).toBeVisible({ timeout: 30000 });
    // Salah satu: summary card "Total Anomali" ATAU empty state "Tidak ada anomali"
    await expect(page.getByText(/Total Anomali|Tidak ada anomali/).first()).toBeVisible({ timeout: 30000 });
});

test("anomali API rejects non-operator (401)", async ({ request }) => {
    // Tanpa cookie session → harus 401
    const res = await request.get(`${BASE}/api/reports/anomali?year=2026`);
    expect([401, 403]).toContain(res.status());
});
```

- [ ] **Step 2: Commit the spec**

```bash
git add e2e/anomali.spec.ts
git commit -m "test(anomali): e2e — page loads + API 401 for non-operator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 3: Push (triggers Railway deploy)**

```bash
git push origin railway-migration
```

- [ ] **Step 4: After deploy completes, run the e2e**

Wait for Railway deploy to finish (watch dashboard or `! railway status`). Then:

Run: `npx playwright test e2e/anomali.spec.ts --project=chromium 2>&1 | tail -15`
Expected: 2 passed. The page test confirms scan runs + UI renders; the API test confirms 401 guard.

If the page test shows anomalies, spot-check: any D1 HIGH with `estimatedShuImpact > 0` is a NEW misclassification slipped past the prevention feature — investigate with `scripts/investigate-shu-reclassify.ts`.

- [ ] **Step 5: Manual UI spot-check (optional, for atasan)**

Log in as operator → Laporan → Deteksi Anomali. Confirm: period selector works, summary cards show counts + SHU impact, anomaly rows show severity badge + detector + drill-down label + suggested action, filter by severity/detector narrows the list.

---

## Self-Review (completed)

**1. Spec coverage:**
- §5 D1–D5 → Task 1 (builders) + Task 2 (detectors). ✓
- §6 constants → Task 1. ✓
- §7 types → Task 1. ✓
- §8 architecture (engine→API→UI) → Tasks 1–4. ✓
- §9 API contract → Task 3. ✓
- §10 UI → Task 4. ✓
- §10 nav/guard → Task 5 (+ API guard in Task 3). ✓
- §11 testing (TDD pure helpers, Playwright DB-coupled) → Tasks 1–2 TDD, Task 6 Playwright. ✓
- §12 file list → all 6 files covered (+ e2e spec). ✓
- §13 perf (median once, targeted queries) → Task 2 (D3 computes median once). ✓

**2. Placeholder scan:** None — all steps have complete code + exact commands. ✓

**3. Type consistency:** `TxRow`/`AccountRow` defined Task 1, used Task 2. `scanAnomalies(prisma, year, month?)` signature consistent Task 2→3. `reportsApi.anomali(params)` consistent Task 3→4. `AnomalyScanResult` shape consistent across engine→API→UI. `detectCategoryMismatch` import path `./cash-bank-category-guard` consistent. `CategoryMismatch` type imported (Task 1 imports it; matches guard's exported type). ✓
