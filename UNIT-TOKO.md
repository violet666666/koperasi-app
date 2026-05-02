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

### 02 Mei 2026 - Perbaikan Massal Toko (Bug Fix Sprint)
- **Cetak Ulang Struk:** Tombol "Cetak Ulang Struk" ditambahkan di detail dialog riwayat transaksi toko (`/transaksi-unit/riwayat?unitType=toko`), memanggil `generateKasirReceiptPDF`.
- **Notifikasi Terisolasi per Unit:** Semua endpoint notifikasi kini memfilter admin berdasarkan `unitType` sehingga admin toko tidak menerima notifikasi unit lain.
- **Print Thermal 58mm:** CSS print dioptimalkan untuk C58BT-Pro 58mm thermal printer — `height: fit-content`, `page-break-inside: avoid`, window height dikurangi.
- **Stats Produk Akurat:** API products mengembalikan aggregate stats (`totalStock`, `totalValue`, `outOfStock`) dari query database, bukan dari data halaman terpaginasi.
- **Import Stok Aman:** Produk existing yang di-reimport tidak lagi ke-overwrite field stock.

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
| **BUG-084** | 2 Mei 26 | **Notifikasi Bocor ke Unit Lain.** Solusi: Helper `getNotificationRecipients(unitType)` memfilter admin berdasarkan unitType, diterapkan di 5 endpoint notifikasi (stock, sales, void, batches). | ✅ FIXED |
| **BUG-085** | 2 Mei 26 | **Import Produk Overwrite Stok yang Ada.** Solusi: `upsert` update hanya mengubah name/category/costPrice/sellPrice/unit — field stock tidak di-overwrite saat update produk existing. | ✅ FIXED |
| **BUG-086** | 2 Mei 26 | **Stok Tidak Terbaca dari Kolom Total/Stock di Excel.** Solusi: Fallback jika Excel tidak punya kolom Gdg/Toko, kolom Total/Stock digunakan sebagai `stockToko`. | ✅ FIXED |
| **BUG-087** | 2 Mei 26 | **Print Struk 58mm Kertas Berlebihan.** Solusi: CSS `html/body { height: fit-content; min-height: 0; max-height: none; }` + `page-break-inside: avoid` + kurangi window.open height ke 300px. | ✅ FIXED |
| **BUG-088** | 2 Mei 26 | **Stats Manajemen Produk Salah karena Pagination.** Solusi: API mengembalikan `stats` (totalProducts, totalStock, totalValue, outOfStock, lowStock) dari aggregate query terpisah, bukan dari data halaman. | ✅ FIXED |
---

## 4. Fitur Shift Kasir (20 April 2026)

### Latar Belakang
Unit Toko beroperasi dengan 3 shift (**configurable oleh admin**, default: Pagi 07-15, Sore 15-21, Malam 21-07) dan membutuhkan pencatatan serah terima kas antar kasir. Sebelumnya tidak ada mekanisme shift — kasir langsung masuk ke POS dan semua transaksi tidak terikat ke shift tertentu.

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
2. Pilih shift (Pagi/Sore/Malam, auto-detect dari jam) + input modal awal
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

## 6. Pengecualian Harga: Kategori Manual (Configurable) — Diperbarui 26 April 2026

### Latar Belakang
Beberapa kategori produk (misalnya Rokok) memiliki **Harga Eceran Tertinggi (HET)** yang ditetapkan pabrikan/distributor, sehingga **TIDAK boleh** mengikuti rumus auto-calculate. Fitur ini sebelumnya menggunakan hardcoded array `["rokok"]`, kini diubah menjadi **configurable melalui Manajemen Harga** (`/toko/manajemen-harga`).

### Cara Penggunaan
1. Buka **Manajemen Harga** di menu sidebar Toko → "Manajemen Harga"
2. Pada card **"Kategori dengan Harga Manual"**, klik chip kategori untuk toggle:
   - ☑ = Harga otomatis (formula markup)
   - ☐ = Harga manual (admin input sendiri)
3. Klik **"Simpan Pengaturan Kategori"**
4. Saat menambah produk dengan kategori manual, HPP diisi tapi Harga Jual **TIDAK** auto-calculate
5. Saat "Hitung Ulang Semua Harga", produk kategori manual akan **dilewati**

### Komponen Sistem

| Komponen | Perubahan |
|---|---|
| **Settings API** (`/api/settings`) | Default settings `toko_excluded_categories` dan `resto_excluded_categories` (JSON array) |
| **Manajemen Harga** (`/toko/manajemen-harga`) | Card baru "Kategori dengan Harga Manual" — chip toggle UI |
| **Form Tambah Produk** (`/toko/produk/tambah`) | Membaca `excludedCategories` dari settings, skip auto-calculate |
| **Daftar Produk** (`/toko/produk`) | Badge "Manual" (amber) pada produk kategori excluded, fetch excluded dari settings |
| **Inline Edit** (Daftar Produk) | Skip auto-calculate jika kategori produk = manual |
| **Import Excel** (`/api/toko/products/import`) | `getPricingMultipliers()` membaca excluded categories, skip auto-calc |
| **Recalculate API** (`/recalculate-prices`) | Query `NOT { category: { in: excludedCategories } }` untuk skip produk manual |
| **Bulk Set Harga** (Dialog) | Warning jika produk kategori manual terpilih |

### Catatan Teknis
- Deteksi kategori bersifat **case-insensitive** (disimpan lowercase di settings)
- Data disimpan di `app_settings` tabel sebagai JSON array
- Berlaku per unit type: `toko_excluded_categories` dan `resto_excluded_categories` terpisah

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
- **[UI] Rename "Rak" → "Kategori"**: Seluruh label "Rak" diubah ke "Kategori" (table header, filter, form, detail produk). Import Excel tetap backward-compatible — menerima kolom "Rak" maupun "Kategori"
- **[Receipt] Struk POS Retail**: Komponen `ReceiptPrimkopol` diperbaiki — nama unit ditampilkan, detail item per baris, teks "Koperasi" dihilangkan (diganti "Polres Lumajang"), `@page { size: auto }` untuk thermal printer, padding dikurangi
- **[UI] Bulk Set Kategori**: Tombol "Set Kategori" ditambahkan ke bulk action bar. Admin bisa pilih kategori dari chip yang sudah ada atau ketik kategori baru. Endpoint `PUT /api/toko/products/bulk` mendukung action `set_category`
- **[Harga] Manajemen Harga per Kategori**: Sistem pengecualian harga manual sebelumnya hardcoded `["rokok"]`, kini **configurable** melalui halaman Manajemen Harga. Admin bisa toggle kategori mana saja yang harganya manual (tidak terpengaruh formula markup). Meliputi: (A) chip toggle UI di `/toko/manajemen-harga`, (B) badge "Manual" di tabel produk, (C) warning di bulk set harga, (D) import Excel aware terhadap excluded categories. Settings disimpan di `app_settings` sebagai JSON array per unit type
- **[CRITICAL] Data Isolation Bug Fix**: Ditemukan dan diperbaiki bug dimana produk dari unit lain (cuci mobil, resto, dll) muncul di POS/manajemen unit yang tidak sesuai. **Root cause:** banyak endpoint dan frontend fetch tidak memfilter berdasarkan `unitType`. **Perbaikan pada 8 file:**
  - `manajemen-harga/page.tsx` — fetch kategori sekarang filter `unitType`
  - `toko/kasir/page.tsx` — 2x fetch produk sekarang filter `unitType=toko`
  - `toko/persediaan/page.tsx` — refresh setelah void sekarang filter `unitType`
  - `recalculate-prices/route.ts` — produk yang dihitung ulang sekarang filter per unit
  - `import/route.ts` — import menggunakan `unitType` dari session (bukan hardcoded "toko"), produk baru disimpan dengan `unitType` yang benar
  - `bulk/route.ts` — validasi bahwa produk yang di-bulk-action hanya dari unit user
  - `duplicates/route.ts` — deteksi duplikat sekarang per unit
  - `sync-stock/route.ts` — sinkronisasi stok sekarang per unit
  - `reset/route.ts` — hapus semua produk sekarang hanya menghapus produk dari unit user
