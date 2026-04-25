# UNIT FITNESS — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Fitness / Gym |
| **Unit Type (DB)** | `fitness` |
| **Unit Slug** | `fitness` |
| **Status** | ✅ Aktif (Dedicated POS) |
| **POS Type** | Dedicated POS (`/fitness/kasir`) |
| **Tema Warna** | Emerald (hijau) |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/fitness/kasir` (dedicated — service grid)
- **Manajemen Layanan**: `/toko/produk` (CRUD layanan, Admin only)
- **Laporan**: `/unit/fitness/laporan` (Admin only)
- **Dashboard**: `/dashboard` (kasir-dashboard.tsx)

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "fitness"`)
- Produk/Layanan: `store_products` (`unitType = "fitness"`)

### Metode Pembayaran
1. **Tunai (Cash)**
2. **QRIS**
3. **Potong Gaji** (validasi limit plafon)

---

## Fitur POS

### 1. Service Grid
Grid layanan fitness yang bisa diklik:
- Daily Pass, Membership Bulanan/Tahunan, Personal Trainer, dll
- Setiap layanan bisa CRUD oleh Admin

### 2. Cart & Checkout
- Tambah/kurangi quantity layanan
- Total otomatis dihitung
- Nama pelanggan opsional

### 3. Receipt Thermal
Struk 58mm otomatis ditampilkan setelah checkout.

### 4. Manajemen Layanan (Admin CRUD)
Admin mengelola via `/toko/produk`:
- Tambah layanan baru
- Edit harga dan nama
- Hapus/nonaktifkan layanan

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS Fitness, Riwayat Transaksi |
| **Admin** | POS, Manajemen Layanan (CRUD), Laporan, Inbox Approval |
| **Operator** | Full akses |

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Buat dedicated POS Fitness `/fitness/kasir` |
| 2026-04-25 | ✅ Navigasi kasir/admin dedicated |
| 2026-04-25 | ✅ Route guard di layout.tsx |

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table dibungkus dalam `prisma.$transaction`
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota untuk potong gaji
- **[POS] Validasi Quantity**: MAX_QTY = 999, validasi NaN/0/negatif sebelum checkout
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir
