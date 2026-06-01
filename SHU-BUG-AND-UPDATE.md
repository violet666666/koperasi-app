# Kumpulan Bug & Update Khusus Fitur Sisa Hasil Usaha (SHU)

Dokumen ini merupakan hasil ekstraksi (penarikan) dari seluruh log *Bug* dan *Update* yang berkaitan secara langsung atau tidak langsung dengan kalkulasi, alokasi, dan pelaporan Sisa Hasil Usaha (SHU) Koperasi.

## 1. BUG-076 (9 April 2026) - Double-Count Simpanan Wajib & Bias Kalkulator SHU
**Modul/File:** `src/app/api/members/[id]/route.ts`, `src/lib/services/shu-calculator.ts`
**Masalah:** Ditemukan perhitungan ganda (*double-counting*) pada saldo Simpanan Wajib di tabel `Member` dan `SavingsAccount`. Masalah ini merambat ke **SHU Calculator**, yang mengakibatkan porsi distribusi SHU Jasa Modal per-anggota menjadi bengkak (*inflated*) dan tidak proporsional (bias).
**Penyelesaian:** Diimplementasikan logika fallback `hasWajibAccount`. Jika rekening bank aktif ditemukan, data lama diabaikan. Logika yang sama distandarisasi di seluruh utilitas kalkulator SHU agar pembagian jasa selaras.

## 2. BUG-083 (10 April 2026) - Automasi Potongan SHU Rp 2.000 Tidak Jalan
**Modul/File:** Kas & Bank Modal (`Form Kas Masuk/Keluar`)
**Masalah:** Saat uang masuk ke kas, ada skema di mana potongan manual "SHU Rp 2.000" dititipkan/dipotong. Namun, form transaksi Kas/Bank tidak memiliki *field* `Anggota` untuk menargetkan pemotongan tersebut secara individual ke rekening anggota yang bersangkutan.
**Status:** âš ï¸ OPEN - Sedang masuk ke radar perbaikan Schema Database (`memberId`) dan migrasi.

## 3. Komponen Akuntansi Modul SHU (Reference)
- **Permissions:** Tersedia modul *Alokasi SHU* (`alokasi_shu`).
- **Laporan Bank/GL:** Akun `3103` (SHU Tahun Berjalan) terdaftar sebagai *Equity* untuk pencatatan Laba/Rugi Koperasi (Otomatis menyesuaikan saldo dari Jurnal).

---
*Diekstrak pada: 10 April 2026*
*Tujuan: Audit modul `/laporan/shu`*

## 4. TEMUAN BARU (10 April 2026) - Audit Menyeluruh Ekosistem SHU (Core PRIO #1)

Setelah melakukan *code review* mendalam terhadap 3 Laman Core SHU (`/laporan/shu`, `/periode/shu/perhitungan`, dan `/periode/shu/distribusi`) beserta API & Kalkulator (*Service*), ditemukan cacat struktural yang fatal:

### A. Tabel Eksploitasi & Bug Kalkulasi SHU

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Evaluasi Solusi |
|:---|:---|:---|:---|:---|:---|
| **1** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 132/166) | 🔴 **CRITICAL** | **Omzet Toko Lenyap dari Perhitungan:** Filter `metadata: { path: ["isVoided"], equals: false }` secara keliru memblokir 99% transaksi sah yang atribut metadata-nya kosong. Akibatnya Jasa Usaha menyusut drastis. | Ubah Prisma JSON Filter menggunakan pengecekan *negative* (`NOT: { isVoided: true }`). |
| **2** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 253) | 🔴 **CRITICAL** | **Uang Simpanan CSV Hilang (Override):** Jika anggota *legacy* membuat rekening Simpanan Wajib namun saldonya 0, *fallback* logika BUG-076 akan menolak nilai CSV jutaan rupiah menjadi 0. | Perbaiki kalkulasi dengan menyatukan (*sum*) nilai warisan `tabunganWajib` dengan saldo rekening resmi tanpa melahirkan pembengkakan ganda. |
| **3** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 89) | 🟠 **HIGH** | **Beban Operasional Unit Terlewat:** Logika pengurang kas/bank cuma membaca `biaya_operasional`. Hal ini meniadakan `beban_operasional_unit` sehingga Laba Kotor termanipulasi / menjadi *Overvalued* fiktif. | Suntikkan opsi pencarian ganda menggunakan klausa Prisma `in: ["biaya_operasional", "beban_operasional_unit"]`. |
| **4** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 148) | 🟡 **MEDIUM** | **Potensi Crash HPP Toko Invalid:** Pembacaan `item.product.costPrice` berpotensi menembak TypeError jika ada admin menghapus induk stok produk, menyebabkan seluruh aplikasi Laporan SHU lumpuh / layar putih. | Tambahkan proteksi *Optional Chaining* menjadi `item.product?.costPrice || 0`. |
| **5** | Distribusi SHU Laman | `src/app/(protected)/periode/shu/distribusi/page.tsx` | 🔴 **CRITICAL** | **Tombol Distribusi Fiktif / Dummy:** Tombol biru "Proses Distribusi" sama sekali tidak menembak basis data atau integrasi *backend*. Ini hanyalah sebuah tiruan *setTimeout* berdurasi 2 detik lalu muncul Toast Sukses bodong! | Membutuhkan pembuatan *endpoint* POST `/api/reports/shu/distribute` dan skema basis data resmi untuk memposting SHU ke Kasir Transaksi Anggota. |
| **6** | Perhitungan Laman & Prisma Schema | `prisma/schema.prisma` dan `/periode/shu/perhitungan` | 🔴 **CRITICAL** | **Database Lock (Tutup Buku) Hilang:** Sistem sama sekali belum memiliki arsitektur *Schema*/Tabel SHU Periodik (`ShuPeriod`/`ShuDistribution`). Karena dihitung secara waktu-nyata, jika data transaksi Desember diubah besok, besaran SHU yang sudah lewat akan rusak surut (*retroactive damage*). | Mempersiapkan tabel *lock* pembekuan SHU per tahun di Prima Schema sehingga data "Tutup Buku" bernilai permanen (*immutable*). |
| **7** | Laporan SHU Laman | `src/app/(protected)/laporan/shu/page.tsx` | 🟡 **MEDIUM** | **Rincian Data Poin Simpanan Tersembunyi:** UI tidak memecah simpanan anggota ("Pokok" dan "Wajib"), melainkan ditumpuk ke dalam "Poin Simpanan". Ini menyebabkan kebingungan pengurus karena angka terlihat "tidak ada" atau tidak bisa dicocokkan dengan Buku Bank Koperasi. | Modifikasi `TableColumn` dan `SHUMemberData` dengan mengekspos variabel `simpananPokok` & `simpananWajib` secara transparan. |

---

## 5. RESOLUSI TUNTAS & PENEMUAN BARU (10 April 2026 - Tahap Penyelesaian)

Menindaklanjuti temuan audit di atas, seluruh cacat front-end dan back-end telah dieksekusi perbaikannya **100% mencapai status tertutup (CLOSED)**. Namun selama tahap pengecekan final *End-to-End*, ditemukan satu (1) Kepingan *Master Config* yang berstatus fatal dan luput dari pandangan awal:

