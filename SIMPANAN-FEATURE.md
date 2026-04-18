# REKAPITULASI FITUR SIMPANAN (POKOK, WAJIB, SUKARELA)

Dokumen ini merangkum seluruh fungsionalitas, perbaikan (*bug fix*), dan logika sistem untuk operasi Simpanan (Pokok, Wajib, Sukarela) yang ada pada Koperasi berdasarkan catatan terakhir (hingga April 2026). Fitur memengaruhi dua kelompok utama: **Operator (Admin/Staf Koperasi)** dan **Anggota (Biasa)**.

---

## A. FITUR UNTUK OPERATOR KOPERASI

### 1. Sistem Pencatatan Setoran & Penarikan Simpanan
- **Form Real-Time Dinamis (`/simpanan/transaksi/tambah`)**:
  - Penambahan form transaksi dengan *Live Autocomplete* untuk pencarian anggota berdasarkan NRP atau Nama (debounce 350ms, fitur *dropdown* memunculkan avatar letak anggota Polri/PNS).
  - Sistem terkoneksi langsung ke API asli (`POST /api/savings/transactions`), bukan sekadar data *dummy*.
  - **Auto-Show Saldo Terkini**: Ketika operator memilih nama anggota & produk, angka saldo simpanan secara otomatis langsung tampil sebelum operator mengetik jumlah besaran nominal, sehingga menghindari kesalahan cek saldo.
- **Batasan Kebijakan Koperasi (AD-ART Pasal 26)**:
  - Opsi form transaksi "Penarikan" akan otomatis dikunci dan dicoret (disabled) apabila operator memilih produk **Simpanan Pokok** atau **Simpanan Wajib**. Muncul *alert*/informasi penolakan. Permintaan penarikan ke Backend API juga diblokir bila dipaksa masuk (bypass error handling).
- **Penyesuaian UI Otomatis**:
  - Filter Kas Koperasi (Dropdown Metode Pembayaran) dinonaktifkan ketika operator sedang menambahkan fitur deposit/setoran, dan hanya terbuka jika melakukan "Penarikan" (agar logis). Menggunakan query aman yang membaca seluruh kas operasional koperasi.

### 2. Rekonsiliasi & Akuntansi Ganda (Double-Entry)
- Setiap kali transaksi simpanan terjadi, operasi di backend menggunakan `prisma.$transaction`.
- **Setoran**: Melakukan penambahan di `SavingsAccount` milik Anggota dan **Otomatis mencetak uang masuk** (`CashBankTransaction in`) ke Kas Koperasi / Bank Jatim Koperasi.
- **Penarikan**: Mengurangi saldo akun Anggota dan **otomatis mencetak uang keluar** dari Kas Sistem.
- Hadirnya akun `KAS-JATIM-SIM` (Kas Tunai) dan `BNK-JATIM-SIM` (Bank Jatim) khusus untuk menampung lalu lintas alokasi Simpanan anggota (Pemisahan Operasional Toko vs Simpan pinjam).

### 3. Koreksi (*Override*) dan CRUD Modifikasi Transaksi Lama
- **Override Saldo secara Instant (`/anggota/[id]/edit`)**:
  - Operator bebas menimpa/mengubah *Saldo Pokok*, *Wajib*, dan *Sukarela* di form Edit Anggota secara *Real-Time*.
  - Menimpa saldo ini tidak merusak buku besar akuntansi, melainkan otomatis mencetak dokumen "Nota Koreksi" (*Correction*) di `SavingsTransaction`.
- **Edit & Delete Mutasi**:
  - Dukungan utuh bagi backend `PUT` dan `DELETE` di `/api/savings/transactions/[id]`.
  - Sistem memiliki logika **Anti-Negative Balance**: memulihkan riwayat yang dihapus/diedit & menolak revisi apabila kalkulasi mundur tersebut membuat saldo anggota jadi angkanya minus/defisit.
  - Saat dialog modal *Edit* ditekan, Profil Nama Anggota dan Produk akan diblokir menjadi *Read-Only* untuk mencegah operator salah *edit* objek lintas-anggota.

### 4. Ekspor dan Pelaporan Anggota Massal
- **Import Historis TAJIB Otomatis (Excel Import)**:
  - Script secara cerdas mengetahui kelompok letak kolom "Saldo Terakhir" (Posisi Kolom Grup 2) ketika membaca dokumen Excel TAJIB.
  - Memasukkan rekaman setoran secara spesifik menyesuaikan label bulanan (misal: Januari, Pebruari, dst) hingga langsung tercetak mutasinya di rincian buku anggota.
  - Generate Nomor Rekening Simpanan unik (PKK-xxx, WJB-xxx, SKR-xxx) otomatis bagi anggota impor yang belum punya rekening.
- **Cetak Laporan Lengkap PDF / Excel**:
  - Perbaikan cetak *Rekap Simpanan Anggota* berhasil mengeksekusi semua baris data dengan Grand Total (100% utuh tidak terpotong ke batas paginasi page 1 saja).

