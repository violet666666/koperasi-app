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
- [x] **Fase 5 — Play Store polish** — ✅ DONE + **deployed** (`f591a304` logger sweep 52 console.*→log, `958084db` de-stub+gate, `4c6102e7` final-review fix; pushed `b7caf5f8..c4ce3f3c`). Final opus review APPROVED; tests 427/3 pre-existing (no regression). **EAS build #2 ✅ FINISHED** — v1.1.3/vc4, APK `https://expo.dev/artifacts/eas/a_0JW2Rb41_VNfgW5C-Wl6X6d5FbS-yaDtDPC1_3v5Y.apk` (build ID `59630aae-b6a6-4248-9f23-b6a3c4e1bcb3`, queue ~93min free-tier + build ~11min).
- [x] **Fase 6 — Piutang Gabungan mobile** — ✅ DONE + **API deployed** (6 SDD tasks `da79d824`..`bf21554c`; pushed `c4ce3f3c..bf21554c`). Pure helper `aggregatePiutangGabungan`+`buildPiutangCSV` (+12 tests), list API `?format=csv`/`?export=true`, drill-down `[memberId]` API, screen, nav. Final opus review APPROVED; 1 Critical (screen field-contract mismatch) fixed in `f41df4e8`. Tests 439/3 pre-existing. Operator/admin_sp gate (no scope — org-wide consolidated). **EAS build #3 ✅ FINISHED** — v1.1.4/vc5, APK `https://expo.dev/artifacts/eas/PNFETl78t7uW8PtEcvY8D4YAuma3sEfSLzWkN-RnOYw.apk`.
- [x] **Fase 7a — Kas/Bank create+transfer mobile** — ✅ DONE + **API deployed** (5 SDD tasks `d605d101`..`4ba3e924`; pushed `6f0affe7..4ba3e924`). Crypto txn-no helper (+tests), POST `/kas-bank/transactions` + `/transfers`, 2 form screens, nav. Final opus review APPROVED; **Critical RBAC fixed** `f9d2b7ed` (T2 `!canAccessBranch(...)` inert → `.allowed`). Tests 444/3 pre-existing.
- [x] **Fase 7b — Generic per-unit laporan mobile** — ✅ DONE + **API + web-refactor deployed** (`559d004f`..`e5acbd01`; pushed `8b2ec6ca..e5acbd01`). Shared `getUnitLaporanData` helper (web+mobile DRY); web refactor behavior-preserving; `LaporanUnitScreen` (full V1 read-only). Tests 450/3.
- [x] **Fase 8a — Aset CRUD mobile** — ✅ DONE + **API deployed** (`0ffed9be`..`29269d65`; pushed `e5acbd01..29269d65`). Reused existing POST + new PUT edit + POST dispose + DELETE soft; `AsetFormScreen` + AsetList FAB + AsetDetail actions. Tests 450/3.
- [x] **Fase 8b — Loan edit mobile** — ✅ DONE + **API + web-refactor deployed** (5 SDD tasks `9e9a947d`..`59146d42`; pushed `29269d65..59146d42`). **DRY extraction** (highest money-integrity fase): `recalcLoanFinancials` (pure, +9 tests) + `applyLoanEdit` (the $transaction schedule-regen) shared by web + mobile. Web PUT refactored **behavior-preserving (money path byte-identical, opus-verified)**; mobile `GET`+`PUT /loans/[id]` (operator/admin_sp + canAccessBranch). `LoanEditScreen` (7-field form, change-detection, no live preview) + DaftarPinjaman Edit entry. Tests 459/3. **Screen ships via EAS build #5.**

**Push status:** Fase 1-8b **all PUSHED + API deployed** (`29269d65..59146d42`). EAS build #4 (dual APK+AAB) done; **build #5 pending** (ships Fase 7b + 8a + 8b screens). ⏭ Smoke test build #4 + Fase 7b/8a/8b screens (after #5). Play Store closed testing working.

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
3. **Next action tergantung status EAS build:** kalau `mobile/app.json` versionCode 3 + belum di-build → user jalankan `eas build`. Kalau sudah build → lanjut Fase 4b atau fitur parity.
4. Memori `mobile-drift-audit-fase1-2026-07.md` — detail audit + roadmap ter-update.