- **[UI] Checkbox Filtering Riwayat Toko**: Filter metode pembayaran di `/toko/riwayat` diubah dari Select dropdown (single) ke Checkbox (multi-select). Tambah checkbox "Tampilkan Void" untuk toggle visibilitas transaksi voided. File: `toko/riwayat/page.tsx`
- **[UI] Checkbox Filtering Laporan Unit**: Filter metode pembayaran (Tunai, QRIS, Potong Gaji) ditambahkan di halaman Laporan Unit (`/unit/[slug]/laporan`) menggunakan Checkbox multi-select. Summary (pendapatan, laba, jumlah transaksi) otomatis terkalkulasi ulang sesuai filter aktif. Export Excel juga menggunakan data terfilter. File: `unit/[unitSlug]/laporan/page.tsx`
- **[Laporan] Void Exclusion Confirm**: Konfirmasi bahwa API laporan (`/api/unit/[slug]/laporan`) sudah memfilter transaksi voided secara server-side — UnitTransaction via `status: { notIn: ["voided"] }`, StoreSale via `!meta.isVoided`. Voided hanya muncul di Riwayat Transaksi, tidak masuk Laporan.

---

## Changelog — 26 April 2026 (Batch 2: Shift & Piutang)

- **[CRITICAL] Limit Piutang 50% Gaji**: Formula plafon piutang untuk pembayaran potong gaji diubah dari `(sisaBersih - Rp 2.000.000)` menjadi **50% × sisaBersih** (`Math.floor(sisaBersih * 0.5)`). Berlaku di 3 endpoint: (1) `toko/sales/route.ts`, (2) `mobile/toko/route.ts`, (3) `unit-transactions/validate/route.ts`
- **[Shift] Detail View**: Riwayat shift di `/toko/shift` sekarang bisa diklik untuk melihat detail lengkap: info shift, breakdown metode pembayaran, tabel transaksi, produk terlaris, dan rekonsiliasi kas. Endpoint baru: `GET /api/toko/shifts/[id]/sales`
- **[Shift] Live Stats**: Stats shift aktif (tunai, QRIS, kredit, jumlah trx) sekarang dihitung real-time dari StoreSale terikat shift, bukan statis 0. File: `api/toko/shifts/route.ts`
- **[Riwayat] Filter Per Shift**: Riwayat transaksi toko (`/toko/riwayat`) mendapat checkbox filter per shift. Setiap baris transaksi menampilkan badge shift (Pagi/Siang/Malam). API sales sekarang mengembalikan `shiftId` dan `shift` info
- **[Transaksi] Nomor Sequential**: Format `saleNo` diubah dari `TK-YYYYMMDD-BASE36` ke `TK-DDMMYYYY-SEQ` (contoh: `TK-26042026-0001`). Berlaku untuk web POS dan mobile POS (`POS-M-DDMMYYYY-SEQ`). Format lama tetap valid untuk transaksi yang sudah ada

---

## 9. Fitur Sub-Akun Kasir & Identitas Kasir (30 April 2026)

### Latar Belakang
Unit Toko membutuhkan sistem dimana **satu perangkat (satu akun email kasir)** dapat digunakan oleh **beberapa kasir** secara bergantian. Setiap kasir memiliki identitas sendiri (username + PIN) sehingga transaksi terikat ke kasir yang sebenarnya memproses, bukan hanya ke akun perangkat.

### Arsitektur

**Model Prisma: `CashierIdentity`**
```
cashier_identities
├── id, parentUserId (FK ke User), username, pin (bcrypt hash)
├── displayName (nama yang tampil di struk/riwayat)
├── isActive (soft delete flag)
└── createdAt
```

**Relasi:** `StoreSale.cashierIdentityId` → `CashierIdentity.id` dan `CashierShift.cashierIdentityId` → `CashierIdentity.id`

### Flow Kasir Multi-Identitas
1. Admin membuat identitas kasir (username + PIN + nama tampilan) via halaman Manajemen Kasir
2. Kasir buka perangkat → Login email 1x → Masuk ke Lock Screen
3. Pilih identitas → Input PIN → Verifikasi → Session cookie tersimpan
4. Kasir bekerja di POS → Semua transaksi terikat ke `cashierIdentityId`
5. Ganti kasir → Klik "Ganti Kasir" → Kembali ke Lock Screen → Kasir berikutnya login PIN

### API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/toko/cashier-identities` | List identities (kasir: milik sendiri, admin: unit) |
| `POST` | `/api/toko/cashier-identities` | Buat identitas baru (admin/operator only) |
| `PUT` | `/api/toko/cashier-identities/[id]` | Update username/nama/PIN/status |
| `DELETE` | `/api/toko/cashier-identities/[id]` | Soft delete (cek shift aktif dulu) |
| `POST` | `/api/toko/cashier-identities/verify-pin` | Verifikasi PIN (rate limit 5x, lock 5 menit) |
| `GET` | `/api/toko/cashier-session` | Baca session cookie identitas aktif |
| `POST` | `/api/toko/cashier-session` | Set cookie identitas aktif |
| `DELETE` | `/api/toko/cashier-session` | Hapus session (ganti kasir) |
| `GET/PUT` | `/api/toko/shift-schedule` | Baca/simpan jadwal shift (admin configurable) |

