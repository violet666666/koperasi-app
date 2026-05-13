import { describe, it, expect } from "vitest";

// Phase 1.2: Kitchen Display System (KDS)
// Tests import from production modules that DON'T EXIST yet.
// This is the RED phase — these should FAIL because the modules aren't created.

describe("KitchenOrder Status Flow", () => {
    it("should only allow forward status transitions", async () => {
        const { isValidStatusTransition } = await import("@/lib/kds");
        expect(isValidStatusTransition("pending", "preparing")).toBe(true);
        expect(isValidStatusTransition("preparing", "ready")).toBe(true);
        expect(isValidStatusTransition("ready", "served")).toBe(true);
    });

    it("should reject backward or skip transitions", async () => {
        const { isValidStatusTransition } = await import("@/lib/kds");
        expect(isValidStatusTransition("preparing", "pending")).toBe(false);
        expect(isValidStatusTransition("pending", "ready")).toBe(false);
        expect(isValidStatusTransition("pending", "served")).toBe(false);
        expect(isValidStatusTransition("served", "ready")).toBe(false);
        expect(isValidStatusTransition("pending", "pending")).toBe(false);
    });
});

describe("KitchenOrder Display Formatting", () => {
    it("should format resto order label with table number", async () => {
        const { formatOrderLabel } = await import("@/lib/kds");
        expect(formatOrderLabel({ unitType: "resto", tableNumber: 5 })).toBe("Meja 5");
        expect(formatOrderLabel({ unitType: "resto", tableNumber: 12 })).toBe("Meja 12");
    });

    it("should format cafe_lsp order label with queue number", async () => {
        const { formatOrderLabel } = await import("@/lib/kds");
        expect(formatOrderLabel({ unitType: "cafe_lsp", queueNumber: "A042" })).toBe("A042");
        expect(formatOrderLabel({ unitType: "cafe_lsp", queueNumber: "A001" })).toBe("A001");
    });

    it("should format elapsed time from creation", async () => {
        const { formatElapsed } = await import("@/lib/kds");
        const now = new Date();
        expect(formatElapsed(new Date(now.getTime() - 30000), now)).toBe("Baru");
        expect(formatElapsed(new Date(now.getTime() - 5 * 60000), now)).toBe("5 menit");
        expect(formatElapsed(new Date(now.getTime() - 90 * 60000), now)).toBe("1 jam 30 menit");
    });
});

describe("KitchenOrder Validation", () => {
    it("should accept valid resto order with table number and items", async () => {
        const { validateKitchenOrder } = await import("@/lib/kds");
        const result = validateKitchenOrder({
            unitType: "resto",
            tableNumber: 5,
            items: [{ name: "Nasi Goreng", qty: 2 }],
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should accept valid cafe_lsp order without table number", async () => {
        const { validateKitchenOrder } = await import("@/lib/kds");
        const result = validateKitchenOrder({
            unitType: "cafe_lsp",
            queueNumber: "A042",
            items: [{ name: "Espresso", qty: 1 }],
        });
        expect(result.valid).toBe(true);
    });

    it("should reject order without items", async () => {
        const { validateKitchenOrder } = await import("@/lib/kds");
        const result = validateKitchenOrder({
            unitType: "resto",
            tableNumber: 5,
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("items must be a non-empty array");
    });

    it("should reject resto order without table number", async () => {
        const { validateKitchenOrder } = await import("@/lib/kds");
        const result = validateKitchenOrder({
            unitType: "resto",
            items: [{ name: "Nasi Goreng", qty: 1 }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain("tableNumber is required for resto orders");
    });
});
