# Catatan Update Aplikasi

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

---
*Diperbarui: 6 April 2026, 02:10 WIB*
