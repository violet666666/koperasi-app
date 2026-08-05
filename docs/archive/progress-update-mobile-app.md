# Progress Update Mobile App — Drift Fix Effort

> **Dokumen recovery.** Update 2026-07-18. Jika context habis/sesi compact, baca dokumen ini **+** `.remember/remember.md` **+** `.superpowers/sdd/progress.md` **+** memori `mobile-drift-audit-fase1-2026-07.md` **+** `git log --oneline -30`.

- **Branch:** `railway-migration` — **auto-deploy ke prod (primkoppol.site) tiap push.**
- **Mobile app:** Expo 55 / RN 0.83. API deploy = Railway (push). Mobile UI deploy = `eas build` (terpisah).

---

## Status keseluruhan (per 2026-07-18)

- [x] **Fase 1** — SHU Laba Kotor + Neraca ledger. ✅ DONE + **deployed** 2026-07-01 (`82d5fd2..4541674`).
- [x] **Fase 2** — Money-integrity (2a loan-payment allocation + 2b savings-tx atomic/AD-ART). ✅ DONE + **deployed** (`c4cec9a..58d07a8`).
- [x] **Fase 3 (Void Angsuran)** — API void + list-payments + RiwayatAngsuranScreen UI. ✅ DONE + **deployed** (`e9a9ce9..c4217aa`).
- [x] **Fase 4 (mechanical)** — Hardening (Math.random→crypto CRITICAL-resolved + stale roles + cafe_lsp + void filter + drop admin_unit). ✅ DONE + **deployed** (`2dd06ac..5c73344`).
- [x] **EAS Build #1** — ✅ **FINISHED** (commit `5ed2d5b`, v1.1.2/vc3). APK: `https://expo.dev/artifacts/eas/eThiL10I6G1Iw9403oyx0lo59a2pAFEwgwHAeu2gaDE.apk`. ⏭ Smoke test device + Play Store `.aab` submit pending.
- [x] **Fase 4b** — RBAC unit/branch scoping (writes). ✅ DONE + **deployed** (`4cf135e..c9d1972`).
- [x] **Fase 4c** — RBAC GET-scope (reads). ✅ DONE + **deployed** (`bab3a4a..b7caf5f8`, pushed `c9d1972..b7caf5f8`). `branchListFilter`/`unitListFilter` helpers + scope on ~18 GET routes. Final opus review APPROVED; diagnostic clean.
- [x] **Fase 5 — Play Store polish** — ✅ DONE + **deployed** (`f591a304` logger sweep 52 console.*→log, `958084db` de-stub+gate, `4c6102e7` final-review fix; pushed `b7caf5f8..c4ce3f3c`). Final opus review APPROVED; tests 427/3 pre-existing (no regression). **EAS build #2 ✅ FINISHED** — v1.1.3/vc4, APK `https://expo.dev/artifacts/eas/a_0JW2Rb41_VNfgW5C-Wl6X6d5FbS-yaDtDPC1_3v5Y.apk` (build ID `59630aae-b6a6-4248-9f23-b6a3c4e1bcb3`, queue ~93min free-tier + build ~11min).
- [x] **Fase 6 — Piutang Gabungan mobile** — ✅ DONE + **API deployed** (6 SDD tasks `da79d824`..`bf21554c`; pushed `c4ce3f3c..bf21554c`). Pure helper `aggregatePiutangGabungan`+`buildPiutangCSV` (+12 tests), list API `?format=csv`/`?export=true`, drill-down `[memberId]` API, screen, nav. Final opus review APPROVED; 1 Critical (screen field-contract mismatch) fixed in `f41df4e8`. Tests 439/3 pre-existing. Operator/admin_sp gate (no scope — org-wide consolidated). **EAS build #3 ✅ FINISHED** — v1.1.4/vc5, APK `https://expo.dev/artifacts/eas/PNFETl78t7uW8PtEcvY8D4YAuma3sEfSLzWkN-RnOYw.apk`.
- [x] **Fase 7a — Kas/Bank create+transfer mobile** — ✅ DONE + **API deployed** (5 SDD tasks `d605d101`..`4ba3e924`; pushed `6f0affe7..4ba3e924`). Crypto txn-no helper (+tests), POST `/kas-bank/transactions` + `/transfers`, 2 form screens, nav. Final opus review APPROVED; **Critical RBAC fixed** `f9d2b7ed` (T2 `!canAccessBranch(...)` inert → `.allowed`). Tests 444/3 pre-existing.
- [x] **Fase 7b — Generic per-unit laporan mobile** — ✅ DONE + **API + web-refactor deployed** (`559d004f`..`e5acbd01`; pushed `8b2ec6ca..e5acbd01`). Shared `getUnitLaporanData` helper (web+mobile DRY); web refactor behavior-preserving; `LaporanUnitScreen` (full V1 read-only). Tests 450/3.
- [x] **Fase 8a — Aset CRUD mobile** — ✅ DONE + **API deployed** (`0ffed9be`..`29269d65`; pushed `e5acbd01..29269d65`). Reused existing POST + new PUT edit + POST dispose + DELETE soft; `AsetFormScreen` + AsetList FAB + AsetDetail actions. Tests 450/3.
- [x] **Fase 8b — Loan edit mobile** — ✅ DONE + **API + web-refactor deployed** (5 SDD tasks `9e9a947d`..`59146d42`; pushed `29269d65..59146d42`). **DRY extraction** (highest money-integrity fase): `recalcLoanFinancials` (pure, +9 tests) + `applyLoanEdit` (the $transaction schedule-regen) shared by web + mobile. Web PUT refactored **behavior-preserving (money path byte-identical, opus-verified)**; mobile `GET`+`PUT /loans/[id]` (operator/admin_sp + canAccessBranch). `LoanEditScreen` (7-field form, change-detection, no live preview) + DaftarPinjaman Edit entry. Tests 459/3. **Screen ships via EAS build #5.**
- [x] **Fase 8c — Payroll import mobile** — ✅ **DONE + PUSHED + FINAL OPUS REVIEW APPROVED**. DRY extraction: `parsePayrollExcel` + `commitPayrollPeriod` + `PayrollImportError` shared helpers (`src/lib/services/payroll-import.ts`); web route refactored to call them (behavior-preserving, opus-verified byte-identical); mobile POST `/payroll/import` + `/delete` (operator-only); `PayrollImportScreen` (3-step pick→preview→commit, 5-min timeout, multipart) + GajiPeriode Import/Delete buttons; nav wired. Commits `eeb4235c..4787fd30` (T1-T5) + `931a04b1` (version bump). Final opus whole-branch review APPROVED (10/10 sections clean; screen↔route field contract verified — Fase 6 lesson held). 2 Minor deferred (race→500 parity; screen trusts nav gate). Pushed `c832d581..4787fd30`.
- [x] **Fase 9a.2 — Talangan Haji/Umrah VIEW** — ✅ DONE + deployed (`92d8e3e2`, `0f89e09b`, `1a5ec45a`, `b431d2eb`). List/stats, gap calculator, detail+schedules, screen+nav. QA 2026-07-18 fixed stats card reading wrong response envelope.
- [x] **Fase 9a.3 — Bagi Hasil Haji/Umrah VIEW** — ✅ DONE + deployed (`84138f8d`, `8abc0fd3`, `c31699a8`). List, detail, expandable distribution UI.
- [x] **Fase 9b — Tagihan/Billing VIEW** — ✅ DONE + deployed (`fa35d009`, `8ee65a1b`). Current period card + riwayat; mutation workflow remains out of scope.
- [x] **Fase 12b — Loan Applications VIEW** — ✅ DONE + deployed (`207c9e51`). QA 2026-07-18 added server `totalItems/totalPages`; infinite-scroll page 2+ now reachable.
- [x] **Fase 13b — Faktur Potongan VIEW** — ✅ DONE + deployed (`0baa777e`). QA 2026-07-18 found screen called cookie-auth web route with mobile JWT (401 + force logout); dedicated mobile JWT route added.
- [x] **Fase 18a — Arus Kas VIEW** — ✅ DONE + deployed (`e3c293a5`). QA 2026-07-18 found same cookie-auth mismatch; dedicated mobile JWT route added.
- [x] **Fase 14 residual — member/loan detail branch scope** — ✅ DONE + deployed (`6aedb654`).
- [x] **Mobile QA Phase A+B (2026-07-18)** — ✅ audit + safe remediation complete. Static audit 70 mobile route files / 32 mutation handlers / 28 screens; production read-only RBAC matrix 20 routes × 6 accounts. Found 12 items (0 Critical, 9 High). Fixed 8 High + 1 Medium in `74a73ae0`: Aset refresh crash, Piutang Gabungan 404, Arus Kas/Faktur/Member Detail 401 force-logout routes, Talangan stats zero, Loan Apps pagination, and audit trail on 4 money routes. Verification: remediation tests 10/10, mobile tsc clean, Next build success, full suite 469 pass / 3 documented pre-existing; independent review APPROVED. Remaining High: systemic idempotency (needs schema-backed request key; separate design).

