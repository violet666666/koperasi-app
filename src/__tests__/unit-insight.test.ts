import { describe, it, expect } from "vitest";
import {
    computeProductRanking,
    computeDailyTrend,
    detectStagnantProducts,
    computeWeeklyComparison,
    type RawProductSale,
    type RawDailySale,
    type ActiveProduct,
} from "@/lib/services/unit-insight";

// ─── Test Data Factories ──────────────────────────────────

const makeSale = (overrides: Partial<RawProductSale> = {}): RawProductSale => ({
    productId: 1,
    productName: "Kopi Susu",
    quantity: 10,
    revenue: 50000,
    ...overrides,
});

const makeDailySale = (overrides: Partial<RawDailySale> = {}): RawDailySale => ({
    date: "2026-06-01",
    productId: 1,
    productName: "Kopi Susu",
    quantity: 5,
    revenue: 25000,
    ...overrides,
});

const makeProduct = (overrides: Partial<ActiveProduct> = {}): ActiveProduct => ({
    productId: 1,
    productName: "Kopi Susu",
    stock: 50,
    ...overrides,
});

// ═══════════════════════════════════════════════════════════
// computeProductRanking
// ═══════════════════════════════════════════════════════════

describe("computeProductRanking", () => {
    it("returns empty arrays for empty input", () => {
        const result = computeProductRanking([]);
        expect(result.bestSelling).toEqual([]);
        expect(result.worstSelling).toEqual([]);
        expect(result.summary.totalProducts).toBe(0);
        expect(result.summary.totalItems).toBe(0);
        expect(result.summary.totalRevenue).toBe(0);
    });

    it("ranks products by quantity descending for bestSelling", () => {
        const sales: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 250000 }),
            makeSale({ productId: 2, productName: "Teh", quantity: 30, revenue: 90000 }),
            makeSale({ productId: 3, productName: "Roti", quantity: 100, revenue: 500000 }),
        ];
        const result = computeProductRanking(sales);
        expect(result.bestSelling[0]).toMatchObject({ productId: 3, quantity: 100 });
        expect(result.bestSelling[1]).toMatchObject({ productId: 1, quantity: 50 });
        expect(result.bestSelling[2]).toMatchObject({ productId: 2, quantity: 30 });
    });

    it("ranks products by quantity ascending for worstSelling", () => {
        const sales: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 250000 }),
            makeSale({ productId: 2, productName: "Teh", quantity: 3, revenue: 9000 }),
            makeSale({ productId: 3, productName: "Roti", quantity: 100, revenue: 500000 }),
        ];
        const result = computeProductRanking(sales);
        expect(result.worstSelling[0]).toMatchObject({ productId: 2, quantity: 3 });
        expect(result.worstSelling[1]).toMatchObject({ productId: 1, quantity: 50 });
    });

    it("calculates contribution percentage correctly", () => {
        const sales: RawProductSale[] = [
            makeSale({ productId: 1, quantity: 75, revenue: 750000 }),
            makeSale({ productId: 2, quantity: 25, revenue: 250000 }),
        ];
        const result = computeProductRanking(sales);
        expect(result.bestSelling[0].contribution).toBeCloseTo(0.75);
        expect(result.bestSelling[1].contribution).toBeCloseTo(0.25);
    });

    it("computes summary totals correctly", () => {
        const sales: RawProductSale[] = [
            makeSale({ productId: 1, quantity: 50, revenue: 250000 }),
            makeSale({ productId: 2, quantity: 30, revenue: 90000 }),
        ];
        const result = computeProductRanking(sales);
        expect(result.summary.totalProducts).toBe(2);
        expect(result.summary.totalItems).toBe(80);
        expect(result.summary.totalRevenue).toBe(340000);
    });

    it("handles single product", () => {
        const sales: RawProductSale[] = [
            makeSale({ productId: 1, quantity: 10, revenue: 50000 }),
        ];
        const result = computeProductRanking(sales);
        expect(result.bestSelling).toHaveLength(1);
        expect(result.worstSelling).toHaveLength(1);
        expect(result.bestSelling[0].contribution).toBeCloseTo(1.0);
    });
});

// ═══════════════════════════════════════════════════════════
// computeDailyTrend
// ═══════════════════════════════════════════════════════════

