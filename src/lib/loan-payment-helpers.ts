/**
 * Pure helpers for loan payment allocation. Extracted from the (web) loan-payment
 * flow for unit testing. Matches the algorithm in src/app/api/loans/[id]/payments/route.ts.
 */

export interface ScheduleInput {
  id: number;
  installmentNo: number;
  principalAmount: number;
  principalPaid: number;
  interestAmount: number;
  interestPaid: number;
  lateFee: number;
  lateFeePaid: number;
}

export interface Allocation {
  scheduleId: number;
  principalAmount: number;
  interestAmount: number;
  lateFeeAmount: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  totalPrincipal: number;
  totalInterest: number;
  totalLateFee: number;
}

/**
 * FIFO allocation across schedules (asc installmentNo).
 * Per schedule, order of payment: late fee → interest → principal.
 * Early settlement zeroes interest (policy: only principal + penalty).
 *
 * `schedules` MUST already be filtered (pending/partial/overdue) + sorted by
 * installmentNo asc by the caller. Pure; unit-tested.
 */
export function allocatePayment(
  schedules: ScheduleInput[],
  amount: number,
  isEarlySettlement: boolean,
): AllocationResult {
  let remaining = amount;
  const allocations: Allocation[] = [];
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalLateFee = 0;

  for (const s of schedules) {
    if (remaining <= 0) break;

    const principalDue = s.principalAmount - s.principalPaid;
    const interestDue = s.interestAmount - s.interestPaid;
    const lateFeeDue = s.lateFee - s.lateFeePaid;
    const effectiveInterestDue = isEarlySettlement ? 0 : interestDue;
    const totalDue = principalDue + effectiveInterestDue + lateFeeDue;
    if (totalDue <= 0) continue;

    const payAmount = Math.min(remaining, totalDue);
    const lateFeePay = Math.min(payAmount, lateFeeDue);
    const interestPay = Math.min(payAmount - lateFeePay, effectiveInterestDue);
    const principalPay = payAmount - lateFeePay - interestPay;

    allocations.push({
      scheduleId: s.id,
      principalAmount: principalPay,
      interestAmount: interestPay,
      lateFeeAmount: lateFeePay,
    });
    totalPrincipal += principalPay;
    totalInterest += interestPay;
    totalLateFee += lateFeePay;
    remaining -= payAmount;
  }

  return { allocations, totalPrincipal, totalInterest, totalLateFee };
}
