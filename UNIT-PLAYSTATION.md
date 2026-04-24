# UNIT PLAYSTATION — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Play Station |
| **Unit Type (DB)** | `playstation` |
| **Unit Slug** | `play-station` |
| **Status** | ✅ Aktif (Dedicated POS — Timer-based) |
| **POS Type** | Dedicated POS (`/play-station/kasir`) |
| **Jumlah Console** | 8 TV (PS5 default) |
| **Tarif** | Rp 15.000/jam |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/play-station/kasir` (dedicated — timer-based rental dashboard)
- **Manajemen Produk & Jasa**: `/toko/produk` (CRUD produk snack, console config, Admin only)
- **Laporan**: `/unit/playstation/laporan` (Admin only)
- **Dashboard**: `/dashboard` (kasir-dashboard.tsx)

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "playstation"`)
- Produk (snack/minuman): `store_products` (`unitType = "playstation"`)
- Konfigurasi (tarif per jam): Hardcode `PS_RATE_PER_HOURS = 15000` di POS page

### Metode Pembayaran
1. **Tunai (Cash)** — default
2. **QRIS** — scan kode QR
3. **Potong Gaji** — debit gaji anggota (validasi limit plafon)

---

## Fitur Khusus

### 1. Timer-based Billing
POS PS menggunakan sistem timer untuk menghitung biaya sewa:
- **Start**: Mulai timer saat pelanggan duduk
- **Stop**: Stop timer → kalkulasi durasi → hitung biaya
- **Rumus**: `Math.ceil(durasiMenit / 60) × PS_RATE_PER_HOURS`
- Minimum charge: 1 jam

### 2. TV Dashboard (8 Unit)
Dashboard visual menampilkan 8 TV/console:
- Status: **Kosong** (hijau), **Bermain** (kuning/animasi), **Selesai** (merah)
- Masing-masing TV menampilkan: Timer berjalan, nama pelanggan
- State management: Zustand store (persistent di client)

### 3. Penjualan Snack/Minuman
Selain sewa PS, kasir bisa menjual snack/minuman:
- Produk diambil dari `store_products` (`isService = false`)
- Bisa ditambahkan ke tagihan sewa PS

### 4. Manajemen Produk & Harga (Admin CRUD)
Admin dapat mengelola tarif dan produk via `/toko/produk`:
- **Tambah** snack/minuman baru
- **Edit** harga, nama, status
- **Hapus** produk tidak aktif
- Tarif PS per jam bisa diubah di kode (akan dibuat configurable di masa depan)

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS PS (timer dashboard), Riwayat Transaksi |
| **Admin** | POS, Manajemen Produk (CRUD), Laporan, Catat Pengeluaran/Pemasukan, Inbox Approval |
| **Operator** | Full akses semua unit |

---

## Navigation
```
Kasir PS:
├── Dashboard
├── Kasir POS → /play-station/kasir
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=playstation
└── Profil Saya

Admin PS:
├── Dashboard
├── Kasir POS → /play-station/kasir
├── Manajemen Produk & Jasa → /toko/produk
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=playstation
├── Laporan Transaksi → /unit/playstation/laporan
├── Inbox Approval → /approval
└── Profil Saya
```

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Fix routing: kasir/admin diarahkan ke dedicated POS `/play-station/kasir` |
| 2026-04-25 | ✅ Tambah navigasi dedicated (kasirPSNavigation, adminPSNavigation) |
| 2026-04-25 | ✅ Tambah route guard di layout.tsx (`/play-station`) |
| 2026-04-25 | ✅ Admin dapat CRUD produk/jasa via `/toko/produk` |
