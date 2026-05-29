// Application-wide constants

// =================================================================
// API Configuration
// =================================================================

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const API_ENDPOINTS = {
    // Auth
    AUTH: {
        LOGIN: "/auth/login",
        LOGOUT: "/auth/logout",
        ME: "/auth/me",
        FORGOT_PASSWORD: "/auth/forgot-password",
        RESET_PASSWORD: "/auth/reset-password",
    },

    // Users
    USERS: "/users",
    ROLES: "/roles",
    PERMISSIONS: "/permissions",

    // Master Data
    BRANCHES: "/master/branches",
    SAVINGS_PRODUCTS: "/master/savings-products",
    LOAN_PRODUCTS: "/master/loan-products",
    ACCOUNTS: "/master/accounts",
    JOURNAL_MAPPINGS: "/master/journal-mappings",
    SHU_PARAMETERS: "/master/shu-parameters",
    OPENING_BALANCES: "/master/opening-balances",
    COOPERATIVE_PROFILE: "/master/cooperative-profile",

    // Members
    MEMBERS: "/members",

    // Savings
    SAVINGS_TRANSACTIONS: "/savings/transactions",
    SAVINGS_BALANCES: "/savings/balances",
    SAVINGS_RECAP: "/savings/recap",

    // Loans
    LOANS: "/loans",
    LOAN_APPLICATIONS: "/loans/applications",

    // Cash & Bank
    CASH_BANK_ACCOUNTS: "/cash-bank/accounts",
    CASH_BANK_TRANSACTIONS: "/cash-bank/transactions",
    CASH_BANK_TRANSFERS: "/cash-bank/transfers",
    CASH_BANK_BALANCES: "/cash-bank/balances",

    // Non-SP
    NON_SP_CATEGORIES: "/non-sp/categories",
    NON_SP_INCOME: "/non-sp/income",
    NON_SP_EXPENSE: "/non-sp/expense",

    // Assets
    ASSETS: "/assets",
    ASSET_DEPRECIATION: "/assets/depreciation",

    // Journals
    JOURNALS: "/journals",
    GENERAL_LEDGER: "/journals/general-ledger",
    TRIAL_BALANCE: "/journals/trial-balance",

    // Reports
    REPORTS: {
        BALANCE_SHEET: "/reports/balance-sheet",
        INCOME_STATEMENT: "/reports/income-statement",
        SHU: "/reports/shu",
        SAVINGS_RECAP: "/reports/savings-recap",
        LOANS_RECAP: "/reports/loans-recap",
        ASSET_DEPRECIATION: "/reports/asset-depreciation",
        EXPORT: "/reports/export",
    },

    // Approvals
    APPROVALS: "/approvals",

    // Periods & SHU
    PERIODS: "/periods",
    SHU: "/shu",
} as const;

// =================================================================
// Application Constants
// =================================================================

export const APP_NAME = "PRIMKOPPOL RESOR LUMAJANG";
export const APP_SHORT_NAME = "PRIMKOPPOL";
export const APP_DESCRIPTION = "Sistem Manajemen PRIMKOPPOL Resor Lumajang";

// =================================================================
// Pagination
// =================================================================

export const DEFAULT_PAGE_SIZE = 15;
export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

// =================================================================
// Status Labels
// =================================================================

export const MEMBER_STATUS = {
    active: { label: "Aktif", color: "success" },
    inactive: { label: "Tidak Aktif", color: "secondary" },
    pensiun: { label: "Pensiun", color: "warning" },
    resigned: { label: "Keluar", color: "destructive" },
} as const;

export const LOAN_STATUS = {
    draft: { label: "Draft", color: "secondary" },
    submitted: { label: "Diajukan", color: "warning" },
    approved: { label: "Disetujui", color: "success" },
    rejected: { label: "Ditolak", color: "destructive" },
    disbursed: { label: "Dicairkan", color: "primary" },
    cancelled: { label: "Dibatalkan", color: "secondary" },
    active: { label: "Aktif", color: "success" },
    paid_off: { label: "Lunas", color: "success" },
    written_off: { label: "Dihapusbukukan", color: "destructive" },
    voided: { label: "Dibatalkan (VOID)", color: "destructive" },
} as const;

export const INSTALLMENT_STATUS = {
    pending: { label: "Belum Bayar", color: "secondary" },
    partial: { label: "Sebagian", color: "warning" },
    paid: { label: "Lunas", color: "success" },
    overdue: { label: "Jatuh Tempo", color: "destructive" },
} as const;

export const LOAN_PAYMENT_STATUS = {
    completed: { label: "Selesai", color: "success" as const },
    voided: { label: "Dibatalkan", color: "destructive" as const },
} as const;

