/**
 * Unit type alias normalization for RBAC checks.
 * Users assigned "resto_cafe" or "coffe_latar" access data stored under "resto".
 */

const RESTO_ALIASES = new Set(["resto_cafe", "resto", "coffe_latar"]);
// Concrete alias strings (for SQL-side OR filters where isSameUnit can't run).
const RESTO_ALIAS_VALUES = ["resto", "resto_cafe", "coffe_latar"];

export function normalizeUnitType(unitType: string | null | undefined): string | null {
    if (!unitType) return null;
    if (RESTO_ALIASES.has(unitType)) return "resto";
    return unitType;
}

export function isSameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false; // fail-closed: reject if either side is null/undefined
    return normalizeUnitType(a) === normalizeUnitType(b);
}

/**
 * All concrete unitType strings that alias to the same canonical unit as `unitType`.
 * Use this for SQL-side filters (Prisma JSON path `equals`) where isSameUnit can't
 * run. e.g. a resto_cafe admin's void count must OR across ["resto","resto_cafe","coffe_latar"]
 * because StoreSales store the "resto" slug while users carry "resto_cafe".
 */
export function unitAliasGroup(unitType: string | null | undefined): string[] {
    if (!unitType) return [];
    if (RESTO_ALIASES.has(unitType)) return RESTO_ALIAS_VALUES;
    return [unitType];
}
