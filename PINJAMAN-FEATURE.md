# Rekapitulasi Bug dan Fitur Baru: Modul PINJAMAN

Dokumen ini merangkum semua pembaruan (update) dan perbaikan bug (bug fix) yang berkaitan dengan fitur PINJAMAN dari log sistem.

## Fitur Baru (Features)

| ID | Fitur | Status | Tanggal | Deskripsi |
|---|---|---|---|---|
| **FEAT-020** | Produk Pinjaman Reguler & Khusus | ✅ IMPLEMENTED | 7 Apr 2026 | Implementasi lengkap 2 jenis produk pinjaman (Reguler & Khusus) dengan kartu pilihan UI, limit per produk, dan simulasi rinci. Menghapus hard-limit AD-ART global. |
| **FEAT-021** | Seed Data Produk Pinjaman Accurate | ✅ IMPLEMENTED | 8 Apr 2026 | Seed data produk pinjaman dengan aturan baru: PR (Min 0, Maks 20jt, 1-36 bln, 1%/bln, Resiko 2%), PK (Min 30jt, No Limit, 1-60 bln, 1%/bln, Resiko 2%). |
| **UAT-020** | Seed Produk Pinjaman ke Staging | ✅ SEEDED | 7 Apr 2026 | Uji coba pinjaman dengan data staging yang mencakup role Operator dan Anggota untuk End-to-End tes. |
| **FEAT-022** | Otomasi Pembayaran Angsuran | ✅ IMPLEMENTED | 19 Apr 2026 | Redesign halaman bayar angsuran dengan sistem membaca jadwal angsuran berikutnya secara otomatis, menampilkan rincian pokok & bunga, serta alokasi prioritas pembayaran secara otomatis. |
| **FEAT-023** | Integrasi Kas/Bank pada Angsuran | ✅ IMPLEMENTED | 19 Apr 2026 | Pembayaran angsuran pinjaman sekarang otomatis tercatat di buku kas/bank koperasi. Operator memilih akun Kas/Bank tujuan, lalu sistem membuat 2 CashBankTransaction: angsuran_pokok (kas masuk) dan jasa_pinjaman (kas masuk). Saldo kas otomatis ter-update. |
| **FEAT-024** | Edit Pinjaman (CRUD) | ✅ IMPLEMENTED | 19 Apr 2026 | Operator dapat mengedit data pinjaman (Pokok, Tenor, Suku Bunga, Tanggal Cair, Jatuh Tempo Pertama, Catatan) — hanya untuk pinjaman aktif tanpa riwayat pembayaran. Jadwal angsuran otomatis di-regenerasi. Dilengkapi live preview kalkulasi, validasi lengkap, dan error handling deskriptif. |
| **FEAT-025** | Pelunasan Dipercepat (Early Settlement) | ✅ IMPLEMENTED | 21 Apr 2026 | Operator dapat melunasi total pinjaman anggota sekaligus di halaman bayar angsuran. Dilengkapi kalkulasi penalti otomatis (1x bunga untuk tenor ≤ 24 bulan, 2x bunga untuk tenor > 24 bulan) dan fitur toggle untuk memotong (diskon) bunga yang belum jatuh tempo. Otomatis mencatat 3 mutasi kas (pokok, bunga, penalti_pelunasan). |

---

## Perbaikan Bug (Bug Fixes)

### Pra-UAT & Stabilitas Inti
- **BUG-001**: Halaman Detail Pinjaman Data Hardcoded. Dihapus total kode palsu, disambungkan ke real API berdasarkan `id`.
- **BUG-005**: Kolom Angsuran Ke- Selalu 0 untuk data import Excel. Diperbaiki dengan logika 3 tahap (schedule -> principalPaid/installment -> clamp ke tenor).
- **BUG-008**: Limit Pinjaman 20 Juta Tidak Dikunci. Hardcoded max 20 juta dan 36 bulan di level API (telah di refactor ulang pada FEAT-020).
- **BUG-013**: Laporan Pinjaman & Jadwal Kosong. Generate 7.811 `LoanSchedule` dari 278 pinjaman aktif; fix double-wrapping Axios.
- **BUG-042**: Portal Simpan/Pinjam Anggota Blank karena `dynamic = "force-dynamic"` memicu 401. Hapus directives server-side.

### Masalah Konfigurasi & Hak Akses
- **BUG-066**: `createdById`/`approvedById` Hardcode = 1 di Semua Loan Routes. Semua endpoint menggunakan user ID dari session.
- **BUG-067**: Validasi Hardcode AD-ART Memblokir Pinjaman Khusus > 20jt. Dihapuskan validasi statis dan diganti validasi dinamis dari `LoanProduct`.

### Kegagalan Validasi & Endpoint API (Sesi 9 - 8 April 2026)
- **BUG-068**: API `/api/loans/products` hardcode bunga & resiko. Menimpa data db dengan hardcode telah dihapus.
- **BUG-069**: API Mobile `/api/mobile/loan-apply` hardcode rate & cap global 20jt/36bln. Dihapus pembatasan global.
- **BUG-070**: API Portal `/api/member-portal/loan-application` hardcode AD-ART limit yang memblokir pinjaman khusus.
- **BUG-071**: API Master `/api/master/loan-products` POST memblokir pembuatan tenor > 36 bulan (Pinjaman Khusus).
- **BUG-072**: Portal Pengajuan Pinjaman: Produk tidak tampil & Field mismatch (`minTenorMonths` vs `minTenor`).
- **[FIX]**: Update Produk Pinjaman Gagal Tersimpan. Mengubah LIMIT, Tenor, dan Admin Fee gagal dari UI `/master/produk-pinjaman`. Parameter PUT endpoint diperbaiki.
- **BUG-075**: Void Pinjaman Build Error karena import `getServerSession` dan `authOptions` yang sudah usang di NextAuth v5.

