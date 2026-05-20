/**
 * Unit type alias normalization for RBAC checks.
 * Users assigned "resto_cafe" or "coffe_latar" access data stored under "resto".
 */

const RESTO_ALIASES = new Set(["resto_cafe", "resto", "coffe_latar"]);

export function normalizeUnitType(unitType: string | null | undefined): string | null {
    if (!unitType) return null;
    if (RESTO_ALIASES.has(unitType)) return "resto";
    return unitType;
}

export function isSameUnit(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return true;
    return normalizeUnitType(a) === normalizeUnitType(b);
}
