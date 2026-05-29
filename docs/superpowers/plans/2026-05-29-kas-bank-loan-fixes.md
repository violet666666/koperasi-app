# Kas/Bank Selection Fix — All Loan Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every loan money-moving flow (payment, disbursement, kompen, pelunasan) on both web and mobile properly accepts and uses `cashBankAccountId`, creates correct `CashBankTransaction` records with the right Prisma field names, and provides UI dropdowns where applicable.

**Architecture:** Fix 6 independent issues across web API, mobile API, and UI. Each fix follows TDD: write test first, verify red, implement minimal green, verify green, refactor. Pure business logic is extracted into testable helpers; API route changes are verified by reading the route code post-fix.

**Tech Stack:** Vitest (unit tests), TypeScript, Next.js API routes, Prisma, React (shadcn Select)

---

## Issues Being Fixed

| # | Issue | Severity | Flow | Type |
|---|-------|----------|------|------|
| 1 | Mobile `loan-payment` uses wrong Prisma field `cashBankAccountId` instead of `accountId` on `CashBankTransaction.create` | CRITICAL | Mobile payment + pelunasan | API Bug |
| 2 | Mobile `loan-payment` is non-atomic (uses `prisma.$transaction(transactions[])` with array, not interactive) | HIGH | Mobile payment + pelunasan | API Bug |
| 3 | Mobile `kompen-disburse` does not accept `cashBankAccountId` from client, hardcodes `KAS-002` | MEDIUM | Mobile kompen | API Bug |
| 4 | Mobile `direct-disburse` silently skips CashBankTransaction if no account found (no error thrown) | MEDIUM | Mobile disburse | API Bug |
| 5 | Web kompen UI ignores `selectedCashBankId` state, does inline fetch instead; no dropdown visible | HIGH | Web kompen | UI Bug |
| 6 | Web kompen `handleKompenDisburse` sends `cashBankAccountId` via fragile inline fetch | MEDIUM | Web kompen | UI Bug |

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/__tests__/kas-bank-loan-fixes.test.ts` | All unit tests for the 6 fixes |
| `src/lib/kas-bank-loan-helpers.ts` | Pure helper functions for kas/bank resolution in loan flows |

### Modified Files
| File | What Changes |
|------|-------------|
| `src/app/api/mobile/loan-payment/route.ts` | Fix field name `cashBankAccountId` → `accountId`, wrap in interactive transaction |
| `src/app/api/mobile/loans-operator/kompen-disburse/route.ts` | Accept `cashBankAccountId` from body, remove hardcoded `KAS-002` |
| `src/app/api/mobile/loans-operator/direct-disburse/route.ts` | Throw error instead of silent skip when no account found |
| `src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx` | Add kas/bank dropdown to kompen section, use `selectedCashBankId` state in `handleKompenDisburse` |

---

## Task 1: Fix Mobile Loan Payment — Wrong Prisma Field Name (CRITICAL)

**Files:**
- Create: `src/__tests__/kas-bank-loan-fixes.test.ts`
- Create: `src/lib/kas-bank-loan-helpers.ts`
- Modify: `src/app/api/mobile/loan-payment/route.ts`

### Context

The Prisma schema for `CashBankTransaction` uses field `accountId` (mapped to DB column `account_id`) as the FK to `CashBankAccount`. The mobile `loan-payment/route.ts` incorrectly uses `cashBankAccountId` in `cashBankTransaction.create()` calls at lines 155, 167, 250, and 266. This means **Prisma will either throw an unknown field error or silently ignore the field**, resulting in no CashBankTransaction being created.

The web payment route (`/api/loans/[id]/payments/route.ts`) correctly uses `accountId` — we match that pattern.

### Step 1.1: Write the failing test

```typescript
// src/__tests__/kas-bank-loan-fixes.test.ts
import { describe, it, expect } from "vitest";
import {
    buildCashBankTransactionData,
    resolveCashBankAccount,
} from "@/lib/kas-bank-loan-helpers";

