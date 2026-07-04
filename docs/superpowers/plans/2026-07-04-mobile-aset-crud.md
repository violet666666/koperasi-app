# Mobile Aset CRUD — Implementation Plan (Fase 8a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full mobile Aset management parity — Create (reuse existing POST) + Edit (PUT) + Dispose + Delete (soft), operator/admin/admin_sp gated, with audit logging.

**Architecture:** Existing `POST /api/mobile/assets` is reused unmodified. Three new endpoints mirror web `/api/aset/[id]` semantics (edit recompute `bookValue`; dispose sets status/disposedDate/disposedValue; delete soft-deletes) + add the role gate the web lacks. One mode-aware form screen (create+edit); dispose+delete are dialogs on the detail screen. No new Prisma models, no ledger impact.

**Tech Stack:** Next.js route handlers, Prisma 6, Expo 55 / RN 0.83.

**Spec:** `docs/superpowers/specs/2026-07-04-mobile-aset-crud-design.md`

## Global Constraints (verbatim from spec)

- **RBAC:** operator/admin/admin_sp gate on all write endpoints via `getMobileUser` from the right-depth middleware. Mobile ADDS this gate (web `/api/aset/*` has none).
- **No branch/unit scope** — Asset has no `branchId`/`unitType` (deviation, like the existing mobile asset routes).
- `params: Promise<...>` + `await params` in the new `[id]` routes (Next.js async-params — CLAUDE.md gotcha).
- `getMobileUser` (NOT `getMobileUserWithScope`) — matches existing `assets/route.ts`. Import depth: `../../middleware` for `[id]/route.ts` + `[id]/dispose/route.ts` (one level deeper than `assets/route.ts`'s `../middleware`).
- **Existing `POST /api/mobile/assets` is NOT modified** — the create form sends exactly its accepted fields.
- Decimal→Number on all responses (match existing GET/POST).
- Audit log every write (action CREATE/UPDATE/DISPOSE/DELETE, module "Aset", userId/userName/userRole/status) — mirror the existing POST's `tx.auditLog.create` pattern.
- `bookValue = acquisitionCost - accumulatedDepreciation` (one-line recompute on edit).
- Soft delete: `deletedAt = new Date()` (asset stays in DB, hidden from list).
- `log.*` only in screens; `console.error` in server routes.
- `branch` = `railway-migration` (API auto-deploys on push; screens ship via EAS build #5).

---

### Task 1: Edit + Delete + Dispose APIs

**Files:**
- Create: `src/app/api/mobile/assets/[id]/route.ts` (PUT edit + DELETE soft-delete)
- Create: `src/app/api/mobile/assets/[id]/dispose/route.ts` (POST dispose)

- [ ] **Step 1: Implement `PUT /api/mobile/assets/[id]`** (edit) — mirror web `src/app/api/aset/[id]/route.ts` PUT + add the mobile gate + audit:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.asset.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
    }
    if (body.code && body.code !== existing.code) {
      const dup = await prisma.asset.findUnique({ where: { code: body.code } });
      if (dup) return NextResponse.json({ message: `Kode aset '${body.code}' sudah digunakan` }, { status: 400 });
    }
    const cost = body.acquisitionCost !== undefined ? Number(body.acquisitionCost) : Number(existing.acquisitionCost);
    const accDep = body.accumulatedDepreciation !== undefined ? Number(body.accumulatedDepreciation) : Number(existing.accumulatedDepreciation);
    const bookValue = cost - accDep;
    const updated = await prisma.asset.update({
      where: { id: parseInt(id) },
      data: {
        code: body.code ?? existing.code,
        name: body.name ?? existing.name,
        category: body.category ?? existing.category,
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : existing.acquisitionDate,
        acquisitionCost: cost,
        usefulLifeYears: body.usefulLifeYears !== undefined ? parseInt(body.usefulLifeYears) : existing.usefulLifeYears,
        residualValue: body.residualValue !== undefined ? Number(body.residualValue) : existing.residualValue,
        accumulatedDepreciation: accDep,
        bookValue,
        location: body.location !== undefined ? body.location : existing.location,
        description: body.description !== undefined ? body.description : existing.description,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "UPDATE", module: "Aset",
        description: `Edit Aset dari Mobile: ${updated.code} - ${updated.name}`,
        userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
      },
    });
    const data = { ...updated, acquisitionCost: Number(updated.acquisitionCost), accumulatedDepreciation: Number(updated.accumulatedDepreciation), residualValue: Number(updated.residualValue), bookValue: Number(updated.bookValue), disposedValue: updated.disposedValue ? Number(updated.disposedValue) : null };
    return NextResponse.json({ data });
  } catch (error) {
    console.error("PUT /api/mobile/assets/[id] error:", error);
    return NextResponse.json({ message: "Gagal mengupdate aset" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Implement `DELETE /api/mobile/assets/[id]`** (soft delete) in the SAME file:
```ts
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const existing = await prisma.asset.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
    }
    await prisma.asset.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
    await prisma.auditLog.create({
      data: {
        action: "DELETE", module: "Aset",
        description: `Hapus (soft) Aset dari Mobile: ${existing.code} - ${existing.name}`,
        userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
      },
    });
    return NextResponse.json({ message: "Aset berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/mobile/assets/[id] error:", error);
    return NextResponse.json({ message: "Gagal menghapus aset" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Implement `POST /api/mobile/assets/[id]/dispose`** at `src/app/api/mobile/assets/[id]/dispose/route.ts`:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.asset.findUnique({ where: { id: parseInt(id) } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
    }
    if (existing.status === "disposed") {
      return NextResponse.json({ message: "Aset sudah di-dispose" }, { status: 400 });
    }
    if (!body.disposedDate) {
      return NextResponse.json({ message: "disposedDate wajib diisi" }, { status: 400 });
    }
    const updated = await prisma.asset.update({
      where: { id: parseInt(id) },
      data: {
        status: "disposed",
        disposedDate: new Date(body.disposedDate),
        disposedValue: body.disposedValue !== undefined ? Number(body.disposedValue) : null,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "DISPOSE", module: "Aset",
        description: `Dispose Aset dari Mobile: ${existing.code} - ${existing.name}`,
        userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
      },
    });
    const data = { ...updated, acquisitionCost: Number(updated.acquisitionCost), accumulatedDepreciation: Number(updated.accumulatedDepreciation), residualValue: Number(updated.residualValue), bookValue: Number(updated.bookValue), disposedValue: updated.disposedValue ? Number(updated.disposedValue) : null };
    return NextResponse.json({ data });
  } catch (error) {
    console.error("POST /api/mobile/assets/[id]/dispose error:", error);
    return NextResponse.json({ message: "Gagal dispose aset" }, { status: 500 });
  }
}
```
**Verify at impl time:** `getMobileUser` import depth — `[id]/route.ts` → `../../middleware` (2 levels); `[id]/dispose/route.ts` → `../../../middleware` (3 levels). Confirm `getMobileUser` is exported from middleware (the existing `assets/route.ts` imports it from `../middleware`). The existing GET `/api/mobile/assets/[id]` (detail) already exists — confirm whether it's in `[id]/route.ts` already (if so, ADD PUT+DELETE to that file, don't clobber the existing GET).

- [ ] **Step 4: tsc** (`npx tsc --noEmit`, repo root) → no new errors.
- [ ] **Step 5: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/assets/[id]/route.ts" "src/app/api/mobile/assets/[id]/dispose/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): PUT/DELETE/dispose /assets/[id] (Fase 8a T1)"
```

---

### Task 2: `AsetFormScreen` (create + edit) + List FAB + nav

**Files:**
- Create: `mobile/src/screens/operator/AsetFormScreen.tsx`
- Modify: `mobile/src/screens/operator/AsetListScreen.tsx` (add FAB)
- Modify: `mobile/App.tsx` (register `AsetForm` route)

**Read first for conventions:** `mobile/src/screens/operator/AsetListScreen.tsx` + `AsetDetailScreen.tsx` (existing — api client, `formatRp`, `C`, the asset shape), `mobile/src/screens/operator/KasBankTransaksiScreen.tsx` (a recent form pattern — inputs, date picker, submit), `mobile/src/lib/api.ts`, `mobile/src/utils/log.ts`.

**API contracts (confirm by reading the routes):**
- Create → `POST /api/mobile/assets` body `{ code, name, category, acquisitionDate, acquisitionCost, usefulLifeYears, location?, description? }` → 201 `{ message, data }` / 400 `{ message }` (dup code / incomplete).
- Edit → `PUT /api/mobile/assets/[id]` body `{ code?, name?, category?, acquisitionDate?, acquisitionCost?, usefulLifeYears?, residualValue?, accumulatedDepreciation?, location?, description? }` → 200 `{ data }`.
- Pre-fill (edit) → `GET /api/mobile/assets/[id]` (existing detail) returns the asset with Number-converted decimals.

**Implement:**
- Route params: `mode: "create" | "edit"` + `assetId?` (edit). 
- **Create fields:** code, name, category (dropdown: building/vehicle/equipment/furniture/computer/other), acquisitionDate (date picker, default today), acquisitionCost (numeric), usefulLifeYears (numeric), location?, description?.
- **Edit (adds):** residualValue, accumulatedDepreciation + **live `bookValue` preview** (`acquisitionCost - accumulatedDepreciation`). Pre-fill all from `GET /api/mobile/assets/[id]`.
- Submit → POST (create) or PUT (edit). Validate required + numeric > 0. Success → toast + `navigation.goBack()`.
- **FAB on AsetListScreen:** operator/admin/admin_sp gated (derive `userRole` like DashboardScreen) → `navigation.navigate("AsetForm", { mode: "create" })`.
- **App.tsx:** register `AsetForm` route (lazy import + Screen).
- `log.*` only.

- [ ] **Step 1: Read conventions + the 3 routes (confirm contracts).**
- [ ] **Step 2: Implement AsetFormScreen + FAB + App.tsx route.**
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/AsetFormScreen.tsx mobile/src/screens/operator/AsetListScreen.tsx mobile/App.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): AsetFormScreen (create+edit) + list FAB + nav (Fase 8a T2)"
```

---

### Task 3: Edit / Dispose / Delete actions on `AsetDetailScreen`

**File:** `mobile/src/screens/operator/AsetDetailScreen.tsx` (modify).

Add 3 action buttons (operator/admin/admin_sp gated via `userRole`):
- **Edit** → `navigation.navigate("AsetForm", { mode: "edit", assetId })`.
- **Dispose** → modal/dialog: `disposedDate` (date picker, default today) + `disposedValue?` (numeric) → `POST /api/mobile/assets/[id]/dispose`. Confirm prompt. **Hide the Dispose button if `asset.status === "disposed"`** (show a "Disposed" badge instead).
- **Delete** → confirm dialog ("Yakin hapus aset ini? Soft-delete.") → `DELETE /api/mobile/assets/[id]`. On success → toast + go back to list.

**API contracts:** dispose `POST /api/mobile/assets/[id]/dispose` body `{ disposedDate, disposedValue? }` → 200 `{ data }` / 400 `{ message }` (already disposed / missing date). delete `DELETE /api/mobile/assets/[id]` → 200 `{ message }`.

- [ ] **Step 1: Read AsetDetailScreen (confirm asset shape — `status`, `disposedDate`, `disposedValue`).**
- [ ] **Step 2: Implement the 3 actions (Edit nav + Dispose dialog + Delete confirm).** `log.*` only.
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/AsetDetailScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): AsetDetail edit/dispose/delete actions (Fase 8a T3)"
```

---

## After T1–T3 → final opus review + push
1. Final whole-branch opus review over the Fase 8a base..HEAD.
2. Full test suite (`npm test`) — expect baseline (no new unit tests in 8a; mechanical CRUD).
3. `finishing-a-development-branch`: push `railway-migration` (deploys the 3 new mobile endpoints). Screens ship via EAS build #5.

## Notes for the final whole-branch review
- Confirm all 3 new endpoints gate operator/admin/admin_sp + the existing POST is UNCHANGED.
- Confirm `params: Promise` + `await params` on the new routes.
- Confirm `bookValue = cost - accDep` recompute on edit.
- Confirm dispose rejects already-disposed + requires disposedDate; delete is soft (`deletedAt`).
- Confirm audit logs on every write (UPDATE/DISPOSE/DELETE).
- Confirm the form sends the create POST's exact accepted fields (create mode) + the PUT's fields (edit mode); field-contract audit like prior fases.
- Confirm no raw `console.*` in screens; `console.error` only in server routes.
- Confirm web `/api/aset/*` untouched.
