# Mobile Aset CRUD — Design Spec (Fase 8a)

**Date:** 2026-07-04
**Status:** Design approved (full CRUD + dispose; operator/admin/admin_sp; soft-delete + audit); pending spec review → plan
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build #5)
**Phase:** Fase 8a (first of three Fase 8 parity sub-features). Follows Fase 7b. Web has full Aset CRUD; mobile has a view-only list+detail + a **working POST create API that no UI invokes** (Fase 5 removed the dead "Add Aset" FAB).

## Problem

Mobile operators can view assets (`AsetListScreen` + `AsetDetailScreen`) but cannot create, edit, dispose, or delete them from the phone. Surprisingly, `POST /api/mobile/assets` (create) **already exists and works** — it just has no UI. Edit (PUT), dispose, and delete (soft) have no mobile API at all.

## Goal

Full mobile Aset management parity: **Create + Edit + Dispose + Delete**, all operator/admin/admin_sp gated, with audit logging + soft-delete. Wire up the existing create POST with a form UI, add PUT (edit) + POST (dispose) + DELETE (soft) endpoints, and the screens/dialogs to drive them.

## Approach

The existing `POST /api/mobile/assets` (create, transactional + audit, operator/admin/admin_sp) is reused as-is. Three new endpoints mirror the web `/api/aset/[id]` semantics (edit = PUT with `bookValue = cost - accumulatedDepreciation` recompute; dispose = set status/disposedDate/disposedValue; delete = soft-delete `deletedAt`) but **add the role gate the web lacks** (web `/api/aset/*` has NO role gate). One mode-aware form screen handles create + edit; dispose + delete are confirm dialogs on the detail screen. Asset has no `branchId`/`unitType` → no scope filter (same deviation as the existing mobile asset routes + Fase 4c note).

## Components

### 8a-1 — Edit/Dispose/Delete APIs (new) + existing Create (reused)

**Existing (DO NOT modify):** `POST /api/mobile/assets` (create) at `src/app/api/mobile/assets/route.ts` — accepts `{code, name, category, acquisitionDate, acquisitionCost, usefulLifeYears, location, description}`, dedups code, creates with `residualValue=0, accumulatedDepreciation=0, bookValue=cost, status="active"`, audit log. Gate: operator/admin/admin_sp via `getMobileUser`.

**New — `PUT /api/mobile/assets/[id]`** (edit) at `src/app/api/mobile/assets/[id]/route.ts`:
- Gate operator/admin/admin_sp (`getMobileUser`). `params: Promise<{id}>` + `await params`.
- 404 if asset missing or `deletedAt` set.
- Duplicate-code check if `code` changed.
- Body (all optional, only sent fields update): `code, name, category, acquisitionDate, acquisitionCost, usefulLifeYears, residualValue, accumulatedDepreciation, location, description`.
- Recompute `bookValue = acquisitionCost - accumulatedDepreciation`.
- Audit log (`UPDATE`, module Aset). `{ data: asset }` 200.

**New — `POST /api/mobile/assets/[id]/dispose`** at `src/app/api/mobile/assets/[id]/dispose/route.ts`:
- Gate operator/admin/admin_sp. `params: Promise<{id}>` + `await params`. 404 guard.
- Body: `{ disposedDate, disposedValue? }`. Set `status="disposed"`, `disposedDate`, `disposedValue`. (Reject if already disposed → 400.)
- Audit log (`DISPOSE`, module Aset). `{ data: asset }` 200.

**New — `DELETE /api/mobile/assets/[id]`** (soft delete) in `src/app/api/mobile/assets/[id]/route.ts` (same file as PUT):
- Gate operator/admin/admin_sp. 404 guard. Set `deletedAt = new Date()`.
- Audit log (`DELETE`, module Aset). `{ message }` 200.

(All three new endpoints use `getMobileUser` + the operator/admin/admin_sp role check, mirroring the existing POST. `params: Promise` + `await params`. `console.error` catch → 500. Decimal→Number on response, like the existing GET/POST.)

### 8a-2 — Form screen `AsetFormScreen` (create + edit, mode-aware)

