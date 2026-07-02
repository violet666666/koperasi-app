# Mobile Piutang Gabungan — Implementation Plan (Fase 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the mobile mirror of web Piutang Gabungan — a per-member consolidated receivables report (Toko + Unit + SP) with summary cards, server-side search, drill-down detail, and CSV export via share sheet.

**Architecture:** Pure helper (aggregation + CSV) unit-tested in `src/lib/services/piutang-gabungan.ts`; two mobile API endpoints (list + drill-down) that call the helper; one RN screen; Dashboard nav wiring. No new Prisma models, no new npm deps.

**Tech Stack:** Next.js route handlers (API), Prisma 6, Vitest (helper tests), Expo 55 / React Native 0.83 (screen), expo-file-system + expo-sharing (CSV export).

**Spec:** `docs/superpowers/specs/2026-07-03-mobile-piutang-gabungan-design.md`

## Global Constraints (verbatim from spec)

- **RBAC:** operator + admin_sp only, role-gate only. Do NOT add `branchListFilter`/`unitListFilter` — this is an org-wide consolidated report (same deviation class as `reports/financial`).
- **Totals are ALWAYS full-set aggregates** — search/pagination affect only `piutangList` rows, not the totals (mirrors web).
- `TOKO_UNIT_TYPES = ["toko", "playstation", "cafe_lsp", "resto_cafe", "coffe_latar"]` → salary_cut from these is "Piutang Toko"; all other unitTypes are "Piutang Unit".
- **UnitTransaction is the single source of truth** for toko+unit piutang (StoreSale has no `isPaid` → would double-count). Mirror web.
- Money: `Prisma.Decimal` → `Number(...)` at the helper boundary.
- Date column is `UnitTransaction.transactionDate` (`@db.Date`), NOT `createdAt`.
- Member predicate: `status: "active", deletedAt: null`.
- **Logger:** `log.*` only in new mobile code (Fase 5). No raw `console.*`.
- **CSV sanitization:** prefix `'` on cells starting with `= + @ -` (formula injection).
- **Web route untouched** — do NOT refactor the working web endpoint.
- API auth import: `getMobileUserWithScope` from `../../middleware` (list) / `../../../middleware` (detail, one level deeper). Response envelope: `NextResponse.json({ data: {...} })`.
- `branch` = `railway-migration` (API auto-deploys on push; mobile UI deploys via a future EAS build).

---

### Task 1: Aggregation helper `aggregatePiutangGabungan` (TDD)

**Files:**
- Create: `src/lib/services/piutang-gabungan.ts`
- Test: `src/__tests__/piutang-gabungan.test.ts`

**Interfaces:**
- Produces: `TOKO_UNIT_TYPES`, `PiutangItem`, `PiutangAggregation`, `aggregatePiutangGabungan(args)` — exact shapes in spec §6a.

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/piutang-gabungan.test.ts` with these cases (use plain objects; `Prisma.Decimal`-like values can be plain numbers/strings since the helper calls `Number(...)`):
```ts
import { describe, it, expect } from "vitest";
import { aggregatePiutangGabungan, TOKO_UNIT_TYPES } from "@/lib/services/piutang-gabungan";

const m = (id: number, over: Partial<any> = {}) => ({
  id, name: `Anggota ${id}`, nrp: `NRP${id}`, memberNo: `M${id}`,
  pangkat: "Sertu", category: null, kesatuan: "Yon A", ...over,
});

