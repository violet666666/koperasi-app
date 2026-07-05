# Fase 9a.1 — Mobile Haji/Umrah: Tabungan Core (Design Spec)

> **Parity task.** Web H&U module (Phases 1-4) is complete; mobile has ZERO H&U endpoints/screens. This spec covers the first mobile increment — the savings (tabungan) money-core. Talangan / Bagi Hasil / Products-CRUD / Laporan defer to 9a.2-9a.4.

**Goal:** Mobile staff (operator + admin `haji_umrah`) can list H&U savings accounts, view account detail (balance/target/progress + deposit history), make a **setoran** (deposit — money-moving, atomic), and open a new rekening (buka rekening) — full parity with the web tabungan flows.

**Architecture:**
- **DRY money-core:** extract the web setoran `$transaction` (SavingsTransaction + balance + CashBook postings) into a shared helper `src/lib/services/haji-umrah-savings.ts` (`processHajiUmrahDeposit`), which web + mobile both call. Same pattern as Fase 8c (payroll) / 8b (loan-edit): shared helper = single source of truth for money logic; web refactor is **behavior-preserving (byte-identical)**. Buka-rekening (`createHajiUmrahAccount`) also extracted (cheap, avoids accountNo/validation drift).
- **Mobile routes** under `/api/mobile/haji-umrah/*` with JWT auth (`getMobileUserWithScope`), mirroring web routes' request/response shapes.
- **4 screens** following proven mobile patterns (flatlist + form, like PayrollImportScreen / AsetFormScreen / GajiPeriodeScreen).

**Tech Stack:** Next.js route handlers, Prisma 6, Expo 55 / RN 0.83, react-hook-form + Zod (mobile forms).

## Global Constraints

