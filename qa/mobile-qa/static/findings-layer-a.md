# Layer A — Static Audit Findings Register

Source spec: `docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md`.
All Phase A tasks append rows below. Sev scale: Critical (data/money/security) / High (correctness) / Medium (robustness) / Low (polish).

| ID | Task | Sev | File:line | Finding | Evidence | Remediation | Status |
| A2-1 | A2 tsc | High | mobile/src/screens/operator/AsetDetailScreen.tsx:133 | TS2304: Cannot find name 'fetchAssetDetail' — screen broken at runtime | npx tsc --noEmit output | Investigate AsetDetailScreen.tsx:133 — missing import or renamed function | Open |