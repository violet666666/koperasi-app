/**
 * Helper functions for loan void reversal logic.
 * Extracted from the void route for testability.
 */

/**
 * Builds the Prisma where clause to find the disbursement CashBankTransaction
 * for a given loan. The disbursement route creates the transaction with
 * referenceType: "Loan", referenceId: loanId, category: "pencairan_pinjaman".
 *
 * NOTE: disbursementCashBankId on the Loan model is a FK to CashBankAccount,
 * NOT to CashBankTransaction. Do NOT use it to look up the transaction.
 */
export function buildDisbursementCbTxQuery(loanId: number) {
    return {
        referenceType: "Loan" as const,
        referenceId: loanId,
        category: "pencairan_pinjaman" as const,
    };
}

/**
 * Calculates the exact amount to reverse for a payment by summing
 * actual CashBankTransaction records linked to it.
 * This avoids over-decrement because payment.amount may include lateFee
 * which doesn't have a corresponding CashBankTransaction.
 */
export function calcPaymentReversalAmount(
    cbTransactions: Array<{ type: string; amount: number }>,
): number {
    return cbTransactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Builds a single Prisma balance update for reversing a CashBankTransaction.
 * IN transactions (money came in) → decrement the account balance.
 * OUT transactions (money went out) → increment the account balance.
 * Single update replaces the old 2-update pattern (increment:0 + decrement).
 */
export function buildKompenReversalUpdate(tx: { type: string; amount: number }) {
    const amount = Number(tx.amount);
    if (tx.type === "in") {
        return { decrement: amount };
    }
    return { increment: amount };
}

/**
 * Builds a detailed void response message listing all reversal actions taken.
 * Gives the operator clear feedback about what was reversed and what was skipped.
 */
export function buildVoidResponse(params: {
    paymentCount: number;
    disbursementReversed: boolean;
    kompenReversed: boolean;
    oldLoanId?: number;
}): { message: string; detail: string } {
    const parts: string[] = ["Pinjaman berhasil dibatalkan (VOID)."];

    if (params.paymentCount > 0) {
        parts.push(`${params.paymentCount} pembayaran di-reverse.`);
    }
    if (params.disbursementReversed) {
        parts.push("Transaksi pencairan di-reverse.");
    } else {
        parts.push("Tanpa reversal pencairan (pinjaman impor).");
    }
    if (params.kompenReversed) {
        parts.push(`Kompen di-reverse, pinjaman lama #${params.oldLoanId} diaktifkan kembali.`);
    }

    return {
        message: parts[0],
        detail: parts.join(" "),
    };
}
