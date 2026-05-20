# Member & Loan Management Enhancement Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Fix 7 loan edit bugs + duplicate member merge/delete + NRP edit with credential sync

---

## A. Fix 7 Bug Edit Tenor Pinjaman

### A1. paidInstallmentCount Rounding Error

**Problem:** `Math.floor(principalPaid / monthlyPrincipal)` bisa menandai terlalu banyak/sedikit schedule sebagai "paid" karena `principalPaid` dari import sering tidak exact multiple dari `monthlyPrincipal`.

**Fix:** Tambahkan field `principalPaid` dan `interestPaid` per schedule yang lebih akurat:

```typescript
// Hitung sisa pokok setelah angsuran paid terakhir
const paidInstallmentCount = monthlyPrincipal > 0
  ? Math.min(newTenor, Math.floor(newPrincipalPaid / monthlyPrincipal))
  : 0;
const remainderPrincipal = newPrincipalPaid - (paidInstallmentCount * monthlyPrincipal);

// Schedule generation:
for (let i = 1; i <= newTenor; i++) {
  if (i <= paidInstallmentCount) {
    // Fully paid
    principalPaid: monthlyPrincipal,
    interestPaid: interestPerMonth,
  } else if (i === paidInstallmentCount + 1 && remainderPrincipal > 0) {
    // Partial payment on next schedule (if any remainder)
    principalDue: monthlyPrincipal,
    principalPaid: 0, // remainder handled in outstanding
    status: "pending",
  } else {
    // Unpaid
    principalPaid: 0,
    interestPaid: 0,
    status: "pending",
  }
}
```

### A2. JS Date setMonth() Bug

**Problem:** `setMonth()` overflow — Jan 31 + 1 month = Mar 3 in JavaScript.

**Fix:** Create helper function:

```typescript
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months, 1); // set to 1st first
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay)); // clamp to month's last day
  return result;
}
```

**Apply to:** PUT handler schedule generation (line 211) and lastDueDate calculation (line 169).

### A3. Role Inconsistency (admin_sp)

**Problem:** API allows `["operator", "admin_sp"]` but UI only shows button for `"operator"`.

**Fix:** Change UI gate from hardcoded role check to permission-based:

```typescript
// Before:
const isOperator = roleName === "operator";

// After:
const canManagePinjaman = permissions?.includes("manage_all") || roleName === "operator";
```

This is consistent with how other features check permissions (OPERATOR role has `manage_all`).

### A4. Misleading "Riwayat Pembayaran" Message

**Problem:** Dialog shows "Riwayat pembayaran yang sudah tercatat akan dipertahankan" when `principalPaid > 0`, which could confuse operators.

**Fix:** Update copy:

```
Data pembayaran dari import (pokok terbayar, bunga terbayar) akan disesuaikan
dengan perhitungan baru. Jadwal angsuran akan di-regenerasi otomatis.
```

### A5. Field `notes` Silently Discarded

**Problem:** `notes` is accepted in request body but never written (not in Prisma schema).

**Fix:** Remove `notes` from accepted body fields in the PUT handler. The Loan model doesn't have a `notes` field, so accepting it is misleading.

### A6. Missing Audit Trail

**Problem:** Loan edit has no `logAudit()` call. VOID and import do.

**Fix:** Add audit log entry in the PUT handler after successful transaction:

```typescript
await logAudit({
  action: "UPDATE_LOAN",
  userId: session.user.id,
  details: {
    loanId: loan.id,
    changedFields: Object.keys(changes),
    before: { principalAmount: oldPrincipal, tenorMonths: oldTenor, ... },
    after: { principalAmount: newPrincipal, tenorMonths: newTenor, ... },
  }
});
```

### A7. Import Bypass Payment Guard (Document Only)

**Problem:** `import-update` updates loans with existing payments, while manual edit blocks it.

**Fix:** This is by design for migration purposes. Add inline comment explaining why:

```typescript
// Import pipeline intentionally bypasses payment-count guard
// to support data migration and correction from legacy Excel sources.
```

No code change needed.

---

## B. Delete & Merge Member Duplikasi

### B1. Duplicate Detection API

**Endpoint:** `GET /api/members/duplicates`

**Logic:**
1. Query all members with `deletedAt: null`
2. Group by normalized name (strip titles: H., Dr., S.H., etc.) and NRP
3. Flag groups with count > 1 as potential duplicates
4. Return list of duplicate groups with member details

**Response shape:**
```typescript
{
  groups: Array<{
    key: string;           // "nrp:83111012" or "name:AHMAD SUDRAJAT"
    type: "nrp" | "name";  // what matched
    members: Array<{
      id: number;
      nrp: string | null;
      name: string;
      memberNo: string;
      status: string;
      hasLoans: boolean;
      hasSavings: boolean;
      hasTransactions: boolean;
      createdAt: string;
    }>;
  }>;
  totalGroups: number;
}
```

### B2. Member Merge API

**Endpoint:** `POST /api/members/merge`

**Payload:**
```typescript
{
  sourceId: number;   // duplicate member (to be soft-deleted)
  targetId: number;   // primary member (to keep)
}
```

**Transaction steps (atomic):**
1. Validate both members exist and are not soft-deleted
2. Validate source ≠ target
3. Check source has no active loans being transferred (or allow with flag)
4. **Reassign all child records from source to target:**
   - `SavingsAccount.memberId` → targetId
   - `SavingsTransaction.memberId` → targetId
   - `Loan.memberId` → targetId
   - `LoanApplication.memberId` → targetId
   - `LoanPayment.memberId` → targetId
   - `UnitTransaction.memberId` → targetId
   - `StoreSale.memberId` → targetId
   - `Receipt.memberId` → targetId
   - `CashBankTransaction.memberId` → targetId
   - `ShuDistribution.memberId` → targetId
   - `TabunganSejahteraHistory.memberId` → targetId
   - `BillingItem.memberId` → targetId
   - `PayrollSlip.memberId` → targetId
5. **Handle unique constraints on source:**
   - Set `source.memberNo` → `{memberNo}_merged_{id}_{timestamp}`
   - Set `source.nrp` → `{nrp}_merged_{id}_{timestamp}` (if not null)
   - Set `source.nik` → `{nik}_merged_{id}_{timestamp}` (if not null)
6. **Soft-delete source member:**
   - `source.deletedAt` → now
   - `source.status` → "merged"
7. **Deactivate source's User account:**
   - `user.isActive` → false
   - `user.deletedAt` → now
8. **Audit log** the merge

### B3. Enhanced Member Delete API

**Modify:** `DELETE /api/members/[id]`

**Current behavior:** Soft delete only, only checks active loans.

**Enhanced checks:**
```typescript
// Block if ANY of these exist:
const [activeLoans, savingsBalance, pendingBilling, pendingUnitTx] = await Promise.all([
  tx.loan.count({ where: { memberId, status: "active" } }),
  tx.savingsAccount.aggregate({ where: { memberId }, _sum: { balance: true } }),
  tx.billingItem.count({ where: { member: { id: memberId }, isMarkedPaid: false } }),
  tx.unitTransaction.count({ where: { memberId, isPaid: false } }),
]);

if (activeLoans > 0) return 400 "Masih ada pinjaman aktif";
if ((savingsBalance._sum.balance ?? 0) > 0) return 400 "Masih ada saldo simpanan";
if (pendingBilling > 0) return 400 "Masih ada tagihan belum dibayar";
if (pendingUnitTx > 0) return 400 "Masih ada transaksi unit belum dibayar";

// If all clear, soft delete + free unique constraints:
memberNo → `{memberNo}_deleted_{id}_{timestamp}`
nrp → null (free the NRP for reuse)
nik → null (free the NIK for reuse)
status → "resigned"
deletedAt → now
```

### B4. Duplicate Management UI

