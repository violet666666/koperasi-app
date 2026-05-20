import { describe, it, expect } from "vitest";

// Phase 2.3: Modifiers / Add-on System
// RED phase — tests import from @/lib/modifiers which DOESN'T EXIST yet.

describe("Modifier Group Config", () => {
    it("should have default modifier group structure", async () => {
        const { getDefaultModifierGroup } = await import("@/lib/modifiers");
        const group = getDefaultModifierGroup();
        expect(group.id).toBeDefined();
        expect(group.name).toBeDefined();
        expect(group.isRequired).toBe(false);
        expect(group.multiSelect).toBe(false);
        expect(Array.isArray(group.options)).toBe(true);
    });

    it("should have default modifier option structure", async () => {
        const { getDefaultModifierOption } = await import("@/lib/modifiers");
        const option = getDefaultModifierOption();
        expect(option.id).toBeDefined();
        expect(option.name).toBeDefined();
        expect(option.priceAdjust).toBe(0);
        expect(option.isDefault).toBe(false);
    });
});

describe("Modifier Validation", () => {
    it("should accept valid modifier group", async () => {
        const { validateModifierGroup } = await import("@/lib/modifiers");
        const result = validateModifierGroup({
            id: "mg1",
            name: "Tingkat Pedas",
            isRequired: false,
            multiSelect: false,
            options: [
                { id: "o1", name: "Biasa", priceAdjust: 0, isDefault: true, sortOrder: 0 },
                { id: "o2", name: "Pedas", priceAdjust: 0, isDefault: false, sortOrder: 1 },
                { id: "o3", name: "Ekstra Pedas", priceAdjust: 2000, isDefault: false, sortOrder: 2 },
            ],
        });
        expect(result.valid).toBe(true);
    });

    it("should reject group without name", async () => {
        const { validateModifierGroup } = await import("@/lib/modifiers");
        const result = validateModifierGroup({
            id: "mg1",
            name: "",
            options: [{ id: "o1", name: "Test", priceAdjust: 0, isDefault: false, sortOrder: 0 }],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject group with no options", async () => {
        const { validateModifierGroup } = await import("@/lib/modifiers");
        const result = validateModifierGroup({
            id: "mg1",
            name: "Test Group",
            options: [],
        });
        expect(result.valid).toBe(false);
    });

    it("should reject duplicate option IDs", async () => {
        const { validateModifierGroup } = await import("@/lib/modifiers");
        const result = validateModifierGroup({
            id: "mg1",
            name: "Test",
            options: [
                { id: "o1", name: "A", priceAdjust: 0, isDefault: false, sortOrder: 0 },
                { id: "o1", name: "B", priceAdjust: 0, isDefault: false, sortOrder: 1 },
            ],
        });
        expect(result.valid).toBe(false);
    });
});

describe("Modifier Price Calculation", () => {
    it("should calculate total price adjustment from selected modifiers", async () => {
        const { calculateModifierPrice } = await import("@/lib/modifiers");
        const groups = [
            {
                id: "mg1", name: "Tingkat Pedas", isRequired: false, multiSelect: false,
                options: [
                    { id: "o1", name: "Pedas", priceAdjust: 0, isDefault: false, sortOrder: 0 },
                    { id: "o2", name: "Ekstra Pedas", priceAdjust: 2000, isDefault: false, sortOrder: 1 },
                ],
                selectedOptionIds: ["o2"],
            },
            {
                id: "mg2", name: "Tambah Protein", isRequired: false, multiSelect: true,
                options: [
                    { id: "o3", name: "Telur", priceAdjust: 3000, isDefault: false, sortOrder: 0 },
                    { id: "o4", name: "Ayam", priceAdjust: 5000, isDefault: false, sortOrder: 1 },
                ],
                selectedOptionIds: ["o3", "o4"],
            },
        ];
        const adjustment = calculateModifierPrice(groups);
        expect(adjustment).toBe(10000); // 2000 + 3000 + 5000
    });

    it("should return 0 when no modifiers selected", async () => {
        const { calculateModifierPrice } = await import("@/lib/modifiers");
        const groups = [
            {
                id: "mg1", name: "Test", isRequired: false, multiSelect: false,
                options: [{ id: "o1", name: "A", priceAdjust: 5000, isDefault: false, sortOrder: 0 }],
                selectedOptionIds: [],
            },
        ];
        expect(calculateModifierPrice(groups)).toBe(0);
    });
});

describe("Modifier Serialization", () => {
    it("should serialize and deserialize modifier config", async () => {
        const { serializeModifierConfig, deserializeModifierConfig, getDefaultModifierGroup } = await import("@/lib/modifiers");
        const config = { groups: [getDefaultModifierGroup()] };
        const json = serializeModifierConfig(config);
        expect(typeof json).toBe("string");
        const restored = deserializeModifierConfig(json);
        expect(restored.groups).toHaveLength(1);
    });

    it("should return empty config for invalid JSON", async () => {
        const { deserializeModifierConfig } = await import("@/lib/modifiers");
        const restored = deserializeModifierConfig("invalid json {{{");
        expect(restored.groups).toHaveLength(0);
    });
});
