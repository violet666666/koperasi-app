# SHU Card Breakdown — Detail Dialog Feature

**Date:** 2026-06-01
**Status:** Approved
**Branch:** `railway-migration`
**Affects:** `/laporan/shu` (operator role)

---

## 1. Overview

Operator needs to understand exactly where every number in the SHU report comes from. Currently, the SHU Summary Card displays aggregate values (Total Pendapatan, Total Beban, SHU Anggota, SHU Non-Anggota) and 3 Income Group Cards — but clicking any of them does nothing. The user must scroll down to separate "Rincian Pendapatan" and "Rincian Beban" cards to see the breakdown.

This spec adds a **unified `<SHUDetailDialog>` component** that opens when any card/number is clicked, showing two tabs: **Summary per Category** (no API call, uses existing data) and **Transaction List** (lazy-loaded via new API endpoint).

---

## 2. User Stories

1. As an operator, I want to click "Total Pendapatan Rp X" and see a dialog listing every income source (Jasa Pinjaman, Pendapatan Toko, Dana Resiko, etc.) with amounts — so I can verify the total.
2. As an operator, I want to click "Total Beban Rp X" and see a dialog listing every expense source (Biaya Operasional, Beban Unit, HPP, etc.) with amounts — so I can audit costs.
3. As an operator, I want to click an Income Group Card and see the transactions that make up that specific group's total.
4. As an operator, I want to click "SHU Anggota 80%" and see step-by-step how the number was calculated (ratio, pools, allocations) — so I can explain it during RAT.
5. As an operator, I want to switch to the "Transactions" tab in any income/expense dialog and see individual transactions with date, description, category, and amount — so I can trace specific entries.

---

## 3. Component Architecture

### 3.1 New Files

| File | Purpose |
|------|---------|
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | Main reusable dialog with tab switching |
| `src/app/(protected)/laporan/shu/_components/shu-summary-tab.tsx` | Tab 1: summary table of categories with amounts |
| `src/app/(protected)/laporan/shu/_components/shu-transactions-tab.tsx` | Tab 2: paginated transaction list with filters |
| `src/app/(protected)/laporan/shu/_components/shu-calculation-tab.tsx` | Tab (alternate): step-by-step calculation flow for derived values |
| `src/app/(protected)/laporan/shu/_types.ts` | Shared TypeScript types for dialog components |
| `src/app/api/reports/shu/detail-transactions/route.ts` | New API: flat paginated transaction list with filters |

### 3.2 Modified Files

| File | Change |
|------|--------|
| `src/app/(protected)/laporan/shu/page.tsx` | Add dialog state, onClick handlers on cards, visual cues (hover/cursor/icon), render `<SHUDetailDialog>` |

---

## 4. Component: `<SHUDetailDialog>`

### 4.1 Props

```typescript
interface SHUDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "income" | "expense" | "member_surplus" | "non_member_surplus";
  title: string;
  periodLabel: string;
  summaryData: { code: string; name: string; amount: number }[];
  incomeGroup?: "unit" | "sp" | "lainnya";
  calculationData?: CalculationData;
  year: number;
  month?: number | null;
}
```

### 4.2 Tab Logic

| `source` | Tab 1 | Tab 2 |
|----------|-------|-------|
| `"income"` | Summary per category (`incomeDetails`) | Transaction list (API) |
| `"expense"` | Summary per category (`expenseDetails`) | Transaction list (API) |
| `"member_surplus"` | Allocation table (`allocationsMember`) | Calculation steps (`SHUCalculationTab`) |
| `"non_member_surplus"` | Allocation table (`allocationsNonMember`) | Calculation steps (`SHUCalculationTab`) |

When `incomeGroup` is provided (from Income Group Card click):
- Summary tab shows only `group.details[]` from `incomeGroups`
- Transactions tab filters by categories in that group

### 4.3 Dialog UI

- Uses shadcn `<Dialog>` component (already in project)
- Max width: `max-w-3xl`
- Header: icon + title + period label
- Tab bar: shadcn `<Tabs>` with `<TabsList>`
- Content area: switches between tab components

---

## 5. Component: `<SHUSummaryTab>`

Displays a table of categories with amounts. Data comes from parent — **no API call**.

### Columns

| Column | Width | Description |
|--------|-------|-------------|
| Kode | w-24 | Account code (e.g., `SP-JASA`, `CB-OP`) |
| Sumber Pendapatan/Beban | flex | Human-readable name |
| Jumlah | w-40 right | Formatted currency amount |
| % | w-20 right | Percentage of total |

### Features
- Rows sorted by amount descending
- Total row at bottom (bold)
- Color-coded: income = emerald, expense = red
- Clickable row → filters transaction tab to that category

---

## 6. Component: `<SHUTransactionsTab>`

Lazy-loaded paginated transaction list. Fetches from new API endpoint.

### Filters

| Filter | Options | Default |
|--------|---------|---------|
| Kategori | Dynamic (from summary data) | Semua |
| Metode Bayar | Tunai, QRIS, Potong Gaji, Semua | Semua |
| Pencarian | Text search on description | - |

### Table Columns

| Column | Width | Description |
|--------|-------|-------------|
| Tanggal | w-90 | Formatted date (DD/MM/YYYY) |
| Keterangan | flex | Description text (truncated with tooltip) |
| Kategori | w-100 | Badge with category label |
| Metode | w-100 | Badge: Tunai/QRIS/Potong Gaji |
| Jumlah | w-130 right | +/- formatted currency |
| No. Ref | w-80 | Reference number |

