# Dokumentasi Unit Toko (Pusat Sinkronisasi & Bug Fixes)

Dokumen ini berisi rangkuman arsitektur, catatan pembaruan, serta riwayat penyelesaian bug yang secara khusus berkaitan dengan modul **Unit Toko (StoreSale)** di Koperasi Primkoppol. Semua riwayat ini dipindahkan dari `UPDATE-FIX-CURRENT.md` dan `BUG-FIX-CURRENT.md` agar dokumentasi lebih terpusat dan mudah dibaca.

---

## 1. Arsitektur & Sinkronisasi DB Unit Toko
Sistem toko beroperasi pada modul `StoreSale` yang berbeda dengan `UnitTransaction` (Jasa). Hal ini menyebabkan beberapa penyesuaian khusus:
- **ID Transaksi:** Transaksi retail toko diprefiks dengan `POS-` / `TK-` / `TS-`.
- **Pengurangan Stok:** Pemotongan kuantitas (Stock Deduction) diprioritaskan memotong `stockToko` (etalase fisik). Jika habis, akan fallback mundur memotong `stock` induk (gudang).
- **Auto-Mapping Navigasi:** Menggunakan `kasirTokoNavigation` untuk kasir retail, berbeda dengan Kasir Cepat (jasa). Admin Toko & Resto kini diarahkan menggunakan `adminTokoNavigation`.

---

## 2. Riwayat Pembaruan Fitur (Updates)

### 13 April 2026 - Import History Belanja Toko Terisolasi
- Dibuat custom route `/api/toko/sales/import-history` khusus untuk membaca file excel Import History Belanja (Tab Toko) dengan sistem pemetaaan bulan yang fleksibel (misal: 'feb', 'maret').
- Skema impor mengekstraksi nilai dari sel BARANG saja (simpanan TAJIB dan SP diabaikan penuh agar tidak merusak data import tabungan). History dikonversi langsung menjadi Lunas (`paymentMethod: cash`) sehingga piutang kredit toko tidak terdampak ganda.

### 08 April 2026 - UX Barcode Scanner & Keranjang POS Toko
- Fitur *Global String Filtering* diaktifkan pada DataTable produk agar deteksi barcode SKU langsung responsif.
- Opsi *Dropdown Status Stok* (Menipis, Tersedia) dan *Jenis Mutasi* (Masuk, Keluar) ditambahkan untuk kepraktisan.
- Autocomplete: Sistem Kasir diupdate menggunakan deteksi "NRP/Nama Pelanggan" berbasis dropdown (sebelumnya strict 100% NRP match statis), sehingga mempermudah pencarian nama.

### 07 April 2026 - Pembayaran QRIS Toko
- Integrasi modal pembayaran QRIS dengan menampilkan dynamic `Base64` di POS Kasir.
- Optimasi Jurnal Buku Besar guna mencegah tabrakan/race condition saat 2 kasir checkout di detik yang persis sama.

---

## 3. Riwayat Perbaikan Bug Terselesaikan (Bug Fixes)

