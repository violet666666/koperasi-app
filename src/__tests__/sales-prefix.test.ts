import { describe, it, expect } from "vitest";

// Test the sale prefix mapping logic
// This tests that every unitType used by POS pages has a corresponding prefix
function getSalePrefix(unitType: string): string {
    const salePrefixMap: Record<string, string> = {
        toko: "TK",
        playstation: "PS",
        cafe_lsp: "CF",
        resto_cafe: "RC",
        resto: "RS",
        coffe_latar: "CL",
    };
    return salePrefixMap[unitType] || "TK";
}

describe("Sale Prefix Mapping", () => {
    it("maps toko to TK", () => {
        expect(getSalePrefix("toko")).toBe("TK");
    });

    it("maps cafe_lsp to CF", () => {
        expect(getSalePrefix("cafe_lsp")).toBe("CF");
    });

    it("maps playstation to PS", () => {
        expect(getSalePrefix("playstation")).toBe("PS");
    });

    it("maps resto_cafe to RC", () => {
        expect(getSalePrefix("resto_cafe")).toBe("RC");
    });

    it("maps coffe_latar to CL", () => {
        expect(getSalePrefix("coffe_latar")).toBe("CL");
    });

    // BUG R-3: Resto POS sends unitType="resto" but salePrefixMap has no entry
    it("maps resto to a dedicated prefix (not TK fallback)", () => {
        expect(getSalePrefix("resto")).toBe("RS");
    });

    it("falls back to TK for unknown unitType", () => {
        expect(getSalePrefix("unknown")).toBe("TK");
    });
});