**Push/build status (2026-07-18):** QA remediation deployed through `7c654993`; API fixes live/read-only verified (Arus Kas 200, Faktur Potongan 200, Loan Apps pagination 200, Member Piutang+Transactions 200). Mobile v1.1.8/vc10 built from `a4802c47`. Dual EAS builds **FINISHED**: APK (`apk-debug`) ID `7570143e-6be8-405a-bb2d-784caaa2413b`, artifact `https://expo.dev/artifacts/eas/nNJ4x1zkxLvZ2FbeY7j8xyR03xFHWi-WyFOLuvzSbYI.apk`; AAB (`store`) ID `2ad906b0-41a4-40b1-ba28-ad24268b7f69`, artifact `https://expo.dev/artifacts/eas/GbMHTJd8Andadg4OqblW4BfMwLC1nOYfmVVyXEaG1ic.aab`. Phase C device checklist committed `7bc95f61`; Phase D conditional report `c9ab1b57`. Next: install APK upgrade → read-only physical-device smoke → update `device-findings.md` + `exit-criteria.md`; AAB upload to closed testing requires explicit outward-facing approval.

---

## ✅ RAILWAY PRODUCTION FIX (2026-07-05) — 7-LAYER, ALL RESOLVED

Railway service `melodious-generosity` / `koperasi-app` was **DELETED** (late bill payment). After payment + service recreation, **7 layered issues** were diagnosed + fixed. **Production is now FULLY OPERATIONAL** at `primkoppol.site`.