### Manajemen Kasir (Admin)
Halaman `/toko/kasir-manajemen` menyediakan:
- **Buat kasir**: Pilih akun induk (device), username, PIN 4-6 digit, nama tampilan
- **Edit kasir**: Ubah username, nama tampilan, atau ganti PIN
- **Aktifkan/Nonaktifkan**: Toggle status tanpa menghapus data
- **Hapus kasir**: Soft delete (tidak bisa jika ada shift aktif)
- **Tabel informasi**: Kolom Akun Induk menampilkan perangkat mana kasir beroperasi

### Jadwal Shift Configurable (Admin)
- Tombol "Atur Jadwal Shift" di halaman `/toko/shift` (hanya admin/operator)
- Bisa mengubah nama shift, jam mulai, jam selesai, tambah/hapus shift
- Data tersimpan di `app_settings` table sebagai JSON (`{unitType}_shift_schedule`)
- Default: Pagi 07:00-14:59, Sore 15:00-20:59, Malam 21:00-06:59

### Penulusuran Identitas Kasir di Seluruh Sistem

| Modul | Informasi Kasir | Status |
|---|---|---|
| POS Kasir (`/toko/kasir`) | Badge nama kasir, tombol Ganti Kasir | ✅ Tampil |
| Struk/Receipt | Nama kasir tercetak | ✅ Tampil |
| Riwayat Transaksi (`/toko/riwayat`) | Kolom Kasir menampilkan `cashierDisplayName` | ✅ Tampil |
| Shift Detail (klik shift) | Kolom Kasir per transaksi | ✅ Tampil |
| Riwayat Shift (`/toko/shift`) | `cashierDisplayName` per shift | ✅ Tampil |
| Portal Anggota (nota/struk) | "Kasir: [nama]" di detail transaksi | ✅ Tampil |
| Laporan Unit (`/unit/[slug]/laporan`) | - | Belum tersedia |

### Keamanan Produksi

| Aspek | Implementasi |
|---|---|
| PIN Storage | bcrypt hash (10 rounds) |
| Rate Limiting | 5x gagal → lock 5 menit (in-memory, reset on restart) |
| Session Cookie | httpOnly, secure (production), sameSite=lax, 24h expiry |
| Role Authorization | Sales API: admin/operator/kasir only, tidak bisa diakses anggota |
| Unit Isolation | Admin hanya kelola kasir di unit sendiri, tidak bisa cross-unit |
| Shift Validation | shiftName divalidasi terhadap jadwal yang dikonfigurasi |
| Sale Number | Retry loop mencegah duplicate key saat concurrent checkout |
| Shift-Sale Unit Match | Sales divalidasi shift milik unit yang sama |
| Cashier Ownership | Server-side validasi cashierIdentityId milik user yg login |
| topProducts Null Safety | Guard `item.product` null di agregasi shift detail |
| super_admin Identity Listing | super_admin lihat semua identitas tanpa filter unitType |
| Stale Cookie Cleanup | GET session otomatis hapus cookie jika identitas inactive |
| Cart Guard on Switch | Konfirmasi sebelum ganti kasir jika keranjang ada item |
| Shift Mismatch Warning | Banner peringatan jika shift terbuka oleh kasir berbeda |
| Void Filtering (Member Portal) | UnitTransaction voided & Contra-Entry tidak muncul di riwayat anggota, StoreSale voided juga terfilter |

### File Terkait