### Features
- Pagination: 25 per page
- Summary bar: total amount + count
- Color-coded rows: income = emerald, expense = red
- Loading skeleton while fetching

---

## 7. Component: `<SHUCalculationTab>`

Step-by-step calculation flow for derived values (member/non-member surplus).

### Steps (Member Surplus)

1. **Total Pendapatan** — shows amount, clickable to open income dialog
2. **Total Beban** — shows amount, clickable to open expense dialog
3. **SHU Bersih** (Pendapatan - Beban) — result, clamped to >= 0
4. **Beban SHU Cuci Mobil** — shows count x Rp 2.000, subtracted
5. **SHU Adjusted** — after carwash deduction
6. **Rasio Anggota vs Non-Anggota** — member vs non-member omzet, percentage
7. **SHU Anggota** (ratio x SHU Adjusted) — final result with checkmark

After steps: **Allocation table** showing how member surplus is split (Jasa Anggota 25%, Jasa Simpanan 20%, etc.)

### Visual Style

- Vertical flow with arrows between steps
- Each step is a card-like box
- Numbers are bold, tabular-nums
- Arrows use `↓` or `ArrowDown` icon
- Clickable amounts open nested dialogs

---

## 8. API: `GET /api/reports/shu/detail-transactions`

### Query Parameters

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `year` | number | yes | - | Year filter |
| `month` | number | no | null | Month filter (null = all months) |
| `source` | string | yes | - | `"income"` or `"expense"` |
| `category` | string | no | null | Filter by specific CB category |
| `incomeGroup` | string | no | null | `"unit"`, `"sp"`, or `"lainnya"` |
| `paymentMethod` | string | no | null | `"cash"`, `"qris"`, `"salary_cut"` |
| `search` | string | no | null | Search description |
| `page` | number | no | 1 | Page number |
| `perPage` | number | no | 25 | Items per page (max 100) |

### Response

```typescript
{
  data: {
    transactions: Array<{
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
    }>;
    summary: {
      totalAmount: number;
      totalItems: number;
      byCategory: Array<{
        category: string;
        label: string;
        count: number;
        amount: number;
      }>;
    };
    pagination: {
      page: number;
      perPage: number;
      totalItems: number;
      totalPages: number;
    };
  }
}
```

### Data Sources

**For `source=income`:**
1. `CashBankTransaction` where `type=in`, `journalId=NULL`, `category NOT IN NON_INCOME_CATEGORIES`
2. `LoanPayment` — `interestPortion` (non-voided, in date range)
3. `Loan.adminFee` — Dana Resiko (disbursed in date range)
4. `UnitTransaction` — completed, isPaid (in date range)
5. `StoreSale` — non-voided (in date range)

All sources merged, sorted by date descending, then paginated.

**For `source=expense`:**
1. `CashBankTransaction` where `type=out`, `journalId=NULL`, `category NOT IN NON_EXPENSE_CATEGORIES`
2. `StoreSaleItem` — COGS calculation (via StoreSale in date range)

### Filtering by `incomeGroup`

When `incomeGroup` is provided, filter CashBankTransaction categories using `INCOME_GROUP_MAP`:
- `"unit"` → categories: `pendapatan_unit`, `pendapatan_toko`, `operational`
- `"sp"` → categories: `jasa_pinjaman`, `dana_resiko`, `penalti_pelunasan` + `LoanPayment.interestPortion` + `Loan.adminFee`
- `"lainnya"` → everything else

---

## 9. Visual Cues on Summary Card

### Changes to existing Summary Card (line 484-502 of page.tsx)

Each of the 4 metric boxes becomes clickable:

1. **Cursor:** `cursor-pointer` on the metric div
2. **Hover effect:** `hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors`
3. **Icon:** Small `<Eye>` or `<Info>` icon in the corner of each metric
4. **Tooltip:** `title="Klik untuk detail"`
5. **Dashed underline** on the amount value to indicate clickability

### Income Group Cards (3 cards)

Same pattern: entire card becomes clickable with hover highlight + icon.

---

## 10. Implementation Sequence

1. Create `_types.ts` with shared interfaces
2. Create `shu-summary-tab.tsx` (Tab 1 — uses existing data)
3. Create `shu-calculation-tab.tsx` (calculation steps — uses existing data)
4. Create API endpoint `detail-transactions/route.ts`
5. Create `shu-transactions-tab.tsx` (Tab 2 — lazy fetch from API)
6. Create `shu-detail-dialog.tsx` (main dialog — composes tabs)
7. Modify `page.tsx` — add dialog state, handlers, visual cues, render dialog
8. Test all 5 dialog contexts

---

## 11. Edge Cases

| Case | Handling |
|------|----------|
| No transactions for filter | Show "Tidak ada transaksi" message |
| SHU Bersih = 0 | Calculation tab shows expense >= income, highlight deficit |
| Very old year (no data) | Dialog opens with empty state |
| Rapid clicking different cards | Dialog reuses same instance, just changes props via key |
| Print mode | Dialog is `print:hidden` (already default for Dialog) |
| Mobile | Dialog is full-width, tabs stack properly |

---

## 12. Non-Goals

- Editing transactions from the dialog (view-only)
- Exporting transaction list from dialog (already available via Audit section)
- Changing SHU calculations
- Adding new income/expense categories
