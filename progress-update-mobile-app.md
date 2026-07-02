# Progress Update Mobile App — Drift Fix Effort

> **Dokumen recovery.** Update 2026-07-02. Jika context habis/sesi compact, baca dokumen ini **+** `.remember/remember.md` **+** `.superpowers/sdd/progress.md` **+** memori `mobile-drift-audit-fase1-2026-07.md` **+** `git log --oneline -30`.

- **Branch:** `railway-migration` — **auto-deploy ke prod (primkoppol.site) tiap push.**
- **Mobile app:** Expo 55 / RN 0.83. API deploy = Railway (push). Mobile UI deploy = `eas build` (terpisah).

---

## Status keseluruhan (per 2026-07-02)

- [x] **Fase 1** — SHU Laba Kotor + Neraca ledger. ✅ DONE + **deployed** 2026-07-01 (`82d5fd2..4541674`).
- [x] **Fase 2** — Money-integrity (2a loan-payment allocation + 2b savings-tx atomic/AD-ART). ✅ DONE + **deployed** (`c4cec9a..58d07a8`).
- [x] **Fase 3 (Void Angsuran)** — API void + list-payments + RiwayatAngsuranScreen UI. ✅ DONE + **deployed** (`e9a9ce9..c4217aa`).
- [x] **Fase 4 (mechanical)** — Hardening (Math.random→crypto CRITICAL-resolved + stale roles + cafe_lsp + void filter + drop admin_unit). ✅ DONE + **deployed** (`2dd06ac..5c73344`).
- [x] **EAS Build #1** — ✅ **FINISHED** (commit `5ed2d5b`, v1.1.2/vc3). APK: `https://expo.dev/artifacts/eas/eThiL10I6G1Iw9403oyx0lo59a2pAFEwgwHAeu2gaDE.apk`. ⏭ Smoke test device + Play Store `.aab` submit pending.
- [x] **Fase 4b** — RBAC unit/branch scoping (writes). ✅ DONE + **deployed** (`4cf135e..c9d1972`).
- [x] **Fase 4c** — RBAC GET-scope (reads). ✅ DONE + **deployed** (`bab3a4a..b7caf5f8`, pushed `c9d1972..b7caf5f8`). `branchListFilter`/`unitListFilter` helpers + scope on ~18 GET routes. Final opus review APPROVED; diagnostic clean.

**Push status:** Fase 1-4b-4c **all PUSHED + API deployed** (`c9d1972..b7caf5f8`). EAS build #1 APK **done** (smoke test pending).

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

## ⏭ Roadmap (user authorized "semuanya, satu per satu")
1. ✅ **Fase 4c** — GET-scope (DONE+deployed).
2. ⏭ **Fase 5 — Play Store polish** (S): strip 45+ `console.log`, fix MasterDataHub stub (4/5 "Segera Hadir"), uncomment/fix Aset FAB dead nav, fix payroll role inconsistency (API allows kasir / UI hides). Mixed API+UI → needs EAS build.
3. ⏭ **Fase 6 — Piutang Gabungan** (M): screen + API (advertised, missing).
4. ⏭ **Fase 7 — Field-ops parity** (M): Kas/Bank create + transfer; generic per-unit laporan.
5. ⏭ **Fase 8 — Parity lanjutan** (M each): Loan edit, Aset CRUD, Payroll run/publish.
6. ⏭ **Fase 9 — Modul besar** (L each): Haji/Umrah mobile, Tagihan/Billing.
7. ⏭ **Residual:** `members/[id]` detail branch-scope (from Fase 4c review).

---
Sisa dari audit Tier-3 (Fase 3 hanya Void Angsuran): **Piutang Gabungan** (diiklankan di PLAY-STORE-RELEASE-GUIDE tapi belum diimplementasi!), **Tagihan/Billing** (monthly 16-15 cycle), **Haji/Umrah** mobile (web Ph1-4 complete; Ph5 mobile spec pernah direncanakan). Strategy: kembangkan satu-per-satu, batch ke EAS build berikutnya.

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
3. **Next action tergantung status EAS build:** kalau `mobile/app.json` versionCode 3 + belum di-build → user jalankan `eas build`. Kalau sudah build → lanjut Fase 4b atau fitur parity.
4. Memori `mobile-drift-audit-fase1-2026-07.md` — detail audit + roadmap ter-update.
