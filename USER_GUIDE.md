# Panduan Penggunaan Sistem Koperasi Digital PRIMKOPPOL

> **Koperasi:** PRIMKOPPOL Polres Lumajang  
> **Versi:** 1.2  
> **Terakhir Diperbarui:** 20 Maret 2026

Dokumen ini merupakan panduan lengkap penggunaan aplikasi Sistem Koperasi Digital. Panduan ini menjelaskan seluruh fitur dan hak akses setiap pengguna yang terlibat dalam sistem operasi koperasi.

---

## 📋 Daftar Isi

1. [Hak Akses Pengguna (Role)](#1-hak-akses-pengguna-role)
2. [Memulai Sistem & Profil](#2-memulai-sistem--profil)
3. [Panduan per Role](#3-panduan-per-role)
4. [Alur Kerja Anggota & Kartu Anggota](#4-alur-kerja-anggota--kartu-anggota)
5. [Alur Kerja Transaksi Unit (Toko, Carwash, dll)](#5-alur-kerja-transaksi-unit-toko-carwash-dll)
6. [Pencetakan Bukti Transaksi (Kwitansi & Struk)](#6-pencetakan-bukti-transaksi-kwitansi--struk)
7. [Alur Kerja Simpanan](#7-alur-kerja-simpanan)
8. [Alur Kerja Pinjaman](#8-alur-kerja-pinjaman)
9. [Alur Kerja Kas & Bank](#9-alur-kerja-kas--bank)
10. [Alur Kerja Persetujuan (Approval)](#10-alur-kerja-persetujuan-approval)
11. [Laporan Keuangan](#11-laporan-keuangan)
12. [Pengaturan Master Data](#12-pengaturan-master-data)

---

## 1. Hak Akses Pengguna (Role)

Hierarki akses pengguna dari yang **tertinggi** ke **terendah**:

```
Operator (Super Admin) ▸ Admin ▸ Kasir ▸ Anggota
```

| No | Role | Deskripsi | Hak Akses |
|----|------|-----------|-----------|
| **1** | **Operator (Super Admin)** | Pengelola utama sistem Koperasi. Memiliki **akses penuh** ke seluruh modul. | Seluruh fitur tanpa terkecuali: Master Data, Manajemen User, Profil Koperasi, Approve Pinjaman, Laporan Keuangan (Neraca, Laba/Rugi, SHU), Tutup Buku, Audit Log, dan seluruh unit usaha. |
| **2** | **Admin** | Pengelola operasional unit usaha. Setiap unit usaha (Simpan Pinjam, Toko, Cuci Mobil, dll) memiliki Admin masing-masing. | Kelola & lihat anggota, kelola simpanan & pinjaman, approve pinjaman, kas & bank, lihat jurnal & laporan, kelola toko, kelola transaksi unit, kelola pengumuman. |
| **3** | **Kasir** | Petugas transaksi harian di masing-masing unit usaha. | Lihat anggota, kelola simpanan, lihat pinjaman, kas & bank, kelola toko (POS), kelola transaksi unit. |
| **4** | **Anggota** | Anggota koperasi yang menggunakan Portal Anggota. | Hanya lihat data sendiri: profil, riwayat simpanan, riwayat pinjaman, estimasi SHU. |

> **Catatan:** Setiap Admin dan Kasir terikat pada unit usaha tertentu (`unitType`) saat dibuat di Master Data User. Contoh: Admin Toko, Kasir Cuci Mobil, dll.

---

## 2. Memulai Sistem & Profil

### 2.1 Login
1. Masukkan **Email / NRP** dan **Password**.
2. Klik tombol **Masuk**.
3. Sistem akan mengarahkan ke **Dashboard** sesuai Role.

> Akun default Operator: `operator@koperasi.com` / `password123`

### 2.2 Dashboard
Menampilkan statistik *real-time*: Total Anggota, Total Simpanan, Total Pinjaman Aktif, dan Aktivitas transaksi hari ini.

### 2.3 Profil Koperasi (Operator & Admin)
Menu **Profil Koperasi** untuk mengatur identitas resmi koperasi:
- Nama Badan Hukum: PRIMKOPPOL Polres Lumajang
- Alamat: Kabupaten Lumajang, Jawa Timur
- Logo & Statistik Utama

### 2.4 Profil Pengguna
- Setiap pengguna dapat mengakses menu **Profil** untuk melihat dan mengedit data kontak pribadi.
- Semua pengguna teridentifikasi sebagai bagian dari **Polres Lumajang**, **Kabupaten Lumajang**.

---

## 3. Panduan per Role

### 3.1 Panduan Operator (Super Admin)

Operator memiliki kendali penuh atas seluruh sistem. Berikut tugas-tugas utamanya:

| Tugas | Menu | Keterangan |
|-------|------|------------|
| Kelola User & Role | `/master/users` | Membuat akun Admin, Kasir, atau Anggota baru. |
| Profil Koperasi | `/profil-koperasi` | Mengubah identitas resmi koperasi. |
| Master Produk | `/master/produk-simpanan`, `/master/produk-pinjaman` | Mengatur parameter bunga, tenor, plafon pinjaman. |
| Approve Pinjaman | `/approval` | Menyetujui/menolak pengajuan pinjaman besar. |
| Laporan Keuangan | `/laporan/*` | Neraca, Laba Rugi, Rekap Anggota, SHU. |
| Tutup Buku | `/periode` | Menutup periode akuntansi bulanan/tahunan. |
| Audit Log | `/audit-log` | Memonitor seluruh aktivitas sistem (siapa, kapan, apa). |

### 3.2 Panduan Admin Unit

Admin bertugas mengelola operasi harian pada unit usaha yang ditugaskan:

| Tugas | Menu | Keterangan |
|-------|------|------------|
| Kelola Anggota | `/anggota` | Tambah, edit, cetak kartu anggota ber-barcode. |
| Simpanan | `/simpanan/*` | Proses setoran & penarikan simpanan. |
| Pinjaman | `/pinjaman/*` | Input pengajuan pinjaman, mereview sebelum di-approve Operator. |
| Kas & Bank | `/kas-bank` | Catat pemasukan/pengeluaran kas, transfer internal. |
| Toko | `/toko/*` | Kelola stok produk, input harga jual. |
| Transaksi Unit | `/transaksi-unit` | Catat transaksi cuci mobil, fotocopy, fitness, dll. |

### 3.3 Panduan Kasir

Kasir fokus pada aktivitas pencatatan transaksi:

| Tugas | Menu | Keterangan |
|-------|------|------------|
| POS Toko | `/toko/kasir` | Memproses penjualan produk, stok otomatis berkurang. |
| Setoran Simpanan | `/simpanan/transaksi` | Menerima setoran tunai/transfer. |
| Angsuran Pinjaman | `/pinjaman/[id]` | Menerima pembayaran angsuran anggota. |
| Cetak Struk/Kwitansi | `/kwitansi/[id]/cetak` | Mencetak struk thermal (80mm) atau kwitansi A4. |
| Transaksi Unit | `/transaksi-unit` | Input cuci mobil, fotocopy dll. |

### 3.4 Panduan Anggota (Portal Member)

Anggota hanya mengakses Portal Anggota untuk meninjau data pribadinya:

| Tugas | Menu | Keterangan |
|-------|------|------------|
| Profil | `/profil` | Lihat NRP, pangkat, unit, data kontak. |
| Simpanan | Dashboard | Lihat saldo simpanan pokok, wajib, & sukarela. |
| Pinjaman | Dashboard | Lihat history pinjaman dan jadwal angsuran. |
| Ganti Password | `/profil` → Keamanan | Ubah password secara mandiri setelah login perdana. |

---

## 4. Alur Kerja Anggota & Kartu Anggota

### 4.1 Pendaftaran Anggota Baru (Admin/Operator)
1. Buka **Anggota** (`/anggota`) → "**+ Tambah Anggota**".
2. Isi NRP, Nama, Pangkat, Unit (Polres Lumajang), Gaji Pokok.
3. Klik **Simpan**. Nomor Anggota = NRP (otomatis).
4. Sistem otomatis membuat akun login (NRP sebagai username & password awal).

### 4.2 Cetak Kartu Anggota Ber-Barcode (Admin/Operator)
1. Menu **Anggota → Cetak Kartu** (`/anggota/kartu`).
2. Cari NRP → Klik **Cari** → Preview kartu muncul.
3. Klik **Cetak Kartu (PDF)** → Unduh kartu dengan kop **KOPERASI PRIMKOPPOL POLRES LUMAJANG** dan barcode CODE128.

---

## 5. Alur Kerja Transaksi Unit (Toko, Carwash, dll)

### 5.1 Toko / Retail POS (Kasir)
1. `/toko/kasir` — Cari produk, klik untuk tambah ke keranjang.
2. Stok ditampilkan *real-time* dari database.
3. Isi nominal pembayaran → **Bayar Tunai** → Stok otomatis berkurang di database.

### 5.2 Carwash / Cuci Mobil (Kasir/Operator)
1. `/transaksi-unit` → Pilih unit **Cuci Mobil**.
2. Pilih kategori, harga otomatis terisi:
   - **Motor**: Rp 15.000
   - **Mobil kecil**: Rp 35.000
   - **Mobil sedang**: Rp 40.000
   - **Mobil besar**: Rp 45.000
   - **Mobil jumbo**: Rp 50.000
3. Submit untuk menyimpan transaksi.

---

## 6. Pencetakan Bukti Transaksi (Kwitansi & Struk)

Di halaman cetak kwitansi (`/kwitansi/[id]/cetak`) tersedia 2 pilihan:
- **Cetak Struk Thermal**: Format 80mm untuk printer kasir thermal.
- **Cetak A4 & Finalisasi**: Format A4 formal untuk arsip bendahara. Status berubah dari Draft → Printed.

---

## 7. Alur Kerja Simpanan

**Jenis**: Pokok (Rp 100.000, sekali bayar), Wajib (bulanan), Sukarela (fleksibel).

**Setoran**: `/simpanan/transaksi` → "+ Transaksi Baru" → Pilih anggota → Input nominal → Simpan.

**Penarikan**: Hanya untuk Simpanan Sukarela. Simpanan Pokok & Wajib tidak bisa ditarik selama masih menjadi anggota.

---

## 8. Alur Kerja Pinjaman

Aturan pinjaman sesuai **AD-ART Pasal 25 & 26**:
- Bunga maksimal **0,3% per bulan** (9% per tahun)
- Tenor maksimal **3 tahun** (36 bulan)
- Plafon maksimal **Rp 20.000.000**
- Sisa gaji setelah potong angsuran minimal **Rp 2.000.000**

**Alur**: Pengajuan (Admin) → Approval (Operator) → Pencairan (Kasir/Bendahara) → Angsuran Bulanan.

---

## 9. Alur Kerja Kas & Bank

Menu **Kas & Bank** (`/kas-bank`) untuk:
- Catat pemasukan/pengeluaran kas harian.
- Transfer internal antar rekening (Kas → Bank atau sebaliknya).

---

## 10. Alur Kerja Persetujuan (Approval)

Endpoint approval (`/approval`) digunakan oleh **Operator** dan **Admin** untuk menyetujui/menolak pengajuan pinjaman dan transaksi besar lainnya. Riwayat lengkap tercatat di tab Riwayat.

---

## 11. Laporan Keuangan (Operator & Admin)

| Laporan | URL |
|---------|-----|
| Neraca | `/laporan/neraca` |
| Laba Rugi | `/laporan/laba-rugi` |
| Rekap Anggota | `/laporan/rekap-anggota` |
| Rekap Simpanan | `/laporan/rekap-simpanan` |
| Rekap Pinjaman | `/laporan/rekap-pinjaman` |
| SHU | `/laporan/shu` |

Semua laporan bisa di-export ke **Excel** dan **PDF**.

---

## 12. Pengaturan Master Data (Operator)

Setup awal yang wajib dilakukan oleh Operator sebelum sistem digunakan:

1. `/master/cabang` — Setup cabang koperasi.
2. `/master/produk-simpanan` — Atur Simpanan Pokok (min Rp 100.000), Wajib, Sukarela.
3. `/master/produk-pinjaman` — Atur bunga, tenor, plafon sesuai AD-ART.
4. `/master/coa` — Chart of Accounts (struktur akuntansi).
5. `/master/users` — Buat akun Admin & Kasir per unit usaha.
6. `/master/journal-mapping` — Pemetaan jurnal otomatis.
7. `/master/parameter-shu` — Parameter pembagian SHU.

---

*Dokumen ini adalah panduan penggunaan Sistem Koperasi Digital PRIMKOPPOL Polres Lumajang. Untuk bantuan teknis, hubungi Operator sistem.*
