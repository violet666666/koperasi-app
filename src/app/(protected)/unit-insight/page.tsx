"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    TrendingUp, TrendingDown, AlertTriangle, Package, BarChart3,
    ArrowUpDown, Calendar, RefreshCw, Trophy, ChevronDown,
    ChevronUp, ArrowRight, Search,
    ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
    Download, FileSpreadsheet,
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCurrency } from "@/lib/constants";
import { unitTypeToSlug, getUnitLabel } from "@/lib/constants/units";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/export-utils";

// ─── Types ────────────────────────────────────────────────

interface RankedProduct {
    productId: number;
    productName: string;
    quantity: number;
    revenue: number;
    contribution: number;
}

interface TrendSeries {
    productId: number;
    productName: string;
    data: number[];
    revenueData: number[];
}

interface DailyTrend {
    dates: string[];
    series: TrendSeries[];
}

interface StagnantItem {
    productId: number;
    productName: string;
    stock: number;
    lastSoldAt: string | null;
    daysSinceSale: number;
}

interface WeeklyComparisonItem {
    productId: number;
    productName: string;
    thisWeekQty: number;
    lastWeekQty: number;
    qtyChange: number | null;
    thisWeekRevenue: number;
    lastWeekRevenue: number;
    revenueChange: number | null;
}

interface InsightData {
    unitType: string;
    rangeLabel: string;
    rangeFrom: string;
    rangeTo: string;
    ranking: {
        bestSelling: RankedProduct[];
        worstSelling: RankedProduct[];
        summary: { totalProducts: number; totalItems: number; totalRevenue: number };
    };
    dailyTrend: DailyTrend;
    stagnant: { threshold: number; items: StagnantItem[] };
    weeklyComparison: { items: WeeklyComparisonItem[] };
}

// ─── Color palette for chart series ──────────────────────

const CHART_COLORS = [
    "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
    "#0891b2", "#e11d48", "#65a30d", "#c026d3", "#0d9488",
    "#f97316", "#4f46e5", "#059669", "#be123c", "#7c3aed",
];

// ─── Range presets ────────────────────────────────────────

const RANGE_PRESETS = [
    { value: "today", label: "Hari Ini" },
    { value: "7d", label: "7 Hari" },
    { value: "30d", label: "30 Hari" },
] as const;

const PAGE_SIZE_OPTIONS = [10, 50, 100] as const;
const ALL_ITEMS = -1; // sentinel: show all rows in one page

// ─── Component ────────────────────────────────────────────