### The 7 layers (all fixed)
| # | Issue | Root cause | Fix | Commit/Action |
|---|---|---|---|---|
| 1 | **Env vars lost** | Service deletion wiped all env vars | Restored: DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NODE_ENV, PORT | Railway CLI `variables set` |
| 2 | **DNS → Hostinger not Railway** | Old Hostinger A records (`69.46.46.x`) still active | Deleted A records; added ALIAS `@` + CNAME `www` → `r8z6wcvv.up.railway.app` + TXT verify | Hostinger DNS |
| 3 | **AUTH_SECRET missing** | `.env` file didn't have it; old Railway service did | Set `AUTH_SECRET=koperasi-secret-key-production-2025` (= NEXTAUTH_SECRET) | Railway CLI — was causing mobile JWT to use hardcoded fallback `"development-secret-key-fallback-primkoppol"` |
| 4 | **proxy.ts secureCookie** | `getToken()` missing `secureCookie: true` → reads wrong cookie name on HTTPS (`authjs.session-token` vs `__Secure-authjs.session-token`) → token null → every route redirects to /login | Added `secureCookie: process.env.NODE_ENV === "production"` | `ca9d8eae` |
| 5 | **Login redirect** | `signIn(redirect:false)` result.ok unreliable in NextAuth v5 beta → redirect never fires | Changed `if (result?.ok)` → `if (result && !result.error)` in `use-auth.tsx` | `388a492f` |
| 6 | **DB connections closing** | DATABASE_URL using Neon pooler WITHOUT `pgbouncer=true` → Prisma prepared statements conflict with PgBouncer → `prisma:error Error { kind: Closed }` ×13+ | Added `pgbouncer=true&connect_timeout=15` to DATABASE_URL | Railway CLI |
| 7 | **Canonical www→bare** | Cross-subdomain cookie confusion (bare vs www) | Proxy 308 redirect www→bare (deployed but dormant — www needs Railway domain or Hostinger redirect) | `c832d581` |

### Key lessons (for CLAUDE.md / future sessions)
- **Env-var restoration from `.env` is INCOMPLETE** — the old Railway service had MORE vars than `.env`. Always audit `process.env.*` references in codebase against Railway vars after service recreation.
- **`pgbouncer=true` is REQUIRED** when using Neon's pooler endpoint (`-pooler`) — without it, Prisma's `$transaction` (interactive, uses SAVEPOINT) fails silently.
- **`secureCookie: true` is REQUIRED** for `getToken()` in HTTPS production — NextAuth v5 prefixes the cookie with `__Secure-`.
- **NextAuth v5 beta `signIn(redirect:false)` may not set `result.ok`** — check `!result.error` instead.

### Production verification (Playwright, 2026-07-05)
All web unit transactions tested + VERIFIED:
| Unit | Account | Role | Login | Transaction | Sale No |
|---|---|---|---|---|---|
| Toko | `operator@koperasi.com` | operator | ✅ | ✅ | (user-confirmed) |
| Toko | `admintoko@koperasi.com` | admin toko | ✅ | ✅ | `TK-05072026-0002` |
| Toko | `kasirtoko@koperasi.com` | kasir toko | ✅ | ✅ | `TK-05072026-0003` |
| Resto & Cafe | `kasircafe@koperasi.com` | kasir resto_cafe | ✅ | ✅ | `RC-05072026-0002` |
| Cafe LSP | `kasirlsp@koperasi.com` | — | ❌ **User not found** | N/A | Account doesn't exist in DB |

