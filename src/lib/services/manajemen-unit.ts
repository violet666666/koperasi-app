import { UNIT_TYPES, getUnitLabel, unitTypeToSlug } from "@/lib/constants/units";

export interface RawUnitStats {
  unitType: string;
  productCount: number;
  activeProductCount: number;
  todayTransactionCount: number;
  todayRevenue: number;
  lowStockCount: number;
}

export interface UnitSummary {
  unitType: string;
  label: string;
  category: "store" | "service";
  slug: string;
  productCount: number;
  activeProductCount: number;
  todayTransactionCount: number;
  todayRevenue: number;
  lowStockCount: number;
}

export interface AggregatedStats {
  totalUnits: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  units: UnitSummary[];
}

export interface RawUnitDetail {
  productCount: number;
  activeProductCount: number;
  totalStock: number;
  lowStockCount: number;
  todayTransactions: number;
  todayRevenue: number;
  weekRevenue: { date: string; revenue: number; transactions: number }[];
}

export interface UnitDetailStats extends RawUnitDetail {
  avgTransactionValue: number;
}

export function computeUnitDetail(raw: RawUnitDetail): UnitDetailStats {
  return {
    ...raw,
    avgTransactionValue: raw.todayTransactions > 0
      ? Math.round(raw.todayRevenue / raw.todayTransactions)
      : 0,
  };
}

export function aggregateUnitStats(rawStats: RawUnitStats[]): AggregatedStats {
  const units: UnitSummary[] = rawStats.map((raw) => {
    const config = UNIT_TYPES[raw.unitType];
    return {
      unitType: raw.unitType,
      label: config?.label ?? raw.unitType,
      category: config?.category ?? "service",
      slug: config?.slug ?? unitTypeToSlug(raw.unitType),
      productCount: raw.productCount,
      activeProductCount: raw.activeProductCount,
      todayTransactionCount: raw.todayTransactionCount,
      todayRevenue: raw.todayRevenue,
      lowStockCount: raw.lowStockCount,
    };
  });

  return {
    totalUnits: units.length,
    totalProducts: units.reduce((sum, u) => sum + u.productCount, 0),
    totalTransactions: units.reduce((sum, u) => sum + u.todayTransactionCount, 0),
    totalRevenue: units.reduce((sum, u) => sum + u.todayRevenue, 0),
    units,
  };
}
