import { z } from "zod";

// Branch validation schemas
export const createBranchSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    address: z.string().optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().optional(),
    isHeadOffice: z.boolean().default(false),
    isActive: z.boolean().default(true),
});

export const updateBranchSchema = createBranchSchema.partial();

// User validation schemas
export const createUserSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    password: z.string().min(6),
    roleId: z.number().int().positive(),
    branchId: z.number().int().positive().nullable().optional(),
    unitType: z.string().nullable().optional(), // toko, barbershop, fitness, cuci_mobil, dll
    isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.omit({ password: true }).partial().extend({
    password: z.string().min(6).optional(),
});

// Savings Product validation schemas
export const createSavingsProductSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    type: z.enum(["pokok", "wajib", "sukarela", "lainnya"]),
    isMandatory: z.boolean().default(false),
    depositPeriod: z.enum(["once", "monthly", "optional"]).optional(),
    minimumAmount: z.number().nonnegative().default(0),
    canWithdraw: z.boolean().default(true),
    glAccountId: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().default(true),
});

export const updateSavingsProductSchema = createSavingsProductSchema.partial();

// Loan Product validation schemas
export const createLoanProductSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    interestMethod: z.enum(["flat", "effective", "annuity", "declining"]),
    interestRate: z.number().min(0).max(100),
    interestCalculation: z.enum(["monthly", "daily"]).optional(),
    minTenorMonths: z.number().int().positive().optional(),
    maxTenorMonths: z.number().int().positive().optional(),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
    adminFeeType: z.enum(["percent", "fixed"]).optional(),
    adminFeeValue: z.number().nonnegative().optional(),
    lateFeeType: z.enum(["percent_per_day", "fixed_per_day"]).optional(),
    lateFeeValue: z.number().nonnegative().optional(),
    gracePeriodDays: z.number().int().nonnegative().default(0),
    requiresCollateral: z.boolean().default(false),
    maxLoanToSavingsRatio: z.number().positive().optional(),
    effectiveDate: z.string().transform((s) => new Date(s)),
    isActive: z.boolean().default(true),
});

export const updateLoanProductSchema = createLoanProductSchema.partial();

// Account (COA) validation schemas
export const createAccountSchema = z.object({
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(255),
    type: z.enum(["asset", "liability", "equity", "income", "expense"]),
    category: z.string().max(50).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    level: z.number().int().nonnegative(),
    isDetail: z.boolean().default(true),
    normalBalance: z.enum(["debit", "credit"]),
    isActive: z.boolean().default(true),
});

export const updateAccountSchema = createAccountSchema.partial();

// Member validation schemas
export const createMemberSchema = z.object({
    memberNo: z.string().min(1).max(20).optional(),
    nrp: z.string().min(1).max(30).optional(),
    branchId: z.number().int().positive(),
    name: z.string().min(1).max(255),
    nik: z.string().length(16).optional(),
    gender: z.enum(["male", "female"]).optional(),
    birthDate: z.string().transform((s) => new Date(s)).optional(),
    birthPlace: z.string().max(100).optional(),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    religion: z.string().max(20).optional(),
    education: z.string().max(20).optional(),
    occupation: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    rt: z.string().max(5).optional(),
    rw: z.string().max(5).optional(),
    village: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    city: z.string().max(100).optional(),
    province: z.string().max(100).optional(),
    postalCode: z.string().max(10).optional(),
    joinDate: z.string().transform((s) => new Date(s)),
    category: z.string().optional().nullable(),
    salary: z.coerce.number().nonnegative().optional().nullable(),
    tunlesKinerja: z.coerce.number().nonnegative().optional().nullable(),
    plafonPiutang: z.coerce.number().nonnegative().optional(),
    tabunganWajib: z.coerce.number().nonnegative().optional().nullable(),
    status: z.enum(["active", "inactive", "resigned"]).default("active"),
});