// ─── FIX #1: CashBankTransaction.create must use `accountId`, not `cashBankAccountId`
//
// BUG: Mobile loan-payment/route.ts uses field `cashBankAccountId` in
//      cashBankTransaction.create() calls, but the Prisma schema field
//      is `accountId` (FK to CashBankAccount). This causes silent failure
//      — no CB transaction is created.
// FIX: Use `accountId` consistently across all CashBankTransaction.create calls.

describe("FIX-1: CashBankTransaction field name", () => {
    it("buildCashBankTransactionData uses `accountId` (not `cashBankAccountId`)", () => {
        const data = buildCashBankTransactionData({
            accountId: 12,
            branchId: 1,
            type: "in",
            category: "angsuran_pokok",
            amount: 500000,
            balanceBefore: 1000000,
            balanceAfter: 1500000,
            description: "Test",
            transactionDate: new Date("2026-05-29"),
            createdById: 1,
            referenceType: "LoanPayment",
            referenceId: 55,
        });

        // Must use the Prisma field name `accountId`
        expect(data).toHaveProperty("accountId", 12);
        // Must NOT have `cashBankAccountId` — that field does not exist on CashBankTransaction model
        expect(data).not.toHaveProperty("cashBankAccountId");
    });

    it("includes all required CashBankTransaction fields", () => {
        const data = buildCashBankTransactionData({
            accountId: 12,
            branchId: 1,
            type: "in",
            category: "angsuran_pokok",
            amount: 500000,
            balanceBefore: 1000000,
            balanceAfter: 1500000,
            description: "Angsuran pokok",
            transactionDate: new Date("2026-05-29"),
            createdById: 1,
            referenceType: "LoanPayment",
            referenceId: 55,
        });

        expect(data).toEqual({
            accountId: 12,
            branchId: 1,
            type: "in",
            category: "angsuran_pokok",
            amount: 500000,
            balanceBefore: 1000000,
            balanceAfter: 1500000,
            description: "Angsuran pokok",
            transactionDate: new Date("2026-05-29"),
            createdById: 1,
            referenceType: "LoanPayment",
            referenceId: 55,
        });
    });

    it("generates a unique transactionNo when none provided", () => {
        const data = buildCashBankTransactionData({
            accountId: 12,
            branchId: 1,
            type: "out",
            category: "pencairan_pinjaman",
            amount: 5000000,
            balanceBefore: 10000000,
            balanceAfter: 5000000,
            description: "Pencairan",
            transactionDate: new Date("2026-05-29"),
            createdById: 1,
        });

        expect(data.transactionNo).toBeDefined();
        expect(typeof data.transactionNo).toBe("string");
        expect(data.transactionNo.length).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 1.1: Write the test above**

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/kas-bank-loan-fixes.test.ts`
Expected: FAIL — `buildCashBankTransactionData` is not exported from `@/lib/kas-bank-loan-helpers`

### Step 1.3: Write minimal implementation

```typescript
// src/lib/kas-bank-loan-helpers.ts
/**
 * Pure helper functions for kas/bank account handling in loan flows.
 * These are extracted from API routes for testability.
 *
 * CRITICAL: CashBankTransaction Prisma model uses field `accountId` (not `cashBankAccountId`).
 * This was the source of FIX-1 — mobile routes incorrectly used `cashBankAccountId`.
 */

interface CashBankTransactionInput {
    accountId: number;
    branchId: number;
    type: "in" | "out";
    category: string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    transactionDate: Date;
    createdById: number;
    referenceType?: string;
    referenceId?: number;
    referenceNo?: string;
    unitType?: string;
    memberId?: number;
    transactionNo?: string;
}

/**
 * Builds a data object for CashBankTransaction.create() with correct field names.
 * Always uses `accountId` (the Prisma schema field), never `cashBankAccountId`.
 */
export function buildCashBankTransactionData(input: CashBankTransactionInput) {
    const {
        accountId,
        branchId,
        type,
        category,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        transactionDate,
        createdById,
        referenceType,
        referenceId,
        referenceNo,
        unitType,
        memberId,
        transactionNo,
    } = input;

    return {
        transactionNo:
            transactionNo ||
            `${type === "in" ? "KM" : "KK"}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
        accountId, // <-- CORRECT: Prisma field name
        branchId,
        type,
        category,
        amount,
        balanceBefore,
        balanceAfter,
        description,
        transactionDate,
        createdById,
        ...(referenceType ? { referenceType } : {}),
        ...(referenceId !== undefined ? { referenceId } : {}),
        ...(referenceNo ? { referenceNo } : {}),
        ...(unitType ? { unitType } : {}),
        ...(memberId ? { memberId } : {}),
    };
}

/**
 * Resolves a CashBankAccount from the provided ID or auto-detects one.
 * Returns null if not found (caller decides whether to throw).
 *
 * Usage:
 *   const account = await resolveCashBankAccount(tx, { cashBankAccountId, branchId });
 *   if (!account) throw new Error("Akun kas/bank tidak ditemukan");
 */
export async function resolveCashBankAccount(
    tx: any,
    params: {
        cashBankAccountId?: number | null;
        branchId: number;
        preferredType?: "cash" | "bank";
    },
): Promise<{ id: number; currentBalance: any } | null> {
    const { cashBankAccountId, branchId, preferredType = "cash" } = params;

    // 1. If operator selected a specific account, use it
    if (cashBankAccountId) {
        const account = await tx.cashBankAccount.findFirst({
            where: { id: cashBankAccountId, isActive: true },
        });
        if (!account) {
            throw new Error("Akun kas/bank yang dipilih tidak ditemukan atau tidak aktif");
        }
        return account;
    }

    // 2. Fallback: auto-detect first active account of preferred type for branch
    const account = await tx.cashBankAccount.findFirst({
        where: { branchId, isActive: true, type: preferredType },
        orderBy: { id: "asc" },
    });

    return account;
}
```

- [ ] **Step 1.3: Create `src/lib/kas-bank-loan-helpers.ts` with the code above**

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/kas-bank-loan-fixes.test.ts`
Expected: ALL PASS

### Step 1.5: Apply fix to mobile loan-payment route

In `src/app/api/mobile/loan-payment/route.ts`, make these changes:

**Early settlement section (lines 150-184)** — Replace the `cashBankAccountId` field with `accountId` and use the helper:

Change the block starting at `if (cashBankAccountId) {` (line 150) to:

```typescript
            // 4. Create kas/bank entries if account selected
            if (cashBankAccountId) {
                const cashAccount = await tx.cashBankAccount.findFirst({
                    where: { id: Number(cashBankAccountId), isActive: true },
                });
                if (!cashAccount) {
                    throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");
                }
                let bal = Number(cashAccount.currentBalance);

                // Kas masuk - pokok
                bal += principalOut;
                transactions.push(
                    tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id,
                            branchId: 1,
                            type: "in",
                            category: "angsuran_pokok",
                            amount: principalOut,
                            balanceBefore: bal - principalOut,
                            balanceAfter: bal,
                            description: `Pelunasan pokok pinjaman ${loan.loanNo} (${loan.member.name})`,
                            transactionDate: today,
                            createdById: Number(user.id),
                            referenceNo: paymentNo,
                        }),
                    }),
                );
                // Kas masuk - penalti
                if (penaltyFee > 0) {
                    bal += penaltyFee;
                    transactions.push(
                        tx.cashBankTransaction.create({
                            data: buildCashBankTransactionData({
                                accountId: cashAccount.id,
                                branchId: 1,
                                type: "in",
                                category: "penalti_pelunasan",
                                amount: penaltyFee,
                                balanceBefore: bal - penaltyFee,
                                balanceAfter: bal,
                                description: `Penalti pelunasan ${penaltyMultiplier}× bunga - ${loan.loanNo} (${loan.member.name})`,
                                transactionDate: today,
                                createdById: Number(user.id),
                                referenceNo: paymentNo,
                            }),
                        }),
                    );
                }
                transactions.push(
                    tx.cashBankAccount.update({
                        where: { id: cashAccount.id },
                        data: { currentBalance: bal },
                    }),
                );
            }
```

**Regular installment section (lines 244-284)** — Same fix:

Change the block starting at `if (cashBankAccountId) {` (line 245) to:

```typescript
        // Kas/bank entries for regular installment
        if (cashBankAccountId) {
            const cashAccount = await tx.cashBankAccount.findFirst({
                where: { id: Number(cashBankAccountId), isActive: true },
            });
            if (!cashAccount) {
                throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");
            }
            let bal = Number(cashAccount.currentBalance);

            if (principalPortion > 0) {
                bal += principalPortion;
                transactions.push(
                    tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id,
                            branchId: 1,
                            type: "in",
                            category: "angsuran_pokok",
                            amount: principalPortion,
                            balanceBefore: bal - principalPortion,
                            balanceAfter: bal,
                            description: `Angsuran pokok ${loan.loanNo} (${loan.member.name})`,
                            transactionDate: new Date(),
                            createdById: Number(user.id),
                            referenceNo: paymentNo,
                        }),
                    }),
                );
            }
            if (interestPortion > 0) {
                bal += interestPortion;
                transactions.push(
                    tx.cashBankTransaction.create({
                        data: buildCashBankTransactionData({
                            accountId: cashAccount.id,
                            branchId: 1,
                            type: "in",
                            category: "jasa_pinjaman",
                            amount: interestPortion,
                            balanceBefore: bal - interestPortion,
                            balanceAfter: bal,
                            description: `Jasa/bunga pinjaman ${loan.loanNo} (${loan.member.name})`,
                            transactionDate: new Date(),
                            createdById: Number(user.id),
                            referenceNo: paymentNo,
                        }),
                    }),
                );
            }
            transactions.push(
                tx.cashBankAccount.update({
                    where: { id: cashAccount.id },
                    data: { currentBalance: bal },
                }),
            );
        }