describe("computeDailyTrend", () => {
    it("returns empty result for empty input", () => {
        const result = computeDailyTrend([]);
        expect(result.dates).toEqual([]);
        expect(result.series).toEqual([]);
    });

    it("builds correct date array from sales data", () => {
        const sales: RawDailySale[] = [
            makeDailySale({ date: "2026-06-03", productId: 1, quantity: 5, revenue: 25000 }),
            makeDailySale({ date: "2026-06-01", productId: 1, quantity: 3, revenue: 15000 }),
            makeDailySale({ date: "2026-06-02", productId: 1, quantity: 4, revenue: 20000 }),
        ];
        const result = computeDailyTrend(sales);
        expect(result.dates).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    });

    it("builds series with quantities per date for each product", () => {
        const sales: RawDailySale[] = [
            makeDailySale({ date: "2026-06-01", productId: 1, productName: "Kopi", quantity: 5, revenue: 25000 }),
            makeDailySale({ date: "2026-06-02", productId: 1, productName: "Kopi", quantity: 3, revenue: 15000 }),
            makeDailySale({ date: "2026-06-01", productId: 2, productName: "Teh", quantity: 2, revenue: 6000 }),
            makeDailySale({ date: "2026-06-02", productId: 2, productName: "Teh", quantity: 4, revenue: 12000 }),
        ];
        const result = computeDailyTrend(sales);
        // Find series for each product
        const kopi = result.series.find(s => s.productId === 1);
        const teh = result.series.find(s => s.productId === 2);
        expect(kopi?.data).toEqual([5, 3]);
        expect(teh?.data).toEqual([2, 4]);
    });

    it("fills zeros for dates where product had no sales", () => {
        const sales: RawDailySale[] = [
            makeDailySale({ date: "2026-06-01", productId: 1, quantity: 5, revenue: 25000 }),
            // Product 1 has no sale on 2026-06-02
            makeDailySale({ date: "2026-06-03", productId: 1, quantity: 2, revenue: 10000 }),
            // Product 2 only on 2026-06-02
            makeDailySale({ date: "2026-06-02", productId: 2, productName: "Teh", quantity: 1, revenue: 3000 }),
        ];
        const result = computeDailyTrend(sales);
        expect(result.dates).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
        const kopi = result.series.find(s => s.productId === 1)!;
        expect(kopi.data).toEqual([5, 0, 2]);
        const teh = result.series.find(s => s.productId === 2)!;
        expect(teh.data).toEqual([0, 1, 0]);
    });

    it("respects topN parameter to limit series", () => {
        const sales: RawDailySale[] = Array.from({ length: 20 }, (_, i) =>
            makeDailySale({
                date: "2026-06-01",
                productId: i + 1,
                productName: `Product ${i + 1}`,
                quantity: 20 - i,
                revenue: (20 - i) * 1000,
            })
        );
        const result = computeDailyTrend(sales, { topN: 10 });
        expect(result.series).toHaveLength(10);
        // Top product should be product 1 (qty 20)
        expect(result.series[0].productId).toBe(1);
    });

    it("includes revenue data in trend series", () => {
        const sales: RawDailySale[] = [
            makeDailySale({ date: "2026-06-01", productId: 1, quantity: 5, revenue: 25000 }),
            makeDailySale({ date: "2026-06-02", productId: 1, quantity: 3, revenue: 15000 }),
        ];
        const result = computeDailyTrend(sales);
        const kopi = result.series.find(s => s.productId === 1)!;
        expect(kopi.revenueData).toEqual([25000, 15000]);
    });
});

// ═══════════════════════════════════════════════════════════
// detectStagnantProducts
// ═══════════════════════════════════════════════════════════

