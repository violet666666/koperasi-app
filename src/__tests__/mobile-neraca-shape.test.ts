import { describe, it, expect } from "vitest";
import { toMobileNeracaShape } from "@/lib/services/mobile-neraca-shape";
import type { BalanceSheetResult } from "@/lib/services/neraca";

function fixture(over: Partial<BalanceSheetResult> = {}): BalanceSheetResult {
  return {
    asOf: "2026-07-01",
    assets: {
      current: [
        { code: "1101", name: "Kas", amount: 50_000_000, source: "ledger" },
        { code: "1201", name: "Piutang Pinjaman", amount: 80_000_000, source: "ledger" },
        { code: "1301", name: "Persediaan", amount: 20_000_000, source: "ledger" },
      ],
      fixedGross: [{ code: "1400", name: "Aset Tetap", amount: 30_000_000, source: "ledger" }],
      accumulatedDepreciation: 5_000_000,
      totalAssets: 175_000_000, // 150 current+fixed.net(25) → 175
    },
    liabilities: {
      savings: [
        { code: "2101", name: "Simpanan Pokok", amount: 60_000_000, source: "ledger" },
        { code: "2102", name: "Simpanan Wajib", amount: 40_000_000, source: "ledger" },
      ],
      other: [{ code: "2201", name: "Hutang Usaha", amount: 10_000_000, source: "journal" }],
      totalLiabilities: 110_000_000,
    },
    equity: {
      items: [
        { code: "3101", name: "Modal Disetor", amount: 50_000_000, source: "journal" },
        { code: "3103", name: "SHU Tahun Berjalan", amount: 15_000_000, source: "computed" },
      ],
      shuBerjalan: 15_000_000,
      selisih: 0,
      totalEquity: 65_000_000,
    },
    isBalanced: true,
    meta: { generatedAt: "2026-07-01", note: "x" },
    ...over,
  } as BalanceSheetResult;
}

describe("toMobileNeracaShape", () => {
  it("maps current assets and totals consistently", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.assets.current).toHaveLength(3);
    expect(m.assets.totalCurrentAssets).toBe(150_000_000);
    expect(m.assets.totalAssets).toBe(175_000_000);
    // totalCurrent + totalFixed(net) === totalAssets
    expect(Math.abs(m.assets.totalAssets - (m.assets.totalCurrentAssets + m.assets.totalFixedAssets))).toBeLessThan(1);
  });

  it("adds accumulated depreciation row (negative) when non-zero", () => {
    const m = toMobileNeracaShape(fixture());
    const dep = m.assets.fixed.find((i) => i.code === "1499");
    expect(dep).toBeDefined();
    expect(dep!.amount).toBe(-5_000_000);
    // fixed total = gross 30jt + (-5jt) = 25jt
    expect(m.assets.totalFixedAssets).toBe(25_000_000);
  });

  it("does NOT add depreciation row when accumulation is zero", () => {
    const m = toMobileNeracaShape(fixture({
      assets: { current: [], fixedGross: [], accumulatedDepreciation: 0, totalAssets: 0 },
    }));
    expect(m.assets.fixed.find((i) => i.code === "1499")).toBeUndefined();
  });

  it("concats savings + other into shortTerm", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.liabilities.shortTerm).toHaveLength(3);
    expect(m.liabilities.shortTerm.map((i) => i.code)).toEqual(["2101", "2102", "2201"]);
    expect(m.liabilities.totalLiabilities).toBe(110_000_000);
    expect(m.liabilities.longTerm).toEqual([]);
  });

  it("passes equity items + computes totalLiabilitiesAndEquity", () => {
    const m = toMobileNeracaShape(fixture());
    expect(m.equity.items.map((i) => i.code)).toEqual(["3101", "3103"]);
    expect(m.equity.totalEquity).toBe(65_000_000);
    expect(m.totalLiabilitiesAndEquity).toBe(175_000_000); // 110 + 65
    // balanced fixture → totals match
    expect(Math.abs(m.assets.totalAssets - m.totalLiabilitiesAndEquity)).toBeLessThan(1);
  });

  it("drops the `source` field from items", () => {
    const m = toMobileNeracaShape(fixture());
    expect((m.assets.current[0] as any).source).toBeUndefined();
    expect((m.equity.items[0] as any).source).toBeUndefined();
  });

  it("handles empty balance sheet without crashing", () => {
    const m = toMobileNeracaShape(fixture({
      assets: { current: [], fixedGross: [], accumulatedDepreciation: 0, totalAssets: 0 },
      liabilities: { savings: [], other: [], totalLiabilities: 0 },
      equity: { items: [], shuBerjalan: 0, selisih: 0, totalEquity: 0 },
    }));
    expect(m.assets.totalAssets).toBe(0);
    expect(m.totalLiabilitiesAndEquity).toBe(0);
  });
});
