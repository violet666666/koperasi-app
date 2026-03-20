# Panduan Penggunaan Sistem Koperasi Digital PRIMKOPPOL

> **Koperasi:** PRIMKOPPOL Polres Lumajang  
> **Versi:** 1.1  
> **Terakhir Diperbarui:** 20 Maret 2026

Dokumen ini merupakan panduan lengkap penggunaan aplikasi Sistem Koperasi Digital. Panduan ini menjelaskan seluruh fitur dan hak akses setiap pengguna yang terlibat dalam sistem operasi koperasi.

---

## 📋 Daftar Isi

1. [Hak Akses Pengguna (Role)](#1-hak-akses-pengguna-role)
2. [Memulai Sistem & Profil](#2-memulai-sistem--profil)
3. [Alur Kerja Anggota & Kartu Anggota](#3-alur-kerja-anggota--kartu-anggota)
4. [Alur Kerja Transaksi Unit (Toko, Carwash, dll)](#4-alur-kerja-transaksi-unit-toko-carwash-dll)
5. [Pencetakan Bukti Transaksi (Kwitansi & Struk)](#5-pencetakan-bukti-transaksi-kwitansi--struk)
6. [Alur Kerja Simpanan](#6-alur-kerja-simpanan)
7. [Alur Kerja Pinjaman](#7-alur-kerja-pinjaman)
8. [Alur Kerja Kas & Bank](#8-alur-kerja-kas--bank)
9. [Alur Kerja Persetujuan (Approval)](#9-alur-kerja-persetujuan-approval)
10. [Laporan Keuangan](#10-laporan-keuangan)
11. [Pengaturan Master Data](#11-pengaturan-master-data)

---

## 1. Hak Akses Pengguna (Role)

Sistem koperasi ini membagi akses menjadi beberapa peran jabatan. Setiap pengguna hanya dapat mengakses fitur yang menjadi wewenangnya.

| Role (Peran) | Hak Akses & Kewenangan |
|-------------|------------------------|
| **1. Pengurus / Super Admin** | Memiliki akses penuh (Full Access) ke seluruh modul aplikasi. Dapat menyetujui (Approve) pinjaman besar, melihat seluruh laporan Laba Rugi & Neraca, mengatur identitas profil koperasi (Polres Lumajang), serta mengelola Master Data & Manajemen User pengguna. |
| **2. Admin** | Bertugas melakukan operasi data harian. Dapat mendaftarkan anggota baru, mencetak kartu anggota, mengelola data simpanan & pinjaman, dan melihat laporan data keanggotaan. |
| **3. Kasir / Bendahara** | Difokuskan pada penerimaan dan pengeluaran dana Kas/Bank. Berwenang untuk mencairkan pinjaman yang telah di-*approve*, menerima setoran simpanan/angsuran, serta mengelola transaksi POS/Toko. Dapat mencetak struk thermal dan kwitansi. |
| **4. Operator** | Bertugas menangani input transaksi unit usaha (seperti pencucian mobil/carwash, fotocopy, dll). Operator memiliki keterbatasan akses baca-tulis, profil operator dimunculkan simpel hanya sebagai "Operator" tanpa data privasi berlebih (alamat disembunyikan). |
| **5. Anggota** | Menggunakan sistem di *Portal Anggota* mandiri (Member Portal). Dapat masuk menggunakan NRP, melihat history simpanan dan pinjaman, mengetahui estimasi SHU, serta merubah password mandiri. |

---

## 2. Memulai Sistem & Profil

### 2.1 Login
1. Masukkan **Email / NRP** dan **Password**
2. Klik tombol **Masuk**
3. Sistem akan mengarahkan ke **Dashboard** sesuai Role.

### 2.2 Dashboard
Menampilkan statistik *real-time*: Total Anggota, Total Simpanan, Total Pinjaman Aktif, dan Aktivitas transaksi hari ini.

### 2.3 Profil Koperasi & Identitas
Gunakan menu **Profil Koperasi** (Khusus Pengurus/Admin) untuk mengatur legalitas koperasi:
- Nama Badan Hukum
- Alamat Koperasi (di set default ke *Kabupaten Lumajang, Jawa Timur*)
- Logo dan Statistik Utama

### 2.4 Profil Pengguna
- Masing-masing pengguna dapat mengakses menu **Profil Saya** untuk melihat detail kontak.
- **Perhatian untuk Operator**: Sesuai kebijakan keamanan, Role Operator hanya akan memunculkan identitas global (Nama: "Operator", Wilayah: Kabupaten Lumajang / Polres Lumajang), field personal seperti Alamat dinonaktifkan dari tampilan UI.

---

## 3. Alur Kerja Anggota & Kartu Anggota

### 3.1 Pendaftaran Anggota Baru
1. Buka Halaman **Anggota** (`/anggota`)
2. Klik tombol **"+ Tambah Anggota"**
3. Lengkapi form Data Pribadi, NRP, Pangkat, Unit (Polres Lumajang).
4. Klik **"Simpan Anggota"**. Nomor anggota otomatis akan digenerate secara *incremental* oleh sistem.

### 3.2 Pencetakan Kartu Anggota (Ber-Barcode)
Berfungsi mencetak kartu identitas yang bisa dibawa anggota atau di-scan nanti menggunakan alat barcode.
1. Masuk ke navigasi menu **Anggota → Cetak Kartu** (`/anggota/kartu`).
2. Ketik **NRP** lalu klik **Cari**. Detail info anggota akan muncul.
3. Klik tombol **"Cetak Kartu (PDF)"**.
4. Sistem akan mengunduh format visual kartu elegan berlatar biru bertuliskan kop *KOPERASI PRIMKOPPOL POLRES LUMAJANG* lengkap dengan no anggota dan *Barcode CODE128* yang valid.

---

## 4. Alur Kerja Transaksi Unit (Toko, Carwash, dll)

Sistem juga terintegrasi untuk menangani usaha rill milik Koperasi. Diperuntukkan untuk role **Kasir** & **Operator**.

### 4.1 Toko / Retail (Point of Sales)
1. Pergi ke halaman produk kasir toko (`/toko/kasir` atau `/toko/produk`).
2. Katalog yang ditampilkan terhubung dengan database inventaris barang asli secara real-time. Status *Low Stock* (stok menipis) atau *Out of Stock* (habis) otomatis muncul berdasarkan persentase ambang minimum (minStock) di database.
3. Kasir dapat menambah item ke keranjang dan memproses **Checkout**. Nominal kas Koperasi akan bertambah.

### 4.2 Unit Usaha Carwash (Cuci Mobil) & Fotokopi
Unit bisnis di luar retail dapat dicatat via halaman Transaksi Unit.
1. Kunjungi menu **Transaksi Unit** (`/transaksi-unit`).
2. Input NRP Anggota untuk mencatat ke history pembelian anggota tersebut.
3. Pilih Jenis Unit. Jika memilih **"Cuci Mobil" (Carwash)**, pilih kategori yang melayani rincian harga progresif otomatis:
   - **Motor**: Rp 15.000
   - **Mobil kecil**: Rp 35.000
   - **Mobil sedang**: Rp 40.000
   - **Mobil besar**: Rp 45.000
   - **Mobil jumbo**: Rp 50.000
4. Form otomatis menyesuaikan deskripsi & harga. Submit untuk menyimpan.

---

## 5. Pencetakan Bukti Transaksi (Kwitansi & Struk)

Segala transaksi berstatus Lunas (atau pencairan pinjaman, pembayaran angsuran, unit transaksi) dimuat dalam menu **Kwitansi**.
Sistem mendukung 2 bentuk kertas (Universal / A4 dan Struk POS):
1. Buka menu **Kwitansi**, cari transaksi, lalu klik tombol **Cetak (Printer Icon)**.
2. Di halaman preview, Anda diberikan dua tombol opsional:
   - **Cetak Struk Thermal**: Akan membangun file (lebar 80mm) berjenis struk kasir toko kecil. Sangat efisien, ringkas, dan proporsional apabila dicetak menggunakan mini printer kasir jenis Thermal tipe Bluetooth atau USB.
   - **Cetak A4 & Finalisasi**: Dokumen berbentuk A4 panjang landscape, resmi dan bertandatangan untuk tanda terima dokumentasi formal yang di-arsip dalam ordner bendahara. Mengubah rekaman dari Draft menjadi final-Printed.

---

## 6. Alur Kerja Simpanan

Jenis Simpanan terdiri dari Pokok (dibayar awal gabung), Wajib (bulanan teratur), dan Sukarela (dinamis, bebas tarik setor).
**Setor Simpanan**:
1. Buka `/simpanan/transaksi` → "+ Transaksi Baru"
2. Pilih Setoran, temukan NRP Anggota (Polres Lumajang) yang dituju.
3. Input nominal pembayaran.

**Penarikan**: Hanya berlaku untuk simpanan dengan status Liquid (Saldo Sukarela). Simpanan wajib tidak dapat dicairkan kecuali anggota ter-mutasi/keluar.

---

## 7. Alur Kerja Pinjaman

```mermaid
flowchart LR
    Pengajuan --> Approval(Persetujuan) --> Pencairan --> Angsuran/Bayar
```

1. **Pengajuan (Admin/Anggota)**: Input produk pinjaman, tenor bulan, jaminan, tujuan cicilan. Berubah ke status *Pending*.
2. **Approval (Pengurus)**: Buka dashboard Persetujuan. Cek rasio plafon. Klik *Approve* atau *Reject*.
3. **Pencairan (Kasir/Bendahara)**: Mencetak form pencairan tunai (A4 PDF), nominal diteruskan dari Kas/Bank Koperasi kepada pinjaman anggota. Sistem menyusun *Jadwal Angsuran* berderet 1 hingga batas tenor.
4. **Bayar Angsuran**: Pilih bulan pembayaran -> "Bayar Angsuran". Sistem memisahkan otomatis Alokasi Pokok + Angsuran Bunga ke masing-masing akuntansi buku besar.

---

## 8. Alur Kerja Kas & Bank

Gunakan menu Kas & Bank untuk mengontrol liquiditas di luar simpan pinjam (Misal: Bayar listrik, biaya PDAM koperasi, deposit bank).
1. Masuk `/kas-bank`.  Pilih Tambah Transaksi In / Out.
2. Fitur *Transfer Internal* juga disediakan bagi bendahara yang hendak memindahkan tunai dari "Laci Kas Kasir" menuju "Rekening Bank BRI Koperasi".

---

## 9. Alur Kerja Persetujuan (Approval)

- Bertindak sebagai "Pintu Gerbang".
- Terdapat tab riwayat di `/approval` agar seluruh pengurus dapat saling tracking transparansi aktivitas siapa yang menyetujui nominal tertentu di jam tertentu (Timestamping System).

---

## 10. Laporan Keuangan

Menu laporan hanya tersedia untuk Admin dan Pengurus Inti. Semua laporan dapat ditarik data harian maupun cut-off bebas dari tanggal X hingga Y lalu diekspor (Export Excel).
- **Neraca (Balance Sheet)**: Tinjauan Aktiva vs Pasiva.
- **Laba Rugi**: Pendapatan (Bunga, fee admin, hasil toko) vs Beban.
- **Rekap Pinjaman & Tunggakan**: Mendeteksi NRP yang performa cicilannya sudah merah (lewat jatuh tempo) untuk diteruskan perihalnya.

---

## 11. Pengaturan Master Data

Hierarki parameter sistem yang diurus pada hari ke-1 pemakaian sistem (Setup Period):
1. `/master/cabang`: Kantor Pusat vs Capem
2. `/master/produk-simpanan`: Mengedit limit min/maks setoran harian wajib.
3. `/master/produk-pinjaman`: Menetapkan Rumus Suku Bunga (Flat / Anuitas / Menurun Efektif).
4. `/master/users`: Create User Login untuk staf baru masuk, dan blokir/inactive staf yang dimutasi keluar dari formatur Koperasi Polres Lumajang.