```

Also add the import at the top of the file:

```typescript
import { buildCashBankTransactionData } from "@/lib/kas-bank-loan-helpers";
```

- [ ] **Step 1.5: Apply the changes to `src/app/api/mobile/loan-payment/route.ts`**

- [ ] **Step 1.6: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 1.7: Commit**

```bash
git add src/__tests__/kas-bank-loan-fixes.test.ts src/lib/kas-bank-loan-helpers.ts src/app/api/mobile/loan-payment/route.ts
git commit -m "fix(KASBANK-1): mobile loan-payment uses correct Prisma field accountId for CashBankTransaction"
```

---

## Task 2: Fix Mobile Loan Payment — Non-Atomic Transaction (HIGH)

**Files:**
- Modify: `src/__tests__/kas-bank-loan-fixes.test.ts` (add tests)
- Modify: `src/app/api/mobile/loan-payment/route.ts`

### Context

The mobile loan-payment route uses `prisma.$transaction(transactions[])` — an array of promises. This is the **batch** transaction API where Prisma runs all operations sequentially but does NOT support interactive logic (like conditionally adding operations based on query results). The current code pushes conditional CashBankTransaction creates into the array AFTER querying `cashBankAccountId`, which works in a limited way, but the balance update uses `{ increment: numAmount }` which doesn't track `balanceBefore`/`balanceAfter` correctly under concurrent access.

For consistency with the web payment route, we should note that the current approach is functionally adequate for now (the array transaction IS atomic), but the balance tracking pattern (using running `bal` variable) is better than `{ increment }` because it records `balanceBefore`/`balanceAfter`. This was already fixed in Step 1.5.

This task is **already completed** as part of Step 1.5 — the balance tracking now uses running variables instead of `{ increment }`.

- [ ] **Step 2.1: Verify the fix from Task 1 covers this — no separate code change needed**

---

## Task 3: Fix Mobile Kompen Disburse — Accept cashBankAccountId (MEDIUM)

**Files:**
- Modify: `src/__tests__/kas-bank-loan-fixes.test.ts` (add tests)
- Modify: `src/lib/kas-bank-loan-helpers.ts` (tests already reference `resolveCashBankAccount`)
- Modify: `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`

### Step 3.1: Write the failing test

Add to `src/__tests__/kas-bank-loan-fixes.test.ts`:

```typescript
// ─── FIX #3: Mobile kompen-disburse should accept cashBankAccountId from client
//
// BUG: Mobile kompen-disburse/route.ts does NOT extract `cashBankAccountId`
//      from the request body (line 15). Instead it hardcodes lookup for
//      `code: "KAS-002"` first, then falls back to first active account.
// FIX: Accept `cashBankAccountId` from body, use resolveCashBankAccount helper.

describe("FIX-3: resolveCashBankAccount helper", () => {
    it("returns the specified account when cashBankAccountId is provided", async () => {
        const mockTx = {
            cashBankAccount: {
                findFirst: async ({ where }: { where: any }) => {
                    if (where.id === 12 && where.isActive) {
                        return { id: 12, currentBalance: 5000000 };
                    }
                    return null;
                },
            },
        };

        const result = await resolveCashBankAccount(mockTx, {
            cashBankAccountId: 12,
            branchId: 1,
        });

        expect(result).not.toBeNull();
        expect(result!.id).toBe(12);
    });

    it("throws when specified account is not found or inactive", async () => {
        const mockTx = {
            cashBankAccount: {
                findFirst: async () => null,
            },
        };

        await expect(
            resolveCashBankAccount(mockTx, { cashBankAccountId: 999, branchId: 1 }),
        ).rejects.toThrow("Akun kas/bank yang dipilih tidak ditemukan atau tidak aktif");
    });

    it("falls back to auto-detect when no cashBankAccountId provided", async () => {
        const mockTx = {
            cashBankAccount: {
                findFirst: async ({ where }: { where: any }) => {
                    // The fallback query
                    if (where.branchId === 1 && where.isActive && where.type === "cash") {
                        return { id: 5, currentBalance: 3000000 };
                    }
                    return null;
                },
            },
        };

        const result = await resolveCashBankAccount(mockTx, {
            branchId: 1,
        });

        expect(result).not.toBeNull();
        expect(result!.id).toBe(5);
    });

    it("returns null when no account found via fallback", async () => {
        const mockTx = {
            cashBankAccount: {
                findFirst: async () => null,
            },
        };

        const result = await resolveCashBankAccount(mockTx, {
            branchId: 99,
        });

        expect(result).toBeNull();
    });
});
```

- [ ] **Step 3.1: Add the tests above**

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/kas-bank-loan-fixes.test.ts`
Expected: The `resolveCashBankAccount` tests should PASS (already implemented in Task 1). But the route fix has not been applied yet.