**Mobile app users need RE-LOGIN** — existing mobile JWT tokens were signed with the old fallback secret (before AUTH_SECRET fix) → now invalid → 401 on mobile transactions. Re-login = new token with correct AUTH_SECRET.

### Test sales cleanup needed
- `TK-05072026-0002` (TEST ADMIN TOKO, Rp 8.000)
- `TK-05072026-0003` (TEST KASIR TOKO, Rp 8.000)
- `RC-05072026-0002` (TEST KASIR CAFE, Rp 12.000)

### Railway env vars (current complete set)
```
DATABASE_URL=postgresql://...pooler...neondb?sslmode=require&channel_binding=require&pgbouncer=true&connect_timeout=15&connection_limit=5&pool_timeout=20
DIRECT_URL=postgresql://...direct...neondb?channel_binding=require&sslmode=require
NEXTAUTH_SECRET=koperasi-secret-key-production-2025
AUTH_SECRET=koperasi-secret-key-production-2025
NEXTAUTH_URL=https://primkoppol.site
NODE_ENV=production
PORT=8080
```

### 🔧 Mobile API URL fix (2026-07-05, commit `c75eb194`)
Mobile hardcoded `https://www.primkoppol.site` di `api.ts` (production + fallback) + `KwitansiViewerScreen` (3 site). Karena `www` **belum resolve** di DNS Hostinger (cuma bare ALIAS `@` yang aktif), semua request mobile gagal di DNS resolution → `ERR_NETWORK` → "Koneksi timeout". Web jalan karena user akses bare domain di browser.
**Fix:** `api.ts` → bare `https://primkoppol.site` (2 tempat); `KwitansiViewerScreen` import `BASE_URL` dari `api.ts` (single source of truth, hapus duplikasi domain string). Mobile tsc clean.
**⚠ Code fix berlaku di EAS build #5 (next).** APK yang sudah ter-install masih pointing ke `www` → harus di-update ke build #5 setelah rilis. NEXTAUTH_URL prod = bare `https://primkoppol.site` (jangan `www`).

## ✅ EAS Build #5 — FINISHED (2026-07-06, v1.1.6/vc7, built from `931a04b1`)
Dual build (mobile/android/ clean → archive 123MB each, no ECONNRESET). Both FINISHED.
- **APK (profile production):** `https://expo.dev/artifacts/eas/mi5B2oKQCvnZ_v25t1NdnXYsZhNGb__LlG_j3yCTzyQ.apk` (build ID `a41e3c16-bfd4-4b6c-9c46-e67516330973`, expires ~30 days)
- **AAB (profile store):** `https://expo.dev/artifacts/eas/1XqVTe4mJNGf6T6UUQ4wx-wB3Ju8PQpGnh8jBPuntfM.aab` (build ID `e6f8f550-694f-40fd-9714-d81deba372f0`, for Play Store closed-testing upload)
- Ships: Fase 7b (unit laporan) + 8a (aset CRUD) + 8b (loan edit) + 8c (payroll import) screens + bare-domain API URL hotfix.
- **⚠ Does NOT include Fase 9a.1 H&U screens** (built from `931a04b1`, before 9a.1). 9a.1 screens need build #6.
- ⏭ Smoke test: sideload APK → Laba Kotor (SHU), Neraca badge, Void Angsuran, Aset CRUD, Loan Edit, Payroll Import, Kwitansi (bare domain). AAB → Play Store closed-testing.

## ✅ Fase 9a.1 — Mobile Haji/Umrah Tabungan Core (DONE + DEPLOYED 2026-07-06)
First mobile increment of the H&U module (web Phases 1-4 complete; mobile had ZERO H&U). Commits `07eba935..e2c6b198` (spec+plan+T1-T7+security fix). Pushed `4787fd30..e2c6b198`.
- **DRY money-core:** `processHajiUmrahDeposit` (setoran $transaction) + `createHajiUmrahAccount` extracted to `src/lib/services/haji-umrah-savings.ts` (shared web+mobile). Web setoran + buka-rekening refactored to call them — **behavior-preserving (opus byte-identical, 2 opus reviews APPROVED)**. CashBank unitType inconsistency (deposit `simpan_pinjam` / fee `haji_umrah`) preserved verbatim.
- **5 mobile routes:** GET savings list/detail/products (staff gate) + POST setoran + POST buka-rekening (`/savings/open`). Write RBAC: operator OR admin-`haji_umrah` (DB-sourced unitType). Security fix: staff gate on reads (closed member-token data leak flagged by background review).
- **4 screens:** HajiUmrahScreen (list) + Detail + Setoran (deposit form) + BukaRekening. All field-contracts audited (Fase 6 lesson held). App.tsx 4-route wiring + dashboard nav.
- Final opus review APPROVED (8/8 sections). Tests 459/3 pre-existing. Non-blocking notes: N1 pre-existing cashAccount-branch gap (web parity), N2/N3 minor UX.
- **⚠ Screens ship via EAS build #6** (not #5 — #5 was already in flight before 9a.1). API (web refactor + 5 routes) is LIVE via this push.
- **Out of scope (9a.2-9a.4):** Talangan, Bagi Hasil, Products CRUD, Laporan.

