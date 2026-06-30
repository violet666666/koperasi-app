import { describe, it, expect } from "vitest";
import { canonicalStoreUnitType } from "@/lib/constants/units";

describe("canonicalStoreUnitType", () => {
  it("mengembalikan canonical untuk alias resto", () => {
    expect(canonicalStoreUnitType("resto_cafe")).toBe("resto");
    expect(canonicalStoreUnitType("coffe_latar")).toBe("resto");
    expect(canonicalStoreUnitType("resto")).toBe("resto");
  });
  it("mengembalikan canonical untuk unit tanpa alias", () => {
    expect(canonicalStoreUnitType("toko")).toBe("toko");
    expect(canonicalStoreUnitType("cafe_lsp")).toBe("cafe_lsp");
  });
  it("null/undefined/empty → toko (default store)", () => {
    expect(canonicalStoreUnitType(null)).toBe("toko");
    expect(canonicalStoreUnitType(undefined)).toBe("toko");
    expect(canonicalStoreUnitType("")).toBe("toko");
  });
  it("unknown unit → dikembalikan apa adanya", () => {
    expect(canonicalStoreUnitType("cuci_mobil")).toBe("cuci_mobil");
    expect(canonicalStoreUnitType("fitness")).toBe("fitness");
  });
});
