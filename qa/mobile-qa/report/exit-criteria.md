# Mobile QA Exit-Criteria Sign-off

Spec: `docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md` §7.

| # | Criterion | Evidence | Status |
|---|-----------|----------|--------|
| 1 | Layer A: 0 Critical, 0 High open | `static/findings-layer-a.md` | BLOCKED — 0 Critical, 1 High remains (systemic idempotency) |
| 2 | RBAC matrix 4 roles + admin_sp negative | `api/rbac-matrix.md` | PARTIAL PASS — operator/admin/anggota verified; kasir credentials unavailable; admin_sp retired/no account |
| 3 | Contract audit 0 UI↔API mismatch | 10 regression tests + live route smoke | PASS for 8 remediated items; 22 audited screens already clean |
| 4 | P0 mutations idempotency + cleanup baseline | `static/idempotency-audit.md` | DEFERRED — production mutation not authorized; schema-backed idempotency not implemented |
| 5 | Android physical-device smoke | `device/device-findings.md` | PENDING vc10 build + user-run |
| 6 | Production-safe manifests/aggregates restored | Baseline snapshots + QA marker count 0 | PASS for audit/remediation: no QA financial mutations; operational production changed independently |
| 7 | Progress document reconciled | `progress-update-mobile-app.md` | PASS — updated 2026-07-18 |

## Current recommendation

**CONDITIONAL / BLOCK RELEASE SIGN-OFF** until:
1. v1.1.8/vc10 APK finishes and physical-device smoke passes.
2. Systemic idempotency receives a separate schema-backed design decision.
3. Kasir RBAC/device behavior is verified when a credential becomes available.

API remediation is deployed and read-only live verification passed: Arus Kas 200, Faktur Potongan 200, Loan Applications pagination present, Member Piutang Barang 200, Member Transactions 200.