---

## Fase 1 — ✅ DONE + deployed (`82d5fd2..4541674`)
**API live:** `/api/mobile/reports/financial` neraca half → `buildBalanceSheet()` ledger (simpanan Pokok 43,4jt + Wajib 8,71M + Sukarela 581jt; was 0); badge Selisih jujur (`bs.isBalanced`); `/api/mobile/reports/shu-calculator` forwards `unitGrossProfit`.
**Butuh EAS build (UI):** card "Laba Kotor per Unit" (`LaporanSHUScreen.tsx`) + badge (`NeracaScreen.tsx`). ⚠ Visual verify di device tertunda.
**Files:** `src/lib/services/mobile-neraca-shape.ts` (+8 tests), `api/mobile/reports/{shu-calculator,financial}/route.ts`, 2 mobile screens, `scripts/diagnose-mobile-neraca-shu-parity.ts`. Spec/plan: `docs/superpowers/{specs,plans}/2026-07-01-mobile-shu-neraca-refresh*`.

## Fase 2 — ✅ DONE + deployed (`c4cec9a..58d07a8`)
**2a loan-payment** (`api/mobile/loan-payment/route.ts`): rewrite POST → atomic `$transaction(callback)` + FIFO allocation via pure helper `src/lib/loan-payment-helpers.ts` (`allocatePayment`, +8 tests) + `PaymentAllocation` records + per-schedule updates + CB posts (crypto txnNo, `referenceType:"LoanPayment"`/memberId/unitType, `branchId=loan.branchId`). Fixes broken schedule tracking. Contract preserved. Info-disclosure reverted (generic error).
**2b savings-tx** (`api/mobile/savings-tx/route.ts`): atomic `$transaction(callback)` (CashBank sync no longer non-fatal — saldo-integrity fix) + AD-ART Pasal 26 block via pure helper `src/lib/savings-helpers.ts` (`isWithdrawalBlocked`, +4 tests) + CB category `savings` + reference fields + crypto. Contract preserved.
**Diagnostic:** `0 historical PAY-M-* payments` → no legacy allocation debt (forward-only fix).
Spec/plan: `docs/superpowers/{specs,plans}/2026-07-01-mobile-{loan-payment-allocation,savings-tx-atomic}*`.

## Fase 3 — ✅ DONE + deployed (Void Angsuran, `e9a9ce9..c4217aa`)
**API:** `api/mobile/loan-payment-void/route.ts` POST `{paymentId, reason?}` — atomic 9-step reversal **reusing** `src/lib/payment-void-helpers` (zero duplication); `api/mobile/loan-payments/route.ts` GET `?loanId=X` (list for UI).
**UI:** `mobile/src/screens/operator/RiwayatAngsuranScreen.tsx` (list + VOID confirm modal) + `App.tsx` wiring + `DaftarPinjamanScreen.tsx` nav entry. ⚠ Expo visual deferred.
Spec/plan: `docs/superpowers/{specs,plans}/2026-07-02-mobile-void-angsuran*`.

## Fase 4 — ✅ DONE + deployed (mechanical hardening, `2dd06ac..5c73344`)
- **Math.random→crypto** (CRITICAL resolved): `kompen-disburse` (5 sites), `direct-disburse`, `journals` — all `crypto.randomBytes(4).readUInt32BE(0) % N`, format preserved. grep 0 hits.
- **Stale roles:** `MainTabs.tsx:43` + `useIdleLogout.ts:33` → `['operator','admin','admin_sp']`; `MasterDataHubScreen.tsx:120` copy "superadmin"→"operator".
- **UI:** `KasirScreen.tsx` UNIT_TYPES + `cafe_lsp`; `DashboardScreen.tsx:340` paymentMethod 3-way (cash/qris/lainnya).
- **Server:** loan void filter (`loans` + `loans-operator` list+stats); `toko/history:250` drop `admin_unit` from push target.
- **DEFERRED (sound — no web precedent, verified by reviewer):** payroll operator-only (web `api/payroll` GET has no role gate, only DELETE) + NRP-login bypass (web `auth.ts` uses bcrypt only, NRP-login = provisioning-time hash). → fold into Fase 4b RBAC review.
Plan: `docs/superpowers/plans/2026-07-02-mobile-hardening-fase4.md`.