describe("aggregatePiutangGabungan", () => {
  it("toko salary_cut (toko-family unitType) → piutangToko only", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: 1, unitType: "resto_cafe", _sum: { amount: 50000 } }],
      activeLoans: [],
    });
    expect(r.piutangList).toHaveLength(1);
    expect(r.piutangList[0].piutangToko).toBe(50000);
    expect(r.piutangList[0].piutangUnit).toBe(0);
    expect(r.totalPiutangToko).toBe(50000);
    expect(r.totalPiutangUnit).toBe(0);
  });

  it("non-toko unitType → piutangUnit only", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: 1, unitType: "cuci_mobil", _sum: { amount: 30000 } }],
      activeLoans: [],
    });
    expect(r.piutangList[0].piutangUnit).toBe(30000);
    expect(r.piutangList[0].piutangToko).toBe(0);
  });

  it("active loan → spPokok+spJasa + angsuranKe `${n}/${tenor}`", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [{ memberId: 1, loanNo: "L1", principalOutstanding: 100000, interestOutstanding: 20000, tenorMonths: 10, disbursementDate: null, schedules: [{ installmentNo: 3 }] }],
    });
    expect(r.piutangList[0].piutangSPPokok).toBe(100000);
    expect(r.piutangList[0].piutangSPJasa).toBe(20000);
    expect(r.piutangList[0].angsuranKe).toBe("3/10");
    expect(r.piutangList[0].loanCount).toBe(1);
  });

  it("multiple loans on same member → accumulate pokok+jasa+loanCount", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [
        { memberId: 1, loanNo: "L1", principalOutstanding: 100000, interestOutstanding: 20000, tenorMonths: 10, disbursementDate: null, schedules: [{ installmentNo: 3 }] },
        { memberId: 1, loanNo: "L2", principalOutstanding: 50000, interestOutstanding: 10000, tenorMonths: 5, disbursementDate: null, schedules: [{ installmentNo: 2 }] },
      ],
    });
    expect(r.piutangList[0].piutangSPPokok).toBe(150000);
    expect(r.piutangList[0].piutangSPJasa).toBe(30000);
    expect(r.piutangList[0].loanCount).toBe(2);
  });

  it("member with zero piutang is excluded", () => {
    const r = aggregatePiutangGabungan({ members: [m(1), m(2)], unitTxAgg: [], activeLoans: [] });
    expect(r.piutangList).toHaveLength(0);
    expect(r.totalAnggota).toBe(0);
  });

  it("loan with zero outstanding is skipped", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [{ memberId: 1, loanNo: "L0", principalOutstanding: 0, interestOutstanding: 0, tenorMonths: 10, disbursementDate: null, schedules: [] }],
    });
    expect(r.piutangList).toHaveLength(0);
  });

  it("totals = sum over included members; seq increments only for included", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1), m(2), m(3)],
      unitTxAgg: [
        { memberId: 1, unitType: "toko", _sum: { amount: 10000 } },
        { memberId: 3, unitType: "cuci_mobil", _sum: { amount: 40000 } },
      ],
      activeLoans: [],
    });
    expect(r.piutangList.map((p) => p.seq)).toEqual([1, 2]);
    expect(r.grandTotal).toBe(50000);
  });

  it("nrp falls back to memberNo when nrp null; pangkat falls back to category then '-'", () => {
    const r = aggregatePiutangGabungan({
      members: [{ id: 1, name: "X", nrp: null, memberNo: "M999", pangkat: null, category: "PNS", kesatuan: null }],
      unitTxAgg: [{ memberId: 1, unitType: "toko", _sum: { amount: 1000 } }],
      activeLoans: [],
    });
    expect(r.piutangList[0].nrp).toBe("M999");
    expect(r.piutangList[0].pangkat).toBe("PNS");
    expect(r.piutangList[0].kesatuan).toBe("-");
  });

  it("null memberId rows are skipped", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: null, unitType: "toko", _sum: { amount: 999 } }],
      activeLoans: [],
    });
    expect(r.piutangList).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/piutang-gabungan.test.ts`
Expected: FAIL (module not found / `aggregatePiutangGabungan` undefined).

- [ ] **Step 3: Implement the helper**

Create `src/lib/services/piutang-gabungan.ts`:
```ts
// Pure aggregation for Piutang Gabungan (mobile + future web reuse).
// Single source of truth for the per-member math. No Prisma here.

