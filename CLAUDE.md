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
      cuci-mobil/ resto/ cafe-lsp/
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
- **E2E:** Playwright (`e2e/`, 6 spec files)
- **Test accounts:** See `akun-primkoppol.md`

## Gotchas

- **CashBankTransaction** has nullable `paymentMethod` (`cash`/`qris`/`lainnya`) — only for operational income/expense, null for other CB types
- **Two export systems exist**: `src/lib/export-utils.ts` (primary, browser-print PDF) and `src/lib/utils/export.ts` (secondary, jsPDF) — check both before adding export features
- **Unit laporan page** (`unit/[unitSlug]/laporan/page.tsx`, ~2100 lines) is shared by ALL 10+ unit types — changes affect every unit
- **StoreSale** uses `saleNo`, `UnitTransaction` uses `transactionNo` for references
- Column names are `snake_case` in DB (`@map`) but `camelCase` in Prisma models
- `StoreSale.metadata` is JSON — void check uses `NOT: { metadata: { path: ["isVoided"], equals: true } }`
- Files stored as Base64 in DB (`UploadedFile`) — Vercel has read-only filesystem
- `SystemSetting` is a singleton model (id defaults to "global")
- **NEVER include SP-IMP/* loans in CashBankTransaction** — corrupts BRI balance
- React Compiler is enabled (`babel-plugin-react-compiler`) — avoid unnecessary `useMemo`/`useCallback`

## Branches & Deploy

- **`railway-migration`** — Active dev branch, auto-deploys to Railway
- **`master`** — Main branch for PRs
- Production URL: `www.primkoppol.site`

## Documentation

| File | Content |
|------|---------|
| `SHU-BUG-AND-UPDATE.md` | SHU module bug history & fixes (19 sections) |
| `OPERATOR.md` | Operator role audit, features, API matrix (18 sections) |
| `akun-primkoppol.md` | Test accounts for production |
