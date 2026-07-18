# SDD Progress — Mobile Hardening (Fase 4)

Plan: docs/superpowers/plans/2026-07-02-mobile-hardening-fase4.md
Branch: railway-migration
Started from BASE: f394c45 (plan commit)

## Completed
- Fase 4 (Tasks 1-4 bundled): complete (commits f394c45..5c73344, review clean — Approved). Math.random→crypto (7 sites, format preserved — CRITICAL resolved); stale roles dropped (MainTabs/useIdleLogout/MasterDataHub); cafe_lsp in POS; paymentMethod 3-way; loan void filter (list+stats); admin_unit dropped from toko push. Tests 410 pass / 3 pre-existing; web+mobile tsc clean; grep 0 Math.random.

## Deferrals (sound — verified by reviewer)
- Payroll operator-only: web `api/payroll` GET has NO role gate (only DELETE operator-only) → narrowing mobile GET = no parity + breaks admin/kasir. → Fase 4b RBAC spec.
- NRP-login bypass: web `auth.ts` authorize() uses bcrypt only, NO password==NRP fallback (NRP login = provisioning-time hash) → nothing to mirror. → not a gap.

## Minor findings (deferred to final whole-branch review triage)
- Fase 4: void filter overwritten on explicit `?status=voided` (correct, matches web). paymentLabel inline alloc (negligible RN). No behavioral test for void filter (mechanical, typecheck-only — acceptable).

---

# Fase 4b — Mobile RBAC Unit/Branch Scope

Plan: docs/superpowers/plans/2026-07-02-mobile-rbac-scope.md
Spec: docs/superpowers/specs/2026-07-02-mobile-rbac-scope-design.md
Started from BASE: 751fa98 (docs commit)
Model plan: T1/T2/T5 = haiku (transcription/complete code); T3/T4 = sonnet (integration); reviewers = sonnet; final whole-branch = opus.

