# 📘 Panduan Teknis & Logika Import Buku Kas (Auto-Pilot)
**Koperasi Primkoppol**

Dokumen ini menjelaskan secara rinci bagaimana sistem "Auto-Pilot" mengimpor file Excel Buku Kas bulanan (Kas Tunai, Bank BRI, Bank JATIM) secara cerdas, otomatis, dan aman.

---

## 1. Pemetaan Akun Rekening (Auto-Mapping)
Pada pembaruan terbaru, *dropdown* pemilihan akun telah dihilangkan dari antarmuka (UI). Saat Anda mengunggah file Excel, sistem akan secara mandiri mengidentifikasi dan memetakan transaksi ke 3 pilar rekening utama.

**Prioritas Logika Deteksi:**
Sistem memindai seluruh data pada tabel `CashBankAccount` dan menjatuhkan pilihan dengan kriteria berjenjang (Mencegah salah masuk ke sub-akun seperti *Dana Pegawai/Sosial*):

*   **KAS TUNAI (Kolom debet 8, Kredit 9)**
    Dicari akun yang memiliki nama persis `Kas Tunai`.
*   **BANK BRI (Kolom debet 10, Kredit 11)**
    Dicari secara absolut dengan prioritas:
    1. Akun dengan nama persis `Bank BRI`.
    2. Akun dengan kode unik `B-001`.
    3. Akun yang memiliki nama `bri` **tanpa embel-embel** `purpose` dan tanpa `unitType`.
    
> *Hal ini menjamin 100% uang Anda akan mendarat di KAS UTAMA BRI (B-001), bukan ke sub-akun "Bank BRI - Giro" (BRI-01).*

*   **BANK JATIM (Kolom debet 12, Kredit 13)**
    Dicari secara absolut dengan prioritas:
    1. Akun dengan nama persis `Bank JATIM`.
    2. Akun dengan kode unik `B-002`.
    3. Akun yang memiliki nama `jatim` **tanpa embel-embel** `purpose` (Dana Cadangan/Sosial/Pegawai) dan tanpa `unitType` (Cuci Mobil/Fitness).
    
> *Hal ini menjamin 100% uang Anda akan mendarat di KAS UTAMA JATIM (B-002).*

---

## 2. Pendaratan Waktu (Date Parsing Regional Indonesia)
Secara bawaan, Javascript menggunakan *Locale* Amerika Serikat (`Bulan/Hari/Tahun`). Hal ini menimbulkan masalah jika kasir Koperasi mengetik format Indonesia di Excel (Contoh: `"01-04-2026"` dinitiatkan sebagai 1 April 2026, tetapi dibaca komputer sebagai 4 Januari 2026).

**Solusi Sistem:**
Alih-alih berserah pada komputer, sistem menggunakan *Regular Expression* `match(/^(\d{1,2})/)$` guna mengekstraksi **Hanya Angka Harinya Saja** dari kolom TANGGAL (Kolom ke-3 Excel). Angka ini kemudian dipasangkan secara mutlak dengan Bulan milik Lembar Excel (Misal Sheet `APRIL` otomatis di-set ke bulan 3). 
*Tanggal transaksi akan selalu presisi sesuai buku fisik panitia.*

---

## 3. Deteksi Saldo Awal & Pencegahan Double Count
Terkadang panitia menyisipkan baris seperti `"Sisa Bulan Lalu"`, `"Sisa Setelah Serah Terima"`, atau `"Saldo Awal"` di baris paling atas bulan yang baru.

**Masalah Klasik:**
Jika sistem sekadar membacanya sebagai "Uang Masuk (Debet)", maka saldo di database yang sudah turun temurun dari bulan sebelumnya akan **terjumlahkan secara ganda** (Double Balance).

**Solusi Sistem:**
1. Sistem akan menangkap flag baris `isSaldoAwal` apabila kolom mana pun memuat kata kunci seperti `SISA BULAN LALU` atau `SALDO AWAL`.
2. Saat divalidasi ke Database, sistem akan melakukan *Cek Saldo Terkini* (`currentBalance`):
   * Jika Saldo Akun di Database = **Rp 0** *(Kondisi Basis Kosong)*: Maka baris `"Sisa Bulan Lalu"` diizinkan masuk untuk menginisialisasi saldo rekening.
   * Jika Saldo Akun di Database **> Rp 0** *(Berkelanjutan)*: Maka baris `"Sisa Bulan Lalu"` otomatis **dibuang (bypass)** karena sistem sudah mengakumulasi total uang secara otentik bulan demi bulan.

---

## 4. Mekanisme Multi-Sheet Paralel
Anda dapat mengimpor banyak bulan sekaligus (misal Sheet `"MARET"` dan `"APRIL"` berada di dalam satu file `bukukas_04.xlsx`).
Sistem akan:
1. Memilah baris untuk mengabaikan Header Kosong (Scan nomor urut otomatis).
2. Mengeksekusi transaksi dengan status sekuensial (berurutan) hingga baris mencapai kaki halaman (`Sisa Akhir / Jumlah s.d Bulan`).
3. Secara mandiri mengubah *Label Identifikasi Bulan* sehingga di tabel transaksi tertampil jelas:
   `[IMPORT EXCEL - MARET] Uraian Transaksi` atau `[IMPORT EXCEL - APRIL] Uraian Transaksi`.

---

## 5. Fitur Tabel Riwayat Kas & Bank
Header kolom **Tgl** dan **Saldo** pada tabel "Riwayat Kas & Bank" kini dilengkapi tombol **sorting ascending/descending** (ikon panah atas-bawah). Klik judul kolom untuk mengurutkan data dari terlama→terbaru atau sebaliknya.

---

## 6. Riwayat Bug & Perbaikan Terkait Import

| Bug ID | Tanggal | Masalah | Status |
|--------|---------|---------|--------|
| BUG-106 | 12 Apr 2026 | Import JATIM masuk ke "Dana Pegawai" (ID=14) bukan B-002 | ✅ FIXED |
| BUG-108 | 13 Apr 2026 | Tanggal Excel DD-MM-YYYY terbaca sebagai MM-DD-YYYY (JS US Locale) | ✅ FIXED |
| BUG-109 | 13 Apr 2026 | "Sisa Bulan Lalu" menyebabkan Double Balance | ✅ FIXED |
| BUG-110 | 13 Apr 2026 | Import BRI masuk ke "Bank BRI - Giro" (BRI-01) bukan B-001 | ✅ FIXED |
| BUG-111 | 13 Apr 2026 | Transaksi hilang saat satu baris excel ada Debet DAN Kredit (Parser membuang data Kredit). | ✅ FIXED |

---

## 7. Hasil Verifikasi Terakhir (13 April 2026)

| Akun | Kode | Transaksi | Saldo Akhir | Tanggal | Rantai Saldo |
|------|------|-----------|-------------|---------|-------------|
| Kas Tunai | KAS-002 | 114 | Rp 41.295.576 | ✅ Valid | ✅ Berkesinambungan |
| Bank BRI | B-001 | 13 | Rp 2.283.697.591 | ✅ Valid | ✅ Berkesinambungan |
| Bank JATIM | B-002 | 34 | Rp 2.406.222.430 | ✅ Valid | ✅ Berkesinambungan |
| **TOTAL** | | **161** | **Rp 4.731.215.597**| | |

---

**Status Integrasi:** 🟢 `STABIL` (13 April 2026)

