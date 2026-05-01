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

### Changelog — 1 Mei 2026 (Code Review & Bug Fixes)

**Fase 1 — CRITICAL (5 perbaikan, commit `487eb6d`)**

| # | Severity | Masalah | Solusi | File |
|---|---|---|---|---|
| 1 | CRITICAL | Fiscal period query hanya cek `status: "open"`, bisa salah periode | Tambah range check: `startDate: { lte: now }, endDate: { gte: now }` | `sales/route.ts` |
| 2 | CRITICAL | CashBankAccount balance pakai read-then-write (race condition) | Ganti ke atomic `{ increment: totalAmount }`, derive balanceBefore | `sales/route.ts` |
| 3 | CRITICAL | Operational expense account lookup di luar `$transaction` (race condition) | Pindah ke dalam `$transaction`, pakai atomic `{ decrement: amount }` | `operational-expense/route.ts`, `operational-income/route.ts` |
| 4 | CRITICAL | PUT expense: `balanceBefore` salah saat tanggal transaksi diubah | Recalculate dari predecessor di posisi baru, adjust semua subsequent | `operational-expense/[id]/route.ts` |
| 5 | CRITICAL | SHU kalkulasi: `allocationsMember`/`allocationsNonMember` dihitung sebelum carwash bonus adjustment | Pindah ke setelah adjustment, pakai `adjustedNonMemberSurplus` | `shu-calculator.ts` |

**Fase 2 — IMPORTANT (7 perbaikan, commit `0f161a2`)**

| # | Severity | Masalah | Solusi | File |
|---|---|---|---|---|
| 6 | IMPORTANT | Operator direct void tidak membalikkan jurnal & kas/bank | Tambah journal reversal (swap debit/credit) + atomic `{ decrement }` pada CashBankAccount | `void-request/route.ts` |
| 7 | IMPORTANT | `isOperator` di void hanya cek `"operator"`, admin/super_admin tidak masuk | Expand ke `["operator", "admin", "super_admin"]` | `void-request/route.ts` |
| 8-9 | IMPORTANT | GET expense tanpa RBAC + pakai `description.contains` untuk query | Tambah `checkAccess()`, query by `unitType` column | `operational-expense/route.ts` |
| 10 | IMPORTANT | PUT expense: old receipt file tidak dihapus saat diganti | Tambah cleanup: extract path → delete old UploadedFile | `operational-expense/[id]/route.ts` |
| 11 | IMPORTANT | `todaySalaryCut` di stats tidak menghitung StoreSale salary_cut | Tambah StoreSale salary_cut amounts, tambah role check + unit isolation | `stats/route.ts` |
| 12 | IMPORTANT | QRIS POST/DELETE tanpa unit isolation untuk admin role | Tambah pengecekan `userUnitType !== unitType` | `qris/route.ts` |
| 13 | IMPORTANT | Kasir cuci_mobil tidak bisa akses `/cuci-mobil/*` (route guard) | Tambah `"/cuci-mobil"` ke KASIR_ALLOWED_ROUTES & ADMIN_ALLOWED_ROUTES | `layout.tsx` |

**Fitur Tambahan (commit `643666a`)**

| Fitur | Deskripsi |
|---|---|
| Backdate POS | Kasir bisa pilih tanggal transaksi mundur di POS kasir cepat. Date picker di panel checkout, validasi tidak boleh melebihi hari ini. |

**File yang Diubah (Keseluruhan)**

| File | Perubahan |
|---|---|
| `src/app/api/unit-layanan/sales/route.ts` | Fiscal period range, atomic balance, unit isolation, backdate support |
| `src/app/api/unit-layanan/stats/route.ts` | StoreSale salary_cut, role check, unit isolation |
| `src/app/api/unit-layanan/qris/route.ts` | Unit isolation admin role |
| `src/app/api/unit-transactions/void-request/route.ts` | Journal reversal + cash/bank reversal, expand isOperator |
| `src/app/api/unit/[slug]/operational-expense/route.ts` | Atomic transaction, RBAC, query by unitType |
| `src/app/api/unit/[slug]/operational-expense/[id]/route.ts` | Balance recalculation, receipt cleanup |
| `src/app/api/unit/[slug]/operational-income/route.ts` | Atomic transaction inside $transaction |
| `src/app/(protected)/layout.tsx` | Route guard cuci_mobil kasir + admin |
| `src/lib/services/shu-calculator.ts` | SHU allocation after carwash bonus |
| `src/app/(protected)/cuci-mobil/kasir/page.tsx` | Backdate date picker |
| `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` | Backdate date picker |

---

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table dibungkus dalam `prisma.$transaction`
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota untuk potong gaji
- **[POS] Validasi Quantity**: MAX_QTY = 999, validasi NaN/0/negatif sebelum checkout
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir
- **[API] Void Flow**: Void UnitTransaction sekarang juga membalikkan jurnal & cash/bank (bukan hanya contra-entry)
- **[POS] Member Autocomplete**: Ditambahkan autocomplete NRP/Nama anggota di panel checkout untuk transaksi Tunai/QRIS (sebelumnya hanya tersedia di dialog Potong Gaji). Data pelanggan tersimpan ke histori anggota untuk semua metode pembayaran.
