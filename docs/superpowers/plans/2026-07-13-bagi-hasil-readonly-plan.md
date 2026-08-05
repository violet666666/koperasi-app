# Fase 9a.3 — Bagi Hasil READ-ONLY Implementation Plan
> Read-only mobile mirror. No process/void. Branch: railway-migration.

## Tasks

### T1: Mobile bagi-hasil GET endpoints
- GET `/mobile/haji-umrah/bagi-hasil` + GET `/mobile/haji-umrah/bagi-hasil/[id]`
- Auth: getMobileUser + gate operator/admin_sp

### T2: HajiUmrahBagiHasilScreen
- Distribution list + detail screen. Status filter chips. No write ops.
