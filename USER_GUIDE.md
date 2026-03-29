# Panduan Penggunaan Sistem Koperasi Digital PRIMKOPPOL

> **Koperasi:** PRIMKOPPOL Polres Lumajang  
> **Versi:** 1.3  
> **Terakhir Diperbarui:** 27 Maret 2026

Dokumen ini merupakan panduan lengkap penggunaan aplikasi Sistem Koperasi Digital. Panduan ini menjelaskan seluruh fitur dan hak akses setiap pengguna yang terlibat dalam sistem operasi koperasi.

---

## 📋 Daftar Isi

1. [Daftar Akun Login (Creds)](#1-daftar-akun-login-creds)
2. [Hak Akses Pengguna (Role)](#2-hak-akses-pengguna-role)
3. [Panduan per Role](#3-panduan-per-role)
4. [Aplikasi Berbasis Mobile (PWA)](#4-aplikasi-berbasis-mobile-pwa)
5. [Alur Fungsi Koperasi](#5-alur-fungsi-koperasi)
6. [Audit Log (Keamanan & Tracking)](#6-audit-log-keamanan--tracking)

---

## 1. Daftar Akun Login (Creds)

Berikut adalah daftar akun default yang sudah dibuat dan dapat digunakan untuk mencoba seluruh fitur sistem koperasi digital.

### Super Admin / Operator
Akses penuh ke seluruh sistem, termasuk Master Data, Laporan tutup buku tahunan, dan Audit Log.
- **Email**: `operator@koperasi.com`
- **Password**: `password123`

### Admin Unit Usaha (10 Unit)
Admin bertugas mengelola harian (tambah anggota, lihat jurnal, approve awal, dsb) di masing-masing unit mereka. Semua Admin menggunakan password yang sama.

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
Kasir bertugas hanya untuk transaksi operasional harian (seperti input pembelian toko, transaksi cuci mobil, dsb). Semua kasir menggunakan password yang sama.

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

- **Email / NRP**: `69120075` (Gunakan NRP Anggota lainnya yang terintegrasi di database bila ingin melihat akun lain)
- **Password**: `69120075`

*(Anggota dapat mengganti password ini setelah masuk ke halaman Profil mereka di portal anggota)*

---

## 2. Hak Akses Pengguna (Role)

Hierarki akses pengguna dari yang **tertinggi** ke **terendah**:

```
Operator (Super Admin) ▸ Admin ▸ Kasir ▸ Anggota
```

| No | Role | Hak Akses |
|----|------|-----------|
| **1** | **Operator** | Akses penuh: Master Data, Import Anggota, Approve Pinjaman, Laporan Neraca, SHU, Tutup Buku, & Audit Log. |
| **2** | **Admin** | Kelola anggota, pinjaman (review), transaksi kasir, simpanan, cek laporan unit berjalan. |
| **3** | **Kasir** | Petugas harian. POS Toko, setoran simpanan, angsuran pinjaman, cetak struk (thermal/A4). |
| **4** | **Anggota** | Portal khusus untuk cek profil, histori simpanan, pinjaman aktif, serta plafon SHU mandiri. |

---

## 3. Panduan per Role

### 3.1 Tugas Operator
1. **Master Akses**: Membuat data unit cabang, user, dan hak akses.
2. **Akuntansi Utama**: Penyesuaian CoA (Bagan Akun), parameter SHU (sesuai AD-ART).
3. **Impor Tunkin & Gaji**: Import Excel/CSV daftar absen/gaji secara berkala.
4. **Monitoring Menyeluruh**: Mengecek Dashboard utama dan menu **Audit Log** untuk pengawasan.

### 3.2 Tugas Admin Unit
1. **Verifikasi Data Anggota**: Input/edit data manual bila tidak melalui import massal.
2. **Review Kredit Pinjaman**: Pengajuan dari portal anggota masuk ke Admin untuk direview sebelum lolos ke Operator (Bunga 0.3%/Bulan).
3. **Penyusutan Aset**: Registrasi aset baru unit dan perhitungan otomatis penyusutan.

### 3.3 Tugas Kasir Unit
1. **Transaksi POS Toko**: Proses barang retail, bisa dibayar **Tunai** atau **Kredit (Potong Gaji)** dengan lookup NRP. Stok potong otomatis.
2. **Setoran/Tarik Simpanan**: Penerimaan fisik simpanan Pokok, Wajib, Sukarela.
3. **Pelayanan Transaksi**: Input Cuci Mobil, Cetak Fotocopy, Tiket Barbershop.

### 3.4 Tugas Anggota (Polri / PNS Polri)
1. **Cek Saldo Realtime**: Portal dashboard bersih untuk cek total Simpanan aktif.
2. **Tracking Pinjaman**: Melihat sisa tenor angsuran bila ada.

---

## 4. Aplikasi Berbasis Mobile (PWA)

Web-App Koperasi ini sudah mendukung teknologi **PWA (Progressive Web Application)** yang menjadikannya tampil dan bekerja selayaknya aplikasi Mobile NATIVE.

### Cara Install ke Smartphone (Android / iOS):
1. Buka link web Koperasi di browser (Chrome untuk Android / Safari untuk iPhone).
2. Tekan menu opsi browser (titik 3 di Chrome atau icon Share di Safari).
3. Pilih opsi **"Add to Home Screen"** atau **"Tambahkan ke Layar Utama"**.
4. Akan muncul icon Primkoppol di layar HP. 
5. Buka dari icon tersebut. Web-App akan loading menggunakan **Splash Screen** layaknya aplikasi Native, berjalan secara fullscreen (tanpa address bar browser), dan sangat smooth.

---

## 5. Alur Fungsi Koperasi

### 5.1 Kasir dengan Sistem Potong Gaji (Kredit)
Menu `/toko/kasir` dapat menggunakan skema **Kredit**:
- Saat pembayaran, pilih opsi "Kredit (Potong Gaji)".
- Gunakan fitur pencarian anggota (ketik nama atau NRP).
- Secara otomatis sistem kasir membuat jurnal piutang ke nama anggota yang bersangkutan. 
- Piutang ini akan ditarik secara sistem pada saat penutupan atau integrasi daftar potong gaji Tunkin.

### 5.2 Pencetakan Bukti Transaksi (Kwitansi & Struk)
Di halaman cetak tersedia 2 pilihan printer:
- **Cetak Struk Thermal**: Format 80mm untuk printer POS (kasir).
- **Cetak A4**: Format A4 formal untul arsip bendahara / tanda tangan pengurus.

### 5.3 Simpanan Pokok, Wajib & Sukarela
- **Masuk**: `/simpanan/transaksi` → Transaksi Baru → Pembayaran.
- Simpanan Pokok & Wajib **tidak dapat ditarik**, terkecuali anggota pensiun/keluar. (Auto validation di sistem).

### 5.4 Tutup Buku & Sinkronisasi Arus Kas
- Menu `/periode/tutup-buku` otomatis merekap ribuan Jurnal sepanjang periode (bulan/tahun) dan mengunci neraca.
- Angka yang ditarik Arus Kas dan Laporan Neraca otomatis menjadi Net. Pembagian SHU secara realtime diambil dan dicocokkan dengan AD-ART Pasal 42.

### 5.5 Perhitungan Sisa Hasil Usaha (SHU)

Sistem menghitung estimasi SHU secara **realtime** (tanpa harus menunggu Tutup Buku) berdasarkan formulasi AD-ART Pasal 42. SHU anggota terdiri dari **2 komponen**: Jasa Simpanan dan Jasa Anggota (Usaha).

#### A. Tabel Pembagian SHU Sesuai AD-ART Pasal 42

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

#### B. Komponen 1: Jasa Simpanan (Modal) — 20%

Komponen ini memberikan **imbal hasil atas tabungan/simpanan** anggota.

**Sumber Kolam Dana:**

Kolam Jasa Simpanan dihitung dari **total laba bersih koperasi** (termasuk pendapatan dari non-anggota), karena tabungan anggota-lah yang menjadi **modal kerja** untuk seluruh operasi koperasi.

Jika koperasi belum memiliki pendapatan dari transaksi, sistem tetap menghitung estimasi Jasa Simpanan menggunakan **lantai minimum 6% per tahun** dari total modal simpanan. Ini menjamin nilai SHU tidak pernah Rp 0 selama anggota memiliki tabungan.

**Rumus:**

```text
Kolam Jasa Simpanan = MAX(
    Total Laba Bersih Koperasi × 20%,
    Total Modal Simpanan × 6% × 20%
)

SHU Jasa Simpanan Saya = (Simpanan Saya / Total Simpanan Semua Anggota) × Kolam
```

**Yang termasuk "Simpanan Saya":**

- Saldo Simpanan Pokok
- Saldo Tabungan Wajib (Tajib) bulanan
- Total setoran Simpanan Sukarela tahun berjalan

#### C. Komponen 2: Jasa Anggota (Usaha) — 25%

Komponen ini memberikan **cashback langsung** dari margin keuntungan setiap transaksi anggota.

**Metode: Exact Margin Cashback**

Sistem membaca secara persis selisih Harga Jual dikurangi Harga Modal (HPP) dari setiap barang yang dibeli anggota, lalu mengalikannya dengan 25%.

**Rumus per Tipe Transaksi:**

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

**Total SHU Jasa Anggota Saya** = SHU Toko + SHU Unit + SHU Pinjaman

#### D. Total Estimasi SHU Anggota

```text
Total SHU Saya = Jasa Simpanan + Jasa Anggota (Usaha)
```

#### E. Contoh Perhitungan Numerik

Misalkan data anggota Pak Budi:

- Tabungan Wajib (Tajib): Rp 500.000
- Simpanan Pokok: Rp 200.000
- Simpanan Sukarela (setoran tahun ini): Rp 300.000
- Total Simpanan Pak Budi: **Rp 1.000.000**
- Total Simpanan Seluruh Anggota: **Rp 50.000.000**
- Pak Budi belanja di Toko: Beli 2 barang seharga @Rp 15.000 (HPP @Rp 10.000)
- Pak Budi cuci mobil: 1x Rp 35.000
- Total Laba Bersih Koperasi: Rp 10.000.000

**Jasa Simpanan:**

```text
Kolam = Rp 10.000.000 × 20% = Rp 2.000.000
SHU Simpanan Pak Budi = (1.000.000 / 50.000.000) × 2.000.000 = Rp 40.000
```

**Jasa Anggota (Usaha):**

```text
Margin Toko = (15.000 - 10.000) × 2 = Rp 10.000
Margin Cuci Mobil = 35.000 × 80% = Rp 28.000
Total Margin = Rp 38.000
SHU Usaha = 38.000 × 25% = Rp 9.500
```

**Total SHU Pak Budi = Rp 40.000 + Rp 9.500 = Rp 49.500**

#### F. Catatan Penting

1. Estimasi SHU ini bersifat **realtime** dan akan berubah seiring bertambahnya transaksi dan penghasilan koperasi sepanjang tahun buku.
2. Nilai SHU final yang resmi baru ditetapkan pada **Rapat Anggota Tahunan (RAT)** setelah Tutup Buku.
3. Anggota yang **baru bergabung** dan belum memiliki simpanan atau transaksi akan melihat SHU Rp 0 — ini normal.
4. Semakin besar simpanan dan semakin sering bertransaksi, semakin besar SHU yang diperoleh.

---

## 6. Audit Log (Keamanan & Tracking)

(Hanya Operator/SuperAdmin)
Menu **Audit Log** (`/audit-log`) adalah sistem pengawasan ketat keamanan siber koperasi:
- Segala aksi `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `FAILED LOGIN`, serta `EXPORT` dicatat secara *append-only* (tidak bisa dihapus).
- Melacak **IP Address**, **User Agent**, dan menyimpan **Snapshot Data** (Sebelum / Sesudah di edit).
- Dilengkapi tools searching canggih per Modul / per NRP.
