# Mobile Kas/Bank Create + Transfer — Implementation Plan (Fase 7a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operator/admin/admin_sp create a CashBankTransaction and transfer between accounts from mobile — mirroring web `POST /api/cash-bank/transactions` + `POST /api/cash-bank/transfers`, but with the role gate + branch scope the web lacks, crypto txn numbers, and the SHU-integrity category guard.

**Architecture:** Pure crypto txn-no helper (TDD); two mobile POST routes that reuse web Zod + `detectCategoryMismatch`; two RN form screens; nav buttons on the existing KasBankScreen. No new Prisma models, no new npm deps.

**Tech Stack:** Next.js route handlers, Prisma 6, Vitest, Expo 55 / RN 0.83.

**Spec:** `docs/superpowers/specs/2026-07-03-mobile-kas-bank-create-design.md`

## Global Constraints (verbatim from spec)

- **RBAC:** operator + admin + admin_sp gate on BOTH POST routes, PLUS `canAccessBranch(user, account.branchId)` on the target account(s) (operator bypass, fail-closed 403). This is a WRITE route → Fase 4b scope rules.
- **Txn numbers:** `crypto.randomBytes()` (repo rule). Web uses `Math.random()` — do NOT copy that. Use the T1 helper.
- **Reuse, don't duplicate:** `createCashBankTransactionSchema` + `createTransferSchema` from `@/lib/validations`; `CASH_BANK_CATEGORIES` from `@/lib/constants`; `detectCategoryMismatch(type, category, description)` from `@/lib/services/cash-bank-category-guard`.
- **`detectCategoryMismatch` signature:** positional `(type, category, description)` → `{signal, suggestedCategory, message} | null`. Fires only for `type==="out"` + at-risk expense category + keyword in description.
- **Mobile = simple tx only:** do NOT pass `unitType`/`memberId` → the Cuci Mobil split ledger must NOT trigger. (Web routes untouched.)
- **`branchId` from the account**, never user input. `createdById = Number(user.id)` (mobile JWT `id` is a string).
- `$transaction` atomicity; re-read the account inside the tx for the balance snapshot (avoids the read-then-write race). No journal entry (web parity).
- `getMobileUserWithScope` import depth: `../../middleware` (routes at `mobile/kas-bank/{transactions,transfers}/route.ts`, 2 levels up).
- `log.*` only in mobile screens; `console.error` in server routes (sibling convention). No raw `console.*` in mobile source.
- `branch` = `railway-migration` (API auto-deploys on push; screens ship via future EAS build #4).

---

### Task 1: Txn-number helper `cash-bank-txn-no.ts` (TDD)

**Files:**
- Create: `src/lib/services/cash-bank-txn-no.ts`
- Test: `src/__tests__/cash-bank-txn-no.test.ts`

- [ ] **Step 1: Write the failing tests**
```ts
import { describe, it, expect } from "vitest";
import { generateCashBankTxnNo, generateTransferTxnNo } from "@/lib/services/cash-bank-txn-no";

describe("generateCashBankTxnNo", () => {
  it("in → CBM-{year}-{6digit}", () => {
    const n = generateCashBankTxnNo("in", 2026);
    expect(n).toMatch(/^CBM-2026-\d{6}$/);
  });
  it("out → CBK-{year}-{6digit}", () => {
    expect(generateCashBankTxnNo("out", 2026)).toMatch(/^CBK-2026-\d{6}$/);
  });
  it("6-digit segment is zero-padded", () => {
    // run several; all must be exactly 6 digits
    for (let i = 0; i < 50; i++) {
      const seg = generateCashBankTxnNo("in", 2026).split("-")[2];
      expect(seg).toMatch(/^\d{6}$/);
    }
  });
  it("produces high uniqueness over 1000 samples", () => {
    const set = new Set<string>();
    for (let i = 0; i < 1000; i++) set.add(generateCashBankTxnNo("in", 2026));
    expect(set.size).toBeGreaterThan(900); // crypto → near-unique
  });
});

describe("generateTransferTxnNo", () => {
  it("→ TRF-{year}-{6digit}", () => {
    expect(generateTransferTxnNo(2026)).toMatch(/^TRF-2026-\d{6}$/);
  });
});
```

- [ ] **Step 2: Run → FAIL** (`npx vitest run src/__tests__/cash-bank-txn-no.test.ts`, module not found).

- [ ] **Step 3: Implement**
```ts
// Pure crypto-based txn-number generator for mobile Kas/Bank (web keeps its own Math.random version).
import { randomBytes } from "crypto";

const crypto6 = (): string => String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");

export function generateCashBankTxnNo(type: "in" | "out", year: number): string {
  const prefix = type === "in" ? "CBM" : "CBK"; // CBM = masuk (debit), CBK = keluar (kredit)
  return `${prefix}-${year}-${crypto6()}`;
}

export function generateTransferTxnNo(year: number): string {
  return `TRF-${year}-${crypto6()}`;
}
```

- [ ] **Step 4: Run → PASS** (6 tests).
- [ ] **Step 5: tsc + commit**
```bash
npx tsc --noEmit   # repo root, clean in new file
git -C /c/Users/Acer/Downloads/koperasi-app add src/lib/services/cash-bank-txn-no.ts src/__tests__/cash-bank-txn-no.test.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(cash-bank): crypto txn-number helper + tests (Fase 7a T1)"
```

---

### Task 2: Create API `POST /api/mobile/kas-bank/transactions`

**File:** `src/app/api/mobile/kas-bank/transactions/route.ts`

- [ ] **Step 1: Implement** (mirror web POST `/api/cash-bank/transactions` minus the Cuci Mobil split, plus mobile gate + scope + crypto)
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { createCashBankTransactionSchema } from "@/lib/validations";
import { detectCategoryMismatch } from "@/lib/services/cash-bank-category-guard";
import { generateCashBankTxnNo } from "@/lib/services/cash-bank-txn-no";

export async function POST(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin/Admin SP yang dapat mencatat transaksi kas/bank" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = createCashBankTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    // Mobile = simple tx. Explicitly ignore unitType/memberId if a client ever sends them (no Cuci Mobil split).

    const account = await prisma.cashBankAccount.findFirst({
      where: { id: d.accountId, isActive: true, deletedAt: null },
    });
    if (!account) return NextResponse.json({ message: "Akun kas/bank tidak ditemukan" }, { status: 404 });
    if (!canAccessBranch(user, account.branchId)) {
      return NextResponse.json({ message: "Akses ditolak: akun di luar scope anda" }, { status: 403 });
    }

    // SHU-integrity guard (reused). Fires only for type=out + at-risk expense category + keyword.
    const mismatch = detectCategoryMismatch(d.type, d.category, d.description);
    if (mismatch && !d.confirmMiscat) {
      return NextResponse.json(
        { requiresConfirm: true, message: mismatch.message, suggestedCategory: mismatch.suggestedCategory },
        { status: 400 },
      );
    }

    const amount = Number(d.amount);
    const txDate = d.transactionDate ? new Date(d.transactionDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside tx for an accurate balance snapshot (avoid read-then-write race).
      const fresh = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: account.id } });
      const balanceBefore = Number(fresh.currentBalance);
      if (d.type === "out" && amount > balanceBefore) throw new Error("SALDO_KURANG");
      const balanceAfter = d.type === "in" ? balanceBefore + amount : balanceBefore - amount;
      const created = await tx.cashBankTransaction.create({
        data: {
          transactionNo: generateCashBankTxnNo(d.type, txDate.getFullYear()),
          accountId: fresh.id,
          branchId: fresh.branchId,
          type: d.type,
          category: d.category ?? null,
          amount,
          balanceBefore,
          balanceAfter,
          description: d.description ?? null,
          transactionDate: txDate,
          createdById: Number(user.id),
        },
      });
      await tx.cashBankAccount.update({ where: { id: fresh.id }, data: { currentBalance: balanceAfter } });
      return { created, balanceAfter };
    });

    return NextResponse.json({ data: { transaction: result.created, currentBalance: result.balanceAfter } }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "SALDO_KURANG") return NextResponse.json({ message: "Saldo tidak mencukupi" }, { status: 400 });
    console.error("POST /api/mobile/kas-bank/transactions error:", err);
    return NextResponse.json({ message: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
```
**Verify at impl time:** confirm `createCashBankTransactionSchema` is exported from `@/lib/validations` (it is per spec; if the export is from `@/lib/validations/index.ts` use that). Confirm `Number(user.id)` is correct (mobile JWT `id` is a string; `CashBankTransaction.createdById` is Int). The `console.error` is correct (server-side).

- [ ] **Step 2: tsc** (`npx tsc --noEmit`, repo root) — no new errors.
- [ ] **Step 3: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/app/api/mobile/kas-bank/transactions/route.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): POST /kas-bank/transactions create (Fase 7a T2)"
```

---

### Task 3: Transfer API `POST /api/mobile/kas-bank/transfers`

**File:** `src/app/api/mobile/kas-bank/transfers/route.ts`

- [ ] **Step 1: Implement** (mirror web POST `/api/cash-bank/transfers`)
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { createTransferSchema } from "@/lib/validations";
import { generateTransferTxnNo } from "@/lib/services/cash-bank-txn-no";

export async function POST(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin/Admin SP yang dapat transfer" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    if (d.fromAccountId === d.toAccountId) {
      return NextResponse.json({ message: "Akun asal dan tujuan tidak boleh sama" }, { status: 400 });
    }

    const [fromAcct, toAcct] = await Promise.all([
      prisma.cashBankAccount.findFirst({ where: { id: d.fromAccountId, isActive: true, deletedAt: null } }),
      prisma.cashBankAccount.findFirst({ where: { id: d.toAccountId, isActive: true, deletedAt: null } }),
    ]);
    if (!fromAcct || !toAcct) return NextResponse.json({ message: "Akun asal/tujuan tidak ditemukan" }, { status: 404 });
    if (!canAccessBranch(user, fromAcct.branchId) || !canAccessBranch(user, toAcct.branchId)) {
      return NextResponse.json({ message: "Akses ditolak: akun di luar scope anda" }, { status: 403 });
    }

    const amount = Number(d.amount);
    const txDate = d.transactionDate ? new Date(d.transactionDate) : new Date();
    const year = txDate.getFullYear();
    const base = generateTransferTxnNo(year);

    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: fromAcct.id } });
      const to = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: toAcct.id } });
      const fromBefore = Number(from.currentBalance);
      if (amount > fromBefore) throw new Error("SALDO_KURANG");
      const fromAfter = fromBefore - amount;
      const toAfter = Number(to.currentBalance) + amount;

      const out = await tx.cashBankTransaction.create({
        data: {
          transactionNo: `${base}-OUT`, accountId: from.id, branchId: from.branchId,
          type: "out", category: "transfer", amount, balanceBefore: fromBefore, balanceAfter: fromAfter,
          description: d.description ?? `Transfer ke ${to.name}`, transactionDate: txDate, createdById: Number(user.id),
        },
      });
      const inn = await tx.cashBankTransaction.create({
        data: {
          transactionNo: `${base}-IN`, accountId: to.id, branchId: to.branchId,
          type: "in", category: "transfer", amount, balanceBefore: Number(to.currentBalance), balanceAfter: toAfter,
          description: d.description ?? `Transfer dari ${from.name}`, transactionDate: txDate, createdById: Number(user.id),
        },
      });
      await tx.cashBankAccount.update({ where: { id: from.id }, data: { currentBalance: fromAfter } });
      await tx.cashBankAccount.update({ where: { id: to.id }, data: { currentBalance: toAfter } });
      return { out, in: inn };
    });

    return NextResponse.json({ data: { outTransaction: result.out, inTransaction: result.in } }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "SALDO_KURANG") return NextResponse.json({ message: "Saldo asal tidak mencukupi" }, { status: 400 });
    console.error("POST /api/mobile/kas-bank/transfers error:", err);
    return NextResponse.json({ message: "Gagal memproses transfer" }, { status: 500 });
  }
}
```
**Verify at impl time:** `createTransferSchema` export path; `Number(user.id)`; transactionNo `@unique` — the `-OUT`/`-IN` suffix guarantees the pair differs (web does the same). Cross-branch allowed (each side uses its own branchId), matching web.

- [ ] **Step 2: tsc** — no new errors.
- [ ] **Step 3: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add src/app/api/mobile/kas-bank/transfers/route.ts
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile-api): POST /kas-bank/transfers (Fase 7a T3)"
```