export const APPROVAL_STATUS = {
    pending: { label: "Menunggu", color: "warning" },
    approved: { label: "Disetujui", color: "success" },
    rejected: { label: "Ditolak", color: "destructive" },
    disbursed: { label: "Dicairkan", color: "primary" },
} as const;

export const PERIOD_STATUS = {
    open: { label: "Buka", color: "success" },
    closed: { label: "Tutup", color: "secondary" },
} as const;

// =================================================================
// Transaction Types
// =================================================================

export const SAVINGS_TRANSACTION_TYPES = {
    deposit: { label: "Setoran", color: "success" },
    withdrawal: { label: "Penarikan", color: "warning" },
    correction: { label: "Koreksi", color: "secondary" },
    interest: { label: "Bunga", color: "info" },
} as const;

export const CASH_BANK_TRANSACTION_TYPES = {
    in: { label: "Masuk", color: "success" },
    out: { label: "Keluar", color: "warning" },
} as const;

export const CASH_BANK_CATEGORIES = {
    simpanan_pokok: { label: "Simpanan Pokok", type: "in" },
    simpanan_wajib: { label: "Simpanan Wajib", type: "in" },
    simpanan_sukarela: { label: "Simpanan Sukarela", type: "in" },
    angsuran_pokok: { label: "Angsuran Pokok", type: "in" },
    jasa_pinjaman: { label: "Jasa/Bunga Pinjaman", type: "in" },
    pendapatan_unit: { label: "Pendapatan Unit Usaha", type: "in" },
    pencairan_pinjaman: { label: "Pencairan Pinjaman", type: "out" },
    biaya_operasional: { label: "Biaya Operasional", type: "out" },
    beban_unit: { label: "Beban Operasional Unit", type: "out" },
    hpp_toko: { label: "HPP / Pembelian Barang", type: "out" },
    hutang_mitra: { label: "Kewajiban Bagi Hasil Mitra", type: "out" },
    transfer: { label: "Transfer Antar Kas/Bank", type: "both" },
    lainnya: { label: "Lain-lain", type: "both" },
} as const;

// =================================================================
// Product Types
// =================================================================

export const SAVINGS_PRODUCT_TYPES = {
    pokok: { label: "Simpanan Pokok" },
    wajib: { label: "Simpanan Wajib" },
    sukarela: { label: "Simpanan Sukarela" },
    lainnya: { label: "Lainnya" },
} as const;

export const INTEREST_METHODS = {
    flat: { label: "Flat", description: "Bunga dihitung dari pokok awal" },
    effective: { label: "Efektif", description: "Bunga dihitung dari sisa pokok" },
    annuity: { label: "Anuitas", description: "Angsuran tetap tiap bulan" },
    declining: { label: "Menurun", description: "Bunga menurun, pokok tetap" },
} as const;

// =================================================================
// Date & Time
// =================================================================

export const DATE_FORMAT = "dd MMM yyyy";
export const DATE_TIME_FORMAT = "dd MMM yyyy, HH:mm";
export const DATE_INPUT_FORMAT = "yyyy-MM-dd";

// =================================================================
// Currency
// =================================================================

export const CURRENCY = {
    code: "IDR",
    symbol: "Rp",
    locale: "id-ID",
} as const;

// Format currency for display
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat(CURRENCY.locale, {
        style: "currency",
        currency: CURRENCY.code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

// Format number with thousand separator
export function formatNumber(value: number): string {
    return new Intl.NumberFormat(CURRENCY.locale).format(value);
}

// =================================================================
// Permissions
// =================================================================

export const PERMISSIONS = {
    // Dashboard
    VIEW_DASHBOARD: "view_dashboard",

    // Members
    MANAGE_ANGGOTA: "manage_anggota",

    // Savings
    MANAGE_SIMPANAN: "manage_simpanan",

    // Loans
    MANAGE_PINJAMAN: "manage_pinjaman",

    // Cash & Bank
    MANAGE_KAS_BANK: "manage_kas_bank",

    // Assets
    MANAGE_ASET: "manage_aset",

    // Journals
    VIEW_JURNAL: "view_jurnal",
    MANAGE_JURNAL: "manage_jurnal",

    // Reports
    VIEW_LAPORAN: "view_laporan",

    // Period & SHU
    TUTUP_BUKU: "tutup_buku",
    ALOKASI_SHU: "alokasi_shu",

    // Approvals
    APPROVE_TRANSACTIONS: "approve_transactions",

    // Master Data
    MASTER_DATA: "master_data",

    // User Management
    USER_MANAGEMENT: "user_management",

    // Profile
    EDIT_PROFIL: "edit_profil",

    // Audit
    VIEW_AUDIT_LOG: "view_audit_log",

    // Branch Access
    VIEW_ALL_BRANCHES: "view_all_branches",
} as const;
