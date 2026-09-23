import { describe, it, expect } from "vitest";
import { buildProductProfit, RawSaleItem } from "../lib/services/product-profit";

// StoreSaleItem invariants (CLAUDE.md): subtotal = LINE TOTAL (unitPrice×qty),
// costPrice = PER-UNIT. Laba per line = subtotal − costPrice×qty.
const sale = (items: RawSaleItem[]) => ({ items, metadata: {} });

describe("buildProductProfit", () => {
  it("menggabungkan produk sama lintas nota dan menghitung laba = omzet − hpp", () => {
    const rows = buildProductProfit([
      sale([
        { productId: 1, product: { name: "Kopi" }, quantity: 2, subtotal: 20000, costPrice: 5000 },
      ]),
      sale([
        { productId: 1, product: { name: "Kopi" }, quantity: 3, subtotal: 30000, costPrice: 5000 },
        { productId: 2, product: { name: "Teh" }, quantity: 1, subtotal: 5000, costPrice: 4000 },
      ]),
    ]);
    const kopi = rows.find((r) => r.productId === 1)!;
    expect(kopi.qty).toBe(5);
    expect(kopi.omzet).toBe(50000); // Σ subtotal, TANPA × qty lagi
    expect(kopi.hpp).toBe(25000); // costPrice per-unit × qty
    expect(kopi.laba).toBe(25000);
    expect(kopi.margin).toBeCloseTo(0.5);
  });

  it("costPrice null → hpp 0, laba = omzet", () => {
    const rows = buildProductProfit([
      sale([{ productId: 3, product: { name: "Jasa" }, quantity: 1, subtotal: 15000, costPrice: null }]),
    ]);
    expect(rows[0].hpp).toBe(0);
    expect(rows[0].laba).toBe(15000);
    expect(rows[0].margin).toBeCloseTo(1);
  });

  it("omzet 0 → margin 0 (bukan NaN)", () => {
    const rows = buildProductProfit([
      sale([{ productId: 4, product: { name: "Gratis" }, quantity: 1, subtotal: 0, costPrice: 1000 }]),
    ]);
    expect(rows[0].margin).toBe(0);
    expect(rows[0].laba).toBe(-1000);
  });

  it("urut laba tertinggi dulu; produk tanpa nama fallback", () => {
    const rows = buildProductProfit([
      sale([
        { productId: 1, product: null, quantity: 1, subtotal: 1000, costPrice: 900 },
        { productId: 2, product: { name: "Untung" }, quantity: 1, subtotal: 1000, costPrice: 100 },
      ]),
    ]);
    expect(rows[0].name).toBe("Untung");
    expect(rows[1].name).toBe("Produk #1");
  });

  it("nota tanpa items diabaikan", () => {
    expect(buildProductProfit([sale([]), {}])).toEqual([]);
  });
});