export const TOKO_UNIT_TYPES = ["toko", "playstation", "cafe_lsp", "resto_cafe", "coffe_latar"];

export interface PiutangItem {
  seq: number;
  nama: string;
  nrp: string;
  pangkat: string;
  kesatuan: string;
  piutangToko: number;
  piutangUnit: number;
  piutangSPPokok: number;
  piutangSPJasa: number;
  totalPiutang: number;
  angsuranKe: string;
  loanCount: number;
}

export interface PiutangAggregation {
  piutangList: PiutangItem[];
  totalAnggota: number;
  totalPiutangToko: number;
  totalPiutangUnit: number;
  totalPiutangSPPokok: number;
  totalPiutangSPJasa: number;
  grandTotal: number;
}

export interface HelperMember {
  id: number; name: string; nrp: string | null; memberNo: string | null;
  pangkat: string | null; category: string | null; kesatuan: string | null;
}
export interface HelperUnitAgg {
  memberId: number | null; unitType: string | null;
  _sum: { amount: unknown }; // Prisma.Decimal | number | string | null at runtime
}
export interface HelperLoan {
  memberId: number; loanNo: string;
  principalOutstanding: unknown; interestOutstanding: unknown;
  tenorMonths: number; disbursementDate: Date | null;
  schedules: { installmentNo: number }[];
}

const num = (v: unknown): number => Number(v ?? 0) || 0;

