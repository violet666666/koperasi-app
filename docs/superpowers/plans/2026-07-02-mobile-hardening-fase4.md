# Mobile Hardening — Fase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). Mechanical hardening — each task is small + verifiable via typecheck/tests (no new feature logic).

**Goal:** Clear the Tier-2 mobile drift findings — `Math.random`→crypto (CRITICAL scanner), stale role tokens, missing `cafe_lsp` in POS, payment-method label, void filters, payroll gate, NRP-login fallback — so the mobile API matches web's hardening posture before the first EAS build.

**Architecture:** Grouped mechanical fixes (no new pure logic). Each task = 1-3 files, precise edits, typecheck + (where applicable) test verification. RBAC unit/branch scoping is OUT of this plan (Fase 4b — needs its own spec; systemic across ~20 routes + role-scope rules).

**Tech Stack:** Next.js 16 route handlers, Expo 55 / RN, `crypto.randomBytes`.

## Global Constraints

- **Branch:** `railway-migration` — auto-deploys on push. Batch (don't push per-task).
- **Do NOT stage non-mine files:** `.claude/settings.local.json`, `mobile/app.json`.
- **Transaction numbers MUST use `crypto.randomBytes()`** — pattern `crypto.randomBytes(4).readUInt32BE(0) % 1_000_000` (CLAUDE.md rule; scanner flags `Math.random` CRITICAL).
- **Roles:** only `operator` (manage_all), `admin` (unit-scoped), `admin_sp` (SP), `kasir` (POS). NO `superadmin`/`admin_unit`/`super_admin` — any reference is stale.
- Pre-existing tsc/fail not regressions. Tests: `npx vitest run` / `npm run test`. Typecheck: `npx tsc --noEmit` (web) + `cd mobile && npx tsc --noEmit` (mobile).

---

### Task 1: Math.random → crypto (CRITICAL) — 3 mobile routes

**Files:**
- Modify: `src/app/api/mobile/loans-operator/kompen-disburse/route.ts` (lines ~147, 163, 180)
- Modify: `src/app/api/mobile/loans-operator/direct-disburse/route.ts` (line ~9, applicationNo)
- Modify: `src/app/api/mobile/journals/route.ts` (line ~117, journal number)

- [ ] **Step 1:** In each file, replace every `Math.floor(Math.random() * N)` used for a transaction/reference number with the crypto pattern. Add `import crypto from "crypto";` at top if not present.
  - kompen-disburse: 3 CashBank `transactionNo` values (`KK-…/PRIM/…`, `KM-…/PRIM/…`, `KM-…-P/PRIM/…`) — replace the `Math.floor(Math.random()*10000).toString().padStart(4,"0")` segment with `(crypto.randomBytes(4).readUInt32BE(0) % 10000).toString().padStart(4,"0")` (keep prefix/format identical).
  - direct-disburse: `applicationNo` Math.random → crypto.
  - journals: `JU/ADJ/${Date.now()}-${Math.floor(Math.random()*1000)}` → replace Math.random segment with crypto; also consider sequential journal number if web does (check web `api/jurnal`).
- [ ] **Step 2:** Verify no remaining `Math.random` in these 3 files: `grep -n "Math.random" src/app/api/mobile/loans-operator/kompen-disburse/route.ts src/app/api/mobile/loans-operator/direct-disburse/route.ts src/app/api/mobile/journals/route.ts` → no hits.
- [ ] **Step 3:** `npx tsc --noEmit` → no NEW errors.
- [ ] **Step 4:** Commit: `fix(mobile): replace Math.random txn numbers with crypto.randomBytes (CRITICAL scanner)`

---

### Task 2: Stale role tokens cleanup

**Files:**
- Modify: `mobile/src/navigation/MainTabs.tsx` (line 43)
- Modify: `mobile/src/lib/useIdleLogout.ts` (line 33)
- Modify: `mobile/src/screens/operator/MasterDataHubScreen.tsx` (line ~120, UI copy)

- [ ] **Step 1:** `MainTabs.tsx:43` — change `const isOperator = ['operator', 'admin', 'superadmin', 'admin_unit', 'admin_sp'].includes(role);` → drop dead tokens: `['operator', 'admin', 'admin_sp']` (verify `admin_sp` is intended operator-tier; per CLAUDE.md role table, yes).
- [ ] **Step 2:** `useIdleLogout.ts:33` — same array, same fix.
- [ ] **Step 3:** `MasterDataHubScreen.tsx:120` — UI copy mentions "superadmin"; reword to "operator" (read the line, replace the word in copy only).
- [ ] **Step 4:** `cd mobile && npx tsc --noEmit` → no NEW errors.
- [ ] **Step 5:** Commit: `chore(mobile): remove stale superadmin/admin_unit role tokens`

---

### Task 3: Client UI — cafe_lsp in POS + payment-method label

**Files:**
- Modify: `mobile/src/screens/kasir/KasirScreen.tsx` (lines 39-48, UNIT_TYPES)
- Modify: `mobile/src/screens/common/DashboardScreen.tsx` (line ~340, paymentMethod label)

- [ ] **Step 1:** `KasirScreen.tsx` UNIT_TYPES (hardcoded ~8 units) — add `cafe_lsp` (confirm label vs web `UNIT_TYPES` in `src/lib/constants/units.ts`: "Cafe LSP"). Keep ordering consistent. (Do NOT add `haji_umrah` — it's non-POS.)
- [ ] **Step 2:** `DashboardScreen.tsx:340` — `sale.paymentMethod === "cash" ? "Tunai" : "Kredit"` → 3-way: a `paymentLabel = { cash: "Tunai", qris: "QRIS", lainnya: "Lainnya" }` map with fallback "Lainnya". (Check `EditNrpScreen`/`RiwayatKasirScreen` for an existing `paymentLabel` map to reuse — if present, import/share it.)
- [ ] **Step 3:** `cd mobile && npx tsc --noEmit` → no NEW errors.
- [ ] **Step 4:** Commit: `fix(mobile-ui): add cafe_lsp to POS unit selector + 3-way paymentMethod label`

---

### Task 4: Server gates/filters

**Files:**
- Modify: `src/app/api/mobile/payroll/route.ts` (line 10) + `src/app/api/mobile/payroll/[periodId]/route.ts` (line 14) — role gate → operator-only (mirror web `api/payroll/route.ts:51`).
- Modify: `src/app/api/mobile/loans/route.ts` + `src/app/api/mobile/loans-operator/route.ts` (line ~65 groupBy) — add `status: { not: "voided" }` to loan queries (exclude voided from list + stats).
- Modify: `src/app/api/mobile/toko/history/route.ts` (line 250) — push-notification target role array: drop stale `admin_unit` → `["operator", "admin"]`.
- Modify: `src/app/api/mobile/login/route.ts` (line ~56) — add password==NRP fallback (mirror web `auth.ts`): if `user.password` bcrypt compare fails AND the member's NRP matches the password, allow (auto-provisioned member). Read web `src/lib/auth.ts` NRP-login logic to mirror exactly.

- [ ] **Step 1:** Apply each edit (read each file's current code first to match exactly; mirror the cited web reference).
- [ ] **Step 2:** `npx tsc --noEmit` → no NEW errors. `npm run test` → only pre-existing fail.
- [ ] **Step 3:** Commit: `fix(mobile-api): payroll operator-only + loan void filter + drop admin_unit + NRP-login fallback`

---

### Task 5 (Fase 4b — DEFERRED, needs own spec): RBAC unit/branch scoping

**NOT in this plan.** Security hook flagged 3 routes (loan-payment, savings-tx, loan-payment-void) for missing per-loan/member/branch authorization — systemic across ~20 mobile routes, parity with web. Needs a structured spec:
- Define role→scope rules (operator=manage_all bypass; admin→unitType; admin_sp→SP/simpan_pinjam; kasir→POS).
- A reusable helper `assertMobileUserScope(user, { branchId?, unitType? })`.
- Apply across all mobile operator routes.
This is its own brainstorm→spec→plan cycle. Track separately; do NOT rush into Fase 4 mechanical plan.

---

## Self-Review (controller notes)

- **Coverage:** Tasks 1-4 cover all Tier-2 mechanical findings from the audit. RBAC scoping (Task 5/Fase 4b) explicitly deferred with rationale.
- **Priority:** Task 1 (Math.random) is CRITICAL (security scanner) — do first.
- **Risk:** Task 4 NRP-login fallback must mirror web `auth.ts` exactly (read it). Task 4 payroll gate narrowing could break admin payroll access — verify web is operator-only first (`api/payroll/route.ts:51`).
- **No TDD needed** (mechanical edits) — verification = typecheck + grep (no Math.random) + test suite no-regression. Per-task review still applies (spec + quality).
- **EAS build** follows after Fase 4 (all mechanical) lands — bump `mobile/app.json` versionCode (verify non-mine edit first), `cd mobile && npx eas build --platform android --profile production`.
