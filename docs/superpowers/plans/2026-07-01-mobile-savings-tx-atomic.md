# Mobile savings-tx Atomic + AD-ART — Implementation Plan (Fase 2b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the mobile `savings-tx` POST so the CashBank sync is atomic with the savings balance update, withdrawal of Simpanan Pokok/Wajib is blocked per AD-ART Pasal 26, and CashBank records use the canonical `savings` category with full reference fields.

**Architecture:** Extract the AD-ART rule to a pure tested helper (`isWithdrawalBlocked`). The route becomes an atomic `$transaction(callback)` mirroring web `api/savings/transactions`: SavingsTransaction + SavingsAccount update + (optional) CashBankTransaction + CashBankAccount update all commit or roll back together. Mobile auth + request/response contract preserved.

**Tech Stack:** Next.js 16 route handler, Prisma 6 (`$transaction` callback), TypeScript, Vitest (helper), `crypto.randomBytes`.

## Global Constraints

- **Branch:** `railway-migration` — auto-deploys to prod on push. Commit freely; push only when ready.
- **Do NOT stage non-mine files:** `.claude/settings.local.json`, `mobile/app.json`.
- **Transaction numbers use `crypto.randomBytes()`** — never `Math.random()` / `Date.now()` for txn numbers.
- **Preserve the mobile API contract:** request `{ accountId, amount, type, description, cashBankAccountId }`; response `{ message, data: { newBalance } }`.
- **GET handler byte-identical** (untouched).
- **Atomicity is the headline fix:** the old route's CashBank sync was a separate non-fatal try/catch — balance could change while the cash book failed. New route: single `$transaction(callback)`.
- **Decimal coercion:** `Number()` for Prisma Decimal (`balance`, `currentBalance`).
- Pre-existing failing tests (`split-bill`, `batch-navigation`, `floor-plan`) + pre-existing tsc errors (`api/mobile/toko/shifts/[id]`, `prisma/seed-*.ts`) are NOT regressions.
- Tests: `npx vitest run <file>` / `npm run test`. Typecheck: `npx tsc --noEmit`.

---

### Task 1: Pure helper `isWithdrawalBlocked` (TDD)

**Files:**
- Create: `src/lib/savings-helpers.ts`
- Test: `src/__tests__/savings-helpers.test.ts`

**Interfaces:**
- Produces: `isWithdrawalBlocked(input)` + type `WithdrawalCheckInput` — consumed by Task 2.

- [ ] **Step 1: Write the failing test**

`src/__tests__/savings-helpers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isWithdrawalBlocked } from "@/lib/savings-helpers";

describe("isWithdrawalBlocked (AD-ART Pasal 26)", () => {
  it("blocks withdrawal of non-withdrawable product while member active (Pokok/Wajib)", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "active" })).toBe(true);
  });

  it("allows withdrawal of Sukarela (canWithdraw=true) even when active", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: true, memberStatus: "active" })).toBe(false);
  });

  it("allows withdrawal of non-withdrawable product when member NOT active (pensiun/resigned)", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "pensiun" })).toBe(false);
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "resigned" })).toBe(false);
  });

  it("never blocks deposits", () => {
    expect(isWithdrawalBlocked({ type: "deposit", canWithdraw: false, memberStatus: "active" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/savings-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/savings-helpers"`.

- [ ] **Step 3: Write minimal implementation**

