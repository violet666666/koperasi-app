import { UNIT_TYPES, getUnitLabel, unitTypeToSlug } from "@/lib/constants/units";

/**
 * Computes WIB-aware date boundaries for querying both DateTime and @db.Date fields.
 *
 * Key insight: UnitTransaction.transactionDate is @db.Date (stored as pure date at UTC midnight),
 * while StoreSale.createdAt is DateTime (full timestamp with timezone).
 * They need different boundary representations:
 * - DateTime: use { gte: todayStartWIB, lt: tomorrowStartWIB }
 * - @db.Date:  use { gte: todayDateUTC } (the date string at UTC midnight)
 */
export function computeWIBBoundaries(now = new Date()) {
  const wibOffset = 7 * 60; // WIB = UTC+7 in minutes
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibNow = new Date(utcMs + wibOffset * 60000);

  // WIB start of today (local time calculation in WIB)
  const todayStartWIB = new Date(
    wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(), 0, 0, 0, 0
  );
  // Convert back to UTC for DateTime field queries
  const todayStartUTC = new Date(todayStartWIB.getTime() - wibOffset * 60000);
  const tomorrowStartUTC = new Date(todayStartUTC.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStartUTC = new Date(todayStartUTC.getTime() - 24 * 60 * 60 * 1000);

  // For @db.Date fields: the date is stored at UTC midnight, so we compare against the WIB date
  // E.g. if WIB says "2026-06-01", the @db.Date field stores "2026-06-01T00:00:00.000Z"
  const todayDateUTC = new Date(
    Date.UTC(wibNow.getFullYear(), wibNow.getMonth(), wibNow.getDate(), 0, 0, 0, 0)
  );
  const tomorrowDateUTC = new Date(todayDateUTC.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayDateUTC = new Date(todayDateUTC.getTime() - 24 * 60 * 60 * 1000);

  return {
    /** For DateTime fields (StoreSale.createdAt): gte boundary for "today in WIB" */
    todayStartUTC,
    /** For DateTime fields: start of tomorrow (exclusive upper bound) */
    tomorrowStartUTC,
    /** For DateTime fields: start of yesterday */
    yesterdayStartUTC,
    /** For @db.Date fields (UnitTransaction.transactionDate): gte boundary for today */
    todayDateUTC,
    /** For @db.Date fields: tomorrow date (exclusive upper bound) */
    tomorrowDateUTC,
    /** For @db.Date fields: yesterday date */
    yesterdayDateUTC,
    /** WIB offset in minutes (420 for UTC+7) */
    wibOffset,
  };
}

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
