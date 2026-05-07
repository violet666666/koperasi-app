# SISA GAJI Import — Design Spec

**Date:** 2026-05-07
**Status:** Approved

## Problem

Member `salary` field currently holds gross salary (GAJI POKOK) from column 3 of the POT GAJI sheet. Credit limit calculations use `(salary + tunkin - angsuran) * 0.5` which overstates the real credit capacity because gross salary doesn't account for all deductions.

The actual take-home pay (SISA GAJI / JUMLAH GAJI DITERIMA) exists in column 36 (column AK) of the same POT GAJI sheet. This is the net amount after ALL deductions — including cooperative deductions, insurance, taxes, etc.

## Solution

### 1. Data Source

- **Column AK (col 36)** in POT GAJI sheet of POLRES/POLSEK Excel files
- Header: "JUMLAH GAJI DITERIMA" (2-row merged header: "JUMLAH GAJI" / "DITERIMA")
- Single column value — NOT split into two columns

### 2. Storage

Update `member.salary` with the net take-home pay value (SISA GAJI). This replaces the current gross salary value.

**Why member.salary:** Already used by existing credit limit calculations in 5 routes. No schema change needed. The field's meaning shifts from "gross salary" to "net take-home pay" which is more relevant for credit decisions.

### 3. Import Mechanism

Modify existing gaji import (`processGajiImport` in `src/app/api/members/import/route.ts`) instead of creating a new import type.

**Changes to `processGajiImport`:**
- Change header matching for salary column from `h.includes("gaji")` (which incorrectly matches col 3 GAJI POKOK) to `h.includes("gaji diterima") || h.includes("jumlah gaji")` to target column AK
- The import already handles the POT GAJI sheet format — just needs to read the correct column

### 4. Credit Limit Formula

Replace current formulas with simple: `salary * 0.5` (50% of net take-home pay)

**Routes to update (5 total):**

| Route | Current Formula | New Formula |
|-------|----------------|-------------|
| `api/loans/application/route.ts` | `(salary + tunkin - angsuran) * 0.5` | `salary * 0.5` |
| `api/loans/application/route.ts` (store) | `(salary + tunkin - angsuran) - 2,000,000` | `salary * 0.5` |
| `api/loans/credit-limit/route.ts` | `(salary + tunkin - angsuran) * 0.5` | `salary * 0.5` |
| `api/members/[id]/credit-limit/route.ts` | `(salary + tunkin - angsuran) * 0.5` | `salary * 0.5` |
| `api/loans/store-application/route.ts` | `(salary + tunkin - angsuran) * 0.5` | `salary * 0.5` |

**Rationale:** Since `salary` now holds net take-home pay (after all deductions including existing cooperative loans), the `tunkin` and `angsuran` adjustments are redundant. The 50% factor provides adequate safety margin.

### 5. Edge Cases

- **Missing column AK:** If header not found, skip salary update (don't zero it out). Log warning.
- **Zero/negative SISA GAJI:** Set `salary = 0`, which gives credit limit = 0 (correct — no capacity)
- **Empty cell ("-"):** Skip update for that member
- **Already imported members:** Update salary if new value differs (idempotent)

## Implementation Plan (Brief)

1. **Modify `processGajiImport`** — change header matching to target "JUMLAH GAJI DITERIMA" column (col AK)
2. **Update 5 credit limit routes** — replace formula with `salary * 0.5`
3. **Test** — import a POLRES/POLSEK file, verify member.salary values match column AK, verify credit limits are 50% of new salary

## Files to Modify

- `src/app/api/members/import/route.ts` — `processGajiImport` function
- `src/app/api/loans/application/route.ts` — credit limit formula (2 locations)
- `src/app/api/loans/credit-limit/route.ts` — credit limit formula
- `src/app/api/members/[id]/credit-limit/route.ts` — credit limit formula
- `src/app/api/loans/store-application/route.ts` — credit limit formula
