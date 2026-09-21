import { Prisma } from "@prisma/client";

/** Prisma transaction client — hasil `prisma.$transaction(async (tx) => ...)`. */
export type CashBankTxClient = Prisma.TransactionClient;

/** Hasil shiftAccountBalance — saldo sebelum/sesudah delta, dibulatkan 2 desimal. */
export interface ShiftAccountBalanceResult {
    before: number;
    after: number;
}

/** Pembulatan 2 desimal yang aman dari artefak float JavaScript (0.1 + 0.2, dsb). */
export function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Koersi hasil $queryRaw kolom numeric ke number 2-desimal.
 * Driver bisa mengembalikan Prisma.Decimal, number, atau string tergantung backend.
 */
function toRoundedNumber(value: unknown): number {
    if (typeof value === "number") return round2(value);
    if (typeof value === "string") return round2(parseFloat(value));
    if (value !== null && typeof (value as { toNumber?: unknown }).toNumber === "function") {
        return round2((value as { toNumber: () => number }).toNumber());
    }
    throw new Error(`Nilai saldo kas/bank tidak valid: ${String(value)}`);
}

/**
 * Geser saldo CashBankAccount secara ATOMIK via SQL:
 *   UPDATE cash_bank_accounts
 *   SET current_balance = round(current_balance + delta, 2), updated_at = now()
 *   WHERE id = ... RETURNING current_balance
 *
 * WAJIB dipanggil di dalam `prisma.$transaction(async (tx) => ...)` yang SAMA
 * dengan `tx.cashBankTransaction.create(...)`-nya, lalu pakai `{ before, after }`
 * sebagai balanceBefore/balanceAfter row. Jangan per lagi saldo untuk menghitung
 * balance manual — pola read-modify-write non-atomik pernah mengorupsi saldo
 * (lost update antara import backdated dan POS live, insiden KAS-JATIM-CMR 2026).
 *
 * `before` dihitung dari `after - delta` (sudah dibulatkan 2 desimal).
 */
export async function shiftAccountBalance(
    tx: CashBankTxClient,
    accountId: number,
    delta: number,
): Promise<ShiftAccountBalanceResult> {
    if (!Number.isFinite(delta)) {
        throw new Error(`Delta saldo tidak valid (non-finite): ${delta}`);
    }

    const rows = await tx.$queryRaw<
        Array<{ current_balance: Prisma.Decimal | number | string }>
    >`
        UPDATE cash_bank_accounts
        SET current_balance = round(current_balance + ${delta}::numeric, 2),
            updated_at = now()
        WHERE id = ${accountId}
        RETURNING round(current_balance, 2) AS current_balance
    `;

    const row = rows[0];
    if (!row) {
        throw new Error(`Akun Kas/Bank ID ${accountId} tidak ditemukan`);
    }

    const after = toRoundedNumber(row.current_balance);
    return { before: round2(after - delta), after };
}
