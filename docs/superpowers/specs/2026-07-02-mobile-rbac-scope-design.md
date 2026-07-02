# Mobile RBAC Unit/Branch Scope — Design Spec

**Date:** 2026-07-02
**Status:** Approved (design + 2 judgment calls confirmed by user)
**Branch:** `railway-migration` (auto-deploys to prod primkoppol.site on push)
**Phase:** Fase 4b (follows Fase 1-4 mobile drift-fix, all deployed)

## Problem

A security scan flagged 3 mobile API routes (`loan-payment`, `savings-tx`, `loan-payment-void`) for missing per-resource authorization. Investigation showed the gap is **systemic**, not isolated:

- Every mobile route authenticates via `getMobileUser()` (`src/app/api/mobile/middleware.ts`) which decodes a JWT (`MobileJWTPayload` in `src/lib/jwt.ts`). The JWT carries only `id, email, name, role, nrp, unitId?, branchId?, isOperator?`.
- The mobile JWT does **NOT** carry `memberId`, `unitType`, or `permissions` (the web session does — `src/lib/auth.ts:145-156`). So the server cannot scope by unit/branch from the JWT alone.
- `unitType` is returned to the client at login but **never verified server-side**.
- Result: routes that accept a client-supplied `loanId` / `accountId` / `paymentId` / `memberId` / `unitType` perform a role check, then act on whatever resource the client names — with **no verification the resource is in the caller's scope**. An `admin_sp` scoped to branch A can pay/void a loan in branch B; a `kasir` of unit X can forge a sale under unit Y.

