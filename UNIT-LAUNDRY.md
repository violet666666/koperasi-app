# UNIT LAUNDRY — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Laundry |
| **Unit Type (DB)** | `laundry` |
| **Unit Slug** | `laundry` |
| **Status** | ✅ Aktif (Dedicated POS) |
| **POS Type** | Dedicated POS (`/laundry/kasir`) |
| **Tema Warna** | Teal (cyan/hijau muda) |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/laundry/kasir` (dedicated — weight/kg-based)
- **Manajemen Layanan**: `/toko/produk` (CRUD layanan, Admin only)
- **Laporan**: `/unit/laundry/laporan` (Admin only)
- **Dashboard**: `/dashboard`

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "laundry"`)
- Produk/Layanan: `store_products` (`unitType = "laundry"`)

### Metode Pembayaran
1. **Tunai (Cash)**
2. **QRIS**
3. **Potong Gaji** (validasi limit plafon)

---

## Fitur POS

### 1. Weight-based Service Grid
Grid layanan laundry dengan input berat (kg):
- Cuci Regular (/kg), Cuci Express (/kg), Setrika Saja, Dry Clean (/pcs)
- **Input desimal mendukung**: 2.5 kg, 0.5 kg, dll
- Subtotal per item: harga × berat (kg)

### 2. Cart dengan Detail Berat
- Menampilkan: Nama layanan × berat kg = subtotal
- Tombol ±0.5 kg untuk adjust cepat
- Tombol hapus per item
- Total keseluruhan otomatis

### 3. Receipt Thermal
Struk 58mm setelah transaksi berhasil.

### 4. Manajemen Layanan (Admin CRUD)
Admin mengelola via `/toko/produk`:
- Tambah jenis layanan (Cuci Reguler, Cuci Express, Setrika, dll)
- Set harga per kg/per item
- Edit/Hapus/Nonaktifkan

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS Laundry, Riwayat Transaksi |
| **Admin** | POS, Manajemen Layanan (CRUD), Laporan, Inbox Approval |
| **Operator** | Full akses |

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Buat dedicated POS Laundry `/laundry/kasir` |
| 2026-04-25 | ✅ Fitur input berat desimal (kg) |
| 2026-04-25 | ✅ Navigasi kasir/admin dedicated |
| 2026-04-25 | ✅ Route guard di layout.tsx |

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table (create transaction, cash/bank sync, journal entry) dibungkus dalam `prisma.$transaction` untuk menjamin konsistensi data
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi dari daftar yang valid
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota sebelum transaksi potong gaji (setara dengan web)
- **[POS] Validasi Berat**: Maksimal 100 kg per layanan, validasi NaN/0/negatif sebelum checkout
- **[POS] Input Desimal**: Berat didukung hingga 1 desimal (0.1 kg precision), tombol +/- 0.5 kg
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir
