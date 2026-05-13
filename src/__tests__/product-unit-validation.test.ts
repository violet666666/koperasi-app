import { describe, it, expect } from "vitest";

// Test: Product lookup in checkout should validate unitType
// BUG S-1: findMany({ where: { id: { in: productIds } } }) doesn't filter unitType
// A kasir from resto could checkout products belonging to toko/cafe_lsp

interface MockProduct {
    id: number;
    name: string;
    unitType: string;
    isActive: boolean;
    deletedAt: Date | null;
}

function validateProductsMatchUnit(
    products: MockProduct[],
    requestedIds: number[],
    checkoutUnitType: string
): { valid: boolean; error?: string } {
    const requestedSet = new Set(requestedIds);
    const matched = products.filter((p) => requestedSet.has(p.id));

    // All requested IDs must be found
    if (matched.length !== requestedIds.length) {
        return { valid: false, error: "Produk tidak ditemukan" };
    }

    // All products must match checkout unitType
    const wrongUnit = matched.find((p) => p.unitType !== checkoutUnitType);
    if (wrongUnit) {
        return {
            valid: false,
            error: `Produk "${wrongUnit.name}" bukan milik unit ${checkoutUnitType}`,
        };
    }

    return { valid: true };
}

// BUG S-2: FIFO batch should filter by unitType
interface MockBatch {
    id: number;
    productId: number;
    unitType: string;
    quantity: number;
    isActive: boolean;
}

function filterBatchesForUnit(
    batches: MockBatch[],
    unitType: string
): MockBatch[] {
    // FIX S-2: Only return batches matching the unit type
    return batches.filter((b) => b.isActive && b.unitType === unitType);
}

describe("Product Unit Validation (S-1)", () => {
    const products: MockProduct[] = [
        { id: 1, name: "Nasi Goreng", unitType: "resto", isActive: true, deletedAt: null },
        { id: 2, name: "Kopi Susu", unitType: "cafe_lsp", isActive: true, deletedAt: null },
        { id: 3, name: "Sabun Mandi", unitType: "toko", isActive: true, deletedAt: null },
    ];

    it("allows checkout when all products match unitType", () => {
        const result = validateProductsMatchUnit(products, [1], "resto");
        expect(result.valid).toBe(true);
    });

    // BUG S-1: Without validation, resto could checkout cafe_lsp products
    it("rejects checkout when product belongs to different unit", () => {
        const result = validateProductsMatchUnit(products, [2], "resto");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Kopi Susu");
    });

    it("rejects checkout mixing products from different units", () => {
        const result = validateProductsMatchUnit(products, [1, 3], "resto");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Sabun Mandi");
    });

    it("allows cafe_lsp checkout of cafe_lsp products", () => {
        const result = validateProductsMatchUnit(products, [2], "cafe_lsp");
        expect(result.valid).toBe(true);
    });
});

describe("FIFO Batch Unit Filter (S-2)", () => {
    const batches: MockBatch[] = [
        { id: 1, productId: 100, unitType: "toko", quantity: 50, isActive: true },
        { id: 2, productId: 100, unitType: "resto", quantity: 20, isActive: true },
        { id: 3, productId: 100, unitType: "toko", quantity: 10, isActive: false },
        { id: 4, productId: 101, unitType: "cafe_lsp", quantity: 30, isActive: true },
    ];

    it("returns only batches matching unitType and active", () => {
        const result = filterBatchesForUnit(batches, "resto");
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(2);
    });

    it("returns all active toko batches", () => {
        const result = filterBatchesForUnit(batches, "toko");
        expect(result).toHaveLength(1); // batch 3 is inactive
        expect(result[0].id).toBe(1);
    });

    it("returns empty for unit with no batches", () => {
        const result = filterBatchesForUnit(batches, "playstation");
        expect(result).toHaveLength(0);
    });
});