export function aggregatePiutangGabungan(args: {
  members: HelperMember[];
  unitTxAgg: HelperUnitAgg[];
  activeLoans: HelperLoan[];
}): PiutangAggregation {
  const tokoMap = new Map<number, number>();
  const unitMap = new Map<number, number>();
  const spMap = new Map<number, { pokok: number; jasa: number; angsuranKe: string; loanCount: number }>();

  for (const row of args.unitTxAgg) {
    if (row.memberId == null) continue;
    const amount = num(row._sum?.amount);
    const map = TOKO_UNIT_TYPES.includes(row.unitType || "") ? tokoMap : unitMap;
    map.set(row.memberId, (map.get(row.memberId) || 0) + amount);
  }

  for (const loan of args.activeLoans) {
    const pokok = num(loan.principalOutstanding);
    const jasa = num(loan.interestOutstanding);
    if (pokok <= 0 && jasa <= 0) continue;
    const existing = spMap.get(loan.memberId);
    if (existing) {
      existing.pokok += pokok;
      existing.jasa += jasa;
      existing.loanCount++;
    } else {
      const next = loan.schedules[0]?.installmentNo;
      spMap.set(loan.memberId, {
        pokok, jasa, loanCount: 1,
        angsuranKe: next ? `${next}/${loan.tenorMonths}` : "-",
      });
    }
  }

  const piutangList: PiutangItem[] = [];
  let seq = 0;
  for (const member of args.members) {
    const piutangToko = tokoMap.get(member.id) || 0;
    const piutangUnit = unitMap.get(member.id) || 0;
    const sp = spMap.get(member.id);
    if (piutangToko <= 0 && piutangUnit <= 0 && !sp) continue;
    seq++;
    const piutangSPPokok = sp?.pokok || 0;
    const piutangSPJasa = sp?.jasa || 0;
    piutangList.push({
      seq,
      nama: member.name,
      nrp: member.nrp || member.memberNo || "-",
      pangkat: member.pangkat || member.category || "-",
      kesatuan: member.kesatuan || "-",
      piutangToko, piutangUnit, piutangSPPokok, piutangSPJasa,
      totalPiutang: piutangToko + piutangUnit + piutangSPPokok + piutangSPJasa,
      angsuranKe: sp?.angsuranKe || "-",
      loanCount: sp?.loanCount || 0,
    });
  }

  const reduce = (sel: (p: PiutangItem) => number) => piutangList.reduce((s, p) => s + sel(p), 0);
  return {
    piutangList,
    totalAnggota: piutangList.length,
    totalPiutangToko: reduce((p) => p.piutangToko),
    totalPiutangUnit: reduce((p) => p.piutangUnit),
    totalPiutangSPPokok: reduce((p) => p.piutangSPPokok),
    totalPiutangSPJasa: reduce((p) => p.piutangSPJasa),
    grandTotal: reduce((p) => p.totalPiutang),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/piutang-gabungan.test.ts`
Expected: 9 PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (repo root). Expected: no new errors in the new file.
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/piutang-gabungan.ts src/__tests__/piutang-gabungan.test.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(piutang-gabungan): pure aggregation helper + tests (Fase 6 T1)"
```

---

### Task 2: CSV helper `buildPiutangCSV` (TDD)

**Files:**
- Modify: `src/lib/services/piutang-gabungan.ts` (append `buildPiutangCSV`)
- Test: append to `src/__tests__/piutang-gabungan.test.ts`

**Interfaces:**
- Consumes: `PiutangItem[]` + totals (from Task 1) + the `PiutangAggregation` shape.
- Produces: `buildPiutangCSV(items: PiutangItem[], totals: PiutangAggregation): string` — full CSV with header + rows + TOTAL row. **Used by Task 3's `?format=csv` branch** (server-side export) — not dead code.

- [ ] **Step 1: Write the failing tests**

Append to the test file:
```ts
import { buildPiutangCSV } from "@/lib/services/piutang-gabungan";

describe("buildPiutangCSV", () => {
  const agg: any = {
    piutangList: [], totalAnggota: 1,
    totalPiutangToko: 10000, totalPiutangUnit: 0,
    totalPiutangSPPokok: 0, totalPiutangSPJasa: 0, grandTotal: 10000,
  };
  const item: any = { seq: 1, nama: "Budi", nrp: "123", pangkat: "Sertu", kesatuan: "Yon A",
    piutangToko: 10000, piutangUnit: 0, piutangSPPokok: 0, piutangSPJasa: 0, totalPiutang: 10000,
    angsuranKe: "-", loanCount: 0 };

  it("has the exact header row", () => {
    const csv = buildPiutangCSV([item], agg);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("No,NRP,Pangkat,Kesatuan,Nama,Piutang Toko,Piutang Unit,Pokok Pinjaman,Jasa Pinjaman,Total Piutang");
  });

  it("writes one row per item + a TOTAL row", () => {
    const csv = buildPiutangCSV([item], agg);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 1 item + TOTAL
    expect(lines[2].startsWith("TOTAL")).toBe(true);
  });

  it("sanitizes formula injection (leading = + @ -)", () => {
    const evil: any = { ...item, nama: "=HYPERLINK(\"x\")", nrp: "+123", pangkat: "@root", kesatuan: "-cmd" };
    const csv = buildPiutangCSV([evil], agg);
    // each injected cell must be prefixed with a single quote
    expect(csv).toContain("'=HYPERLINK(\"x\")");
    expect(csv).toContain("'+123");
    expect(csv).toContain("'@root");
    expect(csv).toContain("'-cmd");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/piutang-gabungan.test.ts`
Expected: new cases FAIL (`buildPiutangCSV` undefined).

- [ ] **Step 3: Implement `buildPiutangCSV`**

Append to `src/lib/services/piutang-gabungan.ts`:
```ts
// CSV builder for Piutang Gabungan export. Sanitizes formula injection.
const CSV_HEADERS = ["No", "NRP", "Pangkat", "Kesatuan", "Nama", "Piutang Toko", "Piutang Unit", "Pokok Pinjaman", "Jasa Pinjaman", "Total Piutang"];

const cell = (v: string | number): string => {
  const s = String(v ?? "");
  // Formula-injection sanitize: prefix a single quote if the cell starts with = + @ - or a tab/CR
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  // Quote if it contains comma, quote, or newline
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function buildPiutangCSV(items: PiutangItem[], totals: PiutangAggregation): string {
  const rows: string[] = [CSV_HEADERS.join(",")];
  for (const it of items) {
    rows.push([
      cell(it.seq), cell(it.nrp), cell(it.pangkat), cell(it.kesatuan), cell(it.nama),
      cell(it.piutangToko), cell(it.piutangUnit), cell(it.piutangSPPokok), cell(it.piutangSPJasa), cell(it.totalPiutang),
    ].join(","));
  }
  rows.push(["TOTAL", "", "", "", "", totals.totalPiutangToko, totals.totalPiutangUnit, totals.totalPiutangSPPokok, totals.totalPiutangSPJasa, totals.grandTotal].join(","));
  return rows.join("\n");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/piutang-gabungan.test.ts`
Expected: all PASS (12).

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/piutang-gabungan.ts src/__tests__/piutang-gabungan.test.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(piutang-gabungan): CSV builder + formula-injection sanitize + tests (Fase 6 T2)"
```

---

### Task 3: List API `GET /api/mobile/reports/piutang-gabungan`

**Files:**
- Create: `src/app/api/mobile/reports/piutang-gabungan/route.ts`

**Interfaces:**
- Consumes: `aggregatePiutangGabungan`, `PiutangItem` from `@/lib/services/piutang-gabungan`; `getMobileUserWithScope` from `../../middleware`.
- Produces: `{ data: { piutangList, totalAnggota, totalPiutangToko, totalPiutangUnit, totalPiutangSPPokok, totalPiutangSPJasa, grandTotal, pagination? } }`.

- [ ] **Step 1: Implement the route**

Create `src/app/api/mobile/reports/piutang-gabungan/route.ts`:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { aggregatePiutangGabungan, buildPiutangCSV } from "@/lib/services/piutang-gabungan";

export async function GET(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin SP yang dapat mengakses laporan ini" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isExport = searchParams.get("export") === "true";
    const format = searchParams.get("format");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const members = await prisma.member.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, pangkat: true, category: true, kesatuan: true },
      orderBy: { name: "asc" },
    });

    if (members.length === 0) {
      return NextResponse.json({ data: { piutangList: [], totalAnggota: 0, totalPiutangToko: 0, totalPiutangUnit: 0, totalPiutangSPPokok: 0, totalPiutangSPJasa: 0, grandTotal: 0 } });
    }

    const memberIds = members.map((m) => m.id);

    const unitTxAgg = await prisma.unitTransaction.groupBy({
      by: ["memberId", "unitType"],
      where: { memberId: { in: memberIds }, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
      _sum: { amount: true },
    });

    const activeLoans = await prisma.loan.findMany({
      where: { memberId: { in: memberIds }, status: "active" },
      select: {
        memberId: true, loanNo: true, principalOutstanding: true, interestOutstanding: true,
        tenorMonths: true, disbursementDate: true,
        schedules: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { installmentNo: true }, orderBy: { installmentNo: "asc" }, take: 1 },
      },
    });

    const agg = aggregatePiutangGabungan({ members, unitTxAgg, activeLoans });

    // Totals are ALWAYS full-set. Search + pagination affect only the returned rows.
    const filtered = search
      ? agg.piutangList.filter((p) =>
          p.nama.toLowerCase().includes(search) ||
          p.nrp.toLowerCase().includes(search) ||
          p.pangkat.toLowerCase().includes(search) ||
          p.kesatuan.toLowerCase().includes(search))
      : agg.piutangList;

    if (format === "csv") {
      const csv = buildPiutangCSV(filtered, agg);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
    }

    if (isExport) {
      return NextResponse.json({ data: { piutangList: filtered, ...restTotals(agg) } });
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);
    return NextResponse.json({ data: { piutangList: paginated, ...restTotals(agg), pagination: { page, perPage, totalItems, totalPages } } });
  } catch (err) {
    console.error("GET /api/mobile/reports/piutang-gabungan error:", err);
    return NextResponse.json({ message: "Gagal generate laporan piutang gabungan" }, { status: 500 });
  }
}

function restTotals(agg: ReturnType<typeof aggregatePiutangGabungan>) {
  return {
    totalAnggota: agg.totalAnggota,
    totalPiutangToko: agg.totalPiutangToko,
    totalPiutangUnit: agg.totalPiutangUnit,
    totalPiutangSPPokok: agg.totalPiutangSPPokok,
    totalPiutangSPJasa: agg.totalPiutangSPJasa,
    grandTotal: agg.grandTotal,
  };
}
```
Note: the lone `console.error` is server-side (Next API), not mobile source — acceptable (matches sibling mobile report routes which use `console.error`). Do not use `log.*` here (that util is mobile-only).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (repo root). Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/app/api/mobile/reports/piutang-gabungan/route.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): GET /reports/piutang-gabungan list + export (Fase 6 T3)"
```

---

### Task 4: Detail API `GET /api/mobile/reports/piutang-gabungan/[memberId]`

**Files:**
- Create: `src/app/api/mobile/reports/piutang-gabungan/[memberId]/route.ts`

**Interfaces:**
- Consumes: `getMobileUserWithScope` from `../../../middleware`; `TOKO_UNIT_TYPES`, `aggregatePiutangGabungan` from `@/lib/services/piutang-gabungan` (reuse helper to compute this member's row totals).
- Produces: `{ data: { member, loans, transactions, totals } }` (spec §6c).

- [ ] **Step 1: Implement the route**

Create `src/app/api/mobile/reports/piutang-gabungan/[memberId]/route.ts`:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../../middleware";
import { aggregatePiutangGabungan, TOKO_UNIT_TYPES } from "@/lib/services/piutang-gabungan";

export async function GET(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin SP yang dapat mengakses laporan ini" }, { status: 403 });
    }

    const { memberId } = await params;
    const id = Number(memberId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "memberId tidak valid" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { id, status: "active", deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, pangkat: true, category: true, kesatuan: true },
    });
    if (!member) return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });

    const [unitTxAgg, loansRaw, txRaw] = await Promise.all([
      prisma.unitTransaction.groupBy({
        by: ["memberId", "unitType"],
        where: { memberId: id, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
        _sum: { amount: true },
      }),
      prisma.loan.findMany({
        where: { memberId: id, status: "active" },
        select: {
          loanNo: true, principalOutstanding: true, interestOutstanding: true, tenorMonths: true, disbursementDate: true,
          schedules: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { installmentNo: true }, orderBy: { installmentNo: "asc" }, take: 1 },
        },
      }),
      prisma.unitTransaction.findMany({
        where: { memberId: id, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
        select: { transactionNo: true, transactionDate: true, unitType: true, description: true, amount: true },
        orderBy: { transactionDate: "desc" },
      }),
    ]);

    // Reuse the helper to compute this member's exact row (guarantees parity with the list row).
    const row = aggregatePiutangGabungan({ members: [member], unitTxAgg, activeLoans: loansRaw as any });

    const loans = loansRaw.map((l) => {
      const next = (l as any).schedules[0]?.installmentNo;
      return {
        loanNo: l.loanNo,
        angsuranKe: next ? `${next}/${l.tenorMonths}` : "-",
        pokok: Number(l.principalOutstanding),
        jasa: Number(l.interestOutstanding),
        tenorMonths: l.tenorMonths,
        disbursementDate: l.disbursementDate,
      };
    });

    const transactions = txRaw.map((t) => ({
      transactionNo: t.transactionNo,
      date: t.transactionDate,
      unitType: t.unitType,
      description: t.description,
      amount: Number(t.amount),
      source: TOKO_UNIT_TYPES.includes(t.unitType || "") ? "toko" : "unit",
    }));

    const item = row.piutangList[0];
    return NextResponse.json({
      data: {
        member: { id: member.id, name: member.name, nrp: member.nrp || member.memberNo, pangkat: member.pangkat || member.category || "-", kesatuan: member.kesatuan || "-" },
        loans,
        transactions,
        totals: item
          ? { piutangToko: item.piutangToko, piutangUnit: item.piutangUnit, piutangSPPokok: item.piutangSPPokok, piutangSPJasa: item.piutangSPJasa, total: item.totalPiutang }
          : { piutangToko: 0, piutangUnit: 0, piutangSPPokok: 0, piutangSPJasa: 0, total: 0 },
      },
    });
  } catch (err) {
    console.error("GET /api/mobile/reports/piutang-gabungan/[memberId] error:", err);
    return NextResponse.json({ message: "Gagal memuat detail piutang" }, { status: 500 });
  }
}
```
Note: `params: Promise<...>` + `await params` — matches the Next.js async-params pattern (CLAUDE.md gotcha).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (repo root). Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/reports/piutang-gabungan/[memberId]/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): GET /reports/piutang-gabungan/[memberId] drill-down (Fase 6 T4)"
```

---

### Task 5: Screen `LaporanPiutangGabunganScreen`

**Files:**
- Create: `mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx`

**Interfaces:**
- Consumes: mobile `api` client (`../../lib/api`), `log` from `../../utils/log`, `C` from `../../lib/colors`; `expo-file-system` + `expo-sharing`.
- **CSV export is server-side** — the screen fetches `?format=csv` (CSV text built + sanitized by `buildPiutangCSV`, Task 2/3) and just writes + shares the file. No CSV-building or sanitize logic in the screen (keeps it thin, avoids untested duplication).

**Architecture of the screen:**
- State: `data` (list response), `page`, `search` (debounced), `loading`, `error`, `exporting`, drill-down `detail` (+ `detailLoading`).
- `fetchList(page, search)`: GET `/mobile/reports/piutang-gabungan?page=&perPage=25&search=` → set summary cards + append (infinite scroll) or replace (search change).
- `fetchDetail(memberId)`: GET `/mobile/reports/piutang-gabungan/${memberId}` → drill-down modal.
- `handleExport`: GET `?format=csv` → CSV text body → `writeAsStringAsync` to `FileSystem.documentDirectory + "piutang-gabungan-<date>.csv"` → `Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export Piutang Gabungan" })`. Toast on success/failure. (CSV building + formula-injection sanitization happen server-side via `buildPiutangCSV` — Task 2/3.)
- **Layout** (mirror web card semantics + existing mobile Laporan screen style):
  - Header (title "Piutang Gabungan" + Export button + Refresh).
  - Summary cards (horizontal ScrollView): Total Anggota, Piutang Toko (orange), Piutang Unit (purple), Piutang SP (cyan = pokok+jasa), Grand Total (emerald).
  - Search bar (TextInput, debounced 400ms → reset page=1, refetch).
  - FlatList of member cards. Card: row1 nama + nrp + pangkat; row2 mini-grid (Toko / Unit / Pokok SP / Jasa SP); footer Total (bold). `onPress` → `fetchDetail`. `onEndReached` → next page.
  - Empty state, loading spinner, error+retry.
  - Drill-down Modal: member header; "Pinjaman SP Aktif" section (loans list: loanNo, angsuranKe, pokok, jasa); "Transaksi Potong Gaji Belum Lunas" section (transactions: date, source badge, description, amount); totals footer. Close button.

