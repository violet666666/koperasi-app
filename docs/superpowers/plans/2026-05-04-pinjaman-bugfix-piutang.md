# Pinjaman Bug Fixes + Piutang Barang Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 15 bugs (6 critical + 9 important) from the pinjaman code review, then add a Piutang Barang card with detail modal to the member detail page.

**Architecture:** Bug fixes target loan API routes (`src/app/api/loans/**`) — primarily auth hardening, financial calculation corrections, and data integrity. The Piutang Barang feature adds a new API endpoint and UI card with Dialog modal on `/anggota/[id]`.

**Tech Stack:** Next.js App Router, Prisma ORM, TypeScript, shadcn/ui (Dialog, Card, Badge, Tabs), Lucide icons

---

## File Structure

### Bug Fixes — Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/loans/route.ts` | Add auth + operator role check to GET |
| `src/app/api/loans/products/route.ts` | Add auth to GET |
| `src/app/api/loans/[id]/route.ts` | Add auth + operator role to GET |
| `src/app/api/loans/[id]/payments/route.ts` | Add auth to GET, add operator role to POST |
| `src/app/api/loans/[id]/void/route.ts` | Add CashBankTransaction cleanup |
| `src/app/api/loans/schedules/route.ts` | Add auth + operator role to GET |
| `src/app/api/loans/applications/route.ts` | Add auth to GET, operator role to POST |
| `src/app/api/loans/applications/[id]/route.ts` | Add auth to GET |
| `src/app/api/loans/applications/[id]/submit/route.ts` | Add auth |
| `src/app/api/loans/applications/[id]/approve/route.ts` | Fix allowedRoles to operator-only |
| `src/app/api/loans/applications/[id]/reject/route.ts` | Add operator role check |
| `src/app/api/loans/applications/[id]/disburse/route.ts` | Fix allowedRoles + use product interestRate + add CashBankTransaction |
| `src/app/api/loans/applications/direct-disburse/route.ts` | Use product interestRate + add CashBankTransaction |
| `src/app/api/loans/purge/route.ts` | Fix role to operator |
| `src/app/api/loans/generate-schedules/route.ts` | Fix role to operator-only |
| `src/app/api/loans/import-migrasi/route.ts` | Add operator role + generate LoanSchedule records |
| `src/app/api/loans/import-update/route.ts` | Add operator role |
| `src/app/api/loans/reports/interest/_lib/report-helpers.ts` | Fix checkOperatorAuth to operator-only |

### Piutang Barang Feature — Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/api/members/[id]/piutang-barang/route.ts` | **CREATE** — API for member's piutang barang data |
| `src/app/(protected)/anggota/[id]/page.tsx` | **MODIFY** — Add Piutang Barang card + Dialog |

---

## Task 1: Add Auth & Operator Role to All Unprotected Loan GET Endpoints

**Files:**
- Modify: `src/app/api/loans/route.ts`
- Modify: `src/app/api/loans/products/route.ts`
- Modify: `src/app/api/loans/[id]/route.ts`
- Modify: `src/app/api/loans/[id]/payments/route.ts`
- Modify: `src/app/api/loans/schedules/route.ts`
- Modify: `src/app/api/loans/applications/route.ts` (GET handler)
- Modify: `src/app/api/loans/applications/[id]/route.ts`
- Modify: `src/app/api/loans/applications/[id]/submit/route.ts`

All these endpoints currently have zero authentication. Add session check + operator role to each.

- [ ] **Step 1: Add auth to `src/app/api/loans/route.ts`**

Add at the top of the GET handler, before any queries:

```typescript
import { auth } from "@/lib/auth";

// Inside GET handler, after try {:
const session = await auth();
if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
```

- [ ] **Step 2: Add auth to `src/app/api/loans/products/route.ts`**

Same pattern — add `auth()` import and session check at the top of GET.

- [ ] **Step 3: Add auth + operator role to `src/app/api/loans/[id]/route.ts` GET handler**

```typescript
import { auth } from "@/lib/auth";

// Inside GET handler:
const session = await auth();
if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}
const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
if (roleName !== "operator") {
    return NextResponse.json({ message: "Hanya Operator yang dapat mengakses data pinjaman." }, { status: 403 });
}
```

- [ ] **Step 4: Add auth to `src/app/api/loans/[id]/payments/route.ts` GET handler**

