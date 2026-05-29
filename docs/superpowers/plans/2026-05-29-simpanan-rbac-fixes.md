# Simpanan RBAC & Data Consistency Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Fix 5 real issues in simpanan module — add missing auth, block anggota from write endpoints, fix CashBankTransaction sync on edit, add balance guard on account close, restrict transaction type.

**Architecture:** Minimal surgical fixes to API routes only. Operator functionality remains 100% intact.

**Tech Stack:** TypeScript, Next.js API routes, Prisma, Vitest

---

## Issues Being Fixed

| # | Severity | Issue |
|---|----------|-------|
| 1 | CRITICAL | 6 GET endpoints on savings have no auth |
| 2 | HIGH | POST/PUT/DELETE savings transactions don't block `anggota` role |
| 3 | HIGH | Edit transaction doesn't update linked CashBankTransaction |
| 4 | LOW | No balance check when blocking/closing account with non-zero balance |
| 5 | INFO | POST accepts `type: "correction"/"interest"` from any caller |

## NOT fixing (confirmed by design)
- Void transactions visible in portal → by design (transparency)
- Override saldo doesn't create CashBankTransaction → by design (correction is savings-side only)
- Operator sees voided transactions → by design (operator sees everything)

---

## Task 1: Add auth to all GET savings endpoints (CRITICAL)

**Files:**
- Modify: `src/app/api/savings/transactions/route.ts` (GET handler)
- Modify: `src/app/api/savings/transactions/[id]/route.ts` (GET handler)
- Modify: `src/app/api/savings/accounts/route.ts` (GET handler)
- Modify: `src/app/api/savings/accounts/[id]/route.ts` (GET handler)

### Changes:

**1a. `src/app/api/savings/transactions/route.ts` — Add auth to GET handler**

Add at the start of the GET function (after `try {`):
```typescript
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
```

**1b. `src/app/api/savings/transactions/[id]/route.ts` — Add auth to GET handler**

Add at the start of the GET function (after `try {`):
```typescript
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
```

**1c. `src/app/api/savings/accounts/route.ts` — Add auth to GET handler**

Add `import { auth } from "@/lib/auth";` at top, then add after `try {`:
```typescript
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
```

**1d. `src/app/api/savings/accounts/[id]/route.ts` — Add auth to GET handler**

Add after `try {` in GET function:
```typescript
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
```

Commit: `fix(SIMPANAN-1): add auth check to all GET savings endpoints`

---

## Task 2: Block anggota from POST/PUT/DELETE savings transactions (HIGH)

**Files:**
- Modify: `src/app/api/savings/transactions/route.ts` (POST handler)
- Modify: `src/app/api/savings/transactions/[id]/route.ts` (PUT + DELETE handlers)

### Changes:

**2a. POST handler — add role check after auth check:**

In `src/app/api/savings/transactions/route.ts`, after line `if (!session?.user) { ... }`:
```typescript
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Anggota tidak dapat membuat transaksi simpanan langsung" }, { status: 403 });
        }
```

**2b. PUT handler — add role check after auth check:**

In `src/app/api/savings/transactions/[id]/route.ts`, after line `if (!session?.user) { ... }`:
```typescript
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
```

**2c. DELETE handler — add role check after auth check:**

In `src/app/api/savings/transactions/[id]/route.ts`, after line `if (!session?.user) { ... }` in DELETE:
```typescript
        const roleName = (session.user as any).role?.name || session.user.role;
        if (roleName === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
```

Commit: `fix(SIMPANAN-2): block anggota role from create/edit/delete savings transactions`

---

## Task 3: Fix edit transaction to update linked CashBankTransaction (HIGH)

**Files:**
- Modify: `src/app/api/savings/transactions/[id]/route.ts` (PUT handler)

### Changes:

Inside the `prisma.$transaction` in the PUT handler, AFTER `savingsAccount.update` (line 118) and BEFORE `return [updated]` (line 120), add:

```typescript
            // 3. Sync linked CashBankTransaction if it exists
            if (existing.transactionNo) {
                const cbt = await tx.cashBankTransaction.findFirst({
                    where: { transactionNo: `CBT-${existing.transactionNo}` },
                });
                if (cbt) {
                    // Reverse old effect on cash balance
                    const oldCashEffect = oldEffect; // same variable from balance calc
                    const newCashEffect = newEffect; // same variable from balance calc
                    const cashDiff = newCashEffect - oldCashEffect;
                    const newCashBalance = Number(cbt.balanceBefore) + newCashEffect;

                    await tx.cashBankTransaction.update({
                        where: { id: cbt.id },
                        data: {
                            amount: Number(amount),
                            type: (type === "deposit" || type === "interest") ? "in" : "out",
                            balanceAfter: newCashBalance,
                            description: `${type === "deposit" ? "Setoran" : type === "withdrawal" ? "Penarikan" : "Koreksi"} Simpanan (diedit) — ${existing.member?.name || ""}`,
                        },
                    });

                    // Update cash account balance by the diff
                    await tx.cashBankAccount.update({
                        where: { id: cbt.accountId },
                        data: { currentBalance: { increment: cashDiff } },
                    });
                }
            }
```

BUT WAIT — `existing.member` is not included in the initial query. Need to add `member` to the include. Also `oldEffect` and `newEffect` are calculated outside the transaction. Let me adjust:

Change the initial query to include member name:
```typescript
        const existing = await prisma.savingsTransaction.findUnique({
            where: { id: txId },
            include: { account: true, member: { select: { name: true } } },
        });
```

Then inside the `$transaction`, add after `savingsAccount.update`:

```typescript
            // 3. Sync linked CashBankTransaction if exists
            if (existing.transactionNo) {
                const cbt = await tx.cashBankTransaction.findFirst({
                    where: { transactionNo: `CBT-${existing.transactionNo}` },
                });
                if (cbt) {
                    const newCashEffect = type === "deposit" || type === "interest"
                        ? Number(amount)
                        : -Number(amount);
                    const newCashBalance = Number(cbt.balanceBefore) + newCashEffect;

                    await tx.cashBankTransaction.update({
                        where: { id: cbt.id },
                        data: {
                            amount: Number(amount),
                            type: (type === "deposit" || type === "interest") ? "in" : "out",
                            balanceAfter: newCashBalance,
                            description: `${type === "deposit" ? "Setoran" : "Penarikan"} Simpanan (diedit) — ${existing.member?.name || ""}`,
                        },
                    });

                    // Adjust cash account balance by the diff
                    await tx.cashBankAccount.update({
                        where: { id: cbt.accountId },
                        data: { currentBalance: { increment: balanceDiff } },
                    });
                }
            }
```

Note: `balanceDiff` is already calculated outside the transaction as `newEffect - oldEffect`. This is the exact amount to adjust the cash balance by.

Commit: `fix(SIMPANAN-3): edit transaction syncs linked CashBankTransaction amount and cash balance`

---

## Task 4: Add balance guard when closing/blocking account (LOW)

**Files:**
- Modify: `src/app/api/savings/accounts/[id]/route.ts` (PUT handler)

### Changes:

In the PUT handler, AFTER the duplicate accountNo check (line 53) and BEFORE `const updateData` (line 55), add:

```typescript
        // Guard: prevent closing/blocking account with non-zero balance
        if (status && status !== "active" && Number(account.balance) !== 0) {
            return NextResponse.json(
                { message: `Rekening tidak dapat ditutup/diblokir karena masih memiliki saldo Rp ${Number(account.balance).toLocaleString("id-ID")}. Kosongkan saldo terlebih dahulu.` },
                { status: 400 }
            );
        }
```

Commit: `fix(SIMPANAN-4): prevent closing/blocking savings account with non-zero balance`

---

## Task 5: Restrict transaction type in POST to deposit/withdrawal only (INFO)

**Files:**
- Modify: `src/app/api/savings/transactions/route.ts` (POST handler)

### Changes:

After the product validation (line 115) and BEFORE the AD-ART check (line 117), add:

```typescript
        // Only allow deposit/withdrawal from this endpoint
        // Correction type should only come from override saldo flow
        if (data.type !== "deposit" && data.type !== "withdrawal") {
            return NextResponse.json(
                { message: "Tipe transaksi tidak valid. Gunakan 'deposit' atau 'withdrawal'." },
                { status: 400 }
            );
        }
```

Commit: `fix(SIMPANAN-5): restrict POST savings transaction to deposit/withdrawal type only`
