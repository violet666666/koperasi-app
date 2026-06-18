import { describe, it, expect } from "vitest";
import { mapSavingsByType, sumLoanReceivables, computeInventory, computeFixedAssets } from "@/lib/services/neraca";

describe("mapSavingsByType", () => {
  it("groups pokok/wajib/sukarela ke akun 2101/2102/2103", () => {
    const rows = [
      { productType: "pokok", balance: 1_000_000 },
      { productType: "pokok", balance: 500_000 },
      { productType: "wajib", balance: 2_000_000 },
      { productType: "sukarela", balance: 300_000 },
    ];
    const items = mapSavingsByType(rows);
    expect(items).toContainEqual({ code: "2101", name: "Simpanan Pokok", amount: 1_500_000, source: "ledger" });
    expect(items).toContainEqual({ code: "2102", name: "Simpanan Wajib", amount: 2_000_000, source: "ledger" });
    expect(items).toContainEqual({ code: "2103", name: "Simpanan Sukarela", amount: 300_000, source: "ledger" });
  });

  it("menggabungkan type lain (haji/umrah/lainnya) ke baris Simpanan Lainnya", () => {
    const items = mapSavingsByType([
      { productType: "tabungan_haji", balance: 5_000_000 },
      { productType: "tabungan_umrah", balance: 1_000_000 },
      { productType: "lainnya", balance: 200_000 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toMatch(/Simpanan Lainnya/);
    expect(items[0].amount).toBe(6_200_000);
  });

  it("array kosong → array kosong", () => {
    expect(mapSavingsByType([])).toEqual([]);
  });
});

describe("sumLoanReceivables", () => {
  it("memisahkan active (pokok+bunga) vs written_off (pokok saja, baris terpisah)", () => {
    const loans = [
      { status: "active", principalOutstanding: 10_000_000, interestOutstanding: 1_000_000 },
      { status: "active", principalOutstanding: 5_000_000, interestOutstanding: 200_000 },
      { status: "written_off", principalOutstanding: 2_000_000, interestOutstanding: 0 },
      { status: "paid_off", principalOutstanding: 0, interestOutstanding: 0 },
    ];
    expect(sumLoanReceivables(loans)).toEqual({
      principal: 15_000_000,
      interest: 1_200_000,
      writtenOff: 2_000_000,
    });
  });

  it("array kosong → semua 0", () => {
    expect(sumLoanReceivables([])).toEqual({ principal: 0, interest: 0, writtenOff: 0 });
  });
});

describe("computeInventory", () => {
  it("stock × costPrice, skip service & non-track", () => {
    const products = [
      { stock: 10, costPrice: 5000, trackStock: true, isService: false },   // 50.000
      { stock: 2, costPrice: 100000, trackStock: true, isService: false },  // 200.000
      { stock: 5, costPrice: 10000, trackStock: false, isService: false },  // skip
      { stock: 3, costPrice: 20000, trackStock: true, isService: true },    // skip
    ];
    expect(computeInventory(products)).toBe(250_000);
  });
  it("abaikan stock negatif", () => {
    expect(computeInventory([{ stock: -1, costPrice: 5000, trackStock: true, isService: false }])).toBe(0);
  });
});

describe("computeFixedAssets", () => {
  it("gross - accumulated = net", () => {
    const assets = [
      { acquisitionCost: 50_000_000, accumulatedDepreciation: 10_000_000 },
      { acquisitionCost: 30_000_000, accumulatedDepreciation: 5_000_000 },
    ];
    expect(computeFixedAssets(assets)).toEqual({
      gross: 80_000_000,
      accumulatedDepreciation: 15_000_000,
      net: 65_000_000,
    });
  });
});
