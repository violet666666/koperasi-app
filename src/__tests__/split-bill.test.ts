import { describe, it, expect } from "vitest";

// Phase 2.2: Split Bill — Both Units
// RED phase — tests import from @/lib/split-bill which DOESN'T EXIST yet.

describe("Split Bill Validation", () => {
    it("should accept valid split payment", async () => {
        const { validateSplitBill } = await import("@/lib/split-bill");
        const result = validateSplitBill({
            items: [
                { productId: 1, name: "Nasi Goreng", price: 25000, quantity: 2 },
                { productId: 2, name: "Es Teh", price: 5000, quantity: 2 },
            ],
            payments: [
                { method: "cash", amount: 40000 },
                { method: "qris", amount: 20000 },
            ],
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should reject when payments don't match total", async () => {
        const { validateSplitBill } = await import("@/lib/split-bill");
        const result = validateSplitBill({
            items: [
                { productId: 1, name: "Nasi Goreng", price: 25000, quantity: 1 },
            ],
            payments: [
                { method: "cash", amount: 20000 },
                { method: "qris", amount: 10000 },
            ],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject empty payments", async () => {
        const { validateSplitBill } = await import("@/lib/split-bill");
        const result = validateSplitBill({
            items: [{ productId: 1, name: "Test", price: 10000, quantity: 1 }],
            payments: [],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject zero or negative payment amounts", async () => {
        const { validateSplitBill } = await import("@/lib/split-bill");
        const result = validateSplitBill({
            items: [{ productId: 1, name: "Test", price: 10000, quantity: 1 }],
            payments: [
                { method: "cash", amount: 0 },
                { method: "qris", amount: 10000 },
            ],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject duplicate payment methods in same split", async () => {
        const { validateSplitBill } = await import("@/lib/split-bill");
        const result = validateSplitBill({
            items: [{ productId: 1, name: "Test", price: 20000, quantity: 1 }],
            payments: [
                { method: "cash", amount: 10000 },
                { method: "cash", amount: 10000 },
            ],
        });
        expect(result.valid).toBe(false);
    });
});

describe("Split Bill Calculation", () => {
    it("should calculate total from items", async () => {
        const { calculateSplitTotal } = await import("@/lib/split-bill");
        const items = [
            { productId: 1, name: "Nasi Goreng", price: 25000, quantity: 2 },
            { productId: 2, name: "Es Teh", price: 5000, quantity: 3 },
        ];
        expect(calculateSplitTotal(items)).toBe(65000);
    });

    it("should return 0 for empty items", async () => {
        const { calculateSplitTotal } = await import("@/lib/split-bill");
        expect(calculateSplitTotal([])).toBe(0);
    });

    it("should calculate remaining amount after partial payments", async () => {
        const { calculateRemaining } = await import("@/lib/split-bill");
        const total = 60000;
        const paidPayments = [{ method: "cash", amount: 20000 }];
        expect(calculateRemaining(total, paidPayments)).toBe(40000);
    });

    it("should return total when no payments made", async () => {
        const { calculateRemaining } = await import("@/lib/split-bill");
        expect(calculateRemaining(50000, [])).toBe(50000);
    });
});

describe("Split Bill Group ID", () => {
    it("should generate unique group IDs", async () => {
        const { generateSplitGroupId } = await import("@/lib/split-bill");
        const id1 = generateSplitGroupId();
        const id2 = generateSplitGroupId();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^split_/);
    });
});
