import { describe, it, expect } from "vitest";

// Test: Duplicate shift check should be per unitType
// BUG S-5: findFirst({ where: { userId, status: "open" } }) without unitType
// This blocks multi-unit kasir from having simultaneous shifts in different units

interface ExistingShift {
    userId: string;
    unitType: string;
    status: string;
    shiftName: string;
}

function checkDuplicateShift(
    existingShifts: ExistingShift[],
    userId: string,
    requestedUnitType: string
): { blocked: boolean; existingShift?: ExistingShift } {
    // BUG S-5 FIX: Filter by unitType so multi-unit kasir can have shifts in different units
    const blocking = existingShifts.find(
        (s) => s.userId === userId && s.status === "open" && s.unitType === requestedUnitType
    );
    if (blocking) {
        return { blocked: true, existingShift: blocking };
    }
    return { blocked: false };
}

describe("Shift Duplicate Check", () => {
    const userId = "user-1";

    it("blocks if user already has open shift in same unitType", () => {
        const shifts: ExistingShift[] = [
            { userId, unitType: "toko", status: "open", shiftName: "Shift Pagi Toko" },
        ];
        const result = checkDuplicateShift(shifts, userId, "toko");
        expect(result.blocked).toBe(true);
        expect(result.existingShift?.shiftName).toBe("Shift Pagi Toko");
    });

    // BUG S-5: Without unitType filter, this would incorrectly block
    it("allows opening shift in different unitType even if other unit has open shift", () => {
        const shifts: ExistingShift[] = [
            { userId, unitType: "toko", status: "open", shiftName: "Shift Pagi Toko" },
        ];
        const result = checkDuplicateShift(shifts, userId, "resto");
        expect(result.blocked).toBe(false);
    });

    it("allows opening shift if previous shift is closed", () => {
        const shifts: ExistingShift[] = [
            { userId, unitType: "toko", status: "closed", shiftName: "Shift Pagi Toko" },
        ];
        const result = checkDuplicateShift(shifts, userId, "toko");
        expect(result.blocked).toBe(false);
    });

    it("blocks cafe_lsp shift if cafe_lsp shift already open", () => {
        const shifts: ExistingShift[] = [
            { userId, unitType: "cafe_lsp", status: "open", shiftName: "Counter Shift" },
            { userId, unitType: "toko", status: "open", shiftName: "Toko Shift" },
        ];
        const result = checkDuplicateShift(shifts, userId, "cafe_lsp");
        expect(result.blocked).toBe(true);
    });
});