### Anomali UI & Dashboard UAT
- **BUG-UAT-002**: Dashboard Operator: Total Pinjaman Aktif Rp 0 padahal ada pinjaman dengan status `approved`.
- **BUG-UAT-004**: Pengajuan Pinjaman List Selalu Kosong karena bug di parsing `response.data.data`.
- **BUG-UAT-005**: Pengajuan Pinjaman — Kolom Tenor "undefined bulan" karena perbedaan accessor `tenor` vs `tenorMonths`.
- **BUG-074**: Data "Pencairan Hari Ini" di Dashboard menampilkan nominal penarikan simpanan, bukan pencairan pinjaman (`todayLoanDisbursements`).

### Lain-lain
- **FIX-DATA-001**: Pelunasan Manual Pinjaman via Database Script (SUGESTI) karena dana masuk di Bank Jatim.

---

## 🔴 BUG BARU DITEMUKAN — 18 April 2026

### BUG-ANGSURAN-001 — ID Pinjaman Tidak Muncul di Halaman Bayar Angsuran

**Tanggal Ditemukan:** 18 April 2026
**Status:** ✅ FIXED
**Severity:** Critical (Fitur pembayaran angsuran tidak bisa digunakan sama sekali)
**URL Terdampak:** `https://www.primkoppol.online/pinjaman/angsuran/bayar?loan_id=2384`

**Gejala:**
Saat operator memilih pinjaman dari halaman `/pinjaman/angsuran` lalu mengklik tombol "Lanjut ke Proses Pembayaran", halaman bayar (`/pinjaman/angsuran/bayar`) terbuka namun **field "ID Pinjaman" selalu kosong**. Akibatnya pembayaran tidak bisa diproses karena validasi `if (!loanId)` selalu gagal.

**Root Cause — Mismatch Query Parameter Key:**
Halaman sumber (`angsuran/page.tsx` baris 211) men-generate URL dengan format **underscore**:
```tsx
<Link href={`/pinjaman/angsuran/bayar?loan_id=${selectedLoan.id}`}>
//                                     ^^^^^^^^^
//                                     Mengirim: loan_id (underscore)
```

Namun halaman tujuan (`angsuran/bayar/page.tsx` baris 16) membaca parameter dengan format **camelCase**:
```typescript
const loanId = searchParams.get("loanId");
//                                ^^^^^^
//                                Membaca: loanId (camelCase) → TIDAK COCOK → null
```

Karena `searchParams.get()` bersifat **case-sensitive** dan **exact match**, key `"loanId"` tidak pernah cocok dengan `"loan_id"` di URL. Hasilnya selalu `null`.

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/angsuran/bayar/page.tsx` (baris 16)

**Solusi:**
```diff
- const loanId = searchParams.get("loanId");
+ const loanId = searchParams.get("loan_id") || searchParams.get("loanId");
```
Kini halaman mendukung kedua format parameter (`loan_id` maupun `loanId`) sehingga backward-compatible dan pasti menangkap ID dari URL yang dikirim halaman angsuran.

---

## 🔴 BUG BARU DITEMUKAN — 19 April 2026

### BUG-ANGSURAN-002 — "Failed to create payment" saat Bayar Angsuran

**Tanggal Ditemukan:** 19 April 2026
**Status:** ✅ FIXED
**Severity:** Critical (Pembayaran angsuran selalu gagal, error 500)
**URL Terdampak:** `https://www.primkoppol.online/pinjaman/angsuran/bayar?loan_id=2475`

**Gejala:**
Saat operator mengklik "Konfirmasi Bayar" pada halaman bayar angsuran, muncul error **"Failed to create payment"** (HTTP 500). Tidak ada pembayaran yang tercatat di database.

**Root Cause — 2 Masalah Kritis:**

#### 1. `createdById` Hardcoded = 1 (FK Constraint Violation)

File `src/app/api/loans/[id]/payments/route.ts` baris 135:
```typescript
createdById: 1, // TODO: Get from session
```

Route API pembayaran **tidak mengimpor modul auth** dan **tidak membaca session** sama sekali. Field `createdById` di-hardcode ke `1`. Jika User dengan ID 1 tidak ada di database produksi, Prisma akan melempar **foreign key constraint violation** ke tabel `users`.

**Catatan:** Bug ini identik dengan BUG-066 yang sebelumnya sudah diperbaiki di route lain, namun route `POST /api/loans/[id]/payments` **terlewat** karena di-redesign ulang pada FEAT-022 (19 April 2026).

#### 2. `paymentNo` Rawan Collision (Unique Constraint Violation)

```typescript
function generatePaymentNo(): string {
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `PAY-${year}-${random}`;
}
```

Generator hanya menghasilkan **100.000 kemungkinan** per tahun (`00000`–`99999`). Di sistem produksi dengan ribuan pinjaman, probabilitas collision (duplikat) meningkat signifikan sesuai Birthday Paradox. Prisma melempar **unique constraint error** saat `paymentNo` duplikat.