---

## B. FITUR UNTUK ANGGOTA (PORTAL WEB WEB & MOBILE)

### 1. Panel Rincian Tabungan (Transparansi Saldo)
- **Modul Detail Tabungan Bulan ke Bulan**:
  - Membuka informasi transparan untuk **Simpanan Wajib**. Ketika diklik *accordion* untuk diperluas: sistem menampilkan rentetan Setoran bulan-per-bulan secara rapi (contoh: 📅 APRIL + Rp 100.000).
  - Total saldo diawali dengan hitungan sub "Saldo Awal Akumulasi" lalu ditambah transaksi bulanan. Format desain visual mengacu pada garis cetak presisi (*Dashed Border*).
  - Tampilan selaras berlaku seimbang untuk Web/Desktop Dashboard maupun aplikasi platform Mobile (React Native + Expo).

### 2. Standar Single Source of Truth Sistem Simpanan
- **Solusi BUG Angka Ganda (*Double-Count*)**:
  - Profil akumulasi saldo sekarang 100% eksklusif merujuk pada isi di tabel *Active Ledger* bernama `SavingsAccount.balance`. Angka bawaan dari migrasi/profil kuno CSV (`Member.tabunganWajib`) telah dibuang dari komputasi utama supaya total Simpanan (dan besaran dasar SHU) tidak bertambah 2 kali lipat secara ghoib.

### 3. Integritas Pengecualian Transaksi Batal (Voided)
- Setiap transaksi pemotongan gaji atau aksi finansial yang kemudian **digugurkan** (*DIBATALKAN/VOIDED*) oleh Admin (Contra-entry void) langsung disaring keluar oleh backend.
- Modifikasi status `voided` muncul dengan blok abu-abu pada portal anggota agar anggota tahu transaksi usang terkait simpanan/gaji tersebut tak lagi mengikat tanggungan secara hukum atau menyumbat pool nilai SHU.

---
**Dokumen Referensi Otomatis:** Diekstrak berdasarkan rilis teknis *BUG-FIX-CURRENT.md* dan *UPDATE-FIX-CURRENT.md*.

---

## C. DAFTAR BUG & ISU TERKINI — ✅ RESOLVED (16 April 2026)

Berdasarkan *technical review* lanjutan, ditemukan 2 anomali logika (*logical bugs*). **Keduanya sudah diperbaiki.**

### 1. ✅ *Ghost Balance* Muncul Saat Saldo Wajib Di-Override Menjadi 0 (Nol)
- **Gejala Masalah**:  
  Ketika operator mengubah (override) saldo Tabungan Wajib anggota menjadi `0` melalui halaman Edit Anggota, *Backend API* telah dengan benar mencatat mutasi "Koreksi" di tabel `SavingsTransaction` ke nilai `Rp 0`. Namun, ketika dicek pada **Dashboard Portal Anggota**, saldo Tabungan Wajib tersebut tidak berubah menjadi `0`, melainkan malah kembali ke nominal profil historis lama (misal: Rp 21.560.000).
- **Akar Masalah (Root Cause)**:  
  Logika fallback `importedWajib > 0 ? importedWajib : legacyWajib` dan `Number(acc.balance) > 0` mengira saldo 0 = "belum diimport", sehingga memicu fallback ke data legacy.
- **Perbaikan**:  
  - `api/member-portal/summary/route.ts` → Hapus syarat `&& Number(acc.balance) > 0` pada `hasImportedWajib`.
  - `portal/dashboard/page.tsx` → Ganti ke pengecekan `wajibAccount` exist (truthy), bukan `balance > 0`.
  - `portal/simpanan/page.tsx` → Sembunyikan kartu legacy jika rekening wajib sudah ada di database.

### 2. ✅ Riwayat Tabungan Portal Tidak Memuat Transaksi "Koreksi" & "Tarikan"
- **Gejala Masalah**:  
  Anggota tidak bisa melihat riwayat "Pemotongan/Koreksi Saldo" di modul **Detail Tabungan** bulanan portal mereka. Hanya deretan setoran yang tampil.
- **Akar Masalah (Root Cause)**:  
  Filter `wajibHistory.filter((h: any) => h.type === 'deposit' ...)` mengabaikan `correction` dan `withdrawal`.
- **Perbaikan**:  
  - `portal/dashboard/page.tsx` → Hapus filter eksklusif `deposit`. Semua tipe transaksi (kecuali Saldo Awal) kini ditampilkan.
  - Transaksi koreksi diberi label `⚠ KOREKSI` (merah), penarikan `↩ PENARIKAN` (merah), setoran tetap `📅 BULAN` (hijau).

