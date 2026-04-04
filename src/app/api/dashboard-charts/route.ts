import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/dashboard-charts — Data for dashboard charts
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const days = Number(url.searchParams.get("days") || 30);

        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        // ============================================================
        // 1. Daily kas masuk vs kas keluar (last N days)
        // ============================================================
        const [kasIn, kasOut, storeSales, loanPayments] = await Promise.all([
            // Kas masuk transactions
            prisma.cashBankTransaction.groupBy({
                by: ["transactionDate"],
                where: {
                    type: "in",
                    transactionDate: { gte: startDate },
                },
                _sum: { amount: true },
                orderBy: { transactionDate: "asc" },
            }),
            // Kas keluar transactions
            prisma.cashBankTransaction.groupBy({
                by: ["transactionDate"],
                where: {
                    type: "out",
                    transactionDate: { gte: startDate },
                },
                _sum: { amount: true },
                orderBy: { transactionDate: "asc" },
            }),
            // Penjualan toko per unit (last 30 days)
            prisma.storeSale.groupBy({
                by: ["unitType"],
                where: {
                    createdAt: { gte: startDate },
                },
                _sum: { totalAmount: true },
                _count: { _all: true },
            }),
            // Loan angsuran terbayar (last 30 days)
            prisma.loanPayment.aggregate({
                where: { paymentDate: { gte: startDate } },
                _sum: { amount: true },
                _count: { _all: true },
            }),
        ]);

        // Build daily kas flow map
        const flowByDate: Record<string, { masuk: number; keluar: number }> = {};

        for (let i = 0; i < days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split("T")[0];
            flowByDate[key] = { masuk: 0, keluar: 0 };
        }

        for (const row of kasIn) {
            const key = new Date(row.transactionDate).toISOString().split("T")[0];
            if (flowByDate[key]) {
                flowByDate[key].masuk += Number(row._sum.amount || 0);
            }
        }
        for (const row of kasOut) {
            const key = new Date(row.transactionDate).toISOString().split("T")[0];
            if (flowByDate[key]) {
                flowByDate[key].keluar += Number(row._sum.amount || 0);
            }
        }

        // Format for chart: last 14 days for readability
        const recentDays = 14;
        const dailyFlow = Object.entries(flowByDate)
            .slice(-recentDays)
            .map(([date, vals]) => {
                const d = new Date(date);
                const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                return { date: label, masuk: vals.masuk, keluar: vals.keluar };
            });

        // ============================================================
        // 2. Unit Usaha Sales Summary
        // ============================================================
        const UNIT_LABELS: Record<string, string> = {
            toko: "Toko Sembako",
            cuci_mobil: "Cuci Mobil",
            barbershop: "Barbershop",
            playstation: "PlayStation",
            fitness: "Fitness",
            resto_cafe: "Resto & Cafe",
            laundry: "Laundry",
        };

        const unitSales = storeSales.map(u => ({
            unit: UNIT_LABELS[u.unitType] || u.unitType,
            unitType: u.unitType,
            total: Number(u._sum.totalAmount || 0),
            count: u._count._all,
        }));

        // ============================================================
        // 3. Savings & Loan summary for donut
        // ============================================================
        const [savingsByType, loanStats, unitTransactionStats] = await Promise.all([
            prisma.savingsAccount.groupBy({
                by: ["productId"],
                where: { status: "active" },
                _sum: { balance: true },
                _count: { _all: true },
            }),
            prisma.loan.groupBy({
                by: ["status"],
                _sum: { principalOutstanding: true },
                _count: { _all: true },
            }),
            prisma.unitTransaction.groupBy({
                by: ["unitType"],
                _sum: { amount: true },
                _count: { _all: true },
                where: { isPaid: false },
            }),
        ]);

        return NextResponse.json({
            data: {
                dailyFlow,
                unitSales,
                loanStats: loanStats.map(s => ({
                    status: s.status,
                    outstanding: Number(s._sum.principalOutstanding || 0),
                    count: s._count._all,
                })),
                unpaidUnitDebt: unitTransactionStats.map(u => ({
                    unit: UNIT_LABELS[u.unitType] || u.unitType,
                    unitType: u.unitType,
                    total: Number(u._sum.amount || 0),
                    count: u._count._all,
                })),
                loanPaymentThisMonth: {
                    total: Number(loanPayments._sum.amount || 0),
                    count: loanPayments._count._all,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/dashboard-charts error:", error);
        return NextResponse.json({ message: "Gagal memuat data chart" }, { status: 500 });
    }
}
