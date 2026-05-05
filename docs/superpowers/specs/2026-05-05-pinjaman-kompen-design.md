# Pinjaman Kompen/Rollover — Design Spec

## Summary

Fitur kompen memungkinkan operator membuat akad pinjaman baru yang secara otomatis melunasi pinjaman lama (dengan penalti pelunasan dipercepat) dan mencairkan selisihnya ke anggota. Satu-ke-satu, lintas produk pinjaman, tersedia di Web dan Mobile.

## Scenario

```
Anggota punya pinjaman lama: Pokok 100jt, tenor 100x, sudah jalan 1 tahun, sisa 88x
Sisa pokok outstanding: ~88jt

Anggota ajukan pinjaman baru: Plafon 300jt, tenor 60x
Kredit maksimal anggota: 350jt

Perhitungan kompen:
- Plafon baru:              300,000,000
- Sisa pokok pinjaman lama:  88,000,000
- Penalti pelunasan (1x):     1,000,000
- Total kompen:              89,000,000
- Biaya admin (2%):           6,000,000
- Dana diterima anggota:    205,000,000
```

## Requirements

1. Satu akad baru hanya boleh mengompen satu pinjaman lama
2. Bisa lintas produk (Reguler ↔ Khusus)
3. Penalti pelunasan dipercepat dikenakan sesuai ketentuan: 1x bunga bulanan (tenor ≤24) atau 2x (tenor >24)
4. Bunga sisa tenor pinjaman lama di-waiver (tidak dibayar)
5. Semua berjalan dalam satu atomic transaction
6. Tersedia di Web (operator) dan Mobile (operator)
7. Validasi: plafon baru harus > total kompen, anggota harus aktif, pinjaman lama harus status "active"
8. Kredit limit check: total plafon baru tidak boleh melebihi batas kredit anggota

## Data Model Changes

### Loan table — add 2 optional fields

```prisma
model Loan {
  // ... existing fields ...

  compensatedLoanId  Int?    @map("compensated_loan_id")   // Pinjaman baru: pinjaman lama yang dikompen
  compensatingLoanId Int?    @map("compensating_loan_id")  // Pinjaman lama: pinjaman baru yang mengompen

  compensatedLoan   Loan?  @relation("LoanKompen", fields: [compensatedLoanId], references: [id])
  compensatingLoan  Loan?  @relation("LoanKompenReverse", fields: [compensatingLoanId], references: [id])
}
```

**Note:** These fields are purely for traceability. The actual payoff is recorded via `LoanPayment` with `paymentType: "early_settlement"`.

## API Design

### 1. GET /api/loans/kompen/simulate — Simulasi Kompen

Input (query params):
- `memberId` — ID anggota
- `existingLoanId` — ID pinjaman lama yang akan dikompen
- `newAmount` — plafon pinjaman baru
- `newProductId` — produk pinjaman baru
- `newTenor` — tenor pinjaman baru

Output:
```json
{
  "existingLoan": {
    "loanNo": "PJM-2026-0001",
    "principalOutstanding": 88000000,
    "remainingTenor": 88,
    "monthlyInterest": 1000000
  },
  "kompen": {
    "principalOutstanding": 88000000,
    "penaltyFee": 1000000,
    "totalKompen": 89000000
  },
  "newLoan": {
    "principalAmount": 300000000,
    "adminFee": 6000000,
    "interestRate": 1.0,
    "tenorMonths": 60,
    "monthlyInstallment": 6000000,
    "disbursedToMember": 205000000
  },
  "summary": {
    "plafonBaru": 300000000,
    "totalKompen": 89000000,
    "biayaAdmin": 6000000,
    "danaDiterimaAnggota": 205000000
  }
}
```

Validations:
- Member must be active
- Existing loan must be status "active"
- New amount must be > totalKompen + adminFee
- Credit limit check: member's total active loans + new loan ≤ max credit limit

