# Mobile RBAC Unit/Branch Scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable, unit-tested mobile scope helper and enforce it on the 8 P0 write routes so non-`operator` staff can only act on resources in their `branchId`/`unitType` scope.

**Architecture:** A pure helper (`src/lib/mobile-auth-scope.ts`) holds all scope logic (operator bypass, branch exact-match, unit alias-family match, null fail-closed) and is unit-tested. A thin DB-backed `getMobileUserWithScope` extends the mobile middleware. Each P0 route swaps its auth call and inserts one scope check at the fetch/input seam. Routes stay orchestration (no route unit tests — repo pattern).

**Tech Stack:** Next.js 16 route handlers, Prisma 6, Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-07-02-mobile-rbac-scope-design.md`

## Global Constraints

- Roles: `operator` (manage_all bypass), `admin` (unit-scoped), `admin_sp` (SP), `kasir` (POS). No `superadmin`/`admin_unit`.
- Only ADD scope checks; do NOT change existing role membership on any route (parity preservation).
- Do NOT break existing `$transaction` atomicity — kompen-disburse hoist must keep the tx's own re-reads.
- Scope denials return a generic 403 message: `NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 })`. Never leak the internal `reason`.
- Transaction numbers use `crypto.randomBytes` — N/A here (no new txn numbers introduced).
- Never include SP-IMP/* loans in CashBankTransaction — N/A here.
- Pre-existing failing tests (NOT regressions): `split-bill`, `batch-navigation`, `floor-plan`, `queue-system`. Baseline = 410 pass / 3 pre-existing. Pre-existing tsc errors in `api/mobile/toko/shifts/[id]` + `prisma/seed-*.ts` — ignore unless in a file you changed.
- `branch` is committed to `railway-migration` which auto-deploys to prod on push — do not push until review-approved.

## File Structure

- **Create** `src/lib/mobile-auth-scope.ts` — pure scope helpers (`canAccessBranch`, `canAccessUnit`, `MobileScope`, `ScopeDecision`).
- **Create** `src/__tests__/mobile-auth-scope.test.ts` — unit tests for the helpers.
- **Modify** `src/app/api/mobile/middleware.ts` — add `getMobileUserWithScope(request)`.
- **Modify** (Task 3) `src/app/api/mobile/loan-payment/route.ts`, `savings-tx/route.ts`, `loan-payment-void/route.ts`, `loans-operator/direct-disburse/route.ts`, `loans-operator/kompen-disburse/route.ts`.
- **Modify** (Task 4) `src/app/api/mobile/toko/route.ts`, `unit-layanan/route.ts`, `toko/stock-in/route.ts`.
- **Create** `scripts/diagnose-mobile-staff-null-scope.ts` — read-only pre-deploy check.

---

### Task 1: Pure scope helper + tests (TDD)

**Files:**
- Create: `src/lib/mobile-auth-scope.ts`
- Test: `src/__tests__/mobile-auth-scope.test.ts`

**Interfaces:**
- Produces: `canAccessBranch(scope: MobileScope, resourceBranchId: number): ScopeDecision`, `canAccessUnit(scope: MobileScope, resourceUnitType: string): ScopeDecision`, `interface MobileScope { role: string; branchId: number | null; unitType: string | null }`, `interface ScopeDecision { allowed: boolean; reason?: string }`.
- Consumes: `STORE_SALE_ALIASES`, `UNIT_TYPE_ALIASES` from `@/lib/constants/units`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/mobile-auth-scope.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAccessBranch, canAccessUnit } from "@/lib/mobile-auth-scope";

describe("canAccessBranch", () => {
  it("operator bypasses any branch", () => {
    expect(canAccessBranch({ role: "operator", branchId: null, unitType: null }, 1).allowed).toBe(true);
    expect(canAccessBranch({ role: "operator", branchId: 5, unitType: "toko" }, 999).allowed).toBe(true);
  });
  it("non-operator with matching branch is allowed", () => {
    expect(canAccessBranch({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" }, 1).allowed).toBe(true);
  });
  it("non-operator with mismatched branch is denied with a reason", () => {
    const d = canAccessBranch({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" }, 2);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBeTruthy();
  });
  it("non-operator with null branchId is denied (fail-closed)", () => {
    expect(canAccessBranch({ role: "admin", branchId: null, unitType: "toko" }, 1).allowed).toBe(false);
  });
});

describe("canAccessUnit", () => {
  it("operator bypasses", () => {
    expect(canAccessUnit({ role: "operator", branchId: null, unitType: null }, "toko").allowed).toBe(true);
  });
  it("non-operator matching unit exactly is allowed", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "toko" }, "toko").allowed).toBe(true);
  });
  it("non-operator matching via alias family is allowed", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "resto_cafe" }, "resto").allowed).toBe(true);
    expect(canAccessUnit({ role: "admin", branchId: 1, unitType: "resto" }, "coffe_latar").allowed).toBe(true);
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "playstation" }, "play_station").allowed).toBe(true);
  });
  it("non-operator mismatched unit is denied", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "toko" }, "resto").allowed).toBe(false);
  });
  it("non-operator with null unitType is denied (fail-closed)", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: null }, "toko").allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/mobile-auth-scope.test.ts`
