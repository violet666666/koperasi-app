# ESLint Mobile Gate

Run: `npx eslint mobile/src mobile/App.tsx`
Date: 2026-07-18
Branch: railway-migration (HEAD 81efdfa7)

## Summary
- Errors: 277
- Warnings: 60
- Files with issues: ~50+ (see body for breakdown)
- Note: root `eslint.config.mjs` has no `mobile/` override; much of the `any`-type and `require()` errors are from Expo/RN patterns not configured in the lint rules (e.g., `@typescript-eslint/no-require-imports` flags Expo asset `require()` which is the standard Expo idiom). RN-specific rules not configured.

## Key error categories (from body scan)
- `@typescript-eslint/no-explicit-any`: dominant (~80+) — pervasive `as any` / `:any` casts in screen code
- `@typescript-eslint/no-require-imports`: moderate (~15+) — Expo asset requires (`require('../assets/...')`) flagged as non-compliant but are standard Expo idiom
- `@typescript-eslint/no-unused-vars`: frequent (~40+) — unused imports and variables; mostly pre-existing from rapid development cycles
- `jsx-a11y/alt-text`: 1 in App.tsx — missing alt on image element

## Findings
- `react-hooks/exhaustive-deps`: 11 warnings; no `react-hooks/rules-of-hooks` errors. These need per-screen review because stale closures can produce stale data after focus/refetch.
- Mobile source has no dedicated npm `lint` script and root ESLint configuration has no mobile-specific override; the 277 errors make the current generic gate non-actionable without a deliberate RN/Expo rule profile.
- Files under `kasir/` and `operator/` screens have the highest error density.

## Full lint body
See: `qa/mobile-qa/static/eslint-mobile-gate-body.txt` (608 lines) — attached raw output.