# Panduan Penggunaan Sistem Koperasi Digital PRIMKOPPOL

> **Koperasi:** PRIMKOPPOL Polres Lumajang  
> **Versi:** 3.0  
> **Terakhir Diperbarui:** 5 April 2026  
> **Platform:** Web App + Mobile App (Android & iOS)

Dokumen ini merupakan panduan lengkap penggunaan aplikasi Sistem Koperasi Digital. Panduan ini menjelaskan seluruh fitur dan hak akses setiap pengguna yang terlibat dalam sistem operasi koperasi.

---

## 📋 Daftar Isi

1. [Daftar Akun Login](#1-daftar-akun-login)
2. [Hak Akses Pengguna (Role)](#2-hak-akses-pengguna-role)
3. [Panduan per Role](#3-panduan-per-role)
4. [Fitur Kasir Toko — Barcode Scanner](#4-fitur-kasir-toko--barcode-scanner)
5. [Fitur Detail per Modul](#5-fitur-detail-per-modul)
6. [Aplikasi Mobile (Android & iOS)](#6-aplikasi-mobile-android--ios)
7. [Alur Fungsi Koperasi](#7-alur-fungsi-koperasi)
8. [Import & Migrasi Data](#8-import--migrasi-data)
9. [Reset & Pengaturan Data](#9-reset--pengaturan-data)
10. [Audit Log (Keamanan & Tracking)](#10-audit-log-keamanan--tracking)
11. [Perhitungan SHU (Sisa Hasil Usaha)](#11-perhitungan-shu-sisa-hasil-usaha)

---

## 1. Daftar Akun Login

### Super Admin / Operator
Akses penuh ke seluruh sistem, termasuk Master Data, Laporan tutup buku tahunan, dan Audit Log.
- **Email**: `operator@koperasi.com`
- **Password**: `password123`

---

### Admin Unit Usaha (10 Unit)

Admin Unit berfungsi sebagai **Staff Monitoring** yang mengawasi operasional kasir di unit masing-masing.

| Unit Usaha | Akun Email | Password | Akses Sistem |
|------------|-------------|----------|--------------|
| Simpan Pinjam | `adminsp@koperasi.com` | `password123` | Full Admin (Anggota, Pinjaman, Simpanan, Laporan) |
| **Toko PRIMKOPPOL** | `admintoko@koperasi.com` | `password123` | Full Admin + Produk Toko, POS, Persediaan, Laporan |
| Cuci Mobil | `admincucimobil@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Fotocopy | `adminfotocopy@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Laundry | `adminlaundry@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Resto & Cafe | `admincafe@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Playstation | `adminps@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Barbershop | `adminbarbershop@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Fitness | `adminfitness@koperasi.com` | `password123` | Full Admin + Transaksi Unit, Riwayat |
| Aset | `adminaset@koperasi.com` | `password123` | Full Admin + Kelola Aset |

> **Catatan:** Admin Unit mendapatkan **Full Navigation** (sama seperti Operator) namun dibatasi oleh permission yang relevan. Admin Toko dapat mengakses semua menu termasuk Produk Toko, Kasir POS, dan Persediaan.

---

### Kasir Unit Usaha (10 Unit)

Kasir mendapat **sidebar khusus minimal** sesuai unit mereka — otomatis berdasarkan `unitType` akun.

| Unit Usaha | Akun Email | Password | Menu yang Tersedia |
|------------|-------------|----------|--------------------|
| **Toko PRIMKOPPOL** | `kasirtoko@koperasi.com` | `password123` | Dashboard · **Kasir POS** (Scan Barcode) · Produk · Persediaan Stok · Riwayat Penjualan |
| Simpan Pinjam | `kasirsp@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Cuci Mobil | `kasircucimobil@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Fotocopy | `kasirfotocopy@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Laundry | `kasirlaundry@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Resto & Cafe | `kasircafe@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Playstation | `kasirps@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Barbershop | `kasirbarbershop@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Fitness | `kasirfitness@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |
| Aset | `kasiraset@koperasi.com` | `password123` | Dashboard · Kasir POS (Layanan Jasa) · Riwayat Transaksi |

> **Penting:** Unit `kasirtoko` mendapat POS yang berbeda — **Kasir POS Toko** (`/toko/kasir`) dengan fitur lengkap: scan barcode produk, manajemen keranjang, stok otomatis berkurang, cetak struk. Kasir unit lain mendapat **Kasir POS Jasa** (`/unit-layanan/kasir`) yang lebih ringkas tanpa master produk/stok.

---

### Portal Anggota (Contoh)
Anggota Login menggunakan **NRP** untuk Email dan juga **NRP** sebagai Password awal.

- **Email / NRP**: `69120075` (Gunakan NRP Anggota lainnya yang terintegrasi di database)
- **Password**: `69120075`

*(Anggota dapat mengganti password melalui halaman Profil atau fitur Ganti Password)*

---

## 2. Hak Akses Pengguna (Role)

Hierarki akses pengguna dari yang **tertinggi** ke **terendah**:

```
Operator (Super Admin) ▸ Admin Unit ▸ Kasir Unit ▸ Anggota
```

| No | Role | Hak Akses |
|----|------|-----------| 
| **1** | **Operator** | Akses penuh: Master Data, Import Data, Approve Pinjaman, Laporan Keuangan, SHU, Tutup Buku, Reset Data, Pengumuman, Audit Log. |
| **2** | **Admin Unit** | Seperti Staff: kelola anggota, pinjaman (review), transaksi kasir, simpanan, kas & bank, laporan unit, toko, dan monitoring kasir. |
| **3** | **Kasir Toko** | Khusus POS Toko PRIMKOPPOL: scan barcode, keranjang belanja, checkout (Tunai/QRIS/Potong Gaji), cetak struk. Produk & Persediaan (view). |
| **4** | **Kasir Unit Jasa** | POS ringkas untuk jasa: input nominal layanan, pilih metode bayar, lookup NRP anggota (Potong Gaji), cetak struk. |
| **5** | **Anggota** | Portal khusus: cek profil, histori simpanan, pinjaman aktif, estimasi SHU, ajukan pinjaman online, kartu anggota digital. |

---

## 3. Panduan per Role

### 3.1 Tugas Operator
1. **Master Akses**: Membuat data unit cabang, user, dan hak akses di `/master`.
2. **Akuntansi Utama**: CoA (Bagan Akun) di `/master/coa`, parameter SHU di `/master/parameter-shu`.
3. **Import Data Anggota**: Import Excel untuk data anggota, Tunkin, Gaji di `/master/import-data`.
4. **Import Data Pinjaman**: Import migrasi pinjaman SP dari Excel di halaman Pinjaman.
5. **Monitoring**: Dashboard utama `/dashboard` dan **Audit Log** di `/audit-log`.
6. **Pengumuman**: Membuat/mengelola pengumuman koperasi di `/pengumuman`.
7. **Reset Data**: Mengosongkan saldo Tunkin/Gaji di `/settings` untuk import ulang.
8. **Profil Koperasi**: Mengelola informasi identitas koperasi di `/profil-koperasi`.

### 3.2 Tugas Admin Unit

Admin Unit berfungsi seperti **Staff/Petugas** yang memonitor aktivitas kasir di unit masing-masing. Admin mendapat akses **Full Navigation** yang difilter sesuai permission unit.

**Admin Toko PRIMKOPPOL** (`admintoko@koperasi.com`):
1. **Monitor Produk**: Tambah/edit/hapus produk toko di `/toko/produk`.
2. **Monitor Penjualan**: Lihat seluruh riwayat penjualan kasir di `/toko`.
3. **Monitor Stok**: Pantau persediaan barang di `/toko/persediaan`.
4. **Import Produk**: Import massal produk dari Excel di `/toko/produk/import`.
5. **Review Kredit**: Kelola piutang potong gaji anggota di `/transaksi-unit`.
6. **Laporan**: Laporan keuangan unit di `/laporan`.

**Admin Unit Jasa** (barbershop, fitness, dll):
1. **Transaksi Unit**: Kelola piutang kredit unit di `/transaksi-unit`.
2. **Kasir POS Jasa**: Akses POS ringkas untuk input layanan di `/unit-layanan/kasir`.
3. **Buku Kas**: Pencatatan kas masuk/keluar unit di `/kas-bank/buku-kas`.
4. **Penyusutan Aset**: Registrasi aset baru unit di `/aset`.
5. **Laporan**: Laporan keuangan unit di `/laporan`.

### 3.3 Tugas Kasir Toko PRIMKOPPOL (`kasirtoko@koperasi.com`)

Kasir Toko mendapat **sidebar khusus Toko** dengan 4 menu:

1. **Kasir POS** (`/toko/kasir`):
   - Scan barcode produk menggunakan **Barcode Gun** (USB/Bluetooth) → otomatis tambah ke keranjang
   - Cari produk manual via nama atau SKU
   - Kelola keranjang: tambah, kurangi, hapus item
   - **Checkout Tunai**: Input nominal bayar, hitung kembalian otomatis
   - **Checkout QRIS**: Bayar QRIS, masuk bank unit otomatis
   - **Checkout Potong Gaji**: Cari NRP/nama anggota → piutang terbuat otomatis
   - Cetak struk thermal/A4 setelah transaksi

2. **Produk** (`/toko/produk`): Lihat daftar produk, stok, dan harga (view only untuk kasir)

3. **Persediaan Stok** (`/toko/persediaan`): Monitor stok barang realtime

4. **Riwayat Penjualan** (`/toko`): Lihat histori transaksi yang sudah dilakukan

### 3.4 Tugas Kasir Unit Jasa (barbershop, fitness, cuci mobil, dll)

Kasir unit jasa mendapat **sidebar minimal** dengan 2 menu:

1. **Kasir POS** (`/unit-layanan/kasir`):
   - Pilih paket layanan (auto-isi nominal) atau input nominal manual
   - Pilih metode: **Tunai**, **QRIS**, atau **Potong Gaji**
   - Khusus Potong Gaji: cari NRP anggota → piutang terbuat otomatis
   - Cetak struk setelah transaksi

2. **Riwayat Transaksi** (`/transaksi-unit`): Lihat histori transaksi unit

### 3.5 Tugas Anggota
1. **Cek Saldo Realtime**: Dashboard portal `/portal/dashboard` menampilkan Simpanan, Pinjaman, Tunkin, Gaji, Estimasi SHU.
2. **Tracking Pinjaman**: Sisa tenor & angsuran di `/portal/pinjaman`.
3. **Ajukan Pinjaman Online**: Formulir pengajuan pinjaman di `/portal/pengajuan-pinjaman`.
4. **Mutasi Transaksi**: Riwayat transaksi simpanan di `/portal/transaksi`.
5. **Ganti Password**: Di `/portal/profil`.

---

## 4. Fitur Kasir Toko — Barcode Scanner

### 4.1 Cara Kerja Barcode Scanner (Web)

Sistem POS Kasir Toko (`/toko/kasir`) dilengkapi dengan dukungan **hardware barcode gun** secara otomatis tanpa konfigurasi tambahan.

**Cara Penggunaan:**
1. Hubungkan **Barcode Gun** (USB atau Bluetooth) ke komputer kasir
2. Buka halaman **Kasir POS** (`/toko/kasir`)
3. Pastikan **tidak ada cursor di kolom input manapun** (klik area kosong halaman)
4. Arahkan barcode gun ke barcode produk → scan
5. Sistem otomatis mendeteksi produk berdasarkan **SKU** yang sudah diinput di menu Stok
6. Produk langsung masuk ke **Keranjang Belanja** dengan notifikasi sukses
7. Jika barcode tidak ditemukan, sistem akan **filter otomatis** ke kolom pencarian

**Catatan Teknis:**
- Barcode gun bekerja dengan mengirim karakter secara cepat (<60ms antar karakter) diakhiri Enter — sistem mendeteksi pola ini secara otomatis
- Input manual di kolom search **tidak akan** memicu scanner (disambiguasi otomatis)
- Barcode yang valid: minimal 3 karakter, cocok dengan SKU di database produk toko

### 4.2 Setup SKU Produk untuk Barcode

Agar barcode dapat terdeteksi, SKU produk harus sesuai dengan kode barcode fisik:

1. Masuk ke `/toko/produk` → Tambah atau Edit Produk
2. Isi kolom **SKU** dengan kode barcode yang tercetak di kemasan produk (mis: `8990007600088`)
3. Simpan → produk siap di-scan

### 4.3 Barcode Scanner — Mobile App

Di aplikasi mobile (tablet/HP kasir):
1. Tap ikon **kamera / scanner** di halaman Kasir
2. Modal kamera terbuka → arahkan ke barcode produk
3. Produk terdeteksi otomatis dan masuk ke keranjang

---

## 5. Fitur Detail per Modul

### 5.1 Dashboard (`/dashboard`)
- **Operator**: Ringkasan total anggota, total simpanan, pinjaman aktif, tunggakan, total Tunkin, aktivitas hari ini.
- **Anggota**: Total simpanan, sisa pinjaman, kredit belum lunas, tunjangan kinerja, estimasi SHU, simpanan wajib, gaji bersih.
- **Kasir Toko**: Ringkasan penjualan hari ini, 5 transaksi terakhir.

### 5.2 Anggota (`/anggota`)
- Daftar seluruh anggota dengan pencarian dan filter.
- Detail anggota: profil, NRP, cabang, gaji, tunkin, simpanan, pinjaman.
- Buku Anggota (`/anggota/buku`): Format cetak buku anggota.
- Kartu Anggota (`/anggota/kartu`): Kartu anggota digital.
- Tambah anggota manual atau import massal dari Excel.

### 5.3 Simpanan (`/simpanan`)
- **Produk Simpanan**: Pokok, Wajib, Sukarela, Sejahtera — masing-masing bisa dikonfigurasi.
- **Rekening** (`/simpanan/rekening`): Daftar seluruh rekening simpanan.
- **Transaksi** (`/simpanan/transaksi`): Riwayat setoran & penarikan.
- **Tambah Transaksi** (`/simpanan/transaksi/tambah`): Input setoran atau penarikan baru.
- **Rekap** (`/simpanan/rekap`): Laporan rekapitulasi simpanan.
- Simpanan Pokok & Wajib **tidak dapat ditarik**, kecuali anggota pensiun/keluar.

### 5.4 Pinjaman (`/pinjaman`)
- **Daftar Pinjaman**: Seluruh pinjaman aktif dengan status.
- **Detail Pinjaman** (`/pinjaman/[id]`): Pokok, sisa, angsuran, jadwal, histori pembayaran.
- **Pengajuan** (`/pinjaman/pengajuan`): Daftar pengajuan pinjaman.
- **Tambah Pengajuan** (`/pinjaman/pengajuan/tambah`): Formulir pengajuan pinjaman baru.
- **Angsuran** (`/pinjaman/angsuran`): Daftar angsuran yang harus dibayar.
- **Bayar Angsuran** (`/pinjaman/angsuran/bayar`): Proses pembayaran angsuran.
- **Jadwal** (`/pinjaman/jadwal`): Jadwal angsuran per pinjaman.
- **Import Migrasi**: Import data pinjaman SP lama dari Excel.
- Bunga: 0% (kebijakan koperasi).
- Biaya Administrasi: 1% dari total pinjaman (Biaya Jasa Primkoppol).

### 5.5 Kas & Bank (`/kas-bank`)
- **Kas Masuk / Keluar** (`/kas-bank/kas`): Input transaksi kas dengan kategori.
- **Bank** (`/kas-bank/bank`): Kelola rekening bank (BRI, Bank JATIM, dll).
- **Transfer** (`/kas-bank/transfer`): Transfer antar rekening kas/bank.
- **Buku Kas** (`/kas-bank/buku-kas`): Buku kas dengan running balance otomatis, siap cetak.

### 5.6 Kwitansi (`/kwitansi`)
- Buat kwitansi resmi dengan nomor urut otomatis.
- Pencarian anggota berdasarkan nama atau NRP.
- Cetak format **A4** (arsip bendahara) atau **Thermal 80mm** (kasir).

### 5.7 Akuntansi & Jurnal
- **Jurnal Umum** (`/jurnal/umum`): Input jurnal double-entry manual.
- **Buku Besar** (`/jurnal/buku-besar`): Ledger per akun.
- **Jurnal Penyesuaian** (`/jurnal/penyesuaian`): Koreksi akhir periode.

### 5.8 Toko PRIMKOPPOL (`/toko`)

**Untuk Admin Toko & Operator:**
- **Kasir POS** (`/toko/kasir`): Proses penjualan dengan scan barcode + keranjang belanja.
- **Produk** (`/toko/produk`): Kelola produk toko (nama, harga, stok, SKU, HPP).
- **Persediaan** (`/toko/persediaan`): Monitoring stok dan nilai persediaan.
- **Import Produk** (`/toko/produk/import`): Import produk massal dari Excel/CSV.
- **Riwayat Penjualan** (`/toko`): Seluruh histori transaksi toko.

**Metode Pembayaran:**
- **Tunai**: Masuk ke saldo Kas Fisik unit toko.
- **QRIS**: Masuk ke Bank Unit terkait secara otomatis.
- **Potong Gaji (Kredit)**: Membuat piutang anggota otomatis di `/transaksi-unit`.

### 5.9 Transaksi Unit Layanan (`/transaksi-unit`)
- Transaksi kredit unit usaha jasa (Cuci Mobil, Barbershop, dll) dengan lookup NRP.
- Riwayat transaksi unit (`/transaksi-unit/riwayat`).
- **Kasir POS Jasa** (`/unit-layanan/kasir`): POS ringkas tanpa stok untuk unit jasa.

### 5.10 Aset Koperasi (`/aset`)
- Registrasi aset baru (nama, nilai, tanggal perolehan, kategori).
- Perhitungan penyusutan otomatis (garis lurus).
- Detail aset (`/aset/[id]`): Histori penyusutan, nilai buku.

### 5.11 Laporan Keuangan (`/laporan`)
- **Neraca** (`/laporan/neraca`): Laporan posisi keuangan.
- **Laba Rugi** (`/laporan/laba-rugi`): Laporan pendapatan dan beban.
- **Arus Kas** (`/laporan/arus-kas`): Arus kas masuk dan keluar.
- **Rekap Simpanan** (`/laporan/rekap-simpanan`): Rekapitulasi simpanan per produk.
- **Rekap Pinjaman** (`/laporan/rekap-pinjaman`): Rekapitulasi pinjaman aktif.
- **Rekap Anggota** (`/laporan/rekap-anggota`): Rekapitulasi data anggota.
- **Simulasi SHU** (`/laporan/shu`): Perhitungan SHU realtime.
- Semua laporan bisa diekspor ke **Excel** dan **PDF**.

### 5.12 Master Data (`/master`)
- **Cabang** (`/master/cabang`): Kelola satuan kerja / unit cabang.
- **Users** (`/master/users`): Kelola akun pengguna, role, dan **Unit Usaha** (wajib diisi untuk kasir).
- **CoA** (`/master/coa`): Bagan Akun (Chart of Accounts).
- **Produk Simpanan** (`/master/produk-simpanan`): Konfigurasi produk tabungan.
- **Produk Pinjaman** (`/master/produk-pinjaman`): Konfigurasi produk kredit.
- **Parameter SHU** (`/master/parameter-shu`): Setting alokasi SHU sesuai AD-ART.
- **Saldo Awal** (`/master/saldo-awal`): Input saldo awal akuntansi.
- **Import Data** (`/master/import-data`): Import anggota, Tunkin, Gaji dari Excel.
- **Mapping Jurnal** (`/master/mapping-jurnal`): Pemetaan akun untuk jurnal otomatis.

> **Catatan Penting — Assign Unit ke Kasir:** Saat membuat atau mengedit akun Kasir di `/master/users`, **wajib memilih Unit Usaha**. Sistem akan otomatis menyesuaikan sidebar dan akses POS sesuai unit yang dipilih.

---

## 6. Aplikasi Mobile (Android & iOS)

Koperasi Primkoppol memiliki **aplikasi mobile native** yang dibangun dengan **React Native (Expo)**. Fitur mobile sudah memiliki **paritas penuh** dengan versi web.

### Panduan Instalasi Aplikasi (Mobile App)

#### Untuk Pengguna Android (Install APK)
1. **Download APK:** Buka link instalasi APK yang diberikan oleh pengurus (atau dari link Expo EAS Build terlampir).
2. **Izinkan Instalasi:** Jika muncul peringatan *"Install unknown apps"*, masuk ke **Settings > Security** lalu aktifkan izin.
3. **Install:** Buka file `.apk` yang sudah didownload, lalu tekan **Install**.
4. **Buka Aplikasi:** Aplikasi `Koperasi Primkoppol` akan muncul di layar utama.
5. **Login:** Gunakan NRP dan Password yang sudah didaftarkan.

#### Untuk Pengguna iOS (iPhone / iPad)
1. **Melalui TestFlight / App Store:** Jika aplikasi sudah dipublish, download dari sana.
2. **Alternatif Web-App (PWA):** Buka Safari → kunjungi website → tap Share → **"Add to Home Screen"**.

---

### 6.1 Fitur Mobile — Operator
| Fitur | Tersedia |
|-------|----------|
| Dashboard Ringkasan Koperasi | ✅ |
| Buku Anggota & Detail | ✅ |
| Daftar Pinjaman | ✅ |
| Bayar Angsuran | ✅ |
| Rekening Simpanan | ✅ |
| Approval Pinjaman | ✅ |
| Kas & Bank | ✅ |
| Buku Kas | ✅ |
| Kwitansi | ✅ |
| Jurnal Umum & Buku Besar | ✅ |
| Laporan Keuangan | ✅ |
| Simulasi SHU | ✅ |
| Aset Koperasi | ✅ |
| Kasir POS Toko (Barcode Kamera) | ✅ |
| Kasir POS Jasa | ✅ |
| Stok Barang Toko | ✅ |
| Master Data | ✅ |
| Import Data | ✅ |
| Profil Koperasi | ✅ |
| Pengumuman | ✅ |
| Audit Log | ✅ |
| Ganti Password | ✅ |

### 6.2 Fitur Mobile — Kasir Toko
| Fitur | Tersedia |
|-------|----------|
| Dashboard Kasir | ✅ |
| Kasir POS Toko (Scan Barcode Kamera) | ✅ |
| Keranjang Belanja + Checkout | ✅ |
| Checkout Potong Gaji (Cari NRP) | ✅ |
| Cetak Struk Thermal | ✅ |
| Stok Barang (View) | ✅ |
| Riwayat Penjualan | ✅ |
| Pengumuman | ✅ |
| Ganti Password | ✅ |

### 6.3 Fitur Mobile — Kasir Unit Jasa
| Fitur | Tersedia |
|-------|----------|
| Dashboard Kasir | ✅ |
| Kasir POS Jasa (Input Nominal + Paket) | ✅ |
| Checkout Potong Gaji (Cari NRP) | ✅ |
| Cetak Struk Thermal | ✅ |
| Riwayat Transaksi Unit | ✅ |
| Pengumuman | ✅ |
| Ganti Password | ✅ |

### 6.4 Fitur Mobile — Anggota
| Fitur | Tersedia |
|-------|----------|
| Dashboard Keuangan Saya | ✅ |
| Total Simpanan & Sisa Pinjaman | ✅ |
| Tunjangan Kinerja (Tunkin) | ✅ |
| Estimasi SHU | ✅ |
| Mutasi Transaksi | ✅ |
| Pinjaman Saya | ✅ |
| Ajukan Pinjaman | ✅ |
| Kartu Anggota Digital | ✅ |
| Pengumuman | ✅ |
| Ganti Password | ✅ |

### 6.5 Navigasi Mobile per Role
- **Anggota**: Beranda → Transaksi → Pinjaman → Profil
- **Operator**: Beranda → Approval → Anggota → Profil
- **Kasir Toko**: Beranda → Kasir POS → Stok → Profil
- **Kasir Jasa**: Beranda → Kasir POS → Riwayat → Profil

---

## 7. Alur Fungsi Koperasi

### 7.1 Kasir Toko — Alur Penjualan dengan Barcode
```
1. Kasir buka /toko/kasir
2. Arahkan barcode gun ke produk → SKU terdeteksi → masuk keranjang
   ATAU cari produk manual → klik tambah (+)
3. Atur jumlah di keranjang jika perlu
4. Pilih metode bayar:
   - Tunai: input nominal → hitung kembalian → Bayar
   - QRIS: konfirmasi → Bayar (masuk bank unit otomatis)
   - Potong Gaji: cari NRP/nama anggota → pilih → Konfirmasi
5. Struk otomatis muncul → cetak atau skip
6. Stok produk berkurang otomatis di database
```

### 7.2 Kasir dengan Sistem Potong Gaji (Kredit) & QRIS
- **Kredit (Potong Gaji)**: Kasir memilih nama/NRP anggota. Sistem mencatatnya di Piutang Anggota (`UnitTransaction`), bukan ke kas bank.
- **QRIS**: Masuk langsung ke Bank Unit terkait secara otomatis.
- **Tunai**: Masuk ke saldo Kas Fisik unit tersebut.

### 7.3 Pencetakan Bukti Transaksi
- **Cetak Struk Thermal**: Format 80mm untuk printer POS.
- **Cetak A4**: Format formal untuk arsip bendahara.
- Navigasi (sidebar, topbar, bottom nav) otomatis tersembunyi saat print.

### 7.4 Simpanan Pokok, Wajib & Sukarela
- Masuk di `/simpanan/transaksi/tambah`.
- Pokok & Wajib **tidak dapat ditarik**, kecuali pensiun/keluar.

### 7.5 Tutup Buku & Sinkronisasi Arus Kas
- Menu `/periode/tutup-buku` otomatis merekap seluruh jurnal sepanjang periode.
- Angka pada Arus Kas dan Neraca otomatis terintegrasi.

---

## 8. Import & Migrasi Data

### 8.1 Import Anggota + Tunkin + Gaji (`/master/import-data`)
- Format: Excel (.xlsx, .xls) atau CSV.
- Sistem mendeteksi kolom **NAMA**, **NRP**, **TUNKIN**, **GAJI** secara otomatis.
- Mode: Import Anggota Baru Lengkap, atau Update Tunkin & Gaji saja.
- Angka minus dalam format `(xxx)` otomatis dikonversi dan ditampilkan merah.

### 8.2 Import Migrasi Pinjaman (Book2.xlsx)
- Import data pinjaman SP lama dari file Excel rincian piutang.
- Sistem mendeteksi kolom: **NO, NAMA, PANGKAT, NRP, TGL PINJAM, PINJAM, SELAMA, ANGSURAN, SISA SALDO**.
- Parser tanggal Bahasa Indonesia (contoh: "29 JUL 2025", "OKT 2019").
- Logika multi-pinjaman: Baris tanpa NO tapi dengan nama yang sama = pinjaman tambahan.
- Anggota tanpa NRP di database akan otomatis dibuatkan akun baru.
- Data pinjaman negatif/minus (kelebihan bayar) otomatis dilewati.

### 8.3 Import Produk Toko (`/toko/produk/import`)
- Import daftar produk toko dari Excel/CSV.
- Kolom wajib: **Nama Produk**, **SKU** (kode barcode), **Harga Jual**, **Stok**.

---

## 9. Reset & Pengaturan Data

### Halaman Settings (`/settings`)
Fitur reset data untuk operator/admin yang perlu membersihkan dan import ulang:

| Reset | Fungsi |
|-------|--------|
| **Kosongkan Saldo Tunkin** | Set semua `tunlesKinerja` anggota aktif ke Rp 0 |
| **Kosongkan Saldo Gaji** | Set semua `salary` anggota aktif ke Rp 0 |
| **Hapus Semua Pinjaman** | Menghapus seluruh data LoanApplication dan Loan |
| **Hapus Semua Simpanan** | Menghapus seluruh transaksi dan rekening simpanan |
| **Hapus Semua Transaksi** | Menghapus semua jurnal, kas/bank, kwitansi |
| **Hapus Semua Anggota** | Menghapus seluruh data anggota |

> ⚠️ **Perhatian**: Semua operasi reset memerlukan konfirmasi dengan mengetik **"RESET-DATA"** untuk keamanan. Operasi ini tidak bisa di-undo.

---

## 10. Audit Log (Keamanan & Tracking)

(Hanya Operator/SuperAdmin)

Menu **Audit Log** (`/audit-log`) adalah sistem pengawasan keamanan siber koperasi:
- Segala aksi `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `FAILED LOGIN`, serta `EXPORT` dicatat secara *append-only* (tidak bisa dihapus).
- Melacak **IP Address**, **User Agent**, dan menyimpan **Snapshot Data** (Sebelum / Sesudah edit).
- Dilengkapi tools searching canggih per Modul / per NRP.
- Tersedia di web dan mobile app.

---

## 11. Perhitungan SHU (Sisa Hasil Usaha)

Sistem menghitung estimasi SHU secara **realtime** berdasarkan formulasi AD-ART Pasal 42.

### A. Tabel Pembagian SHU Sesuai AD-ART Pasal 42

**SHU dari Usaha untuk Anggota:**

| No | Alokasi | Persentase | Keterangan |
| --- | --- | --- | --- |
| 1 | Cadangan | 30% | Tidak dibagikan, untuk modal koperasi |
| 2 | Jasa Anggota (Usaha) | 25% | Dibagikan ke anggota berdasarkan transaksi |
| 3 | Jasa Simpanan (Modal) | 20% | Dibagikan ke anggota berdasarkan saldo tabungan |
| 4 | Dana Pengurus | 10% | Untuk pengurus dan pengawas koperasi |
| 5 | Dana Pegawai | 5% | Untuk kesejahteraan karyawan |
| 6 | Dana Pendidikan | 5% | Untuk kegiatan pendidikan koperasi |
| 7 | Dana Sosial | 5% | Untuk kegiatan sosial |

### B. Komponen: Jasa Simpanan (Modal) — 20%

```text
Kolam Jasa Simpanan = MAX(
    Total Laba Bersih Koperasi × 20%,
    Total Modal Simpanan × 6% × 20%
)

SHU Jasa Simpanan Saya = (Simpanan Saya / Total Simpanan Semua Anggota) × Kolam
```

### C. Komponen: Jasa Anggota (Usaha) — 25%

```text
TOKO:
  Margin per Barang = (Harga Jual - HPP) × Jumlah Barang
  SHU Toko = Total Margin × 25%

UNIT JASA (Cuci Mobil, Barbershop, dll):
  Margin Jasa = Total Pembayaran × 80%
  SHU Unit = Margin Jasa × 25%

PINJAMAN:
  Margin Pinjaman = Total Bunga yang Sudah Dibayar
  SHU Pinjaman = Margin Pinjaman × 25%
```

### D. Total Estimasi SHU Anggota

```text
Total SHU Saya = Jasa Simpanan + Jasa Anggota (Usaha)
```

### E. Catatan Penting

1. Estimasi SHU bersifat **realtime** dan akan berubah seiring bertambahnya transaksi.
2. Nilai SHU final resmi ditetapkan pada **Rapat Anggota Tahunan (RAT)** setelah Tutup Buku.
3. Anggota baru tanpa simpanan/transaksi: SHU = Rp 0 (normal).
4. Semakin besar simpanan & semakin sering bertransaksi, semakin besar SHU.