- **Web setoran refactor is BEHAVIOR-PRESERVING.** The `$transaction` (SavingsTransaction create → SavingsAccount.balance update → CashBankTransaction for deposit [category `savings`, unitType `simpan_pinjam`] → optional CashBankTransaction for admin fee [category `pendapatan_unit`, unitType `haji_umrah`] → CashBankAccount balance updates) moves VERBATIM to `processHajiUmrahDeposit`. The pre-existing inconsistency (deposit unitType `simpan_pinjam` vs fee unitType `haji_umrah`) is preserved as-is — NOT "fixed". Response shape byte-identical.
- **TxnNo = `crypto.randomBytes`** (format `HU-{year}-{9-digit}` for SavingsTransaction, `CBT-{savingsTxNo}` / `CBT-{savingsTxNo}-FEE` for CashBook). Never `Math.random`.
- **Atomicity:** setoran is a single `$transaction` (saldo + CashBook integrity — same requirement as Fase 2). Buka-rekening is a plain `create` (balance starts at 0, no CashBook) — web parity.
- **RBAC:** reads (list/detail/products) = any authenticated staff (operator/admin/admin_sp). Writes (setoran/buka-rekening) = `operator` OR (`admin` AND `unitType === "haji_umrah"`) — matches web. `anggota` excluded from setoran (web parity). No branch scope (H&U is org-wide per unit).
- **No tarik/withdrawal** — web has no H&U withdrawal endpoint; mobile parity is deposit-only. (If a withdrawal is needed later, it's a web+mobile feature, not a mobile gap.)
- **DRY:** `processHajiUmrahDeposit` + `createHajiUmrahAccount` + the H&U product-type constants (`HAJI_UMRAH_TYPES`) + accountNo format live in `src/lib/services/haji-umrah-savings.ts` = single source. Web + mobile both import.
- **Member portal H&U is OUT of scope** (web Phase 3 is member-facing; mobile member-portal parity is a separate task). 9a.1 = staff operations only.
- `log.*` only in mobile screens; `console.error` only in server routes.
- **branch** = `railway-migration` (API auto-deploys on push; screens ship via EAS build #6).

---

## Data Model (existing — no schema changes)

- **SavingsProduct** (`type` ∈ `tabungan_haji` | `tabungan_umrah`): `code`, `name`, `minimumAmount`, `targetAmount`, `adminFeeType` (`percent`|`fixed`), `adminFeeValue`, `linkedBankName` (default "BSI"), `isActive`. + extended fields on the model.
- **SavingsAccount**: `accountNo` (`HU-{memberId}-{productId}-{ts4}`), `balance`, `targetAmount`, `monthlyTarget`, `maturityDate`, `status` (`active`|`closed`), relations `member`, `product`, `transactions`.
- **SavingsTransaction**: `amount`, `type` (`deposit`|`interest`|`...`), `paymentMethod`, `referenceNo`, `notes`, `transactionDate`, `adminFee`, `status` (`completed`|`voided`), `createdById`, `cashBankAccountId`.
- **CashBankTransaction** / **CashBankAccount**: posted by setoran (deposit `in` + optional fee `in`).

## API Design — Mobile Endpoints (mirror web shapes)

| # | Method + Path | Web counterpart | Body/Query | RBAC |
|---|---------------|-----------------|------------|------|
| 1 | `GET /api/mobile/haji-umrah/savings` | web GET `/savings` | q: `page,perPage,search,type,status` | any staff |
| 2 | `GET /api/mobile/haji-umrah/savings/[accountId]` | web GET `/savings/[id]` | path: `accountId` | any staff |
| 3 | `POST /api/mobile/haji-umrah/savings/[accountId]/transactions` | web POST `/savings/[id]/transactions` | `{ amount>0, paymentMethod?, cashBankAccountId?, referenceNo?, notes?, transactionDate? }` | operator OR admin haji_umrah (NOT anggota) |
| 4 | `POST /api/mobile/haji-umrah/savings` | web POST `/savings` | `{ memberId, productId, targetAmount?, monthlyTarget?, maturityDate? }` | operator OR admin haji_umrah |
| 5 | `GET /api/mobile/haji-umrah/products` | web GET `/products` | — | any staff (for buka-rekening form picker) |

- **Response shapes byte-identical to web** (list: `{ data: enriched[], meta }`; detail: `{ data: {...account, balance, target, progress, monthlyTarget, stats, transactions} }`; setoran: `{ data: SavingsTransaction, meta: { adminFee, balanceAfter, target, progress, isTargetReached } }`; buka-rekening: `{ data: SavingsAccount }` 201 / 409 duplicate; products: `{ data: SavingsProduct[] }`).
- Endpoint #3 (setoran) + #4 (buka-rekening) call the shared helpers (T1). Endpoint #5 + reads are thin wrappers over Prisma (mirror web).
- Reuse existing mobile members list API for the buka-rekening member picker (do NOT build a new one).
- `PayrollImportError`-style typed error not needed — web uses inline 400/409 returns; mobile mirrors (a small `HajiUmrahSavingsError` ONLY if extraction requires it, else inline throws caught by the route).

## Money-Integrity (the setoran $transaction — single source)

`processHajiUmrahDeposit({ accountId, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId })`:
1. Load account + product (validate active, not closed).
2. Compute adminFee from product (`percent` of amount or `fixed`).
3. `$transaction`: create SavingsTransaction (type `deposit`, `HU-{year}-{9}` txnNo via crypto); `SavingsAccount.balance += amount`; if `cashBankAccountId`: CashBankTransaction `in` category `savings` unitType `simpan_pinjam` (deposit) + CashBankAccount balance update; if adminFee > 0 AND cashBankAccountId: second CashBankTransaction `in` category `pendapatan_unit` unitType `haji_umrah` (fee) + balance update.
4. Return `{ transaction, meta: { adminFee, balanceAfter, target, progress, isTargetReached } }`.
5. WIB date handling for bare `YYYY-MM-DD` (`+07:00`) — preserved verbatim.

`createHajiUmrahAccount({ memberId, productId, targetAmount?, monthlyTarget?, maturityDate?, userId? })`:
- Validate member + product (product type ∈ H&U); 409 on duplicate memberId+productId.
- `accountNo = HU-{memberId}-{productId}-{4-digit}`; `balance = 0`; defaults from product.
- Return SavingsAccount.

Both helpers are `async`, do their own validation (throwing → route maps to 400/409), and are the ONLY place this money/account logic lives.

## Screen Design (4 screens + nav)

1. **HajiUmrahScreen** (account list) — FlatList of accounts: member name, product badge (Haji/Umrah), balance vs target, progress bar. Search + type filter chips (Semua/Haji/Umrah). FAB "+ Buka Rekening" (operator/admin haji_umrah). Tap row → detail. Pull-to-refresh.
2. **HajiUmrahDetailScreen** — header card (balance/target/progress/maturity countdown/monthly target) + stats (total deposits, monthly, deposit count) + transaction history list (amount, type, date, admin fee). "Setoran" button (operator/admin haji_umrah) → setoran screen. Void NOT in scope (web void is via SavingsTransaction void — defer).
3. **HajiUmrahSetoranScreen** — form: amount (required >0), paymentMethod (Tunai/QRIS/Lainnya), cashBankAccount picker (optional — if none, no CashBook post + warning), referenceNo, notes, transactionDate (default today). Submit → POST setoran → success toast (balanceAfter + progress) → goBack. Surface 400/409.
4. **HajiUmrahBukaRekeningScreen** — form: member picker (searchable), product picker (from GET products, H&U types only), targetAmount, monthlyTarget, maturityDate. Submit → POST buka-rekening → success → goBack. Surface 409 duplicate.

**Nav:** operator/admin/admin_sp dashboard menu entry "Haji & Umrah" → HajiUmrahScreen. App.tsx route wiring (4 routes). Gate: `userRole === "operator" || userRole === "admin" || userRole === "admin_sp"` (admin effectively only useful if unitType haji_umrah, but menu visibility is role-based; server enforces the unit gate on writes).

## Out of Scope (defer to 9a.2-9a.4)

- Talangan (list/gap/apply/detail) → 9a.2
- Bagi Hasil (list/process/void/detail) → 9a.3
- Products CRUD (create/edit product) → 9a.4 (9a.1 only READs products for the picker)
- Laporan (5 sub-reports) → 9a.4
- Transaction void / reversal → future
- Member-portal H&U view → separate parity task
- Withdrawal (tarik) → no web counterpart

## Open Decisions (resolved)

- **DRY vs duplicate for setoran:** DRY-extract (`processHajiUmrahDeposit`) — matches Fase 8b/8c pattern; money logic single-source. Web refactor = behavior-preservation task (highest risk, opus-reviewed).
- **Buka-rekening extraction:** extract (`createHajiUmrahAccount`) — cheap, avoids accountNo drift.
- **Timeout:** setoran is a single deposit (fast) — default 15s axios timeout fine (no 5-min needed, unlike payroll bulk import).
- **Field-contract:** screen reads will be audited against the actual route responses (Fase 6 lesson).

## Risks

- **Web setoran refactor behavior-preservation** (#1 risk — money path). Mitigated by: verbatim extraction + opus byte-identical review (like Fase 8c T2).
- **CashBook category/unitType drift** — must preserve `savings`/`simpan_pinjam` (deposit) + `pendapatan_unit`/`haji_umrah` (fee) exactly. Pre-existing inconsistency preserved.
- **Screen↔route field contract** — Fase 6 recurring bug. Mitigated by: read actual route responses, match field names exactly.
