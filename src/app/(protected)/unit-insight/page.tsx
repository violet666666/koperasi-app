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
    TrendingUp, TrendingDown, AlertTriangle, Package, BarChart3,
    ArrowUpDown, Calendar, RefreshCw, Trophy, ChevronDown,
    ChevronUp, ArrowRight, Search,
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCurrency } from "@/lib/constants";
import { unitTypeToSlug, getUnitLabel } from "@/lib/constants/units";

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
                    <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
                        <TabsTrigger value="ranking" className="text-xs">
                            <Trophy className="h-3 w-3 mr-1 hidden sm:inline" />
                            Ranking
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
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {filteredRanking.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Tidak ada data penjualan untuk periode ini
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredRanking.map((product, idx) => (
                                            <div
                                                key={product.productId}
                                                className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <span className={`text-sm font-bold w-8 text-center ${
                                                    rankingSort === "best" && idx < 3 ? "text-amber-500" : "text-muted-foreground"
                                                }`}>
                                                    {idx + 1}
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
                                        ))}
                                    </div>
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
                                <CardTitle className="text-base">Perbandingan Mingguan</CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Minggu ini vs minggu lalu per produk
                                </p>
                            </CardHeader>
                            <CardContent>
                                {data.weeklyComparison.items.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                        Tidak ada data perbandingan
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {/* Header */}
                                        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 py-1.5 border-b">
                                            <div className="col-span-4">Produk</div>
                                            <div className="col-span-2 text-right">Minggu Ini</div>
                                            <div className="col-span-2 text-right">Minggu Lalu</div>
                                            <div className="col-span-2 text-right">Revenue</div>
                                            <div className="col-span-2 text-right">Perubahan</div>
                                        </div>
                                        {data.weeklyComparison.items.map(item => (
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
                                    <Badge variant={data.stagnant.items.length > 0 ? "destructive" : "secondary"}>
                                        {data.stagnant.items.length} item
                                    </Badge>
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
                                    <div className="space-y-1">
                                        <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-3 py-1.5 border-b">
                                            <div className="col-span-4">Produk</div>
                                            <div className="col-span-2 text-right">Stok</div>
                                            <div className="col-span-3 text-right">Terakhir Terjual</div>
                                            <div className="col-span-3 text-right">Hari Tanpa Penjualan</div>
                                        </div>
                                        {data.stagnant.items.map(item => (
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
