# Mobile Payroll Import — Design Spec (Fase 8c)

**Date:** 2026-07-05
**Status:** Design approved (shared-helper DRY extraction, full parity: pick→preview→commit + delete); pending spec review → plan
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build #5)
**Phase:** Fase 8c (third Fase 8 parity sub-feature, P0 money-moving). Follows Fase 8b. Web `POST /api/payroll/import` (preview/commit) + `DELETE /api/payroll`; mobile is view-only.

## Problem

Mobile operators can view payroll periods/slips but cannot **import** a payroll Excel (the biggest monthly money operation — triggers TAJIB/SP/barang deductions + syncs `Member.sisaGaji` for hundreds of members) nor **delete** a period from the phone. They must use the web.

## Goal

Mobile payroll-import parity: pick an Excel file → preview (parsed rows + member-match status) → commit (creates PayrollPeriod + batch PayrollSlip + syncs sisaGaji) + delete period. Built **DRY** by extracting the web import's parsing + commit logic into shared helpers that web + mobile both call. Operator-only.

## Approach (decided: shared helper + full parity)

Two new exports in `src/lib/services/payroll-import.ts`:
1. **`parsePayrollExcel(fileBuffer, sourceType)`** — async (does the member-match DB query): `XLSX.read` → find "POT GAJI"/"POTONGAN" sheet → `sheet_to_json` → header-row detect → 4-priority keyword column-map → member match (NRP exact → fuzzy name) → returns `{ rows, periodInfo: {periodName, periodMonth, periodYear}, counts, headers, sheetName, columnCount }`. The preview data.
2. **`commitPayrollPeriod(rows, periodInfo, sourceType, userId)`** — async `$transaction` (60s): duplicate-period guard (throw `PayrollImportError` 409) → create `PayrollPeriod` (aggregated totals) → batch `PayrollSlip` createMany (chunks of 100) → per-slip `Member.sisaGaji` sync → returns `{ periodId, periodName, counts }`.

The web `POST /api/payroll/import` is refactored to: session auth (operator) → read formData (file + mode + sourceType) → `parsePayrollExcel(buffer, sourceType)` → preview-return OR `commitPayrollPeriod(...)` → response + audit (behavior-preserving). The new mobile route does the same with mobile JWT auth.

**Why DRY:** the 4-priority keyword column-map + NRP/fuzzy member-match is ~180 lines of intricate logic. Duplicating it web+mobile means any column-keyword or matching tweak must land twice or payroll deductions silently drift. For a monthly money op, drift is the worse risk.

## Components

### 8c-1 — `parsePayrollExcel` shared helper

**File:** `src/lib/services/payroll-import.ts` (new; starts with `parsePayrollExcel` + `PayrollImportError` + interfaces; 8c-2 appends `commitPayrollPeriod`).

Faithful extraction of web import lines ~119-344 (everything AFTER formData-reading, BEFORE the preview/commit branching):
- `XLSX.read(buffer, { type: "buffer" })` → find sheet containing "POT GAJI"/"POTONGAN" (throw `PayrollImportError` 400 if none).
- `sheet_to_json(ws, { header: 1, raw: false, defval: "" })` → header-row detect (first 10 rows, NRP/NIP + NAMA) → 4-priority keyword column-map (SUMMARY → KOPERASI → IDENTITY → BRI/other) using the same `KOPERASI_FIELDS`/`SUMMARY_FIELDS`/`IDENTITY_FIELDS` dicts + `normalizeHeader()`.
- Per-row: extract nrp/nama/pangkat/gajiBersih + the koperasi pots + sisaGaji/terimaBersih. Member match: exact `Member.nrp || memberNo` → fuzzy name (uppercase, strip non-alpha, `===` or `includes`). `memberId` (null=unmatched). `tunkin` from matched member's `tunlesKinerja`. `status: "valid"|"no_match"`.
- Parse period (periodMonth/periodYear/periodName) from filename (Indonesian month name + 4-digit year).
- Return `{ rows: ParsedSlip[], periodInfo, counts: {totalRows, success, failed}, headers, sheetName, columnCount }`.
- The `KOPERASI_FIELDS`/`SUMMARY_FIELDS`/`IDENTITY_FIELDS` keyword dicts + `normalizeHeader()` + file-ext/sourceType constants + the 10MB limit constant MOVE to the helper module (shared).

### 8c-2 — `commitPayrollPeriod` shared helper

