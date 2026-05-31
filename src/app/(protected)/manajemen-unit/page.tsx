"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/patterns/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Package,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Store,
  Coffee,
  UtensilsCrossed,
  Car,
  Scissors,
  Dumbbell,
  Gamepad2,
  Printer,
  Shirt,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { UNIT_TYPES, type UnitConfig } from "@/lib/constants/units";

const ICON_MAP: Record<string, React.ElementType> = {
  Store, Coffee, UtensilsCrossed, Car, Scissors,
  Dumbbell, Gamepad2, Printer, Shirt,
};

interface AggregatedStats {
  totalUnits: number;
  totalProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  units: {
    unitType: string;
    label: string;
    category: string;
    slug: string;
    productCount: number;
    activeProductCount: number;
    todayTransactionCount: number;
    todayRevenue: number;
    yesterdayRevenue: number;
    revenueTrend: number | null;
    lowStockCount: number;
  }[];
}

export default function ManajemenUnitPage() {
  const [stats, setStats] = React.useState<AggregatedStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/manajemen-unit/stats");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        if (json.data) {
          setStats(json.data);
        } else {
          setError("Data tidak valid dari server.");
        }
      } catch (error) {
        console.error("Failed to fetch unit stats:", error);
        setError("Gagal memuat data unit. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const unitEntries = Object.entries(UNIT_TYPES) as [string, UnitConfig][];
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | "store" | "service">("all");

  const filteredUnits = unitEntries.filter(([, config]) => {
    if (categoryFilter === "all") return true;
    return config.category === categoryFilter;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manajemen Unit"
        description="Pemantauan dan administrasi seluruh unit usaha koperasi"
      />

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Unit"
          value={stats?.totalUnits ?? Object.keys(UNIT_TYPES).length}
          icon={Layers}
          color="blue"
        />
        <SummaryCard
          title="Total Produk"
          value={stats?.totalProducts ?? 0}
          icon={Package}
          color="emerald"
        />
        <SummaryCard
          title="Transaksi Hari Ini"
          value={stats?.totalTransactions ?? 0}
          icon={ShoppingBag}
          color="amber"
        />
        <SummaryCard
          title="Pendapatan Hari Ini"
          value={formatCurrency(stats?.totalRevenue ?? 0)}
          icon={TrendingUp}
          color="violet"
        />
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {([
          { value: "all" as const, label: "Semua" },
          { value: "store" as const, label: "Toko/POS" },
          { value: "service" as const, label: "Layanan" },
        ]).map((opt) => (
          <Button
            key={opt.value}
            variant={categoryFilter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setCategoryFilter(opt.value)}
            className="text-xs"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Unit grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUnits.map(([key, config]) => {
          const unitStat = stats?.units.find((u) => u.unitType === key);
          const Icon = ICON_MAP[config.icon] ?? Store;

          return (
            <Link key={key} href={`/manajemen-unit/${config.slug}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        config.category === "store"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{config.label}</h3>
                        <Badge variant="outline" className="text-[10px] mt-0.5">
                          {config.category === "store" ? "Toko/POS" : "Layanan"}
                        </Badge>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded animate-pulse w-3/4" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block text-foreground font-medium">
                          {unitStat?.productCount ?? 0}
                        </span>
                        Produk
                      </div>
                      <div>
                        <span className="block text-foreground font-medium">
                          {unitStat?.todayTransactionCount ?? 0}
                        </span>
                        Transaksi
                      </div>
                      <div className="col-span-2">
                        <div className="flex items-center gap-1">
                          <span className="text-foreground font-medium">
                            {formatCurrency(unitStat?.todayRevenue ?? 0)}
                          </span>
                          {unitStat?.revenueTrend !== null && unitStat?.revenueTrend !== undefined && (
                            <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
                              unitStat.revenueTrend >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {unitStat.revenueTrend >= 0
                                ? <TrendingUp className="h-3 w-3" />
                                : <TrendingDown className="h-3 w-3" />
                              }
                              {unitStat.revenueTrend >= 0 ? "+" : ""}{unitStat.revenueTrend}%
                            </span>
                          )}
                        </div>
                        Pendapatan hari ini
                      </div>
                    </div>
                  )}

                  {unitStat && unitStat.lowStockCount > 0 && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      {unitStat.lowStockCount} produk stok menipis
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color] ?? colorClasses.blue}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
