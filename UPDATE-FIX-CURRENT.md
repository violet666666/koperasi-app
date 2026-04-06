# Catatan Update Aplikasi

## UPDATE 06 April 2026 — Sesi 4: Riwayat Transaksi — Plat Nomor + Print Filter-Aware

### [FIX] Kolom Plat Nomor di Riwayat Transaksi Unit

**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`

- Sebelum: kolom "Plat Nomor" tidak ada sama sekali di tabel riwayat
- Sesudah: kolom baru dengan badge 🚗 menampilkan plat nomor hasil parse dari field `notes` format `[PLAT:N 1234 ABC]`
- Kolom juga masuk ke export Excel/PDF via `txExportColumns`
- Baris yang tidak punya plat nomor (non-cuci-mobil) tetap menampilkan `-` dengan elegan

### [FIX] Print / Export Tidak Mengikuti Filter Aktif

**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`

- Sebelum: tombol Excel, PDF menggunakan `response?.data` (semua data mentah, tanpa filter)
- Sesudah: semua ekspor menggunakan `filteredData` (sudah difilter berdasarkan tanggal, unit, dan status)
- Tombol **Cetak** baru (browser print) menampilkan popup print dengan format proper:
  - Header PRIMKOPPOL RESOR LUMAJANG + logo
  - Info filter aktif (Periode, Unit, Status, Jumlah transaksi)
  - Tabel dengan kolom: No.Transaksi, Tanggal, Anggota, Unit, **Plat Nomor**, Keterangan, Nominal, Status
  - Row total di footer
  - Cetak hanya menampilkan data yang sesuai filter saat diklik

---

## UPDATE 06 April 2026 — Sesi 3: Logic Fix + UAT Contamination Cleanup

**Build ID:** `scGTYRRp9yKVIYCWccSA5` — ✅ Deploy Ready

### [CRITICAL] Cleanup Data UAT di Production

- Ditemukan 1 `ApprovalRequest` UAT di database production (Neon)
- Root cause: Sesi UAT tanggal 5 April dijalankan di server production (port 3000, env Neon) — sebelum staging Supabase disiapkan
- Data terhapus: `VD-TOKO-1775417610387-BLS` approval + reset flag `voidPending` di `TK-20260406-MNM5Q5XI`
- Protocol UAT baru ditetapkan: wajib jalankan server staging port 3001 dengan `.env.test.local`

### [FIX] BUG-LOGIC-001 — No. Referensi Approval Diperbaiki

- Sebelum: generate random `VD-TOKO-1775417610387-BLS` tidak terhubung ke No. Transaksi
- Sesudah: format `VOID-{No.Transaksi}` → contoh: `VOID-CM060420260001`
- Logic di `void-request/route.ts`: fungsi `generateVoidRequestNo(originalTxNo)` menggantikan generasi random

### [FIX] BUG-LOGIC-002 — Format No. Transaksi Diperbaiki

- Sebelum: `CUC-MNMKU4YG` — random base-36, tidak bisa dibaca, tidak ada tanggal
- Sesudah: `CM060420260001` = Singkatan + DDMMYYYY + Nomor Urut 4 digit per hari per unit
- Nomor urut di-query dari `COUNT` transaksi hari itu, sekuensial dan mudah audit
- Peta singkatan: CM (Cuci Mobil), BB (Barbershop), PS (PlayStation), FT (Fitness), dll

### [FIX] BUG-BUILD-005 — TS Error di Member Route

- Fix `session.user.role?.name` → `(session.user as any).role` karena `role` bertipe `string`

### [FEATURE] Kolom Anggota/Pelanggan di Tabel Inbox Approval

- Nama + NRP anggota kini terlihat langsung di tabel tanpa perlu buka panel detail
- Diambil dari `metadata.memberName` dan `metadata.memberNrp`

### [PROTOCOL UAT] Panduan Baru untuk Sesi UAT Berikutnya

```powershell
# WAJIB sebelum mulai UAT:
$env:DATABASE_URL = "postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
npm run dev -- -p 3001

# Verifikasi database yang aktif (bukan production):
#   URL harus mengandung: xlxrjlcnhvtvgkbmrfkm.supabase.co (BUKAN ep-blue-rain.neon.tech)
```

---

## UPDATE 06 April 2026 — Sesi 2: 5 Fitur Unit Baru + UAT PASS 7/7

**Kelompok fitur:** Laporan Unit, Pengeluaran Operasional, Detail Void, Plat Nomor POS, Search Anggota by Nama