**File yang Diperbaiki:**
- `src/app/api/loans/[id]/payments/route.ts`

**Solusi:**

```diff
+ import { auth } from "@/lib/auth";

- function generatePaymentNo(): string {
-     const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
-     return `PAY-${year}-${random}`;
- }
+ async function generatePaymentNo(): Promise<string> {
+     // Retry up to 5 times with 6-digit random (1.000.000 possibilities)
+     for (let i = 0; i < maxRetries; i++) {
+         const random = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
+         const paymentNo = `PAY-${year}-${random}`;
+         const exists = await prisma.loanPayment.findUnique({ where: { paymentNo } });
+         if (!exists) return paymentNo;
+     }
+     // Fallback: timestamp-based
+     return `PAY-${year}-${Date.now().toString().slice(-8)}`;
+ }

  // POST handler:
+ const session = await auth();
+ if (!session?.user) return 401;
+ const userId = Number(session.user.id);
  ...
- createdById: 1, // TODO: Get from session
+ createdById: userId,
```

---

### BUG-ANGSURAN-003 — Pembayaran Angsuran Tidak Tercatat di Buku Kas

**Tanggal Ditemukan:** 19 April 2026
**Status:** ✅ FIXED
**Severity:** High (Data akuntansi tidak lengkap — arus kas tidak tercatat)
**Dilaporkan:** "Bayar angsuran ini ga tercatat flow transaksi kas?"

**Gejala:**
Setelah operator berhasil membayar angsuran pinjaman, pembayaran tercatat di tabel `loan_payments` dan jadwal angsuran ter-update, namun **tidak ada catatan masuk di buku kas/bank koperasi** (`cash_bank_transactions`). Akibatnya:
- Laporan Buku Kas tidak mencerminkan penerimaan angsuran
- Saldo kas koperasi tidak ter-update
- Pendapatan jasa/bunga pinjaman tidak terlihat di alur kas

**Root Cause:**
API `POST /api/loans/[id]/payments` hanya membuat record `LoanPayment` dan memperbarui `LoanSchedule` + `Loan`, tetapi **sama sekali tidak membuat `CashBankTransaction`**.

Bandingkan dengan modul Simpanan (`POST /api/savings/transactions`) yang sudah benar — setelah membuat SavingsTransaction, juga membuat CashBankTransaction dan memperbarui saldo CashBankAccount.

**File yang Diperbaiki:**
- `src/app/api/loans/[id]/payments/route.ts` (API — tambah logika kas masuk)
- `src/app/(protected)/pinjaman/angsuran/bayar/page.tsx` (UI — tambah dropdown Kas/Bank)

**Solusi:**

#### 1. API — Auto-create CashBankTransaction
Setelah LoanPayment dibuat, jika `cashBankAccountId` dikirim dari frontend:
- Buat **2 record CashBankTransaction** (type: `"in"`):
  - `category: "angsuran_pokok"` → nominal pokok yang dibayar
  - `category: "jasa_pinjaman"` → nominal bunga/jasa yang dibayar
- Update saldo `CashBankAccount.currentBalance`

#### 2. Frontend — Tambah Dropdown Kas/Bank
- Fetch daftar akun Kas/Bank koperasi dari `/api/master/cash-bank`
- Filter hanya akun utama (bukan unit-spesifik atau SHU)
- Auto-select akun kas pertama
- Kirim `cashBankAccountId` dalam payload POST
- Tampilkan info akun terpilih di dialog konfirmasi

---

### BUG-ANGSURAN-004 — Saldo Kas Tidak Ter-update (Non-Atomic Transaction)

**Tanggal Ditemukan:** 19 April 2026
**Status:** ✅ FIXED
**Severity:** Critical (Saldo kas koperasi tidak sinkron dengan mutasi)
**Dilaporkan:** "saldo belum masuk ke kas, harusnya masuk ke saldo juga dan bukan sekedar mutasi transaksi"

**Gejala:**
Setelah pembayaran angsuran berhasil, record `CashBankTransaction` (mutasi) tercatat di database, tetapi **saldo `CashBankAccount.currentBalance` tidak berubah**. Artinya buku kas menunjukkan ada transaksi masuk, tapi saldo kas koperasi tetap sama.

**Root Cause:**
Seluruh operasi pembayaran (`LoanPayment.create` → `LoanSchedule.update` → `Loan.update` → `CashBankTransaction.create` → `CashBankAccount.update`) dijalankan sebagai **operasi Prisma terpisah (non-atomic)**, BUKAN di dalam `prisma.$transaction()`.

Jika salah satu operasi gagal di tengah (misalnya `CashBankTransaction.create` berhasil tapi `CashBankAccount.update` gagal karena timeout/race condition), data menjadi **inkonsisten**: mutasi tercatat, saldo tidak ter-update.

Berbeda dengan modul Simpanan (`savings/transactions/route.ts`) yang sudah menggunakan `prisma.$transaction(async (tx) => { ... })` — menjamin semua operasi **all-or-nothing** (rollback otomatis jika salah satu gagal).

**Solusi:**
Refactor seluruh flow pembayaran ke dalam satu `prisma.$transaction()`:

```typescript
// SEBELUM (non-atomic — BAHAYA)
const payment = await prisma.loanPayment.create({...});
await prisma.loanSchedule.update({...});        // operasi terpisah
await prisma.loan.update({...});                // operasi terpisah
await prisma.cashBankTransaction.create({...}); // operasi terpisah
await prisma.cashBankAccount.update({...});     // BISA GAGAL → saldo tidak update

// SESUDAH (atomic — AMAN)
const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.loanPayment.create({...});
    await tx.loanSchedule.update({...});          // dalam tx
    await tx.loan.update({...});                  // dalam tx
    await tx.cashBankTransaction.create({...});   // dalam tx
    await tx.cashBankAccount.update({...});       // DIJAMIN execute atau rollback
    return payment;
});
```

**File yang Diperbaiki:**
- `src/app/api/loans/[id]/payments/route.ts`

**Dampak:**
- ✅ Saldo kas/bank koperasi ter-update secara atomik bersama mutasi
- ✅ Jika salah satu operasi gagal, semua di-rollback (tidak ada data parsial)
- ✅ Konsisten dengan pola modul Simpanan

---

### BUG-ANGSURAN-005 — Tombol "Edit Pinjaman" Tidak Muncul untuk Role Admin

**Tanggal Ditemukan:** 19 April 2026
**Status:** ✅ FIXED
**Severity:** Medium (Admin tidak bisa mengedit pinjaman padahal memiliki permission `manage_pinjaman`)

**Gejala:**
Tombol "Edit Pinjaman" dan "Batalkan (VOID)" di halaman detail pinjaman hanya muncul untuk pengguna dengan role `operator`. Pengguna dengan role `admin` tidak melihat tombol tersebut.

**Root Cause:**
Pengecekan role di frontend dan backend menggunakan kondisi hardcode:
`const isOperator = ["operator", "superadmin"].includes(roleName);`
Role `superadmin` ternyata tidak ada di database (yang tertinggi adalah `operator`). Role `admin` yang seharusnya berhak mengedit pinjaman tidak dimasukkan ke dalam daftar yang diizinkan.

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/[id]/page.tsx` (Frontend Role Check)
- `src/app/api/loans/[id]/route.ts` (Backend Role Check)
- `src/app/api/loans/[id]/void/route.ts` (Backend Void Role Check)

**Solusi:**
Mengubah pengecekan role menjadi hanya mengizinkan `"operator"`, sementara admin (admin unit) tetap tidak bisa mengedit pinjaman koperasi. Teks `superadmin` yang tidak relevan juga dihapus dari kondisi pengecekan untuk menghindari kebingungan.

---

### BUG-ANGSURAN-006 — Tombol Edit/VOID Tidak Muncul untuk Pinjaman Migrasi

**Tanggal Ditemukan:** 19 April 2026
**Status:** ✅ FIXED
**Severity:** High (Pinjaman dari hasil import migrasi yang salah tidak bisa diedit karena dianggap sudah ada pembayaran)
**URL Terdampak:** `https://www.primkoppol.online/pinjaman/2468`

**Gejala:**
Pada halaman detail pinjaman (khususnya data hasil import), tombol Edit dan VOID tidak muncul untuk Operator, padahal tab Riwayat Pembayaran kosong.

**Root Cause:**
Logika `hasPayments` untuk menyembunyikan tombol Edit/VOID menggunakan 2 kondisi:
```javascript
const hasPayments = loan.payments.length > 0 || totalPaid > 0;
```
Pinjaman hasil migrasi seringkali memiliki nilai `principalPaid > 0` atau `interestPaid > 0` bawaan dari data lama (Excel), tetapi **TIDAK** memiliki record tabel `LoanPayment` di sistem baru. Kondisi `totalPaid > 0` membuat sistem mengunci pinjaman tersebut sehingga tidak bisa diedit. Padahal pinjaman inilah yang paling butuh diedit (koreksi data import).

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/[id]/page.tsx`
- `src/app/api/loans/[id]/route.ts`

**Solusi:**
Menghapus pengecekan `totalPaid > 0` (baik di frontend maupun backend). Tombol Edit/VOID sekarang **hanya** dikunci jika ada record pembayaran aktual di database (`loan.payments.length > 0` atau `loan._count.payments > 0`). Ini memungkinkan pinjaman migrasi yang datanya perlu dikoreksi untuk bisa diedit dengan bebas.

---

*Diperbarui: 19 April 2026*
*Total bug tercatat modul Pinjaman: 21 | Total fitur baru: 6*

---

## 🔴 BUG BARU DITEMUKAN — 4 Mei 2026 (Sesi Import Update Pinjaman)

### BUG-IMPORT-001 — Import Pinjaman Tidak Potong 2% Biaya Resiko

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** High (Data keuangan pinjaman tidak akurat)
**Dilaporkan:** "ini dana cairnya salah, harusnya kan kepotong 2% buat biaya resiko"

**Gejala:**
Semua pinjaman yang diimport via `import-update` dan `import-migrasi` menunjukkan `disbursedAmount = principalAmount` dan `adminFee = 0`. Padahal pada flow normal (disburse/direct-disburse), `disbursedAmount = principalAmount - 2%` dan `adminFee = principalAmount * 0.02`.

**Root Cause:**
Kedua route import meng-hardcode:
```typescript
adminFee: 0,
disbursedAmount: taskData.pinjam,  // atau data.principalAmount
```
Sedangkan flow normal menghitung:
```typescript
adminFee = Math.round(principalAmount * 0.02);
disbursedAmount = principalAmount - adminFee;
```

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (kedua loan creation block)
- `src/app/api/loans/import-migrasi/route.ts`

---

### BUG-IMPORT-002 — principalPaid dan interestPaid Salah di Import Update

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** High (Data pembayaran tidak akurat, mengganggu kalkulasi progress)

**Gejala:**
Field `principalPaid` pada loan yang diimport bernilai sama dengan kolom JUMLAH dari Excel, padahal JUMLAH = total uang masuk (pokok + bunga). Field `interestPaid` selalu 0, dan `interestOutstanding` selalu 0.

**Root Cause:**
```typescript
// SALAH — JUMLAH = total kas masuk, bukan hanya pokok
principalPaid: taskData.jumlah,  // seharusnya: pinjam - sisaSaldo
interestPaid: 0,                  // seharusnya: jumlah - principalPaid
interestOutstanding: 0,           // seharusnya: totalInterest - interestPaid
```

**Kalkulasi yang benar:**
- `principalPaid = pinjam - sisaSaldo` (pokok yang sudah dilunasi)
- `interestPaid = jumlah - principalPaid` (sisa dari total terbayar = bunga)
- `interestOutstanding = totalInterest - interestPaid` (bunga belum terbayar)

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (loan creation + loan update path)

---

### BUG-IMPORT-003 — Laporan Jasa Pinjaman Gagal Memuat (Auth Check Type Mismatch)

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** High (Halaman laporan jasa tidak bisa diakses)
**URL Terdampak:** `https://www.primkoppol.online/pinjaman/laporan-jasa`

