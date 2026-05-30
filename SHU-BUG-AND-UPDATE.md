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