export const updateMemberSchema = createMemberSchema.partial().extend({
    overrideSavings: z.record(z.string(), z.coerce.number().nonnegative()).optional(),
    roleId: z.coerce.number().int().positive().optional().nullable(),
});

// Savings Transaction validation schemas
export const createSavingsTransactionSchema = z.object({
    memberId: z.number().int().positive(),
    productId: z.number().int().positive(),
    type: z.enum(["deposit", "withdrawal", "correction", "interest"]),
    amount: z.number().positive(),
    paymentMethod: z.enum(["cash", "bank_transfer"]).optional(),
    cashBankAccountId: z.number().int().positive().nullable().optional(),
    referenceNo: z.string().max(50).optional(),
    notes: z.string().optional(),
    transactionDate: z.string().transform((s) => new Date(s)),
});

// Loan Application validation schemas
export const createLoanApplicationSchema = z.object({
    memberId: z.number().int().positive(),
    productId: z.number().int().positive(),
    amount: z.number().positive(),
    tenorMonths: z.number().int().positive(),
    purpose: z.string().optional(),
    collateralDescription: z.string().optional(),
    notes: z.string().optional(),
    deductionSource: z.enum(["gaji", "tunkin"]).default("gaji"),
    backdatedDate: z.string().optional(), // For Operators inputting historical loans
});

// Loan Payment validation schemas
export const createLoanPaymentSchema = z.object({
    loanId: z.number().int().positive(),
    amount: z.number().positive(),
    paymentMethod: z.enum(["cash", "bank_transfer"]).optional(),
    cashBankAccountId: z.number().int().positive().nullable().optional(),
    referenceNo: z.string().max(50).optional(),
    notes: z.string().optional(),
    paymentDate: z.string().transform((s) => new Date(s)),
});

// Cash Bank Transaction validation schemas
export const createCashBankTransactionSchema = z.object({
    accountId: z.number().int().positive(),
    type: z.enum(["in", "out"]),
    category: z.enum([
        "simpanan_pokok",
        "simpanan_wajib",
        "simpanan_sukarela",
        "angsuran_pokok",
        "jasa_pinjaman",
        "pencairan_pinjaman",
        "biaya_operasional",
        "transfer",
        "lainnya"
    ]).optional(),
    amount: z.number().positive(),
    description: z.string().optional(),
    transactionDate: z.string().optional().default(new Date().toISOString()).transform((s) => new Date(s)),
});

// Transfer validation schemas
export const createTransferSchema = z.object({
    fromAccountId: z.number().int().positive(),
    toAccountId: z.number().int().positive(),
    amount: z.number().positive(),
    description: z.string().optional(),
    transactionDate: z.string().transform((s) => new Date(s)),
});

// Query parameter schemas
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    perPage: z.coerce.number().int().positive().max(10000).default(15),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// Export types
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateSavingsProductInput = z.infer<typeof createSavingsProductSchema>;
export type CreateLoanProductInput = z.infer<typeof createLoanProductSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateSavingsTransactionInput = z.infer<typeof createSavingsTransactionSchema>;
export type CreateLoanApplicationInput = z.infer<typeof createLoanApplicationSchema>;
export type CreateLoanPaymentInput = z.infer<typeof createLoanPaymentSchema>;
export type CreateCashBankTransactionInput = z.infer<typeof createCashBankTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

// Unit Transaction validation schemas
export const createUnitTransactionSchema = z.object({
    nrp: z.string().min(1).max(30),
    unitType: z.enum([
        "toko", "simpan_pinjam", "fotocopy", "cuci_mobil", "fitness",
        "barbershop", "play_station", "coffe_latar", "resto", "properti",
    ]),
    description: z.string().min(1).max(500),
    amount: z.number().positive(),
    transactionDate: z.string().transform((s) => new Date(s)),
    isPaid: z.boolean().default(false),
    paymentMethod: z.enum(["cash", "qris", "salary_cut"]).default("cash"),
    notes: z.string().optional(),
});

export type CreateUnitTransactionInput = z.infer<typeof createUnitTransactionSchema>;
