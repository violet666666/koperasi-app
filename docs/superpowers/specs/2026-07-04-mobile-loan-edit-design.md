# Mobile Loan Edit — Design Spec (Fase 8b)

**Date:** 2026-07-04
**Status:** Design approved (shared-helper DRY extraction, full parity incl. loans-with-payments); pending spec review → plan
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build #5)
**Phase:** Fase 8b (second Fase 8 parity sub-feature). Follows Fase 8a. Web lets operator/admin_sp edit an active loan's 7 fields; mobile has no loan edit at all.

## Problem

Mobile operators can view loans (`DaftarPinjamanScreen`) but cannot edit one — e.g. fix a tenor, correct an imported loan's paid amounts, or adjust a rate. They must use the web. The web edit is the most money-critical write in the app: editing a loan regenerates its entire schedule + recomputes outstanding balances.

## Goal

Mobile loan-edit parity, built **DRY** by extracting the web `PUT /api/loans/[id]` core (pure recalc + the `$transaction` schedule-regen) into a shared helper that web + mobile both call. Full parity: edit any active loan (with or without existing payments). operator/admin_sp gated, branch-scoped on mobile (mobile stricter than web).

## Approach (decided: shared helper + full parity)

Two new exports in `src/lib/services/loan-edit.ts`:
1. **`recalcLoanFinancials(...)`** — the PURE math (adminFee, interest, monthlyInstallment, outstanding, paidInstallmentCount, lastDueDate), extracted from web PUT lines 148-167. Unit-tested (the refactor anchor).
2. **`applyLoanEdit({ loanId, body, userId })`** — the async core (fetch + eligibility + validate + recalc + `$transaction` regen schedules + return `{ updatedLoan, changes }`). Throws `LoanEditValidationError` for 400 cases. Audit stays in each route (web: `logAuditFromRequest`; mobile: `auditLog.create`).

The web `PUT /api/loans/[id]` is refactored to: session auth + `applyLoanEdit` + `logAuditFromRequest` + response (behavior-preserving, opus-verified). The new mobile `PUT /api/mobile/loans/[id]` does: JWT auth + operator/admin_sp gate + branch-scope check + `applyLoanEdit` + mobile audit + response.

**Why DRY here (more than ever):** the recalc formulas are money-critical. Duplicating them web+mobile means any formula change (e.g. the 2% adminFee) must be applied twice or schedules/outstanding silently drift. For money, drift is the worse risk — so extraction wins despite the refactor stakes.

## Components

### 8b-1 — `recalcLoanFinancials` pure helper (TDD)

**File:** `src/lib/services/loan-edit.ts` (new; starts with this pure fn + `LoanEditValidationError`; 8b-2 appends `applyLoanEdit`).

Faithful extraction of web PUT lines 148-167:
```ts
export interface LoanFinancialInput {
  principal: number; tenor: number; rate: number;
  firstDueDate: Date; principalPaid: number; interestPaid: number; lateFeePaid: number;
}
export interface LoanFinancials {
  adminFee: number; interestPerMonth: number; totalInterest: number; totalAmount: number;
  monthlyInstallment: number; disbursedAmount: number;
  principalOutstanding: number; interestOutstanding: number;
  monthlyPrincipal: number; paidInstallmentCount: number; lastDueDate: Date;
}
export function recalcLoanFinancials(i: LoanFinancialInput): LoanFinancials;
```
Formulas (mirror web exactly): `adminFee = round(principal * 0.02)`; `interestPerMonth = round(principal * rate/100)`; `totalInterest = interestPerMonth * tenor`; `totalAmount = principal + totalInterest`; `monthlyInstallment = round(principal/tenor) + interestPerMonth`; `disbursedAmount = principal - adminFee`; `principalOutstanding = max(0, principal - principalPaid)`; `interestOutstanding = max(0, totalInterest - interestPaid)`; `monthlyPrincipal = floor(principal/tenor)`; `paidInstallmentCount = monthlyPrincipal > 0 ? min(tenor, floor(principalPaid/monthlyPrincipal)) : 0`; `lastDueDate = addMonths(firstDueDate, tenor - 1)`. (`addMonths` — use the same helper the web route uses; confirm import.)