Faithful extraction of web import lines ~346-438:
- Duplicate check: `[periodMonth, periodYear, sourceType]` unique → throw `PayrollImportError` (409) if exists.
- `$transaction(timeout: 60000)`: create `PayrollPeriod` (periodName/month/year/sourceType/sourceFile/status="processed"/totalMembers/totalGaji/totalPotongan/createdById) → batch `PayrollSlip` createMany (chunks of 100) → per-slip `Member.sisaGaji` sync (where `memberId && sisaGaji > 0`).
- Returns `{ periodId, periodName, counts }`. (Audit stays in each route — web `logAuditFromRequest`, mobile `auditLog.create`.)

### 8c-3 — Web import route refactor (behavior-preserving)

**File:** `src/app/api/payroll/import/route.ts`. Keep: session auth (operator) + formData reading (file + mode + sourceType) + file validation (10MB/ext) + mode branching + response + audit + catch. Replace the inline parse + commit with:
```ts
const buffer = Buffer.from(await file.arrayBuffer());
const parsed = await parsePayrollExcel(buffer, sourceType);
if (mode === "preview") return NextResponse.json({ data: { mode: "preview", ...parsed, sourceFile: file.name, sourceType } });
// commit
const result = await commitPayrollPeriod(parsed.rows, parsed.periodInfo, sourceType, userId);
// audit (logAuditFromRequest) ... unchanged
return NextResponse.json({ data: { mode: "commit", ...result } });
```
**Response shapes byte-identical** to pre-refactor (preview: mode/sheetName/periodName/periodMonth/periodYear/sourceFile/sourceType/totalRows/success/failed/preview(first 50)/columnCount/headers; commit: mode/periodId/periodName/totalRows/success/failed). Remove now-unused constants/dicts from the route (moved to the helper).

### 8c-4 — Mobile import + delete APIs

**Files:**
- Create: `src/app/api/mobile/payroll/import/route.ts` (POST). Import `getMobileUserWithScope` from `../../middleware`, `parsePayrollExcel` + `commitPayrollPeriod` + `PayrollImportError` from `@/lib/services/payroll-import`.
- Create: `src/app/api/mobile/payroll/delete/route.ts` (POST `{ periodId }` — mobile uses POST-with-body for delete since mobile DELETE-with-body is awkward in RN; OR DELETE — confirm the mobile api client supports DELETE-with-body; if not, POST `/delete`). Actually: web uses `DELETE /api/payroll` with body `{periodId}`. Mobile mirror: `DELETE /api/mobile/payroll` with body `{periodId}` if the RN axios client supports it; else `POST /api/mobile/payroll/delete` `{periodId}`. Pick the one that works with `mobile/src/lib/api.ts`.

**POST `/api/mobile/payroll/import`**: gate `user.role === "operator"` (operator-ONLY — matches web; admin/admin_sp/kasir excluded) via `getMobileUserWithScope`. Read formData (file + mode + sourceType). File validation (10MB/ext — reuse the shared constants). `parsePayrollExcel(buffer, sourceType)` → preview/commit. Audit via `prisma.auditLog.create` (action IMPORT, module Payroll). Catch `PayrollImportError` → its status (400/409). `console.error` → 500.

**Delete (period)**: gate operator. Body `{ periodId }`. `prisma.payrollPeriod.delete({ where: { id } })` (cascades slips). **sisaGaji NOT reset** (parity with web — flagged as a separate web bug). Audit (action DELETE). Catch (P2025 → 404).

### 8c-5 — `PayrollImportScreen` + GajiPeriodeScreen actions

**Files:**
- Create: `mobile/src/screens/operator/PayrollImportScreen.tsx`.
- Modify: `mobile/src/screens/operator/GajiPeriodeScreen.tsx` (add Import + Delete buttons).

