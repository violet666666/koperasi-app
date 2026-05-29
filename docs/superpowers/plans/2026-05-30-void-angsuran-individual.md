# Void Angsuran Individual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable operators to void (cancel) a single loan installment payment that was double-input by human error, with full atomic reversal of all accounting side effects (CashBank balance, LoanSchedule, Loan counters).

**Architecture:** Add `status`/`voidedAt`/`voidedById`/`voidReason` fields to `LoanPayment` (matching existing `SavingsTransaction` and `UnitTransaction` patterns). Create a new API endpoint `POST /api/loans/[id]/payments/[paymentId]/void` that atomically reverses the payment's effects inside a `prisma.$transaction`. Add a "Void" button with confirmation dialog to the payment history table on the loan detail page.

**Tech Stack:** Next.js 15 Route Handlers, Prisma ORM, NeonDB (PostgreSQL), shadcn/ui (Dialog, Button, Input, Badge), NextAuth v5.

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `prisma/schema.prisma` | Modify | Add status/void fields to LoanPayment model |
| 2 | `src/app/api/admin/migrate/route.ts` | Modify | Add migration for new columns |
| 3 | `src/lib/payment-void-helpers.ts` | Create | Reversal logic helpers (schedule rollback, CB reversal) |
| 4 | `src/app/api/loans/[id]/payments/[paymentId]/void/route.ts` | Create | API endpoint for voiding individual payment |
| 5 | `src/lib/api/services.ts` | Modify | Add `voidPayment(loanId, paymentId, reason)` method |
| 6 | `src/app/(protected)/pinjaman/[id]/page.tsx` | Modify | Void button + confirmation dialog on payment rows |
| 7 | `src/lib/constants/index.ts` | Modify | Add `LOAN_PAYMENT_STATUS` constant |

---

### Task 1: Schema Migration — Add Void Fields to LoanPayment

**Files:**
- Modify: `prisma/schema.prisma` (LoanPayment model, ~line 539)
- Modify: `src/app/api/admin/migrate/route.ts`

**Context:** The `SavingsTransaction` model already has `status`, `voidedAt`, `voidedById`, `voidReason` fields. We follow the same pattern for `LoanPayment`.

- [ ] **Step 1: Add fields to LoanPayment model in schema.prisma**

In `prisma/schema.prisma`, add these 4 fields to the `LoanPayment` model (after `updatedAt`, before the relations):

```prisma
  // Void/reversal tracking — matches SavingsTransaction pattern
  status          String    @default("completed") // completed, voided
  voidedAt        DateTime? @map("voided_at")
  voidedById      Int?      @map("voided_by_id")
  voidReason      String?   @map("void_reason")
```

Also add the `voidedBy` relation (near the other relations):

```prisma
  voidedBy        User?                     @relation("PaymentVoidedBy", fields: [voidedById], references: [id])
```

Update the existing `createdBy` relation to use the explicit name if not already:

```prisma
  createdBy       User                      @relation("PaymentCreatedBy", fields: [createdById], references: [id])
```

Add index:

```prisma
  @@index([status])
```

- [ ] **Step 2: Add migration to the custom migrate endpoint**

In `src/app/api/admin/migrate/route.ts`, add a new migration block (after existing migrations, before the response). Use the same pattern as existing column additions:

