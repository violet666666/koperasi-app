"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/constants";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from "recharts";

interface ChartData {
    dailyFlow: { date: string; masuk: number; keluar: number }[];
    unitSales: { unit: string; unitType: string; total: number; count: number }[];
    loanStats: { status: string; outstanding: number; count: number }[];
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const UNIT_COLORS: Record<string, string> = {
    toko: "#22c55e",
    cuci_mobil: "#3b82f6",
    barbershop: "#f59e0b",
    playstation: "#8b5cf6",
    fitness: "#ec4899",
    resto_cafe: "#14b8a6",
};

function useChartData() {
    const [data, setData] = React.useState<ChartData | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch("/api/dashboard-charts?days=30")
            .then(r => r.json())
            .then(json => { if (json.data) setData(json.data); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
}

export function DashboardDailyKasChart() {
    const { data, loading } = useChartData();

    const flowData = data?.dailyFlow ?? [];
    const hasData = flowData.some(d => d.masuk > 0 || d.keluar > 0);

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Mutasi Kas Harian</CardTitle>
                <CardDescription>Kas masuk vs kas keluar 14 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                        Memuat data...
                    </div>
                ) : !hasData ? (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                        Belum ada data mutasi kas
                    </div>
                ) : (
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={flowData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6b7280", fontSize: 11 }}
                                    tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Jt`} width={55} />
                                <Tooltip
                                    formatter={(value: any, name: any) => [
                                        formatCurrency(Number(value)),
                                        name === "masuk" ? "Kas Masuk" : "Kas Keluar"
                                    ]}
                                    contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                                />
                                <Bar dataKey="masuk" name="masuk" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={30} />
                                <Bar dataKey="keluar" name="keluar" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
                <div className="flex gap-4 mt-2 justify-center">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />Kas Masuk
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />Kas Keluar
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

export function DashboardUnitChart() {
    const { data, loading } = useChartData();

    const unitData = data?.unitSales ?? [];
    const hasData = unitData.some(d => d.total > 0);
    const totalSales = unitData.reduce((s, u) => s + u.total, 0);

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Pendapatan per Unit Usaha</CardTitle>
                <CardDescription>30 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                        Memuat data...
                    </div>
                ) : !hasData ? (
                    <div className="space-y-3">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            Belum ada transaksi penjualan
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                            Data akan muncul setelah kasir mencatat penjualan di unit-unit usaha
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={unitData}
                                        dataKey="total"
                                        nameKey="unit"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        innerRadius={50}
                                        paddingAngle={3}
                                    >
                                        {unitData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={UNIT_COLORS[entry.unitType] || COLORS[index % COLORS.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, name: any) => [formatCurrency(Number(value)), String(name)]}
                                        contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                            {unitData.map((u, index) => (
                                <div key={u.unitType} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="inline-block w-3 h-3 rounded-full"
                                            style={{ backgroundColor: UNIT_COLORS[u.unitType] || COLORS[index % COLORS.length] }}
                                        />
                                        <span className="text-muted-foreground">{u.unit}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-medium">{formatCurrency(u.total)}</span>
                                        <span className="text-xs text-muted-foreground ml-2">
                                            {totalSales > 0 ? Math.round((u.total / totalSales) * 100) : 0}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
