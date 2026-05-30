import { describe, it, expect } from "vitest";
import { aggregateUnitStats, type RawUnitStats } from "@/lib/services/manajemen-unit";

describe("aggregateUnitStats", () => {
  it("returns correct totals from raw stats", () => {
    const raw: RawUnitStats[] = [
      { unitType: "toko", productCount: 150, activeProductCount: 120, todayTransactionCount: 10, todayRevenue: 500000, yesterdayRevenue: 400000, lowStockCount: 3 },
      { unitType: "cuci_mobil", productCount: 0, activeProductCount: 0, todayTransactionCount: 5, todayRevenue: 250000, yesterdayRevenue: 200000, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.totalUnits).toBe(2);
    expect(result.totalProducts).toBe(150);
    expect(result.totalTransactions).toBe(15);
    expect(result.totalRevenue).toBe(750000);
  });

  it("maps unitType to label and category correctly", () => {
    const raw: RawUnitStats[] = [
      { unitType: "toko", productCount: 10, activeProductCount: 8, todayTransactionCount: 1, todayRevenue: 100, yesterdayRevenue: 0, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.units[0].label).toBe("Toko PRIMKOPPOL");
    expect(result.units[0].category).toBe("store");
    expect(result.units[0].slug).toBe("toko");
  });

  it("handles empty stats", () => {
    const result = aggregateUnitStats([]);

    expect(result.totalUnits).toBe(0);
    expect(result.totalProducts).toBe(0);
    expect(result.totalTransactions).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.units).toEqual([]);
  });

  it("handles unknown unitType with fallback", () => {
    const raw: RawUnitStats[] = [
      { unitType: "new_unit", productCount: 5, activeProductCount: 3, todayTransactionCount: 2, todayRevenue: 1000, yesterdayRevenue: 500, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.units[0].label).toBe("new_unit");
    expect(result.units[0].slug).toBe("new-unit");
    expect(result.units[0].category).toBe("service");
  });

  it("handles units with zero transactions", () => {
    const raw: RawUnitStats[] = [
      { unitType: "fitness", productCount: 0, activeProductCount: 0, todayTransactionCount: 0, todayRevenue: 0, yesterdayRevenue: 0, lowStockCount: 0 },
      { unitType: "laundry", productCount: 0, activeProductCount: 0, todayTransactionCount: 0, todayRevenue: 0, yesterdayRevenue: 0, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.totalTransactions).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalUnits).toBe(2);
  });

  it("sums products across all units", () => {
    const raw: RawUnitStats[] = [
      { unitType: "toko", productCount: 100, activeProductCount: 80, todayTransactionCount: 5, todayRevenue: 500, yesterdayRevenue: 450, lowStockCount: 2 },
      { unitType: "cafe_lsp", productCount: 35, activeProductCount: 30, todayTransactionCount: 8, todayRevenue: 300, yesterdayRevenue: 350, lowStockCount: 1 },
      { unitType: "resto", productCount: 50, activeProductCount: 45, todayTransactionCount: 12, todayRevenue: 800, yesterdayRevenue: 700, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.totalProducts).toBe(185);
    expect(result.totalTransactions).toBe(25);
    expect(result.totalRevenue).toBe(1600);
  });

  it("computes positive revenue trend", () => {
    const raw: RawUnitStats[] = [
      { unitType: "toko", productCount: 10, activeProductCount: 8, todayTransactionCount: 5, todayRevenue: 500000, yesterdayRevenue: 400000, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.units[0].revenueTrend).toBe(25); // +25%
  });

  it("computes negative revenue trend", () => {
    const raw: RawUnitStats[] = [
      { unitType: "cafe_lsp", productCount: 10, activeProductCount: 8, todayTransactionCount: 3, todayRevenue: 300000, yesterdayRevenue: 500000, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.units[0].revenueTrend).toBe(-40); // -40%
  });

  it("returns null trend when yesterday revenue is zero", () => {
    const raw: RawUnitStats[] = [
      { unitType: "fitness", productCount: 0, activeProductCount: 0, todayTransactionCount: 2, todayRevenue: 100000, yesterdayRevenue: 0, lowStockCount: 0 },
    ];

    const result = aggregateUnitStats(raw);

    expect(result.units[0].revenueTrend).toBeNull();
  });
});

