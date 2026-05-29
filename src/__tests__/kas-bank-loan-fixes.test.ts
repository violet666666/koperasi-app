import { describe, it, expect } from "vitest";
import {
    buildCashBankTransactionData,
    resolveCashBankAccount,
} from "@/lib/kas-bank-loan-helpers";

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

        expect(data).toHaveProperty("accountId", 12);
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
            transactionNo: "KM-TEST-0001",
        });

        expect(data).toEqual({
            transactionNo: "KM-TEST-0001",
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
