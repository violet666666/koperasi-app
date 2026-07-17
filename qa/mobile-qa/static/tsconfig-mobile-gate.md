# TypeScript Mobile Gate — tsc --noEmit on mobile/

Run: `cd mobile && npx tsc --noEmit -p tsconfig.json`
Date: 2026-07-18
Branch: railway-migration (HEAD 136034a3)

## Summary
- Total errors: 1
- Pre-existing (match root known list from CLAUDE.md: api/mobile/toko/shifts/[id], seed-kas-bank-jatim, seed-uat): 0 (none in mobile src)
- New / mobile-only: 1

## Findings
```
src/screens/operator/AsetDetailScreen.tsx(133,15): error TS2304: Cannot find name 'fetchAssetDetail'.
```

### Classification
- Sev: High (build will fail if strict gate added; screen broken at runtime)
- Root cause: most likely a renamed/missing import or function in AsetDetailScreen
- Not pre-existing per CLAUDE.md list (those are server-side files excluded by `tsconfig.json exclude: ["mobile"]`)
- Remediation: investigate AsetDetailScreen.tsx:133 — either missing import of `fetchAssetDetail` from the screen's API utils, or the component was renamed but the call site wasn't updated