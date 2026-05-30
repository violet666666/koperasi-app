import { describe, it, expect } from "vitest";
import { computePeakHours, computeProfitFromItems } from "@/lib/services/manajemen-unit";

describe("computePeakHours", () => {
  const WIB_OFFSET = 7 * 60; // 420 minutes

  it("groups records by WIB hour", () => {
    // UTC 01:00 = WIB 08:00, UTC 05:00 = WIB 12:00
    const records = [
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 },
      { date: new Date("2026-05-30T01:30:00Z"), amount: 20000 },
      { date: new Date("2026-05-30T05:00:00Z"), amount: 15000 },
    ];
    const result = computePeakHours(records, WIB_OFFSET);

    expect(result.find(h => h.hour === 8)?.transactions).toBe(2);
    expect(result.find(h => h.hour === 8)?.revenue).toBe(30000);
    expect(result.find(h => h.hour === 12)?.transactions).toBe(1);
    expect(result.find(h => h.hour === 12)?.revenue).toBe(15000);
  });

  it("ignores records outside business hours (6–22)", () => {
    // UTC 22:00 = WIB 05:00 (before 06:00)
    // UTC 16:00 = WIB 23:00 (after 22:00)
    const records = [
      { date: new Date("2026-05-29T22:00:00Z"), amount: 5000 },
      { date: new Date("2026-05-30T16:00:00Z"), amount: 10000 },
    ];
    const result = computePeakHours(records, WIB_OFFSET);

    expect(result.every(h => h.transactions === 0)).toBe(true);
  });

  it("returns all business hours (6–22) even with no data", () => {
    const result = computePeakHours([], WIB_OFFSET);

    expect(result).toHaveLength(17); // hours 6 through 22 inclusive
    expect(result.every(h => h.transactions === 0)).toBe(true);
    expect(result[0].hour).toBe(6);
    expect(result[16].hour).toBe(22);
  });

  it("identifies peak hour by transaction count", () => {
    const records = [
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T01:00:00Z"), amount: 10000 }, // WIB 08:00
      { date: new Date("2026-05-30T04:00:00Z"), amount: 50000 }, // WIB 11:00
    ];
    const result = computePeakHours(records, WIB_OFFSET);
    const peak = result.reduce((max, h) => h.transactions > max.transactions ? h : max, result[0]);

    expect(peak.hour).toBe(8);
    expect(peak.transactions).toBe(3);
  });
});

describe("computeProfitFromItems", () => {
  it("computes total profit and per-product breakdown", () => {
    const items = [
      { unitPrice: 15000, costPrice: 8000, quantity: 2, productId: 1 },
      { unitPrice: 10000, costPrice: 5000, quantity: 3, productId: 2 },
      { unitPrice: 15000, costPrice: 8000, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(36000); // (7000×2) + (5000×3) + (7000×1)
    expect(result.productProfits.get(1)?.profit).toBe(21000); // 7000×3
    expect(result.productProfits.get(2)?.profit).toBe(15000); // 5000×3
    expect(result.productProfits.get(1)?.revenue).toBe(45000); // 15000×3
  });

  it("handles zero cost price (100% margin)", () => {
    const items = [
      { unitPrice: 10000, costPrice: 0, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(10000);
  });

  it("handles negative profit (selling below cost)", () => {
    const items = [
      { unitPrice: 5000, costPrice: 8000, quantity: 1, productId: 1 },
    ];
    const result = computeProfitFromItems(items);

    expect(result.todayProfit).toBe(-3000);
  });

  it("handles empty items array", () => {
    const result = computeProfitFromItems([]);

    expect(result.todayProfit).toBe(0);
    expect(result.productProfits.size).toBe(0);
  });
});