Unit tests: known principal/tenor/rate → exact adminFee/interest/monthlyInstallment/outstanding/paidInstallmentCount/lastDueDate; edge cases (tenor=1, principalPaid=0, principalPaid=principal → paidInstallmentCount=tenor).

### 8b-2 — `applyLoanEdit` shared async + web PUT refactor (behavior-preserving)

**File:** `src/lib/services/loan-edit.ts` (append); `src/app/api/loans/[id]/route.ts` (refactor PUT).

`applyLoanEdit({ loanId, body, userId })`:
1. Fetch loan (`findUnique` + `_count.payments` + member) — mirror web lines 91-97.
2. Eligibility: 404 if missing; throw `LoanEditValidationError` if `status !== "active"` (was 400 in web).
3. Extract 7 fields from body (principalAmount/tenorMonths/interestRate/principalPaid/interestPaid/disbursementDate/firstDueDate — each falls back to current) + validations (web lines 113-146). Invalid → throw `LoanEditValidationError`.
4. `recalcLoanFinancials(...)`.
5. `$transaction`: delete allocations (if hasPayments) + schedules; update loan (all recalced fields); regen schedules (loop 1..tenor, mark paid ≤ paidInstallmentCount, fix last-installment rounding); re-fetch with includes. (Web lines 172-261, moved verbatim.)
6. Build `changes[]` summary (web lines 264-269).
7. Return `{ updatedLoan: result, changes, oldLoan: loan, newValues: { principal, tenor, rate } }`. (Audit data exposed for the route to log.)

**Web PUT refactor:** session auth (lines 66-79) + parse loanId (81-85) + `const { updatedLoan, changes, oldLoan, newValues } = await applyLoanEdit({ loanId, body, userId })` + `logAuditFromRequest(...)` (using oldLoan/newValues) + response (284-288). **Behavior-preserving — response shape byte-identical.** The catch (P2002/P2025/500) stays in the route.

### 8b-3 — Mobile PUT `PUT /api/mobile/loans/[id]`

**File:** `src/app/api/loans/[id]/route.ts`? NO — mobile routes live under `src/app/api/mobile/`. Create `src/app/api/mobile/loans/[id]/route.ts` (new). Import `getMobileUserWithScope` from `../../middleware`, `canAccessBranch` from `@/lib/mobile-auth-scope`, `applyLoanEdit` + `LoanEditValidationError` from `@/lib/services/loan-edit`.

- Gate: `["operator","admin_sp"].includes(user.role)` (operator + admin_sp; NOT admin/kasir — matches web). `params: Promise<{id}>` + `await params`.
- **Branch scope (mobile stricter than web):** fetch the loan first (select `id, branchId, status`); `canAccessBranch(user, loan.branchId).allowed` → 403 if out of scope (operator bypass). (Lightweight pre-fetch for the gate; `applyLoanEdit` re-fetches authoritatively — branchId is stable, no real TOCTOU.)
- `try { const { updatedLoan, changes } = await applyLoanEdit({ loanId, body, userId: Number(user.id) }); await prisma.auditLog.create({ data: { action: "UPDATE", module: "Pinjaman", description: `Pinjaman diedit via Mobile. Changes: ${changes.join(", ")}`, userId: Number(user.id), userName: user.name, userRole: user.role, status: "success" } }); return NextResponse.json({ data: updatedLoan, message: ..., changes }); } catch (err) { if (err instanceof LoanEditValidationError) return 400 {message}; console.error; return 500; }`

### 8b-4 — `LoanEditScreen` (7-field form) + DaftarPinjamanScreen edit entry

**File:** `mobile/src/screens/operator/LoanEditScreen.tsx` (new). Route param `loanId`.
- Fetch the loan (via existing mobile loans API or a GET — confirm a mobile loan-detail GET exists; if not, fetch via the loans-operator list + filter, OR add a lightweight GET). Pre-fill 7 fields: principalAmount, tenorMonths, interestRate, principalPaid, interestPaid, disbursementDate, firstDueDate.
- **Change-detection** (client-side, disable Submit when nothing changed): compare form vs fetched loan (7 fields). Inline (don't import the server `buildEditPayload` — RN can't bundle `src/lib`; the check is 7 trivial comparisons).
- **No live preview in V1** (server recalcs authoritatively on save; the new monthlyInstallment/outstanding shown in the success toast/result). Defer client preview (would duplicate money formulas in RN).
- Submit → `PUT /api/mobile/loans/[loanId]` with the 7-field body → toast + goBack. Surface `LoanEditValidationError` messages.
- `log.*` only.
- **DaftarPinjamanScreen** (modify): add an "Edit" action on each loan card (operator/admin_sp gated, active loans only) → `navigation.navigate("LoanEdit", { loanId })`.

