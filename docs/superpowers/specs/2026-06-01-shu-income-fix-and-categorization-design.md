# SHU Income Fix & Categorization Design

**Date:** 2026-06-01
**Branch:** railway-migration
**Status:** Draft
**Related:** SHU-BUG-AND-UPDATE.md Section 11 (RC-5, RC-6), OPERATOR.md Section 10.3

---

## Problem Statement

The SHU calculator's journal path reads income ONLY from `JournalLine type=income` (~Rp 95jt), but expenses now include non-journaled CashBankTransactions (~Rp 2.58M). This asymmetry causes `netSurplus = Math.max(0, 95jt - 2.58M) = 0`, making all SHU allocations zero.

Additionally, the operator requests:
1. Clear per-month filtering (already exists, verified working)
2. Per-unit income/expense visibility with separate source tracking
3. Jasa Pinjaman categorized under Pendapatan SimpanPinjam (SP)
4. Dana Resiko (Loan.adminFee) recorded as income automatically

---

## Design Decisions

### D1: CB-first Income Approach (Approved)

All income data is read from `CashBankTransaction type=in` with `journalId=NULL`, using a blacklist of non-income categories. This is symmetric with the existing expense merge (Section 10 fix).

**Rationale:** `jasa_pinjaman`, `pendapatan_unit`, `pendapatan_toko`, and future `dana_resiko` already exist as CB categories. No need for separate LoanPayment/UnitTransaction queries in the journal path — they're already recorded as CB transactions.

**Blacklist (NON_INCOME_CATEGORIES):**
```typescript
const NON_INCOME_CATEGORIES = [
    "savings",              // Penarikan simpanan
    "simpanan_pokok",       // Setoran simpanan pokok
    "simpanan_wajib",       // Setoran simpanan wajib
    "simpanan_sukarela",    // Setoran simpanan sukarela
    "setoran_simpanan",     // Setoran simpanan (mobile)
    "transfer",             // Transfer antar rekening
    "pencairan_pinjaman",   // Pencairan hutang, bukan income
    "angsuran_pokok",       // Pembayaran pokok pinjaman
    "loan",                 // Generic reference (member portal)
];
```

Everything NOT in this blacklist is treated as income: `jasa_pinjaman`, `pendapatan_unit`, `pendapatan_toko`, `operational`, `dana_resiko`, `lainnya`, `biaya_operasional` (when type=in), and null-category transactions.

### D2: Dana Resiko Auto-Record (Approved)

When a loan is disbursed, automatically create a `CashBankTransaction type=in` with:
- `category: "dana_resiko"`
- `amount: loan.adminFee`
- `unitType: "simpan_pinjam"`
- `referenceType: "Loan"` / `referenceId: loan.id`

Applied to all disbursement endpoints:
- `src/app/api/loans/[id]/disburse/route.ts` (or the route handling loan approval/disbursement)
- `src/app/api/loans/kompen/disburse/route.ts`
- `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`
- Import loan paths where disbursement occurs

### D3: 3-Category Income Grouping (Approved)

Income is categorized into 3 groups for UI display:

| Group | CB Categories Included | UI Label | Code |
|-------|----------------------|----------|------|
| Pendapatan Unit Usaha | `pendapatan_unit`, `pendapatan_toko`, `operational` | "Pendapatan Unit Usaha" | `INC-UNIT` |
| Pendapatan SimpanPinjam | `jasa_pinjaman`, `dana_resiko`, `biaya_operasional` (type=in with unitType simpan_pinjam) | "Pendapatan SimpanPinjam (SP)" | `INC-SP` |
| Pendapatan Lainnya | `lainnya`, null, and everything else | "Pendapatan Lainnya" | `INC-LAIN` |

### D4: Per-Unit CB Income Merge

Add a `cashBankTransaction.groupBy({ by: ['unitType'] })` query for income, merging results into the existing `unitRevenueMap`. This ensures:
- Toko revenue includes CB `pendapatan_toko`
- Unit revenue includes CB `pendapatan_unit`
- SP income shows under a new "simpan_pinjam" unit entry

---

## Technical Specification

### File: `src/lib/services/shu-calculator.ts`

#### Change 1: Add NON_INCOME_CATEGORIES constant (after line 46)

```typescript
// Kategori CashBankTransaction type=in yang BUKAN pendapatan riil
const NON_INCOME_CATEGORIES = [
    "savings",
    "simpanan_pokok",
    "simpanan_wajib",
    "simpanan_sukarela",
    "setoran_simpanan",
    "transfer",
    "pencairan_pinjaman",
    "angsuran_pokok",
    "loan",
];
```

#### Change 2: CB Income Labels constant

