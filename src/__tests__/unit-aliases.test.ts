import { describe, it, expect } from "vitest";
import { normalizeUnitType, isSameUnit, unitAliasGroup } from "@/lib/unit-aliases";

describe("normalizeUnitType", () => {
  it("collapses resto family to canonical 'resto'", () => {
    expect(normalizeUnitType("resto")).toBe("resto");
    expect(normalizeUnitType("resto_cafe")).toBe("resto");
    expect(normalizeUnitType("coffe_latar")).toBe("resto");
  });
  it("passes non-resto unitTypes through unchanged", () => {
    expect(normalizeUnitType("cafe_lsp")).toBe("cafe_lsp");
    expect(normalizeUnitType("toko")).toBe("toko");
    expect(normalizeUnitType("cuci_mobil")).toBe("cuci_mobil");
    expect(normalizeUnitType("simpan_pinjam")).toBe("simpan_pinjam");
  });
  it("returns null for empty input (fail-closed)", () => {
    expect(normalizeUnitType(null)).toBeNull();
    expect(normalizeUnitType(undefined)).toBeNull();
    expect(normalizeUnitType("")).toBeNull();
  });
});

describe("isSameUnit", () => {
  it("matches across the resto alias split (the approval bug)", () => {
    // StoreSales store slug "resto"; users carry "resto_cafe".
    expect(isSameUnit("resto", "resto_cafe")).toBe(true);
    expect(isSameUnit("resto_cafe", "resto")).toBe(true);
    expect(isSameUnit("coffe_latar", "resto")).toBe(true);
    expect(isSameUnit("coffe_latar", "resto_cafe")).toBe(true);
  });
  it("matches identical non-alias unitTypes", () => {
    expect(isSameUnit("cafe_lsp", "cafe_lsp")).toBe(true);
    expect(isSameUnit("toko", "toko")).toBe(true);
  });
  it("rejects different units", () => {
    expect(isSameUnit("resto", "cafe_lsp")).toBe(false);
    expect(isSameUnit("toko", "resto")).toBe(false);
    expect(isSameUnit("cafe_lsp", "resto_cafe")).toBe(false);
  });
  it("fail-closed when either side is null/undefined", () => {
    expect(isSameUnit("resto", null)).toBe(false);
    expect(isSameUnit(null, "resto")).toBe(false);
    expect(isSameUnit(undefined, undefined)).toBe(false);
  });
});

describe("unitAliasGroup", () => {
  it("returns all resto aliases for any resto-family member", () => {
    // Order-stable; used to build a Prisma OR filter.
    expect(unitAliasGroup("resto")).toEqual(["resto", "resto_cafe", "coffe_latar"]);
    expect(unitAliasGroup("resto_cafe")).toEqual(["resto", "resto_cafe", "coffe_latar"]);
    expect(unitAliasGroup("coffe_latar")).toEqual(["resto", "resto_cafe", "coffe_latar"]);
  });
  it("returns a single-element group for non-alias unitTypes", () => {
    expect(unitAliasGroup("cafe_lsp")).toEqual(["cafe_lsp"]);
    expect(unitAliasGroup("toko")).toEqual(["toko"]);
    expect(unitAliasGroup("cuci_mobil")).toEqual(["cuci_mobil"]);
    expect(unitAliasGroup("simpan_pinjam")).toEqual(["simpan_pinjam"]);
  });
  it("returns empty array for null/undefined (no SQL OR injected)", () => {
    expect(unitAliasGroup(null)).toEqual([]);
    expect(unitAliasGroup(undefined)).toEqual([]);
    expect(unitAliasGroup("")).toEqual([]);
  });
});
