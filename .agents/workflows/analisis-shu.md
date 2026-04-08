---
description: Panduan Analisis Mandiri Keseimbangan dan Distribusi SHU Koperasi
---

Workflow ini menyajikan instruksi tahapan untuk memvalidasi (Quality Assurance) hasil *refactor* perbaikan Sisa Hasil Usaha (SHU) Koperasi. Ikuti tahapan ini untuk membuktikan sendiri konsistensi data dari modul *Single Source of Truth*.

### Persiapan *Environment* (Sistem Lokal)

// turbo
1. Verifikasi integrasi kode dengan _build_ tanpa *error* TypeScript:
```bash
npm run build
```

// turbo
2. Nyalakan sistem secara lokal (jangan lupa untuk menyetel env staging jika diperlukan):
```bash
npm run dev -- -p 3001
```
*(Lewati tahapan ini bila Bapak sudah menyuplai web di Vercel atau menyalakannya dari tab terminal lain).*

### Langkah Pengujian Silang (Cross-Checking) SHU

Buka _browser_ dan masuk ke antarmuka aplikasi. Pilih anggota secara bebas (misal: "Anggota Test UAT" / `UAT-0001`), dan ikuti ketiga uji verifikasi pilar data ini:

#### Uji 1: Persentase Total AD-ART (Laporan SHU Umum)
1. Pergi ke laman: **Laporan -> Sisa Hasil Usaha (SHU)**.
2. Cek tabel kalkulasi pendapatan dan pengeluaran sistem, lalu scroll ke bagian *Alokasi Dana Anggota*.
3. Pastikan angkanya dipecah dan dikunci pada persentase presisi AD-ART Pasal 35: 
   - Jasa Anggota (Usaha) = 30%
   - Jasa Simpanan (Modal) = 20%
   - Cadangan = 25% (dan sisanya Pengurus, Pegawai, Pendidikan, Sosial).

#### Uji 2: Porsi Individu di Tabel Hitung
1. Pergi ke laman: **Periode Pembukuan -> Distribusi SHU**.
2. Angka "Total Laba Anggota" di tabel paling atas **HARUS SAMA PERSIS** dengan "Surplus Member" di Uji 1.
3. Cari nama anggota Anda (contoh `UAT-0001` atau yang sering meminjam uang).
4. Catat nominal total SHU (Gabungan Jasa Modal + Jasa Usaha) milik anggota tersebut secara teliti.

#### Uji 3: Penyelarasan (SSOT) via Profil Dashboard
1. Pergi ke daftar: **Master Data -> Anggota** (Akses Laman Profil Individu).
2. Lihat kolom teks label `Estimasi SHU Tahun Berjalan`.
3. Nominal pada profil tertuju **HARUS MUTLAK 100% IDENTIK** *(match 1:1)* dengan angka di Distribusi (Uji 2). Jika sama artinya perombakan SSOT yang menghilangkan hitungan anomali telah berhasil.

---

### Tes Ekstra: Simulasi Transaksi (Uji Kasbon & Menunggak)

- **Kasbon yang Belum Disetor**: Lakukan satu transaksi Jasa (Fitness / Resto) tapi jangan lunas (*Kasbon*). Cek Estimasi SHU anggota tadi, nominalnya TIDAK BOLEH naik karena _Plafon Cair_ tanpa disetor angsuran tidak lagi berhak mendapat Jasa Usaha.
- **Batalkan 1 Invoice (Void)**: Buka riwayat Kasir Toko, dan ajukan _Void/Batal_ bagi anggota. *Approve* pembatalan itu dari *Inbox Panel* Admin. Hasil Laba SHU koperasinya harusnya menurun, membuang profit ilusi dari pendapatan semu.