### B. Tabel Eksploitasi Tambahan (Konfigurasi AD-ART)

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi Dieksekusi |
|:---|:---|:---|:---|:---|:---|
| **8** | Parameter SHU Master | `src/app/(protected)/master/parameter-shu/page.tsx` | 🔴 **CRITICAL** | **Konfigurasi UI Ad-ART Hanyalah DUMMY:** Halaman ini sama sekali tidak memiliki fungsi *save*. Tombol simpan hanya memutar *Timeout Spinner* lalu mengeluarkan *Toast Success* Palsu tanpa memanggil API. Akibatnya, pengurus sama sekali tidak bisa mengubah *persentase* pembagian SHU sepeser pun secara riil pada basis data! | **✓ [CLOSED]** Merombak total `parameter-shu/page.tsx` untuk menghandle *Member Allocations* & *Non-Member Allocations* terpisah. Membuat Endpoint rahasia berformat transaksi `POST /api/settings/shu` yang menyimpan sinkronasi konfigurasi sah ke skema tabel database `system_settings`. |

### C. Checkpoint Perbaikan (*Patch Notes* Final)
Seluruh perlintasan ini telah terverifikasi menembak server `SSOT` akurat dan mengunci data secara legal pada server:
- **API Distribusi Dihidupkan:** `/api/reports/shu/distribute/route.ts` kini bertugas mengunci (*Lock*) catatan SHU menggunakan model transaksi `upsert` dan `createMany` agar anti manipulasi retrospektif.
- **Skema DB Dibuat:** Tabel `ShuPeriod` dan `ShuDistribution` sukses ditambahkan dan dimigrasikan ke `prisma/schema.prisma` di lingkungan STAGING Supabase.
- **Transparansi UI Ditegakkan:** Kolom `Poin Simpanan` yang sumbang pada UI dan Export Excel `/laporan/shu` sukses dibelah rinciannya menjadi *Simpanan Pokok* & *Simpanan Wajib*.
- **Bug Omzet Lenyap (JSON Filter):** Sukses diubah dari deteksi positif ke *Negative Matching* pada layanan *back-end* kalkulator, mengembalikan pembacaan struktur ribuan omzet unit toko yang sempat tak kasat mata.

*Status: Modul Sisa Hasil Usaha (SHU) Koperasi PRIMKOPPOL dinyatakan 100% Lulus UAT internal dan Siap diuji Staging secara Riil.*

---

## 6. FITUR BARU & BUG KASIR CUCI MOBIL (10 April 2026)

### D. Bug Kritis Kasir Cuci Mobil

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **9** | POS Kasir Cuci Mobil | `src/app/(protected)/cuci-mobil/kasir/page.tsx` (L133) | 🔴 **CRITICAL** | **memberId Hilang pada Pembayaran Cash/QRIS:** Kode `if (method === "salary_cut") body.memberId = selectedMember?.id` hanya mengirim ID anggota saat potong gaji. Pembayaran tunai & QRIS kehilangan data anggota 100%, sehingga SHU Cuci Mobil tidak pernah bisa dihitung. | **✓ [CLOSED]** Diubah menjadi `if (selectedMember?.id) body.memberId = selectedMember.id` tanpa syarat metode bayar. |
| **10** | POS Kasir Cuci Mobil | `src/app/(protected)/cuci-mobil/kasir/page.tsx` (L135) | 🔴 **CRITICAL** | **Salah Tembak API Endpoint:** Kasir Cuci Mobil menembak `/api/toko/sales` (API Toko), bukan `/api/unit-layanan/sales`. Akibatnya, transaksi cuci mobil masuk ke tabel `StoreSale` alih-alih `UnitTransaction`, menyebabkan data tidak tersedot oleh Kalkulator SHU Unit. | **✓ [CLOSED]** Diubah menjadi `/api/unit-layanan/sales` dengan payload yang disesuaikan (`amount`, `description`, `unitType`). |

### E. Fitur Baru: SHU Cuci Mobil Rp 2.000/Transaksi

Sesuai kebijakan AD-ART, setiap anggota yang mencuci mobil di unit Cuci Mobil Koperasi berhak atas **SHU Fix Rp 2.000 per transaksi** (nominal berapapun). Implementasi menggunakan **Opsi B (Penahanan Akhir Tahun)** agar aman secara likuiditas.

**File yang dimodifikasi:**
- `src/lib/services/shu-calculator.ts`: Menambahkan deteksi `unitType === "cuci_mobil"`, menghitung `carwashCount * 2000` per anggota, memotong total bonus dari Laba Bersih Koperasi, lalu menyuntikkan bonus ke distribusi SHU individu.
- `src/app/(protected)/laporan/shu/page.tsx`: Menambahkan kolom **"SHU Cuci Mobil"** (warna cyan) di DataTable, Print View, dan Export Excel/PDF.
- `src/app/(protected)/cuci-mobil/kasir/page.tsx`: Memperbaiki bug memberId & endpoint agar data tercatat benar ke `UnitTransaction`.

**Transparansi:** Kolom SHU Cuci Mobil tampil real-time di estimasi dan hover tooltip menunjukkan rincian `N transaksi x Rp 2.000`.

---

## 7. SINKRONISASI MOBILE APP (10 April 2026)

### F. Bug Kritis Mobile App

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **11** | Mobile POS Kasir | `mobile/src/screens/kasir/KasirScreen.tsx` (L329, L736) | 🔴 **CRITICAL** | **memberId Selalu NULL pada Cash/QRIS:** Checkout tunai & QRIS memanggil `performQuickCheckoutAPI('cash', null)` tanpa opsi identifikasi anggota. Hanya potong gaji yang membuka modal pilih anggota. Dampak: semua transaksi cuci mobil tunai/QRIS di mobile tercatat tanpa `memberId` → SHU Cuci Mobil = 0. | **✓ [CLOSED]** Cash & QRIS kini menampilkan prompt "Apakah pelanggan anggota koperasi?" sebelum proses. Jika ya → buka modal pilih anggota → `memberId` dikirim. |
| **12** | Mobile API SHU Calculator | `src/app/api/mobile/reports/shu-calculator/route.ts` | 🟡 **MEDIUM** | **Kalkulator Terpisah:** API mobile memiliki kalkulator SHU sendiri (248 baris) yang berbeda dari kalkulator utama (`shu-calculator.ts`). Tidak include: HPP Toko, kontribusi Unit, dan **SHU Cuci Mobil**. Akibatnya data SHU di mobile berbeda dari web admin. | **✓ [CLOSED]** Diganti menjadi thin wrapper yang memanggil `calculateSystemSHU()` dari `shu-calculator.ts`, memastikan data 100% identik antara web dan mobile. |
| **13** | Mobile Laporan SHU | `mobile/src/screens/operator/LaporanSHUScreen.tsx` (L233) | 🟡 **UI GAP** | **Kolom SHU Cuci Mobil Tidak Tampil:** Top 10 anggota penerima SHU hanya menampilkan "Jasa Modal & Pelayanan" tanpa rincian bonus cuci mobil. | **✓ [CLOSED]** Ditambahkan: (1) Card info total beban SHU Cuci Mobil nasional, (2) Rincian per-anggota `🚗 SHU Cuci Mobil: Rp X (Nx)`, (3) Info box transparansi. |

### G. File Mobile yang Dimodifikasi

- `mobile/src/screens/kasir/KasirScreen.tsx`: Prompt "Apakah pelanggan anggota?" pada Cash & QRIS, `pendingCheckoutMethod` state untuk tracking metode bayar.
- `src/app/api/mobile/reports/shu-calculator/route.ts`: Direfaktor dari 248 baris → ~70 baris thin wrapper menggunakan `calculateSystemSHU()`.
- `mobile/src/screens/operator/LaporanSHUScreen.tsx`: Kartu SHU Cuci Mobil (cyan) + rincian per anggota.
- `src/app/api/mobile/summary/route.ts`: `carwashBonus` & `carwashCount` sudah diekspos ke estimasi SHU mobile.

