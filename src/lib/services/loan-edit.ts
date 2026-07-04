/**
 * Pure loan-edit helpers (Fase 8b).
 *
 * T1 — `recalcLoanFinancials`: deterministic recalculation of a loan's derived
 * financial fields from user-provided inputs. This is a FAITHFUL port of the
 * recalc block in `src/app/api/loans/[id]/route.ts` PUT (lines 148-167).
 * The math is the contract — behavior-preserving; do NOT "fix" the formulas
 * here without explicit coordination (money-critical).
 *
 * T2 (later) will append `applyLoanEdit`, the full Prisma-backed orchestrator
 * that calls this helper.
 */

import { addMonths } from "@/lib/date-helpers";

/** Inputs required to recalculate a loan's financials. All must be supplied. */
export interface LoanFinancialInput {
  /** Pokok Pinjaman (principal), in IDR. */
  principal: number;
  /** Tenor in months (1-120). */
  tenor: number;
  /** Annual-ish interest rate as a percent (e.g. 1 = 1%). */
  rate: number;
  /** First due date; the basis for `lastDueDate` via addMonths. */
  firstDueDate: Date;
  /** Pokok Terbayar (already paid principal). */
  principalPaid: number;
  /** Bunga Terbayar (already paid interest). */
  interestPaid: number;
  /** Denda Terbayar (already paid late fee). Carried through untouched. */
  lateFeePaid: number;
}

/** Recalculated loan financials (flat interest method). */
export interface LoanFinancials {
  /** Potongan Resiko = round(principal * 2%). */
  adminFee: number;
  /** Bunga per bulan = round(principal * rate/100). */
  interestPerMonth: number;
  /** Total bunga = interestPerMonth * tenor. */
  totalInterest: number;
  /** Pokok + total bunga. */
  totalAmount: number;
  /** Angsuran per bulan = round(principal/tenor) + interestPerMonth. */
  monthlyInstallment: number;
  /** Pokok dikurangi adminFee. */
  disbursedAmount: number;
  /** Sisa pokok = max(0, principal - principalPaid). */
  principalOutstanding: number;
  /** Sisa bunga = max(0, totalInterest - interestPaid). */
  interestOutstanding: number;
  /** Pokok per bulan = floor(principal/tenor). */
  monthlyPrincipal: number;
  /** Estimasi jumlah angsuran yang sudah lunas (clamped to tenor). */
  paidInstallmentCount: number;
  /** Tanggal jatuh tempo terakhir = addMonths(firstDueDate, tenor-1). */
  lastDueDate: Date;
}

/**
 * Typed validation error thrown when a `recalcLoanFinancials` / `applyLoanEdit`
 * input violates a business rule. `statusMessage` is the user-facing message
 * intended for an HTTP 400 body (mirrors the web route's validation messages).
 */
export class LoanEditValidationError extends Error {
  /** User-facing message (e.g. "Tenor harus antara 1 - 120 bulan."). */
  readonly statusMessage: string;

  constructor(statusMessage: string) {
    super(statusMessage);
    this.name = "LoanEditValidationError";
    this.statusMessage = statusMessage;
  }
}

/**
 * Recalculate a loan's derived financials from the flat-interest method.
 *
 * Pure & deterministic: takes every input as a parameter (including
 * `firstDueDate`), performs no I/O, and has no side effects.
 *
 * Faithful port of `src/app/api/loans/[id]/route.ts` PUT lines 148-167.
 * Same formulas, same rounding, same `addMonths` helper.
 *
 * @throws {LoanEditValidationError} when a business rule is violated.
 */
export function recalcLoanFinancials(input: LoanFinancialInput): LoanFinancials {
  const {
    principal,
    tenor,
    rate,
    firstDueDate,
    principalPaid,
    interestPaid,
  } = input;

  // Validations — mirror the web route's PUT handlers (lines 122-146).
  if (principal <= 0) {
    throw new LoanEditValidationError(
      "Pokok Pinjaman harus lebih besar dari 0.",
    );
  }
  if (tenor <= 0 || tenor > 120) {
    throw new LoanEditValidationError("Tenor harus antara 1 - 120 bulan.");
  }
  if (rate < 0 || rate > 100) {
    throw new LoanEditValidationError("Suku Bunga harus antara 0% - 100%.");
  }
  if (principalPaid < 0) {
    throw new LoanEditValidationError("Pokok Terbayar tidak boleh negatif.");
  }
  if (interestPaid < 0) {
    throw new LoanEditValidationError("Bunga Terbayar tidak boleh negatif.");
  }
  if (principalPaid > principal) {
    throw new LoanEditValidationError(
      `Pokok Terbayar (${principalPaid.toLocaleString("id-ID")}) tidak boleh melebihi Pokok Pinjaman (${principal.toLocaleString("id-ID")}).`,
    );
  }

  // 6. Recalculate financials (flat interest method) — web lines 148-167.
  const adminFeePercent = 0.02; // 2% Potongan Resiko
  const adminFee = Math.round(principal * adminFeePercent);
  const interestPerMonth = Math.round(principal * (rate / 100));
  const totalInterest = interestPerMonth * tenor;
  const totalAmount = principal + totalInterest;
  const monthlyInstallment = Math.round(principal / tenor) + interestPerMonth;
  const disbursedAmount = principal - adminFee;

  // Use operator-provided paid amounts (preserves imported payment progress).
  const principalOutstanding = Math.max(0, principal - principalPaid);
  const interestOutstanding = Math.max(0, totalInterest - interestPaid);

  // Calculate how many installments are already "paid" based on paid amounts.
  const monthlyPrincipal = Math.floor(principal / tenor);
  const paidInstallmentCount =
    monthlyPrincipal > 0
      ? Math.min(tenor, Math.floor(principalPaid / monthlyPrincipal))
      : 0;

  // Calculate lastDueDate from firstDueDate (safe month arithmetic).
  const lastDueDate = addMonths(firstDueDate, tenor - 1);

  return {
    adminFee,
    interestPerMonth,
    totalInterest,
    totalAmount,
    monthlyInstallment,
    disbursedAmount,
    principalOutstanding,
    interestOutstanding,
    monthlyPrincipal,
    paidInstallmentCount,
    lastDueDate,
  };
}