## Tasks
- [x] T1: pure helper src/lib/mobile-auth-scope.ts + tests (TDD) — complete (751fa98..4cf135e, review clean; 9 tests canonical, brief's "10" was a typo)
- [x] T2: getMobileUserWithScope in src/app/api/mobile/middleware.ts — complete (4cf135e..c665a3a, review clean)
- [x] T3: branch-scope on 5 SP routes — complete (c665a3a..52c1d71, review clean). NOTE: direct-disburse has pre-existing tsc errors (user.permissions, adminFeeValue) — add to CLAUDE.md pre-existing list later.
- [x] T4: unit-scope on 3 routes (toko, unit-layanan, toko/stock-in) — complete (52c1d71..37f21dc, review clean). NOTE: toko/history/route.ts has pre-existing tsc errors (MobileJWTPayload.unitType) — out of scope.
- [x] T5: scripts/diagnose-mobile-staff-null-scope.ts — complete (37f21dc..c9d1972, controller-reviewed: verbatim, read-only, single file)

## All tasks complete — FINAL REVIEW APPROVED (751fa98..c9d1972)
Per-task reviews all clean (T1-T4 subagent-reviewed ✅; T5 controller-reviewed). Final opus whole-branch review: **APPROVED**, no Critical/Important (security trace clean: checks after-fetch/before-mutation, operator-only bypass, DB-sourced scope, tx atomicity preserved, parity intact, journals untouched). Tests 419/3 pre-existing; 0 new tsc errors (direct-disburse + toko/history confirmed pre-existing at base 751fa98).
**Prod null-scope diagnostic: CLEAN** (23 staff, 0 null branchId, 0 null unitType) → no lockout risk on deploy.
**Status:** 5 local commits (4cf135e..c9d1972) on railway-migration, UNPUSHED. API-only (no EAS build). Push = deploy to prod. Pending user decision.

## Notes
- kompen-disburse + stock-in: hoist resource read BEFORE $transaction for scope check; keep tx's own re-reads.
- journals POST = NO change (head-office branchId by design; role check is the gate).
- Null scope → fail-closed 403 (generic message, no reason leak).
- Do NOT change role membership on any route (parity).

---

# Fase 4c — Mobile RBAC GET-Scope

Plan: docs/superpowers/plans/2026-07-02-mobile-rbac-get-scope.md
Spec: docs/superpowers/specs/2026-07-02-mobile-rbac-get-scope-design.md
Started from BASE: d6f3dab (docs commit)
Model plan: T1 = haiku (helper TDD); T2/T3/T4 = sonnet (route wiring); reviewers = sonnet; final = opus.

## Tasks
- [x] T1: branchListFilter + unitListFilter + unitFamilyContaining in mobile-auth-scope.ts + tests — complete (d6f3dab..bab3a4a, review clean; 8 new tests, 427 total)
- [x] T2: branch-scope 8 GET lists — complete (bab3a4a..366efec, +security fix 0536617: savings-tx GET scope + loan-payment POST cashAccount branch check; review clean)
- [x] T3: unit-scope 6 GET (toko, unit-packages, reports/unit, edit-nrp, batches, audit-logs) — complete (0536617..a8e5c2e, review clean)
- [x] T4: single-resource/deviation 4 GET (loan-payments, members/[id]/piutang, payroll slip, assets/[id]) — complete (a8e5c2e..b7caf5f8, review clean)

## All tasks complete — pending final whole-branch review (bab3a4a..b7caf5f8)
Per-task reviews all clean. 2 security fix-ups folded in (savings-tx GET + loan-payment cashAccount). Deviations: assets/[id] gate-only (no scope field); reports/financial + payroll periods untouched (can't scope). Final opus review next, then re-run null-scope diagnostic + finishing-a-development-branch.

---

# Fase 5 — Mobile Play Store Polish (DONE + PUSHED; EAS build #2 NEXT)

Plan: docs/superpowers/plans/2026-07-03-mobile-play-store-polish.md
Spec: docs/superpowers/specs/2026-07-03-mobile-play-store-polish-design.md
Executed via SDD (53c8f6fa..4c6102e7), pushed `b7caf5f8..4c6102e7` (Railway auto-deploying payroll API narrowing). Mobile UI ships via EAS build #2 (next step).
Model plan: T1 = sonnet (console sweep, mechanical but voluminous); T2 = haiku/sonnet (3 small removals); reviewers = sonnet; final = opus.

## Tasks
- [x] T1: create mobile/src/utils/log.ts (__DEV__-gated) + sweep console.* across mobile/src/** — complete (53c8f6fa..f591a304, review clean; actual scope 52 sites / 37 files incl. lib/notifications.ts+storage.ts, not just screens). Minor notes (optional): redundant `declare const __DEV__` guard; 1 log→warn escalation in notifications.ts (improvement).
- [x] T2: de-stub MasterDataHub (remove 4 "Segera Hadir" items) + remove dead Aset FAB + align payroll API gate (drop kasir) — complete (f591a304..958084db, review clean; also removed now-unused Alert import). Deferred to final review: `[periodId]/slip/[slipId]` route still allows kasir (structurally different gate: anggota self + canAccessBranch, not the same staff-list) → low-sev policy item, 1-line fix if desired.

## After T1+T2 → EAS build #2 — ✅ FINISHED
**Build #2 DONE.** Bump `c4ce3f3c` (v1.1.3/vc4), pushed `4c6102e7..c4ce3f3c`. Build ID `59630aae-b6a6-4248-9f23-b6a3c4e1bcb3`, status FINISHED, built from `c4ce3f3c`. **APK:** `https://expo.dev/artifacts/eas/a_0JW2Rb41_VNfgW5C-Wl6X6d5FbS-yaDtDPC1_3v5Y.apk` (expires ~2026-08-01). Metrics: queueTime ~93min (free-tier NORMAL priority — long queue), buildDuration ~11min. Page: https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/59630aae-b6a6-4248-9f23-b6a3c4e1bcb3 .
1. ~~Bump mobile/app.json: version 1.1.2→1.1.3, versionCode 3→4. Commit.~~ ✅ `c4ce3f3c`
2. ~~Push railway-migration (deploys payroll API change).~~ ✅
3. ~~`cd mobile && npx eas-cli build --platform android --profile production --non-interactive --no-wait`~~ ✅ submitted
4. ~~Give user build URL; poll to FINISHED; give APK link.~~ ✅ FINISHED — APK handed to user.

## Notes
- Mobile/ unchanged since build #1 (Fase 4b/4c were server-side) — build #2 is the FIRST with real mobile UI changes.
- Do NOT build new features (master-data CRUD / aset create = Fase 8).

## Deviations (role-gate only — cannot scope)
- assets/[id] (Asset has no branchId/unitType); reports/financial (neraca org-wide, filter breaks balance); payroll periods (PayrollPeriod has no branchId).

## Notes
- 2 routes already had gates (audit was slightly off): members/[id]/piutang + batches — just add scope.
- payroll slip already anggota-self-scoped — add staff gate + branch check.
- Re-run scripts/diagnose-mobile-staff-null-scope.ts before deploy (fail-closed list filters too).

---

# Fase 6 — Mobile Piutang Gabungan

Plan: docs/superpowers/plans/2026-07-03-mobile-piutang-gabungan.md
Spec: docs/superpowers/specs/2026-07-03-mobile-piutang-gabungan-design.md
Started from BASE: fff8a818 (plan commit)
Model plan: T1/T2 helpers = sonnet (TDD, decimal/CSV edge nuances); T3/T4 API = sonnet; T5 screen = sonnet (largest); T6 nav = haiku (mechanical); reviewers = sonnet; final = opus.

## Tasks
- [x] T1: aggregatePiutangGabungan helper + tests (TDD) — complete (fff8a818..da79d824, review clean; 9/9 tests, Decimal-safe num())
- [x] T2: buildPiutangCSV + tests (TDD) — complete (da79d824..d2f9b85b, review clean; 12/12 tests, cell() on all 10 cols)
- [x] T3: list API GET /reports/piutang-gabungan + ?format=csv — complete (d2f9b85b..df338101, review clean). Low notes (non-blocking, for final triage): L1 empty-members early-return omits `pagination` meta (screen handles [] defensively anyway); L2 totalAnggota = members-with-piutang by design (matches web).
- [x] T4: detail API GET /[memberId] — complete (df338101..b70d8a61, review clean; await params + helper-reuse totals parity verified). Low: `as any` casts on Prisma nested-schedules type (cosmetic).
- [x] T5: LaporanPiutangGabunganScreen (list+cards+search+drill-down+export) — complete (b70d8a61..f4bba916 + fix f41df4e8, re-review clean). CRITICAL fix: screen had wrong API field names/envelope (rendered zeros) + list payload lacked member `id` (drill-down undefined). Fix: added `id` to PiutangItem (helper+test) + corrected all screen field reads to match T3/T4 contracts. SDK-55 expo-file-system File/Paths API (writeAsStringAsync deprecated). 12/12 tests, 0 console.*.
- [x] T6: nav wiring (App.tsx + Dashboard menu gate) — complete (f41df4e8..bf21554c, review clean; route-name byte-identical, gate operator/admin_sp excludes kasir+admin).

## After T1-T6 → final opus review + push — ✅ DONE + DEPLOYED
Final opus review APPROVED (all 6 task reviews clean; 1 Critical in T5 fixed in f41df4e8). Tests 439 pass / 3 pre-existing (baseline 427 + 12 new piutang-gabungan). Pushed `c4ce3f3c..bf21554c` (Railway auto-deploy: 2 new mobile API endpoints LIVE). **Mobile screen ships via EAS build #3** (in flight). Deferred (all non-blocking): T3 empty-path pagination meta, T4 `as any` Prisma casts, T6 icon reuse, `?export=true` JSON branch dead-but-web-parity.

## EAS build #3 — ✅ FINISHED
Bump `618fe528` (v1.1.4/vc5) pushed. First submission FAILED (ECONNRESET mid-upload of 785MB archive). Root cause: `mobile/android/` = 2.4GB stale `expo run:android` artifacts (.gradle/.cxx/build cache) — gitignored + in .easignore but leaked into tarball. Fix: `rm -rf mobile/android/` (0 tracked files, regenerable, not needed by managed build) → archive 785MB→123MB, upload 5min→2m51s. Build ID `d88002dc-dfee-451b-a768-eb3f33016cb0`, status FINISHED. **APK:** `https://expo.dev/artifacts/eas/PNFETl78t7uW8PtEcvY8D4YAuma3sEfSLzWkN-RnOYw.apk` (queue ~9min + build ~21min — faster than build #2). Ships Fase 5 + Fase 6 screens. ⚠ For FUTURE EAS builds: delete mobile/android/ first (re-bloats after expo run:android).
Bump `618fe528` (v1.1.4/vc5) pushed. **First submission FAILED** (ECONNRESET mid-upload of 785MB archive). Root cause: `mobile/android/` = **2.4GB stale build artifacts** (`expo run:android` .gradle/.cxx/build cache) — gitignored + in .easignore but still leaked into the tarball (build #2 squeaked through at 785MB, #3 didn't). **Fix: `rm -rf mobile/android/`** (0 tracked files, regenerable via `expo prebuild`, not needed by managed production build). Archive dropped 785MB→123MB, upload 5min→2m51s. **Build ID:** `d88002dc-dfee-451b-a768-eb3f33016cb0` — page https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/d88002dc-dfee-451b-a768-eb3f33016cb0 . Poller `bgxyg4z9i`. ⚠ For FUTURE EAS builds: delete/regenerate mobile/android/ before building (or it re-bloats). Ships Fase 5 + Fase 6 screens.

---

# Fase 7a — Mobile Kas/Bank Create + Transfer

Plan: docs/superpowers/plans/2026-07-03-mobile-kas-bank-create.md
Spec: docs/superpowers/specs/2026-07-03-mobile-kas-bank-create-design.md
Started from BASE: 919c504c (plan commit)
Model plan: T1 helper = sonnet (TDD crypto); T2/T3 API = sonnet (money-integrity); T4 screens = sonnet; T5 nav = haiku; reviewers = sonnet; final = opus.

## Tasks
- [x] T1: cash-bank-txn-no.ts crypto helper + tests (TDD) — complete (919c504c..d605d101, review clean; 5/5 tests, crypto.randomBytes, 0 Math.random)
- [x] T2: POST /api/mobile/kas-bank/transactions (create) — complete (d605d101..99731cea + fix f9d2b7ed). CRITICAL caught by T3 impl: `if (!canAccessBranch(...))` was INERT (returns ScopeDecision object, always truthy) → branch scope bypassable by admin/admin_sp. Fix: `.allowed`. Audit of all 16 mobile canAccess* call sites confirmed T2 was the ONLY buggy one (Fase 4b/4c all correct).
- [x] T3: POST /api/mobile/kas-bank/transfers — complete (99731cea..6b1dc0dc). 2 CB tx (OUT+IN, category transfer), both accounts canAccessBranch(...).allowed, crypto TRF txnNo, self-transfer+sufficiency guards, $transaction re-read. Impl correctly used `.allowed` (unlike T2's brief form).
- [x] T4: KasBankTransaksiScreen + KasBankTransferScreen — complete (f9d2b7ed..bf3b78b5, review clean; field-contract audit ZERO mismatches vs the 3 route files — Fase 6 T5 Critical did NOT recur; miscat requiresConfirm flow + category hardcode + self-transfer exclusion all correct; 0 console.*; tsc clean).
- [x] T5: KasBankScreen buttons + App.tsx nav — complete (bf3b78b5..4ba3e924, review clean; route names byte-identical, canCreate gate operator/admin/admin_sp excludes kasir via positive allowlist).

## After T1-T5 → final opus review + push — ✅ DONE + DEPLOYED
Final opus review APPROVED-with-minor-followups. **Critical caught + fixed:** T2 `if (!canAccessBranch(...))` was INERT (ScopeDecision object, always truthy) → branch scope bypassable; fixed to `.allowed` (`f9d2b7ed`); audit of all 16 mobile canAccess* sites confirmed T2 was the only one. Tests 444/3 pre-existing (no regression). Pushed `6f0affe7..4ba3e924` (Railway auto-deploy: 2 new POST endpoints LIVE). **Screens ship via EAS build #4** (build BOTH apk+AAB per user — see below). Deferred (non-blocking): web Math.random tech-debt, catch:any, duplicated Account iface, unguarded JSON.parse (all match sibling patterns).

## ✅ EAS build #4 — FINISHED (DUAL APK + AAB)
User requirement: previous builds (#1-3) APK-only → couldn't create Play Store closed-testing release (needs .aab). Bump `8b2ec6ca` (v1.1.5/vc6) pushed. mobile/android/ absent (clean). Both profiles submitted, building in parallel:
- **APK** (profile production): build ID `ed6f5f8b-882d-4646-a5d6-d04a391ad6ea` — https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/ed6f5f8b-882d-4646-a5d6-d04a391ad6ea
- **AAB** (profile store): build ID `94debbc2-ea48-4ec4-bada-ab4fc8ea4973` — https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds/94debbc2-ea48-4ec4-bada-ab4fc8ea4973
Poller `bridus6xe` watches both. On both FINISHED → give user APK link (sideload/smoke) + AAB link (Play Store closed-testing upload via Play Console or `eas submit --profile store`). Ships Fase 5+6+7a screens. Re-poll: `cd mobile && npx eas-cli build:view <ID> --json`.

---

# Fase 7b — Mobile Generic Per-Unit Laporan

Plan: docs/superpowers/plans/2026-07-04-mobile-unit-laporan.md
Spec: docs/superpowers/specs/2026-07-04-mobile-unit-laporan-design.md
Started from BASE: 0b36581f (plan commit)
Model plan: T1 pure helper = sonnet (TDD); T2 web-refactor = sonnet (HIGHEST RISK — behavior-preserving); T3 API = sonnet; T4 screen = sonnet; T5 nav = haiku; reviewers = sonnet; final = opus.

## Tasks
- [x] T1: computePeriodRange pure helper + tests (TDD) — complete (0b36581f..559d004f, review clean; faithful line-by-line port of web WIB period math, 6/6 tests, pure+now-param). **Contract for T2:** callers must validate dateFrom/dateTo presence BEFORE computePeriodRange("custom") (the pure fn returns Invalid Date on missing input; web route's 400 guard moves into getUnitLaporanData/route).
- [x] T2: extract getUnitLaporanData + behavior-preserving web route refactor — complete (559d004f..3e71df47, opus review clean; **web response byte-identical** — all 9 keys + 22 summary fields + formulas + 3 queries + void/piutang filters + pagination faithful; custom-400 preserved as UnitLaporanValidationError; auth unchanged; 3 type-loosenings runtime-neutral). **Contract for T3:** mobile caller must catch UnitLaporanValidationError → 400 (helper pre-validates custom dateFrom/dateTo).
- [x] T3: GET /api/mobile/reports/unit-laporan/[unitType] — complete (3e71df47..e71fce07, review clean; gate .allowed + params Promise + UnitLaporanValidationError→400 catch; slug=unitType fill safe — slug is response-label only, queries use unitType).
- [x] T4: LaporanUnitScreen (full V1 read-only) — complete (e71fce07..fb8a1795, review clean; field-contract audit ZERO mismatches vs getUnitLaporanData — Fase 6 T5 Critical did NOT recur; keys off unitType not unitSlug; F&B/cuci/store conditionals + infinite scroll + period chips + collapsible ops; 909 lines, 0 console.*, tsc clean). Minor (final triage): unused useRef/SafeAreaView imports.
- [x] T5: nav wiring (App.tsx + Dashboard menu) — complete (fb8a1795..e5acbd01, review clean; route-name byte-identical, gate operator/admin/admin_sp positive allowlist excludes kasir, tsc clean).

## After T1-T5 → final opus review + push — ✅ DONE + DEPLOYED
Final opus review APPROVED. **Web behavior-preservation CONFIRMED** (the #1 risk — web `/unit/[slug]/laporan` response byte-identical after T2 extraction; no later task touched the helper/route). RBAC end-to-end `.allowed` verified; screen↔helper field contract clean; backward compat intact (broken `/api/mobile/reports/unit` + Cuci screen untouched). Tests 450/3 pre-existing (baseline 444 + 6 unit-laporan). Pushed `8b2ec6ca..e5acbd01` (Railway auto-deploy: mobile API + web refactor LIVE). **Screen ships via EAS build #5.** Deferred (cosmetic): T1 periodLabel host-tz quirk (preserved), T4 unused useRef/SafeAreaView imports + default unit toko, T5 menu color reuse.

---

# Fase 8a — Mobile Aset CRUD

Plan: docs/superpowers/plans/2026-07-04-mobile-aset-crud.md
Spec: docs/superpowers/specs/2026-07-04-mobile-aset-crud-design.md
Started from BASE: 0949ef44 (plan commit)
Model plan: T1 endpoints = sonnet; T2 form+FAB+nav = sonnet; T3 detail actions = sonnet; reviewers = sonnet; final = opus.

## Tasks
- [x] T1: PUT/DELETE /assets/[id] + POST /[id]/dispose — complete (0949ef44..0ffed9be, review clean; GET detail preserved, POST create untouched, gates/audits/bookValue-recompute all correct). **Low for final triage:** L1 PUT/DELETE/dispose not wrapped in $transaction (audit-orphan risk; create POST uses $transaction — consistency follow-up); L2 PUT allows editing disposed asset (policy gap).
- [x] T2: AsetFormScreen (create+edit) + list FAB + App.tsx nav — complete (0ffed9be..d2089ee3, review clean; field-contract audit ZERO mismatches vs POST/PUT/GET routes — Fase 6 T5 Critical did NOT recur; live bookValue preview; route-name byte-identical; FAB gate operator/admin/admin_sp; 0 console.*; tsc clean).
- [x] T3: AsetDetail edit/dispose/delete actions — complete (d2089ee3..29269d65, review clean; contract audit CLEAN — Edit nav assetId matches AsetForm, dispose body + DELETE exact; hide-when-disposed + Disposed badge + refresh-after-dispose + delete-confirm; gate operator/admin/admin_sp; 0 console.*; tsc clean).

## After T1-T3 → final opus review + push — ✅ DONE + DEPLOYED
Final opus review APPROVED. All field contracts clean (form↔POST/PUT/GET; detail↔dispose/DELETE; assetId consistent); RBAC end-to-end (operator/admin/admin_sp, kasir excluded); existing POST+GET preserved; web `/api/aset/*` untouched; money-integrity low (non-ledger). Tests 450/3 pre-existing (no new tests — mechanical CRUD). Pushed `e5acbd01..29269d65` (Railway auto-deploy: 3 new endpoints LIVE). **Screens ship via EAS build #5.** Deferred: T1-L1 $transaction consistency (mobile already stricter than web — web has NO audit at all; Asset non-ledger → audit-orphan not balance-corruption; precedent members/import); T1-L2 PUT-on-disposed server guard (client hides Edit when disposed); cosmetic catch:any/useMemo (match conventions).

---

# Fase 8b — Mobile Loan Edit (HIGHEST money-integrity fase)

Plan: docs/superpowers/plans/2026-07-04-mobile-loan-edit.md
Spec: docs/superpowers/specs/2026-07-04-mobile-loan-edit-design.md
Started from BASE: 5496ceed (plan commit)
Model plan: T1 pure recalc = sonnet (TDD); T2 applyLoanEdit+web-refactor = sonnet (HIGHEST RISK — behavior-preserving, money-critical); T3 mobile route = sonnet; T4 screen = sonnet; T5 nav = haiku; reviewers = sonnet; final = opus.

## Tasks
- [x] T1: recalcLoanFinancials pure helper + tests (TDD) — complete (5496ceed..9e9a947d, review clean; faithful line-by-line port of web PUT 148-167 incl round/floor divergence + addMonths from @/lib/date-helpers; 9/9 tests). **Contract for T2:** recalc THROWS LoanEditValidationError on the 6 business-rule violations (incl over-payment — web rejects, doesn't clamp). applyLoanEdit must call recalc inside try/catch→400 + NOT re-validate (avoid duplicating guards). Persist lateFeePaid from loan record (pass-through) + interestOutstanding (web route.ts:202 DOES persist it).
- [x] T2: applyLoanEdit shared helper + behavior-preserving web PUT refactor — complete (9e9a947d..a7071341, opus review clean). **Money path BYTE-IDENTICAL** (15-field loan.update + schedule regen + formulas + audit + message + changes all verbatim). recalc owns the 6 numeric guards (zero duplication/drift); lateFeePaid from loan record + interestOutstanding persisted. **One drift (defer):** missing-loan 404→400 (applyLoanEdit throws LoanEditValidationError for not-found → route maps 400; message preserved; brief-sanctioned; non-money error path). **Contract for T3:** mobile route catches LoanEditValidationError→400 for ALL cases incl not-found (mobile UI branches on message, not status).
- [x] T3: mobile GET + PUT /loans/[id] — complete (a7071341..a5e367b1, review clean; GET detail + PUT edit, gate operator/admin_sp + canAccessBranch(.allowed), applyLoanEdit shared (money path byte-identical w/ web), LoanEditValidationError→400, mobile audit after edit, params Promise, Decimal→Number; tsc clean).
- [x] T4: LoanEditScreen + DaftarPinjaman edit entry — complete (a5e367b1..8fb1f8c4, review clean; field-contract audit ZERO mismatches both directions (GET pre-fill + PUT body) — Fase 6 T5 lesson held; change-detection disables submit when unchanged; no live preview (reads response monthlyInstallment, no duplicated money math); DaftarPinjaman Edit on active loans + operator/admin_sp; 0 console.*; tsc clean). Minor: toast omits multi-line changes summary (RN truncation; monthlyInstallment shown).
- [x] T5: nav wiring — complete (8fb1f8c4..59146d42, review clean; route name LoanEdit byte-identical App.tsx↔DaftarPinjamanScreen; tsc clean).

## After T1-T5 → final opus review + push — ✅ DONE + DEPLOYED
Final opus review APPROVED — PUSH SAFE. **Money path BYTE-IDENTICAL** (line-by-line: 15-field loan.update + schedule regen + formulas + audit + response, all verbatim; the round/floor divergence preserved). recalcLoanFinancials is the single source for math (17/17 tests); applyLoanEdit is the single source for the $transaction regen — web + mobile both call them (DRY, zero duplicated money formulas). Mobile PUT gate operator/admin_sp + canAccessBranch(.allowed) (stricter than web). Tests 459/3 pre-existing (baseline 450 + 9 recalc). Pushed `29269d65..59146d42` (Railway auto-deploy: mobile route + web PUT refactor LIVE). **Screen ships via EAS build #5.** Deferred (all 6 agree-defer): 404→400 missing-loan (non-money error path, message preserved), applyLoanEdit unused userId, LoanEditResult any-types, $transaction-doesn't-wrap-audit (pre-existing latent), recalc-throws-validation (design choice, tested), toast omits multi-line changes (RN truncation).

---

# Fase 8c — Mobile Payroll Import (P0 money-moving, biggest monthly op)

Plan: docs/superpowers/plans/2026-07-05-mobile-payroll-import.md
Spec: docs/superpowers/specs/2026-07-05-mobile-payroll-import-design.md
Started from BASE: 65a8f8c0 (plan commit)
Model plan: T1 helpers = sonnet; T2 web-refactor = sonnet (HIGHEST RISK — behavior-preserving, money-critical 440-line); T3 mobile routes = sonnet; T4 screen = sonnet; T5 nav = haiku; reviewers = sonnet; final = opus.

## Tasks
- [x] T1: parsePayrollExcel + commitPayrollPeriod shared helpers — complete (`eeb4235c`, then amended `4c5e21cd` for existingPeriodId). Faithful verbatim move of web route parse (~146-309) + commit (~347-414) + keyword dicts + utils.
- [x] T2: web import route refactor (behavior-preserving) — complete (`4c5e21cd`, 445→115 lines). **Opus behavior-preservation review APPROVED** (byte-identical: parse/commit faithful, route responses 13+6 keys byte-identical, 400/409/500 status+messages preserved, auth unchanged). 2 faithfulness drifts caught in controller audit + confirmed correct by reviewer: (1) 409 `existingPeriodId` preserved via PayrollImportError.existingPeriodId; (2) commit response `failed` reads `parsed.counts.failed` (skippedRows) NOT helper's `failed:0`. Tests 459/3 pre-existing (no regression); tsc clean.
- [x] T3: mobile POST /payroll/import + delete — complete (`6a6664d2`, review clean). 2 routes: import (multipart/form-data, first mobile File-upload route, response shapes byte-identical to web, PayrollImportError→400/409+existingPeriodId, audit prisma.auditLog.create non-blocking) + delete (POST {periodId}, cascade, sisaGaji NOT reset, P2025→404). Operator-only, getMobileUserWithScope. tsc clean.
- [x] T4: PayrollImportScreen + GajiPeriode import/delete — complete (`db461704`, review clean). 3-step screen (pick→preview→commit) mirroring ImportDataScreen pinjaman multipart pattern; field-contract audit ZERO mismatches vs T3 routes (Fase 6 lesson held); 5-min per-request timeout (axios override, api.ts unchanged); 0 console.*. GajiPeriode: operator-only Import button (header) + Delete per card (confirm, notes sisaGaji NOT reset). tsc clean.
- [x] T5: nav wiring — complete (`4787fd30`, review clean). Route name "PayrollImport" byte-identical App.tsx↔GajiPeriodeScreen. tsc clean.

## After T1-T5 → final opus review — ✅ APPROVED
Final opus whole-branch review APPROVED. All 10 sections clean (operator-only gate, screen↔route field contract — Fase 6 lesson held, multipart FormData, 5-min timeout, PayrollImportError mapping, sisaGaji parity, route-name match, DRY, hygiene, money-integrity). 2 Minor deferred: M1 duplicate-commit race → generic 500 (pre-existing in web, parity; DB unique constraint guards real corruption), M2 screen trusts upstream nav gate (API enforces regardless). Commits `65a8f8c0..4787fd30`. **EAS build #5 in flight** (ships Fase 7b+8a+8b+8c screens + mobile URL hotfix).

## After T1-T5 → final opus review (web import behavior-preservation = #1 check; parsing/matching moved verbatim) + push (mobile routes + web refactor deploy; screen → EAS build #5)
**Note:** no unit test anchor (parsing is XLSX/DB-bound) — the opus behavior-preservation audit is the guard. Open items: mobile DELETE-with-body vs POST/delete; api.ts per-request timeout (5-min for imports); fixture Excel for a smoke test.

---

# Fase 9a.1 — Mobile Haji/Umrah Tabungan Core

Plan: docs/superpowers/plans/2026-07-06-mobile-haji-umrah-tabungan.md
Spec: docs/superpowers/specs/2026-07-06-mobile-haji-umrah-tabungan-design.md
Started from BASE: (plan commit — T1 dispatch base recorded at dispatch)
Model plan: T1 helpers = sonnet (verbatim extraction, money-critical); T2 web-refactor = sonnet (HIGHEST RISK behavior-preserving); T3/T4 mobile routes = sonnet; T5/T6/T7 screens = sonnet; reviewers = sonnet; final = opus.

## Tasks
- [ ] T1: processHajiUmrahDeposit + createHajiUmrahAccount shared helpers
- [ ] T2: web setoran + buka-rekening refactor (behavior-preserving)
- [ ] T3: mobile read routes (list/detail/products)
- [ ] T4: mobile write routes (setoran + buka-rekening)
- [ ] T5: HajiUmrahScreen + dashboard nav
- [ ] T6: HajiUmrahDetail + Setoran screens
- [ ] T7: BukaRekening screen + App.tsx wiring

## After T1-T7 → final opus review + push
#1 check: web setoran + buka-rekening behavior-preservation (byte-identical, $transaction verbatim — categories/unitTypes/balanceBefore-After exact). Then push (web refactor + 5 mobile routes deploy; 4 screens → EAS build #6).

## T1+T2 complete — opus behavior-preservation review APPROVED
- T1: helpers (`06b95ee3`) — processHajiUmrahDeposit + createHajiUmrahAccount verbatim from web routes. Controller spot-checked $transaction byte-identical.
- T2: web route refactor (`52f81bdf`) — routes call helpers. **Opus review APPROVED**: 6/6 sections clean ($transaction char-for-char, all 7 error messages char-exact, GET handlers byte-identical, auth preserved, meta verbatim, no collateral damage). Pre-existing tsc cast (session.user as Record) verified NOT a regression via stash@base 3d338901. Tests 459/3 pre-existing. 1 Minor cosmetic (DepositResult.transaction typed any).
- BASE 3d338901 (plan) → HEAD 52f81bdf. Money-core safe to share with mobile (T4).

## T3-T7 complete + final opus review APPROVED + PUSHED
- T3 (`f91e5974`): 3 mobile read routes (list/detail/products) mirroring web. + security fix `914dba05` (staff role gate — closed member-token data leak flagged by background review).
- T4 (`844ec6ff`): 2 mobile write routes (setoran + buka-rekening/open). RBAC operator OR admin-haji_umrah (DB-sourced unitType), call helpers, non-blocking audit.
- T5 (`927fd3c1`): HajiUmrahScreen (list) + DashboardScreen nav entry.
- T6 (`809d8614`): HajiUmrahDetailScreen + HajiUmrahSetoranScreen.
- T7 (`e2c6b198`): HajiUmrahBukaRekeningScreen + App.tsx 4-route wiring.
- **Final opus review APPROVED** (8/8 sections clean: web behavior-preservation re-confirmed, RBAC airtight, ALL 4 screen↔route field contracts correct — Fase 6 trap avoided, route-names byte-identical, money via helpers, hygiene clean). 3 non-blocking notes (N1 pre-existing cashAccount-branch gap = web parity; N2/N3 minor UX). Tests 459/3 pre-existing.
- **Pushed `4787fd30..e2c6b198`** (Railway deploys web refactor + 5 mobile routes). 4 screens ship via EAS build #6 (pending user request — build #5 still in flight).

---

# Mobile QA Audit-Readiness (2026-07-18)

Plan: docs/superpowers/plans/2026-07-18-mobile-qa-strategy.md
Spec: docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md
Branch: railway-migration

## Completed
- Phase A (A0-A8): static audit complete (`c39f74ec..89c649fb`, 8 commits). Found 12 items (0 Critical, 9 High). Artifacts in `qa/mobile-qa/static/`.
- Phase B: baseline + cleanup gate + read-only RBAC/API matrix complete (`560302c2..d7eb92da`). Production GET matrix 20 routes × 6 accounts; unit isolation + anggota self-scope verified. No financial mutation.
- Safe High remediation: `74a73ae0`, deployed. Fixed 8 High + 1 Medium: Aset refresh crash, Piutang Gabungan path 404, 4 mobile JWT mirror routes replacing cookie-auth force-logout calls, H&U Talangan stats, Loan Apps pagination, audit trail on 4 money routes. Verification: 10/10 tests, mobile tsc clean, build success, full suite 469 pass / 3 pre-existing; independent review approved.
- Live API read-only smoke after deploy: Arus Kas 200, Faktur Potongan 200, Loan Applications pagination 200, Member Piutang Barang 200, Member Transactions 200.
- Release: v1.1.8/vc10 at `a4802c47`; APK+AAB EAS builds FINISHED. APK ID `7570143e-6be8-405a-bb2d-784caaa2413b`, AAB ID `2ad906b0-41a4-40b1-ba28-ad24268b7f69`.

## Pending / resume
- Phase C physical Android read-only smoke using `qa/mobile-qa/device/smoke-checklist.md`; record in `device-findings.md`.
- Phase D exit report remains conditional until device smoke. Current `qa/mobile-qa/report/exit-criteria.md` documents blockers.
- Remaining High: systemic idempotency for money mutations; requires separate schema-backed Idempotency-Key design. Do not live double-submit test production.
- Kasir coverage pending because no usable credential in `akun-primkoppol.md`; user ID 731 known only.
- AAB upload to Play Store closed testing is outward-facing and requires explicit user approval.
