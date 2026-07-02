# Mobile Piutang Gabungan — Design Spec (Fase 6)

**Date:** 2026-07-03
**Status:** Design approved (CSV export, server-side search, operator+admin_sp); pending spec review → plan
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build)
**Phase:** Fase 6. Follows Fase 5 (Play Store polish, build #2 done). Web has had Piutang Gabungan since 2026-05-01; mobile has zero implementation (advertised in `mobile/PLAY-STORE-RELEASE-GUIDE.md`, never built).

## Problem

`mobile/PLAY-STORE-RELEASE-GUIDE.md` advertises a "Piutang Gabungan" feature that does not exist in the mobile app. The web has it (`/laporan/piutang-gabungan` + `GET /api/reports/piutang-gabungan`, operator-only) — a consolidated per-member receivables report aggregating Toko + Unit + Simpan Pinjang. Mobile operators currently have no way to see who owes the koperasi money across all three sources while in the field.

## Goal

Ship the mobile mirror: a `LaporanPiutangGabunganScreen` + `GET /api/mobile/reports/piutang-gabungan` (list) + `GET /api/mobile/reports/piutang-gabungan/[memberId]` (drill-down detail), with summary cards, server-side search, per-member drill-down, and CSV export via the OS share sheet. Access: operator + admin_sp (web parity). No new Prisma models.

## Approach (decided: A — pure helper + split endpoints)

Extract the web's proven aggregation into a **pure, unit-tested helper**, then expose two mobile endpoints (list + lazy drill-down) rather than one fat endpoint. Rationale: lazy-loads detail only on tap (saves mobile data/battery), matches the mobile list+detail idiom, and the helper is the single source of truth for the per-member math (the bug-prone part).

Rejected: (B) single endpoint with embedded detail = over-fetches every member's loans+tx; (C) list + reuse scattered existing endpoints = no single source of truth for a member's piutang row.

## Components

### 6a — Pure helper `src/lib/services/piutang-gabungan.ts` (TDD)

Single source of truth for the aggregation. No Prisma — takes already-fetched datasets, returns the list + totals. Mirrors the web route's math exactly.

```ts
// Toko-like units (salary_cut from these → "Piutang Toko"); all other unitTypes → "Piutang Unit".
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
  angsuranKe: string;   // `${nextInstallmentNo}/${tenorMonths}` or "-"
  loanCount: number;
}

export interface PiutangAggregation {
  piutangList: PiutangItem[];   // FULL list (only members with any piutang), seq numbered, sorted by name
  totalAnggota: number;         // = piutangList.length
  totalPiutangToko: number;
  totalPiutangUnit: number;
  totalPiutangSPPokok: number;
  totalPiutangSPJasa: number;
  grandTotal: number;
}

interface HelperMember { id: number; name: string; nrp: string | null; memberNo: string | null; pangkat: string | null; category: string | null; kesatuan: string | null; }
interface HelperUnitAgg { memberId: number | null; unitType: string | null; _sum: { amount: Prisma.Decimal | null }; }
interface HelperLoan { memberId: number; loanNo: string; principalOutstanding: Prisma.Decimal; interestOutstanding: Prisma.Decimal; tenorMonths: number; disbursementDate: Date | null; schedules: { installmentNo: number }[]; }

export function aggregatePiutangGabungan(args: {
  members: HelperMember[];
  unitTxAgg: HelperUnitAgg[];
  activeLoans: HelperLoan[];
}): PiutangAggregation;
```

**Aggregation rules (mirror web `api/reports/piutang-gabungan/route.ts`):**
1. Build `tokoMap` / `unitMap` (memberId → sum) from `unitTxAgg`: if `unitType` in `TOKO_UNIT_TYPES` → toko, else unit. Skip null memberId.
2. Build `spMap` (memberId → {pokok, jasa, angsuranKe, loanCount}) from `activeLoans`: skip if `principalOutstanding<=0 && interestOutstanding<=0`; on duplicate memberId accumulate pokok+jasa+loanCount (keep first loan's angsuranKe); `angsuranKe = schedules[0] ? "${schedules[0].installmentNo}/${tenorMonths}" : "-"`.
3. For each member (already sorted by name asc by the query), skip unless has toko OR unit OR sp. `seq` increments only for included members. `nrp = member.nrp || member.memberNo`; `pangkat = member.pangkat || member.category || "-"`; `kesatuan = member.kesatuan || "-"`. `totalPiutang = toko+unit+spPokok+spJasa`.
4. Totals = reduce over full `piutangList`. `totalAnggota = piutangList.length`.

### 6b — List API `GET /api/mobile/reports/piutang-gabungan`

**File:** `src/app/api/mobile/reports/piutang-gabungan/route.ts`

**Gate (role-gate only — NO branchListFilter/unitListFilter; org-wide consolidated):**
```ts
import { getMobileUserWithScope } from "../../../middleware";
const user = await getMobileUserWithScope(request);
if (!user || !["operator", "admin_sp"].includes(user.role)) {
  return NextResponse.json({ message: "Hanya Operator/Admin SP yang dapat mengakses laporan ini" }, { status: 403 });
}
```

**Query params:** `?page=&perPage=&search=&export=&format=`
- `page` (default 1), `perPage` (default 25, clamped 1..100), `search` (optional, case-insensitive contains on nama/nrp/pangkat/kesatuan), `export=true` (return ALL rows as JSON, no pagination — web parity), `format=csv` (return the full set as a CSV text body via `buildPiutangCSV`, sanitized — used by the mobile share-sheet export).

**Prisma fetches (mirror web exactly):**
1. `member.findMany({ where: { status: "active", deletedAt: null }, select: {id,name,nrp,memberNo,pangkat,category,kesatuan}, orderBy: { name: "asc" } })`.
2. `unitTransaction.groupBy({ by: ["memberId","unitType"], where: { memberId: { in: memberIds }, paymentMethod: "salary_cut", isPaid: false, status: "completed" }, _sum: { amount: true } })`.
3. `loan.findMany({ where: { memberId: { in: memberIds }, status: "active" }, select: { memberId, loanNo, principalOutstanding, interestOutstanding, tenorMonths, disbursementDate, schedules: { where: { status: { in: ["pending","partial","overdue"] } }, select: { installmentNo: true }, orderBy: { installmentNo: "asc" }, take: 1 } } })`.

**Response (`{ data }` envelope — matches sibling mobile reports):**
```ts
{
  data: {
    piutangList: PiutangItem[],            // export=true → full; else paginated
    totalAnggota, totalPiutangToko, totalPiutangUnit, totalPiutangSPPokok, totalPiutangSPJasa, grandTotal,
    pagination?: { page, perPage, totalItems, totalPages }   // omitted when export=true
  }
}
```
**Totals are ALWAYS the full-set aggregates** (search/pagination affect only `piutangList` rows, not the totals) — mirrors web. Apply `search` filter + `slice()` for pagination to the helper's full `piutangList`; compute `totalPages = max(1, ceil(filtered.length / perPage))`.

**Error:** catch → `{ message: "Gagal generate laporan piutang gabungan" }` 500. Empty members → empty-list response with zero totals (no 500).

### 6c — Detail API `GET /api/mobile/reports/piutang-gabungan/[memberId]` (mobile-only enhancement; web has no drill-down)

**File:** `src/app/api/mobile/reports/piutang-gabungan/[memberId]/route.ts`

**Gate:** same operator/admin_sp role-gate as 6b. Verify `memberId` parses to a number and the member exists (`status: active, deletedAt: null`) — else 404.

**Returns** (lazy-loaded on tap):
```ts
{
  data: {
    member: { id, name, nrp, pangkat, kesatuan },
    loans: Array<{ loanNo, angsuranKe, pokok, jasa, tenorMonths, disbursementDate }>,  // active loans, principalOutstanding+interestOutstanding
    transactions: Array<{ transactionNo, date, unitType, description, amount, source: "toko"|"unit" }>,  // unpaid salary_cut UnitTransactions, newest first
    totals: { piutangToko, piutangUnit, piutangSPPokok, piutangSPJasa, total }   // this member's row, recomputed server-side
  }
}
```
- `loans`: `loan.findMany({ where: { memberId, status: "active" }, select: { loanNo, principalOutstanding, interestOutstanding, tenorMonths, disbursementDate, schedules: {...next installment...} } })` → map to `{ loanNo, angsuranKe, pokok: principalOutstanding, jasa: interestOutstanding, tenorMonths, disbursementDate }`.
- `transactions`: `unitTransaction.findMany({ where: { memberId, paymentMethod: "salary_cut", isPaid: false, status: "completed" }, select: { transactionNo, transactionDate, unitType, description, amount }, orderBy: { transactionDate: "desc" } })` → tag `source` via `TOKO_UNIT_TYPES`. (`transactionDate` is the `@db.Date` business date — verified in schema; do not use `createdAt`.)
- `totals`: reuse the helper by passing a single-member `members` array + the member's unitTxAgg + loans, OR compute inline. Reuse helper to guarantee the row matches the list row exactly.

### 6d — Screen `mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx`

Mirror the existing mobile Laporan screens' style (see `LaporanPinjamanScreen.tsx`, `LaporanSimpananScreen.tsx` for conventions: `api` client, `log.*` logger, `C` colors, FlatList, RefreshControl). Structure:
- **Summary cards** (horizontal scroll or grid): Total Anggota, Piutang Toko (orange), Piutang Unit (purple), Piutang SP (cyan = pokok+jasa), Grand Total (emerald) — mirror web card semantics.
- **Search bar** → debounced server-side `?search=` (re-fetches list; totals stay global).
- **FlatList** of members (infinite-scroll pagination via `?page=`). Row card: nama + nrp + pangkat header; body grid Piutang Toko / Unit / Pokok SP / Jasa SP; bold Total footer. **Tap row → drill-down.**
- **Drill-down:** a modal (or pushed detail screen) that calls the `[memberId]` endpoint; shows the member's active loans (loanNo, angsuranKe, pokok, jasa) + unpaid salary_cut transactions (date, unit, description, amount) + the member's totals. Loading + empty states.
- **Export button** (header) → CSV via share sheet (see 6e). Disabled while exporting; toast on success/failure.
- **States:** loading, error (retry), empty ("Tidak ada piutang").
- Use `log.*` from `@/utils/log` (Fase 5 logger) — never raw `console.*`.

### 6e — CSV export (expo-file-system + expo-sharing)

The CSV is built **server-side** by `buildPiutangCSV` (Task 2, unit-tested incl. formula-injection case) and served via `?format=csv`. The mobile screen is a thin client (no CSV/sanitize logic in RN):
1. Fetch `?format=csv` → CSV text body (full set, sanitized).
2. Write to `FileSystem.documentDirectory + "piutang-gabungan-<YYYYMMDD>.csv"` via `expo-file-system` `writeAsStringAsync`.
3. `Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export Piutang Gabungan" })` via `expo-sharing`.

Columns (mirror web `exportColumns`): `No, NRP, Pangkat, Kesatuan, Nama, Piutang Toko, Piutang Unit, Pokok Pinjaman, Jasa Pinjaman, Total Piutang` + a final `TOTAL` row. Formula-injection sanitization (leading `= + @ -` → `'` prefix) lives in `buildPiutangCSV` (server, tested) — not duplicated in the screen.

### 6f — Navigation wiring

- **`mobile/App.tsx`:** register `LaporanPiutangGabungan` + `PiutangGabunganDetail` routes in the navigator (mirror how `LaporanSHU` / `Neraca` are wired).
- **`DashboardScreen.tsx`:** add a "Piutang Gabungan" `MenuItem` in the "Akuntansi & Keuangan" `CollapsibleSection`, **gated `{(userRole === "operator" || userRole === "admin_sp") && (`** (matches the API gate; kasir/admin don't see it). Icon e.g. `receipt-outline` or `people-circle-outline`.

## Test plan

**Unit (Vitest) — `src/__tests__/piutang-gabungan.test.ts`:**
- `aggregatePiutangGabungan`: (a) member with only toko piutang → correct toko total, unit/SP 0; (b) member with only unit (non-toko unitType) piutang → unit total; (c) member with active loan → spPokok+spJasa, angsuranKe `${n}/${tenor}`; (d) member with multiple loans → accumulated pokok+jasa+loanCount; (e) member with zero piutang → excluded from list; (f) toko-vs-unit split via `TOKO_UNIT_TYPES` (e.g. `resto_cafe`→toko, `cuci_mobil`→unit); (g) totals = sum over included members; (h) `nrp` falls back to `memberNo` when nrp null; (i) `pangkat` falls back to category then "-".
- `buildPiutangCSV`: header correct; one row per item; TOTAL row; **formula-injection sanitization** (a nama/nrp starting with `=`/`+`/`@`/`-` gets `'` prefix).

**Manual:** screen renders cards + list; search filters; pagination loads more; drill-down shows loans+tx; CSV shares via OS sheet and opens in Excel/Sheets; operator & admin_sp get 200, kasir & admin get 403 + no Dashboard menu.

## Conventions / constraints

- **Repo testable-UI pattern:** pure logic in `src/lib/services/piutang-gabungan.ts` (+ `buildPiutangCSV`), unit-tested; route = orchestration; screen = presentation. UI not unit-tested directly.
- **RBAC:** role-gate only (operator/admin_sp). This is an org-wide consolidated report — do NOT add `branchListFilter`/`unitListFilter` (same deviation class as `reports/financial`). Verify the gate against this spec's code, not memory claims (Fase 5 lesson).
- **Money:** `Prisma.Decimal` → `Number(...)` at the helper boundary; all sums in `Number`. `formatRp` on screen.
- **No new Prisma models.** No new npm deps (expo-file-system + expo-sharing already present).
- **Logger:** `log.*` only (Fase 5). No raw `console.*` in new code.
- **Web route untouched** — do NOT refactor the working web `api/reports/piutang-gabungan` to use the helper (out of scope; avoid risk). Helper is mobile's source of truth; web could adopt later.
- Mobile UI deploys via a future EAS build; API deploys via Railway push. `branch` = `railway-migration`.

## Schema facts (verified against `prisma/schema.prisma` 2026-07-03)
- `UnitTransaction`: `transactionNo` (unique), `memberId` Int?, `unitType`, `description`, `amount` Decimal(15,2), `transactionDate` @db.Date, `paymentMethod` (cash/qris/salary_cut), `isPaid` Bool, `saleNo` String?, `status` (completed/pending_void/voided). Detail list uses `transactionDate` (desc) as the business date.
- `Member`: HAS `deletedAt` (DateTime?) and `status` (default "active") + classification (`pangkat`, `golongan`, `kesatuan`, `employeeType`, `noRekening`, `category`). Keep the `status: "active", deletedAt: null` member predicate (mirrors web).
- `Loan`: `status` (active/paid_off/written_off), `principalOutstanding`, `interestOutstanding`, `tenorMonths`, `disbursementDate`. `LoanSchedule`: `status` (pending/partial/paid/overdue), `installmentNo`.
