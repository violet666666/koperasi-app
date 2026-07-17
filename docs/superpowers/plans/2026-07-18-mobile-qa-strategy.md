# Mobile QA Audit-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete, reviewable QA audit package for `mobile/` + `src/app/api/mobile/**` — risk register, coverage matrix, static findings, API contract checks, device smoke procedure, cleanup tooling, and exit-criteria report — without mutating production data unless an explicit per-batch gate is approved.

**Architecture:** Four sequential layers (A static → B API automation read-only-first → C Android device → D 4-point reconciliation). Each task produces one committed artifact under `qa/mobile-qa/`. Production mutations are forbidden by default; mutation tasks are gated behind an explicit user-approval checkpoint and use manifest + baseline + void/reversal cleanup + baseline re-verification.

**Tech Stack:** Next.js 16 / Prisma 6 / Neon PostgreSQL / Expo 55 / RN 0.83 / Vitest / Playwright (web oracle) / `tsx` diagnostic scripts (repo pattern) / EAS.

## Global Constraints

- **No production mutation without explicit user approval per batch.** Default every action to read-only.
- **Target environment:** production `primkoppol.site` + Neon production DB. No separate UAT database exists; treat prod as prod.
- **Cleanup method:** void/reversal to zero impact via existing APIs (not hard-delete) for ledger-affecting artifacts; hard-delete only for non-ledger test artifacts with CSV backup.
- **Roles in scope:** `operator`, `admin` (unit-scoped), `kasir` (POS-scoped), `anggota` (self). `admin_sp` is legacy/dormant — treat as negative-test only; removal is out of scope (separate remediation).
- **Transaction numbers:** `crypto.randomBytes()` only (repo rule). Any `Math.random` found in audit = finding, do not introduce.
- **No `SP-IMP/*` loans in CashBankTransaction** (corrupts BRI balance — memory `feedback-no-import-in-cashbook`).
- **No new dependencies.** Use `tsx`, existing Prisma client, existing axios client.
- **Manifest format:** single `qa/mobile-qa/manifests/<session-id>.json` capturing time, role, route, recordId, marker, baseline, cleanup status per mutation.
- **Baseline metrics** (the reconciliation anchor — Task H1 finalizes the exact query list): Simpanan Pokok/Wajib/Sukarela totals, CashBankAccount balances (BRI + others), total loan receivables, stock per unit, ledger asset/liability totals, running-period SHU/pendapatan/beban, count voided test rows.
- **Forbidden in production:** chaos/race/double-tap hammering, replay storms, bulk import, period close/tutup buku, settlement, large nominal, mutating real member accounts.
- **Commit convention:** `docs(qa): ...` for artifacts, `chore(qa): ...` for tooling.
- **Do not stage** `.claude/settings.local.json`, `.remember/logs/*`, `mobile/app.json` (non-mine), or any file under `mobile/android/`.
- **Spec source of truth:** `docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md`.

---

  static/
    eas-and-auditlog-audit.md      # T-A8 — EAS config + audit-log consistency (R7/R8)
    findings-layer-a.md            # T-A1 — static audit findings register

All artifacts live under `qa/mobile-qa/` (new, gitignored from prod build — Next.js does not route it; it is docs/scripts only).

```
qa/mobile-qa/
  plans/
    execution-checklist.md          # T-A0 — ordered runbook for the user
  static/
    findings-layer-a.md             # T-A1 — static audit findings register
    tsconfig-mobile-gate.md         # T-A2 — tsc mobile gate result
    eslint-mobile-gate.md          # T-A3 — eslint mobile gate result
    role-gate-audit.md             # T-A4 — RBAC gate audit (client+server)
    idempotency-audit.md           # T-A5 — idempotency surface audit
    contract-audit.md              # T-A6 — screen↔API field contract audit
    progress-recon.md              # T-A7 — progress-update-mobile-app.md vs code
    eas-and-auditlog-audit.md      # T-A8 — EAS config + audit-log consistency (R7/R8)
  api/
    baseline-snapshot.json          # T-H1 — pre-session aggregate metrics
    rbac-matrix.md                  # T-B1 — RBAC read-only test results
    contract-snapshots/             # T-B2 — web vs mobile response diffs
    idempotency-results.md          # T-B3 — idempotency audit results
  device/
    smoke-checklist.md              # T-C1 — per-role device smoke steps
    device-findings.md              # T-C2 — device test findings
  manifests/
    <session-id>.json               # per mutation session (template T-G1)
  scripts/
    baseline-snapshot.ts            # T-H1 — read-only aggregate snapshot
    cleanup-rehearse.ts             # T-G2 — dry-run cleanup runner (pattern from cleanup-hu-test-residue.ts)
    reconcile-metrics.ts            # T-D1 — compare post-cleanup to baseline
  report/
    exit-criteria.md                # T-D2 — final sign-off report
```

Responsibilities: each file one concern. Scripts are read-only by default; only `cleanup-rehearse` writes, and only with `--apply` flag (dry-run default). `baseline-snapshot.ts` is the single source of truth for "what state prod was in before we touched it."

---

## Phase A — Static Audit (zero production risk)

### Task A0: Scaffold QA workspace + execution checklist

