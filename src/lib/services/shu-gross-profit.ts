import prisma from "@/lib/prisma";
import { UNIT_TYPES, STORE_SALE_ALIASES } from "@/lib/constants/units";

export interface GrossProfitItem {
  subtotal: number;
  costPrice: number;        // item-level (0 jika null)
  quantity: number;
  productCostPrice: number; // fallback dari product (0 jika null)
  unitType: string | null;
}

export interface UnitGroup {
  unitType: string;
  label: string;
  aliases: string[];
}

export interface GrossProfitRow {
  unitType: string;
  label: string;
  omzet: number;
  hpp: number;
  labaKotor: number;
  margin: number;
  itemCount: number;
}

/** 3 unit store yg ditampilkan di card Laba Kotor. */
export const STORE_UNIT_GROUPS: UnitGroup[] = (["toko", "resto", "cafe_lsp"] as const).map((k) => ({
  unitType: k,
  label: UNIT_TYPES[k].label,
  aliases: STORE_SALE_ALIASES[k] ?? [k],
}));

/** Semua unitType StoreSale (canonical + alias) untuk query Prisma. */
export const ALL_STORE_UNIT_TYPES: string[] = STORE_UNIT_GROUPS.flatMap((g) => g.aliases);

/** Rentang periode SHU (UTC), konsisten dgn calculateSystemSHU. */
export function getPeriodRange(year: number, month?: number | null): { start: Date; end: Date } {
  if (month && month > 0) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
    };
  }
  return {
    start: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
    end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/**
 * Pure helper: agregasi list item → baris laba kotor per grup unit.
 * Voided item HARUS sudah disaring pemanggil (helper murni terima item aktif).
 */
export function aggregateGrossProfit(items: GrossProfitItem[], unitGroups: UnitGroup[]): GrossProfitRow[] {
  const aliasToCanonical = new Map<string, string>();
  for (const g of unitGroups) {
    aliasToCanonical.set(g.unitType, g.unitType);
    for (const a of g.aliases) aliasToCanonical.set(a, g.unitType);
  }
  const acc: Record<string, { omzet: number; hpp: number; itemCount: number; label: string }> = {};
  for (const g of unitGroups) acc[g.unitType] = { omzet: 0, hpp: 0, itemCount: 0, label: g.label };

  for (const it of items) {
    const canonical = aliasToCanonical.get(it.unitType ?? "");
    if (!canonical || !acc[canonical]) continue; // skip non-store item
    const cp = it.costPrice > 0 ? it.costPrice : (it.productCostPrice ?? 0);
    acc[canonical].omzet += it.subtotal;
    acc[canonical].hpp += cp * it.quantity;
    acc[canonical].itemCount += 1;
  }

  return Object.entries(acc)
    .map(([unitType, v]) => ({
      unitType,
      label: v.label,
      omzet: v.omzet,
      hpp: v.hpp,
      labaKotor: v.omzet - v.hpp,
      margin: v.omzet > 0 ? Number((((v.omzet - v.hpp) / v.omzet) * 100).toFixed(2)) : 0,
      itemCount: v.itemCount,
    }))
    .sort((a, b) => b.omzet - a.omzet);
}

function num(d: unknown): number {
  if (d === null || d === undefined) return 0;
  return typeof d === "number" ? d : Number(d);
}

/**
 * Fetcher: query StoreSaleItem untuk 3 unit store, saring voided di JS
 * (HINDARI Prisma JSON NULL bug pada filter path isVoided), lalu agregasi.
 */
export async function computeUnitGrossProfit(year: number, month?: number | null): Promise<GrossProfitRow[]> {
  const { start, end } = getPeriodRange(year, month);
  const items = await prisma.storeSaleItem.findMany({
    where: {
      sale: {
        createdAt: { gte: start, lte: end },
        unitType: { in: ALL_STORE_UNIT_TYPES },
      },
    },
    select: {
      subtotal: true,
      costPrice: true,
      quantity: true,
      sale: { select: { unitType: true, metadata: true } },
      product: { select: { costPrice: true } },
    },
  });

  const normalized: GrossProfitItem[] = items
    .filter((it) => !((it.sale?.metadata as any)?.isVoided))
    .map((it) => ({
      subtotal: num(it.subtotal),
      costPrice: num(it.costPrice),
      quantity: Number(it.quantity) || 0,
      productCostPrice: num(it.product?.costPrice),
      unitType: it.sale?.unitType ?? null,
    }));

  return aggregateGrossProfit(normalized, STORE_UNIT_GROUPS);
}
