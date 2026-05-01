// API Services for Frontend-Backend integration
import { api } from "./client";

// ============================================================
// Members API
// ============================================================

export interface Member {
    id: number;
    memberNo: string;
    nrp?: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    status: string;
    joinDate: string;
    branchId?: number;
    branch?: { id: number; name: string };
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
}

export const membersApi = {
    list: (params?: { page?: number; perPage?: number; search?: string; branchId?: number }) =>
        api.get<PaginatedResponse<Member>>("/members", { params }),

    get: (id: number) => api.get<{ data: Member }>(`/members/${id}`),

    create: (data: Partial<Member>) => api.post<{ data: Member }>("/members", data),

    update: (id: number, data: Partial<Member>) =>
        api.put<{ data: Member }>(`/members/${id}`, data),

    delete: (id: number) => api.delete<{ message: string }>(`/members/${id}`),

    importData: (formData: FormData) =>
        api.post<{ data: any }>("/members/import", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),

    exportCsv: () => `/api/members/export?format=csv`,
};

// ============================================================
// Savings API
// ============================================================

export interface SavingsTransaction {
    id: number;
    transactionNo: string;
    accountId: number;
    memberId: number;
    type: "deposit" | "withdrawal";
    amount: number;
    description?: string;
    transactionDate: string;
    member?: { id: number; memberNo: string; name: string };
}

export const savingsApi = {
    transactions: (params?: { page?: number; perPage?: number; memberId?: number; type?: string }) =>
        api.get<PaginatedResponse<SavingsTransaction>>("/savings/transactions", { params }),

    deposit: (data: { accountId: number; memberId: number; amount: number; description?: string }) =>
        api.post<{ data: SavingsTransaction }>("/savings/transactions", { ...data, type: "deposit" }),

    withdraw: (data: { accountId: number; memberId: number; amount: number; description?: string }) =>
        api.post<{ data: SavingsTransaction }>("/savings/transactions", { ...data, type: "withdrawal" }),
};

// ============================================================
// Loans API
// ============================================================

export interface LoanApplication {
    id: number;
    applicationNo: string;
    memberId: number;
    productId: number;
    amount: number;
    tenor: number;
    status: string;
    submittedAt?: string;
    member?: { id: number; memberNo: string; name: string };
    product?: { id: number; code: string; name: string };
}

export interface Loan {
    id: number;
    loanNo: string;
    memberId: number;
    principalAmount: number;
    principalOutstanding: number;
    status: string;
    member?: { id: number; memberNo: string; name: string };
}

export const loansApi = {
    applications: (params?: { page?: number; status?: string }) =>
        api.get<PaginatedResponse<LoanApplication>>("/loans/applications", { params }),

    createApplication: (data: Partial<LoanApplication>) =>
        api.post<{ data: LoanApplication }>("/loans/applications", data),

    submit: (id: number) =>
        api.post<{ data: LoanApplication }>(`/loans/applications/${id}/submit`),

    approve: (id: number, notes?: string) =>
        api.post<{ data: LoanApplication }>(`/loans/applications/${id}/approve`, { notes }),

    reject: (id: number, reason: string) =>
        api.post<{ data: LoanApplication }>(`/loans/applications/${id}/reject`, { reason }),

    list: (params?: { page?: number; perPage?: number; status?: string }) =>
        api.get<PaginatedResponse<Loan>>("/loans", { params }),

    get: (id: number) => api.get<{ data: Loan }>(`/loans/${id}`),

    update: (id: number, data: Record<string, unknown>) =>
        api.put<{ data: Loan; message: string; changes: string[] }>(`/loans/${id}`, data),

    payments: (loanId: number) =>
        api.get<{ data: unknown[] }>(`/loans/${loanId}/payments`),

    createPayment: (loanId: number, data: { amount: number; paymentMethod: string }) =>
        api.post(`/loans/${loanId}/payments`, data),

    voidPinjaman: (loanId: number) =>
        api.post<{ message: string; status: string }>(`/loans/${loanId}/void`),
};

// ============================================================
// Master Data API
// ============================================================

export interface Branch {
    id: number;
    code: string;
    name: string;
    isHeadOffice: boolean;
    isActive: boolean;
}

export interface SavingsProduct {
    id: number;
    code: string;
    name: string;
    type: string;
    interestRate: number;
    isActive: boolean;
}

export interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interestRate: number;
    maxTenor: number;
    isCurrent: boolean;
}