There is **no reusable scope helper** in web or mobile — every route does ad-hoc inline role checks. Web has the same gap (it has the scope fields in the session but routes don't use them), so there is no web helper to mirror; this is a new pattern.

## Goal

Add a reusable, unit-tested scope helper and enforce it on the **P0 write routes** (money-moving + void) under `src/app/api/mobile/**`, so a non-`operator` staff user can only act on resources within their `branchId` (SP resources) or `unitType` family (unit/POS resources).

## Approach (decided)

**DB-lookup helper per request** (chosen over JWT-enrichment). A new `getMobileUserWithScope(request)` does one `prisma.user.findUnique` to load fresh `branchId/unitType/memberId`. Rationale: always-fresh scope, no JWT migration or forced re-login, and it consolidates the ad-hoc `user.findUnique` lookups several routes already do. Cost is one indexed PK lookup per staff request.

## Scope (decided: Focused — all P0 writes)

Eight routes get a scope check; one is reviewed-and-documented as no-change.

| # | Route (POST unless noted) | Resource acted on | Scope lever | Check |
|---|---------------------------|-------------------|-------------|-------|
| 1 | `loan-payment` | existing `Loan` (fetched) | `loan.branchId` | operator bypass; else `user.branchId === loan.branchId` |
| 2 | `savings-tx` | existing `SavingsAccount` (fetched) | `account.branchId` | operator bypass; else match |
| 3 | `loan-payment-void` | existing `LoanPayment` (fetched) | `payment.branchId` | operator bypass; else match |
| 4 | `loans-operator/direct-disburse` | `Member` (fetched outside tx) | `member.branchId` | operator bypass; else match |
| 5 | `loans-operator/kompen-disburse` | `Member` + existing `Loan` (fetched inside tx → hoist) | `member.branchId` + `existingLoan.branchId` | operator bypass; else both match |
| 6 | `toko` | creates `StoreSale`, body `unitType` (default `toko`) | unit family | operator bypass; else `user.unitType` same family as body `unitType` |
| 7 | `unit-layanan` | creates `UnitTransaction`, body `unitType` | unit family | operator bypass; else unit family match |
| 8 | `toko/stock-in` | `StoreProduct` (fetched inside tx → hoist `unitType`) | `product.unitType` | operator bypass; else unit family match |
| 9 | `journals` | creates `Journal`, hardcoded `branchId: 1` (head office) | — | **no change** — role check is the correct gate (see judgment call #2) |

**Out of scope (deferred):** GET handlers of these routes (P1 read cross-branch leakage), routes with no role check at all (P2 — e.g. `loan-payment` GET, `toko` GET, `unit-packages`, `assets/[id]`, `payroll/.../slip/[slipId]`, `members/[id]/piutang`), and member-portal self-scoping (already scopes via `memberId` DB lookup). These are documented for a future hardening pass.

## Components

### 1. Pure helper — `src/lib/mobile-auth-scope.ts` (NEW, unit-tested)

```ts
import { STORE_SALE_ALIASES, UNIT_TYPE_ALIASES } from "@/lib/constants/units";

export interface MobileScope {
  role: string;
  branchId: number | null;
  unitType: string | null;
}

export interface ScopeDecision {
  allowed: boolean;
  reason?: string; // for server-side logging only; routes return a generic 403
}

const OPERATOR = "operator";

// Union of StoreSale + UnitTransaction alias families from constants/units.ts
const UNIT_FAMILIES: string[][] = [
  ...Object.values(STORE_SALE_ALIASES),
  ...Object.values(UNIT_TYPE_ALIASES),
];

function sameUnitFamily(a: string, b: string): boolean {
  if (a === b) return true;
  for (const family of UNIT_FAMILIES) {
    if (family.includes(a) && family.includes(b)) return true;
  }
  return false;
}

/** Operator bypasses. Non-operator must match resource branch exactly.
 *  Null user branchId => deny (fail-closed). */
export function canAccessBranch(scope: MobileScope, resourceBranchId: number): ScopeDecision {
  if (scope.role === OPERATOR) return { allowed: true };
  if (scope.branchId == null) {
    return { allowed: false, reason: "User branchId tidak dikonfigurasi (fail-closed)." };
  }
  if (scope.branchId !== resourceBranchId) {
    return { allowed: false, reason: "Resource berada di branch berbeda." };
  }
  return { allowed: true };
}

/** Operator bypasses. Non-operator must match resource unit (alias-family aware).
 *  Null user unitType => deny (fail-closed). */
export function canAccessUnit(scope: MobileScope, resourceUnitType: string): ScopeDecision {
  if (scope.role === OPERATOR) return { allowed: true };
  if (scope.unitType == null) {
    return { allowed: false, reason: "User unitType tidak dikonfigurasi (fail-closed)." };
  }
  if (!sameUnitFamily(scope.unitType, resourceUnitType)) {
    return { allowed: false, reason: "Resource unit di luar scope user." };
  }
  return { allowed: true };
}
```

### 2. DB-lookup helper — extend `src/app/api/mobile/middleware.ts`

```ts
import prisma from "@/lib/prisma";

export async function getMobileUserWithScope(request: Request) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: Number(mobileUser.id) },
    select: { id: true, branchId: true, unitType: true, memberId: true },
  });
  if (!dbUser) return null;
  return {
    ...mobileUser,
    branchId: dbUser.branchId,   // fresh DB value overrides stale JWT field
    unitType: dbUser.unitType,
    memberId: dbUser.memberId ?? null,
  };
}
```

### 3. Route wiring (Tasks 3-4)

Each route swaps `getMobileUser` → `await getMobileUserWithScope`, then inserts one scope check at the seam:
- **Fetch-then-act routes** (1-3): check immediately after the existing resource fetch, reusing data already loaded — zero extra queries.
- **direct-disburse** (4): member is already fetched before the tx (`route.ts:34`) — check right after.
- **kompen-disburse** (5): hoist `member` + `existingLoan` reads before the tx for the scope check; the tx keeps its own atomic re-reads.
- **Create routes** (6-7): check the body `unitType` after validation.
- **stock-in** (8): hoist a `storeProduct.findUnique({select:{unitType}})` before the tx.

All scope denials return `NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 })` — generic, no internal reason leaked (per Fase 2a info-disclosure lesson).

## Judgment calls (user-approved)

1. **Null scope → fail-closed (403).** A non-`operator` whose `branchId`/`unitType` is null cannot be verified → deny. Secure default. Pre-deploy mitigation: Task 5 runs a read-only diagnostic to confirm no production staff (admin/admin_sp/kasir) have null scope. (Rejected alternative: fail-open, which preserves uptime but leaves the hole.)
2. **`journals` POST — no scope check.** Manual journals post to head office (`branchId: 1`) by design; branch-scoping would misattribute accounting entries. The existing role check (operator/admin/admin_sp) is the appropriate gate. Documented, no code change.

## Test plan

- **Unit tests** (`src/__tests__/mobile-auth-scope.test.ts`) for `canAccessBranch` + `canAccessUnit`: operator bypass, exact match, alias-family match (`resto_cafe` vs `resto`/`coffe_latar`), mismatch deny, null-scope fail-closed.
- **Routes:** no new route unit tests (repo pattern — routes are orchestration, not unit-tested; the testable logic lives in the helper). Verification = `npx tsc --noEmit` clean + existing suite (410 pass / 3 pre-existing) stays green.
- **Diagnostic** (Task 5): read-only script confirming zero staff users have null scope before deploy.

## Conventions / constraints

- Roles: `operator` (manage_all bypass), `admin` (unit-scoped), `admin_sp` (SP), `kasir` (POS). No `superadmin`.
- Only ADD scope checks; do not change existing role membership (parity preservation).
- Do not break existing `$transaction` atomicity (kompen-disburse hoist keeps tx re-reads).
- Transaction numbers use `crypto.randomBytes` (N/A here — no new txn numbers introduced).
- Never include SP-IMP/* loans in CashBankTransaction (N/A here).

## Web parity note

Web routes have the same systemic gap. This helper is a new pattern mobile adopts first; web API routes may adopt `assertScope` later in a separate effort. Not in scope for Fase 4b.