---

## ✅ EAS Build #1 — FINISHED
`mobile/app.json` bumped (commit `5ed2d5b`): `version` 1.1.2, `android.versionCode` 3. Build submitted + completed via EAS (account `violet666`, profile `production` = APK, distribution STORE), building from `5ed2d5b`.
- **APK download:** `https://expo.dev/artifacts/eas/eThiL10I6G1Iw9403oyx0lo59a2pAFEwgwHAeu2gaDE.apk` (signed URL, expires ~30 days)
- **Build page:** https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/570436f9-d608-4475-9904-f7f4df1c2639
- ⏭ **Smoke test device:** sideload APK → card Laba Kotor (Laporan SHU), simpanan terisi + badge Selisih (Neraca), Daftar Pinjaman → Riwayat Angsuran → VOID.
- ⏭ **Play Store upload:** butuh profile `store` (`.aab`) + `eas submit` (keystore `primkoppol-upload.keystore` siap). Step terpisah.

---

## ✅ Fase 4b — RBAC unit/branch scoping (DONE + DEPLOYED)
**Spec + plan:** `docs/superpowers/{specs,plans}/2026-07-02-mobile-rbac-scope*.md`. Commits `4cf135e..c9d1972`, pushed `e376ab8..c9d1972` (Railway auto-deploy).
**Root cause fixed:** mobile JWT lacked `unitType/memberId/permissions` → server couldn't scope. Now `getMobileUserWithScope()` loads fresh scope from DB (1 lookup).
**Built:** pure helper `src/lib/mobile-auth-scope.ts` (`canAccessBranch`/`canAccessUnit`, operator bypass, branch exact-match, unit alias-family match, null→fail-closed 403; 9 unit tests) + scope checks on 8 P0 write routes (5 SP by branch: loan-payment, savings-tx, loan-payment-void, direct-disburse, kompen-disburse; 3 unit by unitType: toko, unit-layanan, toko/stock-in). `journals` POST unchanged (head-office by design).
**Review:** final opus whole-branch APPROVED (security trace clean). **Prod diagnostic clean** (23 staff, 0 null-scope → no lockout). API-only (no EAS build).
**Deferred:** GET handlers (P1 cross-branch read), no-role-check routes (P2: loan-payment GET, toko GET, unit-packages, assets/[id], payroll slip, members/[id]/piutang), member-portal self-scoping (already memberId-scoped). Pre-existing tsc in direct-disburse + toko/history (add to CLAUDE.md list later).
**Ledger:** `.superpowers/sdd/progress.md`.

---