### 8b-5 — Nav wiring
- `mobile/App.tsx`: register `LoanEdit` route.

## RBAC
- Mobile PUT gate: operator/admin_sp (matches web; admin/kasir excluded). PLUS `canAccessBranch(user, loan.branchId).allowed` (operator bypass, fail-closed 403) — mobile stricter than web (web has no branch filter).
- Loan must be `status: "active"` (applyLoanEdit enforces).
- Dashboard/DaftarPinjamanScreen Edit button: operator/admin_sp only.

## Money-integrity (HIGHEST-risk fase)
- ✅ **DRY**: `recalcLoanFinancials` is the single source of truth for the math (web + mobile both call). `applyLoanEdit` is the single source for the schedule-regen $transaction. No duplicated money formulas.
- ✅ `$transaction` atomicity: delete allocations + schedules + update loan + regen schedules all atomic (moved verbatim from web).
- ✅ Pure `recalcLoanFinancials` unit-tested — the refactor anchor (if the math regresses during extraction, the test catches it).
- ✅ Web PUT behavior-preserving (opus-verified response byte-identical, like Fase 7b T2).
- ✅ Audit on every edit (mobile: auditLog.create with the change summary).
- ✅ Eligibility: only `active` loans editable.
- ⚠ This is the riskiest refactor in the effort (money-critical 250-line handler). Mitigation: faithful extraction + recalc unit test + opus behavior-preservation review.

## Test plan
- **Unit (Vitest):** `recalcLoanFinancials` — exact values for known inputs + edge cases (the refactor guard). If `src/__tests__/loan-edit-helpers.test.ts` (the existing change-detection test) exists, confirm it still passes.
- **Refactor safety:** web `PUT /api/loans/[id]` response byte-identical before/after extraction (the web `pinjaman/[id]` edit dialog must work unchanged). Verify structurally + manually.
- **Manual (mobile):** edit an active loan's tenor → schedule regenerates (count = new tenor); edit principalPaid on an imported loan → paidInstallmentCount/outstanding recompute; edit a loan with existing payments → allocations deleted + regen; non-active loan rejected; admin/kasir 403; admin_sp scoped to own branch (cross-branch loan → 403).

## Conventions / constraints
- `recalcLoanFinancials` + `applyLoanEdit` in `src/lib/services/loan-edit.ts` — single source of truth. Web + mobile both call.
- **Web PUT refactor is mechanical + behavior-preserving.** Auth + catch stay in the route; the core moves to `applyLoanEdit`. Response shape byte-identical.
- `LoanEditValidationError` (typed) for 400 cases; routes map to HTTP 400.
- Mobile route: `params: Promise` + `await params`; `getMobileUserWithScope`; `canAccessBranch(...).allowed` (ScopeDecision object — Fase 7a lesson).
- `log.*` only in the mobile screen; `console.error` in server routes.
- Audit: web keeps `logAuditFromRequest`; mobile uses `auditLog.create` (different auth context — that's why audit stays per-route, not in the shared helper).
- API deploys via Railway push; screen ships via EAS build #5.

## Open items to confirm at implementation time
- The `addMonths` helper the web route uses (for lastDueDate + schedule dueDates) — confirm its import path so the helper + applyLoanEdit use the same one.
- Whether a mobile loan-DETAIL GET exists (for the form pre-fill) — if not, the screen fetches the loan via the loans-operator list + filters by id, OR 8b adds a lightweight `GET /api/mobile/loans/[id]`.
- Confirm the existing `src/__tests__/loan-edit-helpers.test.ts` (change-detection) still passes after the web refactor (it tests `buildEditPayload`, which is untouched — should be fine).
