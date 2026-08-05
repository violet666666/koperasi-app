# Fase 9b — Tagihan READ-ONLY Implementation Plan
> Read-only mobile mirror of billing periods. No generate/refresh/settle/delete. Branch: railway-migration.

## Tasks

### T1: Mobile billing endpoints
- Create: GET `/mobile/billing/current`, GET `/mobile/billing/riwayat`, GET `/mobile/billing/[periodId]`
- Auth: getMobileUser + gate operator/admin_sp
- Response shapes per spec
- tsc + commit

### T2: TagihanScreen
- Mobile screen + Dashboard menu + App.tsx wiring + api client
- Period selector + stat cards + FlatList. Amber badge if draft period. Log error on load only.
- No write operations.

### T3: FakturPotonganScreen + ArusKasScreen (bundled, both READ-ONLY)
- faktur endpoint GET `/mobile/faktur-potongan`
- arus kas endpoint GET `/mobile/reports/arus-kas`
- Two new screens with minimal scope: month picker + FlatList of items

## Risks
Low — read-only.
