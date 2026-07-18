# RBAC Matrix — Mobile API GET routes (read-only)

Date: 2026-07-18  
Tokens: 6 (operator, admin toko, admin resto_cafe, admin cafe_lsp, admin haji_umrah, anggota 86030500)  
Method: production `https://primkoppol.site`, Bearer JWT, GET only, no mutations.

## Matrix

| Route | operator | admintoko | admincafe | admincafelsp | adminhajiumrah | anggota |
|-------|----------|-----------|-----------|--------------|----------------|---------|
| savings-accounts | 200 | 200 | 200 | 200 | 200 | 403 |
| savings-tx | 400* | 400* | 400* | 400* | 400* | 403 |
| loans-operator | 200 | 200 | 200 | 200 | 200 | 403 |
| loan-payment GET | 200 | 200 | 200 | 200 | 200 | 403 |
| loan-payments | 404** | 404** | 404** | 404** | 404** | 403 |
| members | 200 | 200 | 200 | 200 | 200 | 403 |
| toko | 200 | 200 | 403 | 403 | 403 | 403 |
| unit-packages | 200 | 200 | 403 | 403 | 403 | 403 |
| unit-laporan toko | 200 | 200 | 403 | 403 | 403 | 403 |
| unit-laporan resto_cafe | 200 | 403 | 200 | 403 | 403 | 403 |
| unit-laporan cafe_lsp | 200 | 403 | 403 | 200 | 403 | 403 |
| neraca financial | 200 | 200 | 200 | 200 | 200 | 403 |
| shu-calculator | 200 | 200 | 200 | 200 | 200 | 403 |
| piutang-gabungan | 200 | 403 | 403 | 403 | 403 | 403 |
| kas-bank | 200 | 200 | 200 | 200 | 200 | 403 |
| buku-kas | 200 | 200 | 200 | 200 | 200 | 403 |
| journals | 200 | 200 | 200 | 200 | 200 | 403 |
| audit-logs | 200 | 200 | 200 | 200 | 200 | 403 |
| accounts (COA) | 200 | 200 | 200 | 200 | 200 | 403 |
| summary | 200 | 200 | 200 | 200 | 200 | 200 |

\* 400 = missing `memberId` param; gate works (403 for anggota)  
\*\* 404 = `loanId=1` not found; gate works (403 for anggota)

## Unit isolation — verified

- `toko` and `unit-packages`: admin toko → 200; admin resto_cafe, cafe_lsp, haji_umrah → 403.
- `unit-laporan/toko`: admin toko → 200; admin other units → 403.
- `unit-laporan/resto_cafe`: admin resto_cafe → 200; others → 403.
- `unit-laporan/cafe_lsp`: admin cafe_lsp → 200; others → 403.
- `piutang-gabungan`: operator-only → 200; all admin → 403 (org-wide by design).

## anggota — verified self-only

- `summary` returns 200 (self-scoped by `memberId` in JWT).
- All other routes → 403.

## admin_sp — not tested (no account exists in production)

Per spec: treat as negative-test deferred. 64 code references remain; removal is separate remediation.

## Confirmed gaps (A6 cross-reference)

- `/api/reports/arus-kas` (web route): mobile Bearer JWT → 401 (cookie-auth only) — confirmed wider pattern: ALL `/api/reports/*` web routes inaccessible from mobile Bearer tokens.
- `/api/reports/faktur-potongan` (web route): same pattern, 401.
- `/api/members/{id}/piutang-barang`, `/api/members/{id}/transactions`: same pattern, 401 — silent-empty on MemberDetailScreen.