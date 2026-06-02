/**
 * Unit Insight Service — Pure business logic for item sales analytics.
 *
 * Used by: GET /api/unit-insight/[unitSlug]/sales-trend
 * Scope: Store units only (toko, resto, cafe_lsp) — only they have StoreSaleItem data.
 */

// ─── Input Types ──────────────────────────────────────────

export interface RawProductSale {
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
}

export interface RawDailySale {
    date: string;       // ISO date string "YYYY-MM-DD"
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
}

export interface ActiveProduct {
    productId: number;
    productName: string;
    stock: number;
}

// ─── Output Types ─────────────────────────────────────────

export interface RankedProduct {
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
    contribution: number;  // 0-1, fraction of total revenue
}

export interface RankingResult {
    bestSelling: RankedProduct[];
    worstSelling: RankedProduct[];
    summary: {
        totalProducts: number;
        totalItems: number;
        totalRevenue: number;
    };
}

export interface TrendSeries {
    productId: number;
    productName: string;
    data: number[];         // quantity per date
    revenueData: number[];  // revenue per date
}

export interface DailyTrendResult {
    dates: string[];
    series: TrendSeries[];
}

export interface StagnantItem {
    productId: number;
    productName: string;
    stock: number;
    lastSoldAt: Date | null;
    daysSinceSale: number;
}

export interface StagnantResult {
    threshold: number;
    items: StagnantItem[];
}

export interface WeeklyComparisonItem {
    productId: number;
    productName: string;
    thisWeekQty: number;
    lastWeekQty: number;
    qtyChange: number | null;       // null if lastWeek was 0 (can't divide)
    thisWeekRevenue: number;
    lastWeekRevenue: number;
    revenueChange: number | null;
}

export interface WeeklyComparisonResult {
    items: WeeklyComparisonItem[];
}

// ─── Functions ────────────────────────────────────────────

/**
 * Rank products by sales quantity.
 * Returns both best-selling (desc) and worst-selling (asc) lists.
 */
export function computeProductRanking(sales: RawProductSale[]): RankingResult {
    if (sales.length === 0) {
        return {
            bestSelling: [],
            worstSelling: [],
            summary: { totalProducts: 0, totalItems: 0, totalRevenue: 0 },
        };
    }

    const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0);
    const totalItems = sales.reduce((sum, s) => sum + s.quantity, 0);

    const toRanked = (s: RawProductSale): RankedProduct => ({
        productId: s.productId,
        productName: s.productName,
        quantity: s.quantity,
        revenue: s.revenue,
        contribution: totalRevenue > 0 ? s.revenue / totalRevenue : 0,
    });

    const bestSelling = [...sales]
        .sort((a, b) => b.quantity - a.quantity)
        .map(toRanked);

    const worstSelling = [...sales]
        .sort((a, b) => a.quantity - b.quantity)
        .map(toRanked);

    return {
        bestSelling,
        worstSelling,
        summary: {
            totalProducts: sales.length,
            totalItems,
            totalRevenue,
        },
    };
}

/**
 * Build a daily trend time series from raw daily sales data.
 * Returns dates array + series per product (filled with 0 for missing dates).
 *
 * @param sales Raw daily sales data
 * @param opts.topN Only include top N products by total quantity (default: 15)
 */
export function computeDailyTrend(
    sales: RawDailySale[],
    opts?: { topN?: number }
): DailyTrendResult {
    if (sales.length === 0) {
        return { dates: [], series: [] };
    }

    const topN = opts?.topN ?? 15;

    // Collect unique dates (sorted)
    const dateSet = new Set(sales.map(s => s.date));
    const dates = Array.from(dateSet).sort();

    // Aggregate total quantity per product (for topN selection)
    const productTotals = new Map<number, { name: string; totalQty: number }>();
    for (const s of sales) {
        const existing = productTotals.get(s.productId);
        if (existing) {
            existing.totalQty += s.quantity;
        } else {
            productTotals.set(s.productId, { name: s.productName, totalQty: s.quantity });
        }
    }

    // Select top N products
    const topProductIds = Array.from(productTotals.entries())
        .sort((a, b) => b[1].totalQty - a[1].totalQty)
        .slice(0, topN)
        .map(([id]) => id);

    // Build index map for O(1) lookup
    const dateIndex = new Map(dates.map((d, i) => [d, i]));

    // Build series
    const series: TrendSeries[] = topProductIds.map(productId => {
        const meta = productTotals.get(productId)!;
        const data = new Array(dates.length).fill(0);
        const revenueData = new Array(dates.length).fill(0);

        for (const s of sales) {
            if (s.productId !== productId) continue;
            const idx = dateIndex.get(s.date);
            if (idx !== undefined) {
                data[idx] += s.quantity;
                revenueData[idx] += s.revenue;
            }
        }

        return {
            productId,
            productName: meta.name,
            data,
            revenueData,
        };
    });

    return { dates, series };
}

