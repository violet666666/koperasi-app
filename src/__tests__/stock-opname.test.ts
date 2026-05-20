import { describe, it, expect } from "vitest";
import {
    calculateOpname,
    validateOpnameItems,
    type OpnameItem,
} from "@/lib/stock-opname";

describe("Stock Opname — Utility Module", () => {
    describe("calculateOpname", () => {
        it("should identify items where physical matches system stock", () => {
            const items: OpnameItem[] = [
                {
                    productId: 1,
                    productName: "Espresso Beans 1kg",
                    productType: "ingredient",
                    unit: "gr",
                    systemStock: 500,
                    physicalStock: 500,
                },
                {
                    productId: 2,
                    productName: "Latte",
                    productType: "finished",
                    unit: "pcs",
                    systemStock: 10,
                    physicalStock: 10,
                },
            ];

            const result = calculateOpname(items);
            expect(result.matchedCount).toBe(2);
            expect(result.discrepancyCount).toBe(0);
            expect(result.adjustments).toHaveLength(0);
        });

        it("should calculate adjustments for stock shortage (out)", () => {
            const items: OpnameItem[] = [
                {
                    productId: 1,
                    productName: "Fresh Milk 1L",
                    productType: "ingredient",
                    unit: "ml",
                    systemStock: 5000,
                    physicalStock: 4200,
                },
            ];

            const result = calculateOpname(items);
            expect(result.discrepancyCount).toBe(1);
            expect(result.adjustments).toHaveLength(1);
            expect(result.adjustments[0].difference).toBe(800);
            expect(result.adjustments[0].type).toBe("out");
        });

        it("should calculate adjustments for stock surplus (in)", () => {
            const items: OpnameItem[] = [
                {
                    productId: 2,
                    productName: "Plastic Cup 16oz",
                    productType: "ingredient",
                    unit: "pcs",
                    systemStock: 200,
                    physicalStock: 250,
                },
            ];

            const result = calculateOpname(items);
            expect(result.adjustments[0].difference).toBe(50);
            expect(result.adjustments[0].type).toBe("in");
        });

        it("should handle mixed results across both product types", () => {
            const items: OpnameItem[] = [
                {
                    productId: 1,
                    productName: "Espresso Beans",
                    productType: "ingredient",
                    unit: "gr",
                    systemStock: 1000,
                    physicalStock: 800,
                },
                {
                    productId: 2,
                    productName: "Americano",
                    productType: "finished",
                    unit: "pcs",
                    systemStock: 5,
                    physicalStock: 5,
                },
                {
                    productId: 3,
                    productName: "Cup Lid",
                    productType: "ingredient",
                    unit: "pcs",
                    systemStock: 100,
                    physicalStock: 120,
                },
            ];

            const result = calculateOpname(items);
            expect(result.totalItems).toBe(3);
            expect(result.matchedCount).toBe(1);
            expect(result.discrepancyCount).toBe(2);
            expect(result.adjustments).toHaveLength(2);
        });

        it("should handle zero system stock with physical count found", () => {
            const items: OpnameItem[] = [
                {
                    productId: 5,
                    productName: "Sugar Syrup",
                    productType: "ingredient",
                    unit: "ml",
                    systemStock: 0,
                    physicalStock: 500,
                },
            ];

            const result = calculateOpname(items);
            expect(result.adjustments[0].difference).toBe(500);
            expect(result.adjustments[0].type).toBe("in");
        });
    });

    describe("validateOpnameItems", () => {
        it("should reject empty items array", () => {
            const result = validateOpnameItems([]);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain("Opname items cannot be empty");
        });

        it("should reject negative physical stock", () => {
            const result = validateOpnameItems([
                { productId: 1, physicalStock: -5 },
            ]);
            expect(result.valid).toBe(false);
        });

        it("should accept valid items", () => {
            const result = validateOpnameItems([
                { productId: 1, physicalStock: 100 },
                { productId: 2, physicalStock: 0 },
            ]);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});
