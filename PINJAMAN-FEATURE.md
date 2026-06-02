# Modul PINJAMAN — Fitur & Bug Fix Log

> Branch: `railway-migration` | Updated: 2 Juni 2026
> Total fitur: 24 | Total bug fix: 55

---

## 1. Fitur Utama

| ID | Fitur | Tanggal | Deskripsi |
|---|---|---|---|
| FEAT-020 | Produk Reguler & Khusus | 7 Apr | 2 jenis produk (PR/PK) dengan kartu UI, limit per produk, simulasi rinci |
| FEAT-021 | Seed Produk Pinjaman | 8 Apr | PR (0–20jt, 1–36bln, 1%/bln, resiko 2%), PK (30jt–∞, 1–60bln) |
| FEAT-022 | Otomasi Bayar Angsuran | 19 Apr | Auto-read jadwal berikutnya, rincian pokok & bunga, alokasi prioritas |
| FEAT-023 | Integrasi Kas/Bank Angsuran | 19 Apr | Auto-create 2 CashBankTransaction (angsuran_pokok + jasa_pinjaman), saldo ter-update |
| FEAT-024 | Edit Pinjaman (CRUD) | 19 Apr | Edit pokok/tenor/bunga/tanggal/catatan untuk pinjaman aktif tanpa riwayat bayar |
| FEAT-025 | Pelunasan Dipercepat | 21 Apr | Penalti otomatis (1x/2x bunga), toggle diskon bunga, 3 mutasi kas |
| FEAT-TAGIHAN-001 | Delete Draft Billing | 17 Mei | Operator hapus draft billing period sebelum di-proses |
| FEAT-TAGIHAN-002 | Custom Date Range Tagihan | 18 Mei | Date picker start/end saat generate billing |
| FEAT-TAGIHAN-003 | Portal Faktur Anggota | 18 Mei | `/portal/faktur` — expandable cards, Lunas/Menunggu badge, cetak A4 |
| FEAT-TAGIHAN-004 | Export Piutang PDF | 18 Mei | A4 professional: kop surat, info grid, detail table |
| FEAT-TAGIHAN-005 | Export Piutang Excel | 18 Mei | 3 sheets: Detail Anggota, Ringkasan Unit, Rekap Anggota |
| FEAT-TAGIHAN-006 | Mobile Responsive Tagihan | 18 Mei | Progressive column hide, icon-only buttons |
| FEAT-MEMBER-001 | Salary Fields Tambah Anggota | 17 Mei | Gaji, Tunles, Sisa Gaji, Plafon Piutang di form tambah |
| FEAT-MEMBER-002 | Duplicate Detection API | 17 Mei | `GET /api/members/duplicates` — group by normalized name + NRP |
| FEAT-MEMBER-003 | Member Merge API | 17 Mei | `POST /api/members/merge` — reassign 13 jenis child records, soft-delete |
| FEAT-MEMBER-004 | Enhanced Member Delete | 17 Mei | 4 validasi (loans, savings, billing, unit tx) + soft delete |
| FEAT-MEMBER-005 | Edit NRP + Credential Sync | 17 Mei | Update email, reset password, sync memberNo |
| FEAT-MEMBER-006 | Duplicate Management UI | 17 Mei | `/anggota/kelola` — side-by-side, merge/hapus |
| FEAT-MEMBER-007 | Edit Detail Anggota | 17 Mei | Full edit: keuangan, klasifikasi, kontak, identitas |
| FEAT-VOID-PAYMENT | Void Angsuran Individual | 30 Mei | Batalkan 1 pembayaran spesifik, atomic reversal CB/schedule/loan |

---

