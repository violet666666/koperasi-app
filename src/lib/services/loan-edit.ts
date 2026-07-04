/**
 * Pure loan-edit helpers (Fase 8b).
 *
 * T1 — `recalcLoanFinancials`: deterministic recalculation of a loan's derived
 * financial fields from user-provided inputs. Faithful port of the recalc +
 * validation block of `src/app/api/loans/[id]/route.ts` PUT (lines 122-167).
 * The math is the contract — behavior-preserving; do NOT "fix" the formulas
 * here without explicit coordination (money-critical).
 *
 * T2 — `applyLoanEdit`: the full Prisma-backed orchestrator that the web PUT
 * (and, in T3, the mobile route) calls. It owns fetch + status-active guard +
 * date-validity + the `$transaction` schedule-regen; it delegates the 6
 * numeric business-rule guards to `recalcLoanFinancials`, letting
 * `LoanEditValidationError` propagate to the caller (which maps it → HTTP 400).
 */

import { addMonths } from "@/lib/date-helpers";
import prisma from "@/lib/prisma";

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

// ====================================================================
// T2 — applyLoanEdit: Prisma-backed orchestrator (shared by web + mobile)
// ====================================================================

/**
 * Result of `applyLoanEdit`. The fields are chosen so the route can build the
 * byte-identical HTTP response (`updatedLoan`, `changes`) and the audit log
 * entry (`oldLoan`, `newValues`) without re-fetching.
 */
export interface LoanEditResult {
  /** Re-fetched loan with member/schedules/payments/branch/application included. */
  updatedLoan: any;
  /** Human-readable change lines (e.g. "Pokok: Rp 5.000.000 → Rp 6.000.000"). */
  changes: string[];
  /** The loan record as it was BEFORE the edit (for audit oldData). */
  oldLoan: any;
  /** The three core inputs that were applied (for audit newData). */
  newValues: { principal: number; tenor: number; rate: number };
  /** Whether the loan had any non-voided payments (used for log/telemetry). */
  hasPayments: boolean;
}

/** Private helper: format IDR for the change-summary lines. */
function formatRp(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

/**
 * Apply a loan edit: fetch → eligibility → validate → recalc → atomic
 * schedule-regen → build change-summary. Faithful MOVE of web PUT
 * `src/app/api/loans/[id]/route.ts` lines 91-269.
 *
 * Contract:
 * - Does NOT audit (audit stays per-route: web `logAuditFromRequest`,
 *   mobile `auditLog.create` in T3).
 * - Lets `LoanEditValidationError` propagate for the 6 numeric business-rule
 *   guards (delegated to `recalcLoanFinancials`) AND for the status-active +
 *   date-validity + 404 checks it owns. The caller maps it → HTTP 400.
 * - Preserves `lateFeePaid` from the loan record (pass-through, NOT from the
 *   recalc output) and persists `interestOutstanding` from the recalc output.
 *
 * @throws {LoanEditValidationError} 404 (loan missing), status not active,
 *         invalid date, or any of the 6 recalc guards.
 */
export async function applyLoanEdit(args: {
  loanId: number;
  body: any;
  userId: number;
}): Promise<LoanEditResult> {
  const { loanId, body } = args;

  // 1. Fetch loan + check eligibility (web 91-108)
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      _count: {
        select: { payments: { where: { status: { not: "voided" } } } },
      },
      member: { select: { name: true, memberNo: true } },
    },
  });

  if (!loan) {
    throw new LoanEditValidationError("Pinjaman tidak ditemukan.");
  }

  if (loan.status !== "active") {
    throw new LoanEditValidationError(
      `Pinjaman tidak dapat di-edit karena statusnya "${loan.status}". Hanya pinjaman aktif yang bisa di-edit.`,
    );
  }

  const hasPayments = loan._count.payments > 0;

  // 2. Extract editable fields (all optional — only update what's sent) (web 113-120)
  const newPrincipal =
    body.principalAmount !== undefined
      ? Number(body.principalAmount)
      : Number(loan.principalAmount);
  const newTenor =
    body.tenorMonths !== undefined ? Number(body.tenorMonths) : loan.tenorMonths;
  const newRate =
    body.interestRate !== undefined
      ? Number(body.interestRate)
      : Number(loan.interestRate);
  const newDisbursementDate = body.disbursementDate
    ? new Date(body.disbursementDate)
    : loan.disbursementDate;
  const newFirstDueDate = body.firstDueDate
    ? new Date(body.firstDueDate)
    : loan.firstDueDate;
  const newPrincipalPaid =
    body.principalPaid !== undefined
      ? Number(body.principalPaid)
      : Number(loan.principalPaid);
  const newInterestPaid =
    body.interestPaid !== undefined
      ? Number(body.interestPaid)
      : Number(loan.interestPaid);

  // 3. Date-validity guards (web 132-137) — NOT owned by recalcLoanFinancials.
  if (isNaN(newDisbursementDate.getTime())) {
    throw new LoanEditValidationError("Tanggal Cair tidak valid.");
  }
  if (isNaN(newFirstDueDate.getTime())) {
    throw new LoanEditValidationError("Jatuh Tempo Pertama tidak valid.");
  }

  // 4. lateFeePaid from the loan record (pass-through — web 158).
  const existingLateFeePaid = Number(loan.lateFeePaid) || 0;

  // 5. Recalculate financials — ALSO performs the 6 numeric business-rule
  //    guards (principal>0, 1<=tenor<=120, 0<=rate<=100, principalPaid>=0,
  //    interestPaid>=0, principalPaid<=principal). Throws
  //    LoanEditValidationError on violation (caller → HTTP 400). Replaces the
  //    web route's separate validation block (lines 122-146) + recalc (148-167).
  const fin = recalcLoanFinancials({
    principal: newPrincipal,
    tenor: newTenor,
    rate: newRate,
    firstDueDate: newFirstDueDate,
    principalPaid: newPrincipalPaid,
    interestPaid: newInterestPaid,
    lateFeePaid: existingLateFeePaid,
  });

  // 6. Atomic Transaction — update loan + regenerate schedules (web 172-261)
  const result = await prisma.$transaction(async (tx) => {
    // 6a. If payments exist, delete allocations first (FK dependency), then schedules
    if (hasPayments) {
      const scheduleIds = (
        await tx.loanSchedule.findMany({
          where: { loanId },
          select: { id: true },
        })
      ).map((s) => s.id);
      if (scheduleIds.length > 0) {
        await tx.loanPaymentAllocation.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });
      }
    }
    await tx.loanSchedule.deleteMany({
      where: { loanId },
    });

    // 6b. Update loan record — preserve paid amounts, recalculate outstanding
    const updatedLoan = await tx.loan.update({
      where: { id: loanId },
      data: {
        principalAmount: newPrincipal,
        interestAmount: fin.totalInterest,
        totalAmount: fin.totalAmount,
        adminFee: fin.adminFee,
        disbursedAmount: fin.disbursedAmount,
        tenorMonths: newTenor,
        interestRate: newRate,
        monthlyInstallment: fin.monthlyInstallment,
        principalOutstanding: fin.principalOutstanding,
        interestOutstanding: fin.interestOutstanding,
        principalPaid: newPrincipalPaid,
        interestPaid: newInterestPaid,
        lateFeePaid: existingLateFeePaid,
        disbursementDate: newDisbursementDate,
        firstDueDate: newFirstDueDate,
        lastDueDate: fin.lastDueDate,
      },
      include: {
        member: { select: { id: true, memberNo: true, name: true } },
        schedules: { orderBy: { installmentNo: "asc" } },
      },
    });

    // 6c. Generate new schedules — mark already-paid installments
    const schedules = [];
    for (let i = 1; i <= newTenor; i++) {
      const dueDate = addMonths(newFirstDueDate, i - 1);
      const isPaid = i <= fin.paidInstallmentCount;

      schedules.push({
        loanId,
        installmentNo: i,
        dueDate,
        principalAmount: Math.floor(newPrincipal / newTenor),
        interestAmount: Math.floor(fin.totalInterest / newTenor),
        totalAmount: Math.floor(fin.totalAmount / newTenor),
        principalPaid: isPaid ? Math.floor(newPrincipal / newTenor) : 0,
        interestPaid: isPaid ? Math.floor(fin.totalInterest / newTenor) : 0,
        status: isPaid ? ("paid" as const) : ("pending" as const),
        paidDate: isPaid ? dueDate : null,
      });
    }

    // Fix last installment rounding
    if (schedules.length > 0) {
      const last = schedules[schedules.length - 1];
      const installedPrincipal =
        Math.floor(newPrincipal / newTenor) * newTenor;
      const installedInterest =
        Math.floor(fin.totalInterest / newTenor) * newTenor;
      last.principalAmount += newPrincipal - installedPrincipal;
      last.interestAmount += fin.totalInterest - installedInterest;
      last.totalAmount = last.principalAmount + last.interestAmount;
    }

    await tx.loanSchedule.createMany({ data: schedules });

    // Re-fetch with schedules included
    const finalLoan = await tx.loan.findUnique({
      where: { id: loanId },
      include: {
        member: { select: { id: true, memberNo: true, name: true } },
        schedules: { orderBy: { installmentNo: "asc" } },
        payments: { orderBy: { paymentDate: "desc" }, take: 10 },
        branch: { select: { id: true, name: true } },
        application: true,
      },
    });

    return finalLoan;
  });

  // 7. Build change summary (web 264-269)
  const changes: string[] = [];
  if (body.principalAmount !== undefined)
    changes.push(
      `Pokok: ${formatRp(Number(loan.principalAmount))} → ${formatRp(newPrincipal)}`,
    );
  if (body.tenorMonths !== undefined)
    changes.push(`Tenor: ${loan.tenorMonths} → ${newTenor} bulan`);
  if (body.interestRate !== undefined)
    changes.push(`Bunga: ${loan.interestRate}% → ${newRate}%`);
  if (body.disbursementDate) changes.push(`Tgl Cair: diperbarui`);
  if (body.firstDueDate) changes.push(`Jatuh Tempo Pertama: diperbarui`);

  return {
    updatedLoan: result,
    changes,
    oldLoan: loan,
    newValues: { principal: newPrincipal, tenor: newTenor, rate: newRate },
    hasPayments,
  };
}
