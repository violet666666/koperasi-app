# Rekapitulasi Bug dan Fitur Baru: Modul PINJAMAN

Dokumen ini merangkum semua pembaruan (update) dan perbaikan bug (bug fix) yang berkaitan dengan fitur PINJAMAN dari log sistem.

## Fitur Baru (Features)

| ID | Fitur | Status | Tanggal | Deskripsi |
|---|---|---|---|---|
| **FEAT-020** | Produk Pinjaman Reguler & Khusus | ✅ IMPLEMENTED | 7 Apr 2026 | Implementasi lengkap 2 jenis produk pinjaman (Reguler & Khusus) dengan kartu pilihan UI, limit per produk, dan simulasi rinci. Menghapus hard-limit AD-ART global. |
| **FEAT-021** | Seed Data Produk Pinjaman Accurate | ✅ IMPLEMENTED | 8 Apr 2026 | Seed data produk pinjaman dengan aturan baru: PR (Min 0, Maks 20jt, 1-36 bln, 1%/bln, Resiko 2%), PK (Min 30jt, No Limit, 1-60 bln, 1%/bln, Resiko 2%). |
| **UAT-020** | Seed Produk Pinjaman ke Staging | ✅ SEEDED | 7 Apr 2026 | Uji coba pinjaman dengan data staging yang mencakup role Operator dan Anggota untuk End-to-End tes. |

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

*Diperbarui: 18 April 2026*
*Total bug tercatat modul Pinjaman: 16 | Total fitur baru: 3*