| File | Fungsi |
|---|---|
| `src/app/api/toko/cashier-identities/route.ts` | CRUD identitas kasir |
| `src/app/api/toko/cashier-identities/[id]/route.ts` | Update/delete identitas + unit isolation |
| `src/app/api/toko/cashier-identities/verify-pin/route.ts` | Verifikasi PIN + rate limiting |
| `src/app/api/toko/cashier-session/route.ts` | Cookie session management |
| `src/lib/actions/cashier-identity.action.ts` | Server actions (set/clear/get cookie) |
| `src/lib/shift-schedule.ts` | Shared helper: load jadwal shift dari DB |
| `src/components/patterns/cashier-lock-screen.tsx` | Lock screen UI |
| `src/app/(protected)/toko/layout.tsx` | Route guard + lock screen |
| `src/app/(protected)/toko/kasir-manajemen/page.tsx` | Admin manajemen kasir |
| `src/app/api/toko/shift-schedule/route.ts` | API jadwal shift configurable |
| `src/app/api/toko/sales/route.ts` | Sales API + cashier identity + role check |
| `src/app/api/toko/shifts/route.ts` | Shifts API + dynamic schedule |
| `src/app/api/toko/shifts/[id]/sales/route.ts` | Shift detail + per-sale cashier |
| `src/app/api/member-portal/transactions/route.ts` | Member portal + cashier info |

---

## Changelog — 30 April 2026

### Fitur Baru

- **[Produk] Inline Edit Satuan**: Kolom "Sat" di daftar produk (`/toko/produk`) kini bisa diedit langsung via inline edit (klik ikon pensil). Field `unit` dikirim ke PUT endpoint yang sudah ada.
- **[Produk] Bulk Edit Satuan**: Tombol "Edit Satuan" (ikon Ruler) ditambahkan ke bulk action toolbar. Dialog menampilkan chips satuan yang sudah ada + input teks bebas. Backend `set_unit` ditambahkan ke `PUT /api/toko/products/bulk`.
- **[Riwayat] Cetak Ulang Struk per Baris**: Kolom "Aksi" baru di tabel riwayat transaksi (`/toko/riwayat`) dengan ikon Eye (detail) + Printer (cetak ulang). Klik printer langsung cetak tanpa buka dialog. Tombol printer tersembunyi untuk transaksi voided. Menggunakan `generateKasirReceiptPDF` dari export-utils.
- **[Riwayat] Cetak Struk di Dialog Detail**: Tombol "Cetak Struk" di dialog detail transaksi riwayat (hanya non-void).
- **[Shift] Cetak Rekap Shift**: Tombol "Cetak Rekap" di pojok kanan atas dialog detail shift (`/toko/shift`). Menghasilkan struk thermal (default 80mm) berisi: header shift, ringkasan pendapatan (modal awal, tunai/QRIS/kredit, total), rekonsiliasi kas (kas seharusnya, fisik, selisih), daftar transaksi lengkap, top 5 produk terlaris. Fungsi `generateShiftRecapPDF` dan interface `ShiftRecapData` ditambahkan di `export-utils.ts`.

### Bug Fix

- **[Struk] Kertas Berlebihan / Space Kosong Panjang**: Root cause: CSS `@page` menggunakan `width: 58mm` tanpa `auto` height, menyebabkan browser generate satu halaman penuh. Fix: `@page { size: 58mm auto; margin: 0; }` — tinggi halaman menyesuaikan konten. Padding/margin seluruh elemen struk diperkecil. Diterapkan di dua jalur cetak:
  - `generateKasirReceiptPDF()` di `src/lib/export-utils.ts` (Toko kasir)
  - `ReceiptPrimkopol.handlePrint()` di `src/components/patterns/receipt-primkopol.tsx` (Resto, Barbershop, dll)

### File Terkait

| File | Perubahan |
|---|---|
| `src/app/(protected)/toko/produk/page.tsx` | Inline edit satuan, bulk Edit Satuan toolbar + dialog |
| `src/app/api/toko/products/bulk/route.ts` | Aksi `set_unit` di switch statement |
| `src/app/(protected)/toko/riwayat/page.tsx` | Tombol cetak ulang per baris + di dialog detail |
| `src/app/(protected)/toko/shift/page.tsx` | Tombol Cetak Rekap di dialog detail shift |
| `src/lib/export-utils.ts` | Fix `@page size auto`, perkecil padding struk, tambah `generateShiftRecapPDF` + `ShiftRecapData` |
| `src/components/patterns/receipt-primkopol.tsx` | Fix `@page` padding, perkecil divider/margin |

---

## 10. Sistem Notifikasi, HPP Moving Average & Batch Tracking (30 April 2026)

### 10.1 Tahap 1 — Sistem Notifikasi

#### Latar Belakang
Sebelumnya tidak ada mekanisme notifikasi di seluruh aplikasi. Admin harus manual cek stok, tidak ada pemberitahuan saat ada void request, dan tidak ada alert untuk produk yang hampir expired.

#### Arsitektur

**Model Prisma: `Notification`**
```
notifications
├── id, userId (FK ke User), type (string), title, message
├── data (Json — metadata terstruktur per tipe)
├── isRead, readAt
└── createdAt
```

**Tipe Notifikasi:**

| Tipe | Label | Trigger |
|---|---|---|
| `low_stock` | Stok Rendah | Setelah penjualan atau stok keluar jika `stockToko ≤ minStock` |
| `stock_in` | Stok Masuk | Saat input stok masuk via persediaan |
| `void_request` | Void Request | Kasir mengajukan pembatalan transaksi |
| `expiring_soon` | Hampir Expired | Batch dengan expiry ≤ 90 hari |
| `batch_expired` | Batch Expired | Auto-detect saat halaman batch diakses |
| `info` | Info | Stok keluar (writeoff) dan kejadian umum |

#### Komponen UI

| Komponen | Lokasi | Fungsi |
|---|---|---|
| `NotificationBell` | Topbar (global) | Popover 10 notifikasi terbaru, badge unread count, polling 30 detik |
| `/notifikasi` | Halaman penuh | List semua notifikasi, filter tipe, pagination, mark read/delete |
| Push Notification | Backend (fire-and-forget) | Expo Push Notifications ke device mobile admin |

#### API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/notifications` | List notifikasi user (pagination + type filter + unread count) |
| `PUT` | `/api/notifications/read` | Tandai semua sebagai dibaca |
| `PUT` | `/api/notifications/[id]/read` | Tandai satu sebagai dibaca |
| `DELETE` | `/api/notifications/[id]` | Hapus notifikasi (scoped ke userId) |

#### Helper
`src/lib/notifications.ts` — `createNotification()` melakukan DB insert + fire-and-forget Expo push. Push failure tidak memblokir response.

---

### 10.2 Tahap 2 — HPP Moving Average + Audit Trail

#### Latar Belakang
HPP (Harga Pokok Penjualan) sebelumnya statis per produk, diupdate manual via inline edit. Tidak ada batch tracking, tidak ada audit trail untuk stok keluar, dan profit calculation tidak akurat karena COGS tidak terupdate otomatis.

#### Model Prisma: `StockBatch`
```
stock_batches
├── id, productId (FK), batchNo (auto: BATCH-YYYYMMDD-XXXX)
├── purchasePrice, quantity, originalQuantity
├── expiryDate (nullable), supplierName (nullable)
├── location (toko/gudang), unitType, notes
├── isActive (auto-false jika expired)
└── receivedAt, createdAt
```

#### Schema Changes

| Model | Field Baru | Fungsi |
|---|---|---|
| `StoreStockMovement` | `reason`, `reasonNote`, `batchId`, `costAtTime` | Audit trail lengkap |
| `StoreSaleItem` | `costPrice` | Snapshot HPP saat transaksi |

#### HPP Moving Average Formula
```
newCostPrice = (oldStock × oldCostPrice + newQty × purchasePrice) / (oldStock + newQty)
```

**Kategori Dikecualikan:** Produk seperti rokok (HET/manual pricing) tidak dihitung Moving Average. Daftar kategori diambil dari `app_settings` (`{unitType}_excluded_categories`).

**Auto Harga Jual:** `sellPrice = ceil((HPP × (1 + markup%) × (1 + PPN%)) / 100) × 100`

#### Stok Keluar (Writeoff)
- Dialog writeoff di persediaan dengan pilihan alasan: Rusak/Hilang, Kadaluarsa, Pemakaian Internal, Lainnya
- Semua operasi multi-tabel dibungkus `prisma.$transaction` (atomic)
- `costAtTime` di-snapshot untuk audit trail

#### FIFO Batch Deduction saat Penjualan
- Saat checkout, sistem mengurangi oldest active batch first (`ORDER BY receivedAt ASC`)
- `costPrice` di-snapshot di `StoreSaleItem` untuk historical accuracy

#### Laporan
`/api/unit/[slug]/laporan` sekarang mengembalikan: `totalHPP`, `totalWriteOff`, `netProfit`

---

### 10.3 Tahap 3 — Batch & Expiry Tracking

#### Batch Management Page
- **URL**: `/toko/batch` — navigasi "Manajemen Batch" (icon Layers) di sidebar toko
- **4 Tab View**: Aktif, Hampir Expired, Expired, Semua
- **Summary Cards**: Jumlah batch aktif, hampir expired, expired
- **Tabel**: Batch number, produk, harga beli, qty, tanggal expired (badge warna), supplier, status

