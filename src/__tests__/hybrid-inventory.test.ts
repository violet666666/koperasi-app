import { describe, it, expect } from "vitest";

// ── Hybrid Inventory Business Logic Tests ──
// Tests for the core deduction/estimation logic of the Hybrid Inventory System (Opsi 3)

// ── 1. Ingredient Stock Validation ──

function validateIngredientStock(params: {
    recipes: { ingredientProductId: number; quantity: number }[];
    ingredients: { id: number; name: string; stock: number; stockGdg: number }[];
    orderQty: number;
    productName: string;
}): { ok: boolean; error?: string } {
    const { recipes, ingredients, orderQty, productName } = params;

    for (const recipe of recipes) {
        const ing = ingredients.find((i) => i.id === recipe.ingredientProductId);
        if (!ing) continue;

        const needed = Math.ceil(recipe.quantity * orderQty);
        const available = ing.stock + ing.stockGdg;

        if (available < needed) {
            return {
                ok: false,
                error: `Bahan baku ${ing.name} tidak mencukupi untuk ${productName} (sisa: ${available}, dibutuhkan: ${needed})`,
            };
        }
    }
    return { ok: true };
}

describe("Hybrid Inventory - Ingredient Stock Validation", () => {
    it("passes when all ingredients have sufficient stock", () => {
        const result = validateIngredientStock({
            recipes: [
                { ingredientProductId: 1, quantity: 18 },
                { ingredientProductId: 2, quantity: 200 },
                { ingredientProductId: 3, quantity: 1 },
            ],
            ingredients: [
                { id: 1, name: "Biji Kopi", stock: 0, stockGdg: 5000 },
                { id: 2, name: "Air", stock: 0, stockGdg: 10000 },
                { id: 3, name: "Paper Cup", stock: 0, stockGdg: 500 },
            ],
            orderQty: 1,
            productName: "Americano",
        });
        expect(result.ok).toBe(true);
    });

    it("fails when one ingredient is insufficient", () => {
        const result = validateIngredientStock({
            recipes: [
                { ingredientProductId: 1, quantity: 18 },
                { ingredientProductId: 2, quantity: 200 },
            ],
            ingredients: [
                { id: 1, name: "Biji Kopi", stock: 0, stockGdg: 10 },
                { id: 2, name: "Air", stock: 0, stockGdg: 5000 },
            ],
            orderQty: 1,
            productName: "Americano",
        });
        expect(result.ok).toBe(false);
        expect(result.error).toContain("Biji Kopi");
        expect(result.error).toContain("10");
        expect(result.error).toContain("18");
    });

    it("fails when multi-quantity order exceeds stock", () => {
        const result = validateIngredientStock({
            recipes: [{ ingredientProductId: 1, quantity: 18 }],
            ingredients: [{ id: 1, name: "Biji Kopi", stock: 0, stockGdg: 35 }],
            orderQty: 2,
            productName: "Americano",
        });
        expect(result.ok).toBe(false); // 18*2=36, ceil=36, available=35 < 36
    });

    it("passes when multi-quantity order exactly matches stock", () => {
        const result = validateIngredientStock({
            recipes: [{ ingredientProductId: 1, quantity: 18 }],
            ingredients: [{ id: 1, name: "Biji Kopi", stock: 0, stockGdg: 36 }],
            orderQty: 2,
            productName: "Americano",
        });
        expect(result.ok).toBe(true); // 18*2=36, available=36, exact match
    });

    it("ceils fractional recipe quantities", () => {
        const result = validateIngredientStock({
            recipes: [{ ingredientProductId: 1, quantity: 0.5 }],
            ingredients: [{ id: 1, name: "Sugar Sachet", stock: 0, stockGdg: 1 }],
            orderQty: 1,
            productName: "Kopi Tubruk",
        });
        expect(result.ok).toBe(true); // ceil(0.5*1) = 1, available=1
    });
});

// ── 2. Ingredient Stock Deduction ──

function computeIngredientDeductions(params: {
    recipes: { ingredientProductId: number; quantity: number }[];
    ingredients: { id: number; stock: number; stockGdg: number }[];
    orderQty: number;
}): { ingredientId: number; deductQty: number; newStockGdg: number }[] {
    const deductions: { ingredientId: number; deductQty: number; newStockGdg: number }[] = [];

    for (const recipe of params.recipes) {
        const ing = params.ingredients.find((i) => i.id === recipe.ingredientProductId);
        if (!ing) continue;

        const needed = Math.ceil(recipe.quantity * params.orderQty);
        deductions.push({
            ingredientId: ing.id,
            deductQty: needed,
            newStockGdg: ing.stockGdg - needed,
        });
    }
    return deductions;
}

describe("Hybrid Inventory - Ingredient Stock Deduction", () => {
    it("computes correct deduction for single item", () => {
        const result = computeIngredientDeductions({
            recipes: [
                { ingredientProductId: 1, quantity: 18 },
                { ingredientProductId: 2, quantity: 200 },
            ],
            ingredients: [
                { id: 1, stock: 0, stockGdg: 5000 },
                { id: 2, stock: 0, stockGdg: 10000 },
            ],
            orderQty: 1,
        });
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ ingredientId: 1, deductQty: 18, newStockGdg: 4982 });
        expect(result[1]).toEqual({ ingredientId: 2, deductQty: 200, newStockGdg: 9800 });
    });

    it("computes correct deduction for multi-quantity order", () => {
        const result = computeIngredientDeductions({
            recipes: [{ ingredientProductId: 1, quantity: 18 }],
            ingredients: [{ id: 1, stock: 0, stockGdg: 1000 }],
            orderQty: 5,
        });
        expect(result[0].deductQty).toBe(90); // 18 * 5
        expect(result[0].newStockGdg).toBe(910);
    });

    it("handles fractional quantities with ceiling", () => {
        const result = computeIngredientDeductions({
            recipes: [{ ingredientProductId: 1, quantity: 7.5 }],
            ingredients: [{ id: 1, stock: 0, stockGdg: 100 }],
            orderQty: 3,
        });
        expect(result[0].deductQty).toBe(23); // ceil(7.5 * 3) = ceil(22.5) = 23
    });
});

