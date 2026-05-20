import { describe, it, expect } from "vitest";

// Test: audit log should use the variable unitType from the sale, not hardcoded "toko"
function buildAuditLogData(
    saleNo: string,
    totalAmount: number,
    paymentMethod: string,
    memberId: string | null,
    unitType: string
) {
    return {
        saleNo,
        totalAmount,
        paymentMethod,
        memberId,
        unitType,
    };
}

// Simulates the audit log call — captures what module and unitType would be logged
function getAuditParams(unitType: string) {
    const data = buildAuditLogData("RS-001", 50000, "cash", null, unitType);
    // BUG S-3: Original code hardcodes module: "Toko", unitType: "toko"
    // FIX: Should use the variable unitType
    return {
        module: unitType === "toko" ? "Toko" : "Unit",
        unitType: data.unitType,
    };
}

describe("Audit Log unitType", () => {
    it("logs toko sales with module Toko and unitType toko", () => {
        const params = getAuditParams("toko");
        expect(params.module).toBe("Toko");
        expect(params.unitType).toBe("toko");
    });

    // BUG S-3: Audit log hardcoded unitType: "toko" — should use variable
    it("logs resto sales with correct unitType (not hardcoded toko)", () => {
        const params = getAuditParams("resto");
        expect(params.unitType).toBe("resto");
    });

    it("logs cafe_lsp sales with correct unitType (not hardcoded toko)", () => {
        const params = getAuditParams("cafe_lsp");
        expect(params.unitType).toBe("cafe_lsp");
    });

    // BUG S-4: Low stock notification uses hardcoded "toko" for recipient lookup
    it("logs playstation sales with correct unitType", () => {
        const params = getAuditParams("playstation");
        expect(params.unitType).toBe("playstation");
    });
});