- [ ] **Step 1: Implement the screen**

Create the file following the structure above. Use `log.*` for catch blocks (never `console.*`). Mirror an existing screen (`mobile/src/screens/operator/LaporanPinjamanScreen.tsx`) for style conventions (cards, `formatRp`, colors via `C`, `api` usage). The mobile `api` client base path already points at `/mobile` — confirm by reading `mobile/src/lib/api.ts`; call `api.get("/reports/piutang-gabungan?...")`.

- [ ] **Step 2: Implement `handleExport` (thin — fetches server-built CSV)**

```ts
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { log } from "../../utils/log";

const handleExport = async () => {
  setExporting(true);
  try {
    // Server builds + sanitizes the CSV (buildPiutangCSV, ?format=csv).
    const res = await api.get("/reports/piutang-gabungan?format=csv", { responseType: "text" });
    const csv = typeof res === "string" ? res : (res as any).data ?? "";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const uri = FileSystem.documentDirectory + `piutang-gabungan-${date}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export Piutang Gabungan" });
  } catch (err) {
    log.error("Export piutang gabungan gagal:", err);
    Toast.show({ type: "error", text1: "Export gagal" });
  } finally {
    setExporting(false);
  }
};
```
(Confirm the mobile `api` client's `responseType: "text"` support by reading `mobile/src/lib/api.ts` at implementation time — if it only returns JSON-parsed bodies, fetch the CSV via the raw `fetch(token)` URL instead. The CSV body is plain text, not JSON.)

- [ ] **Step 3: Typecheck mobile**

Run: `cd mobile && npx tsc --noEmit`. Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): LaporanPiutangGabunganScreen (list+cards+search+drill-down+CSV) (Fase 6 T5)"
```

