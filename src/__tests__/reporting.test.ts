import { describe, it, expect } from "vitest";

// Phase 3.1: Reporting Dashboard
// RED phase — tests import from @/lib/reporting which DOESN'T EXIST yet.

describe("Sales Summary Calculation", () => {
    it("should calculate total revenue from sales array", async () => {
        const { calculateTotalRevenue } = await import("@/lib/reporting");
        const sales = [
            { totalAmount: 50000, paymentMethod: "cash" },
            { totalAmount: 75000, paymentMethod: "qris" },
            { totalAmount: 30000, paymentMethod: "cash" },
        ];
        expect(calculateTotalRevenue(sales)).toBe(155000);
    });

    it("should return 0 for empty sales array", async () => {
        const { calculateTotalRevenue } = await import("@/lib/reporting");
        expect(calculateTotalRevenue([])).toBe(0);
    });

    it("should group revenue by payment method", async () => {
        const { groupRevenueByPaymentMethod } = await import("@/lib/reporting");
        const sales = [
            { totalAmount: 50000, paymentMethod: "cash" },
            { totalAmount: 75000, paymentMethod: "qris" },
            { totalAmount: 30000, paymentMethod: "cash" },
        ];
        const grouped = groupRevenueByPaymentMethod(sales);
        expect(grouped.cash).toBe(80000);
        expect(grouped.qris).toBe(75000);
    });
});

describe("Top Products Calculation", () => {
    it("should rank products by quantity sold", async () => {
        const { getTopProducts } = await import("@/lib/reporting");
        const items = [
            { productId: 1, productName: "Nasi Goreng", quantity: 10, subtotal: 250000 },
            { productId: 2, productName: "Es Teh", quantity: 25, subtotal: 125000 },
            { productId: 3, productName: "Mie Goreng", quantity: 5, subtotal: 125000 },
            { productId: 1, productName: "Nasi Goreng", quantity: 3, subtotal: 75000 },
        ];
        const top = getTopProducts(items, 3);
        expect(top).toHaveLength(3);
        expect(top[0].productName).toBe("Es Teh");
        expect(top[0].totalQty).toBe(25);
        expect(top[1].productName).toBe("Nasi Goreng");
        expect(top[1].totalQty).toBe(13);
    });

    it("should aggregate same product across multiple sales", async () => {
        const { getTopProducts } = await import("@/lib/reporting");
        const items = [
            { productId: 1, productName: "Test", quantity: 5, subtotal: 50000 },
            { productId: 1, productName: "Test", quantity: 3, subtotal: 30000 },
        ];
        const top = getTopProducts(items);
        expect(top).toHaveLength(1);
        expect(top[0].totalQty).toBe(8);
        expect(top[0].totalRevenue).toBe(80000);
    });
});

describe("Shift Report Calculation", () => {
    it("should calculate shift summary", async () => {
        const { calculateShiftReport } = await import("@/lib/reporting");
        const shift = {
            openAmount: 500000,
            sales: [
                { totalAmount: 100000, paymentMethod: "cash" },
                { totalAmount: 75000, paymentMethod: "qris" },
            ],
        };
        const report = calculateShiftReport(shift);
        expect(report.totalSales).toBe(175000);
        expect(report.cashSales).toBe(100000);
        expect(report.qrisSales).toBe(75000);
        expect(report.expectedCash).toBe(600000); // 500000 + 100000
    });
});

describe("Date Range Filter", () => {
    it("should filter sales by date range", async () => {
        const { filterByDateRange } = await import("@/lib/reporting");
        const sales = [
            { createdAt: new Date("2026-05-10"), totalAmount: 50000 },
            { createdAt: new Date("2026-05-12"), totalAmount: 75000 },
            { createdAt: new Date("2026-05-13"), totalAmount: 30000 },
        ];
        const filtered = filterByDateRange(sales, new Date("2026-05-11"), new Date("2026-05-13"));
        expect(filtered).toHaveLength(2);
    });

    it("should return empty for non-matching range", async () => {
        const { filterByDateRange } = await import("@/lib/reporting");
        const sales = [
            { createdAt: new Date("2026-05-10"), totalAmount: 50000 },
        ];
        const filtered = filterByDateRange(sales, new Date("2026-06-01"), new Date("2026-06-30"));
        expect(filtered).toHaveLength(0);
    });
});

describe("Export Formatting", () => {
    it("should format report data for CSV export", async () => {
        const { formatSalesCSV } = await import("@/lib/reporting");
        const sales = [
            { saleNo: "SL-001", createdAt: new Date("2026-05-13"), customerName: "Tamu", totalAmount: 50000, paymentMethod: "cash" },
        ];
        const csv = formatSalesCSV(sales);
        expect(csv).toContain("SL-001");
        expect(csv).toContain("Tamu");
        expect(csv).toContain("cash");
    });
});