**Files:**
- Create: `qa/mobile-qa/plans/execution-checklist.md`
- Create: `qa/mobile-qa/.gitignore` (if Next.js would try to route — it won't, but be explicit)

**Interfaces:**
- Produces: the ordered runbook index + the directory layout all later tasks write into.

- [ ] **Step 1: Create directory scaffold**

Run:
```bash
mkdir -p qa/mobile-qa/{plans,static,api/contract-snapshots,device,manifests,scripts,report}
```
Expected: directories created (no error).

- [ ] **Step 2: Write execution checklist**

Write `qa/mobile-qa/plans/execution-checklist.md`:

```markdown
# Mobile QA Execution Checklist

Ordered runbook. Do not skip the production-safety gate before any mutation task.

## Phase A — Static (no data risk)
- [ ] A1 Static findings register scaffold
- [ ] A2 TypeScript mobile gate
- [ ] A3 ESLint mobile gate
- [ ] A4 Role gate audit (RBAC)
- [ ] A5 Idempotency surface audit
- [ ] A6 Contract audit (screen↔API)
- [ ] A7 Reconcile progress-update-mobile-app.md vs code
- [ ] A8 EAS config + audit-log consistency audit

## Pre-mutation gate (REQUIRED before B2/H1-mutation/C-mutation)
- [ ] User explicitly approves mutation batch
- [ ] Baseline snapshot taken (H1)
- [ ] Manifest template ready (G1)
- [ ] Cleanup dry-run rehearsed (G2)

## Phase B — API automation (read-only first)
- [ ] B1 RBAC matrix (read-only, token A → unit B, expect 403)
- [ ] B2 Contract snapshots (web vs mobile, read-only)
- [ ] B3 Idempotency audit (static + 1x approved pair per route max)

## Phase C — Device (Android physical)
- [ ] C1 Per-role smoke checklist
- [ ] C2 Device findings (mutations need same gate as B)

## Phase D — Reconciliation
- [ ] D1 Metric reconciliation (post-cleanup vs baseline)
- [ ] D2 Exit-criteria sign-off report
```

- [ ] **Step 3: Add .gitignore guard**

Write `qa/mobile-qa/.gitignore`:
```
# Keep manifests out of accidental prod probes; snapshots may hold identifiers.
manifests/*.json
api/baseline-snapshot.json
api/contract-snapshots/*.json
!manifests/.gitkeep
```

Create keepers:
```bash
touch qa/mobile-qa/manifests/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/plans/execution-checklist.md qa/mobile-qa/.gitignore qa/mobile-qa/manifests/.gitkeep
git commit -m "docs(qa): scaffold mobile QA workspace + execution checklist"
```

---

### Task A1: Static findings register scaffold

**Files:**
- Create: `qa/mobile-qa/static/findings-layer-a.md`

**Interfaces:**
- Produces: `findings-layer-a.md` — the register Tasks A2–A7 append rows into. Columns fixed here: `ID | Task | Severity (Critical/High/Medium/Low) | File:line | Finding | Evidence | Recommended remediation | Status`.

- [ ] **Step 1: Write register scaffold**

Write `qa/mobile-qa/static/findings-layer-a.md`:

```markdown
# Layer A — Static Audit Findings Register

Source spec: `docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md`.
All Phase A tasks append rows below. Sev scale: Critical (data/money/security) / High (correctness) / Medium (robustness) / Low (polish).

| ID | Task | Sev | File:line | Finding | Evidence | Remediation | Status |
|----|------|-----|-----------|---------|----------|-------------|--------|
|    |      |     |           |         |          |             |        |
```

- [ ] **Step 2: Commit**

```bash
git add qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): scaffold Layer A findings register"
```

---

### Task A2: TypeScript mobile gate

**Files:**
- Create: `qa/mobile-qa/static/tsconfig-mobile-gate.md`
- Modify (local, reversible): `mobile/tsconfig.json` only if it lacks a noEmit-capable config — do NOT change root `tsconfig.json`.

**Interfaces:**
- Consumes: existing `mobile/tsconfig.json`, `mobile/package.json`.
- Produces: a documented tsc result for `mobile/` and any findings row appended to `findings-layer-a.md`.

- [ ] **Step 1: Inspect existing config**

Run:
```bash
cat mobile/tsconfig.json
```
Record contents. Note whether `noEmit` is set and whether `exclude` lists anything.

- [ ] **Step 2: Run tsc on mobile (no config changes)**

Run:
```bash
cd mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | tee ../qa/mobile-qa/static/tsconfig-mobile-gate.md
```
Expected: either 0 errors or a list of errors. Capture verbatim. If the command needs a different invocation (e.g. `--project`), adjust — do not edit source files.

- [ ] **Step 3: Classify errors**

In `tsconfig-mobile-gate.md`, prepend a summary header:

```markdown
# TypeScript Mobile Gate — tsc --noEmit on mobile/

Run: `cd mobile && npx tsc --noEmit -p tsconfig.json`
Date: <fill from git log HEAD>

## Summary
- Total errors: <N>
- Pre-existing (match root known list from CLAUDE.md: api/mobile/toko/shifts/[id], seed-kas-bank-jatim, seed-uat): <count>
- New / mobile-only: <count>

## Findings
<verbatim output above this header>
```

- [ ] **Step 4: Append findings to register**

Append one row per new (non-pre-existing) error to `findings-layer-a.md`:

```
| A2-<n> | A2 tsc | <Sev> | <file>:<line> | <message> | tsc output | Fix type / align with web | Open |
```

- [ ] **Step 5: Commit**

```bash
git add qa/mobile-qa/static/tsconfig-mobile-gate.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A2 — TypeScript mobile gate result"
```

---

### Task A3: ESLint mobile gate

**Files:**
- Create: `qa/mobile-qa/static/eslint-mobile-gate.md`

**Interfaces:**
- Consumes: `eslint.config.mjs`, `mobile/package.json`.
- Produces: documented eslint result for `mobile/`.

- [ ] **Step 1: Run eslint over mobile**

Run:
```bash
npx eslint mobile/src mobile/App.tsx 2>&1 | tee qa/mobile-qa/static/eslint-mobile-gate.md || true
```
Expected: list of lint issues or clean. Capture verbatim. (`|| true` so a non-zero lint exit doesn't abort the capture.)

- [ ] **Step 2: Summary header**

Prepend to `eslint-mobile-gate.md`:

```markdown
# ESLint Mobile Gate

Run: `npx eslint mobile/src mobile/App.tsx`
Date: <HEAD>

## Summary
- Errors: <N>
- Warnings: <N>
- Note: root eslint.config.mjs has no mobile/ override; mobile may use RN-specific rules not configured.

## Findings
<verbatim output>
```

- [ ] **Step 3: Append severe findings to register**

Append rows for errors only (warnings noted in file, not in register unless security-related):

```
| A3-<n> | A3 eslint | <Sev> | <file>:<line> | <rule>: <message> | eslint output | Fix | Open |
```

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/static/eslint-mobile-gate.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A3 — ESLint mobile gate result"
```

---

### Task A4: Role gate audit (RBAC) — static

**Files:**
- Create: `qa/mobile-qa/static/role-gate-audit.md`
- Append: rows to `findings-layer-a.md`

**Interfaces:**
- Consumes: `src/app/api/mobile/middleware.ts`, `src/lib/mobile-auth-scope.ts`, every `src/app/api/mobile/**/route.ts`, `mobile/src/navigation/MainTabs.tsx`, `mobile/src/lib/useIdleLogout.ts`, screen guard blocks.
- Produces: per-route RBAC matrix (role + scope) + list of routes missing gate/scope + `admin_sp` reference inventory.

- [ ] **Step 1: Enumerate all mobile routes**

Run:
```bash
git ls-files "src/app/api/mobile/**/route.ts" | sort > /tmp/mobile-routes.txt
wc -l /tmp/mobile-routes.txt
```
Expected: ~72 routes. Record count.

- [ ] **Step 2: For each route, extract method + gate**

For each route file, read and extract: exported verbs, the role array in the gate, and whether `canAccessBranch`/`canAccessUnit`/`branchListFilter`/`unitListFilter` is applied. Produce a table in `role-gate-audit.md`:

```markdown
# Role Gate Audit — src/app/api/mobile/**

| Route | Verb | Role gate | Scope helper | Notes |
|-------|------|-----------|--------------|-------|
| accounting/journals | POST | operator | none (head-office by design) | branchId hardcoded = 1 (R? existing finding) |
| ... | | | | |
```

Use grep to find gates fast:
```bash
grep -rEn "requireRole|role ===|role.includes|canAccessBranch|canAccessUnit|branchListFilter|unitListFilter|getMobileUser" src/app/api/mobile --include=route.ts
```

- [ ] **Step 3: Audit client-side role gates**

Read `mobile/src/navigation/MainTabs.tsx` and `mobile/src/lib/useIdleLogout.ts`. Confirm role arrays are exactly `['operator','admin','admin_sp','kasir']`-style but flag any `admin_sp` (legacy). Record in the same file under a `## Client gates` section.

- [ ] **Step 4: Inventory admin_sp references**

Run:
```bash
grep -rln "admin_sp" mobile/src src/app/api/mobile src/lib --include="*.ts" --include="*.tsx" | wc -l
grep -rl "admin_sp" mobile/src src/app/api/mobile src/lib --include="*.ts" --include="*.tsx" > /tmp/admin_sp-files.txt
```
Record count (expected ~64 per spec) and list in the audit file. Mark all as `Status: Legacy — negative test only (T-B1), removal out of scope`.

- [ ] **Step 5: Flag gates missing**

For routes with NO role check or NO scope where peer routes have one, append to `findings-layer-a.md`:

```
| A4-<n> | A4 RBAC | High | <route> | <no gate | no scope | admin_sp granted> | grep output | Add gate/scope; remove admin_sp grant | Open |
```

- [ ] **Step 6: Commit**

```bash
git add qa/mobile-qa/static/role-gate-audit.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A4 — RBAC gate audit + admin_sp inventory"
```

---

### Task A5: Idempotency surface audit — static

**Files:**
- Create: `qa/mobile-qa/static/idempotency-audit.md`
- Append: rows to `findings-layer-a.md`

**Interfaces:**
- Consumes: every `src/app/api/mobile/**/route.ts` POST/PUT/PATCH/DELETE.
- Produces: per-mutation-route idempotency classification (has client requestId? has server dedup? relies on UI flag only?).

- [ ] **Step 1: List mutation routes**

```bash
grep -rL "export async function GET" $(git ls-files "src/app/api/mobile/**/route.ts") > /tmp/mutation-routes.txt
wc -l /tmp/mutation-routes.txt
```
Expected: ~31 mutation routes (per spec).

- [ ] **Step 2: Classify each**

For each, grep for idempotency signals:
```bash
grep -rEn "Idempotency|idempoten|requestId|clientRequestId|dedup|upsert|ON CONFLICT" src/app/api/mobile --include=route.ts
```

Build table in `idempotency-audit.md`:

```markdown
# Idempotency Surface Audit

| Route | Verb | Client requestId | Server dedup | UI flag only | Atoms (crypto) | Verdict |
|-------|------|------------------|---------------|--------------|----------------|---------|
| savings-tx | POST | no | part of atomicity | yes | crypto | R1 risk — double-submit possible |
| ... | | | | | | |
```

- [ ] **Step 3: Flag high-risk**

For routes with "UI flag only" + financial impact, append to register:

```
| A5-<n> | A5 idempotency | High | <route> | no dedup, double-submit creates duplicate tx | grep output | Add Idempotency-Key + server dedup | Open |
```

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/static/idempotency-audit.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A5 — idempotency surface audit"
```

---

### Task A6: Contract audit (screen ↔ API) — static

**Files:**
- Create: `qa/mobile-qa/static/contract-audit.md`
- Append: rows to `findings-layer-a.md`

**Interfaces:**
- Consumes: every `mobile/src/screens/**/*.tsx` that calls `api.*` + the route it calls.
- Produces: per-screen list of API fields read vs fields the route response actually returns. Lesson anchor: Fase 6 T5 Critical (screen guessed field → render zeros).

- [ ] **Step 1: Map screen → route**

Run:
```bash
grep -rEn "api\.(get|post|put|patch|delete)\(" mobile/src/screens --include="*.tsx" | grep -oE "/[a-z0-9/_\[\]{}-]+(\/[a-z0-9/_\[\]{}-]+)*" | sort -u > /tmp/screen-routes.txt
wc -l /tmp/screen-routes.txt
```

- [ ] **Step 2: For top-20 screens, compare field usage**

For each high-traffic screen (KasirScreen, SavingsTransactionScreen, LoanPaymentScreen, RiwayatAngsuranScreen, LaporanSHUScreen, NeracaScreen, LaporanPiutangGabunganScreen, KasBankScreen, AsetFormScreen, LoanEditScreen, PayrollImportScreen, HajiUmrahScreen + 3 sub, TagihanScreen, ArusKasScreen, FakturPotonganScreen, LoanApplicationsScreen, DashboardScreen, MemberDetailScreen, TransaksiScreen, PinjamanScreen):

- Read the route's response shape (the object returned by `NextResponse.json({...})`).
- Read the screen's access (`data.<field>`).
- Record mismatches (absent field, envelope `res.data` vs `res.data.data`, nullable not handled).

Produce `contract-audit.md`:

```markdown
# Screen ↔ API Contract Audit

Lesson: Fase 6 T5 — screens must read actual API contracts, not assumed fields.

| Screen | Route | Screen reads | Route returns | Mismatch | Sev |
|--------|-------|--------------|---------------|----------|-----|
| KasirScreen | /toko | data.saleNo, data.items[] | ... | ... | ... |
| ... | | | | | |
```

- [ ] **Step 3: Flag mismatches to register**

Append:
```
| A6-<n> | A6 contract | <Sev> | <screen>:<line> | <field/envelope mismatch> | grep | Align screen to route contract | Open |
```

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/static/contract-audit.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A6 — screen↔API contract audit"
```

---

### Task A7: Reconcile progress-update-mobile-app.md vs code

**Files:**
- Create: `qa/mobile-qa/static/progress-recon.md`

**Interfaces:**
- Consumes: `progress-update-mobile-app.md` (last updated 2026-07-06), `git log --oneline -40 -- mobile src/app/api/mobile`, current `mobile/app.json` version/versionCode.

- [ ] **Step 1: Extract doc claims**

Read `progress-update-mobile-app.md` lines 1-100. List claimed "DONE + deployed" fase + version (doc says v1.1.6/vc7, EAS build #5 in flight).

- [ ] **Step 2: Extract code reality**

Run:
```bash
git log --oneline -40 -- mobile src/app/api/mobile src/lib/mobile-auth-scope.ts src/lib/services
cat mobile/app.json | grep -E '"version"|"versionCode"'
```

Record: actual latest fase visible in commits (9a.2, 9a.3, 9b, 12b, 13b, 18a), actual version (expected v1.1.7 / versionCode 9).

- [ ] **Step 3: Diff**

In `progress-recon.md`:

```markdown
# progress-update-mobile-app.md Reconciliation

Doc last updated: 2026-07-06. Code reality (HEAD <sha>): <date>.

## Doc claims vs code
| Fase | Doc status | Code status | Gap |
|------|-----------|-------------|-----|
| 8c Payroll | DONE + pushed 4787fd30 | present | none |
| 9a.1 HU tabungan | DONE + pushed e2c6b198 | present | none |
| 9a.2 Talangan | not in doc | commits b431d2eb..1a5ec45a present | DOC STALE |
| 9a.3 Bagi Hasil | not in doc | commit c31699a8 present | DOC STALE |
| 9b Tagihan | not in doc | commits fa35d009, 8ee65a1b present | DOC STALE |
| 12b Loan Applications VIEW | not in doc | commit 207c9e51 present | DOC STALE |
| 13b Faktur Potongan | not in doc | commit 0baa777e present | DOC STALE |
| 18a ArusKas | not in doc | commit e3c293a5 present | DOC STALE |
| version | 1.1.6/vc7 (build #5) | 1.1.7/vc9 | DOC STALE |
```

- [ ] **Step 4: Note recommendation**

Append:
```
## Recommendation
Update progress-update-mobile-app.md header date + status block, OR relocate to an auto-generated changelog. Fase 9a.2-18a + v1.1.7/vc9 untracked in doc is a release-traceability gap (exit criteria §7).
```

- [ ] **Step 5: Commit**

```bash
git add qa/mobile-qa/static/progress-recon.md
git commit -m "docs(qa): Layer A7 — progress doc reconciliation (stale: 9a.2-18a, v1.1.7/vc9)"
```

---

## Phase G — Pre-Mutation Gate (REQUIRED before any Phase B-mutation / C-mutation)

### Task G1: Manifest template + session-id convention

**Files:**
- Create: `qa/mobile-qa/manifests/template.json`
- Create: `qa/mobile-qa/plans/mutation-gate.md`

**Interfaces:**
- Produces: the manifest schema every mutation session fills. `session-id` = `<YYYYMMDD>-<short-desc>` (no `Date.now()` in scripts; derived from env or incrementing counter — see H1).

- [ ] **Step 1: Write manifest template**

Write `qa/mobile-qa/manifests/template.json`:
```json
{
  "sessionId": "YYYYMMDD-short-desc",
  "approvedBy": "user-handle",
  "approvalTimestamp": "ISO8601",
  "baselineSnapshotRef": "qa/mobile-qa/api/baseline-snapshot.json",
  "mutations": [
    {
      "role": "operator|admin|kasir|anggota",
      "route": "/api/mobile/...",
      "verb": "POST",
      "marker": "QA-<unique>",
      "recordId": "filled-after",
      "nominal": 1000,
      "expectedCleanup": "void via /loan-payment-void | reverse tx | delete draft",
      "cleanupStatus": "pending|done|failed",
      "cleanupRecordId": "filled-after"
    }
  ],
  "postCleanupBaseline": "path/to/reconcile-output"
}
```

- [ ] **Step 2: Write mutation gate doc**

Write `qa/mobile-qa/plans/mutation-gate.md`:
```markdown
# Production Mutation Gate

Before ANY mutation task (B3 idempotency pair, B2 write-verify, C device mutation):

1. User explicitly approves THIS batch (route list + nominal + cleanup method).
2. `qa/mobile-qa/scripts/baseline-snapshot.ts` run; output committed to `api/baseline-snapshot.json`.
3. Manifest created from `template.json` with sessionId + marker.
4. `cleanup-rehearse.ts --dry-run` succeeds for the planned cleanup path.
5. Execute 1 mutation pair max per route, marker unique, nominal minimum.
6. Verify 4-point: UI confirm → API response → DB/ledger → web report.
7. Cleanup via void/reversal (not hard-delete for ledger artifacts).
8. Re-run baseline snapshot → `reconcile-metrics.ts` → deltas must be ~0 (within rounding).
9. Update manifest cleanupStatus; commit manifest + reconcile output.

HARD STOP if any step cannot be completed safely → escalate user, leave no impact.
```

- [ ] **Step 3: Commit**

```bash
git add qa/mobile-qa/manifests/template.json qa/mobile-qa/plans/mutation-gate.md
git commit -m "docs(qa): mutation gate + manifest template"
```

---

### Task H1: Baseline snapshot script (read-only)

**Files:**
- Create: `qa/mobile-qa/scripts/baseline-snapshot.ts`
- Create: `qa/mobile-qa/api/baseline-snapshot.json` (generated)

**Interfaces:**
- Consumes: `src/lib/prisma.ts`, `prisma/schema.prisma`.
- Produces: `baseline-snapshot.json` — the aggregate metrics that must return to themselves after cleanup. No timestamps from `Date.now()`; the script takes an optional `--label <str>` arg; the file's `label` field stores it.

- [ ] **Step 1: Write the read-only snapshot script**

Write `qa/mobile-qa/scripts/baseline-snapshot.ts`:
```typescript
// Read-only aggregate snapshot of production Neon for QA baseline.
// Usage: npx tsx qa/mobile-qa/scripts/baseline-snapshot.ts --label <str>
// Writes JSON to qa/mobile-qa/api/baseline-snapshot.json. Never mutates.
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();
const label = process.argv.includes("--label")
  ? process.argv[process.argv.indexOf("--label") + 1]
  : "unlabeled";

async function main() {
  const [
    simpananPokok, simpananWajib, simpananSukarela,
    cbBalances, loanReceivables,
    voidedTestRows,
  ] = await Promise.all([
    prisma.savingsAccount.aggregate({ _sum: { balance: true }, where: { product: { type: "pokok" } } }),
    prisma.savingsAccount.aggregate({ _sum: { balance: true }, where: { product: { type: "wajib" } } }),
    prisma.savingsAccount.aggregate({ _sum: { balance: true }, where: { product: { type: "sukarela" } } }),
    prisma.cashBankAccount.findMany({ select: { name: true, balance: true } }),
    prisma.loan.aggregate({ _sum: { remainingPrincipal: true }, where: { status: { not: "voided" } } }),
    prisma.cashBankTransaction.count({ where: { description: { contains: "QA-" } } }),
  ]);

  const snapshot = {
    label,
    simpanan: {
      pokok: simpananPokok._sum.balance?.toString() ?? "0",
      wajib: simpananWajib._sum.balance?.toString() ?? "0",
      sukarela: simpananSukarela._sum.balance?.toString() ?? "0",
    },
    cashBank: cbBalances.map((a) => ({ name: a.name, balance: a.balance?.toString() ?? "0" })),
    loanReceivables: loanReceivables._sum.remainingPrincipal?.toString() ?? "0",
    voidedTestRowsBaseline: voidedTestRows,
  };

  writeFileSync(
    path.join(process.cwd(), "qa/mobile-qa/api/baseline-snapshot.json"),
    JSON.stringify(snapshot, null, 2),
  );
  console.log(JSON.stringify(snapshot, null, 2));
}

main().finally(() => prisma.$disconnect());
```

Note: exact Prisma model/field names must be verified against `prisma/schema.prisma` at execution (e.g. `remainingPrincipal` may be `sisaPokok`/`outstanding`); the implementer adjusts field names to match schema without changing the snapshot shape. This is read-only — safe to iterate.

- [ ] **Step 2: Verify schema field names (read-only)**

Run:
```bash
grep -E "model (SavingsAccount|Loan|CashBankAccount|CashBankTransaction) " prisma/schema.prisma -A 30 | grep -E "balance|remaining|principal|sisa|description|status"
```
Adjust script field names to match. Do NOT change schema.

- [ ] **Step 3: Run baseline (read-only, no DB write)**

Run:
```bash
npx tsx qa/mobile-qa/scripts/baseline-snapshot.ts --label pre-session-2026-07-18
```
Expected: JSON printed + written to `qa/mobile-qa/api/baseline-snapshot.json`. No DB writes (verify the script has no `create`/`update`/`delete`).

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/scripts/baseline-snapshot.ts
git commit -m "chore(qa): read-only baseline snapshot script + initial snapshot"
```
(`baseline-snapshot.json` is gitignored per A0.)

---

### Task G2: Cleanup rehearsal script (dry-run default)

**Files:**
- Create: `qa/mobile-qa/scripts/cleanup-rehearse.ts`

**Interfaces:**
- Consumes: pattern from `scripts/cleanup-hu-test-residue.ts` (dry-run/apply, guards, single transaction, CSV backup).
- Produces: a dry-run report of what cleanup WOULD do for a given manifest. Never runs `--apply` in this plan (apply happens only at the live gate, interactively, with user present).

- [ ] **Step 1: Read the reference pattern**

```bash
sed -n '1,80p' scripts/cleanup-hu-test-residue.ts
```
Note the dry-run/apply split, the guards (single `$transaction`, CSV backup before delete), and the marker filter.

- [ ] **Step 2: Write rehearsal script**

Write `qa/mobile-qa/scripts/cleanup-rehearse.ts`:
```typescript
// Dry-run (default) or --apply cleanup of QA test artifacts by marker.
// Usage: npx tsx qa/mobile-qa/scripts/cleanup-rehearse.ts --manifest <path> [--apply]
// SAFETY: --apply requires interactive confirmation prompt AND --confirm-yes.
import { PrismaClient } from "@prisma/client";
import path from "path";
const prisma = new PrismaClient();
const manifestPath = process.argv[process.argv.indexOf("--manifest") + 1];
const apply = process.argv.includes("--apply");
const confirmYes = process.argv.includes("--confirm-yes");

async function main() {
  if (!manifestPath) { console.error("--manifest required"); process.exit(2); }
  const manifest = require(path.join(process.cwd(), manifestPath));
  console.log(`[cleanup] mode=${apply ? "APPLY" : "DRY-RUN"} manifest=${manifestPath}`);
  if (apply && !confirmYes) { console.error("--apply requires --confirm-yes"); process.exit(2); }

  for (const m of manifest.mutations) {
    console.log(`  marker=${m.marker} route=${m.route} expectedCleanup=${m.expectedCleanup}`);
    // DRY-RUN: only COUNT candidate rows matching marker; never write.
    // The actual cleanup plan per artifact type is documented in manifest.expectedCleanup;
    // the live gate (interactive) performs the void/reversal via the real API,
    // then this script verifies the row/marker is gone.
    // IMPLEMENTER: add count-only Prisma reads gated by marker; do not add any create/update/delete here.
  }
  console.log("[cleanup] rehearsal complete — no writes performed");
}
main().finally(() => prisma.$disconnect());
```

Note the import `path` missing above — implementer adds `import path from "path";`. This script is intentionally count-only; live cleanup happens through the in-app void/reversal APIs (production-safe path) with this script as verifier, NOT as a direct DB deleter.

- [ ] **Step 3: Run dry-run against the template manifest**

```bash
npx tsx qa/mobile-qa/scripts/cleanup-rehearse.ts --manifest manifests/template.json
```
Expected: prints "DRY-RUN" + "rehearsal complete — no writes performed".

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/scripts/cleanup-rehearse.ts
git commit -m "chore(qa): cleanup rehearsal script (dry-run default, count-only)"
```

---

### Task A8: EAS config + audit-log consistency audit

**Files:**
- Create: `qa/mobile-qa/static/eas-and-auditlog-audit.md`
- Append: rows to `findings-layer-a.md`

**Interfaces:**
- Consumes: `mobile/app.json`, `mobile/eas.json`, every `auditLog.create` vs `logAuditFromRequest` call in `src/app/api/mobile/**`.

**Addresses spec risks:** R7 (EAS Update/submit config), R8 (audit-log consistency).

- [ ] **Step 1: EAS config audit (read-only)**

Run:
```bash
cat mobile/app.json | grep -E '"version"|"versionCode"|projectId|updates|url'
cat mobile/eas.json
```
Record in `eas-and-auditlog-audit.md`:
```markdown
## R7 — EAS Update + submit config
- app.json version/versionCode: <values>
- updates.url / channel: <present? absent>
- eas.json profiles: <list>
- submit.production: <configured? empty>
- Verdict: OTA untested if updates.url absent; Play Store submit blocked if submit.profile empty.
```

- [ ] **Step 2: Audit-log consistency (read-only)**

Run:
```bash
grep -rEn "auditLog\.create|logAuditFromRequest" src/app/api/mobile --include=route.ts | wc -l
grep -rEn "auditLog\.create" src/app/api/mobile --include=route.ts > /tmp/direct-auditlog.txt
grep -rEn "logAuditFromRequest" src/app/api/mobile --include=route.ts > /tmp/helper-auditlog.txt
```
Record counts per file. Mutation routes without EITHER = R8 gap.

- [ ] **Step 3: Flag findings**

```markdown
## R8 — audit-log consistency
| Route | direct auditLog.create | logAuditFromRequest | Verdict |
|-------|------------------------|---------------------|---------|
| <route> | yes | no | inconsistent w/ peers using helper |
```
Append High rows for mutation routes with no audit at all.

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/static/eas-and-auditlog-audit.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer A8 — EAS config + audit-log consistency audit"
```

---

## Phase B — API Automation (read-only first)

### Task B1: RBAC matrix (read-only, token A → unit B)

**Files:**
- Create: `qa/mobile-qa/api/rbac-matrix.md`

**Interfaces:**
- Consumes: the four test accounts (operator, admin unit X, kasir unit X, anggota) + `src/app/api/mobile/**` GET routes from A4.
- Produces: a pass/fail matrix per route per crossing direction. **No mutations** — GET only. If accounts not provisioned, task halts at provisioning request to user (no DB write).

- [ ] **Step 1: Verify test accounts exist (read-only)**

Run:
```bash
npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.user.findMany({where:{role:{in:['operator','admin','kasir']}},select:{email:true,role:true}}).then(u=>{console.log(u);p.\$disconnect()})"
```
Record which roles have accounts. If any of the four missing → STOP, append to `rbac-matrix.md`:
```
## BLOCKED — provisioning required
Need accounts for: <roles>. No DB writes performed. Request user to provision QA-only accounts.
```
and commit (no further B1 steps).

- [ ] **Step 2: Obtain mobile tokens (read-only login)**

For each account, POST `/api/mobile/login` with credentials provided by user (user supplies credentials; do NOT hardcode). Store tokens in env vars for this session only (do not commit). Document the login call in `rbac-matrix.md` (route + role, NOT the token).

- [ ] **Step 3: Build crossing matrix**

For each GET route in A4, call with each role's token and record status code:

```markdown
# RBAC Matrix — GET routes, token A → resource of unit/branch B

| Route | operator | admin-X | admin-Y (other unit) | kasir-X | anggota(self) | anggota(other) | admin_sp* |
|-------|----------|---------|----------------------|---------|---------------|----------------|-----------|
| /loans | 200 | 200 (X only) | 200 (own) | ... | 200(self) | 403 | 401/403 neg |
```
`admin_sp` column = negative test: a token with role `admin_sp` (if a dormant account exists and user approves) MUST be rejected on routes flagged in A4. If no account exists, record "unable to test — recommend create-then-block in remediation."

- [ ] **Step 4: Flag violations to register**

Append to `findings-layer-a.md` (or B-phase addendum):
```
| B1-<n> | B1 RBAC | High | <route> | <role> got <code> expected 403 | matrix | Fix scope | Open |
```

- [ ] **Step 5: Commit**

```bash
git add qa/mobile-qa/api/rbac-matrix.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer B1 — RBAC read-only matrix"
```

---

### Task B2: Contract snapshots (web vs mobile, read-only)

**Files:**
- Create: `qa/mobile-qa/api/contract-snapshots/<route>.json` per route (gitignored per A0)
- Create: `qa/mobile-qa/api/contract-snapshots/SUMMARY.md`

**Interfaces:**
- Consumes: paired web + mobile GET routes for the same business object.
- Produces: field-level diff showing mobile response is a faithful subset/transform of web.

- [ ] **Step 1: Enumerate paired routes**

From A4/A6, list routes where both `/api/<resource>` (web) and `/api/mobile/<resource>` (mobile) exist for GET:
- /loans, /savings-accounts, /members, /reports/financial, /reports/shu-calculator, /reports/piutang-gabungan, /billing/current, /haji-umrah/savings, /reports/unit-laporan/[unitType], /toko (history).

- [ ] **Step 2: Snapshot each pair (read-only GET)**

For each pair, with operator token, GET both, save response JSON to `contract-snapshots/<route>-mobile.json` and `-web.json`. **GET only, no query params that trigger generation** (e.g. avoid `/billing/generate`).

- [ ] **Step 3: Diff**

In `SUMMARY.md`:
```markdown
# Contract Snapshots — web vs mobile

| Route | web fields | mobile fields | delta | parity verdict |
|-------|-----------|---------------|-------|----------------|
| /loans | ... | ... | mobile omits <X> | OK (subset) / MISMATCH |
```

Flag any case where mobile returns a DIFFERENT nominal for the same business state (not just fewer fields) → Critical.

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/api/contract-snapshots/SUMMARY.md qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer B2 — web/mobile contract snapshot diffs"
```

---

### Task B3: Idempotency audit (static result + approved single pair)

**Files:**
- Create: `qa/mobile-qa/api/idempotency-results.md`
- Append: register rows.

**Interfaces:**
- Consumes: A5 audit + manifest gate G1 + baseline H1.
- Produces: confirmation that each flagged route is/isn't idempotent, via AT MOST ONE approved pair per route (marker unique, nominal min). **No hammering.** If user does not approve → deliver static-only verdict (A5) and mark live test "deferred — not approved."

- [ ] **Step 1: Present A5 findings to user**

Summarize routes flagged "UI flag only" from A5. Ask user for explicit approval per route or "defer all live tests."

- [ ] **Step 2: If approved — one pair per route**

For each approved route (max the user grants):
1. Run G1 gate (baseline + manifest + cleanup rehearse).
2. Submit the SAME request twice with the same `Idempotency-Key: <marker>` header (if the client supports custom headers) OR note "no client idempotency header supported — double-tap simulated by two rapid identical POSTs."
3. Record: did the second create a duplicate? (count rows matching marker).
4. Cleanup the test rows via void/reversal.
5. Re-run baseline → reconcile → must return to ~0.

- [ ] **Step 3: Record verdict**

In `idempotency-results.md`:
```markdown
# Idempotency Live Test (approved pairs only)

| Route | Approved? | Pair result | Duplicate? | Cleanup | Baseline restored? |
|-------|-----------|--------------|------------|---------|---------------------|
| savings-tx | yes (user, date) | 2 identical POST, marker QA-001 | YES - 2 rows created | voided both | yes |
| loan-payment | deferred | n/a | n/a | n/a | n/a |
```

- [ ] **Step 4: Commit**

```bash
git add qa/mobile-qa/api/idempotency-results.md qa/mobile-qa/manifests/<session-id>.json qa/mobile-qa/static/findings-layer-a.md
git commit -m "docs(qa): Layer B3 — idempotency audit results (approved pairs)"
```

---

## Phase C — Device (Android physical)

### Task C1: Per-role device smoke checklist

**Files:**
- Create: `qa/mobile-qa/device/smoke-checklist.md`

**Interfaces:**
- Consumes: `mobile/app.json` version, the 4 role accounts, the APK from the latest EAS build.
- Produces: ordered manual smoke steps per role (read-screen-first, mutation steps marked with the G1 gate symbol 🛑).

- [ ] **Step 1: Write the smoke checklist**

```markdown
# Device Smoke Checklist — Android physical

APK: <user supplies latest sideload URL>. Version: 1.1.7 / vc9.
🛑 = mutation — requires G1 gate (baseline + manifest + approved cleanup).

## Operator
- [ ] install + launch, splash → login
- [ ] login operator → dashboard shows operator menus
- [ ] open each read screen: Neraca, SHU, Piutang Gabungan, Audit Log → renders non-empty
- [ ] open Haji/Umrah list, Tagihan, ArusKas, Faktur Potongan → renders
- [ ] 🛑 savings-tx setoran Rp1000 marker QA-OPS-001 → verify → reverse
- [ ] 🛑 loan-payment on test loan → void → baseline check
- [ ] idle 30min → auto-logout (useIdleLogout)
- [ ] background → resume → state intact
- [ ] airplane mode → submit blocked clearly (no silent queue)

## Admin (unit X)
- [ ] login admin-X → dashboard shows unit X menus only
- [ ] open members list → only unit X
- [ ] open loans → only unit X
- [ ] try navigate to unit Y data → blocked (negative)
- [ ] 🛑 POS sale unit X Rp1000 → void → baseline

## Kasir (unit X)
- [ ] login kasir-X → POS screen
- [ ] 🛑 sale tunai Rp1000 → void → baseline
- [ ] 🛑 sale QRIS Rp1000 → void
- [ ] open shift, riwayat → unit X only
- [ ] idle timeout OFF (kasir = -1 per useIdleLogout)

## Anggota
- [ ] login anggota → portal shows own data only
- [ ] open simpanan, pinjaman, slip gaji → own only
- [ ] try another member's data → 403/blank (negative)
- [ ] 🛑 LoanApplication uji → cancel/void → baseline

## Cross-cutting
- [ ] push notification tap → correct route (Main/Approval)
- [ ] camera/file picker on LoanApplication
- [ ] print struk / share kwitansi
- [ ] low storage warning
- [ ] permission denied (camera) graceful
- [ ] rotate orientation no crash
- [ ] slow 2G: spinner visible, no silent fail
```

- [ ] **Step 2: Commit**

```bash
git add qa/mobile-qa/device/smoke-checklist.md
git commit -m "docs(qa): Layer C1 — per-role device smoke checklist"
```

---

### Task C2: Device findings

**Files:**
- Create: `qa/mobile-qa/device/device-findings.md`

**Interfaces:**
- Consumes: C1 checklist executed by user on physical Android.
- Produces: findings register from device run. Mutations only with G1 gate.

- [ ] **Step 1: Execute smoke (user-driven; Claude records)**

User runs the checklist on device, reports pass/fail per row. Claude records verbatim into `device-findings.md`.

- [ ] **Step 2: Record findings**

```markdown
# Device Findings — Android physical run

Run date: <date>. APK: <ref>. Tester: user.
🛑 mutations applied G1 gate; baseline pre/post committed.

| Checklist row | Result | Evidence (screenshot ref / log) | Sev | Cleanup status |
|---------------|--------|--------------------------------|-----|----------------|
| operator dashboard | pass | | | |
| 🛑 savings-tx QA-OPS-001 | pass, voided | manifest row 1 | Medium | done, baseline restored |
| airplane mode submit | FAIL — silent, no error shown | screenshot 01 | High | n/a |
| ... | | | | |
```

- [ ] **Step 3: Commit**

```bash
git add qa/mobile-qa/device/device-findings.md
git commit -m "docs(qa): Layer C2 — device findings"
```

---

## Phase D — Reconciliation & Sign-off

### Task D1: Metric reconciliation

**Files:**
- Create: `qa/mobile-qa/scripts/reconcile-metrics.ts`
- Create: `qa/mobile-qa/reports/reconcile-<label>.md` (generated)

**Interfaces:**
- Consumes: `baseline-snapshot.ts` (H1), post-cleanup manifest.
- Produces: delta report. All deltas must round to ~0 for clean exit.

- [ ] **Step 1: Write reconcile script**

Write `qa/mobile-qa/scripts/reconcile-metrics.ts`:
```typescript
// Compare current prod aggregates to baseline-snapshot.json. Read-only.
// Usage: npx tsx qa/mobile-qa/scripts/reconcile-metrics.ts --baseline <path>
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
const prisma = new PrismaClient();
const baselinePath = process.argv[process.argv.indexOf("--baseline") + 1];
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

async function main() {
  // Re-query the same aggregates as baseline-snapshot.ts, compare.
  // IMPLEMENTER: mirror baseline-snapshot.ts queries exactly; compute deltas.
  const current = await currentSnapshot(prisma); // refactor: extract from baseline-snapshot.ts
  const deltas = diff(baseline, current);
  console.log(JSON.stringify({ baseline: baseline.label, deltas }, null, 2));
  const clean = Object.values(deltas).every((d) => Math.abs(Number(d)) < 1); // within Rp1
  console.log(clean ? "CLEAN — baseline restored" : "DRIFT — investigate");
  process.exit(clean ? 0 : 1);
}
main().finally(() => prisma.$disconnect());
```
Implementer refactors snapshot queries into a shared `currentSnapshot(prisma)` so baseline + reconcile use identical logic (DRY).

- [ ] **Step 2: Run reconcile after every mutation session**

```bash
npx tsx qa/mobile-qa/scripts/reconcile-metrics.ts --baseline qa/mobile-qa/api/baseline-snapshot.json
```
Expected: `CLEAN — baseline restored` (exit 0). If DRIFT → halt, escalate.

- [ ] **Step 3: Commit**

```bash
git add qa/mobile-qa/scripts/reconcile-metrics.ts
git commit -m "chore(qa): metric reconciliation script (read-only vs baseline)"
```

---

### Task D2: Exit-criteria sign-off report

**Files:**
- Create: `qa/mobile-qa/report/exit-criteria.md`

**Interfaces:**
- Consumes: all Phase A/B/C/D artifacts.
- Produces: the single sign-off document mapping exit criteria §7 of spec to evidence.

- [ ] **Step 1: Write exit criteria report**

```markdown
# Mobile QA Exit-Criteria Sign-off

Spec: docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md §7.

| # | Criterion | Evidence | Pass? |
|---|-----------|----------|-------|
| 1 | Layer A: 0 Critical, 0 High open | findings-layer-a.md (count Critical=<n>, High=<n>) | |
| 2 | RBAC matrix 4 roles 100% + admin_sp negative | rbac-matrix.md | |
| 3 | Contract audit 0 mismatch UI↔API | contract-audit.md, contract-snapshots/SUMMARY.md | |
| 4 | P0 mutations: idempotency + reconcile + cleanup baseline restored | idempotency-results.md, reconcile-* | |
| 5 | Android smoke all roles passed | device-findings.md | |
| 6 | Production-safe: manifests logged, aggregates restored, audit trail intact | manifests/*, reconcile-* | |
| 7 | Progress doc reconciled | progress-recon.md | |

## Open items blocking release
- <list any Critical/High still open>

## Recommendation
<RELEASE / CONDITIONAL / BLOCK> based on open items.
```

- [ ] **Step 2: Fill from artifacts**

Populate Pass? column by reading each referenced artifact. Leave "BLOCK" recommendation if any Critical/High open.

- [ ] **Step 3: Commit**

```bash
git add qa/mobile-qa/report/exit-criteria.md
git commit -m "docs(qa): Layer D2 — exit-criteria sign-off report"
```

---

## Notes for the implementer

- **Stop and escalate** if any production mutation cannot be cleanly reversed. Leaving impact = plan failure.
- **Never commit tokens, credentials, or `mobile/app.json`.**
- **`Date.now()`/`Math.random()` are unavailable in some tsx contexts** — use `--label` args and git HEAD for timestamps; the scripts above take labels, not timestamps.
- **Schema drift:** Prisma field names in H1/D1 (`remainingPrincipal`, `balance`, `description`) must be verified against `prisma/schema.prisma` at execution and adjusted — the snapshot SHAPE is the contract, not the exact field spellings.
- **Read-only proof:** `baseline-snapshot.ts` and `reconcile-metrics.ts` must contain zero `create`/`update`/`delete`/`upsert`. `cleanup-rehearse.ts` is count-only until `--apply --confirm-yes` at the live interactive gate (which then uses the in-app void/reversal APIs, not direct DB writes, for ledger artifacts).