**New page:** `/anggota/kelola` (or section within `/anggota` page)

**Features:**
1. **Tab "Duplikasi"** — list duplicate groups from API
2. For each group, show members side-by-side with data counts
3. **Actions per group:**
   - "Merge → Keep This" (select primary member)
   - "Hapus" (soft delete individual member if no data)
4. **Tab "Semua Anggota"** — existing member list with enhanced delete button
5. Confirmation dialogs for destructive actions

---

## C. Edit NRP dengan Auto-Sync Credentials

### C1. Enhanced PUT /api/members/[id]

**Current gap:** Only syncs credentials when `memberNo` changes.

**Fix:** Detect NRP change and sync within same transaction:

```typescript
// Inside the PUT handler's transaction:
const oldMember = await tx.member.findUnique({ where: { id }, include: { userAccount: true } });

// ... apply memberData updates ...

// After update, check if NRP changed:
if (memberData.nrp !== undefined && memberData.nrp !== oldMember.nrp) {
  const newNrp = memberData.nrp.trim();
  const oldNrp = oldMember.nrp;

  // 1. Update User email
  if (oldMember.userAccount) {
    await tx.user.update({
      where: { id: oldMember.userAccount.id },
      data: {
        email: `${newNrp}@koperasi.local`,
        password: await bcrypt.hash(newNrp, 10),  // reset password to new NRP
      }
    });
  }

  // 2. Sync memberNo if it was equal to old NRP
  if (oldMember.memberNo === oldNrp) {
    memberData.memberNo = newNrp;
  }

  // 3. Audit log
  await logAudit({
    action: "NRP_CHANGED",
    userId: session.user.id,
    targetId: id,
    targetType: "member",
    details: { oldNrp, newNrp, credentialReset: true }
  });
}
```

### C2. UI Confirmation Dialog for NRP Edit

**In edit page** (`/anggota/[id]/edit/page.tsx`):

When user changes NRP field and clicks "Simpan":

```
Dialog: "Perubahan NRP Terdeteksi"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NRP akan berubah dari "83111012" menjadi "83111013".

Perubahan ini akan:
• Reset password login member ke NRP baru
• Update username login ke NRP baru
• Member harus login ulang dengan NRP baru

Lanjutkan?  [Batal] [Ya, Ubah NRP]
```

### C3. Password Default Clarification

**Current inconsistency:**
- Manual create: password = `"anggota123"`
- Import: password = `nrp`
- Reset password: resets to `member.nrp || member.memberNo`

**Decision:** After NRP edit, password is reset to the new NRP value. This is consistent with the import flow and reset-password behavior.

### C4. Historical Data (No Backfill)

These fields store NRP as **denormalized snapshots** and will NOT be updated:
- `PayrollSlip.nrp` — historical payroll data
- `BillingItem.memberNrp` — billing snapshot
- `UnitTransaction.securityHash` — tamper-proof integrity hash

These are intentional historical records. Changing them would compromise audit integrity.

---

## File Changes Summary

### Modified Files

| File | Changes |
|------|---------|
| `src/app/api/loans/[id]/route.ts` | Fix 7 bugs: rounding, date helper, audit trail, remove notes, role fix |
| `src/app/api/members/[id]/route.ts` | Enhanced NRP sync on edit + enhanced delete checks |
| `src/app/(protected)/pinjaman/[id]/page.tsx` | Role gate fix, edit dialog copy fix |
| `src/app/(protected)/anggota/[id]/edit/page.tsx` | NRP change confirmation dialog |
| `src/app/(protected)/anggota/page.tsx` | Link to duplicate management |

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/members/duplicates/route.ts` | GET — duplicate detection API |
| `src/app/api/members/merge/route.ts` | POST — merge two members API |
| `src/app/(protected)/anggota/kelola/page.tsx` | Duplicate management UI page |

### New Helper

| File | Purpose |
|------|---------|
| `src/lib/date-helpers.ts` | `addMonths()` helper for safe month arithmetic |