## 2. Bug Fixes — Pra-UAT & Stabilitas (Apr 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| BUG-001 | HIGH | Detail pinjaman hardcoded | Hubungkan ke real API by `id` |
| BUG-005 | MEDIUM | Kolom "Angsuran Ke" selalu 0 untuk import | Logika 3 tahap: schedule → principalPaid → clamp |
| BUG-008 | HIGH | Limit 20jt tidak dikunci | Refactor ke dynamic limit dari LoanProduct |
| BUG-013 | HIGH | Laporan pinjaman kosong | Generate 7.811 LoanSchedule dari 278 pinjaman |
| BUG-042 | MEDIUM | Portal simpan/pinjam blank | Hapus `force-dynamic` yang memicu 401 |
| BUG-066 | HIGH | `createdById` hardcode = 1 | Pakai user ID dari session |
| BUG-067 | HIGH | Validasi AD-ART blokir PK > 20jt | Hapus validasi statis, ganti dari LoanProduct |
| BUG-068 | MEDIUM | API produk hardcode bunga & resiko | Hapus hardcode |
| BUG-069 | HIGH | Mobile API hardcode rate & cap | Hapus pembatasan global |
| BUG-070 | HIGH | Portal API hardcode limit | Hapus AD-ART limit |
| BUG-071 | MEDIUM | Master API blokir tenor > 36 | Hapus pembatasan |
| BUG-072 | MEDIUM | Portal field mismatch (`minTenorMonths` vs `minTenor`) | Align field names |
| BUG-074 | MEDIUM | Dashboard "Pencairan" tampilkan penarikan simpanan | Fix query ke loan disbursements |
| BUG-075 | MEDIUM | Void build error (NextAuth v5 import) | Fix import `auth()` |
| BUG-UAT-002 | MEDIUM | Dashboard Total Pinjaman Rp 0 | Fix parsing response |
| BUG-UAT-004 | MEDIUM | Pengajuan list kosong | Fix `response.data.data` parsing |
| BUG-UAT-005 | LOW | Tenor "undefined bulan" | Fix accessor `tenor` vs `tenorMonths` |

---

## 3. Bug Fixes — Angsuran & Payment (Apr 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| ANGSURAN-001 | 🔴 CRITICAL | ID pinjaman tidak muncul di bayar angsuran | Fix query param: `loan_id` vs `loanId` mismatch |
| ANGSURAN-002 | 🔴 CRITICAL | "Failed to create payment" (500) | Fix: `createdById` dari session + `generatePaymentNo()` retry with uniqueness check |
| ANGSURAN-003 | 🟠 HIGH | Bayar angsuran tidak tercatat di buku kas | Auto-create 2 CashBankTransaction (angsuran_pokok + jasa_pinjaman) |
| ANGSURAN-004 | 🔴 CRITICAL | Saldo kas tidak ter-update (non-atomic) | Refactor ke `prisma.$transaction()` (all-or-nothing) |
| ANGSURAN-005 | MEDIUM | Tombol Edit tidak muncul untuk admin | Fix role check (hapus `superadmin` dead code) |
| ANGSURAN-006 | HIGH | Edit/VOID tidak muncul untuk pinjaman migrasi | Hapus `totalPaid > 0` guard — hanya cek `payments.length` |

---

## 4. Bug Fixes — Import Data (Mei 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| IMPORT-001 | HIGH | Import tidak potong 2% biaya resiko | Hitung `adminFee = principalAmount × 0.02` |
| IMPORT-002 | HIGH | `principalPaid` dan `interestPaid` salah | Fix: `principalPaid = pinjam - sisa`, `interestPaid = jumlah - principalPaid` |
| IMPORT-003 | HIGH | Laporan jasa gagal (auth type mismatch) | Fix `session.user.role` dari object → string |
| IMPORT-004 | MEDIUM | "Angsuran Ke" salah hitung | Bagi oleh porsi pokok/tenor, bukan monthlyInstallment |
| IMPORT-005 | LOW | Bunga/bulan hardcode 1% | Pakai `loan.interestRate` |
| IMPORT-006 | 🔴 CRITICAL | Import tidak generate LoanSchedule → semua dianggap lunas | Tambah schedule generation + `POST /api/loans/generate-schedules` |
| IMPORT-007 | HIGH | `interestPaid` selalu 0 (JUMLAH = pokok, bukan total) | Fix: `interestPaid = paidCount × JASA` |
| IMPORT-008 | 🔴 CRITICAL | 117/293 baris hilang saat import (silent failure) | 6 fix: auth outside tx, unique ID generator, separate counts, timeout 30s, sequential execution |

---

