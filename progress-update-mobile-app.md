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
- [~] **EAS Build #1** — `mobile/app.json` **sudah di-bump → version 1.1.2 / versionCode 3** (working tree, belum commit). ⏭ **NEXT: jalankan `eas build` + smoke test device** (user action).
- [ ] **Fase 4b** — RBAC unit/branch scoping (separate spec, systemic, ~20 mobile routes).

**Push status:** Fase 1-4 **all PUSHED + API deployed** (push `4541674..e376ab8`). `mobile/app.json` bump + dokumen ini = lokal (unpushed; tidak affect API deploy).

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

## ⏭ NEXT — EAS Build #1 (USER ACTION)
`mobile/app.json` **sudah di-bump** (working tree): `version` 1.1.1→**1.1.2**, `android.versionCode` 2→**3**. (Catatan: file ini juga punya modif non-mine linier 1.1.0→1.1.1 + add versionCode — aman, bagian dari lineage versi.)
1. **(Opsional) commit app.json** agar bump tercatat: `git add mobile/app.json && git commit -m "chore(mobile): bump version 1.1.2 / versionCode 3 for EAS build #1"`. (Tidak affect API deploy.)
2. **Build:** `cd mobile && npx eas build --platform android --profile production` (butuh EAS auth, agak lama — jalankan di terminal Anda). Lihat `mobile/eas.json`, `mobile/PLAY-STORE-RELEASE-GUIDE.md`.
3. **Smoke test device:** card Laba Kotor (Laporan SHU), simpanan terisi + badge Selisih (Neraca), Daftar Pinjaman → Riwayat Angsuran → VOID satu pembayaran.
4. **Upload Play Store** via EAS Submit (keystore `primkoppol-upload.keystore` siap).

---

## ⏭ Fase 4b — RBAC unit/branch scoping (separate spec, sesi baru)
Security hook (automated) flagged **3 route mobile** (loan-payment, savings-tx, loan-payment-void) untuk missing per-loan/member/branch authorization. **Systemic across ~20 mobile routes**, parity dengan web (web juga lacks). `operator`=manage_all (bukan gap, by design); `admin`/`admin_sp` unit-scoping = gap real tapi systemic.
**Butuh spec sendiri:** role→scope rules (operator bypass; admin→unitType; admin_sp→SP/simpan_pinjam; kasir→POS) + reusable helper `assertMobileUserScope(user, {branchId?, unitType?})` + apply per-route. Juga review 2 deferral Fase 4 (payroll gate + NRP-login) di konteks RBAC.

---

## ⏭ Future feature parity (EAS build #2, sesi lanjutan)
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