```typescript
const CB_INCOME_LABELS: Record<string, { code: string; name: string }> = {
    jasa_pinjaman: { code: "SP-JASA", name: "Jasa Pinjaman (Bunga)" },
    dana_resiko: { code: "SP-RESIKO", name: "Dana Resiko (Admin Fee)" },
    pendapatan_unit: { code: "UNT-REV", name: "Pendapatan Unit Layanan" },
    pendapatan_toko: { code: "TOKO-REV", name: "Pendapatan Toko" },
    operational: { code: "OPS-REV", name: "Pemasukan Operasional" },
    lainnya: { code: "INC-LAIN", name: "Pendapatan Lainnya" },
    biaya_operasional: { code: "OPS-MISC", name: "Pendapatan Operasional Lain" },
};
```

#### Change 3: Income Merge in Journal Path (after line 117, inside `if (journalLines.length > 0)`)

After the existing expense merge block (lines 142-166), add symmetric income merge:

```typescript
// === INCOME MERGE: CB type=in non-journaled ===
const nonJournaledIncome = await prisma.cashBankTransaction.findMany({
    where: {
        transactionDate: { gte: startDate, lte: endDate },
        type: "in",
        journalId: null,
        category: { notIn: NON_INCOME_CATEGORIES },
    },
});

const cbIncomeByCategory: Record<string, number> = {};
nonJournaledIncome.forEach(tx => {
    const cat = tx.category || "lainnya";
    cbIncomeByCategory[cat] = (cbIncomeByCategory[cat] || 0) + toNum(tx.amount);
});

for (const [cat, amount] of Object.entries(cbIncomeByCategory)) {
    totalIncome += amount;
    const meta = CB_INCOME_LABELS[cat] || {
        code: `INC-${cat.toUpperCase().slice(0, 8)}`,
        name: `Pendapatan: ${cat.replace(/_/g, " ")}`,
    };
    if (incomeAccounts[meta.code]) {
        incomeAccounts[meta.code].amount += amount;
    } else {
        incomeAccounts[meta.code] = { code: meta.code, name: meta.name, amount };
    }
}
```

#### Change 4: Income Group Categorization (new return field)

**Approach:** Track CB category during the income merge loop and route each category to its group. This avoids string-matching heuristics and is deterministic.

```typescript
// Definisikan mapping kategori → income group
const INCOME_GROUP_MAP: Record<string, "unit" | "sp" | "lainnya"> = {
    pendapatan_unit: "unit",
    pendapatan_toko: "unit",
    operational: "unit",
    jasa_pinjaman: "sp",
    dana_resiko: "sp",
    biaya_operasional: "lainnya", // type=in dengan category biaya_operasional → lainnya
    lainnya: "lainnya",
};

interface IncomeGroup {
    key: string;
    label: string;
    amount: number;
    details: { code: string; name: string; amount: number }[];
}

const incomeGroups: IncomeGroup[] = [
    { key: "unit", label: "Pendapatan Unit Usaha", amount: 0, details: [] },
    { key: "sp", label: "Pendapatan SimpanPinjam (SP)", amount: 0, details: [] },
    { key: "lainnya", label: "Pendapatan Lainnya", amount: 0, details: [] },
];

// Helper untuk route income detail ke group yang benar
function routeToIncomeGroup(code: string, name: string, amount: number, sourceCategory: string | null) {
    const group = INCOME_GROUP_MAP[sourceCategory || ""] || "lainnya";
    // Journal-based income (code starts with "4") → default ke SP
    const targetGroup = (code.startsWith("4") && !sourceCategory) ? "sp" : group;
    const g = incomeGroups.find(ig => ig.key === targetGroup)!;
    g.amount += amount;
    g.details.push({ code, name, amount });
}
```

During the CB income merge loop (Change 3), call `routeToIncomeGroup()` for each category. Journal-based income (from JournalLine) is routed to SP by default (chart of accounts 4xxx = income accounts typically represent SP income).

#### Change 5: Per-unit CB Income in unitBreakdown

Add a new `groupBy` query alongside the existing expense groupBy:

```typescript
const incomeByUnit = await prisma.cashBankTransaction.groupBy({
    by: ['unitType'],
    where: {
        transactionDate: { gte: startDate, lte: endDate },
        type: "in",
        journalId: null,
        category: { notIn: NON_INCOME_CATEGORIES },
    },
    _sum: { amount: true },
    _count: true,
});
```

Merge into `unitRevenueMap`:
```typescript
incomeByUnit.forEach(i => {
    const ut = i.unitType || "simpan_pinjam";
    if (!unitRevenueMap[ut]) unitRevenueMap[ut] = { revenue: 0, txCount: 0 };
    unitRevenueMap[ut].revenue += toNum(i._sum.amount);
    unitRevenueMap[ut].txCount += i._count;
});
```

#### Return Type Addition

Add `incomeGroups` to the return object:
```typescript
return {
    // ... existing fields
    incomeGroups, // NEW: 3-group income breakdown
};
```

### File: Loan Disbursement Endpoints

#### Change 6: Auto-record Dana Resiko CB

In each loan disbursement route, after the loan is successfully updated to "active"/"disbursed" status, create a CB transaction:

