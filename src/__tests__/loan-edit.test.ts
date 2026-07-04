import { describe, it, expect } from "vitest";
import { recalcLoanFinancials, LoanEditValidationError } from "@/lib/services/loan-edit";

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
    // ADJUSTED to match web: principalPaid > principal is REJECTED (web line 144-146),
    // not silently clamped. The clamp (Math.max(0, ...)) only protects against
    // rounding-edge cases at exactly the boundary; over-payment is a 400.
    expect(() => recalcLoanFinancials({ ...base, principalPaid: 1_500_000 })).toThrow(LoanEditValidationError);
    // Exact-equality boundary is allowed (principalPaid === principal → outstanding 0).
    expect(recalcLoanFinancials({ ...base, principalPaid: 1_000_000 }).principalOutstanding).toBe(0);
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