`src/lib/savings-helpers.ts`:
```ts
/**
 * Pure helpers for savings flows. Extracted for unit testing of business rules.
 */

export interface WithdrawalCheckInput {
  type: string;          // "deposit" | "withdrawal"
  canWithdraw: boolean;  // SavingsProduct.canWithdraw
  memberStatus: string;  // Member.status
}

/**
 * AD-ART Pasal 26: Simpanan Pokok & Wajib TIDAK boleh ditarik selama anggota
 * masih aktif. Hanya Simpanan Sukarela (canWithdraw=true) yang dapat ditarik
 * sewaktu-waktu. Dikembalikan saat anggota keluar/meninggal/bubar.
 * Pure; unit-tested. Mirror web api/savings/transactions:137.
 */
export function isWithdrawalBlocked(input: WithdrawalCheckInput): boolean {
  return input.type === "withdrawal" && !input.canWithdraw && input.memberStatus === "active";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/savings-helpers.test.ts`
Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/savings-helpers.ts src/__tests__/savings-helpers.test.ts
git commit -m "feat(savings): add isWithdrawalBlocked AD-ART helper + tests"
```

---

### Task 2: Rewrite mobile `savings-tx` POST (atomic + AD-ART)

**Files:**
- Modify: `src/app/api/mobile/savings-tx/route.ts` (POST only; GET untouched)

**Interfaces:**
- Consumes: `isWithdrawalBlocked` (Task 1); `buildCashBankTransactionData` (`@/lib/kas-bank-loan-helpers`, pass explicit `transactionNo`); `crypto`.

- [ ] **Step 1: Update imports (top of file)**

Replace the existing import block (lines 1-4) with:
```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";
import { buildCashBankTransactionData } from "@/lib/kas-bank-loan-helpers";
import { isWithdrawalBlocked } from "@/lib/savings-helpers";
```

- [ ] **Step 2: Replace the entire POST handler** (from `// POST /api/mobile/savings-tx` through the end of file) with:
```ts
// POST /api/mobile/savings-tx — Create savings deposit or withdrawal.
// Atomic (single $transaction callback): SavingsTransaction + SavingsAccount update +
// CashBank sync all commit or roll back together. AD-ART Pasal 26 enforced.
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { accountId, amount, type, description, cashBankAccountId } = body;

        if (!accountId || !amount || !type || !["deposit", "withdrawal"].includes(type)) {
            return NextResponse.json({ message: "accountId, amount, dan type (deposit/withdrawal) wajib diisi" }, { status: 400 });
        }
        const numAmount = Number(amount);
        if (numAmount <= 0) {
            return NextResponse.json({ message: "Jumlah harus lebih dari 0" }, { status: 400 });
        }

        const account = await prisma.savingsAccount.findUnique({
            where: { id: Number(accountId) },
            include: {
                member: { select: { id: true, name: true, memberNo: true, status: true } },
                product: { select: { id: true, name: true, type: true, canWithdraw: true } },
            },
        });

        if (!account || account.status !== "active") {
            return NextResponse.json({ message: "Rekening simpanan tidak ditemukan atau tidak aktif" }, { status: 404 });
        }

        // ── AD-ART Pasal 26: blok penarikan Pokok/Wajib saat anggota aktif ──
        if (isWithdrawalBlocked({ type, canWithdraw: account.product.canWithdraw, memberStatus: account.member.status })) {
            return NextResponse.json({
                message: `${account.product.name} tidak dapat ditarik selama anggota masih aktif (AD/ART Pasal 26). Hanya Simpanan Sukarela yang dapat ditarik sewaktu-waktu.`,
            }, { status: 400 });
        }

        const currentBalance = Number(account.balance);
        if (type === "withdrawal" && numAmount > currentBalance) {
            return NextResponse.json({ message: `Saldo tidak cukup. Saldo saat ini: Rp ${currentBalance.toLocaleString("id-ID")}` }, { status: 400 });
        }

        const newBalance = type === "deposit" ? currentBalance + numAmount : currentBalance - numAmount;
        const txNo = `STX-M-${crypto.randomBytes(4).readUInt32BE(0) % 1_000_000}`;
        const today = new Date();

        // ── ATOMIC TRANSACTION ──
        await prisma.$transaction(async (tx) => {
            // 1. SavingsTransaction
            const savingsTx = await tx.savingsTransaction.create({
                data: {
                    transactionNo: txNo,
                    accountId: account.id,
                    memberId: account.memberId,
                    productId: account.productId,
                    branchId: account.branchId,
                    type,
                    amount: numAmount,
                    balanceBefore: currentBalance,
                    balanceAfter: newBalance,
                    paymentMethod: null,
                    cashBankAccountId: cashBankAccountId ? Number(cashBankAccountId) : null,
                    notes: description || `${type === "deposit" ? "Setoran" : "Penarikan"} via mobile`,
                    transactionDate: today,
                    createdById: Number(user.id),
                },
            });

            // 2. Update saldo rekening anggota
            await tx.savingsAccount.update({
                where: { id: account.id },
                data: { balance: newBalance },
            });

            // 3. Cash/Bank sync (ATOMIC — same tx, no longer non-fatal try/catch)
            if (cashBankAccountId) {
                const cbAccount = await tx.cashBankAccount.findUnique({ where: { id: Number(cashBankAccountId) } });
                if (!cbAccount || !cbAccount.isActive) {
                    throw new Error("Akun kas/bank tidak ditemukan atau tidak aktif");
                }
                const cbBal = Number(cbAccount.currentBalance);
                const cashType = type === "deposit" ? "in" : "out";
                const cbNewBal = cashType === "in" ? cbBal + numAmount : cbBal - numAmount;

                await tx.cashBankTransaction.create({
                    data: buildCashBankTransactionData({
                        accountId: cbAccount.id,
                        branchId: account.branchId,
                        type: cashType,
                        category: "savings",
                        amount: numAmount,
                        balanceBefore: cbBal,
                        balanceAfter: cbNewBal,
                        description: `${type === "deposit" ? "Setoran" : "Penarikan"} simpanan ${account.member.name} (${account.product.name}) via mobile - ${txNo}`,
                        transactionDate: today,
                        createdById: Number(user.id),
                        referenceType: "SavingsTransaction",
                        referenceId: savingsTx.id,
                        unitType: "simpan_pinjam",
                        memberId: account.memberId,
                        transactionNo: `CBT-${txNo}`,
                    }),
                });
                await tx.cashBankAccount.update({ where: { id: cbAccount.id }, data: { currentBalance: cbNewBal } });
            }
        }, { timeout: 30000 });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Simpanan",
            description: `${type === "deposit" ? "Setoran" : "Penarikan"} Rp ${numAmount.toLocaleString("id-ID")} pada rekening ${account.member.name} (${account.product.name}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: `${type === "deposit" ? "Setoran" : "Penarikan"} berhasil`,
            data: { newBalance },
        });
    } catch (error) {
        console.error("POST /api/mobile/savings-tx error:", error);
        return NextResponse.json({ message: "Gagal memproses transaksi simpanan" }, { status: 500 });
    }
}
```

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit` → no NEW errors. Watch for: `account.product.canWithdraw` exists on SavingsProduct (confirm via schema if needed); `account.member.status` exists on Member; `savingsTransaction.paymentMethod` + `cashBankAccountId` fields exist; `CashBankAccount.isActive` exists.
Run: `npx vitest run src/__tests__/savings-helpers.test.ts` → 4/4.
Run: `npm run test` → only the 3 pre-existing failures.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/mobile/savings-tx/route.ts
git commit -m "fix(mobile-savings-tx): atomic CashBank + AD-ART Pasal 26 + category savings"
```

---

### Task 3 (optional): Diagnostic — savings-tx category gap vs prod

**Files:**
- Create: `scripts/diagnose-mobile-savings-tx.ts`

- [ ] **Step 1: Write the diagnostic**
```ts
// scripts/diagnose-mobile-savings-tx.ts
// Read-only vs prod Neon. Shows historical mobile savings txns (STX-M-*) and the
// distribution of CashBank category they used (before: setoran_simpanan/penarikan_simpanan;
// after fix: savings). Non-retroactive.
// Jalankan: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-savings-tx.ts
import prisma from "../src/lib/prisma";

