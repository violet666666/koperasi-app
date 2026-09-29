import { Prisma } from "@prisma/client";

/**
 * Where-part StoreSale non-voided — PENGGANTI pola lama
 * `NOT: { metadata: { path: ["isVoided"], equals: true } }` yang beracun:
 * Prisma meng-compile-nya jadi `NOT (metadata->>'isVoided' = 'true')`, sehingga
 * baris dengan metadata NULL atau tanpa key `isVoided` menghasilkan SQL NULL
 * (three-valued logic) → ter-exclude diam-diam. Terbukti di production:
 * filter lama mengembalikan 0 dari 16.300 sale (regression riwayat mobile
 * 2026-09-30, commit 38106749).
 *
 * Bentuk ini tervalidasi EKSAK vs semantik JS `!(metadata?.isVoided === true)`
 * di 3 scope production — bukti: scripts/diagnose-void-filter-candidates.ts.
 * Branch pertama menangkap key absen/NULL; branch kedua aman 2VL karena
 * operand sudah dijamin non-null oleh `not: Prisma.DbNull`.
 */
export const SALE_NOT_VOIDED = {
    OR: [
        { metadata: { path: ["isVoided"], equals: Prisma.DbNull } },
        {
            AND: [
                { metadata: { path: ["isVoided"], not: Prisma.DbNull } },
                { NOT: { metadata: { path: ["isVoided"], equals: true } } },
            ],
        },
    ],
};