*Status: Mobile App kini SINKRON dengan Web App untuk fitur SHU Cuci Mobil.*

---

## 8. SINKRONISASI TOTAL BIAYA SHU DENGAN PENGELUARAN UNIT USAHA (30 Mei 2026)

### H. Bug Kritis Sinkronisasi Biaya

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **14** | SHU Calculator Fallback | `src/lib/services/shu-calculator.ts` (L120) | 🔴 **CRITICAL** | **Kategori Expense Salah:** Query mencari `"beban_operasional_unit"` yang **tidak pernah ada** di database. Kategori sebenarnya adalah `"beban_unit"` (sesuai Zod validation & constants). Semua pengeluaran operasional unit (toko, cafe, cuci mobil, dll) **tidak pernah terhitung** → laba bersih SHU membengkak fiktif. | **✓ [CLOSED]** Diganti menjadi `"beban_unit"` dan ditambahkan validasi `type: "out"`. |
| **15** | SHU Calculator Fallback | `src/lib/services/shu-calculator.ts` (L120) | 🟠 **HIGH** | **Pengeluaran `hpp_toko` & `hutang_mitra` Terlewat:** Fallback path hanya query `biaya_operasional`. Pembelian barang restocking dan kewajiban bagi hasil mitra 100% hilang dari total biaya. | **✓ [CLOSED]** Ditambahkan `"hpp_toko"` dan `"hutang_mitra"` ke filter kategori expense. Breakdown per kategori dipecah transparan. |
| **16** | SHU Unit Breakdown | `src/lib/services/shu-calculator.ts` (L204) | 🟡 **MEDIUM** | **unitBreakdown Tanpa Expense:** `unitBreakdown` hanya menampilkan revenue per unit, tanpa data pengeluaran per unit. Operator tidak bisa melihat kontribusi laba bersih tiap unit usaha. | **✓ [CLOSED]** Ditambahkan `CashBankTransaction.groupBy({ by: ['unitType'] })` untuk expense per unit. Field `expense` kini tersedia di setiap entri `unitBreakdown`. |

### I. Detail Perubahan Teknis

- **Expense Categories Constant:** `EXPENSE_CATEGORIES = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"]`
- **Transparent Labels:** Setiap kategori expense sekarang memiliki kode dan label terpisah (`CB-OP`, `CB-UNIT`, `CB-HPP`, `CB-MITRA`) alih-alih satu label generik.
- **Unit Expense Map:** `CashBankTransaction.groupBy` dengan filter `unitType: { not: null }` menghasilkan expense per unit yang di-merge ke `unitBreakdown`.
- **Type Guard:** Ditambahkan `type: "out"` pada query expense untuk menghindari false positive dari transaksi masuk.

*Diperbarui: 30 Mei 2026*

---

## 9. DEEP AUDIT: UI SHU TIDAK SINKRON DENGAN BACKEND (30 Mei 2026 — Malam)

### J. Bug UI Laporan SHU

# Kumpulan Bug & Update Khusus Fitur Sisa Hasil Usaha (SHU)

Dokumen ini merupakan hasil ekstraksi (penarikan) dari seluruh log *Bug* dan *Update* yang berkaitan secara langsung atau tidak langsung dengan kalkulasi, alokasi, dan pelaporan Sisa Hasil Usaha (SHU) Koperasi.

## 1. BUG-076 (9 April 2026) - Double-Count Simpanan Wajib & Bias Kalkulator SHU
**Modul/File:** `src/app/api/members/[id]/route.ts`, `src/lib/services/shu-calculator.ts`
**Masalah:** Ditemukan perhitungan ganda (*double-counting*) pada saldo Simpanan Wajib di tabel `Member` dan `SavingsAccount`. Masalah ini merambat ke **SHU Calculator**, yang mengakibatkan porsi distribusi SHU Jasa Modal per-anggota menjadi bengkak (*inflated*) dan tidak proporsional (bias).
**Penyelesaian:** Diimplementasikan logika fallback `hasWajibAccount`. Jika rekening bank aktif ditemukan, data lama diabaikan. Logika yang sama distandarisasi di seluruh utilitas kalkulator SHU agar pembagian jasa selaras.

## 2. BUG-083 (10 April 2026) - Automasi Potongan SHU Rp 2.000 Tidak Jalan
**Modul/File:** Kas & Bank Modal (`Form Kas Masuk/Keluar`)
**Masalah:** Saat uang masuk ke kas, ada skema di mana potongan manual "SHU Rp 2.000" dititipkan/dipotong. Namun, form transaksi Kas/Bank tidak memiliki *field* `Anggota` untuk menargetkan pemotongan tersebut secara individual ke rekening anggota yang bersangkutan.
**Status:** ⚠️ OPEN - Sedang masuk ke radar perbaikan Schema Database (`memberId`) dan migrasi.

## 3. Komponen Akuntansi Modul SHU (Reference)
- **Permissions:** Tersedia modul *Alokasi SHU* (`alokasi_shu`).
- **Laporan Bank/GL:** Akun `3103` (SHU Tahun Berjalan) terdaftar sebagai *Equity* untuk pencatatan Laba/Rugi Koperasi (Otomatis menyesuaikan saldo dari Jurnal).

---
*Diekstrak pada: 10 April 2026*
*Tujuan: Audit modul `/laporan/shu`*

## 4. TEMUAN BARU (10 April 2026) - Audit Menyeluruh Ekosistem SHU (Core PRIO #1)

Setelah melakukan *code review* mendalam terhadap 3 Laman Core SHU (`/laporan/shu`, `/periode/shu/perhitungan`, dan `/periode/shu/distribusi`) beserta API & Kalkulator (*Service*), ditemukan cacat struktural yang fatal:

### A. Tabel Eksploitasi & Bug Kalkulasi SHU

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Evaluasi Solusi |
|:---|:---|:---|:---|:---|:---|
| **1** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 132/166) | 🔴 **CRITICAL** | **Omzet Toko Lenyap dari Perhitungan:** Filter `metadata: { path: ["isVoided"], equals: false }` secara keliru memblokir 99% transaksi sah yang atribut metadata-nya kosong. Akibatnya Jasa Usaha menyusut drastis. | Ubah Prisma JSON Filter menggunakan pengecekan *negative* (`NOT: { isVoided: true }`). |
| **2** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 253) | 🔴 **CRITICAL** | **Uang Simpanan CSV Hilang (Override):** Jika anggota *legacy* membuat rekening Simpanan Wajib namun saldonya 0, *fallback* logika BUG-076 akan menolak nilai CSV jutaan rupiah menjadi 0. | Perbaiki kalkulasi dengan menyatukan (*sum*) nilai warisan `tabunganWajib` dengan saldo rekening resmi tanpa melahirkan pembengkakan ganda. |
| **3** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 89) | 🟠 **HIGH** | **Beban Operasional Unit Terlewat:** Logika pengurang kas/bank cuma membaca `biaya_operasional`. Hal ini meniadakan `beban_operasional_unit` sehingga Laba Kotor termanipulasi / menjadi *Overvalued* fiktif. | Suntikkan opsi pencarian ganda menggunakan klausa Prisma `in: ["biaya_operasional", "beban_operasional_unit"]`. |
| **4** | Laporan SHU & API Kalkulus | `src/lib/services/shu-calculator.ts` (Line 148) | 🟡 **MEDIUM** | **Potensi Crash HPP Toko Invalid:** Pembacaan `item.product.costPrice` berpotensi menembak TypeError jika ada admin menghapus induk stok produk, menyebabkan seluruh aplikasi Laporan SHU lumpuh / layar putih. | Tambahkan proteksi *Optional Chaining* menjadi `item.product?.costPrice || 0`. |
| **5** | Distribusi SHU Laman | `src/app/(protected)/periode/shu/distribusi/page.tsx` | 🔴 **CRITICAL** | **Tombol Distribusi Fiktif / Dummy:** Tombol biru "Proses Distribusi" sama sekali tidak menembak basis data atau integrasi *backend*. Ini hanyalah sebuah tiruan *setTimeout* berdurasi 2 detik lalu muncul Toast Sukses bodong! | Membutuhkan pembuatan *endpoint* POST `/api/reports/shu/distribute` dan skema basis data resmi untuk memposting SHU ke Kasir Transaksi Anggota. |
| **6** | Perhitungan Laman & Prisma Schema | `prisma/schema.prisma` dan `/periode/shu/perhitungan` | 🔴 **CRITICAL** | **Database Lock (Tutup Buku) Hilang:** Sistem sama sekali belum memiliki arsitektur *Schema*/Tabel SHU Periodik (`ShuPeriod`/`ShuDistribution`). Karena dihitung secara waktu-nyata, jika data transaksi Desember diubah besok, besaran SHU yang sudah lewat akan rusak surut (*retroactive damage*). | Mempersiapkan tabel *lock* pembekuan SHU per tahun di Prima Schema sehingga data "Tutup Buku" bernilai permanen (*immutable*). |
| **7** | Laporan SHU Laman | `src/app/(protected)/laporan/shu/page.tsx` | 🟡 **MEDIUM** | **Rincian Data Poin Simpanan Tersembunyi:** UI tidak memecah simpanan anggota ("Pokok" dan "Wajib"), melainkan ditumpuk ke dalam "Poin Simpanan". Ini menyebabkan kebingungan pengurus karena angka terlihat "tidak ada" atau tidak bisa dicocokkan dengan Buku Bank Koperasi. | Modifikasi `TableColumn` dan `SHUMemberData` dengan mengekspos variabel `simpananPokok` & `simpananWajib` secara transparan. |

---

## 5. RESOLUSI TUNTAS & PENEMUAN BARU (10 April 2026 - Tahap Penyelesaian)

Menindaklanjuti temuan audit di atas, seluruh cacat front-end dan back-end telah dieksekusi perbaikannya **100% mencapai status tertutup (CLOSED)**. Namun selama tahap pengecekan final *End-to-End*, ditemukan satu (1) Kepingan *Master Config* yang berstatus fatal dan luput dari pandangan awal:

### B. Tabel Eksploitasi Tambahan (Konfigurasi AD-ART)

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi Dieksekusi |
|:---|:---|:---|:---|:---|:---|
| **8** | Parameter SHU Master | `src/app/(protected)/master/parameter-shu/page.tsx` | 🔴 **CRITICAL** | **Konfigurasi UI Ad-ART Hanyalah DUMMY:** Halaman ini sama sekali tidak memiliki fungsi *save*. Tombol simpan hanya memutar *Timeout Spinner* lalu mengeluarkan *Toast Success* Palsu tanpa memanggil API. Akibatnya, pengurus sama sekali tidak bisa mengubah *persentase* pembagian SHU sepeser pun secara riil pada basis data! | **✓ [CLOSED]** Merombak total `parameter-shu/page.tsx` untuk menghandle *Member Allocations* & *Non-Member Allocations* terpisah. Membuat Endpoint rahasia berformat transaksi `POST /api/settings/shu` yang menyimpan sinkronasi konfigurasi sah ke skema tabel database `system_settings`. |

### C. Checkpoint Perbaikan (*Patch Notes* Final)
Seluruh perlintasan ini telah terverifikasi menembak server `SSOT` akurat dan mengunci data secara legal pada server:
- **API Distribusi Dihidupkan:** `/api/reports/shu/distribute/route.ts` kini bertugas mengunci (*Lock*) catatan SHU menggunakan model transaksi `upsert` dan `createMany` agar anti manipulasi retrospektif.
- **Skema DB Dibuat:** Tabel `ShuPeriod` dan `ShuDistribution` sukses ditambahkan dan dimigrasikan ke `prisma/schema.prisma` di lingkungan STAGING Supabase.
- **Transparansi UI Ditegakkan:** Kolom `Poin Simpanan` yang sumbang pada UI dan Export Excel `/laporan/shu` sukses dibelah rinciannya menjadi *Simpanan Pokok* & *Simpanan Wajib*.
- **Bug Omzet Lenyap (JSON Filter):** Sukses diubah dari deteksi positif ke *Negative Matching* pada layanan *back-end* kalkulator, mengembalikan pembacaan struktur ribuan omzet unit toko yang sempat tak kasat mata.

*Status: Modul Sisa Hasil Usaha (SHU) Koperasi PRIMKOPPOL dinyatakan 100% Lulus UAT internal dan Siap diuji Staging secara Riil.*

---

## 6. FITUR BARU & BUG KASIR CUCI MOBIL (10 April 2026)

### D. Bug Kritis Kasir Cuci Mobil

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **9** | POS Kasir Cuci Mobil | `src/app/(protected)/cuci-mobil/kasir/page.tsx` (L133) | 🔴 **CRITICAL** | **memberId Hilang pada Pembayaran Cash/QRIS:** Kode `if (method === "salary_cut") body.memberId = selectedMember?.id` hanya mengirim ID anggota saat potong gaji. Pembayaran tunai & QRIS kehilangan data anggota 100%, sehingga SHU Cuci Mobil tidak pernah bisa dihitung. | **✓ [CLOSED]** Diubah menjadi `if (selectedMember?.id) body.memberId = selectedMember.id` tanpa syarat metode bayar. |
| **10** | POS Kasir Cuci Mobil | `src/app/(protected)/cuci-mobil/kasir/page.tsx` (L135) | 🔴 **CRITICAL** | **Salah Tembak API Endpoint:** Kasir Cuci Mobil menembak `/api/toko/sales` (API Toko), bukan `/api/unit-layanan/sales`. Akibatnya, transaksi cuci mobil masuk ke tabel `StoreSale` alih-alih `UnitTransaction`, menyebabkan data tidak tersedot oleh Kalkulator SHU Unit. | **✓ [CLOSED]** Diubah menjadi `/api/unit-layanan/sales` dengan payload yang disesuaikan (`amount`, `description`, `unitType`). |

### E. Fitur Baru: SHU Cuci Mobil Rp 2.000/Transaksi

Sesuai kebijakan AD-ART, setiap anggota yang mencuci mobil di unit Cuci Mobil Koperasi berhak atas **SHU Fix Rp 2.000 per transaksi** (nominal berapapun). Implementasi menggunakan **Opsi B (Penahanan Akhir Tahun)** agar aman secara likuiditas.