async function main() {
  const txns = await prisma.savingsTransaction.findMany({
    where: { transactionNo: { startsWith: "STX-M-" } },
    select: { id: true, transactionNo: true, type: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  console.log(`=== Mobile savings txns (STX-M-*) — last ${txns.length} ===`);

  const cbByCat: Record<string, number> = {};
  for (const t of txns.slice(0, 50)) {
    const cb = await prisma.cashBankTransaction.findFirst({
      where: { referenceType: "SavingsTransaction", referenceId: t.id },
      select: { category: true },
    });
    const cat = cb?.category || "(none)";
    cbByCat[cat] = (cbByCat[cat] || 0) + 1;
  }
  console.log(`CB category distribution (sample of 50):`);
  for (const [cat, n] of Object.entries(cbByCat)) console.log(`  ${cat.padEnd(24)} : ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Run it (read-only vs prod)**
Run: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-savings-tx.ts`
Expected (BEFORE deploy): categories like `setoran_simpanan`/`penarikan_simpanan` (old) + possibly `(none)` (CB never linked). After fix: new txns use `savings`.

- [ ] **Step 3: Commit**
```bash
git add scripts/diagnose-mobile-savings-tx.ts
git commit -m "docs(diag): mobile savings-tx category distribution vs prod"
```

---

## Self-Review (controller notes)

- **Spec coverage:** helper (Task 1) + route rewrite (Task 2) + diagnostic (Task 3) — all spec sections mapped. Atomicity, AD-ART, category `savings`, reference fields, branchId, crypto all addressed.
- **Type consistency:** `WithdrawalCheckInput` (Task 1) ↔ consumed in Task 2. CB fields match web (`api/savings/transactions:250-267`).
- **Placeholder scan:** none — complete code, exact paths, exact commands.
- **Risk:** Task 2 changes behavior for AD-ART-blocked withdrawals (now rejected) — intended (regulatory). Reviewer must verify: `product.canWithdraw` + `member.status` + `SavingsTransaction.paymentMethod`/`cashBankAccountId` + `CashBankAccount.isActive` exist; GET untouched; response shape `{ message, data: { newBalance } }` preserved; no Math.random/Date.now (crypto only). Implementer: sonnet (integration).
