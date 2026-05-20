// Kitchen Display System (KDS) — shared utilities for Resto and Cafe LSP

const STATUS_ORDER = ["pending", "preparing", "ready", "served"] as const;
export type KitchenStatus = typeof STATUS_ORDER[number];

export function isValidStatusTransition(from: string, to: string): boolean {
    const fromIdx = STATUS_ORDER.indexOf(from as KitchenStatus);
    const toIdx = STATUS_ORDER.indexOf(to as KitchenStatus);
    if (fromIdx === -1 || toIdx === -1) return false;
    return toIdx === fromIdx + 1;
}

export function formatOrderLabel(order: {
    unitType: string;
    tableNumber?: number | null;
    queueNumber?: string | null;
}): string {
    if (order.unitType === "resto" || order.unitType === "resto_cafe" || order.unitType === "coffe_latar") {
        return `Meja ${order.tableNumber}`;
    }
    return order.queueNumber || "Unknown";
}

export function formatElapsed(createdAt: Date, now: Date): string {
    const diffMs = now.getTime() - createdAt.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Baru";
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.floor(minutes / 60);
    const remainMinutes = minutes % 60;
    return `${hours} jam ${remainMinutes} menit`;
}

export function validateKitchenOrder(data: {
    unitType?: string;
    tableNumber?: number | null;
    queueNumber?: string | null;
    items?: { name: string; qty: number }[];
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.unitType) errors.push("unitType is required");
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push("items must be a non-empty array");
    }
    if (data.unitType === "resto" && !data.tableNumber) {
        errors.push("tableNumber is required for resto orders");
    }
    return { valid: errors.length === 0, errors };
}
