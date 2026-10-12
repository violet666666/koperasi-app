/**
 * Shared types for SHU Detail Dialog components.
 * These extend the page-level interfaces for dialog-specific data.
 */

/** Single category summary item (from incomeDetails / expenseDetails) */
export interface DetailSummaryItem {
  code: string;
  name: string;
  amount: number;
}

/** Single transaction from the detail-transactions API */
export interface DetailTransaction {
  id: string;
  date: string;
  description: string;
  category: string;
  categoryLabel: string;
  type: "income" | "expense";
  amount: number;
  paymentMethod: string | null;
  source: "cash_bank" | "unit_transaction" | "store_sale" | "loan_payment" | "loan_admin_fee";
  referenceNo: string | null;
  unitType: string | null;
}

/** Category breakdown in API response summary */
export interface CategoryBreakdown {
  category: string;
  label: string;
  count: number;
  amount: number;
}

/** Summary section from the detail-transactions API */
export interface DetailSummary {
  totalAmount: number;
  totalItems: number;
  byCategory: CategoryBreakdown[];
}

/** Pagination from the detail-transactions API */
export interface DetailPagination {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

/** Full response from detail-transactions API */
export interface DetailTransactionsResponse {
  transactions: DetailTransaction[];
  summary: DetailSummary;
  pagination: DetailPagination;
}

/** Calculation step for the SHUCalculationTab */
export interface CalculationStep {
  label: string;
  amount: number;
  description?: string;
  isResult?: boolean;
  isSubtraction?: boolean;
  /** If set, clicking this step opens a nested dialog */
  drillDown?: "income" | "expense";
}

/** Data needed for the calculation tab (member/non-member surplus) */
export interface CalculationData {
  totalIncome: number;
  totalExpense: number;
  netSurplus: number;
  totalCarwashBonus: number;
  carwashCount: number;
  adjustedNetSurplus: number;
  memberRatio: number;
  nonMemberRatio: number;
  memberGrossIncome: number;
  nonMemberGrossIncome: number;
  memberSurplus: number;
  nonMemberSurplus: number;
  jasaModalPool: number;
  jasaUsahaPool: number;
  allocations: {
    key: string;
    label: string;
    percentage: number;
    amount: number;
    description: string;
  }[];
}

/** Source type determines which tabs to show */
export type SHUSource = "income" | "expense" | "member_surplus" | "non_member_surplus";

/** Income group filter (only for source="income") */
export type IncomeGroupFilter = "unit" | "sp" | "lainnya";

/** Expense group filter (only for source="expense") */
export type ExpenseGroupFilter = "operasional" | "unit_beban" | "lainnya";

/** Monthly breakdown of SimpanPinjam income */
export interface SPMonthlyItem {
  month: string;         // "2026-01"
  monthLabel: string;    // "Januari 2026"
  jasaPinjaman: number;
  danaResiko: number;
  penalti: number;
  total: number;
}

/** Grouped expense category (mirrors income group structure) */
export interface ExpenseGroup {
  key: string;
  label: string;
  amount: number;
  details: { code: string; name: string; amount: number }[];
}

export interface SHUAllocation {
    key: string;
    label: string;
    percentage: number;
    amount: number;
    description: string;
}

export interface MemberSHU {
    memberNo: string;
    name: string;
    simpananPokok: number;
    simpananWajib: number;
    savingsContribution: number;
    loanContribution: number;
    totalContribution: number;
    modalPortion: number;
    usahaPortion: number;
    carwashBonus: number;
    carwashCount: number;
    shuShare: number;
}

export interface IncomeExpenseDetail {
    code: string;
    name: string;
    amount: number;
}

export interface IncomeGroup {
    key: string;
    label: string;
    amount: number;
    details: { code: string; name: string; amount: number }[];
}

export interface ExpenseGroupData {
    key: string;
    label: string;
    amount: number;
    details: { code: string; name: string; amount: number }[];
}

export interface PaginationMeta {
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
}

export interface SHUData {
    totalShu: number;
    totalIncome: number;
    totalExpense: number;
    memberNetIncome: number;
    nonMemberNetIncome: number;
    period: string;
    month: number;
    periodLabel: string;
    allocationsMember: SHUAllocation[];
    allocationsNonMember: SHUAllocation[];
    incomeDetails: IncomeExpenseDetail[];
    incomeGroups: IncomeGroup[];
    spMonthlyBreakdown?: SPMonthlyItem[];
    expenseDetails: IncomeExpenseDetail[];
    expenseGroups?: ExpenseGroupData[];
    memberShu: MemberSHU[];
    memberSharePercent: number;
    pagination?: PaginationMeta;
    unitBreakdown?: UnitBreakdown[];
    unitGrossProfit?: UnitGrossProfit[];
}

export interface UnitBreakdown {
    unitType: string;
    label: string;
    category: "store" | "service";
    revenue: number;
    expense: number;
    transactionCount: number;
    paymentMethodBreakdown: { method: string; label: string; amount: number; count: number }[];
}

export interface UnitGrossProfit {
    unitType: string;
    label: string;
    omzet: number;
    hpp: number;
    labaKotor: number;
    margin: number;
    itemCount: number;
}

export interface AuditTx {
    date: string;
    description: string;
    category: string;
    type: "income" | "expense";
    amount: number;
    paymentMethod: string | null;
    source: string;
    referenceNo: string | null;
}
