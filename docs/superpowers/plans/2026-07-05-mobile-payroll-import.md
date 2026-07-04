# Mobile Payroll Import — Implementation Plan (Fase 8c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile payroll-import parity — pick Excel → preview (parsed rows + member-match) → commit (creates PayrollPeriod + batch PayrollSlip + sisaGaji sync) + delete period. Built DRY via shared `parsePayrollExcel` + `commitPayrollPeriod` that web + mobile both call.

**Architecture:** Extract the web `POST /api/payroll/import` core (Excel parsing + member match + the $transaction commit) into `src/lib/services/payroll-import.ts`; refactor the web route to call it (behavior-preserving); new mobile route (operator-only JWT) calls the same helpers; mobile screen + nav. Biggest monthly money op — the shared helpers are the single source of truth.

**Tech Stack:** Next.js route handlers, Prisma 6, XLSX (sheetjs), Expo 55 / RN 0.83, expo-document-picker.

**Spec:** `docs/superpowers/specs/2026-07-05-mobile-payroll-import-design.md`

## Global Constraints (verbatim from spec)

- **DRY:** `parsePayrollExcel` + `commitPayrollPeriod` + the keyword dicts (`KOPERASI_FIELDS`/`SUMMARY_FIELDS`/`IDENTITY_FIELDS`) + `normalizeHeader()` + file constants (10MB, exts, sourceTypes) in `src/lib/services/payroll-import.ts` = single source of truth. Web + mobile both call. No duplicated parsing/matching.
- **Web import refactor is MECHANICAL + BEHAVIOR-PRESERVING.** Auth (operator session) + formData reading (file + mode + sourceType) + file validation + mode branching + response + audit stay in the route; the parse + commit move to the helpers. Response shapes byte-identical (preview: mode/sheetName/periodName/periodMonth/periodYear/sourceFile/sourceType/totalRows/success/failed/preview(first 50)/columnCount/headers; commit: mode/periodId/periodName/totalRows/success/failed).
- **RBAC:** operator-ONLY on both web (already) + mobile (matches web; admin/admin_sp/kasir excluded). No branch scope (PayrollPeriod has no branchId — org-wide).
- `PayrollImportError` (typed Error w/ `statusMessage` + `statusCode`) for 400 (no sheet/bad file/sourceType) + 409 (duplicate period); routes map to the HTTP status.
- **sisaGaji NOT reset on delete** — parity with web (pre-existing web bug, flagged separate; do NOT fix in 8c).
- Mobile route: `getMobileUserWithScope`; `request.formData()` for multipart; `console.error` → 500.
- Mobile delete: confirm `mobile/src/lib/api.ts` supports DELETE-with-body; if not, use `POST /api/mobile/payroll/delete` `{ periodId }`.
- **Timeout:** the import can take >15s (large files). The mobile screen MUST set a per-request 5-min timeout on the preview + commit calls (confirm `api.ts` allows per-request timeout override; if the 15s default is hardcoded, FIX that or the import times out).
- `log.*` only in the mobile screen; `console.error` in server routes.
- `branch` = `railway-migration` (API auto-deploys on push; screen ships via EAS build #5).

---

### Task 1: `parsePayrollExcel` + `commitPayrollPeriod` shared helpers

**File:** `src/lib/services/payroll-import.ts` (new). No test file (parsing is XLSX/DB-bound — confirm no fixture Excel exists; if one does in `prisma/` or test fixtures, add a parsePayrollExcel smoke test, else skip).

- [ ] **Step 1: Read the full web import** (`src/app/api/payroll/import/route.ts`, ~440 lines). Identify the boundary: auth (106-113) + formData reading (119-122) + file validation (129-141) STAY in the route. The sheet-find + sheet_to_json + header-detect + column-map + member-match + period-parse (~149-344) → `parsePayrollExcel`. The duplicate-check + $transaction create+slips+sisaGaji (~346-438) → `commitPayrollPeriod`. The keyword dicts + `normalizeHeader()` + file constants (lines ~9-102) → move to the helper module.

- [ ] **Step 2: Implement `parsePayrollExcel(fileBuffer: Buffer, sourceType: string, sourceFileName: string)`** — async (does the member-match DB query). Faithful move of web ~149-344:
  - `XLSX.read(fileBuffer, { type: "buffer" })` → find sheet whose name contains "POT GAJI" or "POTONGAN" → throw `PayrollImportError(400)` if none.
  - `sheet_to_json(ws, { header: 1, raw: false, defval: "" })` → header-row detect (first 10 rows, row containing NRP/NIP + NAMA).
  - 4-priority keyword column-map (SUMMARY → KOPERASI → IDENTITY → BRI/other) using the moved dicts + `normalizeHeader()`.
  - Per-row extract + member match (exact `Member.nrp || memberNo` → fuzzy name) + `tunkin` from `member.tunlesKinerja` + `status`.
  - Period parse from `sourceFileName` (Indonesian month name + 4-digit year).
  - Return `{ rows: ParsedSlip[], periodInfo: { periodName, periodMonth, periodYear }, counts: { totalRows, success, failed }, headers, sheetName, columnCount }`.

- [ ] **Step 3: Implement `commitPayrollPeriod(rows, periodInfo, sourceType, sourceFileName, userId)`** — async `$transaction(timeout: 60000)`. Faithful move of web ~346-438:
  - Duplicate check: existing `[periodMonth, periodYear, sourceType]` → throw `PayrollImportError(409, "Period ... sudah ada")`.
  - Aggregate totals (totalMembers/totalGaji/totalPotongan from rows).
  - Create `PayrollPeriod` (status "processed", createdById=userId, sourceFile=sourceFileName).
  - Batch `payrollSlip.createMany` (chunks of 100).
  - Per-slip `member.update({ data: { sisaGaji } })` where `memberId && sisaGaji > 0`.
  - Return `{ periodId, periodName, counts: { totalRows, success, failed } }`.

- [ ] **Step 4: Move constants** — `KOPERASI_FIELDS`, `SUMMARY_FIELDS`, `IDENTITY_FIELDS`, `normalizeHeader()`, MAX_FILE_SIZE (10MB), ALLOWED_EXTENSIONS, ALLOWED_SOURCES, DEFAULT_SISA_REKENING → the helper module (export the ones the routes still need, e.g. MAX_FILE_SIZE/ALLOWED_EXTENSIONS for validation).

- [ ] **Step 5: tsc** (`npx tsc --noEmit`) → no new errors.
- [ ] **Step 6: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/payroll-import.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(payroll): parsePayrollExcel + commitPayrollPeriod shared helpers (Fase 8c T1)"
```

---

### Task 2: Web import route refactor (HIGHEST RISK — behavior-preserving)

**File:** `src/app/api/payroll/import/route.ts` (refactor).

- [ ] **Step 1: Read the full route.** Boundary: session auth (106-113) + formData reading (119-122) + file validation (129-141) + mode branching + response + audit + catch STAY. The parse + commit move to the helpers (T1).
- [ ] **Step 2: Refactor** — replace the inline parse + commit with:
```ts
const file = formData.get("file") as File;
const mode = formData.get("mode") || "preview";
const sourceType = (formData.get("sourceType") || "polres") as string;
// file validation (10MB/ext/sourceType) — keep, using moved constants
const buffer = Buffer.from(await file.arrayBuffer());
const parsed = await parsePayrollExcel(buffer, sourceType, file.name);
if (mode === "preview") {
  return NextResponse.json({ data: { mode: "preview", sheetName: parsed.sheetName, periodName: parsed.periodInfo.periodName, periodMonth: parsed.periodInfo.periodMonth, periodYear: parsed.periodInfo.periodYear, sourceFile: file.name, sourceType, totalRows: parsed.counts.totalRows, success: parsed.counts.success, failed: parsed.counts.failed, preview: parsed.rows.slice(0, 50), columnCount: parsed.columnCount, headers: parsed.headers } });
}
// commit
const userId = Number((session.user as any).id);
const result = await commitPayrollPeriod(parsed.rows, parsed.periodInfo, sourceType, file.name, userId);
// audit (logAuditFromRequest) — unchanged shape
return NextResponse.json({ data: { mode: "commit", periodId: result.periodId, periodName: result.periodName, totalRows: result.counts.totalRows, success: result.counts.success, failed: result.counts.failed } });
```
Remove now-unused dicts/`normalizeHeader`/constants from the route (moved to helper). **Response shapes byte-identical.**
- [ ] **Step 3: Verify behavior unchanged** — diff the helper's return + the route's response vs the old inline build. The web gaji import dialog must work unchanged.
- [ ] **Step 4: tsc** (`npx tsc --noEmit`) — no new errors (clean unused imports).
- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/app/api/payroll/import/route.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "refactor(payroll): web import uses shared helpers (Fase 8c T2)"
```

---

### Task 3: Mobile import + delete APIs

**Files:**
- Create: `src/app/api/mobile/payroll/import/route.ts` (POST).
- Create: `src/app/api/mobile/payroll/delete/route.ts` (POST `{ periodId }`) — confirm whether DELETE-with-body works in the RN client; if not, POST `/delete` is the mobile-friendly choice (the screen calls whichever the implementer picks).

- [ ] **Step 1: POST `/api/mobile/payroll/import`** — gate `user.role === "operator"` via `getMobileUserWithScope` from `../../middleware`; `request.formData()` (file + mode + sourceType); file validation (reuse moved MAX_FILE_SIZE/ALLOWED_EXTENSIONS); `parsePayrollExcel(buffer, sourceType, file.name)` → preview/commit; audit `auditLog.create` (action "IMPORT", module "Payroll"); catch `PayrollImportError` → its `statusCode` (400/409); `console.error` → 500. Same response shapes as the web route.
- [ ] **Step 2: Delete** — gate operator; body `{ periodId }`; `prisma.payrollPeriod.delete({ where: { id } })` (cascades slips); **sisaGaji NOT reset** (parity); audit (action "DELETE"); P2025 → 404.
- [ ] **Step 3: Verify** import depth (`../../middleware`), `await`/async, tsc clean.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/payroll/import/route.ts" "src/app/api/mobile/payroll/delete/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): POST /payroll/import + delete (Fase 8c T3)"
```

---

### Task 4: `PayrollImportScreen` + GajiPeriodeScreen actions

**Files:**
- Create: `mobile/src/screens/operator/PayrollImportScreen.tsx`.
- Modify: `mobile/src/screens/operator/GajiPeriodeScreen.tsx` (Import + Delete buttons).

**Read first:** `mobile/src/screens/operator/ImportDataScreen.tsx` (the proven DocumentPicker + RN FormData + multipart POST pattern — MIRROR it verbatim), `GajiPeriodeScreen.tsx` (existing period list), `mobile/src/lib/api.ts` (confirm per-request timeout support for the 5-min import calls), `mobile/src/utils/log.ts`.

**PayrollImportScreen (3-step):**
- **Pick:** `expo-document-picker` (`.xlsx/.xls/.csv` MIME) + sourceType toggle (POLRES/POLSEK) + "Preview" button.
- **Preview:** POST multipart `file + mode=preview + sourceType` (5-min timeout) → summary (total/matched/unmatched) + scrollable table of first 50 rows (NRP, nama, gajiBersih, potTajib, potSP, totalPotKoperasi, sisaGaji, status badge). "Import (N data)" commit + "Batal".
- **Commit:** POST multipart `mode=commit` (5-min timeout) → success toast (periodName + counts) → goBack. Surface 409 (duplicate), 400 (no sheet/bad file).
- **FormData:** RN FormData `{ uri, type, name }` for file (mirror ImportDataScreen). `api.post("/api/mobile/payroll/import", formData, { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 })`.
- **Timeout:** confirm `api.ts` accepts a per-request `timeout` (if not, add it — the default 15s WILL time out a real import).
- **GajiPeriodeScreen:** add "Import" button (operator-only via `userRole` useMemo) → navigate `PayrollImport`. Add "Delete" action per period card (operator-only) → confirm dialog → delete API → refresh. `log.*` only.

- [ ] **Step 1: Read ImportDataScreen (mirror the FormData pattern) + api.ts (timeout support).**
- [ ] **Step 2: Implement PayrollImportScreen + GajiPeriodeScreen buttons.**
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/PayrollImportScreen.tsx mobile/src/screens/operator/GajiPeriodeScreen.tsx mobile/src/lib/api.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): PayrollImportScreen + GajiPeriode import/delete (Fase 8c T4)"
```