```typescript
// Migration: LoanPayment void fields
const paymentVoidCols = await tableExists('information_schema.columns', {
    table_name: 'loan_payments',
    column_name: 'status'
});
if (!paymentVoidCols) {
    await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'completed'`;
    await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN voided_at TIMESTAMP`;
    await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN voided_by_id INTEGER`;
    await prisma.$executeRaw`ALTER TABLE loan_payments ADD COLUMN void_reason TEXT`;
    migrations.push('loan_payments: void tracking fields (status, voided_at, voided_by_id, void_reason)');
}
```

Note: The `tableExists` helper is already defined in this file. It queries `information_schema.columns` to check if a column exists.

- [ ] **Step 3: Run prisma generate**

Run: `npx prisma generate`
Expected: Schema introspected successfully, Prisma Client updated.

- [ ] **Step 4: Run migration endpoint against dev database**

Run: `curl -X POST http://localhost:3000/api/admin/migrate` (or invoke via browser)
Expected: Response includes `loan_payments: void tracking fields` in migrations list.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/app/api/admin/migrate/route.ts
git commit -m "feat: add void tracking fields to LoanPayment model (status, voidedAt, voidedById, voidReason)"
```

---

### Task 2: Payment Void Helpers — Reversal Logic

**Files:**
- Create: `src/lib/payment-void-helpers.ts`

**Context:** These helpers extract the reversal math from the API route for testability, following the pattern of `src/lib/loan-void-helpers.ts`. Each helper is a pure function that produces Prisma operations.

- [ ] **Step 1: Create the helper file**

Create `src/lib/payment-void-helpers.ts`:

```typescript
/**
 * Helper functions for voiding individual loan payments.
 * Extracted from the payment-void route for testability.
 *
 * Pattern follows: src/lib/loan-void-helpers.ts (loan-level void)
 * and the SavingsTransaction void pattern.
 */

/**
 * Represents the allocation data needed to reverse a schedule update.
 * Derived from LoanPaymentAllocation records linked to the payment.
 */
export interface AllocationReversal {
    scheduleId: number;
    principalAmount: number;
    interestAmount: number;
    lateFeeAmount: number;
}

/**
 * Calculates how much to decrement from CashBankAccount balance
 * by summing actual CashBankTransaction amounts linked to a payment.
 *
 * This avoids over-decrement because:
 * - payment.amount may include lateFee that doesn't have a CB Transaction
 * - The payment route creates separate CB Transactions for principal & interest
 *
 * @param cbTransactions - CashBankTransaction records with referenceType="LoanPayment"
 * @returns Total amount to reverse (always positive)
 */
export function calcPaymentCbReversalAmount(
    cbTransactions: Array<{ type: string; amount: number }>
): number {
    // All payment CB transactions are type "in" (kas masuk)
    // Reversal means we subtract (decrement) the total
    return cbTransactions
        .filter(tx => tx.type === "in")
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
}

/**
 * Builds the LoanSchedule rollback operations for a voided payment.
 *
 * For each allocation:
 * - Decrement principalPaid, interestPaid, lateFeePaid
 * - Recalculate status: paid → partial → pending (based on remaining amounts)
 * - Clear paidDate if no longer fully paid
 *
 * @param allocations - The payment's allocations (from LoanPaymentAllocation table)
 * @param schedules - Current schedule state (fetched fresh inside transaction)
 * @returns Array of { scheduleId, updateData } for Prisma updates
 */
export function buildScheduleRollbackOps(
    allocations: AllocationReversal[],
    schedules: Array<{
        id: number;
        principalAmount: number;  // total due
        interestAmount: number;   // total due
        lateFee: number;          // total due
        principalPaid: number;    // currently paid
        interestPaid: number;     // currently paid
        lateFeePaid: number;      // currently paid
        status: string;
    }>
): Array<{ scheduleId: number; data: Record<string, any> }> {
    const results: Array<{ scheduleId: number; data: Record<string, any> }> = [];

    for (const alloc of allocations) {
        const schedule = schedules.find(s => s.id === alloc.scheduleId);
        if (!schedule) continue;

        const newPrincipalPaid = Math.max(0, Number(schedule.principalPaid) - alloc.principalAmount);
        const newInterestPaid = Math.max(0, Number(schedule.interestPaid) - alloc.interestAmount);
        const newLateFeePaid = Math.max(0, Number(schedule.lateFeePaid) - alloc.lateFeeAmount);

        const totalPaid = newPrincipalPaid + newInterestPaid + newLateFeePaid;
        const totalDue = Number(schedule.principalAmount) + Number(schedule.interestAmount) + Number(schedule.lateFee);

        // Determine new status
        let newStatus: string;
        if (totalPaid <= 0) {
            newStatus = "pending";
        } else if (totalPaid < totalDue) {
            newStatus = "partial";
        } else {
            newStatus = "paid"; // shouldn't happen after void, but safety net
        }

        // Determine paidDate
        const newPaidDate = newStatus === "paid" ? schedule.paidDate : null;

        results.push({
            scheduleId: alloc.scheduleId,
            data: {
                principalPaid: newPrincipalPaid,
                interestPaid: newInterestPaid,
                lateFeePaid: newLateFeePaid,
                status: newStatus,
                paidDate: newPaidDate,
            },
        });
    }

    return results;
}

