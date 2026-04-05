"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    ShoppingCart, Banknote, QrCode, CreditCard, Clock,
    TrendingUp, ArrowRight, CheckCircle2, AlertCircle, Store
} from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface UnitStats {
    unit: string;
    unitType: string;
    today: {
        total: number; count: number;
        cash: number; qris: number; salaryCut: number; pending: number;
    };
    weeklyChart: { date: string; total: number; count: number }[];
    recentTransactions: {
        id: number; no: string; amount: number; method: string;
        desc: string; date: string; isPaid: boolean; memberName: string | null;
    }[];
}

const METHOD_LABEL: Record<string, string> = {
    cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji", credit: "Kredit",
};
const METHOD_COLOR: Record<string, string> = {
    cash: "bg-emerald-100 text-emerald-700",
    qris: "bg-blue-100 text-blue-700",
    salary_cut: "bg-orange-100 text-orange-700",
    credit: "bg-orange-100 text-orange-700",
};

interface KasirDashboardProps {
    unitType: string;
    roleName: string; // "kasir" | "admin"
}

export function KasirDashboard({ unitType, roleName }: KasirDashboardProps) {
    const [stats, setStats] = React.useState<UnitStats | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!unitType) return;
        fetch(`/api/unit-layanan/stats?unitType=${unitType}`)
            .then(r => r.json())
            .then(json => { if (json.data) setStats(json.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [unitType]);

    const roleBadge = roleName === "admin" ? "Admin Unit" : "Kasir";
    const posLink = unitType === "toko" ? "/toko/kasir" : "/unit-layanan/kasir";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Store className="h-5 w-5 text-primary" />
                        <h1 className="text-2xl font-bold">
                            {loading ? "Memuat..." : stats?.unit ?? "Dashboard Unit"}
                        </h1>
                        <Badge variant="outline" className="text-xs">{roleBadge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan transaksi hari ini, {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                </div>
                <Button asChild size="lg" className="gap-2 shadow-md">
                    <Link href={posLink}>
                        <ShoppingCart className="h-5 w-5" />
                        Buka Kasir POS
                    </Link>
                </Button>
            </div>

            {/* Today's KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                    label="Total Hari Ini"
                    value={loading ? null : formatCurrency(stats?.today.total ?? 0)}
                    sub={`${stats?.today.count ?? 0} transaksi`}
                    bg="bg-emerald-50 border-emerald-200"
                />
                <StatCard
                    icon={<Banknote className="h-5 w-5 text-blue-600" />}
                    label="Tunai"
                    value={loading ? null : formatCurrency(stats?.today.cash ?? 0)}
                    bg="bg-blue-50 border-blue-200"
                />
                <StatCard
                    icon={<QrCode className="h-5 w-5 text-violet-600" />}
                    label="QRIS"
                    value={loading ? null : formatCurrency(stats?.today.qris ?? 0)}
                    bg="bg-violet-50 border-violet-200"
                />
                <StatCard
                    icon={<CreditCard className="h-5 w-5 text-orange-600" />}
                    label="Potong Gaji"
                    value={loading ? null : formatCurrency(stats?.today.salaryCut ?? 0)}
                    sub={stats?.today.pending ? `${stats.today.pending} pending` : undefined}
                    bg="bg-orange-50 border-orange-200"
                />
            </div>

            {/* Charts + Recent */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Weekly Bar Chart */}
                <Card className="md:col-span-3">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Transaksi 7 Hari Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <Skeleton className="h-[200px] w-full" />
                        ) : (
                            <div className="h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats?.weeklyChart ?? []} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }}
                                            tickFormatter={v => `${(v / 1000).toFixed(0)}K`} width={45} />
                                        <Tooltip
                                            formatter={(v: any) => [formatCurrency(Number(v)), "Total"]}
                                            contentStyle={{ borderRadius: 8, fontSize: 12 }}
                                        />
                                        <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Transactions */}
                <Card className="md:col-span-2">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Riwayat Terbaru</CardTitle>
                        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                            <Link href={unitType === "toko" ? "/toko" : "/transaksi-unit"}>Semua <ArrowRight className="h-3 w-3" /></Link>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                            </div>
                        ) : !stats?.recentTransactions?.length ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <Clock className="h-10 w-10 text-muted-foreground/40 mb-2" />
                                <p className="text-sm text-muted-foreground">Belum ada transaksi</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Mulai kasir untuk mencatat transaksi</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {stats.recentTransactions.slice(0, 6).map(t => (
                                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <div className="flex-shrink-0">
                                            {t.isPaid
                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                : <AlertCircle className="h-4 w-4 text-orange-500" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium truncate">{t.desc || t.no}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {t.memberName || "Walk-in"} · {new Date(t.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs font-bold">{formatCurrency(t.amount)}</p>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${METHOD_COLOR[t.method] ?? "bg-gray-100 text-gray-600"}`}>
                                                {METHOD_LABEL[t.method] ?? t.method}
                                            </span>
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

function StatCard({ icon, label, value, sub, bg }: {
    icon: React.ReactNode; label: string; value: string | null; sub?: string; bg?: string;
}) {
    return (
        <Card className={`border ${bg ?? ""}`}>
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    {icon}
                </div>
                {value === null
                    ? <Skeleton className="h-7 w-24" />
                    : <p className="text-xl font-bold tabular-nums">{value}</p>
                }
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
        </Card>
    );
}