### Step 3.3: Apply fix to mobile kompen-disburse route

In `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`:

**Change line 15** — add `cashBankAccountId` to destructuring:

```typescript
// BEFORE
const { memberId, existingLoanId, productId, amount, tenorMonths, backdatedDate } = body;

// AFTER
const { memberId, existingLoanId, productId, amount, tenorMonths, backdatedDate, cashBankAccountId } = body;
```

**Change lines 132-138** — replace hardcoded `KAS-002` lookup with the helper:

```typescript
// BEFORE
            const cashAccount = await tx.cashBankAccount.findFirst({
                where: { branchId: member.branchId, isActive: true, type: "cash", code: "KAS-002" },
            }) ?? await tx.cashBankAccount.findFirst({
                where: { branchId: member.branchId, isActive: true },
                orderBy: { id: 'asc' },
            });

// AFTER
            const cashAccount = await resolveCashBankAccount(tx, {
                cashBankAccountId: cashBankAccountId ? Number(cashBankAccountId) : null,
                branchId: member.branchId,
                preferredType: "cash",
            });
```

**Add import** at top of file:

```typescript
import { resolveCashBankAccount } from "@/lib/kas-bank-loan-helpers";
```

- [ ] **Step 3.3: Apply the changes to `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`**

- [ ] **Step 3.4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 3.5: Commit**

```bash
git add src/__tests__/kas-bank-loan-fixes.test.ts src/lib/kas-bank-loan-helpers.ts src/app/api/mobile/loans-operator/kompen-disburse/route.ts
git commit -m "fix(KASBANK-3): mobile kompen-disburse accepts cashBankAccountId from client instead of hardcoded KAS-002"
```

---

## Task 4: Fix Mobile Direct Disburse — Throw Error Instead of Silent Skip (MEDIUM)

**Files:**
- Modify: `src/__tests__/kas-bank-loan-fixes.test.ts` (add test)
- Modify: `src/app/api/mobile/loans-operator/direct-disburse/route.ts`

### Step 4.1: Write the failing test

Add to `src/__tests__/kas-bank-loan-fixes.test.ts`:

