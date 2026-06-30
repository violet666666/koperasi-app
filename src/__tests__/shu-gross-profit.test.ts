import { describe, it, expect } from "vitest";
import { aggregateGrossProfit, getPeriodRange } from "@/lib/services/shu-gross-profit";
import type { GrossProfitItem, UnitGroup } from "@/lib/services/shu-gross-profit";

const GROUPS: UnitGroup[] = [
  { unitType: "toko", label: "Toko PRIMKOPPOL", aliases: ["toko"] },
  { unitType: "resto", label: "Resto & Cafe", aliases: ["resto", "resto_cafe", "coffe_latar"] },
  { unitType: "cafe_lsp", label: "Cafe LSP", aliases: ["cafe_lsp"] },
];

const item = (over: Partial<GrossProfitItem>): GrossProfitItem => ({
  subtotal: 10000, costPrice: 6000, quantity: 1, productCostPrice: 6000, unitType: "toko", ...over,
});

describe("getPeriodRange", () => {
  it("full year saat month kosong", () => {
    const { start, end } = getPeriodRange(2026);
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
  it("single month saat month diisi", () => {
    const { start, end } = getPeriodRange(2026, 2);
    expect(start.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(end.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("aggregateGrossProfit", () => {
  it("menghitung omzet/hpp/laba/margin dasar untuk 1 unit", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 20000, costPrice: 6000, quantity: 2, productCostPrice: 6000 }),
    ], GROUPS);
    const toko = rows.find(r => r.unitType === "toko")!;
    expect(toko.omzet).toBe(20000);
    expect(toko.hpp).toBe(12000);
    expect(toko.labaKotor).toBe(8000);
    expect(toko.margin).toBe(40);
    expect(toko.itemCount).toBe(1);
  });

  it("roll-up alias resto_cafe & coffe_latar ke resto", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "resto", subtotal: 50000, costPrice: 10000, quantity: 1 }),
      item({ unitType: "resto_cafe", subtotal: 30000, costPrice: 5000, quantity: 1 }),
      item({ unitType: "coffe_latar", subtotal: 20000, costPrice: 3000, quantity: 1 }),
    ], GROUPS);
    const resto = rows.find(r => r.unitType === "resto")!;
    expect(resto.omzet).toBe(100000);
    expect(resto.hpp).toBe(18000);
    expect(resto.itemCount).toBe(3);
  });

  it("fallback productCostPrice saat item costPrice 0/null", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 10000, costPrice: 0, productCostPrice: 4000, quantity: 2 }),
      item({ unitType: "toko", subtotal: 5000, costPrice: null as unknown as number, productCostPrice: 2500, quantity: 1 }),
    ], GROUPS);
    const toko = rows.find(r => r.unitType === "toko")!;
    // 4000*2 + 2500*1 = 10500
    expect(toko.hpp).toBe(10500);
  });

  it("margin 0 (bukan NaN) saat omzet 0", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "cafe_lsp", subtotal: 0, costPrice: 0, quantity: 0 }),
    ], GROUPS);
    const lsp = rows.find(r => r.unitType === "cafe_lsp")!;
    expect(lsp.omzet).toBe(0);
    expect(lsp.margin).toBe(0);
    expect(Number.isNaN(lsp.margin)).toBe(false);
  });

  it("urut omzet descending", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "cafe_lsp", subtotal: 5000, quantity: 1 }),
      item({ unitType: "toko", subtotal: 50000, quantity: 1 }),
      item({ unitType: "resto", subtotal: 20000, quantity: 1 }),
    ], GROUPS);
    expect(rows.map(r => r.unitType)).toEqual(["toko", "resto", "cafe_lsp"]);
  });

  it("skip item yg unitType-nya bukan store group (mis. cuci_mobil)", () => {
    const rows = aggregateGrossProfit([
      item({ unitType: "toko", subtotal: 10000, quantity: 1 }),
      item({ unitType: "cuci_mobil", subtotal: 99999, quantity: 1 }),
    ], GROUPS);
    expect(rows.find(r => r.unitType === "cuci_mobil")).toBeUndefined();
    expect(rows.find(r => r.unitType === "toko")!.omzet).toBe(10000);
  });
});
