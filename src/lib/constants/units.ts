export type UnitCategory = "store" | "service";

export interface UnitConfig {
  label: string;
  slug: string;
  category: UnitCategory;
  icon: string;
}

export const UNIT_TYPES: Record<string, UnitConfig> = {
  toko:        { label: "Toko PRIMKOPPOL",  slug: "toko",         category: "store",   icon: "Store" },
  cafe_lsp:    { label: "Cafe LSP",         slug: "cafe-lsp",     category: "store",   icon: "Coffee" },
  resto:       { label: "Resto & Cafe",     slug: "resto",        category: "store",   icon: "UtensilsCrossed" },
  cuci_mobil:  { label: "Cuci Mobil & Motor", slug: "cuci-mobil", category: "service", icon: "Car" },
  barbershop:  { label: "Barbershop",       slug: "barbershop",   category: "service", icon: "Scissors" },
  fitness:     { label: "Fitness",          slug: "fitness",      category: "service", icon: "Dumbbell" },
  playstation: { label: "Play Station",     slug: "playstation",  category: "service", icon: "Gamepad2" },
  fotocopy:    { label: "Fotocopy",         slug: "fotocopy",     category: "service", icon: "Printer" },
  laundry:     { label: "Laundry",          slug: "laundry",      category: "service", icon: "Shirt" },
};

export function unitTypeToSlug(unitType: string): string {
  return unitType.replace(/_/g, "-");
}

export function slugToUnitType(slug: string): string | null {
  const unitType = slug.replace(/-/g, "_");
  return unitType in UNIT_TYPES ? unitType : null;
}

export function getUnitBySlug(slug: string): UnitConfig | null {
  const unitType = slugToUnitType(slug);
  return unitType ? UNIT_TYPES[unitType] : null;
}

export function getUnitLabel(unitType: string): string {
  return UNIT_TYPES[unitType]?.label ?? unitType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStoreUnits(): UnitConfig[] {
  return Object.values(UNIT_TYPES).filter((u) => u.category === "store");
}

export function getServiceUnits(): UnitConfig[] {
  return Object.values(UNIT_TYPES).filter((u) => u.category === "service");
}

export const FB_UNITS = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"] as const;
export type FbUnitType = (typeof FB_UNITS)[number];

export function isFbUnit(unitType: string | null | undefined): boolean {
  return !!unitType && (FB_UNITS as readonly string[]).includes(unitType);
}
