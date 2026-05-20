"use client";

import { useState, useEffect, useCallback } from "react";
import { createPendingSale, validatePendingSale, markAsSynced, markAsFailed } from "@/lib/offline-sync";
import type { PendingSale, PendingSaleInput } from "@/lib/offline-sync";

const STORAGE_KEY = "offline_pending_sales";

function loadPendingSales(): PendingSale[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function savePendingSales(sales: PendingSale[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sales));
}

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(true);
    const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);

    useEffect(() => {
        setIsOnline(navigator.onLine);
        setPendingSales(loadPendingSales());

        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, []);

    const queueSale = useCallback((input: PendingSaleInput): PendingSale | null => {
        const validation = validatePendingSale(input);
        if (!validation.valid) return null;

        const sale = createPendingSale(input);
        const updated = [...loadPendingSales(), sale];
        savePendingSales(updated);
        setPendingSales(updated);
        return sale;
    }, []);

    const syncPendingSales = useCallback(async (): Promise<{ synced: number; failed: number }> => {
        const sales = loadPendingSales().filter(s => s.status === "pending");
        let synced = 0;
        let failed = 0;

        for (const sale of sales) {
            try {
                const res = await fetch("/api/toko/sales", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        items: sale.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
                        unitType: sale.unitType,
                        paymentMethod: sale.paymentMethod,
                        customerName: sale.customerName || "Tamu",
                    }),
                });
                if (!res.ok) throw new Error("Sync failed");
                const json = await res.json();
                const updated = markAsSynced(sale, json.data?.saleNo || "unknown");
                const all = loadPendingSales().map(s => s.id === updated.id ? updated : s);
                savePendingSales(all);
                synced++;
            } catch {
                const updated = markAsFailed(sale, "Network error");
                const all = loadPendingSales().map(s => s.id === updated.id ? updated : s);
                savePendingSales(all);
                failed++;
            }
        }

        setPendingSales(loadPendingSales());
        return { synced, failed };
    }, []);

    const clearPendingSales = useCallback(() => {
        savePendingSales([]);
        setPendingSales([]);
    }, []);

    return {
        isOnline,
        pendingSales,
        pendingCount: pendingSales.filter(s => s.status === "pending").length,
        queueSale,
        syncPendingSales,
        clearPendingSales,
    };
}