---

### Task 5: Nav wiring

**Files:** `mobile/App.tsx` — register `PayrollImport` route (lazy import + Screen). Route name matches `navigation.navigate("PayrollImport")` exactly. tsc clean. Commit.

---

## After T1–T5 → final opus review + push
1. Final opus review — **#1 check: web import behavior-preservation** (preview + commit response byte-identical, gaji dialog unchanged) + shared helpers are the single source + mobile operator-only gate + timeout.
2. Full test suite (`npm test`) — expect baseline (no new unit tests unless a fixture Excel surfaced).
3. `finishing-a-development-branch`: push `railway-migration` (deploys mobile routes + web refactor). Screen ships via EAS build #5.

## Notes for the final whole-branch review
- **Web import behavior-preservation (#1):** preview + commit response byte-identical; web gaji page import dialog works unchanged.
- Confirm the keyword dicts + `normalizeHeader()` + member-match logic moved VERBATIM (no parsing drift — money-critical).
- Confirm mobile operator-only gate; `PayrollImportError` → correct HTTP status (400/409).
- Confirm sisaGaji NOT reset on delete (parity) + flagged as separate web bug.
- Confirm the mobile screen sends multipart correctly (RN FormData) + the 5-min timeout works (else import times out).
- Confirm no raw `console.*` in the screen; `console.error` only in server routes.
- Confirm web `POST /api/payroll/import` + `DELETE /api/payroll` auth/access-control preserved.
