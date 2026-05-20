import { describe, it, expect } from "vitest";

// Phase 2.1: Dynamic Floor Plan (Resto)
// RED phase — tests import from @/lib/floor-plan which DOESN'T EXIST yet.

describe("Floor Plan Config", () => {
    it("should have default floor plan config", async () => {
        const { getDefaultFloorPlan } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        expect(plan.tables).toBeDefined();
        expect(Array.isArray(plan.tables)).toBe(true);
        expect(plan.tables.length).toBeGreaterThan(0);
        // Default should have some tables for resto
        expect(plan.areas).toBeDefined();
        expect(Array.isArray(plan.areas)).toBe(true);
    });

    it("should have tables with required fields", async () => {
        const { getDefaultFloorPlan } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        const table = plan.tables[0];
        expect(table.id).toBeDefined();
        expect(table.label).toBeDefined();
        expect(typeof table.x).toBe("number");
        expect(typeof table.y).toBe("number");
        expect(typeof table.w).toBe("number");
        expect(typeof table.h).toBe("number");
        expect(typeof table.seats).toBe("number");
        expect(table.shape).toBeOneOf(["rect", "round"]);
    });

    it("should have areas with required fields", async () => {
        const { getDefaultFloorPlan } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        if (plan.areas.length > 0) {
            const area = plan.areas[0];
            expect(area.id).toBeDefined();
            expect(area.label).toBeDefined();
        }
    });
});

describe("Floor Plan Validation", () => {
    it("should accept valid floor plan", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const plan = {
            tables: [
                { id: "t1", label: "Meja 1", x: 0, y: 0, w: 2, h: 2, seats: 4, shape: "rect" as const },
            ],
            areas: [],
        };
        const result = validateFloorPlan(plan);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("should reject plan with no tables", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const result = validateFloorPlan({ tables: [], areas: [] });
        expect(result.valid).toBe(false);
    });

    it("should reject table with missing required fields", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const result = validateFloorPlan({
            tables: [{ id: "t1", label: "Meja 1" } as any],
            areas: [],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject table with invalid shape", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const result = validateFloorPlan({
            tables: [
                { id: "t1", label: "Meja 1", x: 0, y: 0, w: 2, h: 2, seats: 4, shape: "triangle" },
            ],
            areas: [],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject duplicate table IDs", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const result = validateFloorPlan({
            tables: [
                { id: "t1", label: "Meja 1", x: 0, y: 0, w: 2, h: 2, seats: 4, shape: "rect" },
                { id: "t1", label: "Meja 2", x: 3, y: 0, w: 2, h: 2, seats: 4, shape: "rect" },
            ],
            areas: [],
        });
        expect(result.valid).toBe(false);
    });

    it("should accept plan without areas", async () => {
        const { validateFloorPlan } = await import("@/lib/floor-plan");
        const result = validateFloorPlan({
            tables: [
                { id: "t1", label: "Meja 1", x: 0, y: 0, w: 2, h: 2, seats: 4, shape: "rect" },
            ],
        });
        expect(result.valid).toBe(true);
    });
});

describe("Floor Plan Merge", () => {
    it("should merge partial plan with defaults", async () => {
        const { mergeFloorPlan } = await import("@/lib/floor-plan");
        const partial = {
            tables: [
                { id: "custom1", label: "VIP 1", x: 5, y: 5, w: 3, h: 3, seats: 8, shape: "round" as const },
            ],
        };
        const merged = mergeFloorPlan(partial);
        expect(merged.tables).toHaveLength(1);
        expect(merged.tables[0].id).toBe("custom1");
        expect(merged.areas).toBeDefined();
    });
});

describe("Floor Plan Table Lookup", () => {
    it("should find table by ID", async () => {
        const { getDefaultFloorPlan, findTableById } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        const firstTable = plan.tables[0];
        const found = findTableById(plan, firstTable.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(firstTable.id);
    });

    it("should return undefined for non-existent ID", async () => {
        const { getDefaultFloorPlan, findTableById } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        const found = findTableById(plan, "nonexistent");
        expect(found).toBeUndefined();
    });
});

describe("Floor Plan Serialization", () => {
    it("should serialize to and from JSON string", async () => {
        const { getDefaultFloorPlan, serializeFloorPlan, deserializeFloorPlan } = await import("@/lib/floor-plan");
        const plan = getDefaultFloorPlan();
        const json = serializeFloorPlan(plan);
        expect(typeof json).toBe("string");
        const restored = deserializeFloorPlan(json);
        expect(restored.tables).toHaveLength(plan.tables.length);
        expect(restored.tables[0].id).toBe(plan.tables[0].id);
    });

    it("should return default plan for invalid JSON", async () => {
        const { deserializeFloorPlan } = await import("@/lib/floor-plan");
        const restored = deserializeFloorPlan("not valid json {{{");
        expect(restored.tables.length).toBeGreaterThan(0);
    });
});
