# Mobile RBAC GET-Scope — Implementation Plan (Fase 4c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role gates + branch/unit scope filters to the mobile GET surface (20 routes) so non-operator staff see only their own branch/unit data and members can't read staff data.

**Architecture:** Extend `src/lib/mobile-auth-scope.ts` (Fase 4b) with two pure list-filter helpers (`branchListFilter`, `unitListFilter`) + unit tests. Then apply per-route fixes grouped by pattern: branch-list filter, unit check/filter, single-resource/member-self/deviation. Routes swap `getMobileUser` → `await getMobileUserWithScope`.

**Tech Stack:** Next.js 16 route handlers, Prisma 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-mobile-rbac-get-scope-design.md` (per-route fix table is the source of truth for Tasks 2-4).

## Global Constraints

- Roles: operator (manage_all bypass), admin (unit), admin_sp (SP), kasir (POS), anggota (member-self).
- Only ADD gates/filters. Do NOT change business logic, response shapes, or existing role membership.
- GET handlers swap `getMobileUser` → `await getMobileUserWithScope`. If a route has BOTH GET and POST, import BOTH and only modify GET.
- Scope denials return EXACTLY `NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 })` — no reason leak.
- Pre-existing tsc errors (api/mobile/toko/shifts/[id], prisma/seed-*.ts, loans-operator/direct-disburse, toko/history) — ignore unless in a file you changed. Baseline tests: 419 pass / 3 pre-existing.
- `branch` = `railway-migration` (auto-deploys to prod on push) — do not push until review-approved.

---

### Task 1: Extend scope helper with list-filter functions (TDD)

**Files:**
- Modify: `src/lib/mobile-auth-scope.ts` (add `branchListFilter`, `unitListFilter`, `unitFamilyContaining`, `ListFilterResult`)
- Modify: `src/__tests__/mobile-auth-scope.test.ts` (add tests)

**Interfaces:**
- Produces: `branchListFilter(scope): ListFilterResult`, `unitListFilter(scope): ListFilterResult`, `type ListFilterResult = { ok: true; filter: Record<string, unknown> } | { ok: false }`.
- Consumes: existing `MobileScope`, `OPERATOR`, `UNIT_FAMILIES` (already in the file from Fase 4b).

- [ ] **Step 1: Add the failing tests**

Append to `src/__tests__/mobile-auth-scope.test.ts` (add `branchListFilter`, `unitListFilter` to the existing import from `@/lib/mobile-auth-scope`):

```ts
import { canAccessBranch, canAccessUnit, branchListFilter, unitListFilter } from "@/lib/mobile-auth-scope";

describe("branchListFilter", () => {
  it("operator gets empty filter (no restriction)", () => {
    expect(branchListFilter({ role: "operator", branchId: null, unitType: null })).toEqual({ ok: true, filter: {} });
  });
  it("non-operator with branchId gets branch filter", () => {
    expect(branchListFilter({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" })).toEqual({ ok: true, filter: { branchId: 1 } });
  });
  it("non-operator with null branchId is fail-closed", () => {
    expect(branchListFilter({ role: "admin", branchId: null, unitType: "toko" })).toEqual({ ok: false });
  });
});

describe("unitListFilter", () => {
  it("operator gets empty filter", () => {
    expect(unitListFilter({ role: "operator", branchId: null, unitType: null })).toEqual({ ok: true, filter: {} });
  });
  it("non-operator toko gets {unitType:{in:[toko]}}", () => {
    expect(unitListFilter({ role: "kasir", branchId: 1, unitType: "toko" })).toEqual({ ok: true, filter: { unitType: { in: ["toko"] } } });
  });
  it("non-operator resto_cafe gets the resto alias family", () => {
    const r = unitListFilter({ role: "kasir", branchId: 1, unitType: "resto_cafe" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.filter as any).unitType.in).toEqual(expect.arrayContaining(["resto", "resto_cafe", "coffe_latar"]));
  });
  it("non-operator cuci_mobil (no alias family) gets singleton", () => {
    const r = unitListFilter({ role: "admin", branchId: 1, unitType: "cuci_mobil" });
    expect(r).toEqual({ ok: true, filter: { unitType: { in: ["cuci_mobil"] } } });
  });
  it("non-operator with null unitType is fail-closed", () => {
    expect(unitListFilter({ role: "kasir", branchId: 1, unitType: null })).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/__tests__/mobile-auth-scope.test.ts`
Expected: FAIL — `branchListFilter`/`unitListFilter` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/mobile-auth-scope.ts` (after the existing `canAccessUnit`):

```ts
export type ListFilterResult =
  | { ok: true; filter: Record<string, unknown> }
  | { ok: false };

/** Returns the alias family containing `ut`, or [ut] if none. */
function unitFamilyContaining(ut: string): string[] {
  for (const family of UNIT_FAMILIES) {
    if (family.includes(ut)) return family;
  }
  return [ut];
}

/** LIST queries: branch filter for non-operator, {} for operator.
 *  Non-operator with null branchId => ok:false (fail-closed). */
export function branchListFilter(scope: MobileScope): ListFilterResult {
  if (scope.role === OPERATOR) return { ok: true, filter: {} };
  if (scope.branchId == null) return { ok: false };
  return { ok: true, filter: { branchId: scope.branchId } };
}

/** LIST queries: unit-family filter for non-operator, {} for operator.
 *  Non-operator with null unitType => ok:false (fail-closed). */
export function unitListFilter(scope: MobileScope): ListFilterResult {
  if (scope.role === OPERATOR) return { ok: true, filter: {} };
  if (scope.unitType == null) return { ok: false };
  return { ok: true, filter: { unitType: { in: unitFamilyContaining(scope.unitType) } } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/mobile-auth-scope.test.ts`
Expected: PASS (9 existing + 11 new = 20 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mobile-auth-scope.ts src/__tests__/mobile-auth-scope.test.ts
git commit -m "feat(mobile-rbac): branchListFilter/unitListFilter list-scope helpers + tests"
```

---

### Task 2: Apply branchListFilter to branch-scoped GET lists (8 routes)

**Files (all GET handlers):**
- `src/app/api/mobile/loan-payment/route.ts` GET (also add gate)
- `src/app/api/mobile/loans-operator/route.ts` GET
- `src/app/api/mobile/savings-accounts/route.ts` GET
- `src/app/api/mobile/members/route.ts` GET
- `src/app/api/mobile/buku-kas/route.ts` GET
- `src/app/api/mobile/kas-bank/route.ts` GET
- `src/app/api/mobile/reports/loans/route.ts` GET
- `src/app/api/mobile/reports/savings/route.ts` GET

**Interfaces:** Consumes `getMobileUserWithScope` (Fase 4b) + `branchListFilter` (Task 1).

**Common pattern** (adapt the role list per route — see spec table):
```ts
const user = await getMobileUserWithScope(request);
if (!user) return unauthorizedResponse();
if (!["operator","admin","admin_sp"].includes(user.role)) {
  return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
}
const f = branchListFilter(user);
if (!f.ok) return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
// then: const where = { ...existingWhere, ...f.filter };
```

- [ ] **Step 1: loan-payment GET** — currently no role check. Add gate `operator/admin/admin_sp` + `branchListFilter` spread into the Loan.findMany `where`.
- [ ] **Step 2: loans-operator GET** — gate present; spread `f.filter` into the findMany `where` AND the summary `groupBy` `where`.
- [ ] **Step 3: savings-accounts GET** — gate present; spread into findMany + the aggregate + the groupBy `where` clauses.
- [ ] **Step 4: members GET** — gate present (`operator/admin/kasir/admin_sp`); spread into findMany `where`.
- [ ] **Step 5: buku-kas GET** — gate present; spread into CashBankTransaction.findMany + CashBankAccount.findMany + the opening-balance query `where`.
- [ ] **Step 6: kas-bank GET** — gate present; spread into both the account findMany and the transaction findMany `where`.
- [ ] **Step 7: reports/loans GET** — gate present; spread into Loan.findMany `where` (per-branch aggregate acceptable).
- [ ] **Step 8: reports/savings GET** — gate present; spread into BOTH groupBy queries' `where`.
- [ ] **Step 9: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors in these 8 files; baseline green.
- [ ] **Step 10: Commit**

```bash
git add src/app/api/mobile/loan-payment/route.ts src/app/api/mobile/loans-operator/route.ts src/app/api/mobile/savings-accounts/route.ts src/app/api/mobile/members/route.ts src/app/api/mobile/buku-kas/route.ts src/app/api/mobile/kas-bank/route.ts src/app/api/mobile/reports/loans/route.ts src/app/api/mobile/reports/savings/route.ts
git commit -m "fix(mobile-rbac): branch-scope 8 GET list routes (Fase 4c)"
```

---

### Task 3: Apply unit-scope to unit-scoped GET routes (6 routes)

**Files (all GET handlers):**
- `src/app/api/mobile/toko/route.ts` GET (add gate + `canAccessUnit`)
- `src/app/api/mobile/unit-packages/route.ts` GET (add gate + `canAccessUnit`)
- `src/app/api/mobile/reports/unit/route.ts` GET (`canAccessUnit` on query param)
- `src/app/api/mobile/edit-nrp/route.ts` GET (add gate + `unitListFilter` on StoreSale.findMany)
- `src/app/api/mobile/batches/route.ts` GET (gate present; `unitListFilter` on StockBatch findMany)
- `src/app/api/mobile/audit-logs/route.ts` GET (gate present; non-operator inject `where.unitType = user.unitType`)

**Interfaces:** Consumes `getMobileUserWithScope`, `canAccessUnit`, `unitListFilter`.

**Patterns:**
- Single-resource unit check (toko, unit-packages, reports/unit): after reading `unitType` from query, `const u = canAccessUnit(user, unitType); if (!u.allowed) return 403;`
- List unit filter (edit-nrp, batches): `const f = unitListFilter(user); if (!f.ok) return 403; const where = { ...base, ...f.filter };`
- audit-logs (unitType field, no branch): `if (user.role !== "operator" && user.unitType) { where.unitType = user.unitType; }` (use the user's unitType directly; AuditLog.unitType is a single value, not aliased at log-write time).

- [ ] **Step 1-6:** Apply per route per spec table. For each: swap to `await getMobileUserWithScope`, add gate where missing, add the unit check/filter.
- [ ] **Step 7: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors; baseline green.
- [ ] **Step 8: Commit**

```bash
git add src/app/api/mobile/toko/route.ts src/app/api/mobile/unit-packages/route.ts src/app/api/mobile/reports/unit/route.ts src/app/api/mobile/edit-nrp/route.ts src/app/api/mobile/batches/route.ts src/app/api/mobile/audit-logs/route.ts
git commit -m "fix(mobile-rbac): unit-scope 6 GET routes (Fase 4c)"
```

---

### Task 4: Single-resource, member-self & deviation routes (4 routes)

**Files (all GET handlers):**
- `src/app/api/mobile/loan-payments/route.ts` GET — given `loanId`, look up `loan.branchId`, then `canAccessBranch(user, loan.branchId)`.
- `src/app/api/mobile/members/[id]/piutang/route.ts` GET — gate present; after fetching member, `canAccessBranch(user, member.branchId)`.
- `src/app/api/mobile/payroll/[periodId]/slip/[slipId]/route.ts` GET — already anggota-self-scoped; add staff gate (`operator/admin/admin_sp/kasir`) + for non-operator staff fetch `slip.member.branchId` and `canAccessBranch`.
- `src/app/api/mobile/assets/[id]/route.ts` GET — add gate `operator/admin/admin_sp`; **no scope field — role-gate only** (deviation, documented).

**Interfaces:** Consumes `getMobileUserWithScope`, `canAccessBranch`.

- [ ] **Step 1: loan-payments GET** — `const loan = await prisma.loan.findUnique({ where: { id: Number(loanId) }, select: { branchId: true } }); if (!loan) return 404; if (!canAccessBranch(user, loan.branchId).allowed) return 403;`
- [ ] **Step 2: members/[id]/piutang GET** — after member fetch + existing gate, `if (!canAccessBranch(user, member.branchId).allowed) return 403;`
- [ ] **Step 3: payroll slip GET** — keep existing anggota-self check; for staff roles add `canAccessBranch(user, slip.member.branchId)` (fetch slip with `include: { member: { select: { branchId: true } } }`).
- [ ] **Step 4: assets/[id] GET** — add `operator/admin/admin_sp` gate; no scope filter (Asset has no branch/unit field).
- [ ] **Step 5: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors; baseline green.
- [ ] **Step 6: Commit**

```bash
git add src/app/api/mobile/loan-payments/route.ts src/app/api/mobile/members/[id]/piutang/route.ts src/app/api/mobile/payroll/[periodId]/slip/[slipId]/route.ts src/app/api/mobile/assets/[id]/route.ts
git commit -m "fix(mobile-rbac): single-resource/member-self/deviation GET routes (Fase 4c)"
```

---

## Notes for the final whole-branch review

- Verify no role membership was changed on any route (only gates/filters added).
- Verify the 3 deviation routes (assets/[id], reports/financial, payroll periods) are role-gate-only and documented (reports/financial + payroll periods need NO change — confirm they're left untouched or only gate-confirmed).
- Verify `getMobileUser` is retained on any GET handler that should remain auth-only (none expected here, but check member-portal routes aren't accidentally gated).
- Confirm all scope denials use the generic 403 message.
- Run the prod null-scope diagnostic again before deploy (`scripts/diagnose-mobile-staff-null-scope.ts`) — fail-closed list filters mean a null-scope staff would get 403 on list routes too.