| ID | Tanggal | Gejala & Solusi | Status |
|---|---|---|---|
| **BUG-019** | 5 Apr 26 | **Kas Penjualan Toko Tidak Masuk Buku Kas.** Solusi: Sync `StoreSale` ke rekap tutup kas / Kas & Bank. | ✅ FIXED |
| **BUG-023** | 5 Apr 26 | **Dashboard Tidak Hitung Pendapatan Toko.** Solusi: Menggabungkan kalkulasi aggregate dari StoreSales. | ✅ FIXED |
| **BUG-031** | 5 Apr 26 | **Kasir Toko Masuk ke Kasir Cepat.** Solusi: Buat navigasi spesifik agar Kasir ritel mengarah ke modul stok & barcode. | ✅ FIXED |
| **BUG-036** | 5 Apr 26 | **Link "Semua" Riwayat Toko Salah URL.** Solusi: Mengkondisikan route path specific ke query toko. | ✅ FIXED |
| **BUG-037** | 5 Apr 26 | **Riwayat Toko Tidak Tampil.** Solusi: Merge & Sort Descending tabel StoreSale bersama UnitTransaction. | ✅ FIXED |
| **BUG-047** | 5 Apr 26 | **Void Toko (POS-) Ditolak Server.** Solusi: Deteksi string ID untuk routing persetujuan void ke arah StoreSale. | ✅ FIXED |
| **BUG-059**| 5 Apr 26 | **Kasir Toko Tak Bisa Ajukan Void (403).** Solusi: Role kasir diperbolehkan trigger status 'voidPending'. | ✅ FIXED |
| **BUG-061** | 5 Apr 26 | **Foreign Key Constraint Void.** Solusi: Hardcode target approval ke BranchID=10 (Pusat Neon DB). | ✅ FIXED |
| **BUG-P01** | 6 Apr 26 | **Stok Toko Tak Berkurang via Potong Gaji.** Solusi: Redirect deduction target ke field `stockToko`. | ✅ FIXED |
| **BUG-P04** | 6 Apr 26 | **Double-Count Piutang Tagihan.** Solusi: Hapus kalkulasi 2x `StoreSale` vs `UnitTransaction` saat divalidasi. | ✅ FIXED |
| **BUG-064** | 7 Apr 26 | **Foreign key constraint di Kasir Tunai.** Solusi: Sisa kepingan BUG-P04 ditambal pada endpoint validator. | ✅ FIXED |
| **BUG-UI-011** | 7 Apr 26 | **Kolom Metode Pembayaran Kosong (Rip).** Solusi: Render properti metode (Tunai/QRIS) milik StoreSale. | ✅ FIXED |
| **BUG-UI-012** | 7 Apr 26 | **Aksi "Edit Plat Nomor" Tersesat di Toko.** Solusi: Disembunyikan karena toko tak punya atribut kendaraan. | ✅ FIXED |
| **BUG-073** | 8 Apr 26 | **Pie Chart Dashboard Hanya Tampil Toko.** Solusi: Dashboard dirombak mengeksekusi tabel jasa layanan juga. | ✅ FIXED |
---

## 4. Fitur Shift Kasir (20 April 2026)

### Latar Belakang
Unit Toko beroperasi dengan 3 shift (Pagi 08-15, Siang 15-21, Malam 21-08) dan membutuhkan pencatatan serah terima kas antar kasir. Sebelumnya tidak ada mekanisme shift — kasir langsung masuk ke POS dan semua transaksi tidak terikat ke shift tertentu.

### Arsitektur

**Model Prisma Baru: `CashierShift`**
```
cashier_shifts
├── id, userId, unitType, shiftName
├── startedAt, endedAt, status ("open" | "closed")
├── openingCash (modal awal)
├── closingCash (uang fisik akhir, diisi kasir)
├── expectedCash (auto-hitung: openingCash + totalCash)
├── totalSalesCash, totalSalesQris, totalSalesCredit
├── totalTransactions
├── cashDifference (closingCash - expectedCash)
├── closedByUserId (jika ditutup oleh admin/operator)
└── notes
```

**Relasi:** `StoreSale.shiftId` → `CashierShift.id` (opsional, auto-detect dari shift open)

### API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/toko/shifts` | List shift (kasir: sendiri, admin: unit, operator: semua) |
| `POST` | `/api/toko/shifts` | Buka shift baru (shiftName + openingCash + unitType) |
| `PUT` | `/api/toko/shifts/[id]/close` | Tutup shift (closingCash, notes, auto-hitung selisih) |

### Flow Kasir
1. Kasir login → Masuk ke halaman `/toko/shift`
2. Pilih shift (Pagi/Siang/Malam, auto-detect dari jam) + input modal awal
3. Klik "Mulai Shift" → Shift status = `open`
4. Kasir bekerja di POS → setiap `StoreSale` otomatis terikat ke `shiftId`
5. Akhir shift → Klik "Tutup Shift" → Dialog rekap:
   - Sistem hitung total tunai, QRIS, kredit dari transaksi di shift ini
   - Kasir input uang fisik di laci kas
   - Sistem hitung selisih (surplus/defisit)
   - Submit → Shift status = `closed`

### Hak Akses
- **Kasir:** Buka/tutup shift sendiri, lihat riwayat shift sendiri
- **Admin Toko:** Lihat semua shift di unitnya, bisa tutup shift kasir yang lupa
- **Operator:** Lihat semua shift di semua unit, bisa tutup shift siapa saja

### Navigasi
Menu "Shift Kasir" ditambahkan di:
- `kasirTokoNavigation` (sidebar Kasir Toko)
- `adminTokoNavigation` (sidebar Admin Toko)
- `mainNavigation` > Toko PRIMKOPPOL (sidebar Operator)

### Bug Fixes Terkait Shift (20 April 2026)