### [FEAT-1] Laporan Transaksi Harian/Bulanan/Tahunan per Unit
- Buat halaman `/unit/[unitSlug]/laporan` dengan filter periode (Hari Ini / Minggu Ini / Bulan Ini / Tahun Ini / Kustom)
- Summary cards: Total Pendapatan, Pengeluaran Operasional, Laba Bersih, Jumlah Transaksi
- Breakdown metode pembayaran: Tunai / QRIS / Potong Gaji
- Tabel transaksi dengan badge plat nomor (khusus Cuci Mobil)
- **Print header center-aligned**: Logo PRIMKOPPOL + "PRIMKOPPOL RESOR LUMAJANG" + "UNIT [NAMA]" + Periode
- Tombol Export Excel
- Menu "LAPORAN & KEUANGAN" → "Laporan Transaksi" ditambahkan ke `adminUnitNavigation` & `adminTokoNavigation`

### [FEAT-2] Pencatatan Pengeluaran Operasional Unit
- Tombol "Catat Pengeluaran" (merah) di halaman laporan — hanya muncul untuk role Admin Unit
- Dialog form: Nominal, Keterangan, Tanggal
- Disimpan ke `CashBankTransaction` type `out`, category `operational` dengan tag `[UNIT_TYPE]`
- Langsung mendebit kas unit tanpa approval

### [FEAT-3] Detail Alasan Void di Inbox Approval
- `ApprovalDialog` dirombak ulang dengan panel khusus void:
  - Kotak amber **"ALASAN PEMBATALAN DARI KASIR"**
  - Detail: Kasir Pengaju, Unit, Anggota (+ NRP), Plat Kendaraan (jika ada), No. Transaksi Asli
- Interface `ApprovalItem.metadata` diperluas dengan semua field void

### [FEAT-4] Input Plat Nomor di POS Cuci Mobil
- Field "🚗 Plat Nomor Kendaraan" muncul kondisional hanya saat `unitType === "cuci_mobil"`
- Auto-uppercase input, limit 12 karakter
- Disimpan ke `UnitTransaction.notes` dengan format `[PLAT:N 1234 ABC]`
- Parse dan tampil sebagai badge di laporan unit
- Disertakan di metadata `ApprovalRequest` untuk void request

### [FEAT-5] Autocomplete Search Anggota by Nama + NRP di POS Walk-In
- Ganti mekanisme detect-NRP pasif dengan **autocomplete aktif realtime**
- Cari saat ≥ 2 karakter diketik (debounce 350ms) — bekerja untuk NRP maupun nama
- Dropdown menampilkan: avatar inisial, nama, NRP, kategori (Polri/PNS)
- Klik untuk pilih → field terkunci + info bar anggota terpilih (nama, NRP, kategori)
- Tombol X untuk hapus pilihan dan reset ke mode search
- Menutup dropdown otomatis saat klik di luar area input

### [FEAT-6] Kolom Anggota / Pelanggan di Tabel Inbox Approval
- Kolom baru menampilkan nama anggota dari `metadata.memberName` (untuk void unit) atau nama pemohon
- Juga tampil NRP anggota dan badge unitType di bawah nama
- Nomor referensi dipersingkat (font mono kecil) agar tidak terlalu lebar

### [FEAT-7] Format Nomor Referensi Void yang Readable & Unik
- Format baru: `(SINGKATAN_UNIT)-(DDMMYYYY)-(9DIGIT_NRP_atau_TIMESTAMP)`
- Contoh: `CM-06042026-828293010` (Cuci Mobil, 6 Apr 2026, NRP anggota)
- Helper function `generateVoidRequestNo()` di `void-request/route.ts`
- Peta singkatan: CM, BB, PS, FT, LN, RC, TK, CL, SP, FC, AS

### [BUILD FIX] Production Build Deploy-Ready
- Fix: BUG-BUILD-001 → Terminate dev server sebelum `npm run build`
- Fix: BUG-BUILD-002 → Hapus Prisma JSON null filter yang tidak type-safe
- Fix: BUG-BUILD-003 → `(e.description ?? "").replace(...)` untuk null-safe
- Fix: BUG-BUILD-004 → Clear `.next` stale cache sebelum rebuild
- **Build ID:** `QeeabkWK3uqoollTE_LKX` — ✅ VERIFIED

### [UAT] Hasil Testing Staging — 7/7 PASS
- Database staging: Supabase `xlxrjlcnhvtvgkbmrfkm` (bukan production)
- Server: `npm run dev -p 3001` dengan `.env.test.local`
- Semua skenario terverifikasi via screenshot & recording (file: `uat_4_fitur_koperasi_final_*.webp`)

---

## UPDATE 06 April 2026
- **Menyelesaikan Seluruh Validasi UAT Tahap 1 (Unit Toko & Jasa)**: Telah berhasil menjalankan automated tester untuk module Kasir dan Admin Toko serta Kasir Cuci Mobil (Jasa) dan Admin Cuci Mobil. (100% Pass untuk POS Jastual / Toko / Void Approval / Settings).
- **Perbaikan Ketergantungan NextJS 15**: Update route dynamic access using React Promise (`React.use`) pada `[unitSlug]/layanan`.
- **Integrasi Backend Approval Void Unit**: Refactor tipe dan parameter payload di frontend agar persetujuan status pembatalan di Inbox masuk ke DB.

