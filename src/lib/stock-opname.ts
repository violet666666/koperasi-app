export interface OpnameItem {
    productId: number;
    productName: string;
    productType: "finished" | "ingredient";
    unit: string;
    systemStock: number;
    physicalStock: number;
}

export interface OpnameAdjustment {
    productId: number;
    productName: string;
    difference: number;
    type: "in" | "out";
}

export interface OpnameResult {
    items: OpnameItem[];
    totalItems: number;
    matchedCount: number;
    discrepancyCount: number;
    adjustments: OpnameAdjustment[];
}

export function calculateOpname(items: OpnameItem[]): OpnameResult {
    const adjustments = items
        .filter((item) => item.physicalStock !== item.systemStock)
        .map((item) => ({
            productId: item.productId,
            productName: item.productName,
            difference: Math.abs(item.physicalStock - item.systemStock),
            type:
                item.physicalStock > item.systemStock
                    ? ("in" as const)
                    : ("out" as const),
        }));

    const matchedCount = items.filter(
        (item) => item.physicalStock === item.systemStock
    ).length;

    return {
        items,
        totalItems: items.length,
        matchedCount,
        discrepancyCount: adjustments.length,
        adjustments,
    };
}

export function validateOpnameItems(
    items: { productId: number; physicalStock: number }[]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!items || items.length === 0) {
        errors.push("Opname items cannot be empty");
    }
    for (const item of items) {
        if (!item.productId) errors.push("Product ID is required");
        if (item.physicalStock < 0)
            errors.push("Physical stock cannot be negative");
        if (!Number.isInteger(item.physicalStock))
            errors.push("Physical stock must be a whole number");
    }
    return { valid: errors.length === 0, errors };
}