---

### Task 4: Screens `KasBankTransaksiScreen` + `KasBankTransferScreen`

**Files:**
- Create: `mobile/src/screens/operator/KasBankTransaksiScreen.tsx`
- Create: `mobile/src/screens/operator/KasBankTransferScreen.tsx`

**Read first for conventions:** `mobile/src/screens/operator/KasBankScreen.tsx` (existing — api client, `formatRp`, `C` colors, account shape), an existing form screen for input patterns (e.g. `DirectDisburseScreen.tsx`), `mobile/src/lib/api.ts`, `mobile/src/utils/log.ts`. **Account list:** call `GET /api/mobile/kas-bank` → `res.data.data.accounts` = `[{id, code, name, type, bankName, accountNumber, currentBalance}]` (already branch-scoped). **Categories** are NOT importable into RN (server-side `@/lib/constants` may pull prisma/next) — hardcode the CASH_BANK_CATEGORIES list in the screen (mirror the spec's 13-key table) filtered by `cat.type === type || "both"`, + a "Tanpa Kategori" (`"none"`) option.

**KasBankTransaksiScreen (create form):**
- Account picker (from GET accounts). Type toggle Masuk(`in`)/Keluar(`out`). Category dropdown (filtered by type). Amount (numeric). Description. Date (default today, editable).
- **Miscat handling:** the guard runs server-side. On a `400 { requiresConfirm: true, message, suggestedCategory }` response, show the message + a "Tetap catat dengan alasan" confirm UI (TextInput for `miscatReason`, then re-submit with `confirmMiscat: true`). Do NOT try to import `detectCategoryMismatch` into RN.
- Submit → `POST /api/mobile/kas-bank/transactions` with `{ accountId, type, category: category==="none"?undefined:category, amount, description, transactionDate, confirmMiscat, miscatReason }`. Success → toast + `navigation.goBack()`. Use `log.*`.
- Outflow > balance: the server returns 400 "Saldo tidak mencukupi" — surface as toast.

**KasBankTransferScreen (transfer form):**
- From-account picker, to-account picker (same GET accounts list; exclude selected from-account from the to-picker). Amount. Description. Date.
- Submit → `POST /api/mobile/kas-bank/transfers` with `{ fromAccountId, toAccountId, amount, description, transactionDate }`. Surface self-transfer / insufficient errors from the server.

- [ ] **Step 1: Read the convention files.**
- [ ] **Step 2: Implement both screens.** Match existing screen styling (cards, inputs, pickers, `formatRp`, `C`). `log.*` only.
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) — no new errors. Grep `console.*` → 0 in both files.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/src/screens/operator/KasBankTransaksiScreen.tsx mobile/src/screens/operator/KasBankTransferScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): KasBank create + transfer screens (Fase 7a T4)"
```

---

### Task 5: Nav wiring — KasBankScreen buttons + App.tsx routes

**Files:**
- Modify: `mobile/src/screens/operator/KasBankScreen.tsx` — add "Transaksi Baru" + "Transfer" buttons (header or FAB), gated to operator/admin/admin_sp, navigating to `KasBankTransaksi` / `KasBankTransfer`.
- Modify: `mobile/App.tsx` — register `KasBankTransaksi` + `KasBankTransfer` routes (lazy import, same pattern as sibling screens).

- [ ] **Step 1: Add the 2 routes in App.tsx** (Screen entries + lazy imports, mirroring e.g. `DirectDisburse`/`Kompen` registration).
- [ ] **Step 2: Add buttons in KasBankScreen** — gate with the user's role from `StorageManager.getFastString("userData")` (same `userRole` pattern DashboardScreen uses). Confirm route-name strings match EXACTLY between App.tsx `name=` and `navigation.navigate(...)`.
- [ ] **Step 3: tsc** (`cd mobile && npx tsc --noEmit`) — no new errors.
- [ ] **Step 4: commit**
```bash
git -C /c/Users/Acer/Downloads/koperasi-app add mobile/App.tsx mobile/src/screens/operator/KasBankScreen.tsx
git -C /c/Users/Acer/Downloads/koperasi-app commit -m "feat(mobile): wire KasBank create+transfer nav (Fase 7a T5)"
```

---

## After T1–T5 → final opus review + push
1. Final whole-branch opus review over `6f0affe7..HEAD`.
2. Full test suite (`npm test`) — expect baseline + the new `cash-bank-txn-no` tests.
3. `finishing-a-development-branch`: push `railway-migration` (deploys the 2 new mobile POST endpoints). Screens ship via future EAS build #4.

## Notes for the final whole-branch review
- Confirm both POST routes gate operator/admin/admin_sp + `canAccessBranch` (kasir excluded; cross-branch account → 403).
- Confirm crypto txn numbers (grep `Math.random` in the new routes → 0).
- Confirm `detectCategoryMismatch` is called server-side with the correct positional args.
- Confirm mobile create does NOT pass `unitType`/`memberId` (no Cuci Mobil split).
- Confirm balance re-read inside `$transaction` (race fix).
- Confirm web `api/cash-bank/transactions` + `transfers` untouched.
- Confirm `branchId` comes from the account, not the request body.
- Confirm 0 raw `console.*` in the new screens; `console.error` only in the 2 server routes.