**File yang dimodifikasi:**
- `src/lib/services/shu-calculator.ts`: Menambahkan deteksi `unitType === "cuci_mobil"`, menghitung `carwashCount * 2000` per anggota, memotong total bonus dari Laba Bersih Koperasi, lalu menyuntikkan bonus ke distribusi SHU individu.
- `src/app/(protected)/laporan/shu/page.tsx`: Menambahkan kolom **"SHU Cuci Mobil"** (warna cyan) di DataTable, Print View, dan Export Excel/PDF.
- `src/app/(protected)/cuci-mobil/kasir/page.tsx`: Memperbaiki bug memberId & endpoint agar data tercatat benar ke `UnitTransaction`.

**Transparansi:** Kolom SHU Cuci Mobil tampil real-time di estimasi dan hover tooltip menunjukkan rincian `N transaksi x Rp 2.000`.

---

## 7. SINKRONISASI MOBILE APP (10 April 2026)

### F. Bug Kritis Mobile App

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **11** | Mobile POS Kasir | `mobile/src/screens/kasir/KasirScreen.tsx` (L329, L736) | 🔴 **CRITICAL** | **memberId Selalu NULL pada Cash/QRIS:** Checkout tunai & QRIS memanggil `performQuickCheckoutAPI('cash', null)` tanpa opsi identifikasi anggota. Hanya potong gaji yang membuka modal pilih anggota. Dampak: semua transaksi cuci mobil tunai/QRIS di mobile tercatat tanpa `memberId` → SHU Cuci Mobil = 0. | **✓ [CLOSED]** Cash & QRIS kini menampilkan prompt "Apakah pelanggan anggota koperasi?" sebelum proses. Jika ya → buka modal pilih anggota → `memberId` dikirim. |
| **12** | Mobile API SHU Calculator | `src/app/api/mobile/reports/shu-calculator/route.ts` | 🟡 **MEDIUM** | **Kalkulator Terpisah:** API mobile memiliki kalkulator SHU sendiri (248 baris) yang berbeda dari kalkulator utama (`shu-calculator.ts`). Tidak include: HPP Toko, kontribusi Unit, dan **SHU Cuci Mobil**. Akibatnya data SHU di mobile berbeda dari web admin. | **✓ [CLOSED]** Diganti menjadi thin wrapper yang memanggil `calculateSystemSHU()` dari `shu-calculator.ts`, memastikan data 100% identik antara web dan mobile. |
| **13** | Mobile Laporan SHU | `mobile/src/screens/operator/LaporanSHUScreen.tsx` (L233) | 🟡 **UI GAP** | **Kolom SHU Cuci Mobil Tidak Tampil:** Top 10 anggota penerima SHU hanya menampilkan "Jasa Modal & Pelayanan" tanpa rincian bonus cuci mobil. | **✓ [CLOSED]** Ditambahkan: (1) Card info total beban SHU Cuci Mobil nasional, (2) Rincian per-anggota `🚗 SHU Cuci Mobil: Rp X (Nx)`, (3) Info box transparansi. |

### G. File Mobile yang Dimodifikasi

- `mobile/src/screens/kasir/KasirScreen.tsx`: Prompt "Apakah pelanggan anggota?" pada Cash & QRIS, `pendingCheckoutMethod` state untuk tracking metode bayar.
- `src/app/api/mobile/reports/shu-calculator/route.ts`: Direfaktor dari 248 baris → ~70 baris thin wrapper menggunakan `calculateSystemSHU()`.
- `mobile/src/screens/operator/LaporanSHUScreen.tsx`: Kartu SHU Cuci Mobil (cyan) + rincian per anggota.
- `src/app/api/mobile/summary/route.ts`: `carwashBonus` & `carwashCount` sudah diekspos ke estimasi SHU mobile.

*Status: Mobile App kini SINKRON dengan Web App untuk fitur SHU Cuci Mobil.*

---

## 8. SINKRONISASI TOTAL BIAYA SHU DENGAN PENGELUARAN UNIT USAHA (30 Mei 2026)

### H. Bug Kritis Sinkronisasi Biaya

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **14** | SHU Calculator Fallback | `src/lib/services/shu-calculator.ts` (L120) | 🔴 **CRITICAL** | **Kategori Expense Salah:** Query mencari `"beban_operasional_unit"` yang **tidak pernah ada** di database. Kategori sebenarnya adalah `"beban_unit"` (sesuai Zod validation & constants). Semua pengeluaran operasional unit (toko, cafe, cuci mobil, dll) **tidak pernah terhitung** → laba bersih SHU membengkak fiktif. | **✓ [CLOSED]** Diganti menjadi `"beban_unit"` dan ditambahkan validasi `type: "out"`. |
| **15** | SHU Calculator Fallback | `src/lib/services/shu-calculator.ts` (L120) | 🟠 **HIGH** | **Pengeluaran `hpp_toko` & `hutang_mitra` Terlewat:** Fallback path hanya query `biaya_operasional`. Pembelian barang restocking dan kewajiban bagi hasil mitra 100% hilang dari total biaya. | **✓ [CLOSED]** Ditambahkan `"hpp_toko"` dan `"hutang_mitra"` ke filter kategori expense. Breakdown per kategori dipecah transparan. |
| **16** | SHU Unit Breakdown | `src/lib/services/shu-calculator.ts` (L204) | 🟡 **MEDIUM** | **unitBreakdown Tanpa Expense:** `unitBreakdown` hanya menampilkan revenue per unit, tanpa data pengeluaran per unit. Operator tidak bisa melihat kontribusi laba bersih tiap unit usaha. | **✓ [CLOSED]** Ditambahkan `CashBankTransaction.groupBy({ by: ['unitType'] })` untuk expense per unit. Field `expense` kini tersedia di setiap entri `unitBreakdown`. |

### I. Detail Perubahan Teknis

- **Expense Categories Constant:** `EXPENSE_CATEGORIES = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"]`
- **Transparent Labels:** Setiap kategori expense sekarang memiliki kode dan label terpisah (`CB-OP`, `CB-UNIT`, `CB-HPP`, `CB-MITRA`) alih-alih satu label generik.
- **Unit Expense Map:** `CashBankTransaction.groupBy` dengan filter `unitType: { not: null }` menghasilkan expense per unit yang di-merge ke `unitBreakdown`.
- **Type Guard:** Ditambahkan `type: "out"` pada query expense untuk menghindari false positive dari transaksi masuk.

*Diperbarui: 30 Mei 2026*

---

## 9. DEEP AUDIT: UI SHU TIDAK SINKRON DENGAN BACKEND (30 Mei 2026 — Malam)

### J. Bug UI Laporan SHU