// ── 3. Cup Estimation ──

function estimateRemainingCups(params: {
    productName: string;
    recipes: { ingredientProductId: number; quantity: number }[];
    ingredients: { id: number; stock: number; stockGdg: number; name: string }[];
}): { cups: number; limitingIngredient: string } {
    let minCups = Infinity;
    let limitingIngredient = "";

    for (const recipe of params.recipes) {
        const ing = params.ingredients.find((i) => i.id === recipe.ingredientProductId);
        if (!ing || recipe.quantity <= 0) continue;

        const available = ing.stock + ing.stockGdg;
        const cupsFromIngredient = Math.floor(available / recipe.quantity);

        if (cupsFromIngredient < minCups) {
            minCups = cupsFromIngredient;
            limitingIngredient = ing.name;
        }
    }

    return { cups: minCups === Infinity ? 0 : minCups, limitingIngredient };
}

describe("Hybrid Inventory - Cup Estimation", () => {
    it("estimates cups based on limiting ingredient", () => {
        const result = estimateRemainingCups({
            productName: "Americano",
            recipes: [
                { ingredientProductId: 1, quantity: 18 },
                { ingredientProductId: 2, quantity: 200 },
                { ingredientProductId: 3, quantity: 1 },
            ],
            ingredients: [
                { id: 1, name: "Biji Kopi", stock: 0, stockGdg: 1800 },
                { id: 2, name: "Air", stock: 0, stockGdg: 50000 },
                { id: 3, name: "Paper Cup", stock: 0, stockGdg: 200 },
            ],
        });
        expect(result.cups).toBe(100); // 1800/18=100, 50000/200=250, 200/1=200 → min=100
        expect(result.limitingIngredient).toBe("Biji Kopi");
    });

    it("returns 0 cups when no ingredients available", () => {
        const result = estimateRemainingCups({
            productName: "Latte",
            recipes: [{ ingredientProductId: 1, quantity: 18 }],
            ingredients: [{ id: 1, name: "Biji Kopi", stock: 0, stockGdg: 0 }],
        });
        expect(result.cups).toBe(0);
    });

    it("returns 0 cups when product has no linked recipes", () => {
        const result = estimateRemainingCups({
            productName: "Retail Item",
            recipes: [],
            ingredients: [],
        });
        expect(result.cups).toBe(0);
    });
});

// ── 4. trackStock Decision Logic ──

function shouldDeductIngredients(product: {
    trackStock: boolean;
    productType: string;
}): boolean {
    return product.productType === "finished" && product.trackStock === false;
}

describe("Hybrid Inventory - trackStock Decision", () => {
    it("deducts ingredients for finished product with trackStock=false", () => {
        expect(shouldDeductIngredients({ trackStock: false, productType: "finished" })).toBe(true);
    });

    it("deducts product stock for finished product with trackStock=true (retail)", () => {
        expect(shouldDeductIngredients({ trackStock: true, productType: "finished" })).toBe(false);
    });

    it("never deducts ingredients for ingredient-type products", () => {
        expect(shouldDeductIngredients({ trackStock: false, productType: "ingredient" })).toBe(false);
    });
});

// ── 5. Unit Conversion Helper ──

function convertToBaseUnit(quantity: number, unit: string): { quantity: number; baseUnit: string } {
    const conversions: Record<string, { factor: number; baseUnit: string }> = {
        kg: { factor: 1000, baseUnit: "gr" },
        ltr: { factor: 1000, baseUnit: "ml" },
        gr: { factor: 1, baseUnit: "gr" },
        ml: { factor: 1, baseUnit: "ml" },
        pcs: { factor: 1, baseUnit: "pcs" },
    };
    const conv = conversions[unit.toLowerCase()];
    if (!conv) return { quantity, baseUnit: unit };
    return { quantity: Math.round(quantity * conv.factor), baseUnit: conv.baseUnit };
}

describe("Hybrid Inventory - Unit Conversion", () => {
    it("converts kg to grams", () => {
        const result = convertToBaseUnit(5, "kg");
        expect(result.quantity).toBe(5000);
        expect(result.baseUnit).toBe("gr");
    });

    it("converts ltr to milliliters", () => {
        const result = convertToBaseUnit(2, "ltr");
        expect(result.quantity).toBe(2000);
        expect(result.baseUnit).toBe("ml");
    });

    it("keeps grams as-is", () => {
        const result = convertToBaseUnit(500, "gr");
        expect(result.quantity).toBe(500);
        expect(result.baseUnit).toBe("gr");
    });

    it("keeps pieces as-is", () => {
        const result = convertToBaseUnit(10, "pcs");
        expect(result.quantity).toBe(10);
        expect(result.baseUnit).toBe("pcs");
    });

    it("handles unknown units gracefully", () => {
        const result = convertToBaseUnit(5, "unknown");
        expect(result.quantity).toBe(5);
        expect(result.baseUnit).toBe("unknown");
    });
});
