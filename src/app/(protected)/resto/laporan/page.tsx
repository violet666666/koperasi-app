"use client";

import * as React from "react";
import { useAuth } from "@/lib/hooks";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    BarChart3, TrendingUp, DollarSign, CreditCard, Banknote,
    Loader2, Download, Calendar, ShoppingBag,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface SalesSummary {
    totalRevenue: number;
    transactionCount: number;
    byPayment: Record<string, number>;
}

interface TopProduct {
    productId: string;
    name: string;
    qty: number;
    revenue: number;
}

interface SaleRecord {
    id: number;
    saleNo: string;
    customerName: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    items: { productName: string; quantity: number; subtotal: number }[];
}

export default function RestoLaporanPage() {
    const { user } = useAuth();
    const [summary, setSummary] = React.useState<SalesSummary | null>(null);
    const [topProducts, setTopProducts] = React.useState<TopProduct[]>([]);
    const [sales, setSales] = React.useState<SaleRecord[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [dateFrom, setDateFrom] = React.useState(() => {
        const d = new Date();
        d.setDate(1); // first of month
        return d.toISOString().split("T")[0];
    });
    const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().split("T")[0]);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ unitType: "resto", from: dateFrom, to: dateTo });
            const res = await fetch(`/api/toko/reports/sales-summary?${params}`);
            const json = await res.json();
            setSummary(json.summary);
            setTopProducts(json.topProducts || []);
            setSales(json.sales || []);
        } catch {
            toast.error("Gagal memuat laporan");
        } finally { setIsLoading(false); }
    }, [dateFrom, dateTo]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const handleExportCSV = () => {
        if (sales.length === 0) { toast.error("Tidak ada data untuk diexport"); return; }
        const header = "No Nota,Tanggal,Nama,Total,Metode";
        const rows = sales.map(s =>
            `${s.saleNo},${new Date(s.createdAt).toLocaleDateString("id-ID")},${s.customerName || "Tamu"},${s.totalAmount},${s.paymentMethod}`
        );
        const csv = [header, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `laporan-resto-${dateFrom}-${dateTo}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (isLoading && !summary) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Laporan Penjualan Resto"
                description="Ringkasan penjualan, menu terlaris, dan rekap shift"
                actions={
                    <Button size="sm" variant="outline" onClick={handleExportCSV}>
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                }
            />

            {/* Date Range Filter */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Calendar className="h-4 w-4 text-slate-400 hidden sm:block" />
                <div className="flex items-center gap-2">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                        className="border rounded-md px-2 py-1.5 text-sm w-full sm:w-auto" />
                    <span className="text-slate-400 text-xs sm:text-sm">s/d</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                        className="border rounded-md px-2 py-1.5 text-sm w-full sm:w-auto" />
                </div>
                <Button size="sm" onClick={loadData} disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                </Button>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    <Card>
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-emerald-50 rounded-lg">
                                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] sm:text-xs text-slate-500">Total Pendapatan</p>
                                    <p className="text-lg sm:text-xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-sky-50 rounded-lg">
                                    <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-sky-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Total Transaksi</p>
                                    <p className="text-xl font-bold">{summary.transactionCount}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg">
                                    <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Tunai</p>
                                    <p className="text-xl font-bold">{formatCurrency(summary.byPayment.cash || 0)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-3 sm:p-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="p-1.5 sm:p-2 bg-purple-50 rounded-lg">
                                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">QRIS</p>
                                    <p className="text-xl font-bold">{formatCurrency(summary.byPayment.qris || 0)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Products */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-500" /> Menu Terlaris
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {topProducts.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">Belum ada data penjualan</p>
                        ) : (
                            <div className="space-y-2">
                                {topProducts.map((p, i) => (
                                    <div key={p.productId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                                        <Badge variant={i < 3 ? "default" : "secondary"} className="w-7 justify-center">
                                            {i + 1}
                                        </Badge>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{p.name}</p>
                                            <p className="text-xs text-slate-400">{p.qty} terjual</p>
                                        </div>
                                        <span className="font-mono text-sm font-semibold">{formatCurrency(p.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Sales */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-sky-500" /> Transaksi Terbaru
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sales.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">Belum ada transaksi</p>
                        ) : (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                {sales.slice(0, 20).map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 text-sm">
                                        <div>
                                            <p className="font-medium">{s.customerName || "Tamu"}</p>
                                            <p className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleString("id-ID")}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-semibold">{formatCurrency(s.totalAmount)}</p>
                                            <Badge variant="outline" className="text-[10px]">{s.paymentMethod}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