#### Auto Batch Number
Format: `BATCH-YYYYMMDD-XXXX` (contoh: `BATCH-20260430-0001`)
- Di-generate transactionally saat `batchNo` tidak disediakan
- Sequence counter di-reset per hari

#### Expiry System
- **Lazy expiry check**: Batches di-auto-expire saat halaman batch diakses (bukan cron job)
- **Expiring soon notification**: Batch dengan expiry ≤ 90 hari → notifikasi ke semua admin
- **Deduplication**: Cek existing notification sebelum kirim baru (7-day window untuk expiring_soon, lifetime untuk batch_expired)

---

### 10.4 Perbaikan Bug Post-Implementation

| Bug | Masalah | Solusi |
|---|---|---|
| **Duplikat Button** | Dua tombol "Stok Masuk" identik di persediaan | Hapus duplikat DialogTrigger |
| **Transaction Safety** | Transfer + stock-out/writeoff di luar `$transaction` | Wrap semua multi-table ops dalam `$transaction` |
| **Low Stock False Alert** | Notifikasi stok rendah saat deduct dari Gudang (stockToko tidak berubah) | Tambah kondisi `stockLocation === "toko"` |
| **Notification Spam** | Auto-expire re-notify semua batch expired setiap GET | Deduplication via `findFirst` cek sebelum create |
| **Delete Unread Count** | Hapus notifikasi unread tidak decrement counter | Cek `isRead` sebelum filter, decrement jika unread |
| **Icon Color Fragile** | String manipulation `replace("bg-","text-")` untuk warna icon | Explicit `typeIconColors` mapping per tipe |
| **Shift Label Off-by-One** | Label shift menampilkan `endHour:59` padahal `endHour` exclusive | Fix: `(endHour === 0 ? 23 : endHour - 1):59` |
| **Shift Detail Overflow** | Tabel 7 kolom overflow di `max-w-3xl` dialog | Lebar `max-w-4xl`, 5 kolom, kolom gabungan "Info" |

### File Terkait (Ketiga Tahap)

| File | Fungsi |
|---|---|
| `prisma/schema.prisma` | Model Notification, StockBatch; field baru di StoreStockMovement & StoreSaleItem |
| `src/lib/notifications.ts` | Helper createNotification + Expo push |
| `src/app/api/notifications/route.ts` | GET notifikasi dengan pagination & filter |
| `src/app/api/notifications/read/route.ts` | PUT mark all read |
| `src/app/api/notifications/[id]/read/route.ts` | PUT mark single read |
| `src/app/api/notifications/[id]/route.ts` | PUT read + DELETE |
| `src/components/patterns/notification-bell.tsx` | Popover notifikasi di topbar |
| `src/app/(protected)/notifikasi/page.tsx` | Halaman notifikasi penuh |
| `src/app/api/toko/products/[id]/stock/route.ts` | HPP Moving Average, batch creation, writeoff, transfer (atomic) |
| `src/app/api/toko/sales/route.ts` | FIFO batch deduction, costPrice snapshot, low stock notification |
| `src/app/api/toko/batches/route.ts` | Batch listing, auto-expire, deduplicated notifications |
| `src/app/(protected)/toko/batch/page.tsx` | Batch management UI (4 tabs, search, pagination) |
| `src/app/(protected)/toko/persediaan/page.tsx` | Dialog stok masuk (HPP fields), writeoff dialog |
| `src/app/api/unit-transactions/void-request/route.ts` | Void request notifications ke admin |
| `src/app/api/unit/[slug]/laporan/route.ts` | totalHPP, totalWriteOff, netProfit |
| `src/lib/shift-schedule.ts` | Fix formatShiftLabel off-by-one |
| `src/app/(protected)/toko/shift/page.tsx` | Fix shift label + detail dialog layout |
| `src/components/layout/topbar.tsx` | NotificationBell menggantikan Bell icon mati |
| `src/lib/constants/navigation.ts` | Menu "Manajemen Batch" dengan Layers icon |

---
*Dokumentasi ini adalah Single Source of Truth terbaru untuk operasional modul Toko (Supermarket/Retail). Apabila terdapat kendala teknis atau feature-request di masa depan terkait Toko Prima Pagi, harap referensikan ke file ini.*
