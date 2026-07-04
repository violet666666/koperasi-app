# Mobile Loan Edit — Implementation Plan (Fase 8b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile loan-edit parity — edit an active loan's 7 fields (regenerates schedule + recomputes outstanding), built DRY via shared `recalcLoanFinancials` (pure, tested) + `applyLoanEdit` (the `$transaction` core) that web + mobile both call.

**Architecture:** Extract the web `PUT /api/loans/[id]` core into `src/lib/services/loan-edit.ts`; refactor the web route to call it (behavior-preserving); new mobile route (JWT + operator/admin_sp + `canAccessBranch`) calls the same helper; mobile form screen + nav. Highest money-integrity fase — the pure recalc unit test is the refactor anchor.

**Tech Stack:** Next.js route handlers, Prisma 6, Vitest, Expo 55 / RN 0.83.

**Spec:** `docs/superpowers/specs/2026-07-04-mobile-loan-edit-design.md`

## Global Constraints (verbatim from spec)

- **DRY:** `recalcLoanFinancials` + `applyLoanEdit` in `src/lib/services/loan-edit.ts` = single source of truth. Web + mobile both call. No duplicated money formulas.
- **Web PUT refactor is MECHANICAL + BEHAVIOR-PRESERVING.** Auth (session, operator/admin_sp) + catch (P2002/P2025/500) stay in the route; the core (fetch+validate+recalc+$transaction+regen) moves to `applyLoanEdit`. Response shape byte-identical.
- **`recalcLoanFinancials` formulas** (mirror web PUT lines 148-167 exactly): `adminFee=round(principal*0.02)`; `interestPerMonth=round(principal*rate/100)`; `totalInterest=interestPerMonth*tenor`; `totalAmount=principal+totalInterest`; `monthlyInstallment=round(principal/tenor)+interestPerMonth`; `disbursedAmount=principal-adminFee`; `principalOutstanding=max(0,principal-principalPaid)`; `interestOutstanding=max(0,totalInterest-interestPaid)`; `monthlyPrincipal=floor(principal/tenor)`; `paidInstallmentCount=monthlyPrincipal>0?min(tenor,floor(principalPaid/monthlyPrincipal)):0`; `lastDueDate=addMonths(firstDueDate,tenor-1)`.
- **RBAC:** mobile PUT gate `["operator","admin_sp"]` (NOT admin/kasir — matches web) + `canAccessBranch(user, loan.branchId).allowed` (operator bypass, fail-closed 403). **Use `.allowed`** (ScopeDecision — Fase 7a lesson).
- `LoanEditValidationError` (typed) for 400 cases (not found, not active, invalid fields); routes map to HTTP 400.
- **Audit per-route** (NOT in applyLoanEdit): web keeps `logAuditFromRequest(request, session, ...)`; mobile uses `prisma.auditLog.create({ data: { action:"UPDATE", module:"Pinjaman", description, userId, userName, userRole, status:"success" } })`.
- `params: Promise<...>` + `await params` in mobile routes (Next.js async-params).
- Loan must be `status:"active"` (applyLoanEdit enforces).
- `addMonths` helper — use the SAME one the web route imports (confirm its path at impl time; the helper + applyLoanEdit must use it consistently).
- `log.*` only in the mobile screen; `console.error` in server routes.
- `branch` = `railway-migration` (API auto-deploys on push; screen ships via EAS build #5).

---

### Task 1: `recalcLoanFinancials` pure helper + tests (TDD)

**Files:**
- Create: `src/lib/services/loan-edit.ts` (starts with `recalcLoanFinancials` + `LoanEditValidationError` + the input/output interfaces; T2 appends `applyLoanEdit`)
- Test: `src/__tests__/loan-edit.test.ts`

- [ ] **Step 1: Read the source math** — `src/app/api/loans/[id]/route.ts` PUT lines 148-167 (the recalc block) + confirm the `addMonths` import path. Faithful extraction.

- [ ] **Step 2: Write the failing tests** in `src/__tests__/loan-edit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { recalcLoanFinancials } from "@/lib/services/loan-edit";

describe("recalcLoanFinancials", () => {
  const firstDue = new Date("2026-02-05");
  const base = { principal: 1_000_000, tenor: 10, rate: 1, firstDueDate: firstDue, principalPaid: 0, interestPaid: 0, lateFeePaid: 0 };

  it("adminFee = 2% of principal (rounded)", () => {
    expect(recalcLoanFinancials(base).adminFee).toBe(20_000);
  });
  it("interestPerMonth = round(principal * rate/100)", () => {
    expect(recalcLoanFinancials(base).interestPerMonth).toBe(10_000); // 1M * 1%
  });
  it("totalInterest = interestPerMonth * tenor", () => {
    expect(recalcLoanFinancials(base).totalInterest).toBe(100_000);
  });
  it("monthlyInstallment = round(principal/tenor) + interestPerMonth", () => {
    expect(recalcLoanFinancials(base).monthlyInstallment).toBe(110_000); // 100k + 10k
  });
  it("disbursedAmount = principal - adminFee", () => {
    expect(recalcLoanFinancials(base).disbursedAmount).toBe(980_000);
  });
  it("principalOutstanding = principal - principalPaid (clamped >=0)", () => {
    expect(recalcLoanFinancials({ ...base, principalPaid: 300_000 }).principalOutstanding).toBe(700_000);
    expect(recalcLoanFinancials({ ...base, principalPaid: 1_500_000 }).principalOutstanding).toBe(0); // clamp
  });
  it("paidInstallmentCount from principalPaid / monthlyPrincipal", () => {
    // monthlyPrincipal = floor(1M/10) = 100k; principalPaid 350k -> floor(3.5) = 3
    expect(recalcLoanFinancials({ ...base, principalPaid: 350_000 }).paidInstallmentCount).toBe(3);
    // fully paid -> clamped to tenor
    expect(recalcLoanFinancials({ ...base, principalPaid: 1_000_000 }).paidInstallmentCount).toBe(10);
  });
  it("lastDueDate = addMonths(firstDueDate, tenor-1)", () => {
    const r = recalcLoanFinancials(base);
    // tenor 10 -> lastDue = firstDue + 9 months = Nov 5 2026
    expect(r.lastDueDate.getMonth()).toBe(10); // November (0-indexed)
  });
  it("tenor=1 edge case", () => {
    const r = recalcLoanFinancials({ ...base, tenor: 1 });
    expect(r.paidInstallmentCount).toBeLessThanOrEqual(1);
    expect(r.lastDueDate.getMonth()).toBe(firstDue.getMonth()); // +0 months
  });
});
```
(Adjust exact expected values to match the web's actual rounding — favor matching the web's behavior; if a value differs, match the web + lock the test.)

- [ ] **Step 3: Run → FAIL** (`npx vitest run src/__tests__/loan-edit.test.ts`, module not found).
- [ ] **Step 4: Implement** `recalcLoanFinancials` + `LoanEditValidationError` (a typed Error subclass with a `statusMessage`) + the input/output interfaces in `src/lib/services/loan-edit.ts`. Faithful port of web lines 148-167. Uses `addMonths` (import the same helper the web route uses).
- [ ] **Step 5: Run → PASS** (9 tests). Match web behavior; lock it.
- [ ] **Step 6: tsc + commit**
```bash
npx tsc --noEmit
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/loan-edit.ts src/__tests__/loan-edit.test.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(loan-edit): recalcLoanFinancials pure helper + tests (Fase 8b T1)"
```

---

### Task 2: `applyLoanEdit` shared async + web PUT refactor (HIGHEST RISK — behavior-preserving)

**Files:**
- Modify: `src/lib/services/loan-edit.ts` (append `applyLoanEdit`)
- Modify: `src/app/api/loans/[id]/route.ts` (PUT delegates to helper)

- [ ] **Step 1: Read the full web PUT** (`src/app/api/loans/[id]/route.ts` lines 63-311). Boundary: session auth (66-79) + parse loanId (81-85) + catch (289-310) STAY in the route. Everything from fetch (91) through the `$transaction` return (261) + the changes-summary (264-269) MOVES into `applyLoanEdit`.

- [ ] **Step 2: Implement `applyLoanEdit`** in `src/lib/services/loan-edit.ts` — a faithful MOVE of web PUT lines 91-269:
```ts
export interface LoanEditResult { updatedLoan: any; changes: string[]; oldLoan: any; newValues: { principal: number; tenor: number; rate: number }; hasPayments: boolean; }

export async function applyLoanEdit(args: { loanId: number; body: any; userId: number }): Promise<LoanEditResult> {
  const { loanId, body, userId } = args;
  // fetch loan + _count.payments + member (web 91-97)
  // 404 if missing (throw LoanEditValidationError)
  // status active check (throw LoanEditValidationError) — web 103-108
  // extract 7 fields + validations (web 113-146) — throw LoanEditValidationError on invalid
  // recalcLoanFinancials (T1)
  // $transaction: delete allocations (if hasPayments) + schedules; update loan; regen schedules (loop, mark paid, last-rounding fix); re-fetch (web 172-261)
  // build changes[] (web 264-269)
  // return { updatedLoan: result, changes, oldLoan: loan, newValues: {principal:newPrincipal, tenor:newTenor, rate:newRate}, hasPayments }
}
```
The return object's fields must let the route build the IDENTICAL response (web 284-288: `{ data: result, message, changes }`) + audit (oldData/newData from oldLoan/newValues).

- [ ] **Step 3: Refactor the web PUT** — keep auth + parse + catch; replace the moved block with:
```ts
const { updatedLoan, changes, oldLoan, newValues } = await applyLoanEdit({ loanId, body, userId: Number((session.user as any).id) });
console.log(`[LOAN-EDIT] Loan ${oldLoan.loanNo} edited by User #${userId}. Has payments: ${??}. Changes: ${changes.join(", ")}`);
await logAuditFromRequest(request, session, {
  action: "UPDATE", module: "Pinjaman",
  description: `Pinjaman ${oldLoan.loanNo} edited. Changes: ${changes.join(", ")}`,
  targetId: loanId, targetType: "loan",
  oldData: { principalAmount: Number(oldLoan.principalAmount), tenorMonths: oldLoan.tenorMonths, interestRate: Number(oldLoan.interestRate) },
  newData: { principalAmount: newValues.principal, tenorMonths: newValues.tenor, interestRate: newValues.rate },
});
return NextResponse.json({ data: updatedLoan, message: `Pinjaman ${oldLoan.loanNo} berhasil di-edit. Jadwal angsuran (${newValues.tenor} bulan) telah di-regenerasi.`, changes });
```
(If applyLoanEdit returns `hasPayments` for the console.log, include it; else drop that log line or recompute.) Remove now-unused imports from the route (prisma math helpers that moved). **Response must be byte-identical** to pre-refactor.

- [ ] **Step 4: Verify behavior unchanged** — diff the helper's return vs the old inline response (data/changes/message). The web `pinjaman/[id]` edit dialog must work unchanged. Run `src/__tests__/loan-edit-helpers.test.ts` (the existing change-detection test) — must still pass (`buildEditPayload` untouched).
- [ ] **Step 5: tsc** (`npx tsc --noEmit`) — no new errors (clean unused imports).
- [ ] **Step 6: Re-run T1 tests** (`npx vitest run src/__tests__/loan-edit.test.ts`) — still pass.
- [ ] **Step 7: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/loan-edit.ts "src/app/api/loans/[id]/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "refactor(loan-edit): extract applyLoanEdit shared helper, web PUT uses it (Fase 8b T2)"
```

---

### Task 3: Mobile `GET` + `PUT /api/mobile/loans/[id]`

**File:** `src/app/api/mobile/loans/[id]/route.ts` (new — GET detail + PUT edit)

- [ ] **Step 1: Implement GET (detail, for the form pre-fill)** — gate operator/admin/admin_sp (a read; matches other mobile loan reads), `params: Promise<{id}>`, fetch loan by id (select the 7 editable fields + loanNo + status + branchId), 404 if missing. Return `{ data: loan }` with Decimal→Number.
- [ ] **Step 2: Implement PUT (edit)** — gate `["operator","admin_sp"]` (NOT admin/kasir); `params: Promise<{id}>` + `await params`:
```ts
const user = await getMobileUserWithScope(request);
if (!user || !["operator", "admin_sp"].includes(user.role)) return 403;
const { id } = await params;
const loanId = parseInt(id);
if (isNaN(loanId)) return 400;
// Branch scope (mobile stricter than web): pre-fetch for the gate
const existing = await prisma.loan.findUnique({ where: { id: loanId }, select: { id: true, branchId: true, status: true } });
if (!existing) return 404;
if (!canAccessBranch(user, existing.branchId).allowed) return 403;   // .allowed — ScopeDecision
try {
  const body = await request.json();
  const { updatedLoan, changes } = await applyLoanEdit({ loanId, body, userId: Number(user.id) });
  await prisma.auditLog.create({
    data: { action: "UPDATE", module: "Pinjaman",
      description: `Pinjaman diedit via Mobile. Changes: ${changes.join(", ")}`,
      userId: Number(user.id), userName: user.name, userRole: user.role, status: "success" },
  });
  return NextResponse.json({ data: updatedLoan, message: `Pinjaman berhasil di-edit. Jadwal angsuran telah di-regenerasi.`, changes });
} catch (err) {
  if (err instanceof LoanEditValidationError) return NextResponse.json({ message: err.statusMessage }, { status: 400 });
  console.error("PUT /api/mobile/loans/[id] error:", err);
  return NextResponse.json({ message: "Gagal mengedit pinjaman" }, { status: 500 });
}
```
**Verify at impl time:** `getMobileUserWithScope` from `../../middleware` (the route is at `mobile/loans/[id]/` → 2 levels). `canAccessBranch` from `@/lib/mobile-auth-scope`. `applyLoanEdit` + `LoanEditValidationError` from `@/lib/services/loan-edit`. The pre-fetch for scope is lightweight; `applyLoanEdit` re-fetches authoritatively (branchId stable, no real TOCTOU).

- [ ] **Step 3: tsc** (`npx tsc --noEmit`) — no new errors.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add "src/app/api/mobile/loans/[id]/route.ts"
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): GET + PUT /loans/[id] (edit, Fase 8b T3)"
```

---

### Task 4: `LoanEditScreen` + DaftarPinjamanScreen edit entry

**Files:**
- Create: `mobile/src/screens/operator/LoanEditScreen.tsx`
- Modify: `mobile/src/screens/operator/DaftarPinjamanScreen.tsx` (add Edit action on active-loan cards)

**Read first:** `mobile/src/screens/operator/DaftarPinjamanScreen.tsx` (existing list — loan card shape, nav), `KasBankTransaksiScreen.tsx`/`AsetFormScreen.tsx` (recent form patterns — inputs, date picker, submit, validation), `mobile/src/lib/api.ts`, `mobile/src/utils/log.ts`.

**API contracts (confirm by reading T3's routes):**
- Pre-fill → `GET /api/mobile/loans/[id]` → `{ data: loan }` (7 editable fields + loanNo + status).
- Submit → `PUT /api/mobile/loans/[id]` body `{ principalAmount?, tenorMonths?, interestRate?, principalPaid?, interestPaid?, disbursementDate?, firstDueDate? }` → 200 `{ data, message, changes }` / 400 `{ message }` (LoanEditValidationError).

**Implement:**
- Route param `loanId`. Fetch the loan (GET) on mount; pre-fill 7 fields: principalAmount, tenorMonths, interestRate, principalPaid, interestPaid, disbursementDate (date), firstDueDate (date).
- **Change-detection** (client-side): compare form vs fetched loan (7 fields); disable Submit when nothing changed. Inline (7 trivial comparisons; do NOT import the server `buildEditPayload`).
- **No live preview V1** — submit; the success toast/result shows the new monthlyInstallment (from the response `data.monthlyInstallment`) + the changes summary.
- Submit → PUT. On 200 → toast + goBack. On 400 → toast the message.
- `log.*` only.
- **DaftarPinjamanScreen**: add an "Edit" action on each ACTIVE loan card (operator/admin_sp gated via `userRole` useMemo) → `navigation.navigate("LoanEdit", { loanId })`. Hide on non-active loans.

- [ ] **Step 1: Read conventions + T3 routes (confirm GET/PUT contracts).**
- [ ] **Step 2: Implement LoanEditScreen + DaftarPinjamanScreen Edit action.**
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors. Grep `console.*` → 0.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/LoanEditScreen.tsx mobile/src/screens/operator/DaftarPinjamanScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): LoanEditScreen + DaftarPinjaman edit entry (Fase 8b T4)"
```

