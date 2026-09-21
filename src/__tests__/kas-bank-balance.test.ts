import { describe, it, expect, vi } from "vitest";
import { shiftAccountBalance, round2 } from "@/lib/kas-bank-balance";
import type { Prisma } from "@prisma/client";

/** Fake Prisma.TransactionClient — cukup $queryRaw untuk unit test helper. */
function makeTx(rows: Array<{ current_balance: unknown }>, capture?: { sql: unknown; params: unknown[] }) {
    return {
        $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...params: unknown[]) => {
            if (capture) {
                capture.sql = _strings.join("?");
                capture.params = params;
            }
            return rows;
        }),
    } as unknown as Prisma.TransactionClient;
}

describe("shiftAccountBalance", () => {
    it("memanggil UPDATE ... RETURNING dengan delta dan mengembalikan { before, after }", async () => {
        const cap: { sql?: unknown; params?: unknown[] } = {};
        const tx = makeTx([{ current_balance: "1500000.00" }], cap as { sql: unknown; params: unknown[] });

        const result = await shiftAccountBalance(tx, 7, 500000);

        expect(result).toEqual({ before: 1000000, after: 1500000 });
        expect(String(cap.sql)).toContain("UPDATE cash_bank_accounts");
        expect(String(cap.sql)).toContain("RETURNING");
        expect(cap.params).toEqual(expect.arrayContaining([7])); // accountId ikut ke parameter SQL
    });

    it("delta negatif (pengeluaran) mengurangi saldo", async () => {
        const tx = makeTx([{ current_balance: 250000 }]);
        const result = await shiftAccountBalance(tx, 3, -750000);
        expect(result).toEqual({ before: 1000000, after: 250000 });
    });

    it("koersi Decimal-like (punya toNumber()) tetap jadi number 2-desimal", async () => {
        const fakeDecimal = { toNumber: () => 1234.567 };
        const tx = makeTx([{ current_balance: fakeDecimal }]);
        const result = await shiftAccountBalance(tx, 1, 100);
        expect(result).toEqual({ before: 1134.57, after: 1234.57 });
    });

    it("throw jika akun tidak ditemukan (RETURNING kosong)", async () => {
        const tx = makeTx([]);
        await expect(shiftAccountBalance(tx, 999, 1000)).rejects.toThrow(/tidak ditemukan/i);
    });

    it("throw jika delta non-finite (NaN/Infinity)", async () => {
        const tx = makeTx([{ current_balance: 0 }]);
        await expect(shiftAccountBalance(tx, 1, NaN)).rejects.toThrow(/tidak valid/i);
        await expect(shiftAccountBalance(tx, 1, Infinity)).rejects.toThrow(/tidak valid/i);
    });
});

describe("round2", () => {
    it("aman dari artefak float (0.1 + 0.2)", () => {
        expect(round2(0.1 + 0.2)).toBe(0.3);
        expect(round2(1.005)).toBe(1.01);
    });
});
