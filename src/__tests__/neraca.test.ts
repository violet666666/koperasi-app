import { describe, it, expect } from "vitest";
import { mapSavingsByType } from "@/lib/services/neraca";

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