describe("detectStagnantProducts", () => {
    const now = new Date("2026-06-10T12:00:00.000Z");

    it("returns empty for empty active products", () => {
        const result = detectStagnantProducts([], [], 7, now);
        expect(result.items).toEqual([]);
        expect(result.threshold).toBe(7);
    });

    it("flags products with no recent sales as stagnant", () => {
        const products: ActiveProduct[] = [
            makeProduct({ productId: 1, productName: "Kopi" }),
            makeProduct({ productId: 2, productName: "Teh" }),
        ];
        // Only product 1 sold recently
        const recentSales: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 5, revenue: 25000 }),
        ];
        // Product 2 last sold 10 days ago
        const lastSoldDates: { productId: number; lastSoldAt: Date }[] = [
            { productId: 1, lastSoldAt: new Date("2026-06-09") },
            { productId: 2, lastSoldAt: new Date("2026-05-31") },
        ];
        const result = detectStagnantProducts(products, recentSales, 7, now, lastSoldDates);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].productId).toBe(2);
        expect(result.items[0].daysSinceSale).toBe(10);
    });

    it("does not flag products sold within threshold", () => {
        const products: ActiveProduct[] = [
            makeProduct({ productId: 1, productName: "Kopi" }),
        ];
        const recentSales: RawProductSale[] = [
            makeSale({ productId: 1, quantity: 5, revenue: 25000 }),
        ];
        const lastSoldDates: { productId: number; lastSoldAt: Date }[] = [
            { productId: 1, lastSoldAt: new Date("2026-06-08") }, // 2 days ago, within 7-day threshold
        ];
        const result = detectStagnantProducts(products, recentSales, 7, now, lastSoldDates);
        expect(result.items).toHaveLength(0);
    });

    it("flags products with zero sales history as stagnant", () => {
        const products: ActiveProduct[] = [
            makeProduct({ productId: 1, productName: "Kopi" }),
            makeProduct({ productId: 2, productName: "Teh" }),
        ];
        // Product 1 has sales, product 2 has no entry in recentSales or lastSoldDates
        const recentSales: RawProductSale[] = [
            makeSale({ productId: 1, quantity: 5, revenue: 25000 }),
        ];
        const lastSoldDates: { productId: number; lastSoldAt: Date }[] = [
            { productId: 1, lastSoldAt: new Date("2026-06-08") },
        ];
        const result = detectStagnantProducts(products, recentSales, 7, now, lastSoldDates);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].productId).toBe(2);
        expect(result.items[0].daysSinceSale).toBeGreaterThan(30);
    });

    it("uses default threshold of 7 when not specified", () => {
        const result = detectStagnantProducts([], [], undefined, now);
        expect(result.threshold).toBe(7);
    });
});

// ═══════════════════════════════════════════════════════════
// computeWeeklyComparison
// ═══════════════════════════════════════════════════════════

describe("computeWeeklyComparison", () => {
    it("returns empty for empty inputs", () => {
        const result = computeWeeklyComparison([], []);
        expect(result.items).toEqual([]);
    });

    it("computes week-over-week change for each product", () => {
        const thisWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 250000 }),
            makeSale({ productId: 2, productName: "Teh", quantity: 20, revenue: 60000 }),
        ];
        const lastWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 40, revenue: 200000 }),
            makeSale({ productId: 2, productName: "Teh", quantity: 25, revenue: 75000 }),
        ];
        const result = computeWeeklyComparison(thisWeek, lastWeek);
        const kopi = result.items.find(i => i.productId === 1)!;
        const teh = result.items.find(i => i.productId === 2)!;
        expect(kopi.thisWeekQty).toBe(50);
        expect(kopi.lastWeekQty).toBe(40);
        expect(kopi.qtyChange).toBeCloseTo(0.25); // +25%
        expect(teh.thisWeekQty).toBe(20);
        expect(teh.lastWeekQty).toBe(25);
        expect(teh.qtyChange).toBeCloseTo(-0.2); // -20%
    });

    it("handles products only in this week (new items)", () => {
        const thisWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 30, revenue: 150000 }),
        ];
        const lastWeek: RawProductSale[] = [];
        const result = computeWeeklyComparison(thisWeek, lastWeek);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].lastWeekQty).toBe(0);
        expect(result.items[0].qtyChange).toBeNull(); // can't compute % change from 0
    });

    it("handles products only in last week (discontinued)", () => {
        const thisWeek: RawProductSale[] = [];
        const lastWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 30, revenue: 150000 }),
        ];
        const result = computeWeeklyComparison(thisWeek, lastWeek);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].thisWeekQty).toBe(0);
        expect(result.items[0].qtyChange).toBeCloseTo(-1); // -100%
    });

    it("handles products in both weeks with same quantity", () => {
        const thisWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 250000 }),
        ];
        const lastWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 250000 }),
        ];
        const result = computeWeeklyComparison(thisWeek, lastWeek);
        expect(result.items[0].qtyChange).toBeCloseTo(0);
    });

    it("includes revenue comparison", () => {
        const thisWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 50, revenue: 300000 }),
        ];
        const lastWeek: RawProductSale[] = [
            makeSale({ productId: 1, productName: "Kopi", quantity: 40, revenue: 200000 }),
        ];
        const result = computeWeeklyComparison(thisWeek, lastWeek);
        expect(result.items[0].thisWeekRevenue).toBe(300000);
        expect(result.items[0].lastWeekRevenue).toBe(200000);
        expect(result.items[0].revenueChange).toBeCloseTo(0.5); // +50%
    });
});