Expected: FAIL — module `@/lib/mobile-auth-scope` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/mobile-auth-scope.ts`:

```ts
import { STORE_SALE_ALIASES, UNIT_TYPE_ALIASES } from "@/lib/constants/units";

export interface MobileScope {
  role: string;
  branchId: number | null;
  unitType: string | null;
}

export interface ScopeDecision {
  allowed: boolean;
  reason?: string; // server-side logging only; routes return a generic 403
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/mobile-auth-scope.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mobile-auth-scope.ts src/__tests__/mobile-auth-scope.test.ts
git commit -m "feat(mobile-rbac): pure scope helper canAccessBranch/canAccessUnit + tests"
```

---

### Task 2: DB-backed getMobileUserWithScope in middleware

**Files:**
- Modify: `src/app/api/mobile/middleware.ts`

**Interfaces:**
- Produces: `getMobileUserWithScope(request: Request): Promise<(MobileJWTPayload & { branchId: number | null; unitType: string | null; memberId: number | null }) | null>`.
- Consumes: existing `getMobileUser`, `MobileJWTPayload` from `@/lib/jwt`, `prisma` from `@/lib/prisma`.

- [ ] **Step 1: Add the helper**

In `src/app/api/mobile/middleware.ts`, add `import prisma from "@/lib/prisma";` at the top (after the jwt import), then append after the existing `unauthorizedResponse` function:

```ts
/**
 * Verify JWT and load fresh scope fields (branchId/unitType/memberId) from DB.
 * The mobile JWT lacks these, so a single user.findUnique is required for scope checks.
 * Returns null if the token is invalid or the user no longer exists.
 */
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
    branchId: dbUser.branchId, // fresh DB value overrides any stale JWT field
    unitType: dbUser.unitType,
    memberId: dbUser.memberId ?? null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no NEW errors in `middleware.ts` (pre-existing errors elsewhere are ignored per Global Constraints).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mobile/middleware.ts
git commit -m "feat(mobile-rbac): getMobileUserWithScope DB-backed scope loader"
```

---

### Task 3: Wire branch-scope into 5 SP routes

**Files (all POST handlers):**
- Modify: `src/app/api/mobile/loan-payment/route.ts`
- Modify: `src/app/api/mobile/savings-tx/route.ts`
- Modify: `src/app/api/mobile/loan-payment-void/route.ts`
- Modify: `src/app/api/mobile/loans-operator/direct-disburse/route.ts`
- Modify: `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`

**Interfaces:**
- Consumes: `getMobileUserWithScope` (Task 2), `canAccessBranch` (Task 1). `MobileScope` is structurally compatible with the returned user object (has `role`, `branchId`, `unitType`).

**Pattern for each route:** swap `const user = getMobileUser(request);` → `const user = await getMobileUserWithScope(request);`, add `import { canAccessBranch } from "@/lib/mobile-auth-scope";` (path depth as needed), then insert the scope check at the seam described below. Keep the existing role check unchanged.

- [ ] **Step 1: loan-payment POST**

After the existing `const loan = await prisma.loan.findUnique({...})` and its `if (!loan) return 404`, insert:

```ts
const branchOk = canAccessBranch(user, loan.branchId);
if (!branchOk.allowed) {
  return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
}
```

- [ ] **Step 2: savings-tx POST**

After the existing `const account = await prisma.savingsAccount.findUnique({...})` and its not-found check, insert the same `canAccessBranch(user, account.branchId)` guard.

- [ ] **Step 3: loan-payment-void POST**

After the existing `const payment = await prisma.loanPayment.findUnique({...})` and its not-found check, insert the `canAccessBranch(user, payment.branchId)` guard.

- [ ] **Step 4: direct-disburse POST**

The member is already fetched before the tx at `route.ts:34` with `branchId` selected. Immediately after the `if (member.status !== "active")` check, insert the `canAccessBranch(user, member.branchId)` guard.

- [ ] **Step 5: kompen-disburse POST**

This route fetches member + existingLoan INSIDE the tx (`route.ts:30-35`). Hoist a pre-tx read for the scope check, then keep the tx's own reads. Before `const result = await prisma.$transaction(...)`, add:

```ts
const [scopeMember, scopeLoan] = await Promise.all([
  prisma.member.findUnique({ where: { id: memberId }, select: { id: true, branchId: true, status: true } }),
  prisma.loan.findUnique({ where: { id: existingLoanId }, select: { id: true, branchId: true, status: true, memberId: true } }),
]);
if (!scopeMember || scopeMember.status !== "active") {
  return NextResponse.json({ message: "Anggota tidak aktif" }, { status: 400 });
}
if (!scopeLoan || scopeLoan.status !== "active") {
  return NextResponse.json({ message: "Pinjaman lama tidak aktif" }, { status: 400 });
}
if (scopeLoan.memberId !== memberId) {
  return NextResponse.json({ message: "Pinjaman bukan milik anggota ini" }, { status: 400 });
}
const memberBranchOk = canAccessBranch(user, scopeMember.branchId);
const loanBranchOk = canAccessBranch(user, scopeLoan.branchId);
if (!memberBranchOk.allowed || !loanBranchOk.allowed) {
  return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
}
```

Leave the tx body (`route.ts:29-205`) untouched — it re-fetches member/existingLoan for atomic consistency.

- [ ] **Step 6: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors in these 5 files; full suite still 410 pass / 3 pre-existing.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/mobile/loan-payment/route.ts src/app/api/mobile/savings-tx/route.ts src/app/api/mobile/loan-payment-void/route.ts src/app/api/mobile/loans-operator/direct-disburse/route.ts src/app/api/mobile/loans-operator/kompen-disburse/route.ts
git commit -m "fix(mobile-rbac): enforce branch scope on 5 SP write routes"
```

---

### Task 4: Wire unit-scope into 3 unit/POS routes

**Files (all POST handlers):**
- Modify: `src/app/api/mobile/toko/route.ts`
- Modify: `src/app/api/mobile/unit-layanan/route.ts`
- Modify: `src/app/api/mobile/toko/stock-in/route.ts`

**Interfaces:**
- Consumes: `getMobileUserWithScope` (Task 2), `canAccessUnit` (Task 1).

**Pattern:** swap `getMobileUser` → `await getMobileUserWithScope`, import `canAccessUnit`, insert the unit check at the seam. Keep existing role checks.

- [ ] **Step 1: toko POST**

`unitType` comes from the body with default `"toko"` (`route.ts:61`). After the `paymentMethod` validation block (after line 68) and before the `salary_cut` member check, insert:

```ts
const unitOk = canAccessUnit(user, unitType);
if (!unitOk.allowed) {
  return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
}
```

- [ ] **Step 2: unit-layanan POST**

After the `VALID_UNIT_TYPES.includes(unitType)` validation (`route.ts:64-66`) and the paymentMethod validation, insert the same `canAccessUnit(user, unitType)` guard.

- [ ] **Step 3: toko/stock-in POST**

`productId` is in the body; the product is fetched inside the tx (`route.ts:22`). Hoist a pre-tx read for the scope check. After the `productId/quantity` validation (`route.ts:17-19`), insert:

```ts
const scopeProduct = await prisma.storeProduct.findUnique({
  where: { id: productId },
  select: { id: true, unitType: true },
});
if (!scopeProduct) {
  return NextResponse.json({ message: "Produk tidak ditemukan" }, { status: 404 });
}
const unitOk = canAccessUnit(user, scopeProduct.unitType || "toko");
if (!unitOk.allowed) {
  return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
}
```

Leave the tx body untouched (it re-fetches the product for the HPP update).

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new tsc errors in these 3 files; suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/mobile/toko/route.ts src/app/api/mobile/unit-layanan/route.ts src/app/api/mobile/toko/stock-in/route.ts
git commit -m "fix(mobile-rbac): enforce unit scope on 3 POS/unit write routes"
```

---

### Task 5: Pre-deploy null-scope diagnostic

**Files:**
- Create: `scripts/diagnose-mobile-staff-null-scope.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`. Read-only.

- [ ] **Step 1: Create the diagnostic script**

Create `scripts/diagnose-mobile-staff-null-scope.ts`:

```ts
/**
 * Pre-deploy read-only check for Fase 4b (mobile RBAC scope).
 * Fail-closed scope checks deny non-operator staff whose branchId/unitType is null.
 * This script lists such users so they can be fixed BEFORE deploy (otherwise they
 * get 403 on scoped routes).
 *
 * Run: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-staff-null-scope.ts
 */
import prisma from "../src/lib/prisma";

async function main() {
  const staff = await prisma.user.findMany({
    where: { role: { name: { in: ["admin", "admin_sp", "kasir"] } }, isActive: true },
    include: { role: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  const nullBranch = staff.filter((u) => u.branchId == null);
  // admin & kasir require unitType; admin_sp is simpan_pinjam-scoped (unitType may be null in legacy rows)
  const nullUnit = staff.filter(
    (u) => (u.role.name === "admin" || u.role.name === "kasir") && (u.unitType == null || u.unitType === "")
  );

  console.log(`\n=== Staff null-scope diagnostic (Fase 4b) ===`);
  console.log(`Active staff (admin/admin_sp/kasir): ${staff.length}`);
  console.log(`With null branchId (would 403 on SP routes): ${nullBranch.length}`);
  for (const u of nullBranch) {
    console.log(`  - id=${u.id} ${u.email} role=${u.role.name} unitType=${u.unitType ?? "null"}`);
  }
  console.log(`admin/kasir with null unitType (would 403 on unit routes): ${nullUnit.length}`);
  for (const u of nullUnit) {
    console.log(`  - id=${u.id} ${u.email} role=${u.role.name} branchId=${u.branchId ?? "null"}`);
  }
  console.log(`\n${nullBranch.length + nullUnit.length === 0 ? "OK: no null-scope staff." : "ACTION: set branchId/unitType for the users above before deploy."}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/diagnose-mobile-staff-null-scope.ts
git commit -m "chore(mobile-rbac): pre-deploy null-scope diagnostic script"
```

(Run the script against prod Neon before deploying: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-staff-null-scope.ts`. If it reports null-scope staff, fix their `branchId`/`unitType` first — else they will receive 403 on scoped routes.)

---

## Notes for the final whole-branch review

- Verify no role membership was changed on any of the 8 routes (only scope checks added).
- Verify kompen-disburse and stock-in still pass their existing transaction logic (hoisted reads do not replace the tx reads).
- Verify all scope denials use the generic 403 message (no `reason` leak).
- Confirm the diagnostic was run against prod and any null-scope staff were remediated before the deploy push.
