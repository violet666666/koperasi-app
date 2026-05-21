# Design: Sync Sisa Gaji + Plafon Piutang Strict

**Date:** 2026-05-21
**Status:** Approved
**Scope:** 3 changes — auto-sync, formula strict, UX label

---

## Context

`Member.sisaGaji` is never auto-populated from Payroll Import (it only updates `PayrollSlip.sisaGaji`). The plafon formula uses `salary` instead of `sisaGaji`. Operator needs accurate sisa gaji to determine loan limits.

**Formula from XLS:** SISA GAJI = JML GAJI − JML POT NON KRETAP − JML POT KRETAP

---

## Changes

### 1. Create shared utility: `src/lib/plafon.ts`

```typescript
export function getPlafonPiutang(member: { plafonPiutang: number; sisaGaji: number | null }): number {
  if (member.plafonPiutang > 0) return member.plafonPiutang;
  if (!member.sisaGaji || member.sisaGaji <= 0) return 0;
  return Math.floor(member.sisaGaji * 0.5);
}
```

### 2. Replace formula in 5 API files

Replace `Math.floor(Number(member.salary) * 0.5)` with `getPlafonPiutang(member)`:

| File | Line |
|---|---|
| `src/app/api/unit-transactions/validate/route.ts` | ~83 |
| `src/app/api/unit-layanan/sales/route.ts` | ~119 |
| `src/app/api/mobile/unit-layanan/route.ts` | ~104 |
| `src/app/api/toko/sales/route.ts` | ~154 |
| `src/app/api/mobile/toko/route.ts` | ~104 |

### 3. Auto-sync sisaGaji in Payroll Import

**File:** `src/app/api/payroll/import/route.ts`

After creating PayrollSlips, add bulk update:

```typescript
await prisma.member.updateMany({
  where: { id: { in: memberIds } },
  data: { sisaGaji: calculatedSlipSisaGaji },
});
```

Per-member update since each has different sisaGaji.

### 4. UX label on edit page

**File:** `src/app/(protected)/anggota/[id]/edit/page.tsx`

Add description under sisaGaji field:
"Rumus: Gaji Bersih − Total Potongan. Plafon piutang = 50% × Sisa Gaji"

---

## Files

| Action | File |
|---|---|
| Create | `src/lib/plafon.ts` |
| Modify | 5 API route files (replace formula) |
| Modify | `src/app/api/payroll/import/route.ts` (add sync) |
| Modify | `src/app/(protected)/anggota/[id]/edit/page.tsx` (add label) |