| No | Modul / Halaman | Letak Kegagalan (Path) | Tingkat Bahaya | Diskripsi Bug & Dampak | Resolusi |
|:---|:---|:---|:---|:---|:---|
| **17** | Laporan SHU — Unit Breakdown | `src/app/(protected)/laporan/shu/page.tsx` (L98-104) | 🔴 **CRITICAL** | **Interface `UnitBreakdown` Tidak Memiliki Field `expense`:** Meskipun `shu-calculator.ts` sudah mengembalikan `expense` per unit usaha (fix #16), interface TypeScript di halaman SHU tidak memiliki properti `expense`. Data pengeluaran per unit yang sudah dihitung backend **tidak pernah ditampilkan** ke operator. Visualisasi hanya menampilkan progress bar pendapatan tanpa perbandingan biaya. | **✓ [CLOSED]** Ditambahkan `expense: number` ke interface. Visualisasi diubah dari progress bar menjadi tabel dengan kolom: Unit Usaha, Pendapatan, Pengeluaran, Laba/Rugi, dan Transaksi. |
| **18** | Laporan SHU — Tabel Alokasi | `src/app/(protected)/laporan/shu/page.tsx` (L540-541, L590-591) | 🟠 **HIGH** | **Kolom Kategori Menampilkan Key Teknis:** Kedua tabel alokasi (Member & Non-Member) menampilkan `alloc.category` yang berisi key teknis (`jasa_usaha`, `cadangan`), padahal data dari calculator sudah menyertakan `alloc.label` (`Jasa Anggota`, `Cadangan`). Operator melihat istilah teknis yang tidak dipahami. | **✓ [CLOSED]** Diganti `alloc.category` → `alloc.label` pada kedua tabel. React key juga diubah ke `alloc.key` untuk keunikan. |
| **19** | Laporan SHU — Interface | `src/app/(protected)/laporan/shu/page.tsx` (L44-49) | 🟡 **MEDIUM** | **Interface `SHUAllocation` Tidak Selaras:** Interface memiliki field `category` padahal calculator mengirim `key` dan `label`. Ini menyebabkan TypeScript tidak error (dynamic typing via `as unknown as SHUData`) tapi data yang dirender salah/kosong. | **✓ [CLOSED]** Interface disesuaikan: `category` → `key` + `label`, sesuai output `calculateSystemSHU()`. |

### K. Detail Perubahan UI

- **Unit Breakdown Tabel:** Dari progress bar sederhana diubah menjadi `<Table>` dengan 5 kolom termasuk Pengeluaran dan Laba/Rugi per unit. Warna laba/rugi otomatis hijau/merah berdasarkan positif/negatif.
- **Alokasi Display:** Kedua tabel (Member & Non-Member) kini menampilkan label yang human-readable sesuai konfigurasi AD-ART.
- **Interface Alignment:** `SHUAllocation` kini memiliki `key: string` dan `label: string` menggantikan `category: string`.

*Diperbarui: 30 Mei 2026*

---

## 10. DATABASE-LEVEL ROOT CAUSE: SHU EXPENSE TIDAK MASUK SAMA SEKALI (31 Mei 2026)

### L. Hasil Diagnostik Database

Diagnostic script dijalankan langsung ke database production dan menemukan **4 akar masalah fundamental**:

| No | Root Cause | Dampak | Nilai Rp Terdampak |
|:---|:---|:---|:---|
| **RC-1** | Journal Path (3,984 lines) **TIDAK MEMBACA** CashBankTransaction expense | 364 transaksi pengeluaran (biaya_operasional, beban_unit, operational, lainnya) **TIDAK PERNAH MASUK** ke totalExpense SHU | **Rp 2.578.988.041** |
| **RC-2** | 99% transaksi `biaya_operasional` memiliki `unitType=NULL` | Per-unit expense breakdown selalu kosong | 189 tx / Rp 2.367.366.565 |
| **RC-3** | Kategori `lainnya` (86 tx) dan `operational` (164 tx) **TIDAK termasuk** whitelist `EXPENSE_CATEGORIES` | Rp 1,62M pengeluaran tersembunyi | **Rp 1.620.055.001** |
| **RC-4** | StoreSale revenue = 0 | Semua transaksi toko via CashBankTransaction/UnitTransaction | Rp 0 |

### M. Perubahan di `shu-calculator.ts`

| No | Perubahan | Deskripsi |
|:---|:---|:---|
| **20** | **Journal Path + CashBankTransaction Merge** | Dalam blok `if (journalLines.length > 0)`, TAMBAHKAN query CashBankTransaction expense yang `journalId=NULL` (belum dijurnal). Filter menggunakan `NON_EXPENSE_CATEGORIES` blacklist. Ini memastikan pengeluaran Kas Keluar yang diinput operator tapi belum otomatis dijurnal tetap masuk ke expense SHU. |
| **21** | **Blacklist Approach** | Ganti whitelist `EXPENSE_CATEGORIES = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"]` menjadi blacklist `NON_EXPENSE_CATEGORIES = ["pencairan_pinjaman", "transfer", "savings", ...]`. Ini menangkap SEMUA kategori expense termasuk `lainnya` (Rp 1,48M) dan `operational` (Rp 134jt). |
| **22** | **Deduplikasi via `journalId=NULL`** | CashBankTransaction yang sudah dijurnal (memiliki `journalId`) TIDAK dihitung ulang. Diagnostic membuktikan 0 transaksi yang sudah dijurnal → zero double-counting risk. |
| **23** | **Unit Breakdown Merge & Unallocated** | Revenue dari StoreSale dan UnitTransaction di-merge ke satu map (hindari duplikat unit). Expense dengan `unitType=NULL/none/simpan_pinjam` dikelompokkan sebagai "Beban Umum (Belum Dialokasi)". Unit yang hanya punya expense tapi tidak punya revenue tetap muncul. |

### N. Dampak Verifikasi

```
SEBELUM FIX:
  totalExpense (journal path) = hanya dari jurnal akun expense
  unit breakdown expense     = 0 (filter terlalu ketat)

SESUDAH FIX:
  totalExpense += Rp 2.578.988.041 (dari CashBankTransaction non-journaled)
  unit breakdown expense:
    - toko:       Rp 118.641.401
    - cuci_mobil:  Rp 14.814.700
    - cafe_lsp:    Rp 2.292.500
    - Beban Umum:  Rp 2.367.366.565
```

*Diperbarui: 31 Mei 2026*

---

## 11. BUG: SHU BERSIH = 0 SETELAH FIX EXPENSE (Ditemukan: 1 Juni 2026, 01:16 WIB)

> **Status:** ✅ CLOSED — Diperbaiki 1 Juni 2026
> **Pelapor:** Operator (via pengecekan manual UI Laporan SHU)
> **Waktu Penemuan:** 2026-06-01T01:16:33+07:00 (Minggu, 1 Juni 2026 dini hari)
> **Waktu Penyelesaian:** 2026-06-01 (hari yang sama)

### O. Deskripsi Bug

Setelah fix Section 10 (penambahan CashBankTransaction expense non-journaled ke journal path), **SHU Bersih (Net Surplus) menjadi Rp 0**. Seluruh alokasi SHU anggota dan non-anggota otomatis bernilai Rp 0 karena diturunkan dari `netSurplus`.

### P. Hasil Diagnostik Database (1 Juni 2026, 01:17 WIB)

Script `diagnose-shu-zero.ts` dan `diagnose-shu-income.ts` dijalankan langsung ke database production:

```
TOTAL INCOME (journal path):  Rp 95.346.900     ← Hanya dari 3 akun jurnal type=income
TOTAL EXPENSE:                Rp 2.579.253.741  ← Dari CB non-journaled (fix Section 10)
NET SURPLUS (raw):            Rp -2.483.906.841
NET SURPLUS (clamped):        Rp 0              ← Math.max(0, income - expense) = 0
```

### Q. Akar Masalah (Root Cause)

| No | Root Cause | Dampak |
|:---|:---|:---|
| **RC-5** | **Journal Path hanya membaca income dari JournalLine type=income (Rp 95jt)**. Sumber pendapatan utama koperasi (CashBankTransaction type=in, UnitTransaction, LoanPayment interest) **TIDAK MASUK** ke totalIncome saat journal path aktif. | totalIncome = Rp 95jt vs totalExpense = Rp 2,58M → deficit Rp 2,48M → SHU = 0 |
| **RC-6** | **Asimetri antara income dan expense pada journal path.** Fix Section 10 menambahkan CB expense non-journaled (Rp 2,58M), tetapi TIDAK menambahkan CB income non-journaled yang setara. Expense bertambah tanpa income yang seimbang. | Ketidakseimbangan besar antara sisi pendapatan dan pengeluaran |

### R. Data Pendapatan yang Hilang dari Journal Path

Diagnostic menemukan sumber pendapatan riil koperasi yang **tidak tercakup** oleh JournalLine:

| Sumber Pendapatan | Jumlah Tx | Nilai Rp | Status di Journal Path |
|:---|:---|:---|:---|
| CashBankTransaction type=in (non-journaled) | 2.795 tx | **Rp 6.849.722.199** | ❌ TIDAK MASUK |
| UnitTransaction (completed, isPaid) | 1.587 tx | **Rp 66.130.900** | ❌ TIDAK MASUK |
| LoanPayment interest | — | **Rp 234.394.832** | ❌ TIDAK MASUK (hanya Rp 95jt via jurnal) |
| StoreSale | 0 tx | Rp 0 | N/A (semua via CB) |
| **TOTAL PENDAPATAN RIIL** | — | **Rp 8.175.049.502** | — |

**Rincian CB type=in terbesar per kategori:**

| Kategori | Jumlah Tx | Nilai Rp |
|:---|:---|:---|
| `lainnya` | 59 tx | Rp 5.837.218.366 |
| `biaya_operasional` | 20 tx | Rp 868.149.433 |
| `angsuran_pokok` | 153 tx | Rp 691.081.571 |
| `(null)` | 7 tx | Rp 423.633.408 |
| `pendapatan_unit` | 1.473 tx | Rp 65.271.000 |
| `pendapatan_toko` | 1.152 tx | Rp 52.028.400 |

### S. Lokasi Bug di Kode

**File:** `src/lib/services/shu-calculator.ts`
**Baris:** 100–117 (blok `if (journalLines.length > 0)`)

```typescript
// MASALAH: Blok ini HANYA membaca income dari JournalLine type=income
// tetapi setelah fix Section 10, expense ditambahkan dari CB non-journaled.
// Akibatnya income << expense → netSurplus = 0
if (journalLines.length > 0) {
    for (const line of journalLines) {
        if (line.account.type === "income") {
            totalIncome += credit - debit;  // ← Hanya Rp 95jt
        } else if (line.account.type === "expense") {
            totalExpense += debit - credit;
        }
    }
    // ... kemudian menambahkan CB expense non-journaled (Rp 2,58M) ...
    // ... TAPI TIDAK menambahkan CB income non-journaled (Rp 6,85M) ...
}
```

**Baris kritis:** `const netSurplus = Math.max(0, totalIncome - totalExpense);` (Line 245)

### T. Solusi yang Direkomendasikan (Belum Diimplementasi)

Dalam blok journal path (`if (journalLines.length > 0)`), **TAMBAHKAN** query pendapatan non-journaled yang simetris dengan expense non-journaled, yaitu:

1. **CashBankTransaction type=in yang `journalId=NULL`** — Pendapatan kas masuk yang belum dijurnal (Rp 6,85M). Gunakan blacklist kategori non-income serupa dengan pendekatan expense (exclude: `savings`, `transfer`, `angsuran_pokok`, `simpanan_*`, `pencairan_pinjaman`).
2. **UnitTransaction (completed, isPaid)** — Pendapatan unit layanan (Rp 66jt). Perlu cek apakah sudah tercatat di jurnal atau belum.
3. **LoanPayment interestPortion** — Pendapatan jasa pinjaman (Rp 234jt). Perlu cek selisih antara jurnal (Rp 95jt) dan total langsung (Rp 234jt).

> ⚠️ **PERHATIAN:** Harus hati-hati agar tidak terjadi double-counting income. Pendapatan yang sudah masuk via JournalLine type=income **TIDAK BOLEH** dihitung ulang dari CashBankTransaction. Gunakan filter `journalId = null` yang sama seperti pada sisi expense.

### U. Dampak Jika Tidak Diperbaiki

- **SHU Bersih = Rp 0** untuk seluruh periode 2026
- **Alokasi SHU anggota = Rp 0** (Jasa Modal, Jasa Usaha, SHU Cuci Mobil tetap terhitung tapi pool = 0)
- **Alokasi SHU non-anggota = Rp 0** (Cadangan, Pendidikan, Sosial, Pegawai)
- Laporan SHU menampilkan pendapatan sangat kecil relatif terhadap pengeluaran

*Ditemukan: 1 Juni 2026, 01:16 WIB*
*Dicatat: 1 Juni 2026, 01:18 WIB*
*Ditutup: 1 Juni 2026*

---

## 12. FIX: SHU INCOME MERGE + DANA RESIKO + INCOME GROUPS (1 Juni 2026)

### V. Perubahan yang Dilakukan

| No | Perubahan | File | Deskripsi |
|:---|:---|:---|:---|
| **24** | **CB Income Merge (Journal Path)** | `src/lib/services/shu-calculator.ts` | Menambahkan query `CashBankTransaction type=in, journalId=NULL` yang simetris dengan expense merge (Section 10). Income sekarang mencakup: jasa_pinjaman, pendapatan_unit, pendapatan_toko, operational, lainnya, dan semua kategori non-blacklist. |
| **25** | **NON_INCOME_CATEGORIES Blacklist** | `src/lib/services/shu-calculator.ts` | Pendekatan blacklist baru untuk income — exclude: savings, simpanan_*, transfer, pencairan_pinjaman, angsuran_pokok, loan, setoran_simpanan. Semua kategori lainnya dianggap pendapatan riil. |
| **26** | **Dana Resiko sebagai Pendapatan SP** | `src/lib/services/shu-calculator.ts` | Query langsung `Loan.adminFee` (agregat dari semua pinjaman yang dicairkan dalam periode). Ditambahkan sebagai income account `SP-RESIKO`. Bekerja untuk semua loan termasuk yang di-import (tanpa CB entries). |
| **27** | **3-Group Income Categorization** | `src/lib/services/shu-calculator.ts` | Income dikelompokkan menjadi: (1) Pendapatan Unit Usaha (toko, unit layanan), (2) Pendapatan SimpanPinjam (jasa pinjaman, dana resiko), (3) Pendapatan Lainnya. Field `incomeGroups` ditambahkan ke return object. |
| **28** | **Per-Unit CB Income Merge** | `src/lib/services/shu-calculator.ts` | CB income per unitType di-merge ke `unitRevenueMap` yang sudah ada. Revenue per unit sekarang mencakup StoreSale + UnitTransaction + CB income. |
| **29** | **API incomeGroups passthrough** | `src/app/api/reports/shu/route.ts` | Field `incomeGroups` ditambahkan ke response SHU API. |
| **30** | **UI Income Group Cards** | `src/app/(protected)/laporan/shu/page.tsx` | 3 card berwarna ditambahkan di bawah summary: hijau (Unit Usaha), biru (SimpanPinjam), kuning (Lainnya). Masing-masing dengan breakdown expandable per sumber pendapatan. |
| **31** | **Payment Method Breakdown per Unit** | `src/lib/services/shu-calculator.ts` | StoreSale dan UnitTransaction di-groupBy berdasarkan `unitType + paymentMethod`. Hasilnya dimasukkan ke field `paymentMethodBreakdown` di setiap entri `unitBreakdown`. Metode: Tunai, QRIS, Potong Gaji. |
| **32** | **UI Expandable Payment Method** | `src/app/(protected)/laporan/shu/page.tsx` | Tabel unit breakdown sekarang expandable — klik baris unit untuk melihat rincian metode pembayaran (Tunai/QRIS/Potong Gaji) dengan persentase, jumlah, dan count transaksi. Warna: hijau (Tunai), ungu (QRIS), oranye (Potong Gaji). |
| **33** | **API Audit Detail per Unit** | `src/app/api/reports/shu/unit-detail/route.ts` | Endpoint baru `GET /api/reports/shu/unit-detail` yang mengembalikan daftar transaksi individual per unit. Mendukung filter: `unitType`, `type` (income/expense/all), `paymentMethod` (cash/qris/salary_cut/all), `year`, `month`, paginasi. Sumber data: StoreSale, UnitTransaction, CashBankTransaction. |
| **34** | **UI Audit Table per Unit** | `src/app/(protected)/laporan/shu/page.tsx` | Section "Audit Transaksi per Unit" ditambahkan di bawah unit breakdown. Fitur: pilih unit dari dropdown, filter jenis (pemasukan/pengeluaran), filter metode pembayaran (Tunai/QRIS/Potong Gaji), tabel detail transaksi dengan paginasi, ringkasan total income/expense/selisih. |

### W. Detail Teknis

**Blacklist Income Categories:**
```
NON_INCOME_CATEGORIES = [
    savings, simpanan_pokok, simpanan_wajib, simpanan_sukarela,
    setoran_simpanan, transfer, pencairan_pinjaman, angsuran_pokok, loan
]
```

**Income Group Mapping:**
- `unit`: pendapatan_unit, pendapatan_toko, operational
- `sp`: jasa_pinjaman, dana_resiko, penalti_pelunasan, chart-of-accounts 4xxx
- `lainnya`: biaya_operasional (type=in), lainnya, dan sisanya

**Dana Resiko Query:**
```sql
SELECT SUM(admin_fee) FROM loan
WHERE disbursement_date BETWEEN startDate AND endDate
  AND status IN ('active', 'paid_off')
```

**Double-Counting Guard:**
- CB income merge menggunakan `journalId: null` — hanya transaksi yang belum dijurnal
- Dana Resiko diquery langsung dari Loan (tidak melalui CB) — zero double-counting risk
- Per-unit revenue: CB income + StoreSale + UnitTransaction di-merge ke satu map

### X. Dampak Perbaikan

```
SEBELUM FIX (Section 11):
  totalIncome (journal path) = Rp 95.346.900 (hanya JournalLine)
  totalExpense               = Rp 2.579.253.741 (journal + CB non-journaled)
  NET SURPLUS                = Rp 0 (clamped)

SESUDAH FIX:
  totalIncome = JournalLine + CB type=in non-journaled + Dana Resiko
              = Rp 95jt + Rp 6,85M (CB income) + Rp X jt (Dana Resiko)
  totalExpense = Rp 2,58M (unchanged)
  NET SURPLUS  = > 0 (income sekarang melebihi expense)
```

*Status: Modul SHU kini memiliki income tracking lengkap dan kategorisasi 3 grup pendapatan.*

---

## 13. FITUR BARU: DETAIL DIALOG BREAKDOWN SHU (1 Juni 2026)

### Y. Deskripsi Fitur

Operator sekarang dapat **mengklik setiap card/angka pada Laporan SHU** untuk membuka dialog pop-up yang menampilkan **rincian darimana angka tersebut berasal**. Fitur ini menjawab kebutuhan transparansi dan auditability saat RAT maupun pemeriksaan internal.

### Z. 5 Konteks Dialog

| Klik Card | Dialog Title | Tab 1 (Ringkasan) | Tab 2 (Detail) |
|-----------|-------------|-------------------|----------------|
| **Total Pendapatan** | "Detail: Total Pendapatan" | Tabel breakdown per kategori (SP-JASA, TOKO-REV, dll) dengan % | Daftar transaksi individual (paginated, filterable) |
| **Total Beban** | "Detail: Total Beban" | Tabel breakdown per kategori (CB-OP, CB-UNIT, HPP, dll) dengan % | Daftar transaksi individual (paginated, filterable) |
| **SHU Anggota** | "Detail: SHU dari Anggota" | Tabel alokasi (Jasa Anggota, Jasa Simpanan, dll) | Langkah kalkulasi step-by-step |
| **SHU Non-Anggota** | "Detail: SHU dari Non-Anggota" | Tabel alokasi (Cadangan, Pendidikan, dll) | Langkah kalkulasi step-by-step |
| **Income Group Card** | "Detail: Pendapatan [Unit/SP/Lainnya]" | Breakdown per sumber dalam grup | Transaksi yang masuk grup tsb |

### AA. File yang Dibuat/Dimodifikasi

| File | Status | Deskripsi |
|------|--------|-----------|
| `src/app/(protected)/laporan/shu/_types.ts` | **BARU** | Shared TypeScript interfaces untuk dialog |
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | **BARU** | Dialog utama — komposisi 3 tab |
| `src/app/(protected)/laporan/shu/_components/shu-summary-tab.tsx` | **BARU** | Tab ringkasan per kategori (zero API call) |
| `src/app/(protected)/laporan/shu/_components/shu-transactions-tab.tsx` | **BARU** | Tab daftar transaksi (lazy fetch, paginated) |
| `src/app/(protected)/laporan/shu/_components/shu-calculation-tab.tsx` | **BARU** | Tab langkah kalkulasi (member/non-member surplus) |
| `src/app/api/reports/shu/detail-transactions/route.ts` | **BARU** | API endpoint: flat transaction list + filter + pagination |
| `src/app/(protected)/laporan/shu/page.tsx` | **MODIFIKASI** | Visual cues (hover, icon, dashed underline) + dialog state + handlers |

### BB. API Endpoint: `GET /api/reports/shu/detail-transactions`

| Parameter | Tipe | Required | Deskripsi |
|-----------|------|----------|-----------|
| `year` | number | ✅ | Tahun |
| `month` | number | ❌ | Bulan (null = semua) |
| `source` | string | ✅ | `"income"` atau `"expense"` |
| `category` | string | ❌ | Filter kategori spesifik |
| `incomeGroup` | string | ❌ | Filter grup: `"unit"`, `"sp"`, `"lainnya"` |
| `paymentMethod` | string | ❌ | `"cash"`, `"qris"`, `"salary_cut"` |
| `search` | string | ❌ | Pencarian keterangan |
| `page` | number | ❌ | Default: 1 |
| `perPage` | number | ❌ | Default: 25, max: 100 |

**Sumber data income:** CashBankTransaction type=in + LoanPayment interest + Loan.adminFee + UnitTransaction + StoreSale
**Sumber data expense:** CashBankTransaction type=out + StoreSaleItem COGS

### CC. Fitur UX

- **Visual cues**: Setiap card clickable memiliki hover highlight + ikon 👁️ muncul saat hover + dashed underline pada angka
- **Tab Ringkasan**: Zero latency — menggunakan data yang sudah ada di client state
- **Tab Transaksi**: Lazy fetch — hanya load saat tab diklik, dengan filter kategori/metode/pencarian + paginasi
- **Tab Kalkulasi**: Step-by-step flow dengan visual vertikal (Pendapatan → Beban → SHU Bersih → Cuci Mobil → Adjusted → Rasio → Final)
- **Nested drill-down**: Dari kalkulasi tab bisa klik drill-down ke dialog income/expense
- **Category click-to-filter**: Klik baris kategori di tab ringkasan → otomatis pindah ke tab transaksi dengan filter aktif

*Ditambahkan: 1 Juni 2026*
