# Screen ↔ API Contract Audit

Date: 2026-07-18  
Scope: 28 current mobile screens × their called routes under `src/app/api/mobile/**` + observed web-route calls.  
Lesson anchor: Fase 6 T5 Critical — UI must read actual API contracts, not assumed fields.

## Clean (22 screens)

LaporanSHUScreen (envelope matches route field-for-field), KasirScreen, SavingsTransactionScreen, LoanPaymentScreen, RiwayatAngsuranScreen, NeracaScreen, KasBankScreen + KasBankTransaksiScreen + KasBankTransferScreen, AsetFormScreen, AsetDetailScreen, LoanEditScreen, PayrollImportScreen, HajiUmrahScreen, HajiUmrahDetailScreen, HajiUmrahSetoranScreen, HajiUmrahBukaRekeningScreen, HajiUmrahBagiHasilScreen, TagihanScreen, DashboardScreen, TransaksiScreen, PinjamanScreen.

## Verified defects (6 screens, 7 issues)

### 1. LaporanPiutangGabunganScreen — missing `/api` prefix (404) — High
`mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx:153,215,256`
- Calls `api.get('/mobile/reports/piutang-gabungan...')` (no `/api`), same pattern for detail and CSV exports.
- `BASE_URL` is bare domain without path prefix (`mobile/src/lib/api.ts:29,46`).
- Actual route lives at `/api/mobile/reports/piutang-gabungan`.
- Impact: all three queries silently 404.

### 2. ArusKasScreen — web-route auth mismatch (401) — High
`mobile/src/screens/operator/ArusKasScreen.tsx:48`
- Calls `/api/reports/arus-kas` (web route) with Bearer token.
- Web route `src/app/api/reports/arus-kas/route.ts:38-40` uses `auth()` cookie session, does not accept Bearer JWT.
- Impact: 401, screen shows no data.

### 3. FakturPotonganScreen — web-route auth mismatch (401) — High
`mobile/src/screens/operator/FakturPotonganScreen.tsx:56`
- Calls `/api/reports/faktur-potongan` (web route) with Bearer token.
- Same cookie-session gate at `src/app/api/reports/faktur-potongan/route.ts:33-36`.
- Impact: 401, screen shows no data.
- Envelope and fields match; only auth is the blocker.

### 4. HajiUmrahTalanganScreen — stats assignment from array (undefined → zero) — High
`mobile/src/screens/operator/HajiUmrahTalanganScreen.tsx:65`
- `setStats(statsRes.data.data || null)` from `/api/mobile/haji-umrah/talangan/gap`.
- Gap route returns `{ data: <account array>, summary: {...} }` — `data` is an array, not `TalanganStats`.
- `stats.totalActive`, `stats.totalOutstanding`, etc. are `undefined` → stats summary cards render zeros.
- The correct stats object IS returned by the main talangan list route at `res.data.stats:{...}` but is never read.

### 5. LoanApplicationsScreen — totalPages missing (infinite scroll stuck) — Medium
`mobile/src/screens/operator/LoanApplicationsScreen.tsx:95,111`
- `setTotalPages(pagination?.totalPages ?? 1)` reads `pagination.totalPages`.
- Load-more gate: `page < totalPages`.
- Server response `pagination: { page, perPage }` — no `total` or `totalPages`.
- Falls back to 1 → page 1 never exceeds 1 → `onLoadMore` never fires → infinite scroll stuck on first page.

### 6 & 7. MemberDetailScreen — web-route auth mismatch on two resource calls (401 → silent empty) — High
`mobile/src/screens/operator/MemberDetailScreen.tsx:59,72`
- `api.get(`/api/members/${memberId}/piutang-barang`)` and `/api/members/${memberId}/transactions` — both are web routes (not `/api/mobile/...`).
- Both gate via `auth()` cookie session.
- Screen swallows the errors (`log.error` + state reset), so "Piutang Barang" and "Riwayat Transaksi" sections silently render empty.
- Main `/api/mobile/members/${memberId}` call and the PATCH are correctly using mobile routes.

## Non-findings

- LaporanSHUScreen accesses `res.data.netIncome`, `res.data.unitGrossProfit`, etc. → verified match against the route's explicit JSON return.
- LoanEditScreen PUT body `{ principalAmount, interestRate, ... }` → `applyLoanEdit` contract; response `{ data: updatedLoan, changes }` verified.
- No KasirScreen field mismatches identified on current code.