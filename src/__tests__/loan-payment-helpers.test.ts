import { describe, it, expect } from "vitest";
import { allocatePayment, type ScheduleInput } from "@/lib/loan-payment-helpers";

function sched(over: Partial<ScheduleInput> & { id: number }): ScheduleInput {
  return {
    id: over.id,
    installmentNo: over.installmentNo ?? over.id,
    principalAmount: over.principalAmount ?? 1_000_000,
    principalPaid: over.principalPaid ?? 0,
    interestAmount: over.interestAmount ?? 200_000,
    interestPaid: over.interestPaid ?? 0,
    lateFee: over.lateFee ?? 0,
    lateFeePaid: over.lateFeePaid ?? 0,
  };
}

describe("allocatePayment", () => {
  it("allocates a full single-schedule regular payment (interest before principal)", () => {
    const r = allocatePayment([sched({ id: 1 })], 1_200_000, false);
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0]).toMatchObject({ scheduleId: 1, principalAmount: 1_000_000, interestAmount: 200_000, lateFeeAmount: 0 });
    expect(r.totalPrincipal).toBe(1_000_000);
    expect(r.totalInterest).toBe(200_000);
    expect(r.totalLateFee).toBe(0);
  });

  it("allocates a partial payment — does not over-allocate", () => {
    const r = allocatePayment([sched({ id: 1 })], 500_000, false);
    // 500k → pays interest (200k) first, then 300k principal
    expect(r.allocations[0]).toMatchObject({ scheduleId: 1, interestAmount: 200_000, principalAmount: 300_000 });
    expect(r.totalPrincipal + r.totalInterest + r.totalLateFee).toBe(500_000);
  });

  it("spills across schedules FIFO when amount exceeds schedule 1", () => {
    const r = allocatePayment([sched({ id: 1 }), sched({ id: 2 })], 1_500_000, false);
    // schedule 1 due 1.2M (paid fully), 300k spills to schedule 2 (interest 200k + principal 100k)
    expect(r.allocations).toHaveLength(2);
    expect(r.allocations[0].scheduleId).toBe(1);
    expect(r.allocations[1].scheduleId).toBe(2);
    expect(r.allocations[1]).toMatchObject({ interestAmount: 200_000, principalAmount: 100_000 });
    expect(r.totalPrincipal + r.totalInterest).toBe(1_500_000);
  });

  it("early settlement zeroes interest — principal only", () => {
    const r = allocatePayment([sched({ id: 1 })], 1_000_000, true);
    expect(r.allocations[0]).toMatchObject({ principalAmount: 1_000_000, interestAmount: 0 });
    expect(r.totalInterest).toBe(0);
  });

  it("pays late fee before interest and principal", () => {
    const r = allocatePayment([sched({ id: 1, lateFee: 50_000 })], 100_000, false);
    // 100k → late fee 50k first, then interest 50k (of 200k due)
    expect(r.allocations[0]).toMatchObject({ lateFeeAmount: 50_000, interestAmount: 50_000, principalAmount: 0 });
    expect(r.totalLateFee).toBe(50_000);
  });

  it("handles already-partially-paid schedule — only remaining due", () => {
    const r = allocatePayment([sched({ id: 1, principalPaid: 600_000, interestPaid: 150_000 })], 450_000, false);
    // remaining due: principal 400k + interest 50k = 450k → paid fully
    expect(r.allocations[0]).toMatchObject({ principalAmount: 400_000, interestAmount: 50_000 });
  });

  it("returns empty allocations when no schedules", () => {
    const r = allocatePayment([], 500_000, false);
    expect(r.allocations).toEqual([]);
    expect(r.totalPrincipal).toBe(0);
  });

  it("never over-allocates beyond amount (multi-schedule, amount < total due)", () => {
    const r = allocatePayment([sched({ id: 1 }), sched({ id: 2 }), sched({ id: 3 })], 1_000_000, false);
    expect(r.totalPrincipal + r.totalInterest + r.totalLateFee).toBeLessThanOrEqual(1_000_000);
  });
});
