import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/constants";

const data = [
    { month: "Jan", simpanan: 150000000, pencairan: 80000000 },
    { month: "Feb", simpanan: 210000000, pencairan: 120000000 },
    { month: "Mar", simpanan: 180000000, pencairan: 160000000 },
    { month: "Apr", simpanan: 240000000, pencairan: 140000000 },
    { month: "Mei", simpanan: 290000000, pencairan: 210000000 },
    { month: "Jun", simpanan: 320000000, pencairan: 250000000 },
    { month: "Jul", simpanan: 280000000, pencairan: 190000000 },
];

export function CashFlowChart() {
    return (
        <Card className="col-span-1 lg:col-span-3 hover:shadow-md transition-shadow">
            <CardHeader>
                <CardTitle>Arus Kas Koperasi</CardTitle>
                <CardDescription>
                    Tren penerimaan simpanan vs pencairan pinjaman selama 7 bulan terakhir
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
