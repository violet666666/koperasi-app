import { z } from "zod";

// Schema for creating a haji/umrah savings account (POST /api/haji-umrah/savings)
export const createHajiUmrahAccountSchema = z.object({
    memberId: z.number().int().positive("Anggota wajib dipilih"),
    productId: z.number().int().positive("Produk wajib dipilih"),
    targetAmount: z.number().nonnegative().optional().nullable(),
    monthlyTarget: z.number().nonnegative().optional().nullable(),
    maturityDate: z.string().optional().nullable(),
});

export type CreateHajiUmrahAccountInput = z.infer<typeof createHajiUmrahAccountSchema>;

// Schema for creating a setoran/deposit (POST /api/haji-umrah/savings/[accountId]/transactions)
export const createHajiUmrahSetoranSchema = z.object({
    amount: z.number().positive("Jumlah setoran harus lebih dari 0"),
    paymentMethod: z.enum(["cash", "bank_transfer"]).default("cash"),
    cashBankAccountId: z.number().int().positive().optional().nullable(),
    referenceNo: z.string().max(50).optional().nullable(),
    notes: z.string().optional().nullable(),
    transactionDate: z.string().optional(),
});

export type CreateHajiUmrahSetoranInput = z.infer<typeof createHajiUmrahSetoranSchema>;

// Schema for creating a haji/umrah product
export const createHajiUmrahProductSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    type: z.enum(["tabungan_haji", "tabungan_umrah"]),
    minimumAmount: z.number().nonnegative().default(0),
    targetAmount: z.number().nonnegative().nullable().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).nullable().optional(),
    adminFeeValue: z.number().nonnegative().nullable().optional(),
    linkedBankName: z.string().max(100).nullable().optional(),
    isActive: z.boolean().default(true),
});

export type CreateHajiUmrahProductInput = z.infer<typeof createHajiUmrahProductSchema>;

// Schema for updating a haji/umrah product
export const updateHajiUmrahProductSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    minimumAmount: z.number().nonnegative().optional(),
    targetAmount: z.number().nonnegative().nullable().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).nullable().optional(),
    adminFeeValue: z.number().nonnegative().nullable().optional(),
    linkedBankName: z.string().max(100).nullable().optional(),
    isActive: z.boolean().optional(),
});

export type UpdateHajiUmrahProductInput = z.infer<typeof updateHajiUmrahProductSchema>;