---

### Task 5: Nav wiring

**Files:**
- Modify: `mobile/App.tsx` — register `LoanEdit` route (lazy import + Screen).

- [ ] **Step 1: Register `LoanEdit` route** (mirror siblings). Route name `LoanEdit` must match `navigation.navigate("LoanEdit", { loanId })` exactly.
- [ ] **Step 2: tsc** (`cd mobile && npx tsc --noEmit`) → no new errors.
- [ ] **Step 3: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/App.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): wire LoanEdit nav (Fase 8b T5)"
```

---

## After T1–T5 → final opus review + push
1. Final whole-branch opus review — **#1 check: web PUT behavior-preservation** (response byte-identical, edit dialog unchanged) + recalc math unchanged + `applyLoanEdit` shared correctly + mobile gate/scope + `LoanEditValidationError` → 400.
2. Full test suite (`npm test`) — expect baseline + the new `recalcLoanFinancials` tests; existing `loan-edit-helpers.test.ts` still passes.
3. `finishing-a-development-branch`: push `railway-migration` (deploys the mobile route + the web refactor). Screen ships via EAS build #5.

## Notes for the final whole-branch review
- **Web PUT behavior-preservation (#1):** the helper's return + the route's response construction must be byte-identical to pre-refactor (data/message/changes). The web `pinjaman/[id]` edit dialog must work unchanged.
- Confirm `recalcLoanFinancials` math matches the web's lines 148-167 exactly (the T1 test is the guard).
- Confirm mobile PUT gate `operator/admin_sp` + `canAccessBranch(...).allowed` (not boolean); admin/kasir excluded.
- Confirm `applyLoanEdit` is the single source (web + mobile both call; no duplicated money formulas).
- Confirm `LoanEditValidationError` → 400 on the mobile route (not 500).
- Confirm the mobile screen sends the 7 PUT fields with exact names; field-contract audit (the recurring check).
- Confirm `buildEditPayload` (existing) untouched + its test passes.
- Confirm no raw `console.*` in the screen; `console.error` only in server routes.