```typescript
// Auto-record Dana Resiko
if (toNum(loan.adminFee) > 0) {
    const bankAccount = await prisma.cashBankAccount.findFirst({
        where: { type: "bank", branchId: loan.branchId },
    });
    if (bankAccount) {
        const currentBalance = toNum(bankAccount.balance);
        const adminFeeAmount = toNum(loan.adminFee);
        await prisma.cashBankTransaction.create({
            data: {
                transactionNo: `DR-${Date.now()}-${loan.id}`,
                accountId: bankAccount.id,
                branchId: loan.branchId,
                type: "in",
                category: "dana_resiko",
                amount: adminFeeAmount,
                balanceBefore: currentBalance,
                balanceAfter: currentBalance + adminFeeAmount,
                unitType: "simpan_pinjam",
                memberId: loan.memberId,
                description: `Dana Resiko - Pencairan Pinjaman ${loan.loanNo}`,
                referenceType: "Loan",
                referenceId: loan.id,
                transactionDate: new Date(),
                createdById: session.user.id,
            },
        });
        await prisma.cashBankAccount.update({
            where: { id: bankAccount.id },
            data: { balance: { increment: adminFeeAmount } },
        });
    }
}
```

**Target files:**
- `src/app/api/loans/[id]/route.ts` (PUT handler — approval/disbursement)
- `src/app/api/loans/kompen/disburse/route.ts`
- `src/app/api/mobile/loans-operator/kompen-disburse/route.ts`

### File: `src/app/(protected)/laporan/shu/page.tsx`

#### Change 7: Income Group Cards UI

Add 3 colored summary cards between the SHU Summary card and Unit Breakdown:

```tsx
{/* Income Groups */}
{data.incomeGroups && data.incomeGroups.length > 0 && (
    <div className="grid gap-4 sm:grid-cols-3">
        {data.incomeGroups.map(group => (
            <Card key={group.key} className={
                group.key === "unit" ? "border-emerald-200" :
                group.key === "sp" ? "border-blue-200" :
                "border-amber-200"
            }>
                <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">{group.label}</p>
                    <p className={`text-xl font-bold tabular-nums ${
                        group.key === "unit" ? "text-emerald-600" :
                        group.key === "sp" ? "text-blue-600" :
                        "text-amber-600"
                    }`}>{formatCurrency(group.amount)}</p>
                    {/* Expandable detail items */}
                </CardContent>
            </Card>
        ))}
    </div>
)}
```

#### Change 8: Unit Breakdown Enhancement

Add "Sumber" column to unit breakdown table showing income source breakdown per unit.

---

## API Changes

### GET /api/reports/shu

New response fields:
```json
{
    "incomeGroups": [
        {
            "key": "unit",
            "label": "Pendapatan Unit Usaha",
            "amount": 1234567890,
            "details": [
                { "code": "TOKO-REV", "name": "Pendapatan Toko", "amount": 500000000 },
                { "code": "UNT-REV", "name": "Pendapatan Unit Layanan", "amount": 734567890 }
            ]
        },
        {
            "key": "sp",
            "label": "Pendapatan SimpanPinjam (SP)",
            "amount": 234567890,
            "details": [
                { "code": "SP-JASA", "name": "Jasa Pinjaman (Bunga)", "amount": 200000000 },
                { "code": "SP-RESIKO", "name": "Dana Resiko (Admin Fee)", "amount": 34567890 }
            ]
        },
        {
            "key": "lainnya",
            "label": "Pendapatan Lainnya",
            "amount": 50000000,
            "details": [
                { "code": "INC-LAIN", "name": "Pendapatan Lainnya", "amount": 50000000 }
            ]
        }
    ]
}
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Double-counting income (JournalLine + CB) | `journalId: null` filter ensures only non-journaled CB counted |
| Dana Resiko created twice for existing loans | Only apply to NEW disbursements, not retroactively |
| CB balance integrity during auto-record | Use atomic `balance: { increment: amount }` + sequential balanceBefore/After |
| Existing fallback path regression | Keep fallback path unchanged, only modify journal path |
| Unit Breakdown double-counting revenue | Merge CB income into existing map, StoreSale/UnitTransaction already use same map |

---

## Testing Plan

1. **Unit test:** Verify NON_INCOME_CATEGORIES blacklist excludes savings, transfers, and principal
2. **Integration test:** Disburse a loan → verify CB `dana_resiko` created with correct amount
3. **E2E test:** Load SHU report → verify totalIncome > 0, incomeGroups sum matches totalIncome
4. **Regression test:** Verify fallback path (no journal entries) still works correctly
5. **Data validation:** Compare SHU income total with sum of all CB type=in non-journaled

---

## Order of Implementation

1. Add `NON_INCOME_CATEGORIES` and `CB_INCOME_LABELS` constants
2. Add CB income merge in journal path (fix SHU = 0)
3. Add income group categorization
4. Add per-unit CB income merge
5. Add Dana Resiko auto-record in disbursement endpoints
6. Update UI with income group cards
7. Update unit breakdown table
8. Update API route to pass through `incomeGroups`
9. Update documentation (OPERATOR.md, SHU-BUG-AND-UPDATE.md)
10. Run tests and verify
