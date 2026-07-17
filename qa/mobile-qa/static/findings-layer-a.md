# Layer A — Static Audit Findings Register

Source spec: `docs/superpowers/specs/2026-07-18-mobile-qa-strategy-design.md`.
All Phase A tasks append rows below. Sev scale: Critical (data/money/security) / High (correctness) / Medium (robustness) / Low (polish).

| ID | Task | Sev | File:line | Finding | Evidence | Remediation | Status |
| A2-1 | A2 tsc | High | mobile/src/screens/operator/AsetDetailScreen.tsx:133 | TS2304: Cannot find name 'fetchAssetDetail' — screen broken at runtime | npx tsc --noEmit output | Investigate AsetDetailScreen.tsx:133 — missing import or renamed function | Open |
| A3-1 | A3 eslint | Medium | mobile/eslint configuration | 277 errors/60 warnings; root ESLint lacks mobile/RN profile, so lint gate is currently non-actionable | npx eslint mobile/src mobile/App.tsx; raw body 608 lines | Add dedicated mobile lint config/script, explicitly support Expo asset require while retaining correctness/security rules | Open |
| A3-2 | A3 eslint | Medium | Multiple operator/kasir screens (11 hook warnings) | Missing react hook dependencies can cause stale data after focus/refetch | eslint raw output (11 exhaustive-deps warnings) | Triage each affected hook; avoid blanket disable | Open |