### 2. POST /api/loans/applications/kompen-disburse — Eksekusi Kompen (Web)

Request body:
```json
{
  "memberId": 1,
  "existingLoanId": 5,
  "productId": 2,
  "amount": 300000000,
  "tenorMonths": 60,
  "paymentMethod": "bank_transfer",
  "cashBankAccountId": 1,
  "backdatedDate": null
}
```

Atomic transaction sequence:

1. **Validate**: Member active, existing loan active, product valid, credit limit OK
2. **Calculate**: Same as simulate — kompen amount, penalty, admin fee, disbursement
3. **Create LoanApplication** (status: "disbursed") — with notes mentioning kompen
4. **Create Loan** (new) — with `compensatedLoanId = existingLoanId`
5. **Create LoanSchedule** records for new loan
6. **Create LoanPayment** (early_settlement) for existing loan:
   - `paymentType: "early_settlement"`
   - `amount = principalOutstanding + penaltyFee`
   - `principalPortion = principalOutstanding`
   - `earlySettlementFee = penaltyFee`
   - `interestPortion = 0` (waived)
   - `notes = "[KOMPEN] Pelunasan dari pinjaman baru PJM-2026-XXXX"`
7. **Update existing loan**: `status = "paid_off"`, `paidOffDate = now`, `compensatingLoanId = newLoan.id`
8. **Update existing schedules**: All pending → "paid"
9. **CashBank transactions**:
   - OUT: Disbursement to member (selisih) — category "pencairan_pinjaman"
   - IN: Pelunasan pokok old loan — category "angsuran_pokok"
   - IN: Penalti — category "penalti_pelunasan"
10. **Update CashBankAccount.currentBalance** for each transaction
11. **Create Receipt** for the kompen disbursement
12. **Return**: new loan details, payoff details, receipt

### 3. POST /api/mobile/loans-operator/kompen-disburse — Eksekusi Kompen (Mobile)

Same logic as web version but:
- Uses `getMobileUser` for auth
- No CashBank transactions (mobile version doesn't do cash/bank, consistent with existing direct-disburse mobile)
- Uses mobile receipt number format

### 4. GET /api/loans/kompen/eligible — Pinjaman yang bisa dikompen

Input: `memberId`
Output: List of active loans for the member with outstanding balances, for the operator to select which loan to kompen.

## UI Design

### Web: `/pinjaman/pengajuan/tambah` — enhanced with "Mode Kompen"

Add a toggle at the top: "Mode Normal" / "Mode Kompen"

When Mode Kompen is active:
1. Show member selector (same)
2. Show "Pinjaman yang dikompen" dropdown — lists all active loans for selected member
3. Show plafon baru, produk, tenor input
4. Show "Simulasi Kompen" button → fetch from simulate endpoint
5. Show simulation result card with breakdown
6. "Proses Kompen" button → confirm and execute

### Mobile: New screen or section in DirectDisburseScreen

In the operator's loan creation screen, add "Kompen" option:
1. Select member → show active loans
2. Select loan to kompen
3. Input new loan details
4. Show simulation
5. Confirm and execute

## Edge Cases

1. **Plafon baru ≤ total kompen**: Reject with message "Plafon baru harus lebih besar dari total pelunasan"
2. **Pinjaman lama sudah paid_off**: Reject — can only kompen active loans
3. **Anggota punya >1 pinjaman aktif**: Operator pilih salah satu (satu-ke-satu)
4. **Backdated kompen**: Support same as backdated disburse — all dates use the backdated date
5. **Void kompen**: When new loan is voided, check if it has `compensatedLoanId` → if so, reverse the payoff (re-open old loan). This requires extending the existing void logic.

## Migration

```sql
ALTER TABLE loans ADD COLUMN compensated_loan_id INT NULL;
ALTER TABLE loans ADD COLUMN compensating_loan_id INT NULL;
```

Prisma migration: `npx prisma migrate dev --name add_kompen_fields`