---

### Task 6: Navigation wiring

**Files:**
- Modify: `mobile/App.tsx` (register routes)
- Modify: `mobile/src/screens/common/DashboardScreen.tsx` (add menu item, role-gated)

**Interfaces:**
- Consumes: `LaporanPiutangGabunganScreen` from Task 5.

- [ ] **Step 1: Register routes in `mobile/App.tsx`**

Add `LaporanPiutangGabungan` (and, if the drill-down is a pushed screen rather than a modal, `PiutangGabunganDetail`) to the navigator's `Screen` list, mirroring how `LaporanSHU` / `Neraca` are registered. If the drill-down is a Modal inside the screen (Task 5 decision), only one route is needed.

- [ ] **Step 2: Add Dashboard menu item**

In `mobile/src/screens/common/DashboardScreen.tsx`, inside the "Akuntansi & Keuangan" `CollapsibleSection` `menuGrid`, add:
```tsx
{(userRole === "operator" || userRole === "admin_sp") && (
<MenuItem icon="receipt-outline" label="Piutang Gabungan" color="#0891b2" onPress={() => navigation.navigate("LaporanPiutangGabungan")} />
)}
```
Gate is `operator || admin_sp` (matches the API gate; kasir/admin don't see it — Fase 5 lesson: verify gate against API, not assumptions).

- [ ] **Step 3: Typecheck + commit**

Run: `cd mobile && npx tsc --noEmit`. Expected: no new errors.
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/App.tsx mobile/src/screens/common/DashboardScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): wire Piutang Gabungan nav + Dashboard menu (Fase 6 T6)"
```

---

## After T1–T6 land → review + deploy

1. Final whole-branch opus review over `759a6fdb..HEAD`.
2. Run full test suite (`npm test`) — expect baseline (427 pass / 3 pre-existing) + the new piutang-gabungan tests.
3. `finishing-a-development-branch`: push `railway-migration` (deploys the 2 new mobile API endpoints to prod). **No EAS build needed for the API.** Mobile UI (screen) ships via a future batched EAS build (#3).
4. (Later) bump `mobile/app.json` versionCode + EAS build #3 when more mobile UI fases accumulate.

## Notes for the final whole-branch review
- Confirm list API denies kasir + admin (403) and allows operator + admin_sp (200).
- Confirm totals are full-set even when `?search=` is applied (search filters only `piutangList`).
- Confirm `[memberId]` detail totals match the member's list row (helper reused — parity).
- Confirm CSV sanitizes `= + @ -` leading chars (formula injection).
- Confirm no raw `console.*` in the new screen (uses `log.*`); `console.error` only in server routes (matches siblings).
- Confirm web `api/reports/piutang-gabungan` route is untouched.
- Confirm `params: Promise<...>` + `await params` in the detail route (Next.js async-params).