**Gejala:**
Halaman Rekap Jasa Pinjaman selalu menampilkan "Gagal memuat data".

**Root Cause:**
Function `checkOperatorAuth()` di `report-helpers.ts` mengakses `session.user.role.name` (seolah role adalah object), padahal NextAuth setup menyimpan `session.user.role` langsung sebagai string `"operator"`.

```typescript
// SALAH
const s = session as { user?: { role?: { name?: string } } } | null;
const roleName = s.user?.role?.name;  // undefined karena role adalah string

// BENAR
const s = session as { user?: { role?: string } } | null;
const roleName = s.user?.role;  // "operator"
```

**File yang Diperbaiki:**
- `src/app/api/loans/reports/interest/_lib/report-helpers.ts`
- `src/app/(protected)/pinjaman/laporan-jasa/page.tsx` (improved error messages)

---

### BUG-IMPORT-004 — Kolom "Angsuran Ke" Salah Hitung untuk Pinjaman Import

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** Medium (Tampilan data tidak akurat di tabel pinjaman)

**Gejala:**
Kolom "Angsuran Ke" di tabel pinjaman menampilkan angka yang terlalu kecil. Contoh: EKO KRISDIANSYAH yang sudah bayar 15x ditampilkan sebagai 9.

**Root Cause:**
Kalkulasi fallback membagi `principalPaid / monthlyInstallment`:
- `monthlyInstallment` = pokok + bunga = 2,667,000
- Hasil: 25,005,000 / 2,667,000 = 9.4 → dibulatkan menjadi 9

Seharusnya membagi oleh porsi pokok per bulan:
- `principalAmount / tenorMonths` = 100,000,000 / 60 = 1,666,667
- Hasil: 25,005,000 / 1,666,667 = 15.0 → dibulatkan menjadi 15

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/page.tsx`

---

### BUG-IMPORT-005 — Bunga/Bulan Hardcode 1% di Tabel Pinjaman

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** Low (Tampilan tidak fleksibel)

**Gejala:**
Kolom "Bunga/Bulan" dan card "Potensi Bunga" selalu menghitung `plafond * 1%` terlepas dari interest rate aktual pinjaman.

**Root Cause:**
```typescript
// Hardcoded 1%
const interest = Math.round(plafond * 0.01);
```

Seharusnya menggunakan `interestRate` dari masing-masing pinjaman:
```typescript
const rate = Number(loan.interestRate || 1);
const interest = Math.round(plafond * (rate / 100));
```

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/page.tsx` (kolom tabel + card potensi bunga)

---

### BUG-IMPORT-006 — Import Pinjaman Tidak Generate LoanSchedule (Semua Pinjaman Dianggap Lunas)

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** Critical (Seluruh fitur pembayaran angsuran tidak bisa digunakan)
**URL Terdampak:** `https://www.primkoppol.online/pinjaman/angsuran`

**Gejala:**
Saat operator membuka halaman bayar angsuran untuk pinjaman hasil import, halaman langsung menampilkan "Pinjaman Sudah Lunas". Semua 275 pinjaman import tidak bisa dibayar angsurannya.

**Root Cause:**
Route import (`import-update` dan `import-migrasi`) **tidak membuat record `LoanSchedule`**. Halaman bayar angsuran (`angsuran/bayar/page.tsx`) bergantung pada `loan.schedules` untuk menentukan angsuran berikutnya:
```typescript
const pendingSchedules = loan.schedules
    .filter((s) => ["pending", "partial", "overdue"].includes(s.status));
if (pendingSchedules.length === 0) → tampilkan "Pinjaman Sudah Lunas"
```

Tanpa schedule records, `pendingSchedules` selalu kosong → semua pinjaman dianggap lunas.

**Verifikasi:**
- Total active loans: 276
- With schedules: 1 (hanya pinjaman manual)
- Without schedules: 275 (semua pinjaman import)

**Solusi 2-Layer:**