export const masterApi = {
    branches: {
        list: () => api.get<PaginatedResponse<Branch>>("/master/branches"),
        get: (id: number) => api.get<{ data: Branch }>(`/master/branches/${id}`),
        create: (data: Partial<Branch>) => api.post<{ data: Branch }>("/master/branches", data),
        update: (id: number, data: Partial<Branch>) => api.put<{ data: Branch }>(`/master/branches/${id}`, data),
        delete: (id: number) => api.delete(`/master/branches/${id}`),
    },

    savingsProducts: {
        list: () => api.get<PaginatedResponse<SavingsProduct>>("/master/savings-products"),
        get: (id: number) => api.get<{ data: SavingsProduct }>(`/master/savings-products/${id}`),
        create: (data: Partial<SavingsProduct>) => api.post<{ data: SavingsProduct }>("/master/savings-products", data),
        update: (id: number, data: Partial<SavingsProduct>) => api.put<{ data: SavingsProduct }>(`/master/savings-products/${id}`, data),
    },

    loanProducts: {
        list: () => api.get<PaginatedResponse<LoanProduct>>("/master/loan-products"),
        get: (id: number) => api.get<{ data: LoanProduct }>(`/master/loan-products/${id}`),
        create: (data: Partial<LoanProduct>) => api.post<{ data: LoanProduct }>("/master/loan-products", data),
        update: (id: number, data: Partial<LoanProduct>) => api.put<{ data: LoanProduct }>(`/master/loan-products/${id}`, data),
    },

    accounts: {
        list: (format?: "flat" | "tree") => api.get<{ data: unknown[] }>("/master/accounts", { params: { format } }),
        get: (id: number) => api.get<{ data: unknown }>(`/master/accounts/${id}`),
        create: (data: Record<string, unknown>) => api.post<{ data: unknown }>("/master/accounts", data),
        update: (id: number, data: Record<string, unknown>) => api.put<{ data: unknown }>(`/master/accounts/${id}`, data),
    },
};

// ============================================================
// Cash & Bank API
// ============================================================

export interface CashBankAccount {
    id: number;
    code: string;
    name: string;
    type: "cash" | "bank";
    currentBalance: number;
    branchId: number;
}

export const cashBankApi = {
    accounts: () => api.get<{ data: CashBankAccount[] }>("/cash-bank/accounts"),

    transactions: (params?: { accountId?: number; type?: string; perPage?: number; page?: number }) =>
        api.get<PaginatedResponse<unknown>>("/cash-bank/transactions", { params }),

    createTransaction: (data: { accountId: number; type: string; category?: string; amount: number; description?: string; transactionDate?: string }) =>
        api.post("/cash-bank/transactions", data),

    updateTransaction: (id: number, data: { type: string; category?: string; amount: number; description?: string }) =>
        api.put(`/cash-bank/transactions/${id}`, data),

    deleteTransaction: (id: number) =>
        api.delete(`/cash-bank/transactions/${id}`),

    transfer: (data: { fromAccountId: number; toAccountId: number; amount: number }) =>
        api.post("/cash-bank/transfers", data),
};

// ============================================================
// Reports API
// ============================================================

export const reportsApi = {
    neraca: (params?: { branchId?: number; asOfDate?: string }) =>
        api.get<{ data: unknown }>("/reports/neraca", { params }),

    labaRugi: (params?: { branchId?: number; periodFrom?: string; periodTo?: string }) =>
        api.get<{ data: unknown }>("/reports/laba-rugi", { params }),

    shu: (params?: { branchId?: number; year?: number; month?: number; page?: number; perPage?: number; export?: string }) =>
        api.get<{ data: unknown }>("/reports/shu", { params }),

    membersRecap: (params?: { branchId?: number; page?: number; perPage?: number; export?: string }) =>
        api.get<{ data: unknown }>("/reports/members-recap", { params }),

    savingsRecap: (params?: { branchId?: number; year?: number }) =>
        api.get<{ data: unknown }>("/reports/savings-recap", { params }),

    loansRecap: (params?: { branchId?: number; year?: number }) =>
        api.get<{ data: unknown }>("/reports/loans-recap", { params }),

    arusKas: (params?: { month?: number; year?: number }) =>
        api.get<{ data: unknown }>("/reports/arus-kas", { params }),
};

// ============================================================
// Approvals API
// ============================================================

export const approvalsApi = {
    list: (status?: "pending" | "history", params?: Record<string, string | number>) =>
        api.get<{ data: unknown[]; pagination?: { page: number; perPage: number; total: number; totalPages: number } }>("/approvals", {
            params: { status, ...params },
        }),
};

