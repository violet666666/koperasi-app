"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Package, TrendingUp, TrendingDown, ShoppingCart,
  BarChart3, AlertTriangle, Store, Coffee, UtensilsCrossed,
  Car, Scissors, Dumbbell, Gamepad2, Printer, Shirt, CreditCard, Trophy,
  Clock, Banknote, ChevronDown, ChevronRight, Download, Search, Minus,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { getUnitBySlug } from "@/lib/constants/units";

const ICON_MAP: Record<string, React.ElementType> = {
  Store, Coffee, UtensilsCrossed, Car, Scissors,
  Dumbbell, Gamepad2, Printer, Shirt,
};

interface UnitDetailStats {
  productCount: number;
  activeProductCount: number;
  totalStock: number;
  lowStockCount: number;
  todayTransactions: number;
  todayRevenue: number;
  avgTransactionValue: number;
  weekRevenue: { date: string; revenue: number; transactions: number }[];
  topProducts: { productId: number; name: string; quantity: number }[];
  paymentMethods: { method: string; label: string; amount: number; count: number }[];
  // Phase 2 insights
  peakHours: { hour: number; transactions: number; revenue: number }[];
  prevWeekRevenue?: { date: string; revenue: number; transactions: number }[];
  todayProfit?: number;
  profitMargin?: number;
  topProfitProducts?: { productId: number; name: string; profit: number; revenue: number; margin: number }[];
  // Phase 3 insights
  allProductSales?: { productId: number; name: string; quantity: number; revenue: number }[];
  salesRange?: "today" | "7d" | "30d";
  salesSummary?: { totalProducts: number; totalItems: number; totalRevenue: number };
}

interface Product {
  id: number;
  name: string;
  sellPrice: number;
  costPrice: number;
  stock: number;
  stockGdg: number;
  minStock: number;
  isActive: boolean;
  productType: string;
  trackStock: boolean;
  category: string | null;
}