## UPDATE 04 April 2026 (Dini Hari)
**Berdasarkan:** BUG-054 s/d BUG-060 + Blueprint Implementation Plan

---

## FASE 1 — Fondasi Data & Form User
- [x] BUG-054: Buka dropdown unitType untuk Admin di Form User (`users/page.tsx`)
  - Admin sekarang BISA dipilihkan unitType saat dibuat/diedit
  - Tambah unit baru: `coffe_latar`, `resto`, `investasi_modal_jp`, `properti (tanah kapling)`
  - Hapus `laundry` (tidak ada di daftar unit Primkoppol)
  - Validasi: Admin/Kasir WAJIB pilih unit, tombol Simpan terkunci jika belum pilih

## FASE 2 — Keamanan: Middleware & Settings
- [x] BUG-055: Perbaiki blokade middleware Admin di `proxy.ts`
  - Admin unit sekarang DIBLOKIR dari /simpanan, /pinjaman, /kas-bank, /laporan, /master, dll
  - Admin unit BISA akses /approval (untuk approve void kasirnya)
  - Peta rute unit diperbarui ke URL baru `/unit/[slug]`
- [x] BUG-056: Sembunyikan tab berbahaya `/settings` dari Admin Unit
  - Tab: Umum, Notifikasi, Keamanan, Backup, & Reset Data → HANYA Operator
  - Admin Unit hanya melihat Tab QRIS
  - Kasir tetap melihat Tab QRIS seperti sebelumnya

## FASE 3 — Arsitektur Sidebar Independen
- [x] BUG-060: Buat `adminTokoNavigation` di `navigation.ts`
  - Berisi: Dashboard, Kasir POS, Manajemen Produk, Persediaan & Stok, Riwayat Penjualan, Inbox Approval, Profil, QRIS
- [x] BUG-060: Buat `adminUnitNavigation` di `navigation.ts`
  - Berisi: Dashboard, Panel Kasir, Kelola Layanan & Harga, Riwayat Transaksi, Inbox Approval, Profil, QRIS
- [x] BUG-060: Update `getNavigationForUser()` — logika routing navigasi
  - Admin Toko/Coffe Latar/Resto → `adminTokoNavigation`
  - Admin Carwash/Barbershop/PS/Fitness/Properti → `adminUnitNavigation`
  - Kasir Toko → `kasirTokoNavigation` (tidak berubah)
  - Kasir unit jasa → `kasirNavigation` (tidak berubah, tapi /settings dihapus)

## FASE 4 — Dedicated POS per Unit
- [x] BUG-057: Buat Dynamic Route `/unit/[unitSlug]/kasir/page.tsx`
- [x] BUG-058: Buat API CRUD paket layanan `/api/unit/[slug]/packages`
- [x] BUG-058: Buat halaman Admin "Kelola Layanan" per unit
- [x] Integrasi database: Buat schema `UnitServicePackage` dan jalankan seeder untuk migrasi hardcoded data.

## FASE 5 — Perbaikan Logika Void
- [x] BUG-059: Perbaiki `void-request/route.ts` untuk Kasir Toko
  - JALUR A: Operator → void langsung + kembalikan stok (bypass)
  - JALUR B: Kasir/Admin → buat ApprovalRequest `pending_void` di Inbox Admin
  - Cegah double request: cek `voidPending` di metadata sebelum buat request baru
- [x] Perbaiki `void-approve/route.ts` untuk handle tipe `void_store_sale`
  - Ditambahkan JALUR 1 untuk StoreSale: kembalikan stok saat approved, hapus voidPending saat rejected
  - JALUR 2 existing (UnitTransaction + Contra-Entry) tetap berjalan tidak berubah


## FASE 6 — Security Endpoint & Data Integrity (Final Fix)
- [x] BUG-FIX: Approval Inbox "Halaman tidak tersedia"
  - Menyesuaikan `ADMIN_ALLOWED_ROUTES` di `layout.tsx` sehingga rute `/approval` kini dizinkan untuk seluruh profil Admin Eksternal (Toko, Jasa, dsb).
  - Mengamankan `/api/approvals/route.ts` dengan _unit segregation_ agar Loan Applications hilang dari daftar unit admin dan setiap admin unit hanya bisa melihat _Void Request_ milik unitnya.