## ✅ Fase 4c — RBAC GET-scope (DONE + DEPLOYED)
**Spec + plan:** `docs/superpowers/{specs,plans}/2026-07-02-mobile-rbac-get-scope*`. Commits `bab3a4a..b7caf5f8`, pushed `c9d1972..b7caf5f8`.
**Built:** extended `mobile-auth-scope.ts` with `branchListFilter`/`unitListFilter` (list-filter helpers, +8 tests) + scope on ~18 GET routes — 9 branch-list (loan-payment GET, loans-operator, savings-accounts, members, buku-kas, kas-bank, reports/loans, reports/savings, savings-tx GET), 6 unit (toko, unit-packages, reports/unit, edit-nrp, batches, audit-logs), 3 single-resource/member-self (loan-payments, members/[id]/piutang, payroll slip). 2 security fix-ups folded in (savings-tx GET missed route; loan-payment POST cashAccount branch check).
**Deviations (role-gate only — cannot scope):** `assets/[id]` (no branch/unit field), `reports/financial` (neraca org-wide), payroll periods (no branchId) — last two untouched.
**Review:** final opus APPROVED. Tests 427/3 pre-existing; 0 new tsc. Diagnostic clean.
**Follow-up queued:** `members/[id]` detail route lacks branch-scope (same class, spec didn't list it) — fold into next read-scoping pass.

---

## ⏭ Roadmap FULL PARITY (audit 2026-07-04, post Fase 1-8b)

Comprehensive mobile-vs-web gap audit. **DONE Fase 1-8b** covers: SHU/Neraca, money-integrity (loan-payment/savings-tx), Void Angsuran, hardening (crypto), RBAC write+read scope, Play Store polish, Piutang Gabungan, Kas/Bank create+transfer, per-unit laporan, Aset CRUD, Loan edit. Mobile POS is feature-complete for cashiering (9 units + QRIS + thermal + push). **Gaps below** are the remaining parity work (no build until user says; recorded for traceability).

### 🔴 P0 — MONEY-MOVING (highest value)
| Fase | Feature | Size | Money-risk | Notes |
|------|---------|------|-----------|-------|
| **8c** | **Payroll Import** (Excel GAJI: preview/commit, delete period) | L | HIGH | Biggest monthly op — triggers TAJIB/SP/barang deductions. Deferred from Fase 8. |
| **9a** | **Haji/Umrah mobile** (tabungan setoran/tarik, talangan apply/detail, bagi hasil, products, laporan) | XL | VERY HIGH | Entire module missing. Web Ph1-4 complete (6 APIs + 7 pages). Money-moving (savings + loans + profit-share). |
| **9b** | **Tagihan/Billing mobile** (generate draft, toggle items, refresh, process/settle, riwayat) | L | CRITICAL | Creates + settles financial obligations. Web has 7 APIs + 3 pages. TWO-route rule (generate + process). |
| 10 | **Import VS SP** (loan import GAJI sheet, 3-tier member match, preview/commit/undo, batches) | L | HIGH | Bulk loan creation. |
| 10b | **TAJIB / Potongan import** (bulk savings deposits + salary deductions from GAJI) | L | HIGH | Bulk money. Mobile import only does member-data, not the financial txns. |
| 11a | **SHU Distribusi** (allocate SHU to members — real money transfer) | M | HIGH | Mobile only simulates. |
| 11b | **Tutup Buku** (period close, irreversible) | M | HIGH | |
| 11c | **Approval: missing 3 types** (loan_disbursement, savings_withdrawal, period_close) | M | HIGH | Mobile handles 3 of 6. |

### 🟠 P1 — MEMBER-FACING + REVENUE
| Fase | Feature | Size | Notes |
|------|---------|------|-------|
| 12a | **Manajemen Unit + Product/Pricing CRUD** (per-unit product create/edit, manajemen harga, stock opname, bahan baku) | L | Wrong price = revenue loss at POS. Admin can't manage products from mobile. |
| 12b | **Operator-side Loan Application CREATE** (on behalf of member) | M | Core lending workflow gap. |
| 12c | **Transaksi Unit with piutang limit validation** | M | Credit exposure control. |
| 13 | **Member Portal: Haji-Umrah view** (depends on 9a) | M | Members can't see HU progress. |
| 13b | **Member Portal: Faktur Piutang** (view + mark-as-paid) | M | Debt acknowledgment. |

### 🟡 P2 — OPERATIONAL + SECURITY
| Fase | Feature | Size | Notes |
|------|---------|------|-------|
| **14** | **🔴 RBAC GET-scope hardening** — branch-scope on GET endpoints that currently leak cross-branch for admin: `members` (list), `members/[id]` (Fase 4c residual), `savings-accounts`, `transactions`, `reports/*` (5 report endpoints), `summary` | **M** | **SECURITY GAP** (not a feature). Multiple GET endpoints lack branchListFilter → cross-branch data leak. Write routes are scoped (Fase 4b); reads are partial (Fase 4c only did ~18). |
| 15 | **Non-SP Penerimaan/Pengeluaran CRUD** | M | Operational cash flow. |
| 16 | **SHU Perhitungan** (full calc, not just simulation) | M | |
| 17 | **Savings: Open new rekening** (account CREATE) | M | Field ops open accounts. |
| 18 | **Reports**: Arus Kas (cash flow), Rekap Anggota, Rekap Pinjaman, Kolektibilitas (NPL), Laporan Jasa, Dana Resiko, Faktur Potongan | S-M each | Read-only reports. |
| 19 | **Kas-Bank**: master account CRUD + transaction edit/delete | S-M | |
| 20 | **Jurnal Penyesuaian** (adjustment journals) | S | Accounting accuracy. |

### 🟢 P3 — NICE-TO-HAVE / POLISH
- **Master Data Hub sub-pages**: COA CRUD, Mapping Jurnal, Parameter SHU, Saldo Awal, Kas-Bank master, full Import-Data (12+ types), Cabang CRUD, User Mgmt (L total) — currently MasterDataHub only has Pengumuman.
- **Member**: CREATE single form, extended edit (40+ fields), duplicate detection/merge, all-status filter.
- **Toko**: Product import, raw materials, marketing/promo, cashier mgmt.
- **Reports**: export (Excel/PDF) across all report screens.
- **Audit log**: enhanced filters (action/module/user/date) + detail expansion.
- **Misc**: KDS (kitchen display), floor-plan (resto), settings page, pinjaman jadwal/dana-resiko, member card barcode print, payroll slip drill-down.

### 🔵 RESIDUAL (from prior fase reviews, low-priority cleanup)
- `members/[id]` detail branch-scope (Fase 4c) — folds into P2 Fase 14.
- payroll `[periodId]/slip/[slipId]` still allows kasir (Fase 5) — 1-line fix.
- Fase 8a: $transaction consistency (audit-orphan) + PUT-on-disposed server guard.
- Fase 8b: 404→400 missing-loan + $transaction-doesn't-wrap-audit.

**Suggested next fases (money-first):** 8c Payroll → 9a Haji/Umrah → 9b Tagihan → 10 Imports → 11 SHU/Tutup-buku/Approvals → **14 RBAC GET-scope (security)** → 12 Manajemen Unit/Products → P2/P3.

---

## Decision log
- **Urutan fase:** Refresh → Bug integritas → Fitur parity (Void Angsuran) → Hardening (Math.random CRITICAL di belakang by user choice).
- **Fase 1 SHU:** "Card Laba Kotor saja" (bukan tabel). Fase 1 Neraca: "Swap in-place" di `/financial` (laba-rugi tetap journal).
- **Fase 2:** port terpadu penuh match web (bukan focused); 2a dulu lalu 2b.
- **Fase 3:** batch strategy (incremental dev, batched EAS builds); Void Angsuran duluan (smallest).
- **Deploy model:** API = Railway (push, tiap fase); mobile UI = EAS build batched.
- **Deferral berulang:** RBAC auth/IDOR + branch/unit isolation = systemic, deferred ke Fase 4b (bukan piecemeal per route). 3 route kena-flag security hook.

## Konvensi / batas
- **Jangan stage** `.claude/settings.local.json` (modif non-mine). `mobile/app.json` sekarang di-bump by me (lineage versi) — OK stage utk commit version bump.
- **Jangan include SP-IMP/* loan** di CashBankTransaction (korup BRI balance).
- Txn number = `crypto.randomBytes()` (Math.random = CRITICAL scanner; Fase 4 sudah fix mobile).
- Pre-existing fail: `split-bill`, `batch-navigation`, `floor-plan`/`queue-system`. Pre-existing tsc: `api/mobile/toko/shifts/[id]`, `prisma/seed-*.ts`. Tests baseline: 410 pass / 3 pre-existing.

## Cara resume (jika context habis / post-compact)
1. `git log --oneline -30` — status sebenarnya.
2. Baca dokumen ini + `.remember/remember.md` (handoff) + `.superpowers/sdd/progress.md` (ledger).
3. **Railway prod:** service `melodious-generosity` / `koperasi-app` — ALL 7 production fixes deployed + verified. Login + transactions work for operator/admin/kasir (toko + resto_cafe). `kasirlsp@koperasi.com` doesn't exist in DB (needs creation). Mobile users need re-login (AUTH_SECRET changed).
4. **Status aktual mobile (2026-07-18):** Fase 9a.1/9a.2/9a.3 + 9b read-only + 12b + 13b + 18a + residual Fase 14 selesai. Latest AAB v1.1.7/vc9 (`d508d7ba`, commit `67ec71b2`); latest APK v1.1.7/vc8 (`a92c70e5`, commit `571b1db4`).
5. **QA remediation `74a73ae0`:** 8 High + 1 Medium fixed; API deployed/live read-only verified. Remaining High = systemic idempotency (separate schema-backed design). QA artifacts: `qa/mobile-qa/`; spec/plan: `docs/superpowers/{specs,plans}/2026-07-18-mobile-qa-strategy*`.
6. **vc10 build FINISHED:** commit `a4802c47`; APK `https://expo.dev/artifacts/eas/nNJ4x1zkxLvZ2FbeY7j8xyR03xFHWi-WyFOLuvzSbYI.apk`; AAB `https://expo.dev/artifacts/eas/GbMHTJd8Andadg4OqblW4BfMwLC1nOYfmVVyXEaG1ic.aab`. Next session: install APK upgrade → physical smoke Phase C → update Phase D exit criteria. Roadmap feature berikut setelah QA = Fase 9a.4 Products/Laporan atau P0 imports, pending user priority.
7. Memori `mobile-drift-audit-fase1-2026-07.md` — historical audit; prefer this document + current git log for latest state.
