# PRIMKOPPOL — Koperasi Management System

## Commands

```bash
npm run dev              # Next.js dev server (port 3000)
npm run build            # prisma generate + next build
npm run test             # Vitest unit tests
npm run test:watch       # Watch mode
npm run lint             # ESLint
npx playwright test      # E2E tests

# Mobile (separate package.json in mobile/)
cd mobile && npx expo start    # Expo dev server
cd mobile && npx eas build     # EAS build (Play Store)

# Database
npm run db:generate      # Regenerate Prisma client
npm run db:migrate       # Run migrations
npm run db:push          # Push schema (no migration files)
npm run db:seed          # Seed database
npm run db:studio        # Prisma Studio

# Diagnostics (read-only, vs prod Neon) — many in scripts/diagnose-*.ts
NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-<name>.ts
```

## Tech Stack

- **Next.js 16** / React 19 / TypeScript / Tailwind v4
- **Prisma 6** + Neon PostgreSQL (serverless)
- **NextAuth v5 beta** (JWT sessions)
- **Zustand** / TanStack Query / React Hook Form + Zod
- **Radix UI + shadcn/ui** / Recharts / Framer Motion
- **Mobile:** Expo 55 / React Native 0.83 / NativeWind

## Architecture

```
src/
  app/
    (auth)/            — Login, forgot-password
    (protected)/       — All authenticated pages (role-guarded)
      dashboard/ anggota/ simpanan/ pinjaman/ toko/ kas-bank/
      jurnal/ laporan/ aset/ master/ gaji/ approval/ audit-log/
      periode/ non-sp/ transaksi-unit/ manajemen-unit/
      barbershop/ fitness/ fotocopy/ laundry/ play-station/
      cuci-mobil/ resto/ cafe-lsp/ haji-umrah/
    portal/            — Member self-service portal
    api/               — 90+ API route handlers (pattern: app/api/[resource]/route.ts)
      mobile/          — Dedicated mobile API endpoints
  components/          — Shared UI components
  lib/
    constants/         — Navigation, units, regions
    services/          — SHU calculator, billing, manajemen-unit
    validations/       — Zod schemas
    prisma.ts          — Prisma client singleton
    auth.ts            — NextAuth config
  types/               — TypeScript definitions

mobile/                 — Expo RN app (separate package.json)
prisma/schema.prisma   — 45 models, PostgreSQL
```

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | 45 models — Auth, Members, Savings, Loans, Cash/Bank, Accounting, Units, Store, Billing |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/auth.ts` | NextAuth v5 config |
| `src/lib/services/shu-calculator.ts` | SHU calculator — income merge, 3-group categorization |
| `src/lib/constants/navigation.ts` | Sidebar nav config + role filtering |
| `src/app/(protected)/layout.tsx` | Route guard per role |
| `src/lib/hooks/use-auth.tsx` | Auth hook + permissions |
| `src/lib/export-utils.ts` | Universal export (Excel via SheetJS, PDF via browser print, thermal receipts, kwitansi) |

## Environment Variables

```
DATABASE_URL       — Neon PostgreSQL pooled connection
DIRECT_URL         — Neon PostgreSQL direct connection (migrations)
NEXTAUTH_SECRET    — Auth secret
NEXTAUTH_URL       — Base URL
NODE_ENV           — development/production
```

## Role System

| Role | Permission | Access |
|------|-----------|--------|
| `operator` | `manage_all` | Full access — bypasses all guards |
| `admin` | Unit-scoped | Own unit only (toko, resto_cafe, cafe_lsp, etc.) |
| `admin_sp` | SP-scoped | Simpan Pinjam operations |
| `kasir` | POS-scoped | Cashier operations |

**No `superadmin` or `super_admin` role exists** — was removed from 59 files. Operator is the sole super admin.

## Testing

- **Unit:** Vitest + happy-dom (`src/__tests__/`, 23 files)
- **E2E:** Playwright (`e2e/`, 8 spec files including haji-umrah)
- **Test accounts:** See `akun-primkoppol.md`
- **Pre-existing failing tests (NOT regressions):** `split-bill` (group-id `SB-` format), `batch-navigation` (cafe-lsp item count), `floor-plan`/`queue-system` (stale types). Prove a failure isn't yours with `git stash push <your files>` + retest before digging in.
- **Pre-existing tsc errors (NOT regressions; `npm run build` still succeeds):** a handful from `api/mobile/toko/shifts/[id]` (Next.js async-params validator: `params: Promise`) + `prisma/seed-kas-bank-jatim.ts` + `prisma/seed-uat.ts`. `npx tsc --noEmit` surfaces them — ignore unless in a file you changed.

## Gotchas

- **CashBankTransaction** has nullable `paymentMethod` (`cash`/`qris`/`lainnya`) — only for operational income/expense, null for other CB types
- **Two export systems exist**: `src/lib/export-utils.ts` (primary, browser-print PDF) and `src/lib/utils/export.ts` (secondary, jsPDF) — check both before adding export features
- **Unit laporan page** (`unit/[unitSlug]/laporan/page.tsx`, ~2100 lines) is shared by ALL 10+ unit types — changes affect every unit
- **StoreSale** uses `saleNo`, `UnitTransaction` uses `transactionNo` for references
- **`StoreSaleItem.subtotal` is the LINE TOTAL** (`unitPrice × quantity`), NOT a per-unit price — don't × `quantity` when summing omzet. `costPrice` IS per-unit (×qty for HPP). `StoreSale.totalAmount` = Σ subtotal + takeaway surcharge.
- Column names are `snake_case` in DB (`@map`) but `camelCase` in Prisma models
- `StoreSale.metadata` is JSON — void check uses `NOT: { metadata: { path: ["isVoided"], equals: true } }`
- Files stored as Base64 in DB (`UploadedFile`) — Vercel has read-only filesystem
- `SystemSetting` is a singleton model (id defaults to "global")
- **NEVER include SP-IMP/* loans in CashBankTransaction** — corrupts BRI balance
- React Compiler is enabled (`babel-plugin-react-compiler`) — avoid unnecessary `useMemo`/`useCallback`
- **Billing has TWO routes** that both need changes: `api/billing/generate` (creates items) AND `api/billing/[periodId]/process` (settles items) — missing settlement handler = silent data corruption
- **Billing capture/dedup is a SNAPSHOT** — `generate` freezes items at generation time. To pull transactions made after a draft was generated (e.g. late-month potong-gaji that a member like "Bimasyah" otherwise misses), use the **`POST /api/billing/[periodId]/refresh`** endpoint (draft-only) / "Refresh" button on `/tagihan`. Capture logic lives in pure functions `extractSaleNo` + `buildBillingItems` (`lib/services/billing.ts`, unit-tested in `__tests__/billing-detection.test.ts`). Dedup covers web `TK/RS/CF/CL/PS/RC-` AND mobile `POS-M-` prefixes; cross-period dedup excludes txids already in any BillingItem. **Stage 2 (2026-06-17):** `UnitTransaction.saleNo` column is now the PRIMARY dedup key (`ut.saleNo ?? extractSaleNo(description)`); legacy salary_cut rows backfilled from descriptions (349 rows), regex kept as backward-compat fallback. To apply the schema column use `scripts/migrate-add-saleno.ts` (raw SQL — NOT `migrate dev`, which wants to RESET this baseline-less Neon DB). See specs `2026-06-16-billing-piutang-detection-fix-design.md` + `2026-06-17-billing-fk-saleno-stage2-design.md`.
- **SavingsProduct.type** supports `tabungan_haji` and `tabungan_umrah` — haji/umrah uses extended SavingsProduct (5 fields) + SavingsAccount (3 fields), 0 new Prisma models
- **UNIT_TYPES** in `constants/units.ts` has 10 units including `haji_umrah` — new unit types must be added there AND in `navigation.ts` AND in `layout.tsx` route guards
- **Prisma `aggregate()` does NOT support relation filters** — use two-step: findMany IDs first, then aggregate with `productId: { in: [...] }`. Works in `findMany`/`findFirst` but throws in `aggregate()`/`groupBy()`.
- **E2E Playwright login uses `#email` / `#password` selectors** — NOT `input[name="email"]`. See existing tests in `e2e/` for the pattern.
- **Transaction numbers must use `crypto.randomBytes()`** — never `Math.random()`. Security scanner flags it as CRITICAL. Format: `crypto.randomBytes(4).readUInt32BE(0) % 1_000_000_000`.
- **Excel export: sanitize formula injection** — user data (names, NRP) may contain leading `=+@-`. Prefix with `'` before passing to `exportToExcel`.
- **Haji & Umrah module (Phase 1 COMPLETE)** — 6 API endpoints in `api/haji-umrah/`, 7 UI pages in `(protected)/haji-umrah/`, billing Source 3 for `savings_account`, Zod schemas in `validations/haji-umrah.ts`. See `Docs-Haji-umrah-plan/README.md` for status and remaining phases.
- **`.remember/` dir** (`logs/memory-YYYY-MM-DD.log`, `today-*.md`, `remember.md` handoff, `recent.md`, `archive.md`) = `/remember:remember` skill state. Read it to reconstruct a force-closed/lost session before re-asking the user.
- **`CASH_BANK_CATEGORIES`** (`constants/index.ts`, 13 keys) is the cash-bank UI dropdown enum, NOT the full set of valid DB categories. Subsystems also write `pendapatan_toko`, `operational`, `savings`, `penalti_pelunasan`, `void_penjualan_toko`, `void_unit_transaction`, `salary_cut_settlement`. For validity checks use the `VALID_CB_CATEGORIES` superset in `anomaly-detector.ts` — naive `!isKnownCategory()` false-flags 4,000+ legit txs.
- **UI page logic isn't unit-tested directly** (no component-test harness) — extract pure logic to `src/lib/*-helpers.ts` + unit-test there (`loan-edit-helpers.ts`, `loan-void-helpers.ts`, `services/billing.ts`), then call it from the page. This is the repo's testable-UI pattern.
- **SHU `unitBreakdown` revenue dedup — exclude ONLY POS-mirror CB categories** (`pendapatan_unit`, `pendapatan_toko`; const `MIRROR_INCOME_CATEGORIES` in `shu-calculator.ts`) since they mirror StoreSale/UnitTransaction. Keep non-mirror (`operational`, `jasa_pinjaman`, `dana_resiko`). Removing ALL CB income over-excludes (= past regression).
- **SHU calculator has known OPEN bugs (not yet fixed):** summary card "Total Pendapatan" double-counts ~Rp240jt (akun 4201 journal + CB mirror); `memberRatio`/`storeContrib` + `soldItems` COGS carry the void-filter Prisma JSON NULL bug → SHU per-anggota under-counted. Diagnose via `scripts/diagnose-shu-*.ts`; details in memory `shu-pendapatan-dobel-hitung-2026`.
- **"Catat Pemasukan"** (admin, unit Laporan page → `/api/unit/[slug]/operational-income`) has Jenis: **Transaksi Customer** creates `UnitTransaction` (+CB `pendapatan_unit`) → flows to riwayat + SHU per-unit + member jasa-usaha; **Pemasukan Operasional** creates CB `operational` only (sewa/dll). Record TYPE controls visibility, not paymentMethod.

## Branches & Deploy

- **`railway-migration`** — Active dev branch, auto-deploys to Railway
- **`master`** — Main branch for PRs
- Production URL: `www.primkoppol.site`
- **Mobile UI deploys via EAS build** (`cd mobile && npx eas-cli build --platform android --profile production --non-interactive --no-wait`), NOT Railway. API changes auto-deploy on push; mobile screen changes need a new EAS build. Free-tier queue can be ~10-90 min.
- **⚠ EAS archive bloat — delete `mobile/android/` before every build.** A local `expo run:android`/`expo prebuild` generates `mobile/android/` (2.4 GB of `.gradle`/`.cxx`/build cache) that bloats the EAS tarball to ~785 MB → upload `ECONNRESET`. It's gitignored + in `.easignore` but still leaks in. `rm -rf mobile/android/` first (0 tracked files, regenerable, not needed by managed production builds) → archive drops to ~123 MB.

## Documentation

| File | Content |
|------|---------|
| `SHU-BUG-AND-UPDATE.md` | SHU module bug history & fixes (19 sections) |
| `OPERATOR.md` | Operator role audit, features, API matrix (18 sections) |
| `akun-primkoppol.md` | Test accounts for production |
| `Docs-Haji-umrah-plan/` | Haji & Umrah unit — design spec + 4 implementation plans (data/api/ui/integration) |
| `e2e/haji-umrah.spec.ts` + `e2e/haji-umrah-full.spec.ts` | Haji & Umrah E2E tests — 20 tests covering API + UI + full flow |
