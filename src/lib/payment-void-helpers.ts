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
 * @returns Array of { scheduleId, data } for Prisma updates
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
        paidDate: Date | null;
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
