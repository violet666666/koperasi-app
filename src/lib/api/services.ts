// API Services for Frontend-Backend integration
import { api } from "./client";

// ============================================================
// Members API
// ============================================================

export interface Member {
    id: number;
    memberNo: string;
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

    payments: (loanId: number) =>
        api.get<{ data: unknown[] }>(`/loans/${loanId}/payments`),

    createPayment: (loanId: number, data: { amount: number; paymentMethod: string }) =>
        api.post(`/loans/${loanId}/payments`, data),
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

    transactions: (params?: { accountId?: number; type?: string }) =>
        api.get<PaginatedResponse<unknown>>("/cash-bank/transactions", { params }),

    createTransaction: (data: { accountId: number; type: string; amount: number; description?: string }) =>
        api.post("/cash-bank/transactions", data),

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

    shu: (params?: { branchId?: number; year?: number }) =>
        api.get<{ data: unknown }>("/reports/shu", { params }),

    membersRecap: (params?: { branchId?: number }) =>
        api.get<{ data: unknown }>("/reports/members-recap", { params }),

    savingsRecap: (params?: { branchId?: number }) =>
        api.get<{ data: unknown }>("/reports/savings-recap", { params }),

    loansRecap: (params?: { branchId?: number }) =>
        api.get<{ data: unknown }>("/reports/loans-recap", { params }),
};

// ============================================================
// Approvals API
// ============================================================

export const approvalsApi = {
    list: (status?: "pending" | "history") =>
        api.get<{ data: unknown[] }>("/approvals", { params: { status } }),
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
    list: (params?: { page?: number; branchId?: number }) =>
        api.get<PaginatedResponse<User>>("/users", { params }),

    get: (id: number) => api.get<{ data: User }>(`/users/${id}`),

    create: (data: Partial<User> & { password?: string }) =>
        api.post<{ data: User }>("/users", data),

    update: (id: number, data: Partial<User>) =>
        api.put<{ data: User }>(`/users/${id}`, data),

    delete: (id: number) => api.delete(`/users/${id}`),

    roles: () => api.get<{ data: unknown[] }>("/users/roles"),
};