interface Transaction {
  id: number;
  transactionNo: string;
  amount: number;
  paymentMethod: string;
  date: string;
  type: "pos" | "service";
  items?: { productName: string; quantity: number; price: number }[];
  description?: string;
  memberName?: string;
}

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitSlug = params.unitSlug as string;
  const unitConfig = getUnitBySlug(unitSlug);

  const [stats, setStats] = React.useState<UnitDetailStats | null>(null);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [productTotal, setProductTotal] = React.useState(0);
  const [txTotal, setTxTotal] = React.useState(0);
  const [productPage, setProductPage] = React.useState(1);
  const [txPage, setTxPage] = React.useState(1);
  const [expandedTxId, setExpandedTxId] = React.useState<number | null>(null);
  const [salesRange, setSalesRange] = React.useState<"today" | "7d" | "30d">("today");
  const [productSearch, setProductSearch] = React.useState("");
  const [txRange, setTxRange] = React.useState<"today" | "7d" | "30d">("today");

  // Initial data fetch (all 3 APIs in parallel)
  React.useEffect(() => {
    if (!unitConfig) return;
    setProductPage(1);
    setTxPage(1);
    setLoading(true);
    async function fetchData() {
      try {
        const [statsRes, prodRes, txRes] = await Promise.all([
          fetch(`/api/manajemen-unit/${unitSlug}/stats?range=today`),
          fetch(`/api/manajemen-unit/${unitSlug}/products?page=1&limit=50`),
          fetch(`/api/manajemen-unit/${unitSlug}/transactions?page=1&limit=25&range=today`),
        ]);

        if (!statsRes.ok || !prodRes.ok || !txRes.ok) {
          console.error("API error:", { stats: statsRes.status, products: prodRes.status, transactions: txRes.status });
        }

        const [statsJson, prodJson, txJson] = await Promise.all([
          statsRes.json(),
          prodRes.json(),
          txRes.json(),
        ]);

        if (statsJson.data) setStats(statsJson.data);
        else setError("Data statistik tidak valid.");
        
        if (prodJson.data) {
          setProducts(prodJson.data);
          setProductTotal(prodJson.pagination?.total ?? 0);
        }
        if (txJson.data) {
          setTransactions(txJson.data);
          setTxTotal(txJson.pagination?.total ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch unit detail:", error);
        setError("Gagal memuat data unit. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [unitSlug, unitConfig]);

  // Refetch products on page change (skip page 1 — already loaded)
  React.useEffect(() => {
    if (!unitConfig || productPage === 1) return;
    fetch(`/api/manajemen-unit/${unitSlug}/products?page=${productPage}&limit=50${productSearch ? `&search=${encodeURIComponent(productSearch)}` : ""}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.data) {
          setProducts(json.data);
          setProductTotal(json.pagination?.total ?? 0);
        }
      })
      .catch(console.error);
  }, [unitSlug, unitConfig, productPage]);

  // Refetch products when search changes (debounced)
  React.useEffect(() => {
    if (!unitConfig) return;
    const timer = setTimeout(() => {
      setProductPage(1);
      fetch(`/api/manajemen-unit/${unitSlug}/products?page=1&limit=50${productSearch ? `&search=${encodeURIComponent(productSearch)}` : ""}`)
        .then(res => {
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then(json => {
          if (json.data) {
            setProducts(json.data);
            setProductTotal(json.pagination?.total ?? 0);
          }
        })
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitSlug, unitConfig, productSearch]);

  // Refetch transactions on page change (skip page 1)
  React.useEffect(() => {
    if (!unitConfig || txPage === 1) return;
    fetch(`/api/manajemen-unit/${unitSlug}/transactions?page=${txPage}&limit=25&range=${txRange}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.data) {
          setTransactions(json.data);
          setTxTotal(json.pagination?.total ?? 0);
        }
      })
      .catch(console.error);
  }, [unitSlug, unitConfig, txPage, txRange]);

  // Refetch stats when sales range changes
  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (!unitConfig) return;
    // Skip on initial mount — data already fetched with today range
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setLoading(true);
    fetch(`/api/manajemen-unit/${unitSlug}/stats?range=${salesRange}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.data) setStats(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unitSlug, unitConfig, salesRange]);

  if (!unitConfig) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-semibold">Unit tidak ditemukan</h2>
          <Button variant="outline" onClick={() => router.push("/manajemen-unit")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
          </Button>
        </div>
      </div>
    );
  }

  const Icon = ICON_MAP[unitConfig.icon] ?? Store;
  const weekTotal = stats?.weekRevenue.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const maxRevenue = Math.max(
    ...(stats?.weekRevenue.map((d) => d.revenue) ?? [1]),
    ...(stats?.prevWeekRevenue?.map((d) => d.revenue) ?? [1]),
    1,
  );
  const peakHourData = stats?.peakHours && stats.peakHours.some(h => h.transactions > 0) ? {
    maxTx: Math.max(...stats.peakHours.map(h => h.transactions), 1),
    peak: stats.peakHours.reduce((max, h) => h.transactions > max.transactions ? h : max, stats.peakHours[0]),
  } : null;

  const handleExportCSV = () => {
    if (!stats) return;
    const csvRows: string[] = [];
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

    // Section 1: Summary stats
    csvRows.push("## Ringkasan Statistik");
    csvRows.push("Metrik,Nilai");
    csvRows.push(`Jumlah Produk,${stats.productCount}`);
    csvRows.push(`Produk Aktif,${stats.activeProductCount}`);
    csvRows.push(`Total Stok,${stats.totalStock}`);
    csvRows.push(`Transaksi Hari Ini,${stats.todayTransactions}`);
    csvRows.push(`Pendapatan Hari Ini,${stats.todayRevenue}`);
    csvRows.push(`Rata-rata Transaksi,${stats.avgTransactionValue}`);
    csvRows.push(`Stok Menipis,${stats.lowStockCount}`);
    if (stats.todayProfit !== undefined) {
      csvRows.push(`Keuntungan Hari Ini,${stats.todayProfit}`);
      csvRows.push(`Margin Keuntungan (%),${stats.profitMargin?.toFixed(1) ?? "0.0"}`);
    }
    csvRows.push("");

    // Section 2: Weekly revenue comparison
    csvRows.push("## Pendapatan Mingguan");
    csvRows.push("Tanggal,Pendapatan,Jumlah Transaksi,Pendapatan Minggu Lalu,Transaksi Minggu Lalu");
    stats.weekRevenue.forEach((day, i) => {
      const prev = stats.prevWeekRevenue?.[i];
      csvRows.push([
        day.date,
        day.revenue,
        day.transactions,
        prev?.revenue ?? "",
        prev?.transactions ?? "",
      ].join(","));
    });
    csvRows.push("");

    // Section 3: Peak hours
    if (stats.peakHours && stats.peakHours.length > 0) {
      csvRows.push("## Jam Ramai Hari Ini");
      csvRows.push("Jam,Jumlah Transaksi,Pendapatan");
      stats.peakHours.forEach(h => {
        csvRows.push(`${h.hour}:00,${h.transactions},${h.revenue}`);
      });
      csvRows.push("");
    }

    // Section 4: Payment method breakdown
    if (stats.paymentMethods && stats.paymentMethods.length > 0) {
      csvRows.push("## Metode Pembayaran");
      csvRows.push("Metode,Jumlah,Jumlah Transaksi");
      stats.paymentMethods.forEach(pm => {
        csvRows.push([escape(pm.label), pm.amount, pm.count].join(","));
      });
      csvRows.push("");
    }

    // Section 5: Top products
    if (stats.topProducts && stats.topProducts.length > 0) {
      csvRows.push("## Produk Terlaris");
      csvRows.push("Peringkat,Produk,Jumlah Terjual");
      stats.topProducts.forEach((p, i) => {
        csvRows.push([i + 1, escape(p.name), p.quantity].join(","));
      });
      csvRows.push("");
    }

    // Section 6: Top profit products (store units)
    if (stats.topProfitProducts && stats.topProfitProducts.length > 0) {
      csvRows.push("## Produk Paling Menguntungkan");
      csvRows.push("Peringkat,Produk,Keuntungan,Pendapatan,Margin (%)");
      stats.topProfitProducts.forEach((p, i) => {
        csvRows.push([i + 1, escape(p.name), p.profit, p.revenue, p.margin.toFixed(1)].join(","));
      });
    }

    const blob = new Blob(["﻿" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insight-${unitSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/manajemen-unit")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${
            unitConfig.category === "store"
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
          }`}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{unitConfig.label}</h1>
            <Badge variant="outline" className="text-xs">
              {unitConfig.category === "store" ? "Unit Toko/POS" : "Unit Layanan"}
            </Badge>
          </div>
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={!stats}
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={unitConfig.category === "store" ? "Produk" : "Layanan"}
          value={stats?.productCount ?? 0}
          icon={Package}
          sub={`${stats?.activeProductCount ?? 0} aktif`}
        />
        <StatCard title="Transaksi Hari Ini" value={stats?.todayTransactions ?? 0} icon={ShoppingCart} />
        <StatCard
          title="Pendapatan Hari Ini"
          value={formatCurrency(stats?.todayRevenue ?? 0)}
          icon={stats && stats.todayRevenue > 0
            ? (stats.todayRevenue >= (stats.weekRevenue.reduce((s, d) => s + d.revenue, 0) / 7 || 0) ? TrendingUp : TrendingDown)
            : Minus
          }
          sub={stats ? `${formatCurrency(stats.weekRevenue.reduce((s, d) => s + d.revenue, 0))} minggu ini` : undefined}
        />
        <StatCard title="Rata-rata Transaksi" value={formatCurrency(stats?.avgTransactionValue ?? 0)} icon={BarChart3} />
      </div>

      {stats && stats.lowStockCount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4" />
          <span>{stats.lowStockCount} produk dengan stok menipis</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="ringkasan">
        <TabsList>
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="produk">Produk ({productTotal})</TabsTrigger>
          <TabsTrigger value="transaksi">Transaksi ({txTotal})</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan" className="mt-4">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4">Perbandingan Mingguan</h3>
              {loading ? (
                <div className="h-40 bg-muted rounded animate-pulse" />
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-muted-foreground/20 rounded" />
                      Minggu lalu
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-2 bg-primary/80 rounded" />
                      Minggu ini
                    </div>
                  </div>
                  <div className="flex items-end gap-1 h-40">
                    {stats?.weekRevenue.map((day, i) => {
                      const prevDay = stats?.prevWeekRevenue?.[i];
                      return (
                        <div key={day.date} className="flex-1 flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground">
                            {formatCurrency(day.revenue).replace("Rp", "").trim()}
                          </span>
                          <div className="flex gap-px items-end h-32 w-full">
                            {prevDay && (
                              <div
                                className="flex-1 bg-muted-foreground/20 rounded-t"
                                style={{ height: `${Math.max((prevDay.revenue / maxRevenue) * 100, prevDay.revenue > 0 ? 4 : 0)}%` }}
                                title={`Minggu lalu: ${formatCurrency(prevDay.revenue)}`}
                              />
                            )}
                            <div
                              className="flex-1 bg-primary/80 rounded-t"
                              style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, day.revenue > 0 ? 4 : 0)}%` }}
                              title={`Minggu ini: ${formatCurrency(day.revenue)}`}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1">
                            {new Date(day.date).toLocaleDateString("id-ID", { weekday: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t text-sm text-muted-foreground">
                    Total minggu ini: <span className="font-semibold text-foreground">{formatCurrency(weekTotal)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Peak Hours */}
          <Card className="mt-4">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Jam Ramai Hari Ini</h3>
              </div>
              {loading ? (
                <div className="h-28 bg-muted rounded animate-pulse" />
              ) : peakHourData ? (
                <>
                  <div className="flex items-end gap-0.5 h-28">
                    {stats?.peakHours?.map((h) => (
                      <div key={h.hour} className="flex-1 flex flex-col items-center">
                        <div
                          className={`w-full rounded-t ${
                            h.hour === peakHourData.peak.hour ? "bg-amber-500" : "bg-primary/50"
                          }`}
                          style={{ height: `${Math.max((h.transactions / peakHourData.maxTx) * 100, h.transactions > 0 ? 4 : 0)}%` }}
                          title={`${h.hour}:00 — ${h.transactions} transaksi, ${formatCurrency(h.revenue)}`}
                        />
                        {h.hour % 3 === 0 && (
                          <span className="text-[9px] text-muted-foreground mt-0.5">{h.hour}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Puncak: <span className="font-medium text-foreground">{peakHourData.peak.hour}:00</span> ({peakHourData.peak.transactions} transaksi)
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini — lihat chart mingguan di atas untuk data historis</p>
              )}
            </CardContent>
          </Card>

          {/* Summary detail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">Stok</h3>
                <div className="text-2xl font-bold">{stats?.totalStock ?? 0}</div>
                <p className="text-sm text-muted-foreground">Total stok gudang</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">Metode Pembayaran Hari Ini</h3>
                </div>
                {stats?.paymentMethods && stats.paymentMethods.length > 0 ? (
                  <div className="space-y-2">
                    {stats.paymentMethods.map((pm) => {
                      const total = stats.paymentMethods.reduce((s, p) => s + p.amount, 0);
                      const pct = total > 0 ? Math.round((pm.amount / total) * 100) : 0;
                      return (
                        <div key={pm.method} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{pm.label}</span>
                            <span className="text-muted-foreground">{formatCurrency(pm.amount)} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini</p>
                )}
              </CardContent>
            </Card>
          </div>
          {unitConfig.category === "store" && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <h3 className="font-semibold">Penjualan Produk</h3>
                  </div>
                  <div className="flex rounded-lg border overflow-hidden">
                    {([
                      { value: "today" as const, label: "Hari Ini" },
                      { value: "7d" as const, label: "7 Hari" },
                      { value: "30d" as const, label: "30 Hari" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setSalesRange(opt.value)}
                        className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                          salesRange === opt.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {stats?.allProductSales && stats.allProductSales.length > 0 ? (
                  <>
                    <div className="max-h-80 overflow-y-auto space-y-2">
                      {stats.allProductSales.map((p, i) => {
                        const totalRevenue = stats.salesSummary?.totalRevenue ?? 1;
                        const pct = totalRevenue > 0 ? Math.round((p.revenue / totalRevenue) * 100) : 0;
                        return (
                          <div key={p.productId}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground w-5 text-right">{i + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium truncate">{p.name}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="secondary" className="text-xs">{p.quantity} terjual</Badge>
                                    <span className="text-xs text-muted-foreground">{formatCurrency(p.revenue)}</span>
                                  </div>
                                </div>
                                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-500/60 rounded-full transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex gap-4">
                      <span>{stats.salesSummary?.totalProducts} produk</span>
                      <span>{stats.salesSummary?.totalItems} item terjual</span>
                      <span className="font-medium text-foreground">{formatCurrency(stats.salesSummary?.totalRevenue ?? 0)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada penjualan di periode ini</p>
                )}
              </CardContent>
            </Card>
          )}
          {/* Profit overview (store units only) */}
          {stats?.todayProfit !== undefined && (
            <Card className="mt-4">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Keuntungan Hari Ini</h3>
                  </div>
                  <Badge
                    variant={(stats.profitMargin ?? 0) >= 20 ? "default" : (stats.profitMargin ?? 0) > 0 ? "secondary" : "destructive"}
                    className="text-xs"
                  >
                    {stats.profitMargin?.toFixed(1)}% margin
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(stats.todayProfit)}</div>
                {stats.topProfitProducts && stats.topProfitProducts.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Produk paling menguntungkan:</p>
                    {stats.topProfitProducts.slice(0, 3).map((p, i) => (
                      <div key={p.productId} className="flex justify-between text-sm">
                        <span>
                          <span className="text-muted-foreground mr-1">{i + 1}.</span>
                          {p.name}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(p.profit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="produk" className="mt-4">
          {/* Product search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {products.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {loading ? "Memuat produk..." : productSearch ? `Tidak ada produk yang cocok dengan "${productSearch}"` : "Tidak ada produk untuk unit ini"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Stok</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground">{p.category ?? "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(p.sellPrice))}</TableCell>
                        <TableCell className="text-right">
                          <span className={p.stock <= (p.minStock ?? 5) ? "text-red-600 font-medium" : ""}>{p.stock}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? "default" : "secondary"} className="text-xs">
                            {p.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {productTotal > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Menampilkan {((productPage - 1) * 50) + 1}–{Math.min(productPage * 50, productTotal)} dari {productTotal} produk
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage(p => p - 1)}
                >
                  ← Sebelumnya
                </Button>
                <span className="text-xs text-muted-foreground">
                  Hal {productPage}/{Math.ceil(productTotal / 50)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={productPage >= Math.ceil(productTotal / 50)}
                  onClick={() => setProductPage(p => p + 1)}
                >
                  Selanjutnya →
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="transaksi" className="mt-4">
          {/* Transaction date filter */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Periode:</span>
            {([
              { value: "today" as const, label: "Hari Ini" },
              { value: "7d" as const, label: "7 Hari" },
              { value: "30d" as const, label: "30 Hari" },
            ]).map((opt) => (
              <Button
                key={opt.value}
                variant={txRange === opt.value ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => {
                  setTxRange(opt.value);
                  setTxPage(1);
                  // Refetch transactions
                  fetch(`/api/manajemen-unit/${unitSlug}/transactions?page=1&limit=25&range=${opt.value}`)
                    .then(res => res.ok ? res.json() : Promise.reject(res.status))
                    .then(json => {
                      if (json.data) {
                        setTransactions(json.data);
                        setTxTotal(json.pagination?.total ?? 0);
                      }
                    })
                    .catch(console.error);
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {loading ? "Memuat transaksi..." : `Tidak ada transaksi ${txRange === "today" ? "hari ini" : txRange === "7d" ? "dalam 7 hari terakhir" : "dalam 30 hari terakhir"}`}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Transaksi</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead>Metode</TableHead>
                      <TableHead>Waktu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <React.Fragment key={tx.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedTxId(expandedTxId === tx.id ? null : tx.id)}
                        >
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {expandedTxId === tx.id
                                ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              }
                              {tx.transactionNo}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{tx.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(tx.date).toLocaleString("id-ID")}
                          </TableCell>
                        </TableRow>
                        {expandedTxId === tx.id && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/30 px-8 py-3">
                              {tx.type === "pos" && tx.items && tx.items.length > 0 ? (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Detail Item:</p>
                                  {tx.items.map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                      <span>{item.productName} × {item.quantity}</span>
                                      <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : tx.type === "service" ? (
                                <div className="space-y-1 text-sm">
                                  {tx.memberName && (
                                    <p><span className="text-muted-foreground mr-1">Anggota:</span>{tx.memberName}</p>
                                  )}
                                  {tx.description && (
                                    <p><span className="text-muted-foreground mr-1">Keterangan:</span>{tx.description}</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">Tidak ada detail tambahan</p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          {txTotal > 25 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Menampilkan {((txPage - 1) * 25) + 1}–{Math.min(txPage * 25, txTotal)} dari {txTotal} transaksi
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage(p => p - 1)}
                >
                  ← Sebelumnya
                </Button>
                <span className="text-xs text-muted-foreground">
                  Hal {txPage}/{Math.ceil(txTotal / 25)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPage >= Math.ceil(txTotal / 25)}
                  onClick={() => setTxPage(p => p + 1)}
                >
                  Selanjutnya →
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