**File:** `mobile/src/screens/operator/AsetFormScreen.tsx` (new). Single screen, `mode: "create" | "edit"` via route param (+ optional `assetId` for edit).
- **Fields (create):** `code`, `name`, `category` (dropdown: building/vehicle/equipment/furniture/computer/other — from schema comment), `acquisitionDate` (date picker), `acquisitionCost` (numeric), `usefulLifeYears` (numeric), `location?`, `description?`.
- **Fields (edit) — adds:** `residualValue`, `accumulatedDepreciation` + a **live `bookValue` preview** (`acquisitionCost - accumulatedDepreciation`). Pre-fill all fields from the asset (fetch via `GET /api/mobile/assets/[id]`).
- Create → `POST /api/mobile/assets` (existing). Edit → `PUT /api/mobile/assets/[id]`. Success → toast + go back (refresh list).
- Validation: required fields (code/name/category/acquisitionDate/acquisitionCost/usefulLifeYears), numeric > 0. `log.*` only.

### 8a-3 — Dispose + Delete dialogs on `AsetDetailScreen`

**File:** `mobile/src/screens/operator/AsetDetailScreen.tsx` (modify). Add action buttons (operator/admin/admin_sp):
- **Edit** → navigate to `AsetFormScreen` (edit mode, assetId).
- **Dispose** → dialog: `disposedDate` (date picker, default today) + `disposedValue?` (numeric) → `POST /api/mobile/assets/[id]/dispose`. Confirm prompt. Hide if already disposed.
- **Delete** → confirm dialog ("Yakin hapus aset ini? Aksi ini soft-delete.") → `DELETE /api/mobile/assets/[id]`. On success → toast + go back to list.

### 8a-4 — List FAB + nav wiring

- **`AsetListScreen.tsx`** (modify): add an "Add" FAB (operator/admin/admin_sp) → navigate to `AsetFormScreen` (create mode). (Re-instates the entry Fase 5 removed — but now pointing at a real screen.)
- **`mobile/App.tsx`**: register `AsetForm` route (lazy import + Screen).

## RBAC
- All write endpoints (existing POST + new PUT/dispose/DELETE): operator/admin/admin_sp via `getMobileUser`. **Mobile adds the gate the web `/api/aset/*` lacks.**
- No `branchId`/`unitType` scope (Asset has neither — deviation, documented in the existing mobile asset routes + Fase 4c).
- Dashboard/AsetList gate stays operator/admin/admin_sp (existing).

## Money-integrity
- **Low.** Aset CRUD touches no ledger balances, no cash/bank, no loan/savings. `bookValue = cost - accumulatedDepreciation` is a simple recompute. Soft-delete preserves history (`deletedAt`). All writes audit-logged. No atomic multi-entity transactions needed beyond the existing POST's audit+create pattern.

## Test plan
- **No unit tests** for 8a — the logic is mechanical CRUD orchestration (no pure helper worth extracting; `bookValue` is one line). The existing POST has none either; match that.
- **Manual:** create an asset (form → POST → appears in list); edit it (change cost/accDep → bookValue updates); dispose (status→disposed, disposedDate/Value set, dispose button hides); delete (soft-delete → disappears from list, audit logged); duplicate-code rejected; kasir gets 403 + no FAB/buttons.

## Conventions / constraints
- Reuse the existing `POST /api/mobile/assets` — do NOT modify it (the create form sends exactly its accepted fields).
- `getMobileUser` (NOT `getMobileUserWithScope`) — Asset has no branchId/unitType, so no scope needed; matches existing asset routes.
- `params: Promise<...>` + `await params` in the new `[id]` routes (Next.js async-params).
- Decimal→Number on all responses (match existing GET/POST).
- `log.*` only in screens; `console.error` in server routes.
- Web `/api/aset/*` UNTOUCHED (mobile-only mirror + gate).
- API deploys via Railway push; screens ship via EAS build #5.

## Open items to confirm at implementation time
- Confirm `getMobileUser` (not `getMobileUserWithScope`) is the right import for the new routes (match the existing `assets/route.ts` which uses `getMobileUser` from `../middleware`; the `[id]` routes are one level deeper → `../../middleware`).
- The mobile `GET /api/mobile/assets/[id]` (detail) returns the asset shape the edit form pre-fills — confirm its fields (code/name/category/acquisitionDate/acquisitionCost/usefulLifeYears/residualValue/accumulatedDepreciation/bookValue/location/description/status).