- [x] BUG-FIX: Transaksi dibatalkan (Void) masih nyangkut di Kasir/Dashboard/Riwayat
  - Memperbarui `/api/dashboard-stats`, `/api/unit-layanan/stats`, dan `/api/unit-transactions` untuk men-drop atau melabelkan `StoreSale` yang memiliki *flag* JSON `metadata.isVoided: true`.
  - Sekarang laporan *Total Hari Ini* & *Tunai* tidak akan ikut menghitung nilai pesanan berstatus batal. Teks "DIBATALKAN" akan muncul tegas di Riwayat Kasir.

## FASE 7 — Stabilitas Backend & Penanganan False Positive (UAT)
- [x] BUG-061: Memperbaiki Exception Foreign Key `branchId: 1`
  - Pengajuan dari Void Kasir Toko kini dapat sukses tersimpan di `ApprovalRequest` dengan `branchId: 10`.
- [x] BUG-062: Perbaikan _False Positive_ Notifikasi Void di Kasir
  - Menghapus _hardcode_ "Sukses" di frontend `transaksi-unit/riwayat/page.tsx`, beralih ke pengecekan `res.ok` dan pencetakan pesan logis dari API Backend.
- [x] BUG-063: Logika Ekstensi `isOperator` Dipangkas
  - Menertibkan kembali akses "bisa Auto-Approve" untuk `role: "admin"`. Admin Unit yang mengajukan pembatalan harus diterbitkan tiket `ApprovalRequest` sebagaimana mestinya, tidak membypass Inbox Approval miliknya.

## FASE 8 — Stabilisasi & QA Alur Potong Gaji (06 April Sore)
- [x] BUG-P01 & BUG-P04: Perbaikan Stok & Plafon Toko
  - Pemotongan `stockToko` kini dikerjakan lebih dahulu, mundur ke `stock` induk bila habis.
  - Plafon unit transaksi dan kasir khusus "Toko" tidak lagi ditumpuk 2 kali (*Double Count*).
- [x] BUG-P02 & BUG-P03: Validasi Realtime Potong Gaji Unit Layanan
  - Diterapkan validasi agregat piutang anggota dan pemeriksaan eksistensi member sehingga tagihan tidak tembus meski Plafon Piutang habis/Limit 0.
- [x] BUG-D01: Bug Akumulasi Dashboard "Pending Void"
  - Notifikasi sisa "Potong Gaji/Pending" di Dashboard Admin tidak akan menduplikat nilai yang tertahan di *Pending Void* atau yang sudah *Voided*.
- [x] FEAT-012, FEAT-013, & FEAT-014:
  - Penambahan form auto-detect **Edit NRP** (pada Riwayat Transaksi yg lupa NRP).
  - Penambahan **Kategori Filter (Belum Lunas, Pending Void, dsb)** di Frontend Riwayat Kasir.
  - Form Dialog Transaksi Kasir kini mengeluarkan notifikasi realtime "Sisa Limit, Total Plafon" untuk memantau kelayakan anggota (*block-action*).

---

## 🛠️ PANDUAN UAT & LINGKUNGAN STAGING (QA TEST GUIDE)

Untuk melakukan pengujian fungsionalitas (QA/UAT) di *device* manapun dengan aman (tanpa mengubah, menimpa, atau menyinggung data Sistem Produksi), silakan ikuti petunjuk Environment Setup berikut:

### 1. Kredensial Database Staging
Gunakan kredensial `DATABASE_URL` Staging berikut yang identik dengan schema asli, khusus untuk dev & dummy.

```env
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
```

### 2. Panduan Menjalankan Sistem Lokal Berbasis Staging
Jangan gunakan port standar (3000) agar tidak tumpang tindih dengan aplikasi utama jika sedang berjalan. Kita akan run di port **3001**. 

*Jalankan perintah ini di Terminal (Powershell) folder `koperasi-app`:*

```powershell
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
npm run dev -- -p 3001
```

*Jika menggunakan MacOS / Linux / Git Bash:*
```bash
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres" npm run dev -- -p 3001
```

### 3. Skenario QA Checklist (Untuk Tester)
- Buka browser di http://localhost:3001
- [ ] Login sebagai Admin Unit atau Kasir (ex: Toko / Jasa Cuci Mobil).
- [ ] Melakukan Transaksi menggunakan opsi **Potong Gaji**.
- [ ] Cek *limit* piutang (Plafon vs Sisa Limit). Uji bila Sisa Limit kurang dari total keranjang (Tombol harus terkunci).
- [ ] Cek halaman **Riwayat Transaksi**, tes Dropdown *Filter Status* baru.
- [ ] Cek status Dashboard Admin (Grafik Mingguan dan nominal Hari Ini tidak boleh ikut terhitung jika Transaksi masih *Pending Void*).
- [ ] Lakukan percobaan klik logo Pensil (Edit NRP) pada Riwayat Transaksi yang belum punya nama Anggota, ketik "UAT99001" dan lihat apa *member detect* bekerja baik.

---
*Diperbarui: 6 April 2026*