## 5. Bug Fixes — Loan Audit & Edit Tenor (Mei 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| AUDIT-001 | 🔴 CRITICAL | `monthlyInstallment` divergence import vs schedule | Uniform formula `Math.floor(pinjam/selama) + jasa` |
| AUDIT-002 | 🔴 CRITICAL | Import UPDATE tidak sync semua field | Update semua field + regenerasi LoanSchedule |
| AUDIT-003 | IMPORTANT | Jadwal regenerasi tanpa `paidDate` | Set `paidDate: dueDate` untuk schedule "paid" |
| AUDIT-004 | IMPORTANT | `paidInstallments` formula tidak akurat | Pre-fetch via `loanSchedule.groupBy()`, formula sebagai fallback |
| AUDIT-005 | IMPORTANT | Bayar angsuran tidak hitung `lateFee` | Tambah `lateFeeDue` ke `calcScheduleDue()` |
| AUDIT-006 | LOW | Console error "Failed to fetch" | Silent ignore AbortError/TypeError |
| EDIT-001 | 🔴 CRITICAL | `paidInstallmentCount` rounding error | `Math.floor(newPrincipalPaid / monthlyPrincipal)` + remainder |
| EDIT-002 | HIGH | JS Date `setMonth()` overflow | Helper `addMonths()` di `src/lib/date-helpers.ts` |
| EDIT-003 | MEDIUM | Role inconsistency (admin_sp) | Permission-based gate (`manage_all`) |
| EDIT-004 | LOW | Misleading "Riwayat Pembayaran" message | Update copy |
| EDIT-005 | LOW | Field `notes` silently discarded | Hapus dari accepted body |
| EDIT-006 | HIGH | Missing audit trail on loan edit | `logAuditFromRequest()` + before/after values |
| EDIT-007 | LOW | Import bypass payment guard | Inline comment (by design) |

---

## 6. Bug Fixes — Void Pinjaman (Mei 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| VOID-001 | 🔴 CRITICAL | Reversal pencairan selalu gagal (silent) | Lookup via `findFirst({ referenceType: "Loan" })` bukan `findUnique(id)` |
| VOID-002 | HIGH | Payment reversal over-decrement saldo | Sum actual CB amounts via `calcPaymentReversalAmount()` |
| VOID-003 | MEDIUM | Transaction timeout 5 detik | Explicit `{ timeout: 30000 }` |
| VOID-004 | LOW | Kompen reversal race condition (2 roundtrip) | Single update via `buildKompenReversalUpdate()` |
| VOID-005 | INFO | Operator tidak tahu apa yang di-reverse | Detail response via `buildVoidResponse()` |
| VOID-006 | HIGH | Tombol VOID disabled setelah ketik "VOID" | `.toUpperCase()` pada onChange |
| VOID-007 | MEDIUM | Badge "Aktif" untuk pinjaman voided | Tambah `voided` ke LOAN_STATUS map |

---

## 7. Bug Fixes — Kas/Bank & Billing (Mei 2026)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| KASBANK-1 | 🔴 CRITICAL | Mobile loan payment field name salah (`cashBankAccountId` → `accountId`) | `buildCashBankTransactionData()` helper |
| KASBANK-2 | HIGH | Mobile balance tracking non-atomic | Running balance pattern |
| KASBANK-3 | MEDIUM | Mobile kompen hardcoded KAS-002 | `resolveCashBankAccount()` helper |
| KASBANK-4 | MEDIUM | Mobile direct disburse silent skip | Throw error jika tidak ada akun kas |
| KASBANK-5 | HIGH | Web kompen tanpa dropdown kas/bank | Tambah dropdown + validasi wajib |
| KASBANK-6 | MEDIUM | Web kompen inline fetch race condition | Pakai state `selectedCashBankId` |
| TAGIHAN-1 | HIGH | DELETE tidak reverse `isPaid` untuk partial-settle draft | Cek `billingItems.some(isMarkedPaid)` |
| TAGIHAN-2 | MEDIUM | `totalMembers` hitung item, bukan unique member | `new Set(items.map(i => i.memberId)).size` |
| TAGIHAN-3 | HIGH | Partial settle overwrite total (bukan kumulatif) | Re-query semua paid items |
| TAGIHAN-4 | 🔴 CRITICAL | GET billing tanpa permission check | Tambah `manage_all` check |
| TAGIHAN-5 | MEDIUM | Tidak ada indikator visual settled member | Badge "Lunas" + sorting + opacity |

