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
        ...(referenceType ? { referenceType } : {}),
        ...(referenceId !== undefined ? { referenceId } : {}),
        ...(referenceNo ? { referenceNo } : {}),
        ...(unitType ? { unitType } : {}),
        ...(memberId ? { memberId } : {}),
    };
}

/**
 * Resolves a CashBankAccount from the provided ID or auto-detects one.
 * Returns null if not found via fallback (caller decides whether to throw).
 * Throws immediately if an explicit cashBankAccountId is provided but not found.
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
