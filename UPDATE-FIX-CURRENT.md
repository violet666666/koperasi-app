# UPDATE-FIX-CURRENT: Eksekusi Refactoring Sistem Primkoppol
**Sesi:** 6 April 2026 (Dini Hari)
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

---
*Diperbarui: 6 April 2026, 00:05 WIB*

