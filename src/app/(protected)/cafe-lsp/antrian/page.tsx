"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Coffee, Clock, CheckCircle2, Loader2, Maximize, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/patterns/page-header";

interface QueueOrder {
    id: number;
    saleNo: string;
    customerName: string;
    totalAmount: number;
    metadata: any;
    createdAt: string;
    status: "waiting" | "ready";
}

export default function CafeLspAntrianPage() {
    const [orders, setOrders] = React.useState<QueueOrder[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [readyIds, setReadyIds] = React.useState<Set<number>>(new Set());

    const fetchOrders = async () => {
        try {
            const today = new Date();
            const startOfDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
            const res = await fetch(`/api/toko/sales?unitType=cafe_lsp&perPage=50&from=${startOfDay}`);
            const json = await res.json();
            const sales = (json.data || []).map((s: any) => ({
                ...s,
                status: readyIds.has(s.id) ? "ready" as const : "waiting" as const,
            }));
            setOrders(sales);
        } catch {} finally { setIsLoading(false); }
    };

    React.useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    React.useEffect(() => {
        const stored = localStorage.getItem("cafe-lsp-ready-ids");
        if (stored) setReadyIds(new Set(JSON.parse(stored)));
    }, []);

    const markReady = (id: number) => {
        setReadyIds(prev => {
            const next = new Set(prev);
            next.add(id);
            localStorage.setItem("cafe-lsp-ready-ids", JSON.stringify([...next]));
            return next;
        });
    };

    const waitingOrders = orders.filter(o => !readyIds.has(o.id));
    const readyOrders = orders.filter(o => readyIds.has(o.id)).slice(0, 10);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Order Queue - Cafe LSP"
                description="Display pesanan aktif"
                actions={
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchOrders}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                        <Button variant="outline" size="sm" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200"
                            onClick={() => document.documentElement.requestFullscreen().catch(() => {})}>
                            <Maximize className="mr-2 h-4 w-4" /> Fullscreen
                        </Button>
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Waiting */}
                <Card className="border-amber-200">
                    <CardHeader className="bg-amber-50 border-b border-amber-200 py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600" /> Menunggu ({waitingOrders.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
                        ) : waitingOrders.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <Coffee className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Tidak ada pesanan menunggu</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {waitingOrders.map(order => (
                                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-2xl text-amber-600 w-16">
                                                {order.metadata?.queueNumber || "-"}
                                            </span>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-700">{order.customerName || "Tamu"}</p>
                                                <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
                                            </div>
                                        </div>
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => markReady(order.id)}>
                                            <CheckCircle2 className="h-4 w-4 mr-1" /> Selesai
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Ready */}
                <Card className="border-emerald-200">
                    <CardHeader className="bg-emerald-50 border-b border-emerald-200 py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Siap Diambil ({readyOrders.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {readyOrders.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <p className="text-sm">Belum ada pesanan siap</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {readyOrders.map(order => (
                                    <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                                        <span className="font-black text-2xl text-emerald-600 w-16">
                                            {order.metadata?.queueNumber || "-"}
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-700">{order.customerName || "Tamu"}</p>
                                            <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p>
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