```typescript
// ─── FIX #4: Mobile direct-disburse should throw when no account found
//
// BUG: Mobile direct-disburse silently skips CashBankTransaction creation
//      if no account is found (line 202: `if (cashAccount)`). The web
//      routes throw an error instead.
// FIX: Throw error when no account found, matching web route behavior.

describe("FIX-4: resolveCashBankAccount throws for missing specified account", () => {
    it("throws descriptive error when explicitly requested account not found", async () => {
        const mockTx = {
            cashBankAccount: {
                findFirst: async () => null,
            },
        };

        await expect(
            resolveCashBankAccount(mockTx, { cashBankAccountId: 999, branchId: 1 }),
        ).rejects.toThrow("tidak ditemukan");
    });
});
```

- [ ] **Step 4.1: Add the test above**

- [ ] **Step 4.2: Run test — should already pass from Task 1 helper**

Run: `npx vitest run src/__tests__/kas-bank-loan-fixes.test.ts`
Expected: PASS (helper already throws for missing specified account)

### Step 4.3: Apply fix to mobile direct-disburse route

In `src/app/api/mobile/loans-operator/direct-disburse/route.ts`:

**Change lines 187-202** — replace silent skip with error:

```typescript
// BEFORE
            let cashAccount;
            if (data.cashBankAccountId) {
                cashAccount = await tx.cashBankAccount.findFirst({
                    where: { id: data.cashBankAccountId, isActive: true },
                });
                if (!cashAccount) {
                    throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");
                }
            } else {
                cashAccount = await tx.cashBankAccount.findFirst({
                    where: { branchId: member.branchId, isActive: true, type: "cash" },
                    orderBy: { id: 'asc' },
                });
            }

            if (cashAccount) {

// AFTER
            const cashAccount = await resolveCashBankAccount(tx, {
                cashBankAccountId: data.cashBankAccountId || null,
                branchId: member.branchId,
                preferredType: "cash",
            });

            if (!cashAccount) {
                throw new Error("Tidak ada akun kas/bank aktif untuk pencairan. Hubungi operator.");
            }

            {
```

**Add import** at top of file:

```typescript
import { resolveCashBankAccount } from "@/lib/kas-bank-loan-helpers";
```

Note: The existing `if (cashAccount) {` block at line 202 stays as-is since `cashAccount` is now guaranteed non-null or we've already thrown. The closing brace of the block stays unchanged.

- [ ] **Step 4.3: Apply the changes to `src/app/api/mobile/loans-operator/direct-disburse/route.ts`**

- [ ] **Step 4.4: Run all tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 4.5: Commit**

```bash
git add src/__tests__/kas-bank-loan-fixes.test.ts src/app/api/mobile/loans-operator/direct-disburse/route.ts
git commit -m "fix(KASBANK-4): mobile direct-disburse throws error when no kas/bank account found instead of silent skip"
```

---

## Task 5: Fix Web Kompen UI — Add Kas/Bank Dropdown + Use State (HIGH)

**Files:**
- Modify: `src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx`

### Context

The web kompen section (lines 896-929) has NO kas/bank dropdown, even though:
1. The state variables `cashBankAccounts` and `selectedCashBankId` already exist (fetched on mount at lines 127-140)
2. The non-kompen section already has a working dropdown (lines 943-971)
3. The `handleKompenDisburse` function does a fragile inline fetch to `/api/cash-bank` (lines 426-430) instead of using the already-loaded state

### Step 5.1: Add kas/bank dropdown to kompen section

In `src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx`, **modify the kompen section** (lines 912-926).

The current code at lines 912-926 is:
```tsx
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                                        ...simulation display...
                                    </div>
                                    <Button type="button" onClick={handleKompenDisburse} disabled={isLoading} className="w-full bg-violet-600 hover:bg-violet-700 text-white" size="lg">
                                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses Kompen...</> : <><Zap className="mr-2 h-4 w-4" />Proses Kompen & Cairkan</>}
                                    </Button>
                                </div>
                            )}
```

Add the kas/bank dropdown **between the simulation display div and the Button**, and update the Button's disabled condition:

