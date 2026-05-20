import { describe, it, expect } from "vitest";
import { computeUnitDetail, type RawUnitDetail } from "@/lib/services/manajemen-unit";

describe("computeUnitDetail", () => {
  it("computes average transaction value", () => {
    const result = computeUnitDetail({
      productCount: 50,
      activeProductCount: 40,
      totalStock: 500,
      lowStockCount: 2,
      todayTransactions: 10,
      todayRevenue: 500000,
      weekRevenue: [],
    });

    expect(result.avgTransactionValue).toBe(50000);
  });

  it("returns 0 avg when no transactions", () => {
    const result = computeUnitDetail({
      productCount: 0,
      activeProductCount: 0,
      totalStock: 0,
      lowStockCount: 0,
      todayTransactions: 0,
      todayRevenue: 0,
      weekRevenue: [],
    });

    expect(result.avgTransactionValue).toBe(0);
  });

  it("rounds avg to nearest integer", () => {
    const result = computeUnitDetail({
      productCount: 0,
      activeProductCount: 0,
      totalStock: 0,
      lowStockCount: 0,
      todayTransactions: 3,
      todayRevenue: 100000,
      weekRevenue: [],
    });

    expect(result.avgTransactionValue).toBe(33333);
  });

  it("preserves week revenue data", () => {
    const weekData = [
      { date: "2026-05-09", revenue: 100000, transactions: 5 },
      { date: "2026-05-10", revenue: 200000, transactions: 8 },
    ];

    const result = computeUnitDetail({
      productCount: 10,
      activeProductCount: 8,
      totalStock: 100,
      lowStockCount: 1,
      todayTransactions: 5,
      todayRevenue: 250000,
      weekRevenue: weekData,
    });

    expect(result.weekRevenue).toEqual(weekData);
  });
});
