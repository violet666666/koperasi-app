// Split Bill — Multiple payment methods for a single order
// Used by both Resto and Cafe LSP POS.

export interface SplitItem {
    productId: number;
    name: string;
    price: number;
    quantity: number;
}

export interface SplitPayment {
    method: string; // "cash", "qris", "salary_cut"
    amount: number;
    memberId?: number;
}

export interface SplitBillRequest {
    items: SplitItem[];
    payments: SplitPayment[];
}

export function validateSplitBill(request: SplitBillRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.items || request.items.length === 0) {
        errors.push("items must be a non-empty array");
        return { valid: false, errors };
    }

    if (!request.payments || request.payments.length === 0) {
        errors.push("payments must be a non-empty array");
        return { valid: false, errors };
    }

    // Check for zero/negative amounts
    for (const payment of request.payments) {
        if (payment.amount <= 0) {
            errors.push("payment amounts must be positive");
            break;
        }
    }

    // Check total matches
    const total = calculateSplitTotal(request.items);
    const paymentsTotal = request.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paymentsTotal !== total) {
        errors.push(`payments total (${paymentsTotal}) must equal order total (${total})`);
    }

    return { valid: errors.length === 0, errors };
}

export function calculateSplitTotal(items: SplitItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function calculateRemaining(total: number, paidPayments: SplitPayment[]): number {
    const paid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, total - paid);
}

export function generateSplitGroupId(): string {
    return `SB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