| Bug | Masalah | Solusi |
|---|---|---|
| **Route Guard** | Kasir error "Akses tidak diizinkan" saat buka `/toko/shift` | Tambahkan `/toko/shift` ke `KASIR_ALLOWED_ROUTES.toko` di `layout.tsx` |
| **Permission DB** | Role kasir di DB hanya punya 2 permission, harusnya 8 | Ditambahkan 6 permission ke role kasir |
| **Sidebar Kasir** | Kasir lihat menu Admin (Produk, Persediaan) | Dihapus. Kasir hanya: POS, Shift, Riwayat |
| **POS tanpa Shift** | Kasir langsung transaksi tanpa shift | Lock screen "Shift Belum Dibuka" + redirect |
| **Profil Edit Nama** | Kasir tidak bisa ganti nama (handleSave palsu) | handleSave kini call API PUT sesungguhnya |

---
*Dokumentasi ini adalah Single Source of Truth terbaru untuk operasional modul Toko (Supermarket/Retail). Apabila terdapat kendala teknis atau feature-request di masa depan terkait Toko Prima Pagi, harap referensikan ke file ini.*

---

## 5. Panduan Fitur Manajemen Produk & Stok (Admin/Operator)

### Fitur "Nol-kan Produk" (Bulk Action)
Fitur ini digunakan saat proses opname atau revisi stok besar-besaran untuk mereset stok ke 0 sebelum menginput data yang benar.

**Flow Penggunaan:**
1. Di halaman **Daftar Produk** (`/toko/produk`), klik **Checkbox** di sebelah kiri (bisa per produk atau "Select All" di header tabel).
2. Setelah ada produk yang dipilih, **Toolbar Aksi Massal** akan muncul di bagian atas tabel.
3. Klik tombol merah **"Nol-kan Stok"** (atau "Nol-kan Semua" jika ingin mereset harga juga).
4. Konfirmasi dialog (Perhatian: Aksi ini tidak dapat dibatalkan).
5. Sistem akan memproses dan menyetel `stockToko` dan `stockGdg` menjadi 0.

### Fitur "Inline Edit" (Update Stok Satuan)
Digunakan untuk menginput jumlah stok terbaru per produk secara cepat tanpa harus masuk ke halaman Edit penuh.

**Flow Penggunaan:**
1. Di halaman **Daftar Produk** (`/toko/produk`), klik ikon **Pensil (Edit)** di kolom paling kanan pada baris produk yang ingin diubah.
2. Kolom input akan terbuka untuk: Stok Gudang, Stok Toko, Harga Pokok (HPP), dan Harga Jual.
3. **Auto-Calculate:** Jika Anda mengubah Harga Pokok (HPP), Harga Jual akan dihitung otomatis dengan rumus: `(HPP + 2% markup + 11% PPN) dibulatkan ke 100 terdekat keatas`.
4. Klik ikon **Centang Hijau** untuk menyimpan perubahan.
5. Stok total akan otomatis diperbarui berdasarkan penjumlahan Stok Gudang + Stok Toko.

*Catatan: Fitur Bulk Action dan Inline Edit ini hanya tersedia untuk Role Admin Toko dan Operator. Role Kasir Toko hanya bisa melihat (View Only).*

---

## 6. Pengecualian Harga: Kategori Rokok (25 April 2026)

### Latar Belakang
Produk rokok memiliki **Harga Eceran Tertinggi (HET)** yang sudah ditetapkan oleh pabrikan/distributor, sehingga **TIDAK boleh** mengikuti rumus auto-calculate `ceil((HPP × 1.02 × 1.11) / 100) × 100`.

### Perubahan yang Diterapkan

| Lokasi | Perilaku Sebelum | Perilaku Sesudah |
|---|---|---|
| **Form Tambah Produk** (`/toko/produk/tambah`) | Mengisi HPP → Harga Jual otomatis dihitung | Jika kategori = "rokok", HPP diisi tapi Harga Jual **TIDAK** auto-calculate |
| **Inline Edit** (Daftar Produk) | Edit HPP → Harga Jual otomatis diupdate | Jika kategori produk = "rokok", HPP berubah tapi Harga Jual **tetap manual** |
| **Bulk Recalculate** (API) | Semua produk ber-HPP dihitung ulang | Produk rokok **dilewati/di-skip** dari perhitungan ulang |