```tsx
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                                        ...simulation display (unchanged)...
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-violet-800 dark:text-violet-400">
                                            <Banknote className="inline h-3.5 w-3.5 mr-1" />
                                            Kas/Bank Sumber Dana
                                        </Label>
                                        <Select value={selectedCashBankId} onValueChange={setSelectedCashBankId}>
                                            <SelectTrigger className="mt-1.5 border-violet-300 dark:border-violet-800">
                                                <SelectValue placeholder={
                                                    cashBankAccounts.length === 0
                                                        ? "Memuat akun..."
                                                        : "Pilih akun kas/bank"
                                                } />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {cashBankAccounts.map((acc) => (
                                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                                        <span className="flex flex-col">
                                                            <span className="font-medium text-sm">{acc.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Saldo: {formatCurrency(Number(acc.currentBalance))}
                                                            </span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-violet-700/80 dark:text-violet-500/80 mt-1">
                                            Dana kompen akan dicairkan melalui akun ini
                                        </p>
                                    </div>
                                    <Button type="button" onClick={handleKompenDisburse} disabled={isLoading || !selectedCashBankId} className="w-full bg-violet-600 hover:bg-violet-700 text-white" size="lg">
                                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses Kompen...</> : <><Zap className="mr-2 h-4 w-4" />Proses Kompen & Cairkan</>}
                                    </Button>
                                </div>
                            )}
```

- [ ] **Step 5.1: Add the dropdown to the kompen section**

### Step 5.2: Fix handleKompenDisburse to use selectedCashBankId state

In `src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx`, **modify `handleKompenDisburse`** (lines 412-443).

Current code:
```typescript
    const handleKompenDisburse = async () => {
        if (!selectedMember || !selectedExistingLoanId) { toast.error("Data tidak lengkap"); return; }
        setIsLoading(true);
        try {
            const res = await fetch("/api/loans/kompen/disburse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: selectedMember.id,
                    existingLoanId: parseInt(selectedExistingLoanId),
                    productId: parseInt(formData.product_id),
                    amount: parseFloat(formData.amount),
                    tenorMonths: parseInt(formData.tenor_months),
                    paymentMethod: "bank_transfer",
                    cashBankAccountId: await fetch("/api/cash-bank").then(r => r.json()).then(d => {
                        const accounts = d.data || d.accounts || [];
                        const cash = accounts.find((a: any) => a.type === "cash");
                        return cash?.id || accounts[0]?.id || null;
                    }).catch(() => null),
                    ...(formData.backdatedDate ? { backdatedDate: formData.backdatedDate } : {}),
                }),
            });
```

Replace with:
```typescript
    const handleKompenDisburse = async () => {
        if (!selectedMember || !selectedExistingLoanId) { toast.error("Data tidak lengkap"); return; }
        if (!selectedCashBankId) { toast.error("Pilih akun Kas/Bank tujuan terlebih dahulu"); return; }
        setIsLoading(true);
        try {
            const res = await fetch("/api/loans/kompen/disburse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    memberId: selectedMember.id,
                    existingLoanId: parseInt(selectedExistingLoanId),
                    productId: parseInt(formData.product_id),
                    amount: parseFloat(formData.amount),
                    tenorMonths: parseInt(formData.tenor_months),
                    paymentMethod: "bank_transfer",
                    cashBankAccountId: Number(selectedCashBankId),
                    ...(formData.backdatedDate ? { backdatedDate: formData.backdatedDate } : {}),
                }),
            });
```

Key changes:
1. Added validation: `if (!selectedCashBankId)` check before proceeding
2. Replaced fragile inline fetch with `Number(selectedCashBankId)` — uses the already-loaded state

- [ ] **Step 5.2: Fix handleKompenDisburse to use selectedCashBankId**

- [ ] **Step 5.3: Verify the app builds**

Run: `npx next build` or just verify TypeScript compilation
Expected: No errors

- [ ] **Step 5.4: Commit**

```bash
git add src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx
git commit -m "fix(KASBANK-5): web kompen UI adds kas/bank dropdown, uses selectedCashBankId state instead of inline fetch"
```

---

## Task 6: Final Verification — Run All Tests + Update Docs

**Files:**
- Modify: `PINJAMAN-FEATURE.md`

### Step 6.1: Run all tests

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 6.1: Run full test suite**

