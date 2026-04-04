# Panduan Penggunaan Sistem Koperasi Digital PRIMKOPPOL

> **Koperasi:** PRIMKOPPOL Polres Lumajang  
> **Versi:** 2.0  
> **Terakhir Diperbarui:** 1 April 2026  
> **Platform:** Web App + Mobile App (Android & iOS)

Dokumen ini merupakan panduan lengkap penggunaan aplikasi Sistem Koperasi Digital. Panduan ini menjelaskan seluruh fitur dan hak akses setiap pengguna yang terlibat dalam sistem operasi koperasi.

---

## 📋 Daftar Isi

1. [Daftar Akun Login](#1-daftar-akun-login)
2. [Hak Akses Pengguna (Role)](#2-hak-akses-pengguna-role)
3. [Panduan per Role](#3-panduan-per-role)
4. [Fitur Detail per Modul](#4-fitur-detail-per-modul)
5. [Aplikasi Mobile (Android & iOS)](#5-aplikasi-mobile-android--ios)
6. [Alur Fungsi Koperasi](#6-alur-fungsi-koperasi)
7. [Import & Migrasi Data](#7-import--migrasi-data)
8. [Reset & Pengaturan Data](#8-reset--pengaturan-data)
9. [Audit Log (Keamanan & Tracking)](#9-audit-log-keamanan--tracking)
10. [Perhitungan SHU (Sisa Hasil Usaha)](#10-perhitungan-shu-sisa-hasil-usaha)

---

## 1. Daftar Akun Login

### Super Admin / Operator
Akses penuh ke seluruh sistem, termasuk Master Data, Laporan tutup buku tahunan, dan Audit Log.
- **Email**: `operator@koperasi.com`
- **Password**: `password123`

### Admin Unit Usaha (10 Unit)

| Unit Usaha | Akun Email | Password |
|------------|-------------|----------|
| Simpan Pinjam | `adminsp@koperasi.com` | `password123` |
| Toko | `admintoko@koperasi.com` | `password123` |
| Cuci Mobil | `admincucimobil@koperasi.com` | `password123` |
| Fotocopy | `adminfotocopy@koperasi.com` | `password123` |
| Laundry | `adminlaundry@koperasi.com` | `password123` |
| Resto & Cafe | `admincafe@koperasi.com` | `password123` |
| Playstation | `adminps@koperasi.com` | `password123` |
| Barbershop | `adminbarbershop@koperasi.com` | `password123` |
| Fitness | `adminfitness@koperasi.com` | `password123` |
| Aset | `adminaset@koperasi.com` | `password123` |

### Kasir Unit Usaha (10 Unit)

| Unit Usaha | Akun Email | Password |
|------------|-------------|----------|
| Simpan Pinjam | `kasirsp@koperasi.com` | `password123` |
| Toko | `kasirtoko@koperasi.com` | `password123` |
| Cuci Mobil | `kasircucimobil@koperasi.com` | `password123` |
| Fotocopy | `kasirfotocopy@koperasi.com` | `password123` |
| Laundry | `kasirlaundry@koperasi.com` | `password123` |
| Resto & Cafe | `kasircafe@koperasi.com` | `password123` |
| Playstation | `kasirps@koperasi.com` | `password123` |
| Barbershop | `kasirbarbershop@koperasi.com` | `password123` |
| Fitness | `kasirfitness@koperasi.com` | `password123` |
| Aset | `kasiraset@koperasi.com` | `password123` |

### Portal Anggota (Contoh)
Anggota Login menggunakan **NRP** untuk Email dan juga **NRP** sebagai Password awal.

- **Email / NRP**: `69120075` (Gunakan NRP Anggota lainnya yang terintegrasi di database)
- **Password**: `69120075`

*(Anggota dapat mengganti password melalui halaman Profil atau fitur Ganti Password)*

---

## 2. Hak Akses Pengguna (Role)

Hierarki akses pengguna dari yang **tertinggi** ke **terendah**:

```
Operator (Super Admin) ▸ Admin ▸ Kasir ▸ Anggota
```

| No | Role | Hak Akses |
|----|------|-----------|
| **1** | **Operator** | Akses penuh: Master Data, Import Data, Approve Pinjaman, Laporan Keuangan, SHU, Tutup Buku, Reset Data, Pengumuman, Audit Log. |
| **2** | **Admin** | Kelola anggota, pinjaman (review), transaksi kasir, simpanan, cek laporan unit berjalan. |
| **3** | **Kasir** | Petugas harian: POS Toko, setoran simpanan, angsuran pinjaman, cetak struk (thermal/A4). |
| **4** | **Anggota** | Portal khusus: cek profil, histori simpanan, pinjaman aktif, estimasi SHU, ajukan pinjaman online, kartu anggota digital. |

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
1. **Verifikasi Data Anggota**: Input/edit data manual di `/anggota`.
2. **Review Kredit Pinjaman**: Pengajuan dari portal anggota masuk di `/approval`.
3. **Penyusutan Aset**: Registrasi aset baru unit di `/aset` dan perhitungan penyusutan.
4. **Buku Kas**: Pencatatan kas masuk/keluar unit di `/kas-bank/buku-kas`.

### 3.3 Tugas Kasir Unit
1. **Transaksi POS Toko**: Proses barang retail di `/toko/kasir`, dibayar **Tunai** atau **Kredit (Potong Gaji)**.
2. **Setoran/Tarik Simpanan**: Di `/simpanan/transaksi/tambah` — Pokok, Wajib, Sukarela.
3. **Bayar Angsuran Pinjaman**: Di `/pinjaman/angsuran/bayar`.
4. **Kas Masuk/Keluar**: Di `/kas-bank/kas`.
5. **Kwitansi**: Membuat bukti transaksi resmi di `/kwitansi/tambah`.

### 3.4 Tugas Anggota
1. **Cek Saldo Realtime**: Dashboard portal `/portal/dashboard` menampilkan Simpanan, Pinjaman, Tunkin, Gaji, Estimasi SHU.
2. **Tracking Pinjaman**: Sisa tenor & angsuran di `/portal/pinjaman`.
3. **Ajukan Pinjaman Online**: Formulir pengajuan pinjaman di `/portal/pengajuan-pinjaman`.
4. **Mutasi Transaksi**: Riwayat transaksi simpanan di `/portal/transaksi`.
5. **Ganti Password**: Di `/portal/profil`.

---

## 4. Fitur Detail per Modul

### 4.1 Dashboard (`/dashboard`)
- **Operator**: Ringkasan total anggota, total simpanan, pinjaman aktif, tunggakan, total Tunkin, aktivitas hari ini.
- **Anggota**: Total simpanan, sisa pinjaman, kredit belum lunas, tunjangan kinerja, estimasi SHU, simpanan wajib, gaji bersih.
- **Kasir**: Total penjualan hari ini, 5 transaksi terakhir.

### 4.2 Anggota (`/anggota`)
- Daftar seluruh anggota dengan pencarian dan filter.
- Detail anggota: profil, NRP, cabang, gaji, tunkin, simpanan, pinjaman.
- Buku Anggota (`/anggota/buku`): Format cetak buku anggota.
- Kartu Anggota (`/anggota/kartu`): Kartu anggota digital.
- Tambah anggota manual atau import massal dari Excel.

### 4.3 Simpanan (`/simpanan`)
- **Produk Simpanan**: Pokok, Wajib, Sukarela, Sejahtera — masing-masing bisa dikonfigurasi.
- **Rekening** (`/simpanan/rekening`): Daftar seluruh rekening simpanan.
- **Transaksi** (`/simpanan/transaksi`): Riwayat setoran & penarikan.
- **Tambah Transaksi** (`/simpanan/transaksi/tambah`): Input setoran atau penarikan baru.
- **Rekap** (`/simpanan/rekap`): Laporan rekapitulasi simpanan.
- Simpanan Pokok & Wajib **tidak dapat ditarik**, kecuali anggota pensiun/keluar.

### 4.4 Pinjaman (`/pinjaman`)
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

### 4.5 Kas & Bank (`/kas-bank`)
- **Kas Masuk / Keluar** (`/kas-bank/kas`): Input transaksi kas dengan kategori (Operasional, Simpanan, Angsuran, Transfer, dll).
- **Bank** (`/kas-bank/bank`): Kelola rekening bank (BRI, Bank JATIM, dll).
- **Transfer** (`/kas-bank/transfer`): Transfer antar rekening kas/bank.
- **Buku Kas** (`/kas-bank/buku-kas`): Buku kas dengan running balance otomatis, siap cetak.
- **Tambah Transaksi** (`/kas-bank/transaksi/tambah`): Input transaksi kas/bank baru.

### 4.6 Kwitansi (`/kwitansi`)
- Buat kwitansi resmi dengan nomor urut otomatis.
- Pencarian anggota berdasarkan nama atau NRP.
- Cetak format **A4** (arsip bendahara) atau **Thermal 80mm** (kasir).

### 4.7 Akuntansi & Jurnal
- **Jurnal Umum** (`/jurnal/umum`): Input jurnal double-entry manual.
- **Buku Besar** (`/jurnal/buku-besar`): Ledger per akun.
- **Jurnal Penyesuaian** (`/jurnal/penyesuaian`): Koreksi akhir periode.

### 4.8 Toko / Unit Usaha (`/toko`)
- **Kasir POS** (`/toko/kasir`): Proses penjualan barang dengan sistem **Multi-Unit** (Pilih unit: Toko Sembako, Resto, Cuci Mobil, dll).
- **Kasir Cepat**: POS ringkas khusus bisnis jasa tanpa pendataan stok.
- **Pilihan Metode**: Tunai, QRIS, atau Kredit (Potong Gaji). Khusus "Potong Gaji", wajib mencantumkan nama penerima.
- **Produk** (`/toko/produk`): Kelola produk toko (nama, harga, stok, HPP).
- **Persediaan** (`/toko/persediaan`): Monitoring stok dan nilai persediaan.
- **Import Produk** (`/toko/produk/import`): Import produk massal dari Excel/CSV.
- Routing Otomatis: Tunai masuk akun Kas Unit, QRIS ke Bank Unit, Kredit otomatis membuat jurnal piutang anggota (`/transaksi-unit`).

### 4.9 Aset Koperasi (`/aset`)
- Registrasi aset baru (nama, nilai, tanggal perolehan, kategori).
- Perhitungan penyusutan otomatis (garis lurus).
- Detail aset (`/aset/[id]`): Histori penyusutan, nilai buku.
- Edit dan hapus aset.

### 4.10 Laporan Keuangan (`/laporan`)
- **Neraca** (`/laporan/neraca`): Laporan posisi keuangan.
- **Laba Rugi** (`/laporan/laba-rugi`): Laporan pendapatan dan beban.
- **Arus Kas** (`/laporan/arus-kas`): Arus kas masuk dan keluar.
- **Rekap Simpanan** (`/laporan/rekap-simpanan`): Rekapitulasi simpanan per produk.
- **Rekap Pinjaman** (`/laporan/rekap-pinjaman`): Rekapitulasi pinjaman aktif.
- **Rekap Anggota** (`/laporan/rekap-anggota`): Rekapitulasi data anggota.
- **Simulasi SHU** (`/laporan/shu`): Perhitungan SHU realtime.
- Semua laporan siap cetak (print-friendly).

### 4.11 Master Data (`/master`)
- **Cabang** (`/master/cabang`): Kelola satuan kerja / unit cabang.
- **Users** (`/master/users`): Kelola akun pengguna dan role.
- **CoA** (`/master/coa`): Bagan Akun (Chart of Accounts) — akun pendapatan, beban, aset, hutang, modal.
- **Produk Simpanan** (`/master/produk-simpanan`): Konfigurasi produk tabungan.
- **Produk Pinjaman** (`/master/produk-pinjaman`): Konfigurasi produk kredit.
- **Parameter SHU** (`/master/parameter-shu`): Setting alokasi SHU sesuai AD-ART.
- **Saldo Awal** (`/master/saldo-awal`): Input saldo awal akuntansi.
- **Import Data** (`/master/import-data`): Import anggota, Tunkin, Gaji dari Excel.
- **Mapping Jurnal** (`/master/mapping-jurnal`): Pemetaan akun untuk jurnal otomatis.

### 4.12 Pengumuman (`/pengumuman`)
- Buat pengumuman resmi untuk seluruh anggota.
- Tampil di dashboard anggota (web & mobile).

### 4.13 Approval (`/approval`)
- Approval pengajuan pinjaman dari anggota.
- Flow: Pengajuan → Review → Disetujui/Ditolak → Pencairan.

### 4.14 Periode & Tutup Buku (`/periode`)
- **Tutup Buku** (`/periode/tutup-buku`): Menutup periode akuntansi.
- **SHU** (`/periode/shu`): Perhitungan SHU akhir periode.
- **Distribusi SHU** (`/periode/shu/distribusi`): Pembagian SHU ke anggota.

### 4.15 Non-SP (Non Simpan Pinjam)
- **Penerimaan** (`/non-sp/penerimaan`): Input penerimaan dari unit usaha non-SP.
- **Pengeluaran** (`/non-sp/pengeluaran`): Input pengeluaran dari unit usaha non-SP.

### 4.16 Transaksi Unit (`/transaksi-unit`)
- Transaksi kredit unit usaha (Cuci Mobil, Barbershop, dll) dengan lookup NRP.
- Riwayat transaksi unit (`/transaksi-unit/riwayat`).

### 4.17 Settings (`/settings`)
- **Reset Data Tunkin**: Mengosongkan saldo tunjangan kinerja seluruh anggota.
- **Reset Data Gaji**: Mengosongkan saldo gaji seluruh anggota.
- **Reset Data Lainnya**: Reset simpanan, pinjaman, transaksi, dll.
- Memerlukan konfirmasi dengan mengetik kata kunci **"RESET-DATA"**.

---

## 5. Aplikasi Mobile (Android & iOS)

Koperasi Primkoppol memiliki **aplikasi mobile native** yang dibangun dengan **React Native (Expo)**. Fitur mobile sudah memiliki **paritas penuh** dengan versi web.

### Panduan Instalasi Aplikasi (Mobile App)

#### Untuk Pengguna Android (Install APK)
1. **Download APK:** Buka link instalasi APK yang diberikan oleh pengurus (atau dari link Expo EAS Build terlampir).
2. **Izinkan Instalasi:** Jika muncul peringatan *"Install unknown apps"* (Instal aplikasi tidak dikenal) di HP Android Anda, silakan masuk ke **Settings (Pengaturan) > Security (Keamanan)** lalu aktifkan izin untuk browser atau file manager Anda.
3. **Install:** Buka file `.apk` yang sudah didownload, lalu tekan **Install**.
4. **Buka Aplikasi:** Setelah selesai, aplikasi `Koperasi Primkoppol` akan muncul di layar utama (Home Screen) atau laci aplikasi Anda.
5. **Login:** Gunakan NRP dan Password yang sudah didaftarkan.

#### Untuk Pengguna iOS (iPhone / iPad)
*(Aplikasi iOS tidak mendukung format APK)*
1. **Melalui TestFlight / App Store:** Jika aplikasi sudah dipublish oleh pengurus ke Apple App Store atau TestFlight, Anda dapat mendownloadnya langsung dari sana.
2. **Alternatif Web-App (PWA):** Jika belum tersedia di App Store, Anda masih bisa menggunakan fitur PWA:
   - Buka browser **Safari** di iPhone Anda.
   - Kunjungi website resmi: `https://www.primkoppol.online`
   - Tekan tombol **Share** (ikon kotak dengan panah ke atas) di menu bawah Safari.
   - Scroll ke bawah dan pilih **"Add to Home Screen"** atau **"Tambahkan ke Layar Utama"**.
   - Aplikasi Primkoppol akan muncul di layar utama iPhone Anda dan berjalan layaknya aplikasi native tanpa frame browser.

---

### 5.1 Fitur Mobile — Operator
| Fitur | Tersedia |
|-------|----------|
| Dashboard Ringkasan Koperasi | ✅ |
| Aktivitas Hari Ini | ✅ |
| Buku Anggota & Detail | ✅ |
| Daftar Pinjaman | ✅ |
| Bayar Angsuran | ✅ |
| Rekening Simpanan | ✅ |
| Approval Pinjaman | ✅ |
| Kas & Bank | ✅ |
| Buku Kas | ✅ |
| Kwitansi | ✅ |
| Jurnal Umum | ✅ |
| Buku Besar | ✅ |
| Laba Rugi | ✅ |
| Neraca | ✅ |
| Simulasi SHU | ✅ |
| Aset Koperasi | ✅ |
| Kasir POS | ✅ |
| Stok Barang | ✅ |
| Master Data | ✅ |
| Import Data | ✅ |
| Profil Koperasi | ✅ |
| Pengumuman | ✅ |
| Audit Log | ✅ |
| Ganti Password | ✅ |

### 5.2 Fitur Mobile — Anggota
| Fitur | Tersedia |
|-------|----------|
| Dashboard Keuangan Saya | ✅ |
| Total Simpanan & Sisa Pinjaman | ✅ |
| Tunjangan Kinerja (Tunkin) | ✅ |
| Estimasi SHU | ✅ |
| Simpanan Wajib & Sejahtera | ✅ |
| Gaji Bersih | ✅ |
| Mutasi Transaksi | ✅ |
| Pinjaman Saya | ✅ |
| Ajukan Pinjaman | ✅ |
| Kartu Anggota Digital | ✅ |
| Pengumuman | ✅ |
| Ganti Password | ✅ |

### 5.3 Fitur Mobile — Kasir
| Fitur | Tersedia |
|-------|----------|
| Dashboard Kasir | ✅ |
| Kasir POS (Pilih Unit & QRIS) | ✅ |
| Checkout Potong Gaji (Cari NRP) | ✅ |
| Stok Barang | ✅ |
| Pengumuman | ✅ |
| Ganti Password | ✅ |

### 5.4 Navigasi Mobile
Bottom navigation dengan 4 tab kontekstual per role:

- **Member**: Beranda → Transaksi → Pinjaman → Profil
- **Operator**: Beranda → Approval → Anggota → Profil
- **Kasir**: Beranda → Kasir → Stok → Profil

### 5.5 UX Standards yang Dipenuhi
- Pull-to-refresh di semua layar
- Splash screen premium dengan logo Primkoppol
- Secure token storage (expo-secure-store)
- Auto-logout saat token expired (401)
- Back button di semua sub-screen
- Sticky action footer di halaman detail anggota
- Collapsible accordion menu di dashboard operator
- Role-based dashboard & navigasi otomatis
- Empty state illustration saat data kosong
- Loading indicator saat fetch data

### 5.6 Instalasi Mobile
**Untuk Android**: Download APK langsung dari build EAS.
**Untuk iOS**: Submit ke TestFlight atau App Store setelah build EAS.

---

## 6. Alur Fungsi Koperasi

### 6.1 Kasir dengan Sistem Potong Gaji (Kredit) & QRIS
Aplikasi Kasir Mobile & Web mendukung metode Tunai, QRIS, dan Kredit:
- **Kredit (Potong Gaji)**: Diwajibkan Kasir memilih nama/NRP anggota. Sistem mencatatnya di Piutang Anggota (`UnitTransaction`), bukan ke kas bank.
- **QRIS**: Masuk langsung ke Bank Unit terkait secara otomatis.
- **Tunai**: Masuk ke saldo Kas Fisik unit tersebut.

### 6.2 Pencetakan Bukti Transaksi
- **Cetak Struk Thermal**: Format 80mm untuk printer POS.
- **Cetak A4**: Format formal untuk arsip bendahara.
- Navigasi (sidebar, topbar, bottom nav) otomatis tersembunyi saat print.

### 6.3 Simpanan Pokok, Wajib & Sukarela
- Masuk di `/simpanan/transaksi/tambah`.
- Pokok & Wajib **tidak dapat ditarik**, kecuali pensiun/keluar.

### 6.4 Tutup Buku & Sinkronisasi Arus Kas
- Menu `/periode/tutup-buku` otomatis merekap seluruh jurnal sepanjang periode.
- Angka pada Arus Kas dan Neraca otomatis terintegrasi.

---

## 7. Import & Migrasi Data

### 7.1 Import Anggota + Tunkin + Gaji (`/master/import-data`)
- Format: Excel (.xlsx, .xls) atau CSV.
- Sistem mendeteksi kolom **NAMA**, **NRP**, **TUNKIN**, **GAJI** secara otomatis.
- Mode: Import Anggota Baru Lengkap, atau Update Tunkin & Gaji saja.
- Angka minus dalam format `(xxx)` otomatis dikonversi dan ditampilkan merah.

### 7.2 Import Migrasi Pinjaman (Book2.xlsx)
- Import data pinjaman SP lama dari file Excel rincian piutang.
- Sistem mendeteksi kolom: **NO, NAMA, PANGKAT, NRP, TGL PINJAM, PINJAM, SELAMA, ANGSURAN, SISA SALDO**.
- Parser tanggal Bahasa Indonesia (contoh: "29 JUL 2025", "4 F3B 2023", "OKT 2019").
- Logika multi-pinjaman: Baris tanpa NO tapi dengan nama yang sama = pinjaman tambahan orang yang sama.
- Anggota tanpa NRP di database akan otomatis dibuatkan akun baru dengan NRP format `NO-NRP-XXXX` (bisa diedit).
- Data pinjaman negatif/minus (kelebihan bayar) otomatis dilewati.

### 7.3 Import Produk Toko (`/toko/produk/import`)
- Import daftar produk toko dari Excel/CSV.

---

## 8. Reset & Pengaturan Data

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

## 9. Audit Log (Keamanan & Tracking)

(Hanya Operator/SuperAdmin)

Menu **Audit Log** (`/audit-log`) adalah sistem pengawasan keamanan siber koperasi:
- Segala aksi `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `FAILED LOGIN`, serta `EXPORT` dicatat secara *append-only* (tidak bisa dihapus).
- Melacak **IP Address**, **User Agent**, dan menyimpan **Snapshot Data** (Sebelum / Sesudah edit).
- Dilengkapi tools searching canggih per Modul / per NRP.
- Tersedia di web dan mobile app.

---

## 10. Perhitungan SHU (Sisa Hasil Usaha)

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

**SHU dari Usaha untuk Bukan Anggota:**

| No | Alokasi | Persentase |
| --- | --- | --- |
| 1 | Dana Cadangan | 60% |
| 2 | Dana Kesejahteraan Pegawai | 10% |
| 3 | Dana Pendidikan Koperasi | 20% |
| 4 | Dana Sosial | 10% |

### B. Komponen 1: Jasa Simpanan (Modal) — 20%

Kolam Jasa Simpanan dihitung dari total laba bersih koperasi. Jika belum ada pendapatan, sistem menggunakan lantai minimum 6% per tahun dari total modal simpanan.

```text
Kolam Jasa Simpanan = MAX(
    Total Laba Bersih Koperasi × 20%,
    Total Modal Simpanan × 6% × 20%
)

SHU Jasa Simpanan Saya = (Simpanan Saya / Total Simpanan Semua Anggota) × Kolam
```

Yang termasuk "Simpanan Saya": Saldo Simpanan Pokok, Saldo Simpanan Wajib, Total setoran Simpanan Sukarela.

### C. Komponen 2: Jasa Anggota (Usaha) — 25%

```text
TOKO:
  Margin per Barang = (Harga Jual - HPP) × Jumlah Barang
  SHU Toko = Total Margin × 25%

UNIT JASA (Cuci Mobil, Barbershop, dll):
  Margin Jasa = Total Pembayaran × 80% (estimasi margin jasa)
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
