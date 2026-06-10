# Haji & Umrah — Planning & Implementation Docs

> **Branch:** `railway-migration` | **Commit:** `303fb40` | **Status:** Ready for Execution
> **Design Spec:** `2026-06-10-haji-umrah-savings-only-design.md`

---

## Execution Order

| # | Document | Scope | Files |
|---|----------|-------|-------|
| 0 | `haji-umrah-planning.md` | Overview & business context | — |
| 0 | `2026-06-10-haji-umrah-savings-only-design.md` | Design spec (approved) | — |
| 1 | `2026-06-10-haji-umrah-1-data-layer.md` | Schema (8 fields) + migration + seed | 3 files |
| 2 | `2026-06-10-haji-umrah-2-api-layer.md` | 6 API endpoints | 6 files |
| 3 | `2026-06-10-haji-umrah-3-ui-layer.md` | 7 pages + layout | 8 files |
| 4 | `2026-06-10-haji-umrah-4-integration.md` | Constants + nav + billing + Zod | 7 files |

**Total: 25 tasks, 23 files**

---

## How to Resume

Jika session terputus karena window limit, buka folder ini dan baca plan sesuai urutan. Setiap plan independen — bisa mulai dari plan mana saja selama dependensi terpenuhi.

### Dependency Chain

```
Plan 1 (Data Layer)
  ↓
Plan 2 (API Layer) ← butuh schema fields dari Plan 1
  ↓
Plan 3 (UI Layer) ← butuh API endpoints dari Plan 2
  ↓
Plan 4 (Integration) ← butuh semua selesai
```

### Quick Check: Apa yang sudah selesai?

```bash
# Cek apakah schema fields sudah ada
npx prisma validate

# Cek apakah API routes sudah ada
ls src/app/api/haji-umrah/

# Cek apakah UI pages sudah ada
ls src/app/\(protected\)/haji-umrah/

# Cek apakah constants sudah diupdate
grep "haji_umrah" src/lib/constants/units.ts
grep "tabungan_haji" src/lib/constants/index.ts
```

---

## Files Created/Modified (per Plan)

### Plan 1 — Data Layer
- `prisma/schema.prisma` — +8 nullable fields
- `src/app/api/admin/migrate/route.ts` — +column migration
- `prisma/seed.ts` — +TH/TU products

### Plan 2 — API Layer
- `src/app/api/haji-umrah/products/route.ts` — GET/POST
- `src/app/api/haji-umrah/products/[productId]/route.ts` — PUT
- `src/app/api/haji-umrah/savings/route.ts` — GET/POST
- `src/app/api/haji-umrah/savings/[accountId]/route.ts` — GET
- `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` — GET/POST
- `src/app/api/haji-umrah/reports/route.ts` — GET

### Plan 3 — UI Layer
- `src/app/(protected)/haji-umrah/layout.tsx`
- `src/app/(protected)/haji-umrah/page.tsx` — dashboard
- `src/app/(protected)/haji-umrah/tabungan/page.tsx` — listing + buka rekening dialog
- `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` — detail + kwitansi
- `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` — setoran form
- `src/app/(protected)/haji-umrah/produk/page.tsx` — CRUD
- `src/app/(protected)/haji-umrah/laporan/page.tsx` — export

### Plan 4 — Integration
- `src/lib/constants/units.ts` — +haji_umrah
- `src/lib/constants/index.ts` — +product types
- `src/lib/constants/navigation.ts` — +sidebar group
- `src/lib/validations/index.ts` — extend enum
- `src/lib/validations/haji-umrah.ts` — new Zod schemas
- `src/app/(protected)/layout.tsx` — +route guard
- `src/app/api/billing/generate/route.ts` — +savings_account source
- `src/app/api/billing/[periodId]/process/route.ts` — +settlement handler