---

## 8. Key Technical Patterns

### Atomic Transaction Pattern
```typescript
// Semua operasi keuangan HARUS dalam $transaction
await prisma.$transaction(async (tx) => {
    await tx.loanPayment.create({...});
    await tx.loanSchedule.update({...});
    await tx.cashBankTransaction.create({...});
    await tx.cashBankAccount.update({...}); // guaranteed rollback on failure
}, { timeout: 30000 });
```

### Running Balance Pattern
```typescript
// BUKAN { increment: amount } — rentan race condition
const lastTx = await tx.cashBankTransaction.findFirst({ orderBy: [{ id: 'desc' }] });
const balanceBefore = lastTx ? Number(lastTx.balanceAfter) : 0;
const balanceAfter = balanceBefore + amount;
await tx.cashBankTransaction.create({ data: { balanceBefore, balanceAfter, ... } });
await tx.cashBankAccount.update({ data: { currentBalance: balanceAfter } });
```

### Void Angsuran Flow (Atomic, 30s timeout)
1. Rollback LoanSchedule (kurangi paid amounts, revert status)
2. [Early Settlement] Revert unallocated schedules
3. Fetch CB transactions linked to payment
4. Calculate reversal amount (sum actual CB, bukan payment.amount)
5. Decrement CashBankAccount.currentBalance
6. Delete CB records + LoanPaymentAllocation
7. Soft-void LoanPayment (status → "voided")
8. Update Loan counters (paid, outstanding)
9. [Early Settlement] Reactivate loan if needed

---

## 9. Key Source Files

| File | Fungsi |
|------|--------|
| `src/app/api/loans/[id]/payments/route.ts` | Bayar angsuran — atomic CB integration |
| `src/app/api/loans/[id]/payments/[paymentId]/void/route.ts` | Void individual payment |
| `src/app/api/loans/[id]/void/route.ts` | VOID seluruh pinjaman |
| `src/app/api/loans/[id]/route.ts` | CRUD pinjaman + edit tenor |
| `src/app/api/loans/import-update/route.ts` | Import pinjaman + schedule generation |
| `src/app/api/loans/import-migrasi/route.ts` | Import migrasi |
| `src/app/api/loans/generate-schedules/route.ts` | Migration: generate schedule untuk import lama |
| `src/app/api/loans/reports/interest/_lib/report-helpers.ts` | Laporan jasa helper |
| `src/app/api/billing/generate/route.ts` | Generate billing + custom dates |
| `src/app/api/billing/[periodId]/route.ts` | Billing CRUD + permission |
| `src/app/api/billing/[periodId]/process/route.ts` | Process/settle billing |
| `src/app/api/members/merge/route.ts` | Merge 2 anggota duplikat (13 child record types) |
| `src/app/api/members/duplicates/route.ts` | Deteksi duplikasi |
| `src/lib/loan-void-helpers.ts` | Void helpers (13 unit tests) |
| `src/lib/payment-void-helpers.ts` | Payment void helpers |
| `src/lib/kas-bank-loan-helpers.ts` | CB integration helpers (8 unit tests) |
| `src/lib/date-helpers.ts` | `addMonths()` — safe month arithmetic |
| `src/app/(protected)/pinjaman/[id]/page.tsx` | Detail pinjaman + edit/void UI |
| `src/app/(protected)/pinjaman/angsuran/bayar/page.tsx` | Bayar angsuran + kas/bank dropdown |
| `src/app/(protected)/tagihan/page.tsx` | Billing management UI |
| `src/app/portal/faktur/page.tsx` | Member portal faktur |
| `src/lib/export-utils.ts` | PDF + Excel export (piutang, kwitansi) |

---

## 10. Test Accounts (Production)

| Email | Password | Role |
|-------|----------|------|
| `operator@koperasi.com` | `password123` | operator (manage_all) |
| `admintoko@koperasi.com` | `password123` | admin (toko) |

*Diperbarui: 2 Juni 2026*
