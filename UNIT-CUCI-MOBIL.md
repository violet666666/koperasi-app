# UNIT CUCI MOBIL — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Cuci Mobil |
| **Unit Type (DB)** | `cuci_mobil` |
| **Unit Slug** | `cuci-mobil` |
| **Status** | ✅ Aktif Produksi |
| **Jumlah Transaksi** | 431+ transaksi (terbanyak) |
| **POS Type** | Generic POS (via `/unit/cuci-mobil/kasir`) |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/unit/cuci-mobil/kasir` (generic unit POS)
- **Laporan**: `/unit/cuci-mobil/laporan` (Admin only)
- **Dashboard**: `/dashboard` (kasir-dashboard.tsx)

### Database Schema
- Transaksi disimpan di: `unit_transactions` (`unitType = "cuci_mobil"`)
- Service packages: `unit_service_packages` (16 paket layanan)
- Pengeluaran: `cash_bank_transactions` (`type = "out"`, `category = "operational"`)
- **Pemasukan Manual**: `cash_bank_transactions` (`type = "in"`, `category = "operational"`)

### Metode Pembayaran
1. **Tunai (Cash)** — default
2. **QRIS** — scan kode QR
3. **Potong Gaji** — debit gaji anggota (validasi limit plafon)

---

## Fitur Khusus

### 1. SHU Cuci Mobil (Insentif Anggota)
Setiap transaksi cuci mobil oleh **anggota** (memberId != null) dan **bukan voided**, akan dipotong **Rp 2.000** dari laba unit sebagai SHU:
- `SHU_PER_CUCI_ANGGOTA = 2000`
- Ditampilkan di laporan sebagai "Potongan SHU Member"
- Laba = Pendapatan - Pengeluaran - Potongan SHU

### 2. Bagi Hasil 50/50
Laba bersih setelah potongan SHU dibagi rata:
- 50% untuk **PRIMKOPPOL** (koperasi)
- 50% untuk **Mitra Cuci Mobil** (pekerja)

### 3. Plat Kendaraan
Setiap transaksi menyimpan plat nomor kendaraan di field `notes` dengan format:
```
[PLAT:AB 1234 CD]
```

### 4. Catat Pemasukan Manual (BARU - April 2026)
Fitur untuk mencatat pemasukan di luar transaksi POS kasir:
- **API**: `POST /api/unit/cuci-mobil/operational-income`
- **UI**: Tombol hijau "Catat Pemasukan" di halaman Laporan
- **Fungsi**: Mencatat pemasukan lama yang belum tercatat, sewa lahan, dll.
- **Data Flow**: `CashBankTransaction` → `type: "in"`, `category: "operational"`
- **Mendukung**: Upload bukti foto (maks. 2MB), tanggal mundur (backdated)

### 5. Catat Pengeluaran Operasional
- **API**: `POST /api/unit/cuci-mobil/operational-expense`
- **UI**: Tombol merah "Catat Pengeluaran" di halaman Laporan
- **Fungsi**: Beli sabun, peralatan, bahan baku, dll.
- **Mendukung**: Edit, hapus, upload bukti foto

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS, Riwayat Transaksi |
| **Admin** | POS, Laporan, Catat Pemasukan, Catat Pengeluaran, Export |
| **Operator** | Full akses semua unit |

---

## API Endpoints
| Method | Endpoint | Fungsi |
|:--|:--|:--|
| GET | `/api/unit/cuci-mobil/laporan` | Ambil laporan transaksi + summary |
| POST | `/api/unit/cuci-mobil/operational-expense` | Catat pengeluaran |
| DELETE | `/api/unit/cuci-mobil/operational-expense/[id]` | Hapus pengeluaran |
| POST | `/api/unit/cuci-mobil/operational-income` | Catat pemasukan manual |

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Tambah fitur "Catat Pemasukan" di halaman Laporan |
| 2026-04-25 | ✅ Update laporan API untuk include operationalIncomes |
| - | Rilis awal — POS generic + SHU insentif |
