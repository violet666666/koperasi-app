# Mobile Generic Per-Unit Laporan — Implementation Plan (Fase 7b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic mobile per-unit laporan screen (all 10 unit types, read-only, full V1) — built DRY by extracting the web route's data logic into a shared `getUnitLaporanData` helper that web + mobile both call.

**Architecture:** Extract `computePeriodRange` (pure, TDD) + `getUnitLaporanData` (DB-bound, the single source of truth) from the web route; refactor the web route to call the helper (behavior-preserving); add a mobile route (JWT + `canAccessUnit`) that calls the same helper; build the screen + nav. No new Prisma models.

**Tech Stack:** Next.js route handlers, Prisma 6 (`prismaRead`), Vitest, Expo 55 / RN 0.83.

**Spec:** `docs/superpowers/specs/2026-07-04-mobile-unit-laporan-design.md`

## Global Constraints (verbatim from spec)

- **DRY:** `getUnitLaporanData` is the single source of truth for the laporan computation. Web + mobile both call it. No duplication of query/aggregation logic.
- **Web route refactor is MECHANICAL + BEHAVIOR-PRESERVING.** Auth/access-control (lines 27-43) stays; the data logic (lines ~55-448) moves into the helper; the route calls the helper. Response shape byte-identical before/after.
- **`canAccessUnit(user, unitType).allowed`** — ScopeDecision object, use `.allowed` (Fase 7a lesson). Operator bypass; admin → own unit alias-family; fail-closed 403.
- Mobile route gate: `["operator","admin","admin_sp"]` (kasir excluded — matches mobile report-route convention).
- `params: Promise<...>` + `await params` in the mobile route (Next.js async-params).
- `prismaRead` for the helper (read replica, like web).
- `log.*` only in the mobile screen; `console.error` in server routes.
- The broken `GET /api/mobile/reports/unit` (+ Cuci Mobil consumer) is NOT removed — backward compat; generic screen supersedes.
- `branch` = `railway-migration` (API auto-deploys on push; screen ships via future EAS build #5).

---

### Task 1: `computePeriodRange` pure helper + tests (TDD)

**Files:**
- Create: `src/lib/services/unit-laporan.ts` (starts with just this pure fn; T2 appends `getUnitLaporanData`)
- Test: `src/__tests__/unit-laporan.test.ts`

- [ ] **Step 1: Read the source math** — open `src/app/api/unit/[slug]/laporan/route.ts` lines ~56-96 (the WIB period-range computation: today/week/month/year/custom). The pure helper must faithfully reproduce this logic.

- [ ] **Step 2: Write the failing tests** in `src/__tests__/unit-laporan.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computePeriodRange } from "@/lib/services/unit-laporan";

// Fixed "now" so tests are deterministic. Use a date where month boundaries + Mon-start week are unambiguous.
const NOW = new Date("2026-06-15T03:00:00Z"); // 10:00 WIB on Monday 15 June 2026

describe("computePeriodRange", () => {
  it("month → 1st-to-last-day of current month (WIB), label '<Bulan> <Tahun>'", () => {
    const r = computePeriodRange("month", NOW);
    // June 2026: start = Jun 1 00:00 WIB, end = Jun 30 23:59:59 WIB
    expect(r.periodLabel).toMatch(/2026/);
    // start day-of-month = 1; end is the last day of June (30)
    expect(new Date(r.start).getUTCDate()).toBeGreaterThanOrEqual(1);
    // structural: start <= end
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
  });
  it("week → starts Monday (WIB)", () => {
    const r = computePeriodRange("week", NOW);
    // 15 June 2026 is a Monday → week start should be Mon 15 (or the Monday of that week)
    const start = new Date(r.start);
    // Acceptance: the start is a Monday (getDay() === 1 in the WIB-local sense — assert via the label/day)
    expect(start.getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("year → Jan 1 to Dec 31 of current year", () => {
    const r = computePeriodRange("year", NOW);
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("today → same day bounds", () => {
    const r = computePeriodRange("today", NOW);
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(NOW.getTime());
    expect(new Date(r.end).getTime()).toBeGreaterThanOrEqual(NOW.getTime());
  });
  it("custom → uses dateFrom/dateTo", () => {
    const r = computePeriodRange("custom", NOW, "2026-06-01", "2026-06-10");
    expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
  });
  it("start <= end for all periods", () => {
    for (const p of ["today", "week", "month", "year"] as const) {
      const r = computePeriodRange(p, NOW);
      expect(new Date(r.start).getTime()).toBeLessThanOrEqual(new Date(r.end).getTime());
    }
  });
});
```
(Adjust assertions to the EXACT WIB behavior the web route produces — the goal is a faithful, behavior-preserving port. If the web route's exact instants differ from these structural checks, favor matching the web's behavior + strengthen the test to lock it in.)

- [ ] **Step 3: Run → FAIL** (`npx vitest run src/__tests__/unit-laporan.test.ts`, module not found).

- [ ] **Step 4: Implement `computePeriodRange`** in `src/lib/services/unit-laporan.ts` — a FAITHFUL port of the web route's lines ~56-96 (WIB/+7 math), refactored to take `now: Date` as a param (instead of reading the system clock) so it's deterministic + testable. Signature: `computePeriodRange(period: string, now: Date, dateFrom?: string, dateTo?: string): { start: Date; end: Date; periodLabel: string; dateFromIso: string; dateToIso: string }`.

- [ ] **Step 5: Run → PASS** (6 tests). If a test reveals the web's actual behavior differs from the assertion, match the web + update the test to lock the web's behavior (this is the refactor safety guard — the test must reflect what the web CURRENTLY does).
- [ ] **Step 6: tsc + commit**
```bash
npx tsc --noEmit
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/unit-laporan.ts src/__tests__/unit-laporan.test.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(unit-laporan): computePeriodRange pure helper + tests (Fase 7b T1)"
```

---

### Task 2: Extract `getUnitLaporanData` + refactor web route (behavior-preserving)

**Files:**
- Modify: `src/lib/services/unit-laporan.ts` (append `getUnitLaporanData` + the `UnitLaporanParams`/return interfaces; uses `computePeriodRange` from T1)
- Modify: `src/app/api/unit/[slug]/laporan/route.ts` (replace lines ~55-448 with a helper call)

- [ ] **Step 1: Read the full web route** (`src/app/api/unit/[slug]/laporan/route.ts`, ~449 lines). Identify the exact boundary: auth/access-control (lines 27-43) + param parse (45-53) STAY in the route; everything from the date-range compute (~55) through the response build (~448) MOVES into `getUnitLaporanData`.

- [ ] **Step 2: Implement `getUnitLaporanData`** in `src/lib/services/unit-laporan.ts` — a faithful move of the route's data logic (use `computePeriodRange` from T1 for the date math; keep the 3-model queries via `prismaRead`, the `usesStoreSales` split, the aggregation, the pagination, the build-response object). Signature per spec §7b-1: `getUnitLaporanData(p: UnitLaporanParams): Promise<UnitLaporanResult>`. **The return object's fields must match the route's current inline build EXACTLY** (field names, nesting, types) — this is the behavior-preservation contract.

- [ ] **Step 3: Refactor the web route** — keep imports for `auth`, `isSameUnit` (access control); replace the moved block with:
```ts
const data = await getUnitLaporanData({
  unitType, period, dateFrom: dateFromParam, dateTo: dateToParam,
  page, perPage, isExport, sortBy, sortOrder,
});
return NextResponse.json({ data });
```
Remove now-unused imports (e.g. `storeSaleUnitTypeFilter`, `unitTypeFilter`, `isAutoGeneratedPiutang`, `prismaRead` if no longer used directly by the route — they move to the helper).

- [ ] **Step 4: Verify behavior unchanged** — diff the helper's return shape against the old inline build (field-by-field). The web page (`/unit/[slug]/laporan`) must render identically. If any web laporan test exists, run it. (None expected — verify structurally.)
- [ ] **Step 5: tsc** (`npx tsc --noEmit`) — no new errors (watch for unused-import errors after the refactor; clean them up).
- [ ] **Step 6: Re-run T1 tests** (`npx vitest run src/__tests__/unit-laporan.test.ts`) — still pass.
- [ ] **Step 7: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/unit-laporan.ts "src/app/api/unit/[slug]/laporan/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "refactor(unit-laporan): extract getUnitLaporanData shared helper, web route uses it (Fase 7b T2)"
```

---

### Task 3: Mobile API `GET /api/mobile/reports/unit-laporan/[unitType]`

**File:** `src/app/api/mobile/reports/unit-laporan/[unitType]/route.ts`

- [ ] **Step 1: Implement** (gate + scope + helper call)
```ts
import { NextResponse } from "next/server";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../middleware";
import { canAccessUnit } from "@/lib/mobile-auth-scope";
import { getUnitLaporanData } from "@/lib/services/unit-laporan";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ unitType: string }> }) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    if (!["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }
    const { unitType } = await params;
    if (!canAccessUnit(user, unitType).allowed) {     // .allowed — ScopeDecision object (Fase 7a lesson)
      return NextResponse.json({ message: "Akses ditolak: unit di luar scope anda." }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const data = await getUnitLaporanData({
      unitType,
      period: searchParams.get("period") || "month",
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
      perPage: Math.min(200, Math.max(1, parseInt(searchParams.get("perPage") || "50", 10)) || 50),
      isExport: searchParams.get("export") === "true",
      sortBy: searchParams.get("sortBy") || "transactionDate",
      sortOrder: searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/mobile/reports/unit-laporan error:", err);
    return NextResponse.json({ message: "Gagal memuat laporan unit" }, { status: 500 });
  }
}
```
**Verify at impl time:** `getMobileUserWithScope` exposes `unitType` on the user (Fase 4b added `select:{id,branchId,unitType,memberId}` — confirm in `src/app/api/mobile/middleware.ts`). Import depth `../../../middleware` (3 levels: `unit-laporan/[unitType]/` → `mobile/`). `params: Promise` + `await params`.

- [ ] **Step 2: tsc** (`npx tsc --noEmit`) — no new errors.
- [ ] **Step 3: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/reports/unit-laporan/[unitType]/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): GET /reports/unit-laporan/[unitType] (Fase 7b T3)"
```

---

### Task 4: Screen `LaporanUnitScreen` (full V1 read-only)

**File:** `mobile/src/screens/operator/LaporanUnitScreen.tsx`

**Read first for conventions:** `mobile/src/screens/operator/LaporanCuciMobilScreen.tsx` (existing unit-laporan pattern), `LaporanPiutangGabunganScreen.tsx` (FlatList + cards + drill-down), `mobile/src/lib/api.ts`, `mobile/src/utils/log.ts`. **API:** `GET /api/mobile/reports/unit-laporan/{unitType}?period=&page=&perPage=` → `{ data: { unitType, periodLabel, summary, transactions, pagination, operationalExpenses, operationalIncomes } }` (axios → `res.data.data`).

**Implement (full V1, read-only):**
- **Unit selector** (top): horizontal chips of UNIT_TYPES (hardcode the list — same 10 keys as `constants/units.ts` UNIT_TYPES; NOT importable into RN). Tap → switch unit + re-fetch (reset page).
- **Period chips:** today / week / month (+ a month picker → custom month via `period=custom&dateFrom=&dateTo=`). Re-fetch on change.
- **Summary cards (universal):** Total Pendapatan (`summary.totalPendapatan`), Pengeluaran Ops (`summary.totalPengeluaran`), Laba Bersih (`summary.laba`), Jumlah Transaksi (`summary.totalTransaksi`).
- **Payment-method breakdown:** Tunai / QRIS / Potong Gaji (`summary.tunai/qris/potongGaji`).
- **Unit-specific (conditional):**
  - F&B (`resto`/`resto_cafe`/`coffe_latar`/`cafe_lsp`): Dine-In / Takeaway / Counter cards (`summary.dineIn/takeaway/counter` + counts + `takeawaySurchargeTotal`).
  - Cuci Mobil: Bagi Hasil 50/50 card (pendapatan kotor = `totalPendapatan`, bagian karyawan 50%, bagian koperasi 50%), Potongan SHU (`summary.potonganSHUMember`, `jumlahCuciAnggota`, `shuPerCuci`); vehicle plate in tx list (`transaction.vehiclePlate`).
  - Store units (`toko`/`resto`/`cafe_lsp`): HPP (`summary.totalHPP`) + Laba Bersih Akurat (`summary.netProfit`).
- **Transaction list (FlatList, infinite scroll):** date, description, member/pelanggan, method badge (cash/qris/salary_cut), amount, voided indicator (`status === "voided"`). `onEndReached` → page+1 when `page < totalPages`.
- **Operational expenses + incomes (collapsible):** date, description, method, amount.
- States: loading, error+retry, empty. `log.*` only.

- [ ] **Step 1: Read convention files + the helper return shape** (from `src/lib/services/unit-laporan.ts` after T2 — match field names EXACTLY).
- [ ] **Step 2: Implement.** Match existing screen styling (`formatRp`, `C`, cards, pickers, badges).
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) — no new errors. Grep `console.*` → 0.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/LaporanUnitScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): LaporanUnitScreen generic per-unit laporan (Fase 7b T4)"
```

---

### Task 5: Nav wiring

**Files:**
- Modify: `mobile/App.tsx` — register `LaporanUnit` route (lazy import + Screen).
- Modify: `mobile/src/screens/common/DashboardScreen.tsx` — add "Laporan Unit" `MenuItem` in the "Akuntansi & Keuangan" section, gated `{(userRole === "operator" || userRole === "admin" || userRole === "admin_sp") && (}`.

- [ ] **Step 1: Register the route** (mirror sibling Screen entries). Route name `LaporanUnit` must match `navigation.navigate("LaporanUnit")` exactly.
- [ ] **Step 2: Add the Dashboard menu item** (operator/admin/admin_sp gate).
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) — no new errors.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/App.tsx mobile/src/screens/common/DashboardScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): wire Laporan Unit nav (Fase 7b T5)"
```

---

## After T1–T5 → final opus review + push
1. Final whole-branch opus review over the Fase 7b base..HEAD — **critical: confirm the web route refactor is behavior-preserving** (response shape unchanged, web page unaffected) + the mobile route uses `.allowed` + the screen matches the helper's return shape.
2. Full test suite (`npm test`) — expect baseline + the new `unit-laporan` (computePeriodRange) tests.
3. `finishing-a-development-branch`: push `railway-migration` (deploys the mobile API + the web refactor). Screen ships via future EAS build #5.

## Notes for the final whole-branch review
- **Web route behavior-preservation** is the #1 risk — confirm the helper's return matches the old inline build field-by-field, and the web `/unit/[slug]/laporan` page still works.
- Confirm `canAccessUnit(...).allowed` (not boolean) on the mobile route.
- Confirm `getMobileUserWithScope` exposes `unitType` (canAccessUnit needs it).
- Confirm the screen reads `res.data.data.{summary, transactions, ...}` with exact field names from the helper.
- Confirm the broken `/api/mobile/reports/unit` + Cuci Mobil screen are untouched (backward compat).
- Confirm 0 raw `console.*` in the screen; `console.error` only in server routes.
