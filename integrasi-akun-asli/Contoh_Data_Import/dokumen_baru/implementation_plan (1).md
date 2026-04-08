# Unifikasi dan Perbaikan Kalkulasi SHU (Sisa Hasil Usaha)

Laporan dari Operator menunjukkan adanya ketidaksinkronan data kontribusi anggota (Simpanan, Angsuran, Pinjaman, Belanja) antara tampilan profil Anggota, halaman Simpanan, dengan angka yang tertera di Laporan SHU. 

Setelah dilakukan investigasi, ditemukan beberapa *root causes* berikut:
1. **Terdapat 2 Endpoint SHU Berbeda**: Sistem saat ini memiliki `/api/reports/shu/route.ts` (dipakai oleh Laporan SHU) dan `/api/reports/shu/calculate/route.ts` (dipakai oleh fitur Distribusi & Perhitungan SHU). Keduanya menggunakan rumus Kalkulasi yang benar-benar berbeda.
2. **Bug Jarak Waktu Pinjaman (Date Range)**: Kalkulasi SHU mereferensi total `principalPaid` anggota SEUMUR HIDUP, bukan cicilan yang secara spesifik dibayarkan pada tahun berjalan (filter `startDate` - `endDate` bocor).
3. **Transaksi Void Ikut Terhitung**: Pembelian dari Toko (`StoreSale`) yang dibatalkan (`metadata.isVoided: true`) dan transaksi Unit Jasa yang belum dibayar (`isPaid: false`) masih masuk ke hitungan Jasa Usaha anggota.

## User Review Required

> [!WARNING]
> **Keputusan Standarisasi Koperasi (AD/ART)**
> 1. **Jasa Usaha (Pinjaman/Belanja):** Saat ini saya akan mengubah perhitungan agar sesuai kaidah akuntansi: Hanya cicilan/pembayaran yang disetorkan **DI TAHUN BERJALAN** yang dihitung sebagai kontribusi Jasa Usaha di SHU tahun tersebut, bukan akumulasi seumur hidup.
> 2. **Jasa Modal (Simpanan):** Karena Laporan SHU murni AD-ART, maka Jasa Modal hanya dihitung berdasarkan Simpanan POKOK dan WAJIB. Simpanan Sukarela **tidak** dihitung untuk porsi pembagian SHU. Ini wajar, tetapi kami akan seragamkan angkanya & memastikan laporan menggunakan satu referensi data (Single Source of Truth) agar nominalnya selalu *match* dengan buku kas.

## Proposed Changes

### 1. Backend Service Layer

#### [NEW] `src/lib/services/shu-calculator.ts`
Membuat satu *Single Source of Truth* (SSOT) berupa fungsi `calculateSystemSHU(year: number, month?: number)` agar semua halaman memanggil logika yang *sama persis*. Logika ini mengacu pada:
- **Net Income** nyata dari `journalLine` (bukan Gross Revenue).
- **Simpanan**: Filter khusus akun Pokok & Wajib di tahun tersebut.
- **Pinjaman**: `loanPayments` yang disetorkan HANYA di rentang tanggal yg dipilih.
- **Toko & Unit**: `StoreSale` (tanpa void) dan `UnitTransaction` (yang lunas & bukan void).

### 2. API Routes Update

#### [MODIFY] `src/app/api/reports/shu/route.ts`
Mengarahkan GET endpoint untuk menggunakan service baru `shu-calculator.ts`.

#### [MODIFY] `src/app/api/reports/shu/calculate/route.ts`
Mengarahkan GET endpoint untuk menggunakan service baru `shu-calculator.ts` dan mem-mapping *Return Data* agar format datanya kompatibel (tidak *breaking*) dengan tampilan halaman *Perhitungan & Distribusi*.

#### [MODIFY] `src/app/api/members/[id]/route.ts`
Membuang kalkulasi `estimasi_shu` inline yang keliru (hanya menghitung pokok secara asalasalan), dan membuatnya memanggil fungsi SSOT dari `shu-calculator.ts`.

## Open Questions

Secara operasional, apakah Bapak Sepakat dengan poin-poin standarisasi Jasa Usaha di atas untuk mencegah kontribusi dari transaksi/tahun yang sudah kedaluwarsa masuk kembali ke SHU tahun ini? 

## Verification Plan

### Automated Tests
1. Melakukan hitungan manual simulasi angka di database.
2. Memastikan API mereturn format seragam.

### Manual Verification
1. Membuka Laporan SHU dan Perhitungan SHU, lalu mencocokan nominal total Jasa Simpanan dan Jasa Usaha.
2. Memastikan angka "Pinjaman" di rincian kontribusi SHU anggota hanya mengakumulasi angsuran yang dia bayar di tahun terpilih.