### Cara Penggunaan
1. Saat menambah produk rokok baru, pilih kategori **🚬 Rokok** di dropdown.
2. Isi HPP (Harga Modal) sebagai referensi saja.
3. Isi **Harga Jual secara manual** sesuai HET dari distributor.
4. Saat melakukan "Hitung Ulang Semua Harga", produk rokok akan otomatis dilewati dan tidak terpengaruh.


### Catatan Teknis
- Deteksi kategori bersifat **case-insensitive** ("rokok", "Rokok", "ROKOK" semua dianggap sama).
- Jika di masa depan ada kategori lain yang memerlukan harga manual, cukup tambahkan ke array `MANUAL_PRICE_CATEGORIES` di frontend dan filter `NOT` di API recalculate.

---

## 7. Perbaikan Flow Void & Shift (25 April 2026)

### Latar Belakang
Ditemukan beberapa bug kritis pada flow pembatalan (void) transaksi toko dan perhitungan shift:
1. Stok tetap berkurang setelah transaksi dibatalkan
2. Pembatalan transaksi tetap terbaca sebagai pemasukan di Kas/Bank dan Jurnal
3. Shift close menghitung transaksi yang sudah void
4. Dashboard stats menghitung transaksi yang sudah void
5. Receipt 58mm terpotong karena CSS menggunakan width 80mm

### Bug Fixes

| Bug | Masalah | Root Cause | Solusi | File |
|---|---|---|---|---|
| **BUG-V01** | Stok tetap berkurang setelah void | Void hanya increment `stock` (total), tidak `stockToko` (etalase) | Kembalikan ke `stockToko` + `stock`, tambah log mutasi `StoreStockMovement` | `void-approve/route.ts`, `void-request/route.ts` |
| **BUG-V02** | Void tetap terhitung sebagai pemasukan | Tidak ada reverse journal, reverse CashBankTransaction, dan void UnitTransaction piutang | Tambah reverse jurnal pembalik, reverse kas/bank transaksi (type: "out"), dan void tagihan piutang terkait | `void-approve/route.ts`, `void-request/route.ts` |
| **BUG-V03** | Shift close menghitung transaksi void | Query `groupBy` tidak bisa filter JSON `metadata.isVoided` | Ganti `groupBy` dengan `findMany` + manual filter `isVoided !== true` | `shifts/[id]/close/route.ts` |
| **BUG-V04** | Dashboard stats menghitung void | Aggregate query tidak filter voided | Ganti aggregate dengan `findMany` + manual filter | `toko/stats/route.ts` |
| **BUG-V05** | Struk 58mm terpotong | CSS hardcoded `width: 80mm` dan `body: 280px` | Tambah parameter `paperSize` adaptif (`58mm`: 200px/10px, `80mm`: 280px/11px) | `export-utils.ts` |

### Perubahan Arsitektur Void

**Sebelum (Broken):**
```
Void → Kembalikan stock (total saja) → Tandai metadata.isVoided
```

**Sesudah (Fixed):**
```
Void → Kembalikan stockToko + stock
     → Log mutasi StoreStockMovement (type: "in")
     → Reverse Journal (swap debit/kredit, sourceType: "store_sale_void")
     → Reverse CashBankTransaction (type: "out", category: "void_penjualan_toko")
     → Void UnitTransaction piutang (jika salary_cut)
     → Tandai metadata.isVoided
```

### Catatan Teknis
- Semua reverse bersifat **non-fatal** (try-catch) — jika gagal, void tetap jalan tapi di-log ke console
- Receipt default ke **58mm** (sesuai printer thermal yang dipakai kasir toko)
- Filter void di shift close & stats menggunakan manual filter karena Prisma tidak support filter JSON field di aggregate/groupBy

---
*Dokumentasi ini adalah Single Source of Truth terbaru untuk operasional modul Toko (Supermarket/Retail). Apabila terdapat kendala teknis atau feature-request di masa depan terkait Toko Prima Pagi, harap referensikan ke file ini.*

---

## 8. Fitur Baru Unit Toko (25 April 2026)

### 8.1 Hapus Produk (Soft Delete)
- Tombol **🗑️ Hapus** ditambahkan di kolom aksi tabel produk (`/toko/produk`)
- Hanya tampil untuk **Admin/Operator** (kasir = read only)
- Menggunakan **soft delete** (set `isActive: false`, `deletedAt: timestamp`)
- Confirm dialog sebelum hapus untuk mencegah aksi tidak sengaja
- Backend sudah ada sebelumnya (`DELETE /api/toko/products/[id]`), hanya frontend yang belum terhubung

