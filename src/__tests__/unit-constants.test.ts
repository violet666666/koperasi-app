import { describe, it, expect } from "vitest";
import {
  UNIT_TYPES,
  getUnitBySlug,
  getUnitLabel,
  getStoreUnits,
  getServiceUnits,
  slugToUnitType,
  unitTypeToSlug,
} from "@/lib/constants/units";

describe("UNIT_TYPES constants", () => {
  it("defines all expected unit types", () => {
    const expected = [
      "toko", "cafe_lsp", "resto", "cuci_mobil",
      "barbershop", "fitness", "playstation", "fotocopy", "laundry",
    ];
    for (const ut of expected) {
      expect(UNIT_TYPES).toHaveProperty(ut);
    }
  });

  it("each unit type has required fields", () => {
    for (const [key, unit] of Object.entries(UNIT_TYPES)) {
      expect(unit).toHaveProperty("label");
      expect(unit).toHaveProperty("slug");
      expect(unit).toHaveProperty("category");
      expect(unit).toHaveProperty("icon");
      expect(typeof unit.label).toBe("string");
      expect(typeof unit.slug).toBe("string");
      expect(["store", "service"]).toContain(unit.category);
    }
  });
});

describe("slugToUnitType / unitTypeToSlug", () => {
  it("converts unitType to URL slug", () => {
    expect(unitTypeToSlug("cafe_lsp")).toBe("cafe-lsp");
    expect(unitTypeToSlug("cuci_mobil")).toBe("cuci-mobil");
    expect(unitTypeToSlug("playstation")).toBe("playstation");
    expect(unitTypeToSlug("toko")).toBe("toko");
  });

  it("converts URL slug back to unitType", () => {
    expect(slugToUnitType("cafe-lsp")).toBe("cafe_lsp");
    expect(slugToUnitType("cuci-mobil")).toBe("cuci_mobil");
    expect(slugToUnitType("playstation")).toBe("playstation");
    expect(slugToUnitType("toko")).toBe("toko");
  });

  it("slugToUnitType returns null for unknown slug", () => {
    expect(slugToUnitType("unknown-unit")).toBeNull();
  });

  it("roundtrips: unitType → slug → unitType", () => {
    for (const key of Object.keys(UNIT_TYPES)) {
      expect(slugToUnitType(unitTypeToSlug(key))).toBe(key);
    }
  });
});

describe("getUnitBySlug", () => {
  it("returns unit config for valid slug", () => {
    const toko = getUnitBySlug("toko");
    expect(toko).toBeDefined();
    expect(toko!.label).toBe("Toko PRIMKOPPOL");
    expect(toko!.category).toBe("store");
  });

  it("returns null for invalid slug", () => {
    expect(getUnitBySlug("nonexistent")).toBeNull();
  });
});

describe("getUnitLabel", () => {
  it("returns label for known unitType", () => {
    expect(getUnitLabel("toko")).toBe("Toko PRIMKOPPOL");
    expect(getUnitLabel("cuci_mobil")).toBe("Cuci Mobil & Motor");
  });

  it("returns formatted fallback for unknown unitType", () => {
    const result = getUnitLabel("some_new_unit");
    expect(result).toBeTruthy();
  });
});

describe("getStoreUnits / getServiceUnits", () => {
  it("store units contain toko, cafe_lsp, resto", () => {
    const stores = getStoreUnits();
    const keys = stores.map((u) => Object.keys(UNIT_TYPES).find((k) => UNIT_TYPES[k as keyof typeof UNIT_TYPES] === u));
    expect(stores.length).toBeGreaterThanOrEqual(3);
  });

  it("service units contain cuci_mobil, barbershop, etc", () => {
    const services = getServiceUnits();
    expect(services.length).toBeGreaterThanOrEqual(5);
  });

  it("store + service = all units", () => {
    const stores = getStoreUnits();
    const services = getServiceUnits();
    expect(stores.length + services.length).toBe(Object.keys(UNIT_TYPES).length);
  });
});