### 3. ✅ Silent Skip Override — Override Saldo Gagal Diam-diam Jika Rekening Belum Ada
- **Gejala Masalah**:  
  Saat operator mengisi angka di "Penyesuaian Total Saldo Simpanan" pada halaman Edit Anggota, jika anggota tersebut belum pernah dibukakan rekening simpanan (Pokok/Wajib/Sukarela), backend mengembalikan "Berhasil diperbarui" tetapi saldo tidak pernah berubah — karena blok `if (acc)` bernilai `false` dan di-skip tanpa pesan error.
- **Perbaikan**:  
  - `api/members/[id]/route.ts` → Jika rekening belum ada, sistem **otomatis membuat rekening baru** (auto-create) dengan nomor unik `PKK-xxxx` / `WJB-xxxx` / `SKR-xxxx`, lalu langsung set saldonya sesuai input operator.
  - Jika produk simpanan tipe tersebut belum ada di database, sistem mengembalikan **error yang jelas** ke operator: *"Produk simpanan tipe 'xxx' tidak ditemukan. Silakan buat di menu Master."*

---

## D. FITUR BARU: FULL CRUD BUKU REKENING (16 April 2026)

### 1. Edit Detail Rekening (`/simpanan/rekening`)
- **Aksi "Edit Rekening"** ditambahkan pada dropdown menu setiap baris rekening.
- Operator dapat mengubah **Nomor Rekening** dan **Tanggal Buka Rekening** melalui modal dialog.
- Validasi duplikat nomor rekening diterapkan di backend — jika sudah ada milik anggota lain, ditolak dengan pesan spesifik.
- Saldo tidak bisa diubah dari sini (ada catatan informasi yang mengarahkan operator ke menu Penyesuaian Saldo).

### 2. Shortcut "Rincian Transaksi" (`/simpanan/rekening`)
- **Aksi "Rincian Transaksi"** ditambahkan pada dropdown menu setiap baris rekening.
- Mengarahkan operator langsung ke halaman **Transaksi Simpanan** dengan filter otomatis berdasarkan nama anggota terkait.

### 3. Error Handling yang Ditingkatkan
- Backend `PUT /api/savings/accounts/[id]` diperluas untuk menangani `accountNo`, `openedDate`, dan `status` secara bersamaan.
- Prisma error code `P2002` (unique constraint) ditangkap dan diterjemahkan ke pesan Indonesia yang informatif.
- Backend `PUT /api/members/[id]` mengembalikan pesan error yang jelas jika produk simpanan belum ada di database.

---

## 🔴 BUG BARU DITEMUKAN — 18 April 2026

### BUG-SIMPANAN-001 — Tombol "Simpan Transaksi" Tidak Merespon Saat Penarikan Sukarela

**Tanggal Ditemukan:** 18 April 2026
**Status:** ✅ FIXED
**Severity:** High (Menghambat pencatatan operasional penarikan simpanan)
**URL Terdampak:** `https://www.primkoppol.online/simpanan/transaksi/tambah`

**Gejala:**
Operator tidak bisa memproses penarikan tabungan Sukarela. Ketika mencoba menekan tombol "Simpan Transaksi", tombol tersebut tampak tidak berfungsi (mati/tidak merespon sama sekali), dan tidak ada pesan *error* atau pemberitahuan yang muncul di layar.

**Akar Masalah (Root Cause) — Silent HTML5 Form Validation Failure:**
Masalah ini diakibatkan oleh perilaku *native form validation* dari komponen UI kustom (Radix UI `Select`). 
Pada form Penarikan, *dropdown* "Kas Koperasi" (di dalam kode adalah `cashBankAccountId`) wajib diisi. Atribut `required` disematkan pada komponen `<Select>`. 
Ketika `required` dipicu tanpa diisi, Radix membuat elemen `select` *native* tersembunyi (*visually hidden*) dengan atribut `required`. Saat *form* di-*submit*, *browser* menyadari ada kolom tersembunyi yang belum terisi, dan mencoba menampilkan *tooltip* peringatan (*"Please fill out this field"*). Namun karena elemennya tersembunyi/tidak kasatmata, *tooltip* tersebut gagal dirender, membuat proses *submit* dibatalkan secara sepihak (*silent failure*) oleh *browser* tanpa sepengetahuan *user*.

**File yang Diperbaiki:**
- `src/app/(protected)/simpanan/transaksi/tambah/page.tsx` (baris 364 & 508)

**Solusi:**
```diff
  <Select
      value={formData.cashBankAccountId}
      onValueChange={(value) => handleSelectChange("cashBankAccountId", value)}
-     required
  >
```
Atribut `required` pada komponen `<Select>` kustom ditiadakan karena sering menimpa validasi manual. Sebagai gantinya, sistem sekarang akan sepenuhnya mengandalkan validasi manual JavaScript yang sudah kita sediakan dalam `handleSubmit`. Jika operator lupa mengisi akun kas, kini sistem akan secara eksplisit memunculkan notifikasi silang merah (Toast Error): **"Pilih akun Kas/Bank untuk transaksi penarikan ini"**.

---

*Diperbarui: 18 April 2026*
