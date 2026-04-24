# UNIT BARBERSHOP — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Barbershop |
| **Unit Type (DB)** | `barbershop` |
| **Unit Slug** | `barbershop` |
| **Status** | ✅ Aktif (Dedicated POS) |
| **POS Type** | Dedicated POS (`/barbershop/kasir`) |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/barbershop/kasir` (dedicated — service grid + kapster)
- **Manajemen Layanan**: `/toko/produk` (CRUD layanan, Admin only)
- **Laporan**: `/unit/barbershop/laporan` (Admin only)
- **Dashboard**: `/dashboard` (kasir-dashboard.tsx)

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "barbershop"`)
- Produk/Layanan: `store_products` (`unitType = "barbershop"`)
- Service Packages (legacy): `unit_service_packages` (4 paket — referensi data lama)

### Metode Pembayaran
1. **Tunai (Cash)** — default
2. **QRIS** — scan kode QR
3. **Potong Gaji** — debit gaji anggota (validasi limit plafon)

---

## Fitur Khusus

### 1. Service Grid
POS menampilkan grid layanan yang bisa diklik:
- Setiap layanan memiliki ikon dan harga
- Admin bisa CRUD layanan melalui "Manajemen Layanan"

### 2. Nama Kapster
Input nama tukang cukur/kapster pada setiap transaksi untuk tracking performa.

### 3. Receipt (Struk)
Struk thermal 58mm otomatis ditampilkan setelah transaksi berhasil.

### 4. Manajemen Layanan (Admin CRUD)
Admin dapat mengelola layanan barbershop via `/toko/produk`:
- **Tambah** layanan baru (nama, harga, deskripsi)
- **Edit** harga, nama layanan
- **Hapus** layanan yang tidak aktif
- **Aktif/Nonaktif** toggle

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS Barbershop, Riwayat Transaksi |
| **Admin** | POS, Manajemen Layanan (CRUD), Laporan, Catat Pengeluaran/Pemasukan, Inbox Approval |
| **Operator** | Full akses semua unit |

---

## Navigation
```
Kasir Barbershop:
├── Dashboard
├── Kasir POS → /barbershop/kasir
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=barbershop
└── Profil Saya

Admin Barbershop:
├── Dashboard
├── Kasir POS → /barbershop/kasir
├── Manajemen Layanan → /toko/produk
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=barbershop
├── Laporan Transaksi → /unit/barbershop/laporan
├── Inbox Approval → /approval
└── Profil Saya
```

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Fix routing: kasir/admin diarahkan ke dedicated POS `/barbershop/kasir` |
| 2026-04-25 | ✅ Tambah navigasi dedicated (kasirBarbershopNavigation, adminBarbershopNavigation) |
| 2026-04-25 | ✅ Tambah route guard di layout.tsx (`/barbershop`) |
| 2026-04-25 | ✅ Admin dapat CRUD layanan via `/toko/produk` |
