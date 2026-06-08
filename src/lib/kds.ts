// Kitchen Display System (KDS) — shared utilities for Resto and Cafe LSP

const STATUS_ORDER = ["pending", "preparing", "ready", "served"] as const;
export type KitchenStatus = typeof STATUS_ORDER[number];

export type OrderType = "dine_in" | "takeaway" | "counter";

export function isValidStatusTransition(from: string, to: string): boolean {
    const fromIdx = STATUS_ORDER.indexOf(from as KitchenStatus);
    const toIdx = STATUS_ORDER.indexOf(to as KitchenStatus);
    if (fromIdx === -1 || toIdx === -1) return false;
    return toIdx === fromIdx + 1;
}

export function formatOrderLabel(order: {
    unitType: string;
    orderType?: string | null;
    tableNumber?: number | null;
    queueNumber?: string | null;
}): string {
    // Cafe LSP always uses queue numbers
    if (order.unitType === "cafe_lsp") {
        return order.queueNumber || "Counter";
    }

    // Resto units: differentiate dine-in vs takeaway
    if (order.orderType === "takeaway") {
        return order.queueNumber || "Takeaway";
    }

    // Dine-in (default for resto units)
    if (order.tableNumber) {
        return `Meja ${order.tableNumber}`;
    }

    // Fallback — should not normally happen
    return order.queueNumber || "Unknown";
}

/**
 * Get display color/badge class for order type
 */
export function getOrderTypeStyle(orderType?: string | null): {
    badge: string;
    label: string;
    border: string;
} {
    switch (orderType) {
        case "takeaway":
            return {
                badge: "bg-orange-100 text-orange-700 border-orange-200",
                label: "TAKEAWAY",
                border: "border-l-4 border-l-orange-400",
            };
        case "counter":
            return {
                badge: "bg-purple-100 text-purple-700 border-purple-200",
                label: "COUNTER",
                border: "border-l-4 border-l-purple-400",
            };
        case "dine_in":
        default:
            return {
                badge: "bg-sky-100 text-sky-700 border-sky-200",
                label: "DINE IN",
                border: "border-l-4 border-l-sky-400",
            };
    }
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
    orderType?: string | null;
    tableNumber?: number | null;
    queueNumber?: string | null;
    items?: { name: string; qty: number }[];
}): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.unitType) errors.push("unitType is required");
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        errors.push("items must be a non-empty array");
    }

    const orderType = data.orderType || "dine_in";

    // Only require tableNumber for dine-in orders on resto-type units
    const isRestoUnit = ["resto", "resto_cafe", "coffe_latar"].includes(data.unitType || "");
    if (isRestoUnit && orderType === "dine_in" && !data.tableNumber) {
        errors.push("tableNumber is required for dine-in orders");
    }

    return { valid: errors.length === 0, errors };
}
