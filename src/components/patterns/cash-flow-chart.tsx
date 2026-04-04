import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/constants";

export function CashFlowChart({ data = [] }: { data?: any[] }) {
    if (!data || data.length === 0) {
        return (
            <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow">
                <CardHeader>
                    <CardTitle>Arus Kas Koperasi</CardTitle>
                    <CardDescription>Tren penerimaan vs pengeluaran selama 7 bulan terakhir</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                        Sedang memuat atau tidak ada riwayat transaksi arus kas.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Arus Kas Koperasi</CardTitle>
                <CardDescription>
                    Tren penerimaan (in) vs pencairan/pengeluaran (out) selama 7 bulan terakhir (Realtime)
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={data}
                            margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorSimpanan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorPencairan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#6b7280', fontSize: 13 }}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: '#6b7280', fontSize: 13 }}
                                tickFormatter={(value) => `Rp ${value / 1000000}Jt`}
                                dx={-10}
                                width={80}
                            />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-white dark:bg-zinc-950 p-4 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-800 text-sm">
                                                <p className="font-bold mb-2">{label}</p>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between gap-6">
                                                        <span className="flex items-center text-emerald-600 font-medium">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                                            Simpanan
                                                        </span>
                                                        <span className="font-bold tabular-nums">
                                                            {formatCurrency(payload[0].value as number)}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between gap-6">
                                                        <span className="flex items-center text-red-600 font-medium">
                                                            <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                                                            Pencairan
                                                        </span>
                                                        <span className="font-bold tabular-nums">
                                                            {formatCurrency(payload[1].value as number)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="simpanan"
                                name="Simpanan Masuk"
                                stroke="#10b981"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSimpanan)"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="pencairan"
                                name="Pencairan Pinjaman"
                                stroke="#ef4444"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorPencairan)"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