// ============================================================
// Users API
// ============================================================

export interface User {
    id: number;
    name: string;
    email: string;
    roleId: number;
    role?: { id: number; name: string; displayName: string };
    branchId?: number;
    branch?: { id: number; name: string };
    isActive: boolean;
    createdAt: string;
}

export const usersApi = {
    list: (params?: { page?: number; perPage?: number; branchId?: number }) =>
        api.get<PaginatedResponse<User>>("/users", { params: { perPage: 999, ...params } }),

    get: (id: number) => api.get<{ data: User }>(`/users/${id}`),

    create: (data: Partial<User> & { password?: string }) =>
        api.post<{ data: User }>("/users", data),

    update: (id: number, data: Partial<User>) =>
        api.put<{ data: User }>(`/users/${id}`, data),

    delete: (id: number) => api.delete(`/users/${id}`),

    roles: () => api.get<{ data: unknown[] }>("/roles"),
};

// ============================================================
// Unit Transactions API
// ============================================================

export interface UnitTransaction {
    id: number;
    transactionNo: string;
    memberId: number;
    unitType: string;
    description: string;
    amount: number;
    transactionDate: string;
    paymentMethod?: string;
    isPaid: boolean;
    paidDate?: string;
    status: string; // "completed", "pending_void", "voided"
    voidRef?: string;
    voidReason?: string;
    notes?: string;
    member?: { id: number; memberNo: string; nrp: string; name: string };
    createdBy?: { id: number; name: string };
}

export const unitTransactionsApi = {
    list: (params?: {
        page?: number;
        perPage?: number;
        unitType?: string;
        isPaid?: string;
        memberId?: number;
        dateFrom?: string;
        dateTo?: string;
        paymentMethod?: string;
        export?: boolean;
    }) => api.get<PaginatedResponse<UnitTransaction>>("/unit-transactions", { params }),

    create: (data: {
        nrp: string;
        unitType: string;
        description: string;
        amount: number;
        transactionDate: string;
        isPaid?: boolean;
        paymentMethod?: string;
        notes?: string;
    }) => api.post<{ data: UnitTransaction }>("/unit-transactions", data),

    voidApprove: (data: { approvalRequestNo: string; action: "approved" | "rejected"; notes?: string }) =>
        api.post<{ message: string }>("/unit-transactions/void-approve", data),
};

// ============================================================
// Member Portal API
// ============================================================

export const memberPortalApi = {
    summary: () => api.get<{ data: unknown }>("/member-portal/summary"),

    transactions: (params?: { type?: string; unitType?: string; isPaid?: string; page?: number }) =>
        api.get<{ data: unknown }>("/member-portal/transactions", { params }),
};

// ============================================================
// Member Lookup API
// ============================================================

export const memberLookupApi = {
    byNrp: (nrp: string) => api.get<{ data: Member | null }>(`/members/lookup?nrp=${encodeURIComponent(nrp)}`),
};

// ============================================================
// Receipts API
// ============================================================

export interface Receipt {
    id: number;
    receiptNo: string;
    memberId: number;
    type: string;
    referenceNo?: string;
    amount: number;
    description: string;
    receivedFrom: string;
    paymentMethod: string;
    status: string;
    notes?: string;
    receiptDate: string;
    printedAt?: string;
    member?: { id: number; memberNo: string; nrp?: string; name: string };
    createdBy?: { id: number; name: string };
}

export const receiptsApi = {
    list: (params?: { page?: number; perPage?: number; status?: string; search?: string }) =>
        api.get<PaginatedResponse<Receipt>>("/receipts", { params }),

    get: (id: number) => api.get<{ data: Receipt }>(`/receipts/${id}`),

    create: (data: {
        memberId: number;
        type: string;
        referenceNo?: string;
        amount: number;
        description: string;
        receivedFrom: string;
        paymentMethod?: string;
        notes?: string;
        receiptDate: string;
    }) => api.post<{ data: Receipt }>("/receipts", data),

    update: (id: number, data: Record<string, unknown>) =>
        api.put<{ data: Receipt }>(`/receipts/${id}`, data),

    delete: (id: number) =>
        api.delete<{ message: string }>(`/receipts/${id}`),
};

// ============================================================
// Settings API
// ============================================================

export const settingsApi = {
    cooperative: () => api.get<{ data: any }>("/settings/cooperative"),
};