#### 1. One-Time Migration (existing data)
Script pembuatan jadwal untuk 275 pinjaman yang sudah diimport:
- Hitung `paidInstallments` dari `principalPaid / (principalAmount / tenorMonths)`
- Generate full schedule dengan status `"paid"` untuk angsuran yang sudah dibayar
- Status `"pending"` untuk angsuran yang belum dibayar

**Hasil:** 275 pinjaman × rata-rata 40 bulan = ~11,000 record `LoanSchedule` berhasil dibuat.

#### 2. Fix Import Route (future data)
Route `import-update/route.ts` sekarang juga generate `LoanSchedule` saat membuat loan baru:
- Setiap loan baru otomatis mendapat jadwal angsuran
- Installment yang sudah dibayar ditandai `"paid"` berdasarkan data Excel
- Endpoint `POST /api/loans/generate-schedules` tersedia sebagai fallback

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (tambah schedule generation di kedua loan creation block)
- `src/app/api/loans/generate-schedules/route.ts` (NEW — migration endpoint)

---

*Diperbarui: 4 Mei 2026*
*Total bug tercatat modul Pinjaman: 27 | Total fitur baru: 6*

---

### BUG-IMPORT-007 — Kalkulasi interestPaid dan interestOutstanding Salah (JUMLAH = Pokok, Bukan Total Kas)

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED (sebelum re-import)
**Severity:** High (Data bunga terbayar selalu 0, sisa bunga selalu = total bunga)

**Gejala:**
Setelah import, field `interestPaid` pada semua pinjaman selalu bernilai 0, dan `interestOutstanding` selalu sama dengan `totalInterest`. Padahal pinjaman sudah dibayar beberapa bulan dan bunga seharusnya tercatat.

**Root Cause:**
Kode menganggap kolom JUMLAH (Col 18) dari Excel = total kas masuk (pokok + bunga), sehingga:
```typescript
// SALAH — menganggap jumlah = total cash
principalPaid = pinjam - sisaSaldo;           // = 25,005,000 ✓
interestPaid = jumlah - principalPaid;         // = 25,005,000 - 25,005,000 = 0 ✗
```

**Fakta dari Excel:** Kolom JUMLAH (Col 18) = total **pokok** yang terbayar, BUKAN total kas masuk.
Terbukti dari 298 pinjaman: `JUMLAH = TOTAL × ANGSURAN` (pokok saja, tanpa bunga).

**Kalkulasi yang benar:**
```
paidCount     = round(JUMLAH / ANGSURAN)    // berapa kali angsuran sudah dibayar
principalPaid = JUMLAH                       // dari Excel langsung
interestPaid  = paidCount × JASA            // berapa bulan × bunga per bulan
```

**Contoh EKO KRISDIANSYAH:**
```
JUMLAH = 25,005,000  ANGSURAN = 1,667,000  JASA = 1,000,000  SELAMA = 60

paidCount     = round(25,005,000 / 1,667,000) = 15
principalPaid = 25,005,000                     ✓ (dari Excel)
interestPaid  = 15 × 1,000,000 = 15,000,000   ✓ (sebelumnya: 0)
interestOutstanding = 60,000,000 - 15,000,000 = 45,000,000 ✓
```

**Verifikasi:**
```
pokok terbayar + sisa pokok = 25,005,000 + 74,995,000 = 100,000,000 ✓ (= plafond)
bunga terbayar + sisa bunga = 15,000,000 + 45,000,000 = 60,000,000   ✓ (= total bunga)
```

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (loan creation × 2 + loan update path)

---

*Diperbarui: 4 Mei 2026*
*Total bug tercatat modul Pinjaman: 28 | Total fitur baru: 6*

---

## 🔴 BUG KRITIS DITEMUKAN — 4 Mei 2026 (Import Data Loss: 293 → 176)

### BUG-IMPORT-008 — 117 dari 293 Baris Pinjaman Hilang Saat Import (Silent Failure)

**Tanggal Ditemukan:** 4 Mei 2026
**Status:** ✅ FIXED
**Severity:** Critical (40% data pinjaman hilang tanpa pesan error)
**Dampak:** Import "293 valid" → hanya 176 masuk database, 117 baris lenyap tanpa error

**Gejala:**
Saat upload file Excel dan preview menunjukkan "293 import valid", setelah commit hanya 176 record tersimpan di database. API melaporkan "293 berhasil, 0 gagal" — semua terlihat sukses padahal 117 baris gagal.

**Root Cause — 6 Bug Berantai:**

#### 1. failCount Tidak Pernah Di-increment (Silent Failure)
`failCount` diinisialisasi `= 0` tapi **tidak pernah** di-increment di manapun. Semua error di catch block hanya `console.error` tanpa tracking. API selalu melaporkan `failed: 0`.

#### 2. successCount Di-increment SEBELUM Commit Berhasil
`successCount++` berjalan di preview loop (sebelum commit task dieksekusi), sehingga selalu = jumlah valid rows. Pada kenyataannya banyak task yang gagal di tahap commit.

#### 3. Date.now() Collision pada Unique Identifiers
`applicationNo`, `paymentNo`, dan `effectiveNrp` menggunakan `Date.now()` yang menghasilkan nilai sama ketika 10 task berjalan paralel via `Promise.all(batch=10)`. Unique constraint violation → transaction rollback → data hilang.

#### 4. Transaction Timeout Default 5 Detik
`prisma.$transaction()` tanpa opsi timeout menggunakan default Prisma 5 detik. Import yang kompleks (create member + user + loanApplication + loan + loanSchedules × 60 + loanPayments × 5) bisa melebihi 5 detik.

