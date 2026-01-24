// Type definitions for the Koperasi Digital application

// =================================================================
// USER & AUTH TYPES
// =================================================================

export interface User {
    id: number;
    name: string;
    email: string;
    role: Role;
    branch_id: number | null;
    branch: Branch | null;
    permissions: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Role {
    id: number;
    name: string;
    display_name: string;
    permissions: string[];
}

export interface AuthResponse {
    user: User;
    token?: string; // Only for mobile
}

// =================================================================
// BRANCH TYPES
// =================================================================

export interface Branch {
    id: number;
    code: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    is_head_office: boolean;
    is_active: boolean;
}

// =================================================================
// MEMBER TYPES
// =================================================================

export interface Member {
    id: number;
    member_no: string;
    branch_id: number;
    branch?: Branch;
    name: string;
    nik?: string;
    gender?: 'male' | 'female';
    birth_date?: string;
    birth_place?: string;
    marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    province?: string;
    join_date: string;
    status: 'active' | 'inactive' | 'resigned';
    photo_url?: string;
    created_at: string;
    updated_at: string;
}

export interface MemberSummary {
    member_id: number;
    member_no: string;
    name: string;
    savings: {
        total: number;
        by_type: SavingsBalance[];
    };
    loans: {
        active_count: number;
        total_outstanding: number;
        total_principal_outstanding: number;
        total_interest_outstanding: number;
        next_installment?: {
            loan_id: number;
            due_date: string;
            amount: number;
        };
        overdue_amount: number;
        overdue_days: number;
    };
    net_position: number;
}

// =================================================================
// SAVINGS TYPES
// =================================================================

export interface SavingsProduct {
    id: number;
    code: string;
    name: string;
    type: 'pokok' | 'wajib' | 'sukarela' | 'lainnya';
    is_mandatory: boolean;
    deposit_period: 'once' | 'monthly' | 'optional';
    minimum_amount: number;
    can_withdraw: boolean;
    is_active: boolean;
}

export interface SavingsAccount {
    id: number;
    account_no: string;
    member_id: number;
    member?: Member;
    product_id: number;
    product?: SavingsProduct;
    balance: number;
    status: 'active' | 'closed';
    opened_date: string;
}

export interface SavingsBalance {
    type: string;
    name: string;
    balance: number;
}

export interface SavingsTransaction {
    id: number;
    transaction_no: string;
    account_id: number;
    member_id: number;
    member?: { member_no: string; name: string };
    product_id: number;
    product?: { code: string; name: string };
    branch_id: number;
    type: 'deposit' | 'withdrawal' | 'correction' | 'interest';
    amount: number;
    balance_before: number;
    balance_after: number;
    payment_method: 'cash' | 'bank_transfer';
    reference_no?: string;
    notes?: string;
    transaction_date: string;
    status: 'completed' | 'voided';
    created_by?: { id: number; name: string };
    created_at: string;
}

// =================================================================
// LOAN TYPES
// =================================================================

export interface LoanProduct {
    id: number;
    code: string;
    name: string;
    interest_method: 'flat' | 'effective' | 'annuity' | 'declining';
    interest_rate: number;
    min_tenor_months: number;
    max_tenor_months: number;
    min_amount: number;
    max_amount: number;
    admin_fee_type: 'percent' | 'fixed';
    admin_fee_value: number;
    is_active: boolean;
}

export interface LoanApplication {
    id: number;
    application_no: string;
    member_id: number;
    member?: { member_no: string; name: string };
    branch_id: number;
    product_id: number;
    product?: LoanProduct;
    amount: number;
    tenor_months: number;
    purpose?: string;
    status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'disbursed' | 'cancelled';
    submitted_at?: string;
    approved_at?: string;
    approved_by?: { id: number; name: string };
    rejected_at?: string;
    rejection_reason?: string;
    created_at: string;
}

export interface Loan {
    id: number;
    loan_no: string;
    application_id: number;
    member_id: number;
    member?: { member_no: string; name: string };
    branch_id: number;
    product_snapshot: {
        product_id: number;
        code: string;
        name: string;
        interest_method: string;
        interest_rate: number;
    };
    principal_amount: number;
    interest_amount: number;
    total_amount: number;
    admin_fee: number;
    disbursed_amount: number;
    tenor_months: number;
    monthly_installment: number;
    principal_paid: number;
    interest_paid: number;
    late_fee_paid: number;
    principal_outstanding: number;
    interest_outstanding: number;
    disbursement_date: string;
    first_due_date: string;
    last_due_date: string;
    paid_off_date?: string;
    status: 'active' | 'paid_off' | 'written_off';
    created_at: string;
}

export interface LoanSchedule {
    id: number;
    loan_id: number;
    installment_no: number;
    due_date: string;
    principal_amount: number;
    interest_amount: number;
    total_amount: number;
    principal_paid: number;
    interest_paid: number;
    late_fee: number;
    late_fee_paid: number;
    status: 'pending' | 'partial' | 'paid' | 'overdue';
    paid_date?: string;
}

export interface LoanPayment {
    id: number;
    payment_no: string;
    loan_id: number;
    member_id: number;
    amount: number;
    principal_portion: number;
    interest_portion: number;
    late_fee_portion: number;
    payment_method: 'cash' | 'bank_transfer';
    payment_date: string;
    created_at: string;
}

// =================================================================
// APPROVAL TYPES
// =================================================================

export type ApprovalType =
    | 'loan_application'
    | 'savings_correction'
    | 'asset_acquisition'
    | 'journal_adjustment'
    | 'large_transaction';

export interface ApprovalRequest {
    id: number;
    request_no: string;
    type: ApprovalType;
    reference_type: string;
    reference_id: number;
    branch_id: number;
    amount?: number;
    description: string;
    metadata?: Record<string, unknown>;
    status: 'pending' | 'approved' | 'rejected';
    requested_by: { id: number; name: string };
    requested_at: string;
    approved_by?: { id: number; name: string };
    approved_at?: string;
    rejection_reason?: string;
}

// =================================================================
// ACCOUNTING TYPES
// =================================================================

export interface Account {
    id: number;
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    category?: string;
    parent_id?: number;
    parent?: { id: number; code: string; name: string };
    level: number;
    is_detail: boolean;
    normal_balance: 'debit' | 'credit';
    is_active: boolean;
}

export interface JournalEntry {
    id: number;
    journal_no: string;
    branch_id: number;
    transaction_date: string;
    description: string;
    source_type?: string;
    source_id?: number;
    period_id: number;
    is_posted: boolean;
    is_adjustment: boolean;
    lines: JournalLine[];
    created_by: { id: number; name: string };
    created_at: string;
}

export interface JournalLine {
    id: number;
    account_id: number;
    account: { code: string; name: string };
    debit: number;
    credit: number;
    description?: string;
}

export interface FiscalPeriod {
    id: number;
    name: string;
    year: number;
    month: number;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed';
    closed_at?: string;
}

// =================================================================
// API RESPONSE TYPES
// =================================================================

export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        current_page: number;
        from: number;
        last_page: number;
        per_page: number;
        to: number;
        total: number;
    };
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
}

export interface ApiResponse<T> {
    data: T;
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
}

// =================================================================
// UI TYPES
// =================================================================

export interface NavItem {
    title: string;
    href?: string;
    icon?: string;
    permission?: string;
    badge?: number;
    children?: NavItem[];
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface BreadcrumbItem {
    title: string;
    href?: string;
}

export interface TableColumn<T> {
    key: keyof T | string;
    title: string;
    sortable?: boolean;
    className?: string;
    render?: (value: unknown, row: T) => React.ReactNode;
}

export interface FilterOption {
    value: string;
    label: string;
}

export interface StatsCardData {
    title: string;
    value: string | number;
    icon?: string;
    trend?: {
        value: number;
        direction: 'up' | 'down';
        label: string;
    };
    color?: 'primary' | 'success' | 'warning' | 'danger';
}
