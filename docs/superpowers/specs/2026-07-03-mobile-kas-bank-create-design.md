# Mobile Kas/Bank Create + Transfer — Design Spec (Fase 7a)

**Date:** 2026-07-03
**Status:** Design approved (full 13-category mirror, no Cuci Mobil split, operator/admin/admin_sp gate); pending spec review → plan
**Branch:** `railway-migration` (auto-deploys API on push; mobile UI deploys via EAS build)
**Phase:** Fase 7a (first half of Fase 7 field-ops). Follows Fase 6 (Piutang Gabungan). Fase 7b (generic per-unit laporan) is a separate later spec.

## Problem

Mobile `KasBankScreen` is **view-only** (it calls `GET /api/mobile/kas-bank` for totals/accounts/latest txns, scoped via `branchListFilter` from Fase 4c). Field operators cannot record a cash/bank transaction (pemasukan/pengeluaran) or transfer between accounts from the phone — they must use the web. The web has full create (`kas-bank/transaksi/tambah` → `POST /api/cash-bank/transactions`) + transfer (`kas-bank/transfer` → `POST /api/cash-bank/transfers`) flows.

## Goal

Ship the mobile mirror: two new write APIs + two form screens + nav buttons, so operator/admin/admin_sp can create a CashBankTransaction and transfer between accounts on mobile — with the Fase 4b branch scope applied (the web POST has NO role gate + NO branch filter, a latent money-integrity gap; mobile fixes both).

## Approach

Mirror the web create/transfer logic in two new mobile POST routes, but: (a) add the operator/admin/admin_sp role gate + `canAccessBranch` scope the web lacks, (b) use `crypto.randomBytes()` for txn numbers (web uses `Math.random()` — repo rule violation), (c) reuse the existing `detectCategoryMismatch` guard + web Zod schemas (no duplication), (d) keep mobile create to **simple transactions** (no `unitType`/`memberId` → the Cuci Mobil auto-split ledger does not trigger; Cuci Mobil sales stay in unit POS). Web routes are untouched (mobile-only mirror + helpers, per the Fase 6 precedent).

## Components

### 7a-1 — Txn-number helper `src/lib/services/cash-bank-txn-no.ts` (TDD)

Pure, crypto-based. Mobile's single source for CB txn numbers (web keeps its own `Math.random` version — out of scope).

```ts
import { randomBytes } from "crypto";

const crypto6 = () => randomBytes(4).readUInt32BE(0) % 1_000_000; // 6-digit

export function generateCashBankTxnNo(type: "in" | "out", year: number): string {
  const prefix = type === "in" ? "CBM" : "CBK";   // CBM = masuk, CBK = keluar
  return `${prefix}-${year}-${String(crypto6()).padStart(6, "0")}`;
}

export function generateTransferTxnNo(year: number): string {
  return `TRF-${year}-${String(crypto6()).padStart(6, "0")}`;
}
```
Unit-test: format (prefix/year/6-digit zero-padded), `type==="in"`→CBM, `"out"`→CBK, transfer→TRF, uniqueness over N samples (crypto source). (`transactionNo` is `@unique` → a collision throws a hard 500, never silent corruption; crypto makes it negligible.)

### 7a-2 — Create API `POST /api/mobile/kas-bank/transactions`

**File:** `src/app/api/mobile/kas-bank/transactions/route.ts` (import `getMobileUserWithScope` from `../../middleware`, `canAccessBranch` from `@/lib/mobile-auth-scope`, `createCashBankTransactionSchema` from `@/lib/validations`, `detectCategoryMismatch` from `@/lib/services/cash-bank-category-guard`, `generateCashBankTxnNo` from `@/lib/services/cash-bank-txn-no`).

