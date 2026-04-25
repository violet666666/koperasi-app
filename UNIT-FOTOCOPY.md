# UNIT FOTOCOPY — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Fotocopy & Print |
| **Unit Type (DB)** | `fotocopy` |
| **Unit Slug** | `fotocopy` |
| **Status** | ✅ Aktif (Dedicated POS) |
| **POS Type** | Dedicated POS (`/fotocopy/kasir`) |
| **Tema Warna** | Blue (biru) |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/fotocopy/kasir` (dedicated — quantity per lembar)
- **Manajemen Layanan**: `/toko/produk` (CRUD layanan, Admin only)
- **Laporan**: `/unit/fotocopy/laporan` (Admin only)
- **Dashboard**: `/dashboard`

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "fotocopy"`)
- Produk/Layanan: `store_products` (`unitType = "fotocopy"`)

### Metode Pembayaran
1. **Tunai (Cash)**
2. **QRIS**
3. **Potong Gaji** (validasi limit plafon)

---

## Fitur POS

### 1. Quantity-based Service Grid
Grid layanan fotocopy dengan input jumlah lembar:
- Fotocopy A4 B/W, A4 Color, A3, Print, Scan, Jilid, Laminasi, dll
- Input jumlah lembar langsung di grid
- Subtotal per item: harga × jumlah lembar

### 2. Cart dengan Detail Lembar
- Menampilkan: Nama layanan × jumlah lembar = subtotal
- Tombol +/- dan hapus per item
- Total keseluruhan otomatis

### 3. Receipt Thermal
Struk 58mm setelah transaksi berhasil.

### 4. Manajemen Layanan (Admin CRUD)
Admin mengelola via `/toko/produk`:
- Tambah jenis layanan (Fotocopy A4, Print Warna, Scan, dll)
- Set harga per lembar/per item
- Edit/Hapus/Nonaktifkan

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS Fotocopy, Riwayat Transaksi |
| **Admin** | POS, Manajemen Layanan (CRUD), Laporan, Inbox Approval |
| **Operator** | Full akses |

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Buat dedicated POS Fotocopy `/fotocopy/kasir` |
| 2026-04-25 | ✅ Fitur input jumlah lembar per layanan |
| 2026-04-25 | ✅ Navigasi kasir/admin dedicated |
| 2026-04-25 | ✅ Route guard di layout.tsx |

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table dibungkus dalam `prisma.$transaction`
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota untuk potong gaji
- **[POS] Validasi Quantity**: MAX_QTY = 999, `parseFloat` untuk quantity desimal, validasi NaN/0/negatif
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir
