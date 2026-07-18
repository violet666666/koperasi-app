# Mobile QA Execution Checklist

Ordered runbook. Do not skip the production-safety gate before any mutation task.

## Phase A — Static (no data risk)
- [x] A1 Static findings register scaffold
- [x] A2 TypeScript mobile gate
- [x] A3 ESLint mobile gate
- [x] A4 Role gate audit (RBAC)
- [x] A5 Idempotency surface audit
- [x] A6 Contract audit (screen↔API)
- [x] A7 Reconcile progress-update-mobile-app.md vs code
- [x] A8 EAS config + audit-log consistency audit

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