**Gate + scope (the web lacks both — mobile fixes):**
```ts
const user = await getMobileUserWithScope(request);
if (!user || !["operator", "admin", "admin_sp"].includes(user.role)) return 403;
```
1. Parse + validate body with `createCashBankTransactionSchema` (reuse web Zod — fields: `accountId, type:"in"|"out", category?, amount, description?, transactionDate?, confirmMiscat?, miscatReason?`). **Do NOT send `unitType`/`memberId`** (mobile = simple tx; they're omitted so the Cuci Mobil split never triggers).
2. Load the `CashBankAccount` (accountId). `canAccessBranch(user, account.branchId)` → fail-closed 403 if not in scope (operator bypass). Account must be `isActive`.
3. **`detectCategoryMismatch` guard** (reuse): if it flags a mismatch and `!confirmMiscat` → 400 `{ requiresConfirm: true, message }`. If `confirmMiscat` → require `miscatReason` (≥3 chars) (the Zod `.refine` enforces this).
4. For `type==="out"`: balance sufficiency — `amount > account.currentBalance` → 400.
5. `$transaction`: create `CashBankTransaction` with `transactionNo = generateCashBankTxnNo(type, year)`, `branchId = account.branchId`, `balanceBefore/After` snapshot, `createdById = user.id`, `transactionDate`; update `account.currentBalance` (+=amount for in, -=amount for out). **No journal, no split** (parity with web).
6. Return `{ data: { transaction, account: { currentBalance } } }`, 201.
7. catch → `{ message }` 500 (log via `console.error` — server-side, matches siblings; NOT mobile `log.*`).

### 7a-3 — Transfer API `POST /api/mobile/kas-bank/transfers`

**File:** `src/app/api/mobile/kas-bank/transfers/route.ts`

**Gate:** operator/admin/admin_sp (same as create). Validate with `createTransferSchema` (reuse — fields: `fromAccountId, toAccountId, amount, description?, transactionDate`).
1. Load both accounts. `canAccessBranch` on BOTH (operator bypass). Both `isActive`.
2. `fromAccountId === toAccountId` → 400. `amount > fromAccount.currentBalance` → 400.
3. `$transaction`: create 2 `CashBankTransaction` rows — OUT on fromAccount (`transactionNo = generateTransferTxnNo + "-OUT"`... actually web uses one `TRF-…` base; mirror web: OUT `TRF-{year}-{n}-OUT`, IN `TRF-{year}-{n}-IN`, category `"transfer"`), balanceBefore/After each, update both `currentBalance`. Each gets its own `branchId` from its account (cross-branch transfers allowed, matching web).
4. Return `{ data: { outTransaction, inTransaction } }`, 201. catch → 500.

### 7a-4 — Account-picker data (reuse existing GET)

The create/transfer forms need the account list. **Reuse `GET /api/mobile/kas-bank`** (already branch-scoped via `branchListFilter`, returns `accounts[]` with id/name/type/bankName/currentBalance). No new GET endpoint.

### 7a-5 — Screens

- **`mobile/src/screens/operator/KasBankTransaksiScreen.tsx`** (create form): account picker (from GET /api/mobile/kas-bank `accounts`), type toggle Masuk/Keluar, category dropdown (`CASH_BANK_CATEGORIES` filtered by `cat.type === type || "both"`, + "Tanpa Kategori"), amount, description, date (default today), **miscat preview** (run `detectCategoryMismatch` client-side if importable into RN — else show the server's `requiresConfirm` response with a confirm+reason UI). Submit → `POST /api/mobile/kas-bank/transactions`. Success → toast + go back. Use `log.*` (no `console.*`).
- **`mobile/src/screens/operator/KasBankTransferScreen.tsx`** (transfer form): from-account picker, to-account picker, amount, description, date. Self-transfer + sufficiency guarded. Submit → `POST /api/mobile/kas-bank/transfers`.
- **`KasBankScreen.tsx`** (existing, modify): add "Transaksi Baru" + "Transfer" buttons (header or FAB), gated to operator/admin/admin_sp, navigating to the new screens.
- **`App.tsx`**: register `KasBankTransaksi` + `KasBankTransfer` routes.

### 7a-6 — RBAC summary
- Both POST routes: operator/admin/admin_sp gate + `canAccessBranch` on the target account(s) (operator bypass, fail-closed 403). This is a **write** route → Fase 4b scope rules apply (`canAccessBranch`, not just a role list).
- Dashboard/KasBankScreen buttons: visible to operator/admin/admin_sp only.

## Money-integrity checklist
- ✅ `crypto.randomBytes()` txn numbers (repo rule; web's `Math.random` is pre-existing, out of scope).
- ✅ `detectCategoryMismatch` guard reused server-side (prevents the Rp620M SHU-inflation class of bug).
- ✅ `$transaction` atomicity (balance snapshot + update together).
- ✅ Balance sufficiency check for outflows + transfers.
- ✅ `branchId` sourced from the **account**, not user input → cannot post cross-branch (scope-enforced) or forge a branchId.
- ✅ No `unitType`/`memberId` → Cuci Mobil split never triggers from mobile (simple tx only).
- ✅ No SP-IMP loan inclusion (this route doesn't touch loans).
- ⚠ Web parity gap accepted: no Journal entry (web doesn't write one either).

## Test plan
- **Unit (Vitest):** `cash-bank-txn-no.ts` — format/prefix/padding/uniqueness. (detectCategoryMismatch + Zod are reused, already covered by web tests — do not re-test.)
- **Manual:** create Masuk/Keluar with each category; miscat guard blocks then allows with reason; outflow > balance blocked; transfer self/insufficient blocked; balance updates correct; kasir gets 403 + no buttons; admin scoped to own-branch account only (cross-branch account → 403).

## Conventions / constraints
- Repo testable-UI pattern: pure helper (`cash-bank-txn-no.ts`) unit-tested; routes = orchestration; screens = presentation.
- Reuse web Zod (`createCashBankTransactionSchema`, `createTransferSchema`) + `CASH_BANK_CATEGORIES` + `detectCategoryMismatch` — import, don't duplicate.
- `getMobileUserWithScope` import depth: `../../middleware` (the new routes are at `mobile/kas-bank/{transactions,transfers}/route.ts` — 2 levels up to `mobile/middleware.ts`, same as the sibling `reports/piutang-gabungan/route.ts`).
- `log.*` only in mobile screens; `console.error` in server routes (sibling convention).
- Web `api/cash-bank/transactions` + `transfers` routes UNTOUCHED (mobile-only mirror).
- API deploys via Railway push; screens ship via a future EAS build (#4).

## Open items to confirm at implementation time
- Whether `detectCategoryMismatch` + `CASH_BANK_CATEGORIES` are safely importable into the RN bundle for client-side preview (these are server-side libs under `src/lib/` and may transitively import prisma/next — RN can't bundle those). If not importable, rely on the server `requiresConfirm` response only (the server guard is the source of truth regardless). Likely outcome: server-only guard.
- Account-picker fields (VERIFIED): `GET /api/mobile/kas-bank` returns `accounts: [{id, code, name, type, bankName, accountNumber, currentBalance}]` — already branch-scoped via `branchListFilter` (no `branchId` in the response, but none needed: the POST routes load the full account from DB and re-verify `canAccessBranch(user, account.branchId)` server-side).
