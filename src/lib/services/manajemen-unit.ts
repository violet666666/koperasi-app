import { UNIT_TYPES, getUnitLabel, unitTypeToSlug } from "@/lib/constants/units";

export interface RawUnitStats {
  unitType: string;
  productCount: number;
  activeProductCount: number;
  todayTransactionCount: number;
  todayRevenue: number;
  yesterdayRevenue: number;
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
  yesterdayRevenue: number;
  revenueTrend: number | null; // percentage change, null if yesterday was 0
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

// --- Phase 2: Peak Hours ---

export interface PeakHour {
  hour: number;
  transactions: number;
  revenue: number;
}

/**
 * Groups transaction records by WIB hour.
 * Only includes records within business hours (minHour–maxHour).
 * @param records — Array of { date, amount } with UTC timestamps
 * @param wibOffset — WIB offset in minutes (420 for UTC+7)
 */
export function computePeakHours(
  records: Array<{ date: Date; amount: number }>,
  wibOffset: number,
  minHour = 6,
  maxHour = 22,
): PeakHour[] {
  const hourMap = new Map<number, { transactions: number; revenue: number }>();
  for (let h = minHour; h <= maxHour; h++) {
    hourMap.set(h, { transactions: 0, revenue: 0 });
  }

  for (const r of records) {
    const wibDate = new Date(r.date.getTime() + wibOffset * 60000);
    const hour = wibDate.getUTCHours();
    const entry = hourMap.get(hour);
    if (entry) {
      entry.transactions += 1;
      entry.revenue += r.amount;
    }
  }

  return Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, data]) => ({ hour, ...data }));
}

// --- Phase 2: Profit Metrics ---

/**
 * Computes profit metrics from sale items.
 * Items must have unitPrice and costPrice already converted to numbers.
 */
export function computeProfitFromItems(
  items: Array<{ unitPrice: number; costPrice: number; quantity: number; productId: number }>,
): {
  todayProfit: number;
  productProfits: Map<number, { profit: number; revenue: number; quantity: number }>;
} {
  let todayProfit = 0;
  const productProfits = new Map<number, { profit: number; revenue: number; quantity: number }>();

  for (const item of items) {
    const itemRevenue = item.unitPrice * item.quantity;
    const itemProfit = (item.unitPrice - item.costPrice) * item.quantity;
    todayProfit += itemProfit;

    const existing = productProfits.get(item.productId) ?? { profit: 0, revenue: 0, quantity: 0 };
    existing.profit += itemProfit;
    existing.revenue += itemRevenue;
    existing.quantity += item.quantity;
    productProfits.set(item.productId, existing);
  }

  return { todayProfit, productProfits };
}

export function aggregateUnitStats(rawStats: RawUnitStats[]): AggregatedStats {
  const units: UnitSummary[] = rawStats.map((raw) => {
    const config = UNIT_TYPES[raw.unitType];
    const trend = raw.yesterdayRevenue > 0
      ? Math.round(((raw.todayRevenue - raw.yesterdayRevenue) / raw.yesterdayRevenue) * 100)
      : null;
    return {
      unitType: raw.unitType,
      label: config?.label ?? raw.unitType,
      category: config?.category ?? "service",
      slug: config?.slug ?? unitTypeToSlug(raw.unitType),
      productCount: raw.productCount,
      activeProductCount: raw.activeProductCount,
      todayTransactionCount: raw.todayTransactionCount,
      todayRevenue: raw.todayRevenue,
      yesterdayRevenue: raw.yesterdayRevenue,
      revenueTrend: trend,
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
