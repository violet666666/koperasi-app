# Mobile Play Store Polish — Design Spec (Fase 5)

**Date:** 2026-07-03
**Status:** Design captured (pending execution)
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build)
**Phase:** Fase 5 — Play Store polish. Follows Fase 4c. Precedes EAS build #2.

## Problem

The mobile app is heading to Play Store, but the repo's own release checklist (`mobile/PLAY-STORE-RELEASE-GUIDE.md`) requires "Tidak ada `console.log` atau debug code yang tersisa" — yet ~45 `console.log/warn/error` calls remain across `mobile/src/screens/**`. Plus three small UX/code-hygiene issues surfaced in the Fase 4c inventory:
- `MasterDataHubScreen.tsx:100` — 4 of 5 menu items show `Alert.alert('Segera Hadir', ...)` (dead menus).
- `AsetListScreen.tsx:195-215` — the Add FAB is commented out and references a non-existent `AsetTambah` screen (dead code + dead nav).
- Payroll role inconsistency: `api/mobile/payroll` allows `kasir` but `DashboardScreen` hides the payroll menu from kasir.

## Goal

Make the mobile app Play-Store-clean: no raw debug output in production, no dead/stub UI, consistent role gating — without building new features (those are Fase 6-9).

## Approach (decided)

Four small, independent fixes. The console sweep uses a `__DEV__`-gated logger (idiomatic RN) rather than bare removal, so catch blocks aren't silenced and dev diagnostics survive.

## Components

### 5a — Logger util + console sweep
Create `mobile/src/utils/log.ts`:
```ts
// Production-safe logger: no-ops in release builds, logs in dev.
// Replaces raw console.* so the Play Store APK ships no debug output.
const isDev = __DEV__;
export const log = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};
```
Then sweep `mobile/src/screens/**`: replace `console.log` → `log.log`, `console.warn` → `log.warn`, `console.error` → `log.error`, adding `import { log } from "@/utils/log"` (or relative path). ~45 call sites across ~20 screens. Files that only had console.* for debugging and no longer need it can drop the call entirely (judgment per site), but catch blocks should keep `log.error` (dev-only) rather than become empty.

### 5b — MasterDataHub de-stub
In `mobile/src/screens/operator/MasterDataHubScreen.tsx`, remove the 4 menu entries that fire `Alert.alert('Segera Hadir', ...)` (COA, Produk Simpanan, Produk Pinjaman, Manajemen Pengguna). Keep the Pengumuman entry (navigates to a real screen). If the hub is left with only Pengumuman, that's acceptable for now (full master-data CRUD is Fase 8).

### 5c — Aset FAB dead-code removal
In `mobile/src/screens/operator/AsetListScreen.tsx`, delete the commented-out Add FAB block (~lines 195-215) and any `navigation.navigate("AsetTambah")` reference. Do NOT create the AsetTambah screen (Aset CRUD is Fase 8).

### 5d — Payroll API role alignment
In `src/app/api/mobile/payroll/route.ts` GET (and `payroll/[periodId]/route.ts` GET if it has the same gate), remove `kasir` from the allowed-roles check → `operator/admin/admin_sp`. This matches the Dashboard UI (which hides payroll from kasir) and reflects that payroll is an operator/admin task, not a POS task. (Note: web `api/payroll` GET has no gate at all — mobile narrowing here is a correctness improvement, not a parity break.)

## Test plan

- No unit tests needed for the logger util (trivial `__DEV__` gate) or the UI removals (mechanical). 
- Verify: `npx tsc --noEmit` in `mobile/` is clean (no new errors); the app still builds (`npx expo export` or EAS build). Grep confirms 0 raw `console.log/warn/error` in `mobile/src/screens/**`.
- Manual: MasterDataHub shows only Pengumuman; AsetList renders without the dead FAB; a kasir token now 403s on `/api/mobile/payroll`.

## Conventions / constraints

- This is mobile-UI + one API route. Mobile UI changes need an EAS build to reach devices (build #2).
- Do NOT build new features (master-data CRUD, aset create) — those are Fase 8.
- Keep the `__DEV__` logger the SINGLE place `console.*` appears in mobile source.
- `mobile/app.json` will bump `versionCode` 3→4 for build #2 (separate step after Fase 5 lands).
