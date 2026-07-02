# Mobile Play Store Polish — Implementation Plan (Fase 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile app Play-Store-clean: production-safe logger (no raw console.* in screens), de-stub MasterDataHub, remove dead Aset FAB, align payroll role gate. Then EAS build #2.

**Architecture:** Two independent tasks — (1) create `mobile/src/utils/log.ts` + sweep ~45 console.* call sites; (2) three small UI/API removals. No new features.

**Spec:** `docs/superpowers/specs/2026-07-03-mobile-play-store-polish-design.md`

## Global Constraints

- Working directory for shell commands: `C:\Users\Acer\Downloads\koperasi-app` (repo root). Mobile UI lives in `mobile/`.
- Do NOT build new features (master-data CRUD, aset create) — Fase 8.
- The `__DEV__` logger is the SINGLE place `console.*` may appear in mobile source.
- Keep catch blocks logging (use `log.error`) — don't create silent catches.
- Pre-existing mobile tsc errors (if any) — ignore unless in a file you changed.
- `branch` = `railway-migration` (API auto-deploys on push). Mobile UI deploys via EAS build #2 (after Fase 5).

---

### Task 1: Logger util + console.* sweep

**Files:**
- Create: `mobile/src/utils/log.ts`
- Modify: every file under `mobile/src/screens/**` (and any `mobile/src/**` helper) that calls `console.log/warn/error`

**Interfaces:**
- Produces: `log` default-ish export from `@/utils/log` with `{ log, warn, error }`, all `__DEV__`-gated.

- [ ] **Step 1: Create the logger**

Create `mobile/src/utils/log.ts` (verbatim from spec §5a):
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

- [ ] **Step 2: Find all console.* call sites**

Run: `grep -rn "console\.\(log\|warn\|error\)" mobile/src/` (use Grep tool). Record the file list.

- [ ] **Step 3: Replace per file**

For each file: add `import { log } from "@/utils/log";` (use the project's existing alias/relative convention — check other imports in the file; if `@/` isn't used in mobile, use the correct relative path to `utils/log`). Replace `console.log(` → `log.log(`, `console.warn(` → `log.warn(`, `console.error(` → `log.error(`. Keep catch-block logging as `log.error`. If a console.* was pure debug noise with no error-handling purpose, you may delete the line instead.

- [ ] **Step 4: Verify zero raw console.* in screens**

Run: `grep -rn "console\.\(log\|warn\|error\)" mobile/src/` → expect only `mobile/src/utils/log.ts` (the 3 gated calls). Any other hit = missed site; fix it.

- [ ] **Step 5: Typecheck + build smoke**

Run: `cd mobile && npx tsc --noEmit` → no new errors. (If mobile has no tsc script, run `npx expo export --platform android` or rely on the EAS build in the final step.)
Expected: clean (or only pre-existing errors).

- [ ] **Step 6: Commit**

```bash
git add mobile/src/utils/log.ts mobile/src/screens/ mobile/src/
git commit -m "chore(mobile): __DEV__-gated logger, sweep console.* from screens (Play Store polish)"
```

---

### Task 2: De-stub MasterDataHub + remove dead Aset FAB + align payroll gate

**Files:**
- Modify: `mobile/src/screens/operator/MasterDataHubScreen.tsx`
- Modify: `mobile/src/screens/operator/AsetListScreen.tsx`
- Modify: `src/app/api/mobile/payroll/route.ts` (GET)
- Modify: `src/app/api/mobile/payroll/[periodId]/route.ts` (GET, if it has the same `kasir` gate)

- [ ] **Step 1: MasterDataHub de-stub**

In `mobile/src/screens/operator/MasterDataHubScreen.tsx`, remove the 4 menu entries whose `onPress` is `Alert.alert('Segera Hadir', ...)` (COA, Produk Simpanan, Produk Pinjaman, Manajemen Pengguna). Keep the Pengumuman entry. Ensure the screen still renders cleanly with the remaining item(s).

- [ ] **Step 2: Aset FAB dead-code removal**

In `mobile/src/screens/operator/AsetListScreen.tsx`, delete the commented-out Add FAB JSX block (~lines 195-215) and remove the `navigation.navigate("AsetTambah")` reference (and the `AsetTambah` string from any nav type if present). Do NOT create `AsetTambah`.

- [ ] **Step 3: Payroll role gate alignment**

In `src/app/api/mobile/payroll/route.ts` GET and `src/app/api/mobile/payroll/[periodId]/route.ts` GET, change the allowed-roles check from `["operator","admin","kasir"]` → `["operator","admin","admin_sp"]` (remove `kasir`). This matches the Dashboard UI. Leave the rest of the route intact.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` (repo root, for the API routes) and `cd mobile && npx tsc --noEmit` (for the screens). Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/operator/MasterDataHubScreen.tsx mobile/src/screens/operator/AsetListScreen.tsx src/app/api/mobile/payroll/route.ts src/app/api/mobile/payroll/[periodId]/route.ts
git commit -m "fix(mobile): de-stub MasterDataHub, remove dead Aset FAB, align payroll gate (Play Store polish)"
```

---

## After Fase 5 lands → EAS build #2

1. Bump `mobile/app.json`: `version` 1.1.2 → 1.1.3, `android.versionCode` 3 → 4.
2. Commit the bump.
3. Push railway-migration (deploys the payroll API change).
4. Run `cd mobile && npx eas-cli build --platform android --profile production --non-interactive --no-wait` (EAS auth already set: violet666). Give the user the build URL to monitor.
5. Poll build status; on FINISHED, give the APK download link.

## Notes for the final whole-branch review

- Confirm 0 raw `console.*` outside `utils/log.ts` (grep).
- Confirm MasterDataHub renders without crashing with the reduced menu.
- Confirm no `AsetTambah` reference remains (grep).
- Confirm payroll GET returns 403 for kasir and 200 for operator/admin/admin_sp.
- Confirm no new feature was added (only removals + the logger).