#### 5. auth() Dipanggil di Dalam Transaction Callback
`const session = await auth()` di dalam `$transaction(async (tx) => { ... })` bisa return `null` karena tidak stabil dalam konteks transaction. Akibatnya `adminId` = 1, dan jika user ID 1 tidak ada → FK violation.

#### 6. Promise.all(10) Menyebabkan Transaction Contention
Batch 10 task paralel menyebabkan database contention — banyak transaction bersaing untuk lock yang sama pada tabel yang sama, meningkatkan peluang deadlock dan timeout.

**Solusi Komprehensif:**

```typescript
// FIX #5: Auth check ONCE at top
const session = await auth();
if (!session?.user) return 401;
const adminId = Number(session.user.id);

// FIX #3: Request-scoped unique ID generator
let uidCounter = 0;
const uniqueId = (prefix) => `${prefix}-${Date.now()}-${++uidCounter}-${random}`;

// FIX #2: Separate validCount from commit-time successCount
let validCount = 0;    // preview loop
let successCount = 0;  // only after commit succeeds
let failCount = 0;     // FIX #1: now incremented in catch

// FIX #4: Transaction timeout
await prisma.$transaction(async (tx) => { ... }, { timeout: 30000 });

// FIX #1+#2: Count inside commit task
commitTasks.push(async () => {
    try {
        await prisma.$transaction(..., { timeout: 30000 });
        successCount++;  // AFTER commit
    } catch (err) {
        failCount++;     // NOW tracked
        results[idx].status = "failed";
        results[idx].reason = err.message;
    }
});

// FIX #6: Sequential execution instead of Promise.all
for (const task of commitTasks) {
    await task();
}
```

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (full rewrite preserving business logic)

**Hasil yang Diharapkan:**
- Preview: 293 valid → Commit: 293 success, 0 failed
- Jika ada yang gagal, `failCount` tercatat dan baris gagal ditandai di results
- `failed` rows menampilkan error reason untuk debugging

---

*Diperbarui: 4 Mei 2026*
*Total bug tercatat modul Pinjaman: 29 | Total fitur baru: 6*

---

## 🔴 BUG AUDIT MODULE — 17 Mei 2026 (Loan Audit 6 Fix + Billing Delete)

### BUG-AUDIT-001 — monthlyInstallment Divergence antara Import dan Jadwal Angsuran

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** CRITICAL (Cicilan per bulan berbeda antara field loan dan jadwal aktual)

**Gejala:**
Pinjaman hasil import menunjukkan `monthlyInstallment` berbeda dari total angsuran di `LoanSchedule`. Contoh NRP "83111012": `monthlyInstallment = 2.667.000` tapi jadwal menunjukkan `floor(100.000.000/60) + 1.000.000 = 2.666.667`. Selisih Rp 333 per bulan × 60 bulan = Rp 19.980 per pinjaman.

**Root Cause:**
Route import menghitung `monthlyInstallment = angsuran + jasa` (menggunakan `angsuran` dari Excel = `floor(pinjam/selama)`). Namun saat generate `LoanSchedule`, system menghitung `floor(pinjam/selama)` secara independen. Kedua rounding bisa berbeda jika Excel `angsuran` ≠ `Math.floor(pinjam/selama)`.

**Fix:**
Kedua creation path di `import-update/route.ts` sekarang menggunakan formula yang sama: `monthlyInstallment = Math.floor(pinjam / selama) + jasa`.

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (kedua loan creation block)

---

### BUG-AUDIT-002 — Import UPDATE Path Tidak Sinkronisasi Semua Field Pinjaman

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** CRITICAL (Pinjaman yang sudah ada tidak ter-update dengan data Excel terbaru)

**Gejala:**
Saat import update menemukan pinjaman yang sudah ada (match by NRP), hanya field `principalPaid`, `interestPaid`, `interestOutstanding`, `outstandingAmount` yang di-update. Field `principalAmount`, `tenorMonths`, `interestRate`, `monthlyInstallment`, dan `totalAmount` tetap menggunakan nilai lama.

**Root Cause:**
UPDATE path di `import-update/route.ts` hanya memperbarui paid/outstanding fields, bukan data utama pinjaman. Selain itu, `LoanSchedule` lama tidak di-regenerasi, menyebabkan jadwal tidak sesuai dengan data Excel terbaru.

**Fix:**
UPDATE path sekarang memperbarui SEMUA field pinjaman (principal, interest, tenor, rate, monthlyInstallment, totalAmount, disbursedAmount, adminFee) dan menghapus+regenerasi seluruh `LoanSchedule`.

**File yang Diperbaiki:**
- `src/app/api/loans/import-update/route.ts` (UPDATE path)

---

### BUG-AUDIT-003 — Jadwal Angsuran Regenerasi Tidak Menyertakan paidDate

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** IMPORTANT (Jadwal angsuran yang sudah dibayar tidak memiliki tanggal pembayaran)

**Gejala:**
Saat operator mengedit pinjaman (PUT `/api/loans/[id]`), jadwal angsuran di-regenerasi namun angsuran yang sudah dibayar (`status: "paid"`) tidak memiliki `paidDate`. Ini menyebabkan riwayat pembayaran tidak menampilkan kapan angsuran dibayar.

**Root Cause:**
PUT handler di `loans/[id]/route.ts` membuat schedule baru tanpa mengisi `paidDate`, `principalPaid`, dan `interestPaid` untuk angsuran yang sudah dibayar (status = paid).