**File Terkait:**
- `src/app/(protected)/toko/produk/page.tsx` — Tombol hapus + handler `handleDeleteProduct`
- `src/app/api/toko/products/[id]/route.ts` — DELETE endpoint (sudah ada)

### 8.2 Riwayat Transaksi dengan Detail Klik
- Halaman baru **Riwayat Transaksi** di `/toko/riwayat`
- Menampilkan semua transaksi toko dalam tabel: No. Transaksi, Tanggal, Pelanggan, Item, Pembayaran, Total, Kasir
- **Klik baris** → Dialog detail menampilkan:
  - Info header: No. Transaksi, Tanggal, Kasir, Pelanggan, Metode Bayar
  - Tabel item: Nama Produk (SKU), Qty, Harga Satuan, Subtotal
  - Summary: Total Item, Total Harga, Tunai, Kembalian
- Filter: Pencarian (no. transaksi/nama/produk), filter metode bayar
- Stats cards: Total Transaksi, Hari Ini, Pendapatan Hari Ini, Item Terjual Hari Ini
- Voided transactions ditampilkan dengan badge VOID dan opacity rendah
- Menu link ditambahkan di dashboard toko (`/toko`)

**File Terkait:**
- `src/app/(protected)/toko/riwayat/page.tsx` — [NEW] Halaman riwayat + detail dialog
- `src/app/(protected)/toko/page.tsx` — Menu card "Riwayat Transaksi" ditambahkan

### 8.3 Card Jumlah Stok Terjual (Dashboard)
- Card baru **"Terjual Hari Ini: XX pcs"** di dashboard toko (`/toko`)
- Menampilkan jumlah **unit/pcs** (bukan nominal Rp) yang terjual hari ini
- Data diambil dari aggregate `StoreSaleItem.quantity` yang di-filter non-voided
- Grid dashboard diubah dari 4 kolom menjadi 5 kolom

**File Terkait:**
- `src/app/api/toko/stats/route.ts` — Tambah `todayItemsSold` dan `allTimeItemsSold`
- `src/app/(protected)/toko/page.tsx` — Card baru + state + fetch

### 8.4 Transfer Stok Gudang ↔ Toko (Atomik)
- Tombol **"Transfer Stok"** di halaman Persediaan (`/toko/persediaan`)
- Dialog transfer dengan:
  - Pilih produk (combobox dengan info stok gudang/toko)
  - Arah transfer: **Gudang → Toko** atau **Toko → Gudang**
  - Jumlah transfer + keterangan opsional
- Operasi **atomik**: decrement sumber + increment tujuan dalam 1 operasi
- Log **2 mutasi** yang saling terkait (out dari sumber, in ke tujuan)
- Validasi stok sumber mencukupi sebelum transfer

**API:** `POST /api/toko/products/[id]/stock` dengan `type: "transfer"`

**File Terkait:**
- `src/app/api/toko/products/[id]/stock/route.ts` — Tambah handler `type: "transfer"`
- `src/app/(protected)/toko/persediaan/page.tsx` — Dialog transfer + handler

### Hak Akses (Semua Fitur)
| Fitur | Admin/Operator | Kasir |
|---|---|---|
| Hapus Produk | ✅ Full Access | ❌ Tidak Tampil |
| Riwayat Transaksi | ✅ Full Access | ✅ Read Only |
| Card Stok Terjual | ✅ Tampil | ✅ Tampil |
| Transfer Stok | ✅ Full Access | ❌ Tidak Tampil |

---

## Changelog — 26 April 2026

- **[API] Transaction Safety**: Semua operasi multi-table (create sale, stock deduction, journal, cash/bank sync, piutang) dibungkus dalam `prisma.$transaction` interactive — bebas race condition
- **[API] Validasi Input**: `parseFloat` untuk quantity (mendukung desimal), amount harus > 0, validasi stok cukup sebelum checkout
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir. Kasir diblok dari mengubah/hapus produk dan mutasi stok
- **[API] Void Flow**: Void UnitTransaction sekarang membalikkan jurnal & cash/bank secara atomik (interactive transaction)
- **[Mobile] Full Parity**: Mobile POS sudah setara dengan web (3-field stock, shift, journals, discounts, movements, credit limit validation)
- **[Mobile] RBAC**: 6 mobile endpoint ditambahkan role check (reports, members, savings-tx)
- **[Stats] Timezone Fix**: Stats API menggunakan UTC+7 (WIB) untuk boundary "hari ini"

