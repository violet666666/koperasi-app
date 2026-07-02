# Mobile RBAC GET-Scope — Design Spec (Fase 4c)

**Date:** 2026-07-02
**Status:** Approved (Comprehensive scope chosen by user; 2 unscopeable routes documented as deviations)
**Branch:** `railway-migration` (auto-deploys to prod on push)
**Phase:** Fase 4c — follows Fase 4b (write-route scoping). Reuses `src/lib/mobile-auth-scope.ts` + `getMobileUserWithScope`.

## Problem

Fase 4b added branch/unit scope checks to the 8 P0 **write** (POST) routes. The **GET** surface is still wide open in two ways:

- **(a) 5 routes with NO role check at all** (`getMobileUser` auth-only): `loan-payment` GET, `toko` GET, `unit-packages`, `assets/[id]`, `edit-nrp` GET. Any authenticated `member`-role token can read staff data.
- **(b) ~13 staff GET lists with a role check but NO scope filter**: `loans-operator`, `savings-accounts`, `members`, `buku-kas`, `kas-bank`, `loan-payments`, `reports/loans`, `reports/savings`, `toko`, `unit-packages`, `reports/unit`, `audit-logs`, `batches`, `edit-nrp`. A non-operator staff member sees data for ALL branches/units, not just their own.

Result: an authenticated member can enumerate other members' loans/payroll/piutang/assets; a unit-scoped `admin`/`kasir` can read every branch's loans, savings, members, cashbook.

## Goal

Extend Fase 4b's scope model to the GET surface: add role gates where missing, and filter list queries by the caller's `branchId`/`unitType` for non-operator staff. Operator bypasses all filtering.

## Approach (decided: Comprehensive)

Reuse `getMobileUserWithScope` (Fase 4b) to load fresh scope, and extend `mobile-auth-scope.ts` with two **list-filter** helpers (pure, unit-tested) that return a Prisma `where` fragment. Single-resource GETs reuse the existing `canAccessBranch`/`canAccessUnit`.

## Helper extension — `src/lib/mobile-auth-scope.ts`

Add (alongside existing `canAccessBranch`/`canAccessUnit`):

```ts
export type ListFilterResult =
  | { ok: true; filter: Record<string, unknown> }   // spread into `where`
  | { ok: false };                                   // fail-closed — route returns 403

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

/** Returns the alias family that contains `ut` (e.g. resto_cafe -> [resto,resto_cafe,coffe_latar]),
 *  or [ut] if it belongs to no family. */
function unitFamilyContaining(ut: string): string[] {
  for (const family of UNIT_FAMILIES) {
    if (family.includes(ut)) return family;
  }
  return [ut];
}
```

Route pattern (branch list):
```ts
const user = await getMobileUserWithScope(request);
if (!user) return unauthorizedResponse();
if (!["operator","admin","admin_sp"].includes(user.role)) return role403();
const f = branchListFilter(user);
if (!f.ok) return scope403();
const where = { ...baseWhere, ...f.filter };
```

All scope denials return the same generic 403 as Fase 4b: `"Akses ditolak: resource di luar scope anda."`

## Per-route fix table (20 routes)

### Group A — add role gate + scope (no-check routes)
| Route | Fix |
|-------|-----|
| `loan-payment` GET | gate `operator/admin/admin_sp`; `branchListFilter` on Loan.findMany |
| `toko` GET | gate `kasir/operator/admin/admin_sp`; `canAccessUnit(user, unitType)` on query param |
| `unit-packages` GET | gate `kasir/operator/admin/admin_sp`; `canAccessUnit(user, unitType)` |
| `assets/[id]` GET | gate `operator/admin/admin_sp`; **no scope field — role-gate only** (deviation) |
| `edit-nrp` GET | gate `kasir/operator/admin/admin_sp`; `unitListFilter` on StoreSale.findMany |
| `members/[id]/piutang` GET | already gated `operator/admin/kasir/admin_sp`; add `canAccessBranch(user, member.branchId)` |
| `batches` GET | already gated; add `unitListFilter` on StockBatch findMany |

### Group B — add scope filter to staff lists (gate already present)
| Route | Fix |
|-------|-----|
| `loans-operator` GET | `branchListFilter` on findMany + summary groupBy |
| `savings-accounts` GET | `branchListFilter` on findMany + aggregate + groupBy |
| `members` GET | `branchListFilter` on findMany |
| `buku-kas` GET | `branchListFilter` on CashBankTransaction findMany + CashBankAccount findMany + opening-balance query |
| `kas-bank` GET | `branchListFilter` on both account + transaction queries |
| `loan-payments` GET | lookup loan.branchId by loanId, then `canAccessBranch` (single-resource) |
| `reports/loans` GET | `branchListFilter` on Loan.findMany (per-branch aggregate is acceptable) |
| `reports/savings` GET | `branchListFilter` on both groupBy queries |
| `reports/unit` GET | `canAccessUnit(user, unitType)` on query param |
| `audit-logs` GET | non-operator with unitType → inject `where.unitType = user.unitType` (no branchId on AuditLog) |

### Deviations — role-gate only (cannot scope)
| Route | Reason |
|-------|--------|
| `assets/[id]` GET | `Asset` model has no `branchId`/`unitType` — global resource |
| `reports/financial` GET | neraca/laba-rugi are org-wide double-entry aggregates; branch filter breaks balance integrity |
| `payroll` GET + `payroll/[periodId]` GET | `PayrollPeriod` has no `branchId`; periods are org-wide. (`payroll/[periodId]/slip/[slipId]` GET already member-self-scoped → add staff gate + `slip.member.branchId` check.) |

## Test plan

- **Unit tests** (`src/__tests__/mobile-auth-scope.test.ts`, extend): `branchListFilter` (operator `{}`, non-operator matching `{branchId}`, null → `ok:false`), `unitListFilter` (operator `{}`, non-operator `{unitType:{in:family}}` for resto + toko + cuci_mobil, null → `ok:false`), `unitFamilyContaining` (alias families + singleton).
- **Routes:** no new route unit tests (repo pattern). Verify `npx tsc --noEmit` (no new errors in touched files) + `npx vitest run` baseline (419 pass / 3 pre-existing) stays green.
- **Manual spot-check post-deploy:** a `kasir`/`admin` token should see only their branch/unit data on scoped lists; a `member` token should 403 on staff GET routes.

## Conventions / constraints

- Roles: operator (bypass), admin (unit), admin_sp (SP), kasir (POS), anggota (member-self).
- Only ADD gates/filters; do NOT change existing business logic or response shapes.
- GET handlers swap `getMobileUser` → `await getMobileUserWithScope` (GET handlers that remain auth-only where a route is intentionally public-ish still keep `getMobileUser` — none here).
- Generic 403 message; no internal reason leak.
- Member-self routes (e.g. payroll slip for anggota) keep their existing `memberId` check; the scope gate is additive for staff roles.