**Fix:**
Regenerated schedules sekarang menyertakan `paidDate: dueDate`, `principalPaid`, `interestPaid` untuk angsuran yang sudah dibayar.

**File yang Diperbaiki:**
- `src/app/api/loans/[id]/route.ts` (PUT handler schedule generation)

---

### BUG-AUDIT-004 — paidInstallments Menggunakan Formula Tidak Akurat

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** IMPORTANT (Kolom "Angsuran Ke" di detail anggota menampilkan angka salah)

**Gejala:**
API `/api/members/[id]` menampilkan `paidInstallments` yang berbeda dari jumlah `LoanSchedule` berstatus "paid". Formula `Math.round(principalPaid / monthlyInstallment)` menghasilkan angka yang terlalu kecil karena `monthlyInstallment` = pokok + bunga, bukan hanya porsi pokok.

**Root Cause:**
Perhitungan paid installments membagi total pokok terbayar oleh cicilan bulanan (pokok+bunga), bukan oleh porsi pokok per bulan. Contoh: 25.005.000 / 2.667.000 = 9, padahal seharusnya 25.005.000 / 1.666.667 = 15.

**Fix:**
Pre-fetch paid schedule counts via `prisma.loanSchedule.groupBy()` sebelum mapping, gunakan schedule count sebagai sumber utama, formula hanya sebagai fallback.

**File yang Diperbaiki:**
- `src/app/api/members/[id]/route.ts` (paidInstallments calculation)

---

### BUG-AUDIT-005 — Bayar Angsuran Tidak Menghitung lateFee

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** IMPORTANT (Denda keterlambatan tidak termasuk di total tagihan angsuran)

**Gejala:**
Halaman bayar angsuran tidak menampilkan denda keterlambatan (`lateFee`) sebagai bagian dari total yang harus dibayar, meskipun field `lateFee` tersedia di model `LoanSchedule`.

**Root Cause:**
Function `calcScheduleDue()` di `angsuran/bayar/page.tsx` hanya menghitung `principalDue` dan `interestDue`, tanpa menyertakan `lateFee - lateFeePaid`.

**Fix:**
Menambahkan `lateFeeDue` ke interface `ScheduleDue` dan kalkulasi `totalDue = principalDue + interestDue + lateFeeDue`.

**File yang Diperbaiki:**
- `src/app/(protected)/pinjaman/angsuran/bayar/page.tsx` (calcScheduleDue function)

---

### BUG-AUDIT-006 — Console Error "Failed to fetch" pada NotificationBell dan signOut

**Tanggal Ditemukan:** 17 Mei 2026
**Status:** ✅ FIXED
**Severity:** Low (Error konsol yang tidak mempengaruhi fungsi, namun mengganggu debugging)

**Gejala:**
Next.js dev mode menampilkan TypeError "Failed to fetch" di console dari:
1. `NotificationBell` — polling `/api/notifications` setiap 30 detik
2. `signOut` di `use-auth.tsx` — NextAuth signOut gagal saat dev server restart

**Root Cause:**
Saat Next.js dev server hot-reload atau restart, request fetch yang sedang berjalan akan gagal dengan TypeError "Failed to fetch". Ini adalah expected behavior di dev mode, bukan bug di aplikasi.

**Fix:**
Error di-ignore secara silent (AbortError dan "Failed to fetch" TypeError), tanpa `console.error` yang mengganggu debugging.

**File yang Diperbaiki:**
- `src/components/patterns/notification-bell.tsx` (fetchNotifications, markAsRead, markAllRead)
- `src/lib/hooks/use-auth.tsx` (logout function)

---

## 🟢 FITUR BARU — Tagihan Piutang: Hapus Draft

### FEAT-TAGIHAN-001 — Delete Draft Billing Period

**Tanggal:** 17 Mei 2026
**Status:** ✅ IMPLEMENTED
**Severity:** Feature (Operator perlu bisa menghapus draft billing yang salah generate)

**Deskripsi:**
Operator dapat menghapus draft billing period yang sudah di-generate (sebelum di-proses), sehingga bisa generate ulang untuk periode yang sama. Endpoint `DELETE /api/billing/[periodId]` hanya mengizinkan penghapusan period dengan status "draft". UI menambahkan tombol merah "Hapus Draft" di halaman `/tagihan`.

**File yang Diperbaiki:**
- `src/app/api/billing/[periodId]/route.ts` (DELETE handler)
- `src/app/(protected)/tagihan/page.tsx` (UI "Hapus Draft" button)

---

## 🟢 FITUR BARU — Member Management Enhancement

### FEAT-MEMBER-001 — Salary Fields pada Form Tambah Anggota

**Tanggal:** 17 Mei 2026
**Status:** ✅ IMPLEMENTED
**Deskripsi:**
Form "Tambah Anggota Baru" (`/anggota/tambah`) sekarang menyertakan section "Setoran Bulanan (Gaji & Tabungan)" dengan 4 field: Gaji Bersih, Tunles/Tunkin, Sisa Gaji, dan Plafon Piutang. Sebelumnya field ini hanya bisa diisi melalui Edit Anggota atau Import Gaji.

**File yang Diperbaiki:**
- `src/app/(protected)/anggota/tambah/page.tsx`

---

*Diperbarui: 17 Mei 2026*
*Total bug tercatat modul Pinjaman: 35 | Total fitur baru: 8*
