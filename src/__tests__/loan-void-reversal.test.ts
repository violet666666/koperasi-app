import { describe, it, expect } from "vitest";
import {
    buildDisbursementCbTxQuery,
    calcPaymentReversalAmount,
    buildKompenReversalUpdate,
    buildVoidResponse,
} from "@/lib/loan-void-helpers";

// ─── VOID-001: Disbursement CashBank Lookup ───────────────────
//
// BUG: disbursementCashBankId stores a CashBankAccount ID,
//      but the void route looked for CashBankTransaction with that ID.
// FIX: Look up the disbursement transaction by referenceType + referenceId.

describe("VOID-001: Disbursement CashBank reversal lookup", () => {
    it("looks up by referenceType 'Loan' and loan ID, not by disbursementCashBankId", () => {
        const loanId = 3402;
        const query = buildDisbursementCbTxQuery(loanId);

        expect(query.referenceType).toBe("Loan");
        expect(query.referenceId).toBe(loanId);
        expect(query.category).toBe("pencairan_pinjaman");
        expect((query as any).id).toBeUndefined();
    });

    it("works for any loan ID", () => {
        const query = buildDisbursementCbTxQuery(9999);
        expect(query.referenceId).toBe(9999);
        expect(query.referenceType).toBe("Loan");
    });
});

// ─── VOID-002: Payment Balance Reversal ────────────────────────
//
// BUG: void decrements CashBankAccount by payment.amount (total including lateFee),
//      but CashBankTransactions only record principal + interest + penalty.
// FIX: Sum actual CashBankTransaction amounts linked to the payment.

describe("VOID-002: Payment balance reversal matches actual CB transactions", () => {
    it("sums only actual CashBankTransaction amounts (principal + interest)", () => {
        const cbTransactions = [
            { type: "in", amount: 500000 },
            { type: "in", amount: 50000 },
        ];
        const reversalAmount = calcPaymentReversalAmount(cbTransactions);
        expect(reversalAmount).toBe(550000);
    });

    it("includes penalty for early settlement", () => {
        const cbTransactions = [
            { type: "in", amount: 500000 },
            { type: "in", amount: 50000 },
            { type: "in", amount: 100000 },
        ];
        const reversalAmount = calcPaymentReversalAmount(cbTransactions);
        expect(reversalAmount).toBe(650000);
    });

    it("does NOT include lateFee which has no CashBankTransaction", () => {
        const cbTransactions = [
            { type: "in", amount: 500000 },
            { type: "in", amount: 50000 },
        ];
        const reversalAmount = calcPaymentReversalAmount(cbTransactions);
        expect(reversalAmount).toBe(550000);
        expect(reversalAmount).not.toBe(560000);
    });

    it("handles empty transactions (no reversal needed)", () => {
        const reversalAmount = calcPaymentReversalAmount([]);
        expect(reversalAmount).toBe(0);
    });
});

// ─── VOID-004: Kompen reversal single-update ─────────────────────
//
// BUG: Kompen reversal uses 2 separate CashBankAccount updates
//      (increment:0 then decrement) when reversing IN transactions.
// FIX: Single update with correct increment or decrement.

describe("VOID-004: Kompen reversal uses single DB update per transaction", () => {
    it("reverses IN transaction with single decrement", () => {
        const result = buildKompenReversalUpdate({ type: "in", amount: 500000 });
        expect(result).toEqual({ decrement: 500000 });
        // Must NOT have increment key
        expect((result as any).increment).toBeUndefined();
    });

    it("reverses OUT transaction with single increment", () => {
        const result = buildKompenReversalUpdate({ type: "out", amount: 300000 });
        expect(result).toEqual({ increment: 300000 });
        expect((result as any).decrement).toBeUndefined();
    });

    it("handles decimal amounts", () => {
        const result = buildKompenReversalUpdate({ type: "in", amount: 500000.50 });
        expect(result).toEqual({ decrement: 500000.50 });
    });
});

// ─── VOID-005: Detailed void response feedback ─────────────────────
//
// BUG: Void response only shows payment count, no detail about what
//      was reversed (disbursement, kompen, journals) or skipped.
// FIX: Build detailed response listing all reversal actions.

describe("VOID-005: Void response gives detailed feedback", () => {
    it("reports simple void without payments or kompen", () => {
        const result = buildVoidResponse({
            paymentCount: 0,
            disbursementReversed: true,
            kompenReversed: false,
        });
        expect(result.detail).toContain("pencairan");
        expect(result.detail).not.toContain("pembayaran");
        expect(result.detail).not.toContain("kompen");
    });

    it("reports void with payments", () => {
        const result = buildVoidResponse({
            paymentCount: 3,
            disbursementReversed: true,
            kompenReversed: false,
        });
        expect(result.detail).toContain("3 pembayaran");
        expect(result.detail).toContain("pencairan");
    });

    it("reports kompen reversal with old loan info", () => {
        const result = buildVoidResponse({
            paymentCount: 1,
            disbursementReversed: true,
            kompenReversed: true,
            oldLoanId: 1234,
        });
        expect(result.detail.toLowerCase()).toContain("kompen");
        expect(result.detail).toContain("1234");
    });

    it("reports when disbursement was not reversed (imported loan)", () => {
        const result = buildVoidResponse({
            paymentCount: 0,
            disbursementReversed: false,
            kompenReversed: false,
        });
        expect(result.detail.toLowerCase()).toContain("tanpa reversal pencairan");
    });
});