/**
 * Calculates the Loan-level counter updates after a payment void.
 * These are the INVERSE of what the payment route does.
 *
 * Payment does: increment principalPaid, interestPaid, lateFeePaid;
 *               decrement principalOutstanding, interestOutstanding
 *
 * Void does:    decrement principalPaid, interestPaid, lateFeePaid;
 *               increment principalOutstanding, interestOutstanding;
 *               re-activate loan if it was paid_off
 *
 * @param payment - The payment being voided
 * @param loanStatus - Current loan status (to check if reactivation needed)
 */
export function buildLoanRollbackData(
    payment: {
        principalPortion: number;
        interestPortion: number;
        lateFeePortion: number;
        paymentType: string;
        earlySettlementFee: number;
    },
    loanStatus: string
): Record<string, any> {
    const data: Record<string, any> = {
        principalPaid: { decrement: Number(payment.principalPortion) },
        interestPaid: { decrement: Number(payment.interestPortion) },
        lateFeePaid: { decrement: Number(payment.lateFeePortion) },
        principalOutstanding: { increment: Number(payment.principalPortion) },
        interestOutstanding: { increment: Number(payment.interestPortion) },
    };

    // If loan was paid_off (e.g., early settlement), reactivate it
    if (loanStatus === "paid_off") {
        data.status = "active";
        data.paidOffDate = null;
    }

    return data;
}

/**
 * Builds a descriptive response for the void operation.
 * Tells the operator exactly what was reversed.
 */
export function buildPaymentVoidResponse(params: {
    paymentNo: string;
    principalReversed: number;
    interestReversed: number;
    lateFeeReversed: number;
    cbReversed: boolean;
    cbAmount: number;
    schedulesRolledBack: number;
    loanReactivated: boolean;
    reason: string;
}): { message: string; detail: string } {
    const parts: string[] = [`Pembayaran ${params.paymentNo} berhasil dibatalkan (VOID).`];

    if (params.principalReversed > 0) {
        parts.push(`Pokok Rp ${params.principalReversed.toLocaleString("id-ID")} dikembalikan.`);
    }
    if (params.interestReversed > 0) {
        parts.push(`Bunga Rp ${params.interestReversed.toLocaleString("id-ID")} dikembalikan.`);
    }
    if (params.lateFeeReversed > 0) {
        parts.push(`Denda Rp ${params.lateFeeReversed.toLocaleString("id-ID")} dikembalikan.`);
    }
    if (params.cbReversed) {
        parts.push(`Saldo kas/bank dikurangi Rp ${params.cbAmount.toLocaleString("id-ID")}.`);
    }
    if (params.schedulesRolledBack > 0) {
        parts.push(`${params.schedulesRolledBack} jadwal angsuran dikembalikan.`);
    }
    if (params.loanReactivated) {
        parts.push("Status pinjaman diaktifkan kembali (dari Lunas → Aktif).");
    }
    parts.push(`Alasan: ${params.reason}`);

    return {
        message: parts[0],
        detail: parts.join(" "),
    };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/payment-void-helpers.ts
git commit -m "feat: add payment void reversal helper functions"
```

---

### Task 3: API Endpoint — Void Individual Payment

**Files:**
- Create: `src/app/api/loans/[id]/payments/[paymentId]/void/route.ts`

**Context:** This is the core endpoint. It must atomically reverse ALL effects of the payment within a single `prisma.$transaction`. The reversal order matters: (1) fetch state, (2) rollback schedules, (3) reverse CB balance, (4) delete CB transactions, (5) delete allocations, (6) soft-delete payment, (7) update loan counters, (8) audit log.

- [ ] **Step 1: Create the directory structure**

```bash
mkdir -p "src/app/api/loans/[id]/payments/[paymentId]/void"
```

- [ ] **Step 2: Create the void endpoint**

Create `src/app/api/loans/[id]/payments/[paymentId]/void/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logAuditFromRequest } from "@/lib/audit-logger";
import {
    calcPaymentCbReversalAmount,
    buildScheduleRollbackOps,
    buildLoanRollbackData,
    buildPaymentVoidResponse,
    type AllocationReversal,
} from "@/lib/payment-void-helpers";

