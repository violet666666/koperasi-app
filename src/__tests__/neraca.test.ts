import { describe, it, expect } from "vitest";
import { mapSavingsByType, sumLoanReceivables, computeInventory, computeFixedAssets, buildEquityWithSelisih, assembleBalanceSheet, type BalanceSheetItem } from "@/lib/services/neraca";

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

const item = (code: string, amount: number): BalanceSheetItem => ({ code, name: code, amount });

describe("buildEquityWithSelisih", () => {
  it("balanced: aset = kewajiban + ekuitas → tanpa baris selisih", () => {
    // aset 100, kewajiban 60, modal 20, shu 20 → equity 40, total 100, balanced
    const r = buildEquityWithSelisih({ modalItems: [item("3101", 20)], shuBerjalan: 20, totalAssets: 100, totalLiabilities: 60 });
    expect(r.selisih).toBe(0);
    expect(r.isBalanced).toBe(true);
    expect(r.totalEquity).toBe(40);
    expect(r.items.find(i => i.code === "31XX")).toBeUndefined();
  });

  it("unbalanced: tambah baris Selisih sebagai plug di ekuitas", () => {
    // aset 100, kewajiban 60, modal+shu = 20 → equity sebelum 20, selisih = 100-60-20 = 20
    const r = buildEquityWithSelisih({ modalItems: [item("3101", 10)], shuBerjalan: 10, totalAssets: 100, totalLiabilities: 60 });
    expect(r.selisih).toBe(20);
    expect(r.isBalanced).toBe(false);
    expect(r.items.find(i => i.code === "31XX")).toEqual({ code: "31XX", name: "Selisih Penyesuaian (beda data/jurnal)", amount: 20, source: "computed" });
    expect(r.totalEquity).toBe(40); // 20 + 20 plug
  });

  it("selisih negatif juga plug (ekuita berkurang)", () => {
    const r = buildEquityWithSelisih({ modalItems: [], shuBerjalan: 0, totalAssets: 50, totalLiabilities: 80 });
    expect(r.selisih).toBe(-30);
    expect(r.isBalanced).toBe(false);
    expect(r.totalEquity).toBe(-30);
  });
});

describe("assembleBalanceSheet", () => {
  it("menyusun aset lancar + tetap, pasiva, dan identitas selisih", () => {
    const r = assembleBalanceSheet({
      asOf: "2026-06-18",
      cashItems: [{ code: "1103", name: "Bank BRI", amount: 2_900_000_000, source: "ledger" }],
      loanRec: { principal: 5_000_000_000, interest: 200_000_000, writtenOff: 100_000_000 },
      inventory: 50_000_000,
      fixed: { gross: 80_000_000, accumulatedDepreciation: 15_000_000, net: 65_000_000 },
      savingsItems: [{ code: "2102", name: "Simpanan Wajib", amount: 6_000_000_000, source: "ledger" }],
      hutangItems: [{ code: "2201", name: "Hutang Usaha", amount: 100_000_000, source: "journal" }],
      modalItems: [{ code: "3101", name: "Modal Disetor", amount: 500_000_000, source: "journal" }],
      shuBerjalan: 1_700_000_000,
    });
    // aset lancar = 2.9B + 5B + 200M + 50M + 100M(writtenOff) = 8.25B ; tetap net 65M → totalAssets 8.315B
    expect(r.assets.totalAssets).toBe(8_315_000_000);
    expect(r.assets.accumulatedDepreciation).toBe(15_000_000);
    expect(r.liabilities.totalLiabilities).toBe(6_100_000_000);
    // equity sebelum selisih = 500M + 1.7B = 2.2B ; selisih = 8.315B - 6.1B - 2.2B = 15M
    expect(r.equity.selisih).toBe(15_000_000);
    expect(r.isBalanced).toBe(false);
    expect(r.equity.totalEquity).toBe(2_215_000_000);
    expect(r.assets.current.find(i => i.code === "1299")?.amount).toBe(100_000_000); // writtenOff muncul
  });

  it("balanced jika angka pas", () => {
    const r = assembleBalanceSheet({
      asOf: "2026-06-18",
      cashItems: [{ code: "1101", name: "Kas", amount: 100, source: "ledger" }],
      loanRec: { principal: 0, interest: 0, writtenOff: 0 },
      inventory: 0,
      fixed: { gross: 0, accumulatedDepreciation: 0, net: 0 },
      savingsItems: [{ code: "2102", name: "Wajib", amount: 60, source: "ledger" }],
      hutangItems: [],
      modalItems: [{ code: "3101", name: "Modal", amount: 20, source: "journal" }],
      shuBerjalan: 20,
    });
    expect(r.isBalanced).toBe(true);
    expect(r.equity.selisih).toBe(0);
  });
});
