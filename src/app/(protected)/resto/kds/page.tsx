"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { formatOrderLabel, formatElapsed, getOrderTypeStyle } from "@/lib/kds";

interface KitchenOrder {
    id: string;
    unitType: string;
    orderType: string | null;
    tableNumber: number | null;
    queueNumber: string | null;
    status: string;
    items: { name: string; qty: number; notes?: string }[];
    notes: string | null;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 border-yellow-400 text-yellow-800",
    preparing: "bg-blue-100 border-blue-400 text-blue-800",
    ready: "bg-green-100 border-green-400 text-green-800",
    served: "bg-gray-100 border-gray-400 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
    pending: "Menunggu",
    preparing: "Dimasak",
    ready: "Siap",
    served: "Disajikan",
};

const NEXT_ACTION: Record<string, { label: string; status: string; color: string }> = {
    pending: { label: "Mulai Masak", status: "preparing", color: "bg-blue-600 hover:bg-blue-700 text-white" },
    preparing: { label: "Selesai", status: "ready", color: "bg-green-600 hover:bg-green-700 text-white" },
    ready: { label: "Sajikan", status: "served", color: "bg-gray-600 hover:bg-gray-700 text-white" },
};

export default function KDSPage() {
    const { data: session } = useSession();
    const [orders, setOrders] = useState<KitchenOrder[]>([]);
    const [now, setNow] = useState(new Date());
    const unitType = (session?.user as any)?.unitType as string || "resto";

    const fetchOrders = useCallback(async () => {
        try {
            const res = await fetch(`/api/kitchen-orders?unitType=${unitType}&limit=100`);
            if (res.ok) {
                const json = await res.json();
                setOrders(json.data || []);
            }
        } catch {}
    }, [unitType]);

    useEffect(() => {
        fetchOrders();
        const interval = setInterval(fetchOrders, 5000);
        return () => clearInterval(interval);
    }, [fetchOrders]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const updateStatus = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/kitchen-orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                fetchOrders();
            }
        } catch {}
    };

    const activeOrders = orders.filter((o) => o.status !== "served");
    const servedOrders = orders.filter((o) => o.status === "served").slice(0, 10);

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="flex items-center justify-between mb-4 gap-2">
                <h1 className="text-xl sm:text-2xl font-bold">Kitchen Display</h1>
                <div className="flex items-center gap-2 sm:gap-3 text-sm text-gray-500">
                    <span className="font-mono text-xs sm:text-sm">{now.toLocaleTimeString("id-ID")}</span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs sm:text-sm">
                        {activeOrders.length} order aktif
                    </span>
                </div>
            </div>

            {activeOrders.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-gray-400">
                    <div className="text-center">
                        <div className="text-6xl mb-4">&#9749;</div>
                        <p className="text-xl">Tidak ada order aktif</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {activeOrders.map((order) => {
                        const typeStyle = getOrderTypeStyle(order.orderType);
                        return (
                            <div
                                key={order.id}
                                className={`border-2 rounded-xl p-3 sm:p-4 shadow-sm ${STATUS_COLORS[order.status]} ${typeStyle.border}`}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold">
                                            {formatOrderLabel(order)}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${typeStyle.badge}`}>
                                            {typeStyle.label}
                                        </span>
                                    </div>
                                    <span className="text-xs px-2 py-1 rounded-full bg-white/60">
                                        {STATUS_LABELS[order.status]}
                                    </span>
                                </div>

                                <div className="space-y-1 mb-3">
                                    {order.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm">
                                            <span className="font-mono font-bold text-base">
                                                {item.qty}x
                                            </span>
                                            <span>{item.name}</span>
                                            {item.notes && (
                                                <span className="text-xs opacity-75 italic">
                                                    ({item.notes})
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {order.notes && (
                                    <p className="text-xs italic opacity-75 mb-2">Catatan: {order.notes}</p>
                                )}

                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/10">
                                    <span className="text-xs opacity-75">
                                        {formatElapsed(new Date(order.createdAt), now)}
                                    </span>
                                    {NEXT_ACTION[order.status] && (
                                        <button
                                            onClick={() =>
                                                updateStatus(order.id, NEXT_ACTION[order.status].status)
                                            }
                                            className={`px-4 py-2 rounded-lg text-sm font-medium touch-target ${NEXT_ACTION[order.status].color}`}
                                        >
                                            {NEXT_ACTION[order.status].label}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {servedOrders.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-sm font-semibold text-gray-400 mb-2">
                        Baru Disajikan
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                        {servedOrders.map((order) => {
                            const typeStyle = getOrderTypeStyle(order.orderType);
                            return (
                                <span
                                    key={order.id}
                                    className={`px-3 py-1 rounded-full text-sm border ${typeStyle.badge}`}
                                >
                                    {formatOrderLabel(order)}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