export default function UnitInsightPage() {
    const { user } = useAuth();
    const router = useRouter();
    const roleName = typeof user?.role === "string" ? user.role : (user?.role as any)?.name ?? "";
    const userUnitType = (user as any)?.unitType as string | null;
    const permissions = (user as any)?.permissions ?? [];
    const isOperator = permissions.includes("manage_all");

    // Determine which unit slug to use
    const [selectedSlug, setSelectedSlug] = React.useState<string>(() => {
        if (isOperator) return "toko"; // default for operator
        if (userUnitType) return unitTypeToSlug(userUnitType);
        return "toko";
    });

    // State
    const [data, setData] = React.useState<InsightData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [range, setRange] = React.useState("7d");
    const [customFrom, setCustomFrom] = React.useState("");
    const [customTo, setCustomTo] = React.useState("");
    const [showCustom, setShowCustom] = React.useState(false);
    const [rankingSort, setRankingSort] = React.useState<"best" | "worst">("best");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [selectedTrendItems, setSelectedTrendItems] = React.useState<number[]>([]);

    // Per-tab pagination state
    const [rankingPage, setRankingPage] = React.useState(1);
    const [rankingPageSize, setRankingPageSize] = React.useState(50);
    const [weeklyPage, setWeeklyPage] = React.useState(1);
    const [weeklyPageSize, setWeeklyPageSize] = React.useState(50);
    const [stagnantPage, setStagnantPage] = React.useState(1);
    const [stagnantPageSize, setStagnantPageSize] = React.useState(50);
    const [recapPage, setRecapPage] = React.useState(1);
    const [recapPageSize, setRecapPageSize] = React.useState(50);

    // Fetch data
    const fetchData = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (showCustom && customFrom && customTo) {
                params.set("from", customFrom);
                params.set("to", customTo);
            } else {
                params.set("range", range);
            }
            const res = await fetch(`/api/unit-insight/${selectedSlug}/sales-trend?${params}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Error ${res.status}`);
            }
            const json = await res.json();
            setData(json.data);
        } catch (err: any) {
            setError(err.message || "Gagal memuat data");
        } finally {
            setLoading(false);
        }
    }, [selectedSlug, range, showCustom, customFrom, customTo]);

    React.useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-select all trend items when data loads
    React.useEffect(() => {
        if (data?.dailyTrend.series) {
            setSelectedTrendItems(data.dailyTrend.series.slice(0, 5).map(s => s.productId));
        }
    }, [data?.dailyTrend.series]);

    // Reset pagination when data source or filters change
    React.useEffect(() => {
        setRankingPage(1);
        setWeeklyPage(1);
        setStagnantPage(1);
        setRecapPage(1);
    }, [data, rankingSort, searchQuery]);

    // Build chart data from trend
    const chartData = React.useMemo(() => {
        if (!data?.dailyTrend) return [];
        const { dates, series } = data.dailyTrend;
        const filtered = series.filter(s => selectedTrendItems.includes(s.productId));
        return dates.map((date, i) => {
            const point: Record<string, any> = { date: formatDateShort(date) };
            for (const s of filtered) {
                point[s.productName] = s.data[i];
            }
            return point;
        });
    }, [data?.dailyTrend, selectedTrendItems]);

    // Filtered ranking
    const filteredRanking = React.useMemo(() => {
        const list = rankingSort === "best" ? (data?.ranking.bestSelling ?? []) : (data?.ranking.worstSelling ?? []);
        if (!searchQuery) return list;
        return list.filter(p => p.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [data?.ranking, rankingSort, searchQuery]);

    // Paginated slices for each tab
    const paginatedRanking = React.useMemo(() => {
        if (rankingPageSize === ALL_ITEMS) return filteredRanking;
        const start = (rankingPage - 1) * rankingPageSize;
        return filteredRanking.slice(start, start + rankingPageSize);
    }, [filteredRanking, rankingPage, rankingPageSize]);

    const paginatedWeekly = React.useMemo(() => {
        const items = data?.weeklyComparison.items ?? [];
        if (weeklyPageSize === ALL_ITEMS) return items;
        const start = (weeklyPage - 1) * weeklyPageSize;
        return items.slice(start, start + weeklyPageSize);
    }, [data?.weeklyComparison.items, weeklyPage, weeklyPageSize]);

    const paginatedStagnant = React.useMemo(() => {
        const items = data?.stagnant.items ?? [];
        if (stagnantPageSize === ALL_ITEMS) return items;
        const start = (stagnantPage - 1) * stagnantPageSize;
        return items.slice(start, start + stagnantPageSize);
    }, [data?.stagnant.items, stagnantPage, stagnantPageSize]);

    // Recap data = all products from bestSelling (complete list, sorted by qty desc)
    const recapData = React.useMemo(() => {
        return data?.ranking.bestSelling ?? [];
    }, [data?.ranking.bestSelling]);

    const paginatedRecap = React.useMemo(() => {
        if (recapPageSize === ALL_ITEMS) return recapData;
        const start = (recapPage - 1) * recapPageSize;
        return recapData.slice(start, start + recapPageSize);
    }, [recapData, recapPage, recapPageSize]);

    // ─── Export handlers (bypass pagination — uses full dataset) ──────
    const unitLabel = data ? getUnitLabel(data.unitType) : "";
    const rangeLabel = data?.rangeLabel ?? "";

    const handleExportRanking = React.useCallback((format: "pdf" | "excel") => {
        if (!data) return;
        const bestCols: ExportColumn[] = [
            { header: "Rank", key: "rank", width: 6 },
            { header: "Produk", key: "productName", width: 35 },
            { header: "Qty Terjual", key: "quantity", width: 14 },
            { header: "Revenue", key: "revenue", width: 20, format: (v) => formatCurrency(v as number) },
            { header: "Kontribusi %", key: "contribution", width: 14, format: (v) => `${((v as number) * 100).toFixed(1)}%` },
        ];
        const mapToRows = (list: RankedProduct[]) => list.map((p, i) => ({ ...p, rank: i + 1 }));
        const title = `Ranking Penjualan — ${unitLabel}`;
        const fileName = `ranking_${data.unitType}_${data.rangeFrom}_${data.rangeTo}`;

        if (format === "excel") {
            // Multi-sheet: Terlaris + Kurang Laris
            const bestData = mapToRows(data.ranking.bestSelling);
            const worstData = mapToRows(data.ranking.worstSelling);
            exportToExcel(bestData, bestCols, `${fileName}_terlaris`, "Terlaris");
            // Second sheet needs separate call — export worst as separate file for clarity
            exportToExcel(worstData, bestCols, `${fileName}_kurang_laris`, "Kurang Laris");
        } else {
            const allData = mapToRows(
                rankingSort === "best" ? data.ranking.bestSelling : data.ranking.worstSelling
            );
            exportToPDF(allData, bestCols, title, fileName, {
                subtitle: `${rangeLabel} • ${unitLabel} • ${data.ranking.summary.totalProducts} produk • ${data.ranking.summary.totalItems} item terjual`,
            });
        }
    }, [data, unitLabel, rangeLabel, rankingSort]);

    const handleExportWeekly = React.useCallback((format: "pdf" | "excel") => {
        if (!data) return;
        const cols: ExportColumn[] = [
            { header: "Produk", key: "productName", width: 35 },
            { header: "Minggu Ini (Qty)", key: "thisWeekQty", width: 16 },
            { header: "Minggu Lalu (Qty)", key: "lastWeekQty", width: 16 },
            { header: "Revenue Minggu Ini", key: "thisWeekRevenue", width: 22, format: (v) => formatCurrency(v as number) },
            { header: "Revenue Minggu Lalu", key: "lastWeekRevenue", width: 22, format: (v) => formatCurrency(v as number) },
            {
                header: "Perubahan %", key: "qtyChange", width: 14,
                format: (v) => v === null ? "BARU" : `${((v as number) * 100).toFixed(1)}%`,
            },
        ];
        const items = data.weeklyComparison.items;
        const title = `Perbandingan Mingguan — ${unitLabel}`;
        const fileName = `mingguan_${data.unitType}_${data.rangeFrom}_${data.rangeTo}`;

        if (format === "excel") {
            exportToExcel(items as unknown as Record<string, unknown>[], cols, fileName, "Mingguan");
        } else {
            exportToPDF(items as unknown as Record<string, unknown>[], cols, title, fileName, {
                subtitle: `${rangeLabel} • ${unitLabel}`,
            });
        }
    }, [data, unitLabel, rangeLabel]);

    const handleExportStagnant = React.useCallback((format: "pdf" | "excel") => {
        if (!data) return;
        const cols: ExportColumn[] = [
            { header: "Produk", key: "productName", width: 35 },
            { header: "Stok", key: "stock", width: 8 },
            {
                header: "Terakhir Terjual", key: "lastSoldAt", width: 18,
                format: (v) => v ? new Date(v as string).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "Belum pernah",
            },
            {
                header: "Hari Tanpa Penjualan", key: "daysSinceSale", width: 20,
                format: (v) => (v as number) >= 999 ? "Belum pernah" : `${v} hari`,
            },
        ];
        const items = data.stagnant.items;
        const title = `Item Stagnan — ${unitLabel}`;
        const fileName = `stagnan_${data.unitType}_${data.rangeFrom}_${data.rangeTo}`;

        if (format === "excel") {
            exportToExcel(items as unknown as Record<string, unknown>[], cols, fileName, "Stagnan");
        } else {
            exportToPDF(items as unknown as Record<string, unknown>[], cols, title, fileName, {
                subtitle: `Produk tidak terjual ≥ ${data.stagnant.threshold} hari • ${rangeLabel} • ${unitLabel}`,
            });
        }
    }, [data, unitLabel, rangeLabel]);

    const handleExportRecap = React.useCallback((format: "pdf" | "excel") => {
        if (!data) return;
        const cols: ExportColumn[] = [
            { header: "No", key: "no", width: 6 },
            { header: "Produk", key: "productName", width: 35 },
            { header: "Total Qty Terjual", key: "quantity", width: 16 },
            { header: "Total Revenue", key: "revenue", width: 22, format: (v) => formatCurrency(v as number) },
            { header: "Kontribusi %", key: "contribution", width: 14, format: (v) => `${((v as number) * 100).toFixed(1)}%` },
        ];
        const items = data.ranking.bestSelling.map((p, i) => ({ ...p, no: i + 1 }));
        const title = `Rekap Penjualan — ${unitLabel}`;
        const fileName = `rekap_${data.unitType}_${data.rangeFrom}_${data.rangeTo}`;

        if (format === "excel") {
            exportToExcel(items as unknown as Record<string, unknown>[], cols, fileName, "Rekap Penjualan");
        } else {
            exportToPDF(items as unknown as Record<string, unknown>[], cols, title, fileName, {
                subtitle: `${rangeLabel} • ${unitLabel} • ${data.ranking.summary.totalProducts} produk • Total: ${data.ranking.summary.totalItems} item • ${formatCurrency(data.ranking.summary.totalRevenue)}`,
            });
        }
    }, [data, unitLabel, rangeLabel]);

    // Operator unit selector
    const storeUnits = [
        { slug: "toko", label: "Toko PRIMKOPPOL" },
        { slug: "resto", label: "Resto & Cafe" },
        { slug: "cafe-lsp", label: "Cafe LSP" },
    ];

    if (!user) return null;

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* ─── Header ───────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Insight Penjualan
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data ? `${data.rangeLabel} • ${getUnitLabel(data.unitType)}` : "Memuat..."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isOperator && (
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                            {storeUnits.map(u => (
                                <Button
                                    key={u.slug}
                                    size="sm"
                                    variant={selectedSlug === u.slug ? "default" : "ghost"}
                                    className="text-xs h-7"
                                    onClick={() => setSelectedSlug(u.slug)}
                                >
                                    {u.label}
                                </Button>
                            ))}
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                        <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* ─── Range Filter ─────────────────────────── */}
            <Card>
                <CardContent className="py-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-1">
                            {RANGE_PRESETS.map(p => (
                                <Button
                                    key={p.value}
                                    size="sm"
                                    variant={range === p.value && !showCustom ? "default" : "ghost"}
                                    className="text-xs h-7"
                                    onClick={() => { setRange(p.value); setShowCustom(false); }}
                                >
                                    {p.label}
                                </Button>
                            ))}
                            <Button
                                size="sm"
                                variant={showCustom ? "default" : "ghost"}
                                className="text-xs h-7"
                                onClick={() => setShowCustom(!showCustom)}
                            >
                                <Calendar className="h-3 w-3 mr-1" />
                                Custom
                            </Button>
                        </div>
                        {showCustom && (
                            <div className="flex items-center gap-2">
                                <Input
                                    type="date"
                                    value={customFrom}
                                    onChange={e => setCustomFrom(e.target.value)}
                                    className="h-8 text-xs w-36"
                                />
                                <span className="text-xs text-muted-foreground">s/d</span>
                                <Input
                                    type="date"
                                    value={customTo}
                                    onChange={e => setCustomTo(e.target.value)}
                                    className="h-8 text-xs w-36"
                                />
                                <Button size="sm" className="h-8 text-xs" onClick={fetchData} disabled={!customFrom || !customTo}>
                                    Terapkan
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ─── Error State ──────────────────────────── */}
            {error && (
                <Card className="border-destructive">
                    <CardContent className="py-4">
                        <p className="text-sm text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            {error}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* ─── Loading State ────────────────────────── */}
            {loading && !data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                            <CardContent className="py-6">
                                <div className="h-4 bg-muted animate-pulse rounded w-20 mb-2" />
                                <div className="h-6 bg-muted animate-pulse rounded w-28" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ─── Summary Cards ────────────────────────── */}
            {data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <SummaryCard
                        title="Total Produk Terjual"
                        value={data.ranking.summary.totalProducts}
                        icon={Package}
                        bg="bg-blue-50 dark:bg-blue-950/30"
                    />
                    <SummaryCard
                        title="Total Item Terjual"
                        value={data.ranking.summary.totalItems.toLocaleString("id-ID")}
                        icon={BarChart3}
                        bg="bg-emerald-50 dark:bg-emerald-950/30"
                    />
                    <SummaryCard
                        title="Total Revenue"
                        value={formatCurrency(data.ranking.summary.totalRevenue)}
                        icon={TrendingUp}
                        bg="bg-violet-50 dark:bg-violet-950/30"
                    />
                    <SummaryCard
                        title="Item Stagnan"
                        value={data.stagnant.items.length}
                        icon={AlertTriangle}
                        bg={data.stagnant.items.length > 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-gray-50 dark:bg-gray-950/30"}
                    />
                </div>
            )}

            {/* ─── Tabs ─────────────────────────────────── */}
            {data && (
                <Tabs defaultValue="ranking" className="space-y-4">
                    <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:inline-flex">
                        <TabsTrigger value="ranking" className="text-xs">
                            <Trophy className="h-3 w-3 mr-1 hidden sm:inline" />
                            Ranking
                        </TabsTrigger>
                        <TabsTrigger value="recap" className="text-xs">
                            <BarChart3 className="h-3 w-3 mr-1 hidden sm:inline" />
                            Rekap
                        </TabsTrigger>
                        <TabsTrigger value="trend" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1 hidden sm:inline" />
                            Tren
                        </TabsTrigger>
                        <TabsTrigger value="weekly" className="text-xs">
                            <ArrowUpDown className="h-3 w-3 mr-1 hidden sm:inline" />
                            Mingguan
                        </TabsTrigger>
                        <TabsTrigger value="stagnant" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1 hidden sm:inline" />
                            Stagnan
                        </TabsTrigger>
                    </TabsList>

                    {/* ─── Tab: Ranking ─────────────────────── */}
                    <TabsContent value="ranking">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <CardTitle className="text-base">
                                        {rankingSort === "best" ? "🏆 Produk Terlaris" : "📉 Produk Kurang Laris"}
                                    </CardTitle>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                            <Input
                                                placeholder="Cari produk..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                className="h-8 text-xs pl-7 w-40"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                                            <Button
                                                size="sm"
                                                variant={rankingSort === "best" ? "default" : "ghost"}
                                                className="text-xs h-7 px-2"
                                                onClick={() => setRankingSort("best")}
                                            >
                                                <TrendingUp className="h-3 w-3 mr-1" /> Terlaris
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={rankingSort === "worst" ? "default" : "ghost"}
                                                className="text-xs h-7 px-2"
                                                onClick={() => setRankingSort("worst")}
                                            >
                                                <TrendingDown className="h-3 w-3 mr-1" /> Kurang Laris
                                            </Button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm" variant="outline"
                                                className="text-xs h-7 px-2"
                                                onClick={() => handleExportRanking("excel")}
                                                disabled={!data || filteredRanking.length === 0}
                                            >
                                                <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                                            </Button>
                                            <Button
                                                size="sm" variant="outline"
                                                className="text-xs h-7 px-2"
                                                onClick={() => handleExportRanking("pdf")}
                                                disabled={!data || filteredRanking.length === 0}
                                            >
                                                <Download className="h-3 w-3 mr-1" /> PDF
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredRanking.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Tidak ada data penjualan untuk periode ini
                                    </p>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            {paginatedRanking.map((product, idx) => {
                                                const globalIdx = (rankingPageSize === ALL_ITEMS ? 0 : (rankingPage - 1) * rankingPageSize) + idx;
                                                return (
                                                    <div
                                                        key={product.productId}
                                                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                                    >
                                                        <span className={`text-sm font-bold w-8 text-center ${
                                                            rankingSort === "best" && globalIdx < 3 ? "text-amber-500" : "text-muted-foreground"
                                                        }`}>
                                                            {globalIdx + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{product.productName}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            rankingSort === "best"
                                                                                ? "bg-emerald-500"
                                                                                : "bg-red-400"
                                                                        }`}
                                                                        style={{ width: `${Math.max(product.contribution * 100, 2)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs text-muted-foreground w-10 text-right">
                                                                    {(product.contribution * 100).toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <Badge variant="secondary" className="text-xs">
                                                                {product.quantity} pcs
                                                            </Badge>
                                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                                {formatCurrency(product.revenue)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <PaginationControls
                                            page={rankingPage}
                                            pageSize={rankingPageSize}
                                            totalItems={filteredRanking.length}
                                            onPageChange={setRankingPage}
                                            onPageSizeChange={setRankingPageSize}
                                        />
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ─── Tab: Rekap Penjualan ─────────────── */}
                    <TabsContent value="recap">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base">📋 Rekap Penjualan</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Total penjualan per produk — {data?.rangeLabel ?? ""}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm" variant="outline"
                                            className="text-xs h-7 px-2"
                                            onClick={() => handleExportRecap("excel")}
                                            disabled={!data || recapData.length === 0}
                                        >
                                            <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                                        </Button>
                                        <Button
                                            size="sm" variant="outline"
                                            className="text-xs h-7 px-2"
                                            onClick={() => handleExportRecap("pdf")}
                                            disabled={!data || recapData.length === 0}
                                        >
                                            <Download className="h-3 w-3 mr-1" /> PDF
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {recapData.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Tidak ada data penjualan untuk periode ini
                                    </p>
                                ) : (
                                    <>
                                        {/* Summary row */}
                                        <div className="flex items-center gap-4 mb-3 px-3 py-2 bg-muted/50 rounded-lg text-xs">
                                            <span className="text-muted-foreground">
                                                {data!.ranking.summary.totalProducts} produk •{" "}
                                                {data!.ranking.summary.totalItems.toLocaleString("id-ID")} item terjual •{" "}
                                                <span className="font-semibold">{formatCurrency(data!.ranking.summary.totalRevenue)}</span>
                                            </span>
                                        </div>
                                        <div className="space-y-0">
                                            {/* Header */}
                                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 py-1.5 border-b">
                                                <div className="col-span-1">No</div>
                                                <div className="col-span-5">Produk</div>
                                                <div className="col-span-3 text-right">Total Qty</div>
                                                <div className="col-span-3 text-right">Total Revenue</div>
                                            </div>
                                            {paginatedRecap.map((product, idx) => {
                                                const globalIdx = (recapPageSize === ALL_ITEMS ? 0 : (recapPage - 1) * recapPageSize) + idx;
                                                return (
                                                    <div
                                                        key={product.productId}
                                                        className="grid grid-cols-12 gap-2 items-center text-sm px-3 py-2 rounded-lg hover:bg-muted/50"
                                                    >
                                                        <div className="col-span-1 text-muted-foreground text-xs">
                                                            {globalIdx + 1}
                                                        </div>
                                                        <div className="col-span-5 truncate font-medium">
                                                            {product.productName}
                                                        </div>
                                                        <div className="col-span-3 text-right tabular-nums">
                                                            <Badge variant="secondary" className="text-xs">
                                                                {product.quantity} pcs
                                                            </Badge>
                                                        </div>
                                                        <div className="col-span-3 text-right text-xs tabular-nums text-muted-foreground">
                                                            {formatCurrency(product.revenue)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <PaginationControls
                                            page={recapPage}
                                            pageSize={recapPageSize}
                                            totalItems={recapData.length}
                                            onPageChange={setRecapPage}
                                            onPageSizeChange={setRecapPageSize}
                                        />
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ─── Tab: Tren Harian ──────────────────── */}
                    <TabsContent value="trend">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Tren Penjualan Harian</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Pilih item untuk melihat tren — menampilkan maks 5 item sekaligus
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Item selector */}
                                <div className="flex flex-wrap gap-1.5">
                                    {data.dailyTrend.series.map((s, idx) => {
                                        const isSelected = selectedTrendItems.includes(s.productId);
                                        const color = CHART_COLORS[idx % CHART_COLORS.length];
                                        return (
                                            <Button
                                                key={s.productId}
                                                size="sm"
                                                variant={isSelected ? "default" : "outline"}
                                                className="text-xs h-7"
                                                style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
                                                onClick={() => {
                                                    setSelectedTrendItems(prev =>
                                                        isSelected
                                                            ? prev.filter(id => id !== s.productId)
                                                            : [...prev, s.productId].slice(-5)
                                                    );
                                                }}
                                            >
                                                <span
                                                    className="w-2 h-2 rounded-full mr-1.5 shrink-0"
                                                    style={{ backgroundColor: isSelected ? "#fff" : color }}
                                                />
                                                {s.productName}
                                            </Button>
                                        );
                                    })}
                                </div>

                                {/* Chart */}
                                {chartData.length > 0 && selectedTrendItems.length > 0 ? (
                                    <div className="h-[350px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                <XAxis
                                                    dataKey="date"
                                                    tick={{ fontSize: 11 }}
                                                    tickLine={false}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 11 }}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    width={40}
                                                />
                                                <Tooltip
                                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                                    formatter={(val: number) => [`${val} pcs`, ""]}
                                                />
                                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                                {data.dailyTrend.series
                                                    .filter(s => selectedTrendItems.includes(s.productId))
                                                    .map((s, idx) => (
                                                        <Line
                                                            key={s.productId}
                                                            type="monotone"
                                                            dataKey={s.productName}
                                                            stroke={CHART_COLORS[
                                                                data.dailyTrend.series.indexOf(s) % CHART_COLORS.length
                                                            ]}
                                                            strokeWidth={2}
                                                            dot={{ r: 3 }}
                                                            activeDot={{ r: 5 }}
                                                        />
                                                    ))}
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Pilih item di atas untuk melihat tren harian
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ─── Tab: Perbandingan Mingguan ────────── */}
                    <TabsContent value="weekly">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-base">Perbandingan Mingguan</CardTitle>
                                        <p className="text-xs text-muted-foreground">
                                            Minggu ini vs minggu lalu per produk
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            size="sm" variant="outline"
                                            className="text-xs h-7 px-2"
                                            onClick={() => handleExportWeekly("excel")}
                                            disabled={!data || data.weeklyComparison.items.length === 0}
                                        >
                                            <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                                        </Button>
                                        <Button
                                            size="sm" variant="outline"
                                            className="text-xs h-7 px-2"
                                            onClick={() => handleExportWeekly("pdf")}
                                            disabled={!data || data.weeklyComparison.items.length === 0}
                                        >
                                            <Download className="h-3 w-3 mr-1" /> PDF
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {data.weeklyComparison.items.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Tidak ada data perbandingan
                                    </p>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            {/* Header */}
                                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 py-1.5 border-b">
                                                <div className="col-span-4">Produk</div>
                                                <div className="col-span-2 text-right">Minggu Ini</div>
                                                <div className="col-span-2 text-right">Minggu Lalu</div>
                                                <div className="col-span-2 text-right">Revenue</div>
                                                <div className="col-span-2 text-right">Perubahan</div>
                                            </div>
                                            {paginatedWeekly.map(item => (
                                                <div
                                                    key={item.productId}
                                                    className="grid grid-cols-12 gap-2 items-center text-sm px-3 py-2 rounded-lg hover:bg-muted/50"
                                                >
                                                    <div className="col-span-4 truncate font-medium">
                                                        {item.productName}
                                                    </div>
                                                    <div className="col-span-2 text-right tabular-nums">
                                                        {item.thisWeekQty} pcs
                                                    </div>
                                                    <div className="col-span-2 text-right tabular-nums text-muted-foreground">
                                                        {item.lastWeekQty} pcs
                                                    </div>
                                                    <div className="col-span-2 text-right tabular-nums">
                                                        {formatCurrency(item.thisWeekRevenue)}
                                                    </div>
                                                    <div className="col-span-2 text-right">
                                                        <ChangeBadge change={item.qtyChange} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <PaginationControls
                                            page={weeklyPage}
                                            pageSize={weeklyPageSize}
                                            totalItems={data.weeklyComparison.items.length}
                                            onPageChange={setWeeklyPage}
                                            onPageSizeChange={setWeeklyPageSize}
                                        />
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ─── Tab: Item Stagnan ─────────────────── */}
                    <TabsContent value="stagnant">
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Item Tidak Laku (Stagnan)</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Produk tidak terjual ≥ {data.stagnant.threshold} hari terakhir
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={data.stagnant.items.length > 0 ? "destructive" : "secondary"}>
                                            {data.stagnant.items.length} item
                                        </Badge>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="sm" variant="outline"
                                                className="text-xs h-7 px-2"
                                                onClick={() => handleExportStagnant("excel")}
                                                disabled={!data || data.stagnant.items.length === 0}
                                            >
                                                <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                                            </Button>
                                            <Button
                                                size="sm" variant="outline"
                                                className="text-xs h-7 px-2"
                                                onClick={() => handleExportStagnant("pdf")}
                                                disabled={!data || data.stagnant.items.length === 0}
                                            >
                                                <Download className="h-3 w-3 mr-1" /> PDF
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {data.stagnant.items.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">
                                            Semua produk aktif pernah terjual dalam {data.stagnant.threshold} hari terakhir
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 py-1.5 border-b">
                                                <div className="col-span-4">Produk</div>
                                                <div className="col-span-2 text-right">Stok</div>
                                                <div className="col-span-3 text-right">Terakhir Terjual</div>
                                                <div className="col-span-3 text-right">Hari Tanpa Penjualan</div>
                                            </div>
                                            {paginatedStagnant.map(item => (
                                                <div
                                                    key={item.productId}
                                                    className="grid grid-cols-12 gap-2 items-center text-sm px-3 py-2 rounded-lg hover:bg-muted/50"
                                                >
                                                    <div className="col-span-4 truncate font-medium">
                                                        {item.productName}
                                                    </div>
                                                    <div className="col-span-2 text-right tabular-nums">
                                                        <Badge variant="outline">{item.stock}</Badge>
                                                    </div>
                                                    <div className="col-span-3 text-right text-muted-foreground text-xs">
                                                        {item.lastSoldAt
                                                            ? new Date(item.lastSoldAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                                            : "Belum pernah"}
                                                    </div>
                                                    <div className="col-span-3 text-right">
                                                        <Badge
                                                            variant={item.daysSinceSale >= 30 ? "destructive" : item.daysSinceSale >= 14 ? "secondary" : "outline"}
                                                            className="text-xs"
                                                        >
                                                            {item.daysSinceSale >= 999 ? "Belum pernah" : `${item.daysSinceSale} hari`}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <PaginationControls
                                            page={stagnantPage}
                                            pageSize={stagnantPageSize}
                                            totalItems={data.stagnant.items.length}
                                            onPageChange={setStagnantPage}
                                            onPageSizeChange={setStagnantPageSize}
                                        />
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

// ─── Sub-Components ───────────────────────────────────────

function PaginationControls({
    page, pageSize, totalItems, onPageChange, onPageSizeChange,
}: {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}) {
    if (totalItems === 0) return null;

    const totalPages = pageSize === ALL_ITEMS ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
    const start = pageSize === ALL_ITEMS ? 1 : (page - 1) * pageSize + 1;
    const end = pageSize === ALL_ITEMS ? totalItems : Math.min(page * pageSize, totalItems);

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
                Menampilkan {start}–{end} dari {totalItems} data
            </p>
            <div className="flex items-center gap-2 flex-wrap">
                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Tampilkan:</span>
                    <Select
                        value={pageSize === ALL_ITEMS ? "all" : String(pageSize)}
                        onValueChange={(v) => {
                            onPageSizeChange(v === "all" ? ALL_ITEMS : Number(v));
                            onPageChange(1);
                        }}
                    >
                        <SelectTrigger className="h-7 text-xs w-[80px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PAGE_SIZE_OPTIONS.map(s => (
                                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                            ))}
                            <SelectItem value="all">Semua</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="outline" size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(1)}
                        disabled={page <= 1}
                    >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline" size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs px-1.5 tabular-nums min-w-[60px] text-center">
                        {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline" size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline" size="icon"
                        className="h-7 w-7"
                        onClick={() => onPageChange(totalPages)}
                        disabled={page >= totalPages}
                    >
                        <ChevronsRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({
    title,
    value,
    icon: Icon,
    bg,
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    bg: string;
}) {
    return (
        <Card>
            <CardContent className={`py-4 ${bg} rounded-lg m-1`}>
                <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{title}</span>
                </div>
                <p className="text-lg font-bold tabular-nums">{value}</p>
            </CardContent>
        </Card>
    );
}

function ChangeBadge({ change }: { change: number | null }) {
    if (change === null) {
        return <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">BARU</Badge>;
    }
    const pct = (change * 100).toFixed(1);
    if (change > 0) {
        return (
            <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                <TrendingUp className="h-3 w-3" /> +{pct}%
            </span>
        );
    }
    if (change < 0) {
        return (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium">
                <TrendingDown className="h-3 w-3" /> {pct}%
            </span>
        );
    }
    return <span className="text-xs text-muted-foreground">0%</span>;
}

function formatDateShort(dateStr: string): string {
    try {
        const d = new Date(dateStr + "T00:00:00");
        return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    } catch {
        return dateStr;
    }
}
