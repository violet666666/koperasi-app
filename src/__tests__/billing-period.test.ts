import { describe, it, expect } from "vitest";
import { calculateBillingPeriod, computeMemberSummary, toggleMemberItems } from "@/lib/services/billing";

describe("calculateBillingPeriod", () => {
  it("calculates period for date >= 16 (mid-month)", () => {
    const result = calculateBillingPeriod(new Date(2026, 4, 20));
    expect(result.periodStart).toEqual(new Date(2026, 4, 16));
    expect(result.periodEnd).toEqual(new Date(2026, 5, 15));
    expect(result.periodLabel).toBe("Mei-Juni 2026");
  });

  it("calculates period for date < 16 (early month)", () => {
    const result = calculateBillingPeriod(new Date(2026, 4, 5));
    expect(result.periodStart).toEqual(new Date(2026, 3, 16));
    expect(result.periodEnd).toEqual(new Date(2026, 4, 15));
    expect(result.periodLabel).toBe("April-Mei 2026");
  });

  it("handles year boundary (December → January)", () => {
    const result = calculateBillingPeriod(new Date(2026, 11, 20));
    expect(result.periodStart).toEqual(new Date(2026, 11, 16));
    expect(result.periodEnd).toEqual(new Date(2027, 0, 15));
    expect(result.periodLabel).toBe("Desember-Januari 2027");
  });

  it("handles Jan 1-15 as previous period", () => {
    const result = calculateBillingPeriod(new Date(2027, 0, 10));
    expect(result.periodStart).toEqual(new Date(2026, 11, 16));
    expect(result.periodEnd).toEqual(new Date(2027, 0, 15));
  });

  it("handles exactly the 16th (new period starts)", () => {
    const result = calculateBillingPeriod(new Date(2026, 4, 16));
    expect(result.periodStart).toEqual(new Date(2026, 4, 16));
  });

  it("handles exactly the 15th (still old period)", () => {
    const result = calculateBillingPeriod(new Date(2026, 4, 15));
    expect(result.periodEnd).toEqual(new Date(2026, 4, 15));
  });
});

describe("computeMemberSummary", () => {
  const makeItems = (memberId: number, amounts: number[], paid: boolean[]) =>
    amounts.map((amt, i) => ({
      id: i + 1, memberId, amount: amt, isMarkedPaid: paid[i],
    }));

  it("sums total and marked-paid amounts correctly", () => {
    const items = makeItems(10, [50000, 100000, 75000], [true, false, true]);
    const result = computeMemberSummary("Budi", items);
    expect(result.totalAmount).toBe(225000);
    expect(result.markedPaidAmount).toBe(125000);
  });

  it("handles all items unpaid", () => {
    const items = makeItems(10, [50000, 100000], [false, false]);
    const result = computeMemberSummary("Ani", items);
    expect(result.markedPaidAmount).toBe(0);
  });

  it("handles all items paid", () => {
    const items = makeItems(10, [50000, 100000], [true, true]);
    const result = computeMemberSummary("Cici", items);
    expect(result.markedPaidAmount).toBe(150000);
  });
});

describe("toggleMemberItems", () => {
  it("marks all items as paid", () => {
    const items = [
      { id: 1, memberId: 10, amount: 50000, isMarkedPaid: false },
      { id: 2, memberId: 10, amount: 100000, isMarkedPaid: true },
    ];
    const result = toggleMemberItems(items, true);
    expect(result.every((i) => i.isMarkedPaid)).toBe(true);
  });

  it("unmarks all items", () => {
    const items = [
      { id: 1, memberId: 10, amount: 50000, isMarkedPaid: true },
    ];
    const result = toggleMemberItems(items, false);
    expect(result.every((i) => !i.isMarkedPaid)).toBe(true);
  });
});