interface RouteParams {
    params: Promise<{ id: string; paymentId: string }>;
}

// POST /api/loans/[id]/payments/[paymentId]/void
export async function POST(request: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    try {
        // ── Auth ──────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const userId = Number((session.user as any).id);
        const roleName =
            typeof session.user.role === "string"
                ? session.user.role
                : (session.user.role as any)?.name;
        if (!["operator", "admin_sp"].includes(roleName)) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat membatalkan pembayaran angsuran." },
                { status: 403 }
            );
        }

        // ── Parse params ──────────────────────────────────────────
        const resolvedParams = await params;
        const loanId = parseInt(resolvedParams.id);
        const paymentId = parseInt(resolvedParams.paymentId);
        if (isNaN(loanId) || isNaN(paymentId)) {
            return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });
        }

        // ── Parse body ────────────────────────────────────────────
        const body = await request.json().catch(() => ({}));
        const reason = (body.reason as string)?.trim() || "Dibatalkan oleh Operator";

        // ── Fetch payment with allocations ────────────────────────
        const payment = await prisma.loanPayment.findUnique({
            where: { id: paymentId },
            include: {
                allocations: true,
            },
        });

        if (!payment) {
            return NextResponse.json({ message: "Pembayaran tidak ditemukan" }, { status: 404 });
        }

        if (payment.loanId !== loanId) {
            return NextResponse.json(
                { message: "Pembayaran tidak termasuk dalam pinjaman ini" },
                { status: 400 }
            );
        }

        if (payment.status === "voided") {
            return NextResponse.json(
                { message: "Pembayaran ini sudah dibatalkan (VOID)" },
                { status: 400 }
            );
        }

        // ── Fetch loan ────────────────────────────────────────────
        const loan = await prisma.loan.findUnique({
            where: { id: loanId },
        });

        if (!loan) {
            return NextResponse.json({ message: "Pinjaman tidak ditemukan" }, { status: 404 });
        }

        // Prevent voiding payments on voided/written_off loans
        if (loan.status === "voided" || loan.status === "written_off") {
            return NextResponse.json(
                { message: "Tidak dapat membatalkan pembayaran pada pinjaman yang sudah dibatalkan/dihapusbukukan" },
                { status: 400 }
            );
        }

        // ── Prepare reversal data ────────────────────────────────
        const allocations: AllocationReversal[] = payment.allocations.map((a) => ({
            scheduleId: a.scheduleId,
            principalAmount: Number(a.principalAmount),
            interestAmount: Number(a.interestAmount),
            lateFeeAmount: Number(a.lateFeeAmount),
        }));

        // ── Atomic Transaction ────────────────────────────────────
        const result = await prisma.$transaction(async (tx) => {
            // 1. Fetch current schedules (fresh inside tx for accuracy)
            const scheduleIds = allocations.map((a) => a.scheduleId);
            const currentSchedules = await tx.loanSchedule.findMany({
                where: { id: { in: scheduleIds } },
            });

            // 2. Rollback LoanSchedule entries
            const rollbackOps = buildScheduleRollbackOps(allocations, currentSchedules);
            for (const op of rollbackOps) {
                await tx.loanSchedule.update({
                    where: { id: op.scheduleId },
                    data: op.data,
                });
            }

            // 3. Fetch CashBankTransactions linked to this payment
            const cbTransactions = await tx.cashBankTransaction.findMany({
                where: {
                    referenceType: "LoanPayment",
                    referenceId: payment.id,
                },
            });

            // 4. Calculate total CB reversal amount
            const cbReversalAmount = calcPaymentCbReversalAmount(
                cbTransactions.map((cb) => ({ type: cb.type, amount: Number(cb.amount) }))
            );

            // 5. Reverse CashBankAccount balance (decrement — payment was kas masuk)
            let cbReversed = false;
            if (payment.cashBankAccountId && cbReversalAmount > 0) {
                const cbAccount = await tx.cashBankAccount.findUnique({
                    where: { id: payment.cashBankAccountId },
                });
                if (cbAccount) {
                    const newBalance = Number(cbAccount.currentBalance) - cbReversalAmount;
                    await tx.cashBankAccount.update({
                        where: { id: payment.cashBankAccountId },
                        data: { currentBalance: Math.max(0, newBalance) },
                    });
                    cbReversed = true;
                }
            }

            // 6. Delete CashBankTransaction records
            if (cbTransactions.length > 0) {
                await tx.cashBankTransaction.deleteMany({
                    where: {
                        referenceType: "LoanPayment",
                        referenceId: payment.id,
                    },
                });
            }

            // 7. Delete LoanPaymentAllocation records
            await tx.loanPaymentAllocation.deleteMany({
                where: { paymentId: payment.id },
            });

            // 8. Soft-delete (void) the payment
            const voidedPayment = await tx.loanPayment.update({
                where: { id: payment.id },
                data: {
                    status: "voided",
                    voidedAt: new Date(),
                    voidedById: userId,
                    voidReason: reason,
                },
            });

            // 9. Update Loan counters (reverse the payment's effect)
            const loanRollbackData = buildLoanRollbackData(
                {
                    principalPortion: Number(payment.principalPortion),
                    interestPortion: Number(payment.interestPortion),
                    lateFeePortion: Number(payment.lateFeePortion),
                    paymentType: payment.paymentType,
                    earlySettlementFee: Number(payment.earlySettlementFee),
                },
                loan.status
            );

            // For early_settlement: also restore outstanding to pre-payment values
            if (payment.paymentType === "early_settlement") {
                // Early settlement set outstanding to 0 and status to paid_off.
                // Reverse: restore outstanding from payment portions.
                loanRollbackData.principalOutstanding = Number(payment.principalPortion);
                loanRollbackData.interestOutstanding = Number(payment.interestPortion);
                loanRollbackData.status = "active";
                loanRollbackData.paidOffDate = null;
            }

            await tx.loan.update({
                where: { id: loanId },
                data: loanRollbackData,
            });

            return {
                voidedPayment,
                cbReversed,
                cbReversalAmount,
                schedulesRolledBack: rollbackOps.length,
                loanReactivated: loan.status === "paid_off",
            };
        }, { timeout: 30000 });

        // ── Audit Log ─────────────────────────────────────────────
        await logAuditFromRequest(request, session, {
            action: "VOID_PAYMENT" as any,
            module: "pinjaman" as any,
            description: `Void pembayaran angsuran ${payment.paymentNo} (Rp ${Number(payment.amount).toLocaleString("id-ID")}) pada pinjaman ID ${loanId}`,
            targetId: paymentId,
            targetType: "LoanPayment",
            oldData: {
                status: "completed",
                amount: Number(payment.amount),
                principalPortion: Number(payment.principalPortion),
                interestPortion: Number(payment.interestPortion),
            },
            newData: {
                status: "voided",
                voidReason: reason,
                cbReversed: result.cbReversed,
                schedulesRolledBack: result.schedulesRolledBack,
            },
            status: "success",
            duration: Date.now() - startTime,
        });

        // ── Response ──────────────────────────────────────────────
        const response = buildPaymentVoidResponse({
            paymentNo: payment.paymentNo,
            principalReversed: Number(payment.principalPortion),
            interestReversed: Number(payment.interestPortion),
            lateFeeReversed: Number(payment.lateFeePortion),
            cbReversed: result.cbReversed,
            cbAmount: result.cbReversalAmount,
            schedulesRolledBack: result.schedulesRolledBack,
            loanReactivated: result.loanReactivated,
            reason,
        });

        return NextResponse.json({
            message: response.message,
            detail: response.detail,
            data: { paymentId: payment.id, status: "voided" },
        });

    } catch (error) {
        console.error("Error voiding payment:", error);
        const detail = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            { message: `Gagal membatalkan pembayaran: ${detail}` },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/\[id\]/payments/\[paymentId\]/void/route.ts
git commit -m "feat: add API endpoint for voiding individual loan payments"
```

---

### Task 4: API Service — Add voidPayment Method

**Files:**
- Modify: `src/lib/api/services.ts` (~line 107, `loansApi` object)

**Context:** The frontend calls API methods through the `loansApi` service object. We add a `voidPayment` method.

- [ ] **Step 1: Add voidPayment method to loansApi**

In `src/lib/api/services.ts`, add the following method to the `loansApi` object (after `createPayment`):

```typescript
    voidPayment:  (loanId: number, paymentId: number, reason?: string) =>
        api.post<{ message: string; detail: string; data: any }>(
            `/loans/${loanId}/payments/${paymentId}/void`,
            { reason: reason || "" }
        ),
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api/services.ts
git commit -m "feat: add voidPayment method to loansApi service"
```

---

### Task 5: Constants — Add LOAN_PAYMENT_STATUS

**Files:**
- Modify: `src/lib/constants/index.ts` (after LOAN_STATUS definition)

- [ ] **Step 1: Add LOAN_PAYMENT_STATUS constant**

In `src/lib/constants/index.ts`, add after the `INSTALLMENT_STATUS` constant:

```typescript
export const LOAN_PAYMENT_STATUS = {
    completed: { label: "Selesai", color: "success" as const },
    voided: { label: "Dibatalkan", color: "destructive" as const },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/constants/index.ts
git commit -m "feat: add LOAN_PAYMENT_STATUS constant"
```

---

### Task 6: UI — Void Button & Dialog on Loan Detail Page

**Files:**
- Modify: `src/app/(protected)/pinjaman/[id]/page.tsx`

**Context:** The payment history table currently shows 6 read-only columns. We add a 7th "Aksi" column with a "Batalkan" button per row, only for `status !== "voided"` payments, only for operators, only on active loans. The button opens a confirmation dialog requiring the operator to type the payment number to confirm.

- [ ] **Step 1: Add void-related state variables**

After the existing void state block (around line 100, after `isEditing`), add:

```tsx
// Payment Void State
const [voidPaymentDialog, setVoidPaymentDialog] = React.useState<{
    isOpen: boolean;
    payment: any | null;
}>({ isOpen: false, payment: null });
const [voidPaymentConfirm, setVoidPaymentConfirm] = React.useState("");
const [voidPaymentReason, setVoidPaymentReason] = React.useState("");
const [isVoidingPayment, setIsVoidingPayment] = React.useState(false);
```

- [ ] **Step 2: Add the executePaymentVoid function**

After the `executeVoid` function (around line 271), add:

```tsx
const executePaymentVoid = async () => {
    if (!voidPaymentDialog.payment) return;
    if (voidPaymentConfirm !== voidPaymentDialog.payment.paymentNo) return;

    setIsVoidingPayment(true);
    try {
        await loansApi.voidPayment(
            loan.id,
            voidPaymentDialog.payment.id,
            voidPaymentReason || undefined
        );
        toast.success("Pembayaran berhasil dibatalkan (VOID)");

        // Re-fetch loan data to reflect changes
        const res = await loansApi.get(Number(params.id));
        const fetchedLoan = res.data as any;
        setLoan({
            ...fetchedLoan,
            productSnapshot: typeof fetchedLoan.productSnapshot === 'string'
                ? JSON.parse((fetchedLoan.productSnapshot as unknown) as string)
                : fetchedLoan.productSnapshot,
        });
        setSchedule(fetchedLoan.schedules || []);
    } catch (error: any) {
        const msg = error?.response?.data?.message || "Gagal membatalkan pembayaran";
        toast.error(msg);
    } finally {
        setIsVoidingPayment(false);
        setVoidPaymentDialog({ isOpen: false, payment: null });
        setVoidPaymentConfirm("");
        setVoidPaymentReason("");
    }
};
```

**IMPORTANT:** The `toast` import needs to be verified. Check if `sonner` toast is already imported. If not, add `import { toast } from "sonner";` at the top of the file. Also verify `loansApi` is imported (it should be, as the page already uses `loansApi.get()`).

- [ ] **Step 3: Add 7th column header to payment table**

In the payment history table (around line 708), add a 7th column header:

Find the `<TableHead>` for "Metode" (column 6) and add after it:

```tsx
<TableHead className="text-right">Aksi</TableHead>
```

- [ ] **Step 4: Add void button + status badge to each payment row**

For each payment row in the table body, the current code renders data inside `<TableCell>`. After the "Metode" cell, add:

```tsx
<TableCell className="text-right">
    {payment.status === "voided" ? (
        <Badge variant="destructive" className="text-xs">VOID</Badge>
    ) : isOperator && loan?.status === "active" ? (
        <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setVoidPaymentDialog({ isOpen: true, payment })}
        >
            <Ban className="mr-1 h-3 w-3" />
            Batalkan
        </Button>
    ) : null}
</TableCell>
```

Also add conditional styling for voided rows. At the `<TableRow>` for payments, add:

```tsx
<TableRow className={payment.status === "voided" ? "opacity-50" : ""}>
```

- [ ] **Step 5: Add the payment void confirmation dialog**

After the existing loan-level VOID dialog (after its `</Dialog>` closing tag), add the payment void dialog:

```tsx
{/* ── Dialog: Void Individual Payment ── */}
<Dialog open={voidPaymentDialog.isOpen}
    onOpenChange={(open) => {
        if (!open) {
            setVoidPaymentDialog({ isOpen: false, payment: null });
            setVoidPaymentConfirm("");
            setVoidPaymentReason("");
        }
    }}>
    <DialogContent>
        <DialogHeader>
            <DialogTitle className="text-destructive font-bold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Batalkan Pembayaran Angsuran
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-3 text-base">
                <span>
                    Anda akan membatalkan pembayaran <strong>{voidPaymentDialog.payment?.paymentNo}</strong> sebesar{" "}
                    <strong>Rp {Number(voidPaymentDialog.payment?.amount || 0).toLocaleString("id-ID")}</strong>.
                </span>
                <span className="block text-red-600 font-semibold">
                    Tindakan ini akan mengembalikan angsuran ke pinjaman dan membalikkan mutasi kas/bank.
                </span>
            </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
            <div>
                <label className="text-sm font-medium">Alasan Pembatalan</label>
                <Input
                    value={voidPaymentReason}
                    onChange={(e) => setVoidPaymentReason(e.target.value)}
                    placeholder="Contoh: Double input, kesalahan data"
                    className="mt-1"
                />
            </div>
            <div>
                <label className="text-sm font-medium">
                    Ketik <strong>{voidPaymentDialog.payment?.paymentNo}</strong> untuk konfirmasi:
                </label>
                <Input
                    value={voidPaymentConfirm}
                    onChange={(e) => setVoidPaymentConfirm(e.target.value)}
                    placeholder={voidPaymentDialog.payment?.paymentNo || "PAY-xxxxx-xxxxxx"}
                    className="mt-1 font-mono"
                />
            </div>
        </div>
        <DialogFooter>
            <Button variant="outline"
                onClick={() => {
                    setVoidPaymentDialog({ isOpen: false, payment: null });
                    setVoidPaymentConfirm("");
                    setVoidPaymentReason("");
                }}>
                Batal
            </Button>
            <Button
                variant="destructive"
                onClick={executePaymentVoid}
                disabled={voidPaymentConfirm !== voidPaymentDialog.payment?.paymentNo || isVoidingPayment}
            >
                {isVoidingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Batalkan Pembayaran
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
```

- [ ] **Step 6: Verify imports**

At the top of the file, ensure these imports are present (most already are):
- `Ban` from `lucide-react` — already imported for the loan-level VOID button
- `AlertTriangle` from `lucide-react` — already imported for the loan-level VOID dialog
- `Loader2` from `lucide-react` — already imported for loading states
- `toast` from `sonner` — verify; if not present, add the import
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` — already imported
- `Badge` — verify; if not present, add the import from `@/components/ui/badge`
- `Button` — already imported

- [ ] **Step 7: Commit**

```bash
git add "src/app/(protected)/pinjaman/[id]/page.tsx"
git commit -m "feat: add void button and confirmation dialog for individual payment rows"
```

---

### Task 7: Update GET Loans API to Include Payment Status

**Files:**
- Modify: `src/app/api/loans/[id]/route.ts` (GET handler)
- Modify: `src/app/api/loans/[id]/payments/route.ts` (GET handler)

**Context:** The GET endpoints need to filter out voided payments from counts, and return the status field so the UI can render correctly.

- [ ] **Step 1: Update the loan detail GET to exclude voided payments from include**

In `src/app/api/loans/[id]/route.ts`, the GET handler's Prisma query includes `payments`. Add a `where` filter to exclude voided payments:

Find:
```typescript
                payments: {
                    orderBy: { paymentDate: "desc" },
                    take: 10,
                },
```

Change to:
```typescript
                payments: {
                    where: { status: { not: "voided" } },
                    orderBy: { paymentDate: "desc" },
                    take: 10,
                },
```

- [ ] **Step 2: Update the payments list GET to exclude voided by default**

In `src/app/api/loans/[id]/payments/route.ts`, the GET handler fetches all payments. Add a `where` filter:

Find:
```typescript
        const payments = await prisma.loanPayment.findMany({
            where: { loanId: parseInt(id) },
```

Change to:
```typescript
        const payments = await prisma.loanPayment.findMany({
            where: { loanId: parseInt(id), status: { not: "voided" } },
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/\[id\]/route.ts src/app/api/loans/\[id\]/payments/route.ts
git commit -m "fix: exclude voided payments from loan detail and payment list queries"
```

---

### Task 8: End-to-End Verification

**Files:** None (testing only)

**Context:** Verify the entire flow works correctly by running through it manually.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Run the migration endpoint**

Navigate to or curl: `POST http://localhost:3000/api/admin/migrate`
Expected: Response includes `loan_payments: void tracking fields`.

- [ ] **Step 3: Test the void flow end-to-end**

1. Login as operator (`operator@koperasi.com` / `password123`)
2. Navigate to a loan with existing payments: `/pinjaman/[id]`
3. Go to the "Riwayat Pembayaran" tab
4. Find a payment row and click "Batalkan"
5. Enter a reason (e.g., "Double input, kesalahan human error")
6. Type the payment number to confirm
7. Click "Batalkan Pembayaran"
8. Verify: payment row now shows "VOID" badge with reduced opacity
9. Verify: loan totals updated (principalPaid decreased, outstanding increased)
10. Verify: schedules updated (previously paid schedules back to pending/partial)
11. Verify: CashBankAccount balance decreased correctly

- [ ] **Step 4: Test edge cases**

1. Try voiding an already-voided payment → should show "sudah dibatalkan" error
2. Try voiding a payment on a voided loan → should be blocked
3. Try accessing the void API without auth → should return 401
4. Try accessing with non-operator role → should return 403

- [ ] **Step 5: Final commit with documentation**

Update `PINJAMAN-FEATURE.md` with the new feature entry, then:

```bash
git add PINJAMAN-FEATURE.md
git commit -m "docs: document Void Angsuran Individual feature (FEAT-VOID-PAYMENT)"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] Schema migration for void fields → Task 1
- [x] Atomic reversal of all payment effects → Task 3 (transaction)
- [x] CashBank balance reversal → Task 2 (calcPaymentCbReversalAmount) + Task 3
- [x] LoanSchedule rollback → Task 2 (buildScheduleRollbackOps) + Task 3
- [x] Loan counter updates → Task 2 (buildLoanRollbackData) + Task 3
- [x] Soft-delete (status field) not hard-delete → Task 1 (schema) + Task 3
- [x] Auth check (operator only) → Task 3
- [x] Audit trail → Task 3 (logAuditFromRequest)
- [x] UI confirmation dialog → Task 6
- [x] Voided payment visual indicator → Task 6 (badge + opacity)
- [x] Loans API excludes voided payments → Task 7
- [x] Operator can provide void reason → Task 3 (body.reason) + Task 6 (input)

### Placeholder Scan
- No TBD/TODO found
- All steps contain complete code
- All file paths are exact

### Type Consistency
- `AllocationReversal` interface defined in Task 2, used in Task 3
- `buildScheduleRollbackOps` params match Prisma model types
- `buildLoanRollbackData` params match payment fields
- `loansApi.voidPayment` signature matches Task 4 usage in Task 6
- `LOAN_PAYMENT_STATUS` keys match `status` field values in schema