**PayrollImportScreen** (3-step flow mirroring the web dialog):
- **Step 1 (pick):** `expo-document-picker` (`.xlsx/.xls/.csv`, MIME types — mirror `ImportDataScreen`) + sourceType toggle (POLRES/POLSEK). "Preview" button.
- **Step 2 (preview):** POST multipart `file + mode=preview + sourceType` → show summary (total rows, matched, unmatched) + a scrollable table of the first 50 rows (NRP, nama, gajiBersih, potTajib, potSP, totalPotKoperasi, sisaGaji, status badge Cocok/no-match). "Import (N data)" commit button + "Batal".
- **Step 3 (result):** POST multipart `mode=commit` → success toast (periodName + counts) → goBack (refresh period list). Surface 409 (duplicate period), 400 (no sheet / bad file).
- **FormData pattern:** RN FormData with `{ uri, type, name }` for the file (mirror ImportDataScreen's XLSX upload). `api.post("/api/mobile/payroll/import", formData, { headers: { "Content-Type": "multipart/form-data" } })`. Long timeout (the import can take >15s for large files — set a 5-min timeout on these calls, like the web's AbortController).
- **GajiPeriodeScreen:** add "Import" button (operator-only) → navigate `PayrollImport`. Add "Delete" action per period card (operator-only) → confirm dialog → delete API → refresh list. `log.*` only.

### 8c-6 — Nav wiring
- `mobile/App.tsx`: register `PayrollImport` route.

## RBAC
- Both mobile endpoints: **operator-only** (matches web; admin/admin_sp/kasir excluded). No branch scope (PayrollPeriod has no branchId — org-wide payroll, like the existing mobile payroll GETs).

## Money-integrity (P0 — biggest monthly op)
- ✅ **DRY**: `parsePayrollExcel` + `commitPayrollPeriod` are the single sources for parsing + commit. Web + mobile both call them. No duplicated keyword-dicts/matching/commit logic.
- ✅ `$transaction(60s)` atomicity: create period + batch slips + sisaGaji sync all atomic (moved verbatim).
- ✅ Duplicate-period guard (409 on `[periodMonth,periodYear,sourceType]`).
- ✅ Web import behavior-preserving (opus-verified response byte-identical, like Fase 7b/8b).
- ✅ Audit on import + delete (mobile: auditLog.create).
- ⚠ **sisaGaji-not-reset-on-delete** (pre-existing WEB bug): deleting a period cascades slips but leaves `Member.sisaGaji` stale. Fase 8c **mirrors web** (doesn't reset) for parity + flags it as a SEPARATE web fix (out of scope — changing it would alter web money behavior).
- ⚠ Per-slip sisaGaji sync in a loop (not batched) — for very large files (500+ members) this could approach the 60s tx timeout. Pre-existing; preserved.

## Test plan
- **No unit tests for the helpers** in 8c (the parsing is XLSX-bound + DB-bound; not cleanly unit-testable without a fixture file). The behavior-preservation is the guard (web import response byte-identical before/after extraction, opus-verified). If a fixture Excel exists in the repo, a parsePayrollExcel test is possible — check + add if so.
- **Refactor safety:** web `POST /api/payroll/import` preview + commit response shapes byte-identical before/after (verify structurally; the web gaji page import dialog must work unchanged).
- **Manual (mobile):** pick a real GAJI Excel → preview (rows + match status) → commit (period created, slips visible in GajiSlipScreen, sisaGaji updated) → delete (period gone, slips gone). Duplicate period → 409. Non-operator → 403.

## Conventions / constraints
- `parsePayrollExcel` + `commitPayrollPeriod` in `src/lib/services/payroll-import.ts` — single source of truth. Web + mobile both call.
- **Web import refactor is mechanical + behavior-preserving.** Auth (operator session) + formData reading + file validation + mode branching + response + audit stay in the route; the parse + commit move to the helpers.
- `PayrollImportError` (typed) for 400 (no sheet/bad file) + 409 (duplicate period); routes map to HTTP status.
- Mobile route: `getMobileUserWithScope`; operator-only gate; `params` not needed (no [id]); formData reading via `request.formData()`.
- Mobile uses POST `/api/mobile/payroll/import` (multipart) + delete via POST `/api/mobile/payroll/delete` `{periodId}` (RN-friendly) OR DELETE — confirm against `mobile/src/lib/api.ts`.
- Long timeout on the import calls (5 min) — mirror web's AbortController.
- `log.*` only in the mobile screen; `console.error` in server routes.
- API deploys via Railway push; screen ships via EAS build #5.

## Open items to confirm at implementation time
- Whether `mobile/src/lib/api.ts` axios supports DELETE-with-body (for the delete route) — if not, use POST `/delete`.
- Whether a fixture Excel exists for a `parsePayrollExcel` unit test (check `prisma/seed*` or test fixtures).
- The exact RN FormData + multipart pattern in `ImportDataScreen` (mirror it verbatim).
- Confirm the mobile api client timeout can be overridden per-request (for the 5-min import calls) — if the default 15s is hardcoded, the import will time out.