Add session check to GET (lines 31-33 currently have no auth).

- [ ] **Step 5: Add auth to `src/app/api/loans/schedules/route.ts`**

Add session + operator role check to GET.

- [ ] **Step 6: Add auth to `src/app/api/loans/applications/route.ts` GET handler**

The GET handler (around line 20) needs session + operator role check. POST handler already has session check but needs operator role (see Task 2).

- [ ] **Step 7: Add auth to `src/app/api/loans/applications/[id]/route.ts`**

Add session + operator role check to GET.

- [ ] **Step 8: Add auth to `src/app/api/loans/applications/[id]/submit/route.ts`**

Add session check. This endpoint changes application status from "draft" to "submitted" — must require authentication:

```typescript
import { auth } from "@/lib/auth";

export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        // ... rest of handler
```

- [ ] **Step 9: Verify all endpoints require auth**

Run the app and confirm each endpoint returns 401 when called without session cookie.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/loans/route.ts src/app/api/loans/products/route.ts src/app/api/loans/\[id\]/route.ts src/app/api/loans/\[id\]/payments/route.ts src/app/api/loans/schedules/route.ts src/app/api/loans/applications/route.ts src/app/api/loans/applications/\[id\]/route.ts src/app/api/loans/applications/\[id\]/submit/route.ts
git commit -m "fix: add authentication to all unprotected loan API endpoints (CRITICAL-5)"
```

---

## Task 2: Fix Role Authorization Across All Loan Routes (Operator-Only)

**Files:**
- Modify: `src/app/api/loans/[id]/payments/route.ts` (POST — add operator role)
- Modify: `src/app/api/loans/applications/[id]/approve/route.ts` (remove admin/super_admin)
- Modify: `src/app/api/loans/applications/[id]/reject/route.ts` (add operator role)
- Modify: `src/app/api/loans/applications/[id]/disburse/route.ts` (remove admin/super_admin)
- Modify: `src/app/api/loans/purge/route.ts` (fix to operator)
- Modify: `src/app/api/loans/generate-schedules/route.ts` (remove admin/super_admin)
- Modify: `src/app/api/loans/import-migrasi/route.ts` (add operator role)
- Modify: `src/app/api/loans/import-update/route.ts` (add operator role)
- Modify: `src/app/api/loans/reports/interest/_lib/report-helpers.ts` (remove admin/super_admin)
- Modify: `src/app/api/loans/applications/route.ts` (POST — add operator role)

- [ ] **Step 1: Fix `payments/route.ts` POST — add operator role check (CRITICAL-6)**

After the session check (line 62), add:

```typescript
const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
if (roleName !== "operator") {
    return NextResponse.json({ message: "Hanya Operator yang dapat mencatat pembayaran pinjaman." }, { status: 403 });
}
```

- [ ] **Step 2: Fix `approve/route.ts` — change allowedRoles to operator-only**

Change line 16 from:
```typescript
const allowedRoles = ["operator", "admin", "super_admin"];
```
to:
```typescript
const allowedRoles = ["operator"];
```

- [ ] **Step 3: Fix `reject/route.ts` — add operator role check**

After session check (line 14), add:

```typescript
const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
if (roleName !== "operator") {
    return NextResponse.json({ message: "Hanya Operator yang dapat menolak pengajuan pinjaman." }, { status: 403 });
}
```

- [ ] **Step 4: Fix `disburse/route.ts` — change allowedRoles to operator-only**

Change line 15 from:
```typescript
const allowedRoles = ["operator", "admin", "super_admin"];
```
to:
```typescript
const allowedRoles = ["operator"];
```

- [ ] **Step 5: Fix `purge/route.ts` — change role check to operator**

Change lines 20-21 from:
```typescript
if (roleName !== "super_admin" && roleName !== "admin") {
```
to:
```typescript
if (roleName !== "operator") {
```
And update the message:
```typescript
return NextResponse.json({ message: "Hanya Operator yang dapat menghapus semua data pinjaman" }, { status: 403 });
```

- [ ] **Step 6: Fix `generate-schedules/route.ts` — operator-only**

Change line 15 from:
```typescript
if (roleName !== "operator" && roleName !== "admin" && roleName !== "super_admin") {
```
to:
```typescript
if (roleName !== "operator") {
```

- [ ] **Step 7: Fix `import-migrasi/route.ts` — add operator role check**

After session check (line 77), add:

```typescript
const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
if (roleName !== "operator") {
    return NextResponse.json({ message: "Hanya Operator yang dapat mengimport data pinjaman." }, { status: 403 });
}
```

- [ ] **Step 8: Fix `import-update/route.ts` — add operator role check**

After session check, add the same operator role check pattern.

- [ ] **Step 9: Fix `report-helpers.ts` checkOperatorAuth — operator-only**

Change line 73 from:
```typescript
if (roleName !== "operator" && roleName !== "admin" && roleName !== "super_admin") {
```
to:
```typescript
if (roleName !== "operator") {
```

- [ ] **Step 10: Fix `applications/route.ts` POST — add operator role**

The POST handler has session check but no role restriction. After the session check, add:

```typescript
const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
if (roleName !== "operator") {
    return NextResponse.json({ message: "Hanya Operator yang dapat membuat pengajuan pinjaman." }, { status: 403 });
}
```

- [ ] **Step 11: Commit**

```bash
git add -A src/app/api/loans/
git commit -m "fix: restrict all loan routes to operator-only role, remove admin/super_admin access (CRITICAL-6, IMPORTANT-1~5)"
```

---

## Task 3: Fix Hardcoded Interest Rate in Disbursement Routes (CRITICAL-1)

**Files:**
- Modify: `src/app/api/loans/applications/[id]/disburse/route.ts`
- Modify: `src/app/api/loans/applications/direct-disburse/route.ts`

- [ ] **Step 1: Fix `disburse/route.ts` — use product.interestRate**

The product is already fetched at line 35. Replace lines 40-43:

Before:
```typescript
const interestRate = 1; // 1%
const adminFee = Math.round(principalAmount * 0.02);
const interestPerMonth = Math.round(principalAmount * 0.01);
```

After:
```typescript
const interestRate = Number(product.interestRate) || 1;
const adminFee = Math.round(principalAmount * (Number(product.adminFeeRate || 0.02) * 100) / 100);
const interestPerMonth = Math.round(principalAmount * (interestRate / 100));
```

Note: If `product.adminFeeRate` doesn't exist, keep the hardcoded `0.02` (2%). The critical fix is the interest rate.

- [ ] **Step 2: Fix `direct-disburse/route.ts` — use product.interestRate**

Replace lines 68-74:

Before:
```typescript
const interestPerMonth = Math.round(principalAmount * 0.01); // 1% flat/bulan
// ...
const interestRate = 1; // 1%
```

After:
```typescript
const interestRate = Number(product.interestRate) || 1;
const interestPerMonth = Math.round(principalAmount * (interestRate / 100));
```

Move the `interestRate` declaration before `interestPerMonth` (line 68 area). The rest of the calculations (`totalInterest`, `monthlyInstallment`, etc.) already use these variables correctly.

- [ ] **Step 3: Verify calculation**

Test with a loan product that has `interestRate = 1.5`:
- principalAmount = 10,000,000
- interestPerMonth should be 150,000 (not 100,000)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/loans/applications/\[id\]/disburse/route.ts src/app/api/loans/applications/direct-disburse/route.ts
git commit -m "fix: use product.interestRate instead of hardcoded 1% in disbursement routes (CRITICAL-1)"
```

---

## Task 4: Add Cash Outflow Recording to Disbursement Routes (CRITICAL-3)

**Files:**
- Modify: `src/app/api/loans/applications/[id]/disburse/route.ts`
- Modify: `src/app/api/loans/applications/direct-disburse/route.ts`

Both routes need to create a `CashBankTransaction` for the disbursement (cash out) and record the journal entry.

- [ ] **Step 1: Add CashBankTransaction + Journal to `disburse/route.ts`**

Inside the `$transaction` block, after creating the loan (after line 98), add cash outflow recording. This requires knowing which cash/bank account to use. For disbursement, we'll use a default or configurable account.

Add after `newLoan` creation and before `return { loanId: ... }`:

```typescript
// 5. Record cash outflow (disbursement)
// Find the primary cash account for simpan_pinjam
const cashAccount = await tx.cashBankAccount.findFirst({
    where: { branchId: application.branchId, isActive: true },
    orderBy: { id: 'asc' },
});

if (cashAccount) {
    const balBefore = Number(cashAccount.currentBalance);
    const balAfter = balBefore - disbursedAmount;

    const cbTx = await tx.cashBankTransaction.create({
        data: {
            transactionNo: `CBM-PJM-${newLoan.loanNo}`,
            accountId: cashAccount.id,
            branchId: application.branchId,
            type: "out",
            category: "pencairan_pinjaman",
            amount: disbursedAmount,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            referenceType: "Loan",
            referenceId: newLoan.id,
            unitType: "simpan_pinjam",
            description: `Pencairan Pinjaman ${newLoan.loanNo} untuk ${application.member.name}`,
            transactionDate: baseDate,
            memberId: application.memberId,
            createdById: currentUserId,
        },
    });

    await tx.cashBankAccount.update({
        where: { id: cashAccount.id },
        data: { currentBalance: balAfter },
    });

    // Link cash transaction to loan
    await tx.loan.update({
        where: { id: newLoan.id },
        data: { disbursementCashBankId: cbTx.id },
    });
}
```

- [ ] **Step 2: Add same CashBankTransaction recording to `direct-disburse/route.ts`**

After loan creation inside the transaction (after `loan` is created at line 141), add the same pattern:

```typescript
// 5. Record cash outflow
const cashAccount = await tx.cashBankAccount.findFirst({
    where: { branchId: member.branchId, isActive: true },
    orderBy: { id: 'asc' },
});

if (cashAccount) {
    const balBefore = Number(cashAccount.currentBalance);
    const balAfter = balBefore - disbursedAmount;

    const cbTx = await tx.cashBankTransaction.create({
        data: {
            transactionNo: `CBM-PJM-${loan.loanNo}`,
            accountId: cashAccount.id,
            branchId: member.branchId,
            type: "out",
            category: "pencairan_pinjaman",
            amount: disbursedAmount,
            balanceBefore: balBefore,
            balanceAfter: balAfter,
            referenceType: "Loan",
            referenceId: loan.id,
            unitType: "simpan_pinjam",
            description: `Pencairan Pinjaman ${loan.loanNo} untuk ${member.name}`,
            transactionDate: baseDate,
            memberId: data.memberId,
            createdById: currentUserId,
        },
    });

    await tx.cashBankAccount.update({
        where: { id: cashAccount.id },
        data: { currentBalance: balAfter },
    });

    await tx.loan.update({
        where: { id: loan.id },
        data: { disbursementCashBankId: cbTx.id },
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/applications/\[id\]/disburse/route.ts src/app/api/loans/applications/direct-disburse/route.ts
git commit -m "feat: record cash outflow CashBankTransaction on loan disbursement (CRITICAL-3)"
```

---

## Task 5: Fix Void Route to Clean Up Payment-Level CashBankTransactions (CRITICAL-2)

**Files:**
- Modify: `src/app/api/loans/[id]/void/route.ts`

- [ ] **Step 1: Add CashBankTransaction deletion to void route**

In the void route, inside the `for (const payment of loan.payments)` loop (line 65), before the balance reversal, add CashBankTransaction cleanup:

Before (current code at lines 65-79):
```typescript
for (const payment of loan.payments) {
    // Reverse cash/bank balance — payment was IN, so SUBTRACT
    if (payment.cashBankAccountId) {
        await tx.cashBankAccount.update({
            where: { id: payment.cashBankAccountId },
            data: { currentBalance: { decrement: payment.amount } }
        });
    }
    // Reverse journal for this payment
    if (payment.journalId) {
        await tx.journalLine.deleteMany({ where: { journalId: payment.journalId } });
        await tx.journal.delete({ where: { id: payment.journalId } });
    }
}
```

After:
```typescript
for (const payment of loan.payments) {
    // Delete payment-level CashBankTransaction records
    await tx.cashBankTransaction.deleteMany({
        where: {
            referenceType: "LoanPayment",
            referenceId: payment.id,
        },
    });

    // Reverse cash/bank balance — payment was IN, so SUBTRACT
    if (payment.cashBankAccountId) {
        await tx.cashBankAccount.update({
            where: { id: payment.cashBankAccountId },
            data: { currentBalance: { decrement: payment.amount } }
        });
    }

    // Reverse journal for this payment
    if (payment.journalId) {
        await tx.journalLine.deleteMany({ where: { journalId: payment.journalId } });
        await tx.journal.delete({ where: { id: payment.journalId } });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/loans/\[id\]/void/route.ts
git commit -m "fix: delete payment-level CashBankTransactions when voiding loan (CRITICAL-2)"
```

---

## Task 6: Add LoanSchedule Generation to Import-Migrasi + Fix Interest Rate (CRITICAL-4, IMPORTANT-9)

**Files:**
- Modify: `src/app/api/loans/import-migrasi/route.ts`

- [ ] **Step 1: Add LoanSchedule generation inside the loan creation block**

In the commit phase (inside `for (const data of batch)` loop, after the `tx.loan.create()` at line 462), add schedule generation. The loan variable from `tx.loan.create()` needs to be captured.

Change the `tx.loan.create()` to capture the result:
```typescript
const newLoan = await tx.loan.create({
```

Then add after the loan creation:

```typescript
// Generate LoanSchedule records for this migrated loan
const principal = data.principalAmount;
const totalInterest = 0; // Migrated loans have 0% interest
const tenor = data.tenorMonths || 60;
const paidPrincipal = data.principalPaid;
const principalPerMonth = tenor > 0 ? Math.floor(principal / tenor) : 0;
const paidInstallments = principalPerMonth > 0 ? Math.round(paidPrincipal / principalPerMonth) : 0;

const baseDate = new Date(data.applicationDate || new Date());

const schedules = [];
for (let j = 1; j <= tenor; j++) {
    const dueDate = new Date(baseDate);
    dueDate.setMonth(dueDate.getMonth() + j);

    let schedPrincipal = Math.floor(principal / tenor);
    // Rounding correction on last installment
    if (j === tenor) {
        const totalSchedPrincipal = Math.floor(principal / tenor) * tenor;
        schedPrincipal += (principal - totalSchedPrincipal);
    }

    const isPaid = j <= paidInstallments;

    schedules.push({
        loanId: newLoan.id,
        installmentNo: j,
        dueDate,
        principalAmount: schedPrincipal,
        interestAmount: 0,
        totalAmount: schedPrincipal,
        principalPaid: isPaid ? schedPrincipal : 0,
        interestPaid: 0,
        status: isPaid ? "paid" : "pending",
    });
}

await tx.loanSchedule.createMany({ data: schedules });
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/loans/import-migrasi/route.ts
git commit -m "fix: generate LoanSchedule records during loan migration import (CRITICAL-4)"
```

---

## Task 7: Fix Loan Number Collision + Payment Number Race Condition (IMPORTANT-6, IMPORTANT-7)

**Files:**
- Modify: `src/app/api/loans/applications/[id]/disburse/route.ts`
- Modify: `src/app/api/loans/applications/direct-disburse/route.ts`
- Modify: `src/app/api/loans/[id]/payments/route.ts`

- [ ] **Step 1: Fix loan number in `disburse/route.ts` — use DB-queried sequence**

Replace the random number generation (lines 72-73) with a DB-queried sequential number inside the transaction:

Before:
```typescript
const dateStr = baseDate.getFullYear().toString();
const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
const newLoan = await tx.loan.create({
    data: {
        loanNo: `PJM-${dateStr}-${randomId}`,
```

After:
```typescript
const dateStr = baseDate.getFullYear().toString();
// Query DB for next sequence number to avoid collisions
const lastLoan = await tx.loan.findFirst({
    where: { loanNo: { startsWith: `PJM-${dateStr}-` } },
    orderBy: { loanNo: 'desc' },
    select: { loanNo: true },
});
let seq = 1;
if (lastLoan) {
    const match = lastLoan.loanNo.match(/PJM-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1], 10) + 1;
}
const loanNo = `PJM-${dateStr}-${seq.toString().padStart(4, "0")}`;
const newLoan = await tx.loan.create({
    data: {
        loanNo,
```

- [ ] **Step 2: Fix loan number in `direct-disburse/route.ts` — same pattern**

Replace lines 115-116 with the same DB-queried sequence:

```typescript
const loanYear = baseDate.getFullYear().toString();
const lastLoan = await tx.loan.findFirst({
    where: { loanNo: { startsWith: `PJM-${loanYear}-` } },
    orderBy: { loanNo: 'desc' },
    select: { loanNo: true },
});
let seq = 1;
if (lastLoan) {
    const match = lastLoan.loanNo.match(/PJM-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1], 10) + 1;
}
const loanNo = `PJM-${loanYear}-${seq.toString().padStart(4, "0")}`;
```

- [ ] **Step 3: Fix payment number TOCTOU in `payments/route.ts`**

Move `generatePaymentNo()` inside the transaction and use `tx` for the uniqueness check:

Before (lines 177-179):
```typescript
const paymentNo = await generatePaymentNo();
const result = await prisma.$transaction(async (tx) => {
```

After:
```typescript
const result = await prisma.$transaction(async (tx) => {
    // Generate payment number inside transaction for atomicity
    const year = new Date().getFullYear();
    let paymentNo = '';
    for (let attempt = 0; attempt < 5; attempt++) {
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
        paymentNo = `PAY-${year}-${random}`;
        const exists = await tx.loanPayment.findUnique({
            where: { paymentNo },
            select: { id: true },
        });
        if (!exists) break;
        if (attempt === 4) paymentNo = `PAY-${year}-${Date.now().toString().slice(-8)}`;
    }
```

Then update the `tx.loanPayment.create()` to use the in-transaction `paymentNo`:

```typescript
const payment = await tx.loanPayment.create({
    data: {
        paymentNo, // uses the one generated inside transaction
```

Remove the now-unused `generatePaymentNo` function or keep it as dead code (doesn't matter).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/loans/applications/\[id\]/disburse/route.ts src/app/api/loans/applications/direct-disburse/route.ts src/app/api/loans/\[id\]/payments/route.ts
git commit -m "fix: sequential loan numbering and atomic payment number generation (IMPORTANT-6, IMPORTANT-7)"
```

---

## Task 8: Add Import Data Integrity Validation (IMPORTANT-8)

**Files:**
- Modify: `src/app/api/loans/import-update/route.ts`

- [ ] **Step 1: Add validation for principalPaid + principalOutstanding = principalAmount**

Find where `principalOutstanding` and `principalPaid` are set from Excel data (around lines 280-283). Add a consistency check and derive outstanding from the difference:

Add before the loan update/create:

```typescript
// Validate financial consistency: principalOutstanding should equal principalAmount - principalPaid
const expectedOutstanding = taskData.pinjam - taskData.jumlah;
if (Math.abs(taskData.sisaSaldo - expectedOutstanding) > 10000) {
    // Significant discrepancy — use calculated value and log warning
    console.warn(`Import: SISA SALDO mismatch for NRP ${taskData.nrp}. Excel=${taskData.sisaSaldo}, Calculated=${expectedOutstanding}. Using calculated value.`);
    taskData.sisaSaldo = Math.max(0, expectedOutstanding);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/loans/import-update/route.ts
git commit -m "fix: validate principalPaid+outstanding consistency during loan import (IMPORTANT-8)"
```

---

## Task 9: Create Piutang Barang API Endpoint

**Files:**
- Create: `src/app/api/members/[id]/piutang-barang/route.ts`

This endpoint returns a member's merchandise receivables (piutang barang) from both UnitTransaction and StoreSale sources.

- [ ] **Step 1: Create the API route**

Create file `src/app/api/members/[id]/piutang-barang/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/members/[id]/piutang-barang
export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const memberId = parseInt(id);
        if (isNaN(memberId)) {
            return NextResponse.json({ message: "ID anggota tidak valid" }, { status: 400 });
        }

        // Fetch unpaid UnitTransactions (salary_cut receivables)
        const unitPiutang = await prisma.unitTransaction.findMany({
            where: {
                memberId,
                paymentMethod: "salary_cut",
                isPaid: false,
                status: { in: ["completed", "pending_void"] },
            },
            orderBy: { transactionDate: "desc" },
            select: {
                id: true,
                transactionNo: true,
                unitType: true,
                description: true,
                amount: true,
                loanAmount: true,
                transactionDate: true,
                paymentMethod: true,
                notes: true,
                status: true,
            },
        });

        // Fetch unpaid StoreSales (salary_cut receivables from Toko POS)
        const storeSales = await prisma.storeSale.findMany({
            where: {
                memberId,
                paymentMethod: "salary_cut",
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                saleNo: true,
                totalAmount: true,
                customerName: true,
                createdAt: true,
                metadata: true,
                unitType: true,
                items: {
                    select: {
                        product: { select: { name: true } },
                        quantity: true,
                        unitPrice: true,
                        subtotal: true,
                    },
                },
            },
        });

        // Filter out voided StoreSales
        const activeStoreSales = storeSales.filter((s) => {
            const meta = (typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata) as Record<string, unknown> | null;
            return !meta?.isVoided;
        });

        // Map to unified format
        const mappedUnitPiutang = unitPiutang.map((t) => ({
            id: t.id,
            source: "unit_transaction" as const,
            transactionNo: t.transactionNo,
            unitType: t.unitType,
            description: t.description,
            amount: Number(t.amount),
            loanAmount: Number(t.loanAmount),
            transactionDate: t.transactionDate,
            status: t.status,
            notes: t.notes,
        }));

        const mappedStoreSales = activeStoreSales.map((s) => {
            const itemDesc = s.items?.map((i) => `${i.product?.name || "[Dihapus]"} x${i.quantity}`).join(", ");
            return {
                id: s.id + 10000000,
                source: "store_sale" as const,
                transactionNo: s.saleNo,
                unitType: s.unitType || "toko",
                description: itemDesc || `Pembelian Toko PRIMKOPPOL`,
                amount: Number(s.totalAmount),
                loanAmount: Number(s.totalAmount),
                transactionDate: s.createdAt,
                status: "completed",
                notes: null,
                items: s.items?.map((i) => ({
                    name: i.product?.name || "[Dihapus]",
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    subtotal: Number(i.subtotal),
                })) || [],
            };
        });

        // Merge and sort by date
        const allPiutang = [...mappedUnitPiutang, ...mappedStoreSales]
            .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

        // Summary
        const totalPiutang = allPiutang.reduce((sum, p) => sum + p.amount, 0);
        const unitTypeBreakdown = allPiutang.reduce<Record<string, number>>((acc, p) => {
            const ut = p.unitType || "lainnya";
            acc[ut] = (acc[ut] || 0) + p.amount;
            return acc;
        }, {});

        return NextResponse.json({
            data: {
                piutang: allPiutang,
                summary: {
                    totalItems: allPiutang.length,
                    totalAmount: totalPiutang,
                    byUnitType: unitTypeBreakdown,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/members/[id]/piutang-barang error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data piutang barang" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Test the endpoint**

Open browser to `/api/members/775/piutang-barang` and verify the response contains piutang data.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/members/\[id\]/piutang-barang/route.ts
git commit -m "feat: add Piutang Barang API endpoint for member receivables"
```

---

## Task 10: Add Piutang Barang Card + Detail Modal to Member Detail Page

**Files:**
- Modify: `src/app/(protected)/anggota/[id]/page.tsx`

Add a "Piutang Barang" card to the summary cards row and a Dialog modal showing receivable history when clicked.

- [ ] **Step 1: Add imports and state**

At the top of the file, add Dialog imports:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Eye } from "lucide-react";
```

Inside the component function (after existing state declarations around line 203), add:

```typescript
const [piutangBarang, setPiutangBarang] = useState<{ piutang: any[]; summary: { totalItems: number; totalAmount: number; byUnitType: Record<string, number> } } | null>(null);
const [showPiutangModal, setShowPiutangModal] = useState(false);
const [loadingPiutang, setLoadingPiutang] = useState(false);
```

Note: Replace `React.useState` with `useState` by adding it to the React import, or use `React.useState` pattern consistently.

- [ ] **Step 2: Add fetch function for piutang data**

Inside the component, add a function to load piutang data when the card is clicked:

```typescript
const loadPiutangBarang = async () => {
    if (piutangBarang) {
        setShowPiutangModal(true);
        return;
    }
    setLoadingPiutang(true);
    try {
        const res = await fetch(`/api/members/${params.id}/piutang-barang`);
        if (res.ok) {
            const data = await res.json();
            setPiutangBarang(data.data);
        }
    } catch (e) {
        console.error("Failed to fetch piutang:", e);
    } finally {
        setLoadingPiutang(false);
        setShowPiutangModal(true);
    }
};
```

- [ ] **Step 3: Add Piutang Barang summary card to the grid**

In the summary cards grid (after the "Sisa Limit Unit" card at line 384), add:

```tsx
{/* Piutang Barang Card */}
{(() => {
    // Quick check: show card if member has salary_cut unit transactions
    // Full data loads on click
    return (
        <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={loadPiutangBarang}
        >
            <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg p-3 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                    <ShoppingCart className="h-5 w-5" />
                </div>
                <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Piutang Barang</p>
                    <p className="text-lg font-bold">Lihat Detail</p>
                </div>
                <Eye className="h-4 w-4 text-muted-foreground" />
            </CardContent>
        </Card>
    );
})()}
```

- [ ] **Step 4: Add the Detail Modal Dialog**

Add before the closing `</div>` of the main container (before line 747):

```tsx
{/* Piutang Barang Detail Modal */}
<Dialog open={showPiutangModal} onOpenChange={setShowPiutangModal}>
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Piutang Barang — {member?.name}
            </DialogTitle>
        </DialogHeader>

        {loadingPiutang ? (
            <div className="py-8 text-center text-muted-foreground">Memuat data...</div>
        ) : piutangBarang && piutangBarang.piutang.length > 0 ? (
            <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Total Piutang</p>
                            <p className="text-2xl font-bold text-orange-600">
                                {formatCurrency(piutangBarang.summary.totalAmount)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-sm text-muted-foreground">Jumlah Transaksi</p>
                            <p className="text-2xl font-bold">{piutangBarang.summary.totalItems}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Per-unit breakdown */}
                {Object.keys(piutangBarang.summary.byUnitType).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(piutangBarang.summary.byUnitType).map(([unit, amount]) => (
                            <Badge key={unit} variant="outline" className="text-xs">
                                {unit}: {formatCurrency(amount)}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* Transaction list */}
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">No. Transaksi</th>
                                <th className="px-3 py-2 text-left font-medium">Deskripsi</th>
                                <th className="px-3 py-2 text-right font-medium">Jumlah</th>
                                <th className="px-3 py-2 text-right font-medium">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {piutangBarang.piutang.map((p: any) => (
                                <tr key={p.id} className="hover:bg-muted/50">
                                    <td className="px-3 py-2 font-mono text-xs">{p.transactionNo}</td>
                                    <td className="px-3 py-2">
                                        <p className="font-medium text-xs line-clamp-1">{p.description}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{p.unitType}</p>
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                                        {formatCurrency(p.amount)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-xs">
                                        {new Date(p.transactionDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
            <div className="py-8 text-center text-muted-foreground">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <p>Tidak ada piutang barang untuk anggota ini.</p>
            </div>
        )}
    </DialogContent>
</Dialog>
```

- [ ] **Step 5: Test the feature**

1. Navigate to `/anggota/775`
2. Verify "Piutang Barang" card appears in summary row
3. Click the card — modal should open with piutang data
4. Verify transaction list, amounts, and summary are correct
5. Test with a member that has no piutang — should show empty state

- [ ] **Step 6: Commit**

```bash
git add src/app/\(protected\)/anggota/\[id\]/page.tsx
git commit -m "feat: add Piutang Barang card with detail modal to member detail page"
```

---

## Task Dependency Graph

```
Task 1 (auth on GET endpoints) ──┐
Task 2 (role fixes) ─────────────┤── independent, can run in any order
Task 3 (interest rate fix) ──────┤
Task 4 (cash outflow) ───────────┤
Task 5 (void cleanup) ───────────┤
Task 6 (import schedules) ───────┤
Task 7 (loan/pay number fix) ────┤
Task 8 (import validation) ──────┘
Task 9 (piutang API) ─────────── ── depends on nothing
Task 10 (piutang UI) ─────────── ── depends on Task 9
```

Tasks 1-8 are independent bug fixes (no dependencies between them).
Task 10 depends on Task 9 (API must exist before UI calls it).

## Estimated Effort

| Task | Complexity | Files |
|------|-----------|-------|
| Task 1 | Mechanical | 8 files, ~40 lines |
| Task 2 | Mechanical | 10 files, ~30 lines |
| Task 3 | Simple | 2 files, ~6 lines |
| Task 4 | Moderate | 2 files, ~50 lines each |
| Task 5 | Simple | 1 file, ~6 lines |
| Task 6 | Moderate | 1 file, ~40 lines |
| Task 7 | Moderate | 3 files, ~30 lines each |
| Task 8 | Simple | 1 file, ~10 lines |
| Task 9 | Moderate | 1 new file, ~120 lines |
| Task 10 | Moderate | 1 file, ~100 lines added |
