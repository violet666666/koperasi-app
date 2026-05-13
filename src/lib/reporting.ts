// Reporting Dashboard — Sales summary, top products, shift report, export
// Used by Resto and Cafe LSP admin reporting pages.

export interface SaleRecord {
    totalAmount: number;
    paymentMethod: string;
    createdAt?: Date;
    saleNo?: string;
    customerName?: string;
}

export interface SaleItemRecord {
    productId: number;
    productName: string;
    quantity: number;
    subtotal: number;
}

export interface TopProduct {
    productId: number;
    productName: string;
    totalQty: number;
    totalRevenue: number;
}

export interface ShiftReport {
    totalSales: number;
    cashSales: number;
    qrisSales: number;
    salaryCutSales: number;
    expectedCash: number;
    transactionCount: number;
}

export function calculateTotalRevenue(sales: SaleRecord[]): number {
    return sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
}

export function groupRevenueByPaymentMethod(sales: SaleRecord[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    for (const sale of sales) {
        const method = sale.paymentMethod || "cash";
        grouped[method] = (grouped[method] || 0) + Number(sale.totalAmount);
    }
    return grouped;
}

export function getTopProducts(items: SaleItemRecord[], limit?: number): TopProduct[] {
    const productMap = new Map<number, TopProduct>();
    for (const item of items) {
        const existing = productMap.get(item.productId);
        if (existing) {
            existing.totalQty += item.quantity;
            existing.totalRevenue += Number(item.subtotal);
        } else {
            productMap.set(item.productId, {
                productId: item.productId,
                productName: item.productName,
                totalQty: item.quantity,
                totalRevenue: Number(item.subtotal),
            });
        }
    }
    const sorted = Array.from(productMap.values()).sort((a, b) => b.totalQty - a.totalQty);
    return limit ? sorted.slice(0, limit) : sorted;
}

export function calculateShiftReport(shift: { openAmount: number; sales: SaleRecord[] }): ShiftReport {
    const totalSales = calculateTotalRevenue(shift.sales);
    const grouped = groupRevenueByPaymentMethod(shift.sales);
    return {
        totalSales,
        cashSales: grouped["cash"] || 0,
        qrisSales: grouped["qris"] || 0,
        salaryCutSales: grouped["salary_cut"] || 0,
        expectedCash: shift.openAmount + (grouped["cash"] || 0),
        transactionCount: shift.sales.length,
    };
}

export function filterByDateRange<T extends { createdAt: Date }>(
    items: T[],
    startDate: Date,
    endDate: Date,
): T[] {
    return items.filter(item => {
        const d = new Date(item.createdAt);
        return d >= startDate && d <= endDate;
    });
}

export function formatSalesCSV(sales: SaleRecord[]): string {
    const header = "No Nota,Tanggal,Nama Pelanggan,Total,Metode Pembayaran";
    const rows = sales.map(s =>
        `${s.saleNo || ""},${s.createdAt ? new Date(s.createdAt).toLocaleDateString("id-ID") : ""},${s.customerName || ""},${s.totalAmount},${s.paymentMethod}`
    );
    return [header, ...rows].join("\n");
}
