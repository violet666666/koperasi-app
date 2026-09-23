// Laba per produk (harga jual − HPP) untuk unit ber-StoreSale (toko, resto, dll).
// Pure module — tidak boleh import prisma (dipakai unit test).
// Unit-tested di __tests__/unit-laporan-product-profit.test.ts

export interface ProductProfitRow {
  productId: number;
  name: string;
  qty: number;
  omzet: number; // Σ subtotal = LINE TOTAL (unitPrice × qty) — JANGAN × qty lagi
  hpp: number; // Σ costPrice (per-unit) × qty
  laba: number; // omzet − hpp
  margin: number; // laba / omzet, 0 jika omzet 0
}

/** Bentuk longgar item StoreSaleItem (Decimal Prisma dinormalisasi via Number()). */
export interface RawSaleItem {
  productId: number;
  quantity?: unknown;
  subtotal?: unknown;
  costPrice?: unknown;
  product?: { name?: string | null } | null;
}

export function buildProductProfit(storeSales: ReadonlyArray<{ items?: ReadonlyArray<RawSaleItem> | null }>): ProductProfitRow[] {
  const map = new Map<number, ProductProfitRow>();
  for (const sale of storeSales) {
    for (const item of sale.items || []) {
      const qty = Number(item.quantity) || 0;
      const omzet = Number(item.subtotal) || 0;
      const hpp = (Number(item.costPrice) || 0) * qty;
      const key = item.productId;
      const row =
        map.get(key) ??
        {
          productId: key,
          name: item.product?.name || `Produk #${key}`,
          qty: 0,
          omzet: 0,
          hpp: 0,
          laba: 0,
          margin: 0,
        };
      row.qty += qty;
      row.omzet += omzet;
      row.hpp += hpp;
      map.set(key, row);
    }
  }
  return [...map.values()]
    .map((r) => {
      const laba = r.omzet - r.hpp;
      return { ...r, laba, margin: r.omzet > 0 ? laba / r.omzet : 0 };
    })
    .sort((a, b) => b.laba - a.laba);
}
