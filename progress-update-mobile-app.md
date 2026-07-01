# Progress Update Mobile App — Drift Fix Effort

> **Dokumen recovery.** Dibuat 2026-07-01 sebagai catatan progress + peta resume jika context window habis. Jika sesi terpotong, baca dokumen ini **+** `.superpowers/sdd/progress.md` **+** memori `mobile-drift-audit-fase1-2026-07.md` **+** `git log --oneline -20`.

- **Branch:** `railway-migration` — **auto-deploy ke prod (primkoppol.site) tiap push.** Commit lokal tidak deploy; push baru deploy.
- **Mobile app:** Expo 55 / RN 0.83, v1.1.1 (`mobile/app.json`). Deploy mobile = `eas build` (terpisah dari Railway, di akhir effort).

## Konteks
Audit mobile vs web (2026-07-01, 3 sub-agent) menemukan mobile ketinggalan di 3 lapisan. Detail lengkap + bukti `file:line` di memori `mobile-drift-audit-fase1-2026-07.md`. User sepakat 4 fase berurutan, diakhiri EAS build.

## Status keseluruhan
- [x] **Fase 1** — Refresh layar stale (SHU Laba Kotor + Neraca ledger). ✅ DONE, deployed 2026-07-01.
- [x] **Fase 2** — Bug integritas uang mobile API. **DONE** (2a loan-payment FIFO allocation + 2b savings-tx atomic+AD-ART; review-approved opus; commits c4cec9a..58d07a8; deploy-pending). RBAC auth/IDOR systemic gap deferred to Fase 4.
- [x] **Fase 3 (Void Angsuran)** — Fitur parity batch 1. **DONE** (API void reusing payment-void-helpers + list-payments + RiwayatAngsuranScreen UI; review-approved opus; commits e9a9ce9..c4217aa; deploy-pending). ⚠ Expo visual verify deferred. Sisa fitur (Piutang Gabungan/Tagihan/Haji-Umrah) = batch sesi lanjutan.
- [x] **Fase 4 (mechanical)** — Hardening DONE (Math.random→crypto CRITICAL-resolved, stale roles, cafe_lsp POS, paymentMethod 3-way, loan void filter, drop admin_unit; commits 2dd06ac..5c73344; review-approved opus). Payroll/NRP-login deferred (no web precedent). ⏭ **Fase 4b RBAC scoping** (3 routes flagged, systemic) + **EAS build #1** pending.
- [ ] **EAS Build** — update app di device (setelah semua fase).

---

## Fase 1 — ✅ DONE (deployed 2026-07-01, commit `82d5fd2..4541674`)
**Apa yang live (API, Railway):**
- Neraca mobile (`/api/mobile/reports/financial`) pakai `buildBalanceSheet()` (ledger) — `simpanan` terhitung (Pokok 43,4jt + Wajib 8,71M + Sukarela 581jt; sebelumnya `0`). Laba-rugi half untouched.
- Badge Selisih jujur (passes `bs.isBalanced`).
- SHU endpoint (`/api/mobile/reports/shu-calculator`) forwards `unitGrossProfit` (additive, aman).

**Yang butuh EAS build (belum di device):** card "Laba Kotor per Unit" di `LaporanSHUScreen.tsx` + badge baru di `NeracaScreen.tsx`. Typecheck clean, tapi visual verify di device tertunda (tidak ada emulator).

**File:** `src/lib/services/mobile-neraca-shape.ts` (+ 8 tests), `api/mobile/reports/{shu-calculator,financial}/route.ts`, `mobile/.../LaporanSHUScreen.tsx`, `mobile/.../NeracaScreen.tsx`, `scripts/diagnose-mobile-neraca-shu-parity.ts`.
**Spec/plan:** `docs/superpowers/{specs,plans}/2026-07-01-mobile-shu-neraca-refresh*`.

---

## Fase 2 — PENDING (NEXT) — Bug integritas uang (Tier 1 Critical)
Siklus: brainstorm → spec → plan → SDD. **Sensitif (akuntansi) — TDD ketat + diagnostic before/after vs prod Neon.**

**2a. `src/app/api/mobile/loan-payment/route.ts`** — anggsuran reguler (baris ~230-259):
- Masalah: tidak ada alokasi per-schedule FIFO, tidak bikin `PaymentAllocation`, tidak simpan `paymentMethod`. Jadwal pinjaman drift untuk tiap pembayaran via mobile.
- Referensi web (PORT dari sini): `src/app/api/loans/[id]/payments/route.ts:149-220` (FIFO allocation + `PaymentAllocation` + `paymentMethod` + receipt).
- Catatan: cabang early-settlement (baris ~108-208) juga pakai `paymentNo: PAY-M-SET-${Date.now()}` (bukan crypto, tapi bukan Math.random juga — collision-prone saja).

