// Offline Sync — Queue pending sales when offline, sync when back online
// Used by POS pages (Resto, Cafe LSP, Toko) for resilient offline operation.

export interface PendingSaleItem {
    productId: number;
    quantity: number;
    unitPrice: number;
}

export interface PendingSaleInput {
    items: PendingSaleItem[];
    unitType: string;
    paymentMethod: string;
    totalAmount: number;
    customerName?: string;
    tableNo?: string;
}

export interface PendingSale extends PendingSaleInput {
    id: string;
    status: "pending" | "synced" | "failed";
    createdAt: Date;
    remoteSaleNo?: string;
    error?: string;
}

let pendingCounter = 0;

export function createPendingSale(input: PendingSaleInput): PendingSale {
    pendingCounter++;
    return {
        ...input,
        id: `pending_${Date.now()}_${pendingCounter}`,
        status: "pending",
        createdAt: new Date(),
    };
}

export function validatePendingSale(sale: PendingSaleInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sale.items || sale.items.length === 0) {
        errors.push("items must be a non-empty array");
    }

    if (!sale.unitType || sale.unitType.trim().length === 0) {
        errors.push("unitType is required");
    }

    if (!sale.paymentMethod) {
        errors.push("paymentMethod is required");
    }

    return { valid: errors.length === 0, errors };
}

export function markAsSynced(sale: PendingSale, remoteSaleNo: string): PendingSale {
    return {
        ...sale,
        status: "synced",
        remoteSaleNo,
    };
}

export function markAsFailed(sale: PendingSale, error: string): PendingSale {
    return {
        ...sale,
        status: "failed",
        error,
    };
}