/**
 * Detect products that haven't been sold in a while (stagnant / dead stock).
 *
 * @param products All active products for the unit
 * @param recentSales Products sold in the recent period (used to determine which have sales)
 * @param threshold Days without sale before flagging (default: 7)
 * @param now Current date for calculating days since last sale
 * @param lastSoldDates Last sale date per product (optional — products not in this list have never sold)
 */
export function detectStagnantProducts(
    products: ActiveProduct[],
    recentSales: RawProductSale[],
    threshold: number | undefined,
    now: Date,
    lastSoldDates: { productId: number; lastSoldAt: Date }[] = []
): StagnantResult {
    const daysThreshold = threshold ?? 7;

    // Build set of products with recent sales
    const soldProductIds = new Set(recentSales.map(s => s.productId));

    // Build map of last sold dates
    const lastSoldMap = new Map(lastSoldDates.map(l => [l.productId, l.lastSoldAt]));

    const items: StagnantItem[] = [];

    for (const product of products) {
        // If sold in the recent period, not stagnant
        if (soldProductIds.has(product.productId)) continue;

        const lastSold = lastSoldMap.get(product.productId);
        let daysSinceSale: number;

        if (lastSold) {
            const diffMs = now.getTime() - lastSold.getTime();
            daysSinceSale = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        } else {
            // Never sold — use a large number to ensure it's flagged
            daysSinceSale = 999;
        }

        if (daysSinceSale >= daysThreshold) {
            items.push({
                productId: product.productId,
                productName: product.productName,
                stock: product.stock,
                lastSoldAt: lastSold ?? null,
                daysSinceSale,
            });
        }
    }

    // Sort: most stagnant first
    items.sort((a, b) => b.daysSinceSale - a.daysSinceSale);

    return { threshold: daysThreshold, items };
}

/**
 * Compare product sales between this week and last week.
 * Returns per-item week-over-week change in quantity and revenue.
 */
export function computeWeeklyComparison(
    thisWeek: RawProductSale[],
    lastWeek: RawProductSale[]
): WeeklyComparisonResult {
    // Index last week data
    const lastWeekMap = new Map(lastWeek.map(s => [s.productId, s]));

    // Collect all product IDs
    const allProductIds = new Set([
        ...thisWeek.map(s => s.productId),
        ...lastWeek.map(s => s.productId),
    ]);

    const items: WeeklyComparisonItem[] = [];

    for (const productId of allProductIds) {
        const tw = thisWeek.find(s => s.productId === productId);
        const lw = lastWeekMap.get(productId);

        const thisWeekQty = tw?.quantity ?? 0;
        const lastWeekQty = lw?.quantity ?? 0;
        const thisWeekRevenue = tw?.revenue ?? 0;
        const lastWeekRevenue = lw?.revenue ?? 0;

        // Quantity change
        let qtyChange: number | null;
        if (lastWeekQty === 0 && thisWeekQty === 0) {
            qtyChange = 0;
        } else if (lastWeekQty === 0) {
            qtyChange = null; // Can't compute % change from 0
        } else {
            qtyChange = (thisWeekQty - lastWeekQty) / lastWeekQty;
        }

        // Revenue change
        let revenueChange: number | null;
        if (lastWeekRevenue === 0 && thisWeekRevenue === 0) {
            revenueChange = 0;
        } else if (lastWeekRevenue === 0) {
            revenueChange = null;
        } else {
            revenueChange = (thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue;
        }

        items.push({
            productId,
            productName: tw?.productName ?? lw?.productName ?? `Product ${productId}`,
            thisWeekQty,
            lastWeekQty,
            qtyChange,
            thisWeekRevenue,
            lastWeekRevenue,
            revenueChange,
        });
    }

    // Sort: biggest positive change first
    items.sort((a, b) => {
        const aChange = a.qtyChange ?? Infinity; // New items at top
        const bChange = b.qtyChange ?? Infinity;
        return bChange - aChange;
    });

    return { items };
}
