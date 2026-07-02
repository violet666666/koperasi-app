import { STORE_SALE_ALIASES, UNIT_TYPE_ALIASES } from "@/lib/constants/units";

export interface MobileScope {
  role: string;
  branchId: number | null;
  unitType: string | null;
}

export interface ScopeDecision {
  allowed: boolean;
  reason?: string; // server-side logging only; routes return a generic 403
}

const OPERATOR = "operator";

// Union of StoreSale + UnitTransaction alias families from constants/units.ts
const UNIT_FAMILIES: string[][] = [
  ...Object.values(STORE_SALE_ALIASES),
  ...Object.values(UNIT_TYPE_ALIASES),
];

function sameUnitFamily(a: string, b: string): boolean {
  if (a === b) return true;
  for (const family of UNIT_FAMILIES) {
    if (family.includes(a) && family.includes(b)) return true;
  }
  return false;
}

/** Operator bypasses. Non-operator must match resource branch exactly.
 *  Null user branchId => deny (fail-closed). */
export function canAccessBranch(scope: MobileScope, resourceBranchId: number): ScopeDecision {
  if (scope.role === OPERATOR) return { allowed: true };
  if (scope.branchId == null) {
    return { allowed: false, reason: "User branchId tidak dikonfigurasi (fail-closed)." };
  }
  if (scope.branchId !== resourceBranchId) {
    return { allowed: false, reason: "Resource berada di branch berbeda." };
  }
  return { allowed: true };
}

/** Operator bypasses. Non-operator must match resource unit (alias-family aware).
 *  Null user unitType => deny (fail-closed). */
export function canAccessUnit(scope: MobileScope, resourceUnitType: string): ScopeDecision {
  if (scope.role === OPERATOR) return { allowed: true };
  if (scope.unitType == null) {
    return { allowed: false, reason: "User unitType tidak dikonfigurasi (fail-closed)." };
  }
  if (!sameUnitFamily(scope.unitType, resourceUnitType)) {
    return { allowed: false, reason: "Resource unit di luar scope user." };
  }
  return { allowed: true };
}
