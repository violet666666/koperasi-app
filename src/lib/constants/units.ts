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
  haji_umrah:  { label: "Haji & Umrah",     slug: "haji-umrah",   category: "service", icon: "Landmark" },
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

/**
 * Alias mapping for UnitTransaction.unitType.
 * DB stores various spellings but UNIT_TYPES uses the canonical form.
 * e.g. DB has "play_station" but UNIT_TYPES key is "playstation"
 */
export const UNIT_TYPE_ALIASES: Record<string, string[]> = {
  playstation: ["playstation", "play_station"],
  resto: ["resto", "resto_cafe", "coffe_latar"],
  cafe_lsp: ["cafe_lsp"],
};

/**
 * Alias mapping for StoreSale.unitType.
 * StoreSale stores the unit type used at sale creation time.
 */
export const STORE_SALE_ALIASES: Record<string, string[]> = {
  toko: ["toko"],
  resto: ["resto", "resto_cafe", "coffe_latar"],
  cafe_lsp: ["cafe_lsp"],
  playstation: ["playstation"],
};

/**
 * Returns a Prisma-compatible filter for UnitTransaction.unitType.
 * If the canonical type has aliases, returns `{ in: aliases }` to match all variants.
 * Otherwise returns the string directly for exact match.
 * Also normalizes alias types (e.g. "resto_cafe" → finds canonical "resto").
 */
export function unitTypeFilter(canonicalType: string): string | { in: string[] } {
  const aliases = UNIT_TYPE_ALIASES[canonicalType];
  if (aliases) return { in: aliases };
  // Input might be an alias — find which canonical type it belongs to
  for (const [key, vals] of Object.entries(UNIT_TYPE_ALIASES)) {
    if (vals.includes(canonicalType)) return { in: vals };
  }
  return canonicalType;
}

/**
 * Returns a Prisma-compatible filter for StoreSale.unitType.
 * Works the same as unitTypeFilter but uses STORE_SALE_ALIASES.
 * Also normalizes alias types (e.g. "resto_cafe" → finds canonical "resto").
 */
export function storeSaleUnitTypeFilter(canonicalType: string): string | { in: string[] } {
  const aliases = STORE_SALE_ALIASES[canonicalType];
  if (aliases) return { in: aliases };
  // Input might be an alias — find which canonical type it belongs to
  for (const [key, vals] of Object.entries(STORE_SALE_ALIASES)) {
    if (vals.includes(canonicalType)) return { in: vals };
  }
  return canonicalType;
}

/**
 * Map sebuah unitType StoreSale (mungkin alias) ke bentuk kanoniknya.
 * Alias (resto_cafe, coffe_latar → resto) di-roll-up. Null/undefined → "toko".
 * Unknown → dikembalikan apa adanya.
 * Dipakai untuk agregasi per-unit agar alias tidak terbelah menjadi row terpisah.
 */
export function canonicalStoreUnitType(ut: string | null | undefined): string {
  if (!ut) return "toko";
  for (const [canonical, aliases] of Object.entries(STORE_SALE_ALIASES)) {
    if ((aliases as string[]).includes(ut)) return canonical;
  }
  return ut;
}