**2b. `src/app/api/mobile/savings-tx/route.ts`**:
- Masalah: (1) CashBank sync di try/catch terpisah "non-fatal" (saldo bisa mismatch); (2) tidak ada cek AD-ART Pasal 26 (bisa tarik Pokok/Wajib); (3) category `setoran_simpanan`/`penarikan_simpanan` ≠ web `savings`; (4) tidak ada `paymentMethod`/`referenceType`.
- Referensi web: `src/app/api/savings/transactions/route.ts:134-278` (single `$transaction`, `canWithdraw`/AD-ART, `category: "savings"`, `paymentMethod`, `referenceType: "SavingsTransaction"`).

---

## Fase 3 — PENDING — Fitur parity besar (pilih SATU)
Kandidat (pilih saat mulai fase): Haji/Umrah mobile (Ph5) / Tagihan-Billing / Void Angsuran / Piutang Gabungan (diiklankan di PLAY-STORE-RELEASE-GUIDE tapi belum diimplementasi!).

## Fase 4 — PENDING — Hardening (Tier 1+2 ringan, cepat, rendah risiko)
- `Math.random()`→`crypto.randomBytes()`: `api/mobile/loans-operator/kompen-disburse/route.ts:147,163,180`, `direct-disburse/route.ts:9`, `journals/route.ts:117`.
- Stale role arrays: `mobile/.../MainTabs.tsx:43`, `useIdleLogout.ts:33` (drop `superadmin`/`admin_unit`); `MasterDataHubScreen.tsx:120` copy.
- `KasirScreen.tsx:39-48` UNIT_TYPES tambah `cafe_lsp`.
- `DashboardScreen.tsx:340` label paymentMethod 3-way (cash/qris/lainnya).
- Void filter: `api/mobile/loans/route.ts`, `loans-operator/route.ts:65`.
- Payroll role gate operator-only: `api/mobile/payroll/route.ts:10` + `[periodId]:14`.
- NRP-login fallback: `api/mobile/login/route.ts:56` (password==NRP, mirror web `auth.ts`).
- `toko/history/route.ts:250` push target: drop stale `admin_unit`.

---

## EAS Build (langkah terakhir, setelah Fase 4)
1. Cek `mobile/app.json` dulu — file ini sering dimodifikasi pihak lain; verifikasi sebelum edit. Bump `versionCode` (saat ini 2) + `version` (saat ini 1.1.1).
2. `cd mobile && npx eas build --platform android --profile production` (lihat `mobile/eas.json`, `PLAY-STORE-RELEASE-GUIDE.md`).
3. Upload ke Play Store via EAS Submit (keystore `primkoppol-upload.keystore` sudah ada).
4. Smoke test visual di device: card Laba Kotor, badge Selisih, neraca simpanan terisi.

---

## Cara resume (jika context habis)
1. `git log --oneline -20` — lihat commit terbaru (status sebenarnya).
2. Baca dokumen ini untuk status per-fase + scope.
3. `.superpowers/sdd/progress.md` — ledger SDD per-task (fase aktif).
4. Memori `mobile-drift-audit-fase1-2026-07.md` — detail audit + bukti.
5. Lihat task list (`TaskList`) — fase pending ada ID-nya.
6. Lanjut fase pertama yang belum diceklis.

## Decision log
- **Urutan fase:** user pilih Refresh → Bug integritas → Fitur parity → Hardening (bukan urutan risiko; Math.random CRITICAL di-hardening sengaja di-belakang sesuai pilihan user, akan di-fold makin cepat bila diminta).
- **Fase 1 SHU:** "Card Laba Kotor saja" (bukan tabel per-unit) — keputusan user.
- **Fase 1 Neraca:** "Swap neraca → ledger (in-place)" di endpoint `/financial` yg sama (bukan pisah endpoint) — laba-rugi tetap journal.
- **Deploy model:** API = Railway (push); mobile UI = EAS build (akhir).

## Konvensi / batas
- **Jangan stage** `.claude/settings.local.json` atau `mobile/app.json` (modif non-mine).
- **Jangan include SP-IMP/* loan** di CashBankTransaction (korup BRI balance).
- Txn number = `crypto.randomBytes()` (Math.random = CRITICAL scanner).
- Pre-existing fail: `split-bill`, `batch-navigation`, `floor-plan`/`queue-system`. Pre-existing tsc: `api/mobile/toko/shifts/[id]`, `prisma/seed-*.ts`.