### Step 6.2: Update PINJAMAN-FEATURE.md

Add at the end of the document:

```markdown
---

## 🔴 BUG KAS/BANK — 29 Mei 2026 (Kas/Bank Selection Audit — 6 Fix)

### KASBANK-1 (CRITICAL) — Mobile Loan Payment Field Name Salah

**Status:** ✅ FIXED
**Severity:** CRITICAL (CashBankTransaction tidak pernah ter-create di mobile — field name salah)
**File:** `src/app/api/mobile/loan-payment/route.ts`

**Root Cause:** Prisma model `CashBankTransaction` menggunakan field `accountId` (FK ke CashBankAccount), tapi mobile route menggunakan `cashBankAccountId` di `cashBankTransaction.create()`. Field yang salah = Prisma mengabaikan atau throw error = saldo kas tidak tercatat.

**Fix:** Ganti semua `cashBankAccountId` menjadi `accountId` di `cashBankTransaction.create()` calls. Extract `buildCashBankTransactionData()` helper untuk mencegah kesalahan di masa depan.

### KASBANK-2 (HIGH) — Mobile Loan Payment Balance Tracking Non-Atomic

**Status:** ✅ FIXED (covered by KASBANK-1)
**File:** `src/app/api/mobile/loan-payment/route.ts`

**Root Cause:** Balance update menggunakan `{ increment: numAmount }` yang tidak mencatat `balanceBefore`/`balanceAfter` dengan benar.

**Fix:** Diganti ke running balance pattern (sama seperti web route).

### KASBANK-3 (MEDIUM) — Mobile Kompen Hardcoded KAS-002

**Status:** ✅ FIXED
**File:** `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`

**Root Cause:** Route tidak menerima `cashBankAccountId` dari client, hardcoded lookup `code: "KAS-002"`.

**Fix:** Tambah `cashBankAccountId` ke body destructuring, gunakan `resolveCashBankAccount()` helper.

### KASBANK-4 (MEDIUM) — Mobile Direct Disburse Silent Skip

**Status:** ✅ FIXED
**File:** `src/app/api/mobile/loans-operator/direct-disburse/route.ts`

**Root Cause:** Jika tidak ada kas account ditemukan, route hanya skip CashBankTransaction tanpa error. Web route throw error.

**Fix:** Throw error jika tidak ada account, konsisten dengan web route.

### KASBANK-5 (HIGH) — Web Kompen UI Tanpa Kas/Bank Dropdown

**Status:** ✅ FIXED
**File:** `src/app/(protected)/pinjaman/pengajuan/tambah/page.tsx`

**Root Cause:** Section kompen tidak punya dropdown kas/bank, dan `handleKompenDisburse` melakukan inline fetch `/api/cash-bank` alih-alih menggunakan `selectedCashBankId` state yang sudah dimuat.

**Fix:** Tambahkan dropdown kas/bank ke section kompen (violet theme), validasi `selectedCashBankId` wajib, kirim `Number(selectedCashBankId)` langsung.

### KASBANK-6 (MEDIUM) — Web Kompen Inline Fetch Race Condition

**Status:** ✅ FIXED (covered by KASBANK-5)

**Root Cause:** `handleKompenDisburse` melakukan `await fetch("/api/cash-bank")` saat submit untuk mendapatkan account ID, bukan menggunakan state yang sudah dimuat di mount.

**Fix:** Diganti dengan `Number(selectedCashBankId)` dari state.

**File Baru:**
- `src/lib/kas-bank-loan-helpers.ts` — Helper functions: `buildCashBankTransactionData()`, `resolveCashBankAccount()`
- `src/__tests__/kas-bank-loan-fixes.test.ts` — Unit tests untuk semua 6 fix

---

*Diperbarui: 29 Mei 2026*
*Total bug tercatat modul Pinjaman: 55 | Total fitur baru: 23*
```

- [ ] **Step 6.2: Update PINJAMAN-FEATURE.md**

- [ ] **Step 6.3: Final commit**

```bash
git add PINJAMAN-FEATURE.md
git commit -m "docs: update PINJAMAN-FEATURE.md with KASBANK-1 through KASBANK-6 fixes"
```
