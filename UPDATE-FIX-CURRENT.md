# Catatan Update Aplikasi

---

## ⚠️ PANDUAN UAT STAGING — WAJIB BACA SEBELUM TESTING ⚠️

> **KRITIS:** Panduan ini **WAJIB** diikuti sebelum melakukan UAT apapun.
> Semua testing **HARUS** di staging database (Supabase), **BUKAN** production (Neon).
> **Hanya jalankan prosedur ini jika ada request UAT dari Browser Agent atau user.**

---

### 🔑 AKUN UAT — COPY-PASTE LANGSUNG

**Password SEMUA akun UAT:** `uat123456`

**Akun yang paling sering dipakai untuk testing:**

| Akun | Email | Password |
| --- | --- | --- |
| **Admin Cuci Mobil** | `admin.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| **Kasir Cuci Mobil** | `kasir.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| **Admin Toko** | `admin.uat.toko@primkoppol.test` | `uat123456` |
| **Kasir Toko** | `kasir.uat.toko@primkoppol.test` | `uat123456` |

**Daftar lengkap akun UAT (dari `prisma/seed-uat.ts`):**

| No | Role | Unit | Email | Password |
| --- | --- | --- | --- | --- |
| 1 | Kasir | Toko | `kasir.uat.toko@primkoppol.test` | `uat123456` |
| 2 | Admin | Toko | `admin.uat.toko@primkoppol.test` | `uat123456` |
| 3 | Kasir | Cuci Mobil | `kasir.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| 4 | Admin | Cuci Mobil | `admin.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| 5 | Kasir | Barbershop | `kasir.uat.barbershop@primkoppol.test` | `uat123456` |
| 6 | Admin | Barbershop | `admin.uat.barbershop@primkoppol.test` | `uat123456` |
| 7 | Kasir | PlayStation | `kasir.uat.play_station@primkoppol.test` | `uat123456` |
| 8 | Admin | PlayStation | `admin.uat.play_station@primkoppol.test` | `uat123456` |
| 9 | Kasir | Fitness | `kasir.uat.fitness@primkoppol.test` | `uat123456` |
| 10 | Admin | Fitness | `admin.uat.fitness@primkoppol.test` | `uat123456` |
| 11 | Kasir | Resto | `kasir.uat.resto@primkoppol.test` | `uat123456` |
| 12 | Admin | Resto | `admin.uat.resto@primkoppol.test` | `uat123456` |

**Anggota Test UAT:**

| Fungsi | MemberNo | NRP | Nama | Plafon |
| --- | --- | --- | --- | --- |
| Test OK | UAT-0001 | UAT99001 | Anggota Test OK | Rp 5.000.000 |
| Test Blokir | UAT-0002 | UAT99002 | Anggota Test Blokir | Rp 0 (over limit) |

> **⚠️ JANGAN** login dengan akun `@koperasi.com` — itu akun **PRODUCTION**.
> **⚠️ GUNAKAN** hanya akun `@primkoppol.test` dengan password `uat123456`.
> **⚠️ JANGAN** gunakan "Forgot Password" — password sudah fix, tidak perlu reset.
> **⚠️ JANGAN** jalankan seed.ts atau seed-uat.ts ke database production (Neon).

---

### 📖 STEP-BY-STEP MENJALANKAN UAT (Hanya jika request UAT Browser Agent)

**Prasyarat:** Terminal PowerShell, folder `koperasi-app`.

**Step 1 — Set environment variables staging:**

```powershell
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
$env:NEXTAUTH_SECRET="uat-staging-secret-primkoppol-2026"
$env:NEXTAUTH_URL="http://localhost:3001"
```

**Step 2 — Jalankan dev server di port 3001:**

```powershell
npm run dev -- -p 3001
```

**Step 3 — Buka browser dan login:**

- URL: `http://localhost:3001`
- Email: (pilih dari tabel akun di atas, misal `admin.uat.cuci_mobil@primkoppol.test`)
- Password: `uat123456`

**Step 4 — Lakukan testing sesuai request.**

### 🔄 JIKA STAGING DB KOSONG (Pertama Kali / Setelah Reset)

Jalankan perintah ini **SATU PER SATU** secara berurutan:

```powershell
# 1. Set DATABASE_URL ke staging (WAJIB)
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"

# 2. Push schema Prisma ke staging DB
npx prisma db push --accept-data-loss

# 3. Seed data dasar (roles, branch, CoA, akun staff)
npx tsx prisma/seed.ts

# 4. Seed data UAT (akun @primkoppol.test, produk dummy, member test)
npx tsx prisma/seed-uat.ts
```

> **Catatan:** Step 3 membuat data dasar sistem. Step 4 membuat akun UAT `@primkoppol.test`.
> Keduanya **WAJIB** dijalankan agar bisa login.

### 📁 File Penting UAT

| File | Keterangan |
| --- | --- |
# Catatan Update Aplikasi

---

## ⚠️ PANDUAN UAT STAGING — WAJIB BACA SEBELUM TESTING ⚠️

> **KRITIS:** Panduan ini **WAJIB** diikuti sebelum melakukan UAT apapun.
> Semua testing **HARUS** di staging database (Supabase), **BUKAN** production (Neon).
> **Hanya jalankan prosedur ini jika ada request UAT dari Browser Agent atau user.**

---

### 🔑 AKUN UAT — COPY-PASTE LANGSUNG

**Password SEMUA akun UAT:** `uat123456`

**Akun yang paling sering dipakai untuk testing:**

| Akun | Email | Password |
| --- | --- | --- |
| **Admin Cuci Mobil** | `admin.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| **Kasir Cuci Mobil** | `kasir.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| **Admin Toko** | `admin.uat.toko@primkoppol.test` | `uat123456` |
| **Kasir Toko** | `kasir.uat.toko@primkoppol.test` | `uat123456` |

**Daftar lengkap akun UAT (dari `prisma/seed-uat.ts`):**

| No | Role | Unit | Email | Password |
| --- | --- | --- | --- | --- |
| 1 | Kasir | Toko | `kasir.uat.toko@primkoppol.test` | `uat123456` |
| 2 | Admin | Toko | `admin.uat.toko@primkoppol.test` | `uat123456` |
| 3 | Kasir | Cuci Mobil | `kasir.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| 4 | Admin | Cuci Mobil | `admin.uat.cuci_mobil@primkoppol.test` | `uat123456` |
| 5 | Kasir | Barbershop | `kasir.uat.barbershop@primkoppol.test` | `uat123456` |
| 6 | Admin | Barbershop | `admin.uat.barbershop@primkoppol.test` | `uat123456` |
| 7 | Kasir | PlayStation | `kasir.uat.play_station@primkoppol.test` | `uat123456` |
| 8 | Admin | PlayStation | `admin.uat.play_station@primkoppol.test` | `uat123456` |
| 9 | Kasir | Fitness | `kasir.uat.fitness@primkoppol.test` | `uat123456` |
| 10 | Admin | Fitness | `admin.uat.fitness@primkoppol.test` | `uat123456` |
| 11 | Kasir | Resto | `kasir.uat.resto@primkoppol.test` | `uat123456` |
| 12 | Admin | Resto | `admin.uat.resto@primkoppol.test` | `uat123456` |

**Anggota Test UAT:**

| Fungsi | MemberNo | NRP | Nama | Plafon |
| --- | --- | --- | --- | --- |
| Test OK | UAT-0001 | UAT99001 | Anggota Test OK | Rp 5.000.000 |
| Test Blokir | UAT-0002 | UAT99002 | Anggota Test Blokir | Rp 0 (over limit) |

> **⚠️ JANGAN** login dengan akun `@koperasi.com` — itu akun **PRODUCTION**.
> **⚠️ GUNAKAN** hanya akun `@primkoppol.test` dengan password `uat123456`.
> **⚠️ JANGAN** gunakan "Forgot Password" — password sudah fix, tidak perlu reset.
> **⚠️ JANGAN** jalankan seed.ts atau seed-uat.ts ke database production (Neon).

---

### 📖 STEP-BY-STEP MENJALANKAN UAT (Hanya jika request UAT Browser Agent)

**Prasyarat:** Terminal PowerShell, folder `koperasi-app`.

**Step 1 — Set environment variables staging:**

```powershell
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
$env:NEXTAUTH_SECRET="uat-staging-secret-primkoppol-2026"
$env:NEXTAUTH_URL="http://localhost:3001"
```

**Step 2 — Jalankan dev server di port 3001:**

```powershell
npm run dev -- -p 3001
```

**Step 3 — Buka browser dan login:**

- URL: `http://localhost:3001`
- Email: (pilih dari tabel akun di atas, misal `admin.uat.cuci_mobil@primkoppol.test`)
- Password: `uat123456`

**Step 4 — Lakukan testing sesuai request.**

### 🔄 JIKA STAGING DB KOSONG (Pertama Kali / Setelah Reset)

Jalankan perintah ini **SATU PER SATU** secara berurutan:

```powershell
# 1. Set DATABASE_URL ke staging (WAJIB)
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"

# 2. Push schema Prisma ke staging DB
npx prisma db push --accept-data-loss

# 3. Seed data dasar (roles, branch, CoA, akun staff)
npx tsx prisma/seed.ts

# 4. Seed data UAT (akun @primkoppol.test, produk dummy, member test)
npx tsx prisma/seed-uat.ts
```

> **Catatan:** Step 3 membuat data dasar sistem. Step 4 membuat akun UAT `@primkoppol.test`.
> Keduanya **WAJIB** dijalankan agar bisa login.

### 📁 File Penting UAT

| File | Keterangan |
| --- | --- |
| `.env.test.local` | Env staging referensi (sudah di `.gitignore`) |
| `prisma/seed.ts` | Seed data dasar (roles, branch, CoA, akun staff) |
| `prisma/seed-uat.ts` | Seed data UAT (akun `@primkoppol.test`, produk dummy, member test) |
| `tmp_query.sql` | File temp query (sudah di `.gitignore`) |
| `tmp_query.ts` | File temp script (sudah di `.gitignore`) |

---

## UPDATE 08 April 2026 — Sesi 8: Optimasi UX Barcode Scanner & Keranjang POS Toko

### [FIX] Input Barcode Scanner Terakumulasi (Menyambung Panjang)
**File:** `src/app/(protected)/toko/kasir/page.tsx` & `src/components/patterns/data-table.tsx`
**Masalah:** Saat kasir melakukan scan barcode mesin lebih dari satu kali, input mesin yang cepat diakhiri dengan tombol "Enter" secara default tidak mereset nilai kolom *Search*. Akibatnya rentetan panjang barcode malah menyatu satu baris seperti `457241851351331523183153851`.
**Solusi:** Menambahkan penanganan `onKeyDown` secara spesifik pada `Input` pencarian.
- Jika *scan* sukses masuk keranjang, kotak pencarian langsung **dikosongkan (`""`)**.
- Jika *scan* tidak ada di DB, atau *scan* digunakan pada `data-table` untuk ngecek barang, teks yang bersangkutan otomatis kena **blok (`e.currentTarget.select()`)** begitu tombol enter terdeteksi. Sehingga scan baru akan menimpa string yang lama dengan persis.

### [UX] Informasi Instan Sisa Stok Fisik pada Menu Keranjang
**File:** `src/app/(protected)/toko/kasir/page.tsx`
**Masalah:** Petugas kerap tidak bisa mengecek nominal sisa stok ketika menu pencarian langsung loncat mendaratkan item ke keranjang.
**Solusi:**
- Memodifikasi *Toast* (Popup Sukses) agar menampilkan `(Sisa Stok: X)` ketika kasir menggunakan bar scanner.
- Menyematkan *Badge Lencana Sisa Stok* berwarna biru yang menempel eksplisit tepat pada komponen baris produk di dalam antrean Keranjang.

### [UX] Input Kuantitas Pembelian Grosir Langsung via Keyboard
**File:** `src/app/(protected)/toko/kasir/page.tsx`
**Masalah:** Kasir protes harus me-*klik* tombol "+" berkali-kali untuk mengakomodasi pembelian yang lebih dari satuan tunggal.
**Solusi:** Merombak elemen `span` menjadi kolom `Input[type="numeric"]` yang dinamis:
- Dukungan mengetik angka spesifik via *keyboard*.
- Validasi instan yang langsung membatasi *"stuck/mentok"* di angka plafon fisik (stock maximum) produk bila kasir sengaja mengisi *oversold*.
- Mempertahankan kegunaan icon "+" dan "-".

## UPDATE 08 April 2026 — Sesi 8.1: Manajemen Profil Lanjutan & Import Historis TAJIB

### [FEATURE] Manajemen Finansial Real-Time di Form Anggota
- **File:** `src/app/(protected)/anggota/[id]/edit/page.tsx`
- **Tujuan:** Memberikan kendali penuh pada Operator untuk mengubah parameter finansial tanpa masuk ke database mentah.
- **Implementasi:**
  1. Penambahan input `Setoran Bulanan`: Gaji Bersih, Tunkin, Target Tabungan Wajib, dan Plafon Piutang (Kredit Toko).
  2. Implementasi **Override Saldo Simpanan (Real-Time)**: Input untuk saldo Pokok, Wajib, dan Sukarela yang otomatis terkoneksi ke data `SavingsAccount`.
  3. **Auto-Correction System:** Pengubahan saldo secara manual (Override) tidak mengubah saldo secara barbar, melainkan mencetak **Nota Koreksi (*Correction*)** di tabel `SavingsTransaction` demi menjaga integritas Ledger dan Kas Bank Koperasi.
  4. Penambahan UI Helper text informatif untuk mengurangi kebingungan operator.

### [ROLES] Manajemen Hak Akses Lintas Operator Langsung dari Profil
- Admin kini bisa memasang peran akun (*User Role*) kepada anggota jika yang bersangkutan adalah staff Koperasi. Pemasangan akses ini disinkronisasikan menggunakan *Prisma Transaction Database*.

### [FEATURE] Perekaman Historis Otomatis via Import TAJIB
- **File:** `src/app/api/members/import/route.ts` & `src/app/(protected)/master/import-data/page.tsx`
- **Konteks:** Mekanisme import TAJIB sebelumnya keliru: kolom *JML* tabungan dimasukkan ke kolom *Target Potongan Bulanan*, bukan ke rekening dompet saldo.
- **Solusi:**
  1. Skrip dirombak agar mampu memakan payload kompleks berisi: `POKOK`, `WAJIB`, serta pilar bulan: `JANUARI - DESEMBER` sekaligus dalam satu *Spreadsheet*.
  2. Skrip otomatis menembak ke `SavingsTransaction` untuk mencetak Riwayat Setoran masing-masing bulan yang ada nominalnya.
  3. Skrip memindahkan saldo bawaan excel ke pos Simpanan Pokok dan Simpanan Wajib dengan tipe *Correction*.
  4. Laman *Preview Data/Pratinjau Tabel* kini mengeluarkan rangkuman cerdas berbungkus *badge emerald* ("Dideteksi: PKK (x), WJB_Awl (y), +3 bln setoran") agar meyakinkan operator sesaat sebelum klik **Import**.

### [SECURITY] Auto-Logout (Idle Timeout)
- **Komponen:** `src/components/layout/auto-logout.tsx`
- **Implementasi:** Sistem kini memantau aktivitas kursor, sentuhan layar, dan keyboard secara *real-time*. Jika mendapati Web Operator/Kasir ditelantarkan tanpa disentuh selama **5 Menit**, maka Aplikasi akan mencekik sesi aktif dengan sebuah pop-up *warning* lalu mendepak Operator tersebut (*Force Logout*) ke halaman Login.

### [UI/UX] Penyesuaian Posisi Bottom Navigation (Android PWA View)
- **Komponen:** `src/components/layout/bottom-nav.tsx`
- **Perbaikan:** Menambahkan bantalan pengaman ruang bawah statis 16px ekstra dipadukan dengan penghitungan `safe-area-inset-bottom`. Ini akan mendongkrak bilah menu navigasi ('Beranda, Approval, Anggota, dll') sedikit ke atas ala *Instagram* sehingga tidak lagi tumpang tindih atau dimakan oleh bilah kendali gestur (Home/Back) bawaan Android.

---

## UPDATE 07 April 2026 — Sesi 7: Bug Fix Dashboard, Export PDF, dan UAT Environment

### [FIX] Filter "Hari Ini" Menarik Data Kemarin (Timezone Coercion)

**File:** `src/app/api/unit/[slug]/laporan/route.ts`

**Root cause:** Kolom `transactionDate` bertipe `@db.Date` yang hanya menangkap kalender (`YYYY-MM-DD`). Saat frontend memfilter "Hari Ini", backend mengirim boundaries berbasis UTC timestamp (contoh: April 6 `17:00:00Z`). PostgeSQL melakukan *timezone cast* dari nilai tersebut ke tanggal murni yaitu tanggal 6, sehingga laporan "Hari Ini" ikut menarik semua transaksi mulai dari tengah malam tanggal 6 (kemarin).

**Solusi:** Memisahkan filter berbasis *Date* dengan *Timestamptz*. Boundaries tanggal untuk Laporan sengaja di-*force* menggunakan murni bulatan UTC 00:00:00 dengan hari lokal (misal: `2026-04-07T00:00:00Z` hingga `23:59:59Z`) agar Prisma dapat menembakkan kueri ber-presisi yang tepat menangkap "Hari Ini" menurut WIB.


### [FIX] Dashboard Riwayat Terbaru — Jam Transaksi Hardcode 07:00

**File:** `src/app/api/unit-layanan/stats/route.ts`

**Root cause:** Field `transactionDate` di model `UnitTransaction` bertipe `@db.Date` (hanya menyimpan tanggal, tanpa jam/menit/detik). Prisma serialize sebagai `2026-04-06T00:00:00.000Z` (00:00 UTC = 07:00 WIB). Akibatnya semua transaksi di dashboard "Riwayat Terbaru" menampilkan pukul 07.00.

**Solusi:** Gunakan field `createdAt` (bertipe `DateTime` lengkap) untuk tampilan waktu di recent transactions, sementara `transactionDate` tetap dipakai untuk filter tanggal.

### [FIX] Export PDF/Excel — Kolom NRP dan Nama Anggota Kosong

**File:** `src/lib/export-utils.ts`

**Root cause:** Fungsi `exportToPDF()` dan `exportToExcel()` mengakses data via `row[col.key]`. Untuk key nested seperti `"member.name"` dan `"member.nrp"`, JavaScript `obj["member.name"]` berarti literal key "member.name", bukan `obj.member.name`. Hasilnya `undefined` → kolom NRP dan Nama Anggota selalu kosong di output PDF/Excel.

**Solusi:** Tambahkan helper `resolveKey()` yang melakukan split `.` dan traverse object path secara rekursif: `"member.name"` → `obj.member.name`.

### [FIX] Seed UAT — BRANCH_ID Hardcode Tidak Match Staging

**File:** `prisma/seed-uat.ts`

**Root cause:** `BRANCH_ID = 10` hardcode, tapi staging DB memiliki branch id=2 (tergantung auto-increment). Seed selalu gagal di staging karena foreign key error.

**Solusi:** Ganti hardcode dengan query dinamis: `prisma.branch.findFirstOrThrow({ where: { code: "LMJ" } })`.

### Analisis 8 Point Pertanyaan

| No | Point | Status | Keterangan |
| --- | --- | --- | --- |
| 1 | Brainstorm bagi hasil 50/50 | ✅ Dibahas | Lihat brainstorm detail di bawah |
| 2 | Riwayat toko tercatat? | ✅ Kode OK | StoreSale tercatat di DB. Jika ada keluhan, kemungkinan race condition browser atau cache. |
| 3 | Dashboard jam 07:00 hardcode | ✅ FIXED | Gunakan `createdAt` bukan `transactionDate` untuk display jam. |
| 4 | No.Transaksi format lama? | ✅ Kode OK | Format baru `CM07042026xxxx` sudah aktif. Transaksi lama (`CUC-MNMZW0NQ`) karena belum ada transaksi baru. |
| 5 | Plat Nomor tercatat? | ✅ Kode OK | Plat nomor disimpan di field `notes` format `[PLAT:xxx]` dan di-parse ke kolom laporan & riwayat. |
| 6 | Riwayat transaksi unit | ✅ Kode OK | Data query dari `UnitTransaction` + `StoreSale` (toko). Filter berdasarkan unit type. |
| 7 | Cetak PDF — NRP, Nama, Total | ✅ FIXED | Bug nested key `member.name` di `export-utils.ts`. Sekarang resolve path dengan benar. |
| 8 | Upload dokumen operasional | ✅ Dibahas | Lihat brainstorm detail di bawah |

### 💡 BRAINSTORM Point 1 — Mekanisme Bagi Hasil 50/50 Cuci Mobil

**Konteks:**
Unit Cuci Mobil secara informal menerapkan pembagian hasil 50/50 antara koperasi dan karyawan operasional. Mekanisme ini sudah berjalan sebagai kebiasaan tidak tertulis. Pertanyaan: bagaimana skenario terbaik untuk mengelola ini di sistem?

**Referensi AD/ART:**
AD/ART Pasal 52 mengatur pembagian SHU secara umum di tingkat koperasi. Tidak ada pasal spesifik yang mengatur bagi hasil per unit usaha. Artinya mekanisme 50/50 ini bersifat **kebijakan operasional internal**, bukan aturan baku AD/ART.

**3 Opsi Skenario yang Direkomendasikan:**

**Opsi A — Pencatatan Manual (Status Quo)**

- Karyawan dan admin unit menghitung manual dari laporan harian
- Pro: Tidak perlu perubahan sistem
- Kontra: Rawan salah hitung, tidak ada jejak audit digital

**Opsi B — View-Only di Laporan (✅ SUDAH DIIMPLEMENTASI Sesi 6)**

- Sistem menampilkan **rekap kalkulasi bagi hasil** di halaman Laporan Transaksi unit Cuci Mobil
- Ditampilkan sebagai informasi: Pendapatan Kotor → Bagian Karyawan (50%) → Bagian Koperasi (50%) → Laba Bersih
- Pro: Transparan, ada dasar hitung yang konsisten, tidak mengubah alur akuntansi
- Kontra: Belum otomatis memotong/memindahkan dana

**Opsi C — Akuntansi Otomatis (Masa Depan)**

- Setiap transaksi cuci mobil otomatis membuat 2 entri jurnal: 50% ke Kas Koperasi, 50% ke Hutang/Beban Karyawan
- Pro: Fully automated, audit-ready
- Kontra: Kompleks, butuh persetujuan pengurus, perlu CoA tambahan

**Rekomendasi Saya:**

1. **Saat ini:** Pakai **Opsi B** (sudah aktif) — kalkulasi view-only di laporan sudah cukup untuk kebutuhan operasional
2. **Legalisasi:** Buat **SK Pengurus** (sesuai wewenang di Pasal 52 AD/ART) yang meresmikan proporsi bagi hasil 50/50 agar punya dasar hukum saat audit BPK/pengawas koperasi
3. **Jika ingin upgrade:** Opsi C bisa diimplementasi nanti setelah SK Pengurus terbit, dengan menambah CoA khusus "Beban Bagi Hasil Karyawan"

**Contoh SK Pengurus (saran draft):**
> *"Berdasarkan Pasal 52 Anggaran Dasar, Pengurus menetapkan bahwa pendapatan bersih Unit Usaha Cuci Mobil dibagikan dengan proporsi 50% untuk Koperasi dan 50% untuk Karyawan Operasional, berlaku efektif sejak tanggal ditetapkan."*

---

### 💡 BRAINSTORM Point 8 — Fitur Upload Dokumen Operasional

**Konteks:**
Kebutuhan untuk melampirkan bukti operasional digital (foto struk, nota pembelian, foto kerusakan, slip setoran, dsb.) yang saat ini hanya dicatat manual atau difoto di HP tanpa integrasi ke sistem.

**Masalah yang Dipecahkan:**

1. Bukti operasional tersebar di HP masing-masing kasir/admin — sulit dicari saat audit
2. Tidak ada korelasi antara bukti fisik dengan transaksi di sistem
3. Pengurus kesulitan memverifikasi pengeluaran operasional tanpa bukti digital

**3 Opsi Arsitektur:**

**Opsi A — Attachment per Transaksi**

- Setiap transaksi (UnitTransaction/StoreSale) bisa punya 1-3 attachment foto
- Upload dari halaman kasir saat transaksi, atau dari riwayat transaksi (post-upload)
- Tersimpan di `/uploads/docs/{unitType}/{tanggal}/{filename}`
- Thumbnail preview di halaman riwayat dan laporan

```
Alur: Kasir buat transaksi → opsional upload foto → foto tersimpan → 
      Admin/Operator bisa lihat dari riwayat/laporan
```

**Opsi B — Dokumen Independen (Catatan Harian)**

- Fitur terpisah: "Catatan Operasional" / "Logbook Harian"
- Admin/kasir upload foto + catatan teks per hari
- Tidak terikat transaksi tertentu, tapi terikat tanggal dan unit
- Cocok untuk: foto kondisi mesin, nota pembelian sembako, bukti transfer

**Opsi C — Hybrid (A + B)**

- Attachment per transaksi DAN dokumen independen
- Paling lengkap tapi effort implementasi paling besar

**Kebutuhan Teknis (estimasi jika diimplementasi):**

| Komponen | Detail | Estimasi |
| --- | --- | --- |
| Tabel DB | `OperationalDocument` (id, unitType, transactionId nullable, filePath, note, uploadedBy, createdAt) | 1-2 jam |
| API Upload | `POST /api/documents/upload` (multipart/form-data, max 5MB, JPG/PNG/PDF) | 2-3 jam |
| API List/Delete | `GET/DELETE /api/documents` | 1-2 jam |
| UI Upload | Modal upload di halaman kasir + riwayat transaksi | 3-4 jam |
| UI Gallery | Thumbnail preview + lightbox di laporan dan riwayat | 2-3 jam |
| Storage | Lokal `/public/uploads/docs/` atau S3-compatible (Supabase Storage) | 1 jam |
| **Total estimasi** | | **~10-15 jam kerja** |

**Rekomendasi Saya:**

1. **Prioritas:** Mulai dengan **Opsi A** (attachment per transaksi) karena langsung memberikan value: bukti bisa dikaitkan ke transaksi spesifik
2. **Storage:** Gunakan **Supabase Storage** (sudah ada akun Supabase) agar tidak membebani server lokal
3. **Batasan awal:** Max 3 foto per transaksi, max 5MB per file, format JPG/PNG/PDF
4. **Fase 2:** Tambahkan Opsi B (logbook independen) jika ada kebutuhan catatan harian yang tidak terkait transaksi

**Saran timeline:**

- Sprint 1: Tabel DB + API upload/delete → bisa test via Postman
- Sprint 2: UI upload di halaman kasir + modal preview
- Sprint 3: Gallery view di laporan + export attachment list

---

---

## UPDATE 06 April 2026 — Sesi 6: POS Toko Payment Fix + Laporan Bagi Hasil Cuci Mobil

### [FIX] POS Kasir Toko — Transaksi Tunai Tidak Bisa Diproses

**File:** `src/app/(protected)/toko/kasir/page.tsx`

**Root cause:** Validasi di `processPayment` menggunakan `Number(paymentAmount) < subtotal`. Saat kasir menekan tombol "Bayar Tunai" tanpa mengisi nominal, `paymentAmount = ""` → `Number("") = 0 < subtotal` → selalu error "Pembayaran kurang" meskipun kasir ingin bayar pas/exact.

**Fix:**

- Ditambahkan variable `effectivePayment`: jika `paymentAmount === ""` maka otomatis gunakan `subtotal` (bayar pas tanpa kembalian)
- Placeholder input diupdate menjadi "Kosongkan = tepat Rp xxx" agar lebih jelas bagi kasir
- Hint teks muncul di bawah field: "Biarkan kosong untuk bayar pas (tanpa kembalian)"
- `body.cashReceived` dan `receiptData.cashReceived` keduanya menggunakan `effectivePayment` (konsisten)

---

### [NEW] Laporan Unit Cuci Mobil — Rekap Bagi Hasil Karyawan 50% / 50%

**File:** `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx`

**Latar belakang:** Atasan meminta laporan menampilkan tidak hanya pendapatan kotor, tetapi juga rincian bagi hasil 50/50 dengan karyawan, sehingga terlihat berapa bagian bersih yang masuk ke koperasi.

**Implementasi:**

- Fitur hanya aktif jika `unitType === "cuci_mobil"` (tidak mempengaruhi unit lain)
- Kalkulasi dilakukan di frontend berdasarkan `summary.totalPendapatan`:
  - **Bagi Hasil Karyawan** = 50% x Pendapatan Kotor
  - **Bagian Koperasi Kotor** = 50% x Pendapatan Kotor
  - **Laba Bersih Koperasi** = Bagian Koperasi Kotor - Pengeluaran Operasional
- Tampil sebagai Card khusus di screen (warna amber/kuning) dengan 4 kolom ringkasan
- Tampil juga saat **print** sebagai tabel formal di atas tabel transaksi
- Tidak perlu perubahan API/database — kalkulasi pure frontend dari data yang sudah ada

**Verifikasi:** Build `npm run build` sukses, exit code 0. Semua halaman compile tanpa error.

---

## UPDATE 06 April 2026 — Sesi 5: POS Kasir Toko — Autocomplete Search Anggota

### [FIX] Autocomplete NRP/Nama di POS Kasir Unit Toko

**File:** `src/app/(protected)/toko/kasir/page.tsx`

Sebelum: Field "Identitas Pelanggan" di Kasir Toko menggunakan mekanisme lama (detect NRP pasif hanya saat blur + debounce 800ms, hanya cocok jika input NRP persis 100%). Pencarian by nama sama sekali tidak bisa. Tidak ada dropdown autocomplete.

Sesudah: Diganti dengan autocomplete realtime (debounce 350ms) identik dengan kasir unit lainnya:

- Ketik ≥2 karakter (nama ATAU NRP) → dropdown muncul otomatis
- Klik anggota di dropdown → nama terisi, NRP tampil di info bar hijau
- Tombol X untuk reset pilihan
- State `customerName` (lama) dihapus, diganti `customerQuery` + `selectedCustomerObj`
- `processPayment` dan `receiptData` keduanya menggunakan state baru

---

## UPDATE 06 April 2026 — Sesi 4: Riwayat Transaksi — Plat Nomor + Print Filter-Aware

### [FIX] Kolom Plat Nomor di Riwayat Transaksi Unit

**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`

- Sebelum: kolom "Plat Nomor" tidak ada sama sekali di tabel riwayat
- Sesudah: kolom baru dengan badge 🚗 menampilkan plat nomor hasil parse dari field `notes` format `[PLAT:N 1234 ABC]`
- Kolom juga masuk ke export Excel/PDF via `txExportColumns`
- Baris yang tidak punya plat nomor (non-cuci-mobil) tetap menampilkan `-` dengan elegan

### [FIX] Print / Export Tidak Mengikuti Filter Aktif

**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`

- Sebelum: tombol Excel, PDF menggunakan `response?.data` (semua data mentah, tanpa filter)
- Sesudah: semua ekspor menggunakan `filteredData` (sudah difilter berdasarkan tanggal, unit, dan status)
- Tombol **Cetak** baru (browser print) menampilkan popup print dengan format proper:
  - Header PRIMKOPPOL RESOR LUMAJANG + logo
  - Info filter aktif (Periode, Unit, Status, Jumlah transaksi)
  - Tabel dengan kolom: No.Transaksi, Tanggal, Anggota, Unit, **Plat Nomor**, Keterangan, Nominal, Status
  - Row total di footer
  - Cetak hanya menampilkan data yang sesuai filter saat diklik

---

## UPDATE 06 April 2026 — Sesi 3: Logic Fix + UAT Contamination Cleanup

**Build ID:** `scGTYRRp9yKVIYCWccSA5` — ✅ Deploy Ready

### [CRITICAL] Cleanup Data UAT di Production

- Ditemukan 1 `ApprovalRequest` UAT di database production (Neon)
- Root cause: Sesi UAT tanggal 5 April dijalankan di server production (port 3000, env Neon) — sebelum staging Supabase disiapkan
- Data terhapus: `VD-TOKO-1775417610387-BLS` approval + reset flag `voidPending` di `TK-20260406-MNM5Q5XI`
- Protocol UAT baru ditetapkan: wajib jalankan server staging port 3001 dengan `.env.test.local`

### [FIX] BUG-LOGIC-001 — No. Referensi Approval Diperbaiki

- Sebelum: generate random `VD-TOKO-1775417610387-BLS` tidak terhubung ke No. Transaksi
- Sesudah: format `VOID-{No.Transaksi}` → contoh: `VOID-CM060420260001`
- Logic di `void-request/route.ts`: fungsi `generateVoidRequestNo(originalTxNo)` menggantikan generasi random

### [FIX] BUG-LOGIC-002 — Format No. Transaksi Diperbaiki

- Sebelum: `CUC-MNMKU4YG` — random base-36, tidak bisa dibaca, tidak ada tanggal
- Sesudah: `CM060420260001` = Singkatan + DDMMYYYY + Nomor Urut 4 digit per hari per unit
- Nomor urut di-query dari `COUNT` transaksi hari itu, sekuensial dan mudah audit
- Peta singkatan: CM (Cuci Mobil), BB (Barbershop), PS (PlayStation), FT (Fitness), dll

### [FIX] BUG-BUILD-005 — TS Error di Member Route

- Fix `session.user.role?.name` → `(session.user as any).role` karena `role` bertipe `string`

### [FEATURE] Kolom Anggota/Pelanggan di Tabel Inbox Approval

- Nama + NRP anggota kini terlihat langsung di tabel tanpa perlu buka panel detail
- Diambil dari `metadata.memberName` dan `metadata.memberNrp`

### [PROTOCOL UAT] Panduan Baru untuk Sesi UAT Berikutnya

```powershell
# WAJIB sebelum mulai UAT:
$env:DATABASE_URL = "postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
npm run dev -- -p 3001

# Verifikasi database yang aktif (bukan production):
#   URL harus mengandung: xlxrjlcnhvtvgkbmrfkm.supabase.co (BUKAN ep-blue-rain.neon.tech)
```

---

## UPDATE 06 April 2026 — Sesi 2: 5 Fitur Unit Baru + UAT PASS 7/7

**Kelompok fitur:** Laporan Unit, Pengeluaran Operasional, Detail Void, Plat Nomor POS, Search Anggota by Nama

### [FEAT-1] Laporan Transaksi Harian/Bulanan/Tahunan per Unit

- Buat halaman `/unit/[unitSlug]/laporan` dengan filter periode (Hari Ini / Minggu Ini / Bulan Ini / Tahun Ini / Kustom)
- Summary cards: Total Pendapatan, Pengeluaran Operasional, Laba Bersih, Jumlah Transaksi
- Breakdown metode pembayaran: Tunai / QRIS / Potong Gaji
- Tabel transaksi dengan badge plat nomor (khusus Cuci Mobil)
- **Print header center-aligned**: Logo PRIMKOPPOL + "PRIMKOPPOL RESOR LUMAJANG" + "UNIT [NAMA]" + Periode
- Tombol Export Excel
- Menu "LAPORAN & KEUANGAN" → "Laporan Transaksi" ditambahkan ke `adminUnitNavigation` & `adminTokoNavigation`

### [FEAT-2] Pencatatan Pengeluaran Operasional Unit

- Tombol "Catat Pengeluaran" (merah) di halaman laporan — hanya muncul untuk role Admin Unit
- Dialog form: Nominal, Keterangan, Tanggal
- Disimpan ke `CashBankTransaction` type `out`, category `operational` dengan tag `[UNIT_TYPE]`
- Langsung mendebit kas unit tanpa approval

### [FEAT-3] Detail Alasan Void di Inbox Approval

- `ApprovalDialog` dirombak ulang dengan panel khusus void:
  - Kotak amber **"ALASAN PEMBATALAN DARI KASIR"**
  - Detail: Kasir Pengaju, Unit, Anggota (+ NRP), Plat Kendaraan (jika ada), No. Transaksi Asli
- Interface `ApprovalItem.metadata` diperluas dengan semua field void

### [FEAT-4] Input Plat Nomor di POS Cuci Mobil

- Field "🚗 Plat Nomor Kendaraan" muncul kondisional hanya saat `unitType === "cuci_mobil"`
- Auto-uppercase input, limit 12 karakter
- Disimpan ke `UnitTransaction.notes` dengan format `[PLAT:N 1234 ABC]`
- Parse dan tampil sebagai badge di laporan unit
- Disertakan di metadata `ApprovalRequest` untuk void request

### [FEAT-5] Autocomplete Search Anggota by Nama + NRP di POS Walk-In

- Ganti mekanisme detect-NRP pasif dengan **autocomplete aktif realtime**
- Cari saat ≥ 2 karakter diketik (debounce 350ms) — bekerja untuk NRP maupun nama
- Dropdown menampilkan: avatar inisial, nama, NRP, kategori (Polri/PNS)
- Klik untuk pilih → field terkunci + info bar anggota terpilih (nama, NRP, kategori)
- Tombol X untuk hapus pilihan dan reset ke mode search
- Menutup dropdown otomatis saat klik di luar area input

### [FEAT-6] Kolom Anggota / Pelanggan di Tabel Inbox Approval

- Kolom baru menampilkan nama anggota dari `metadata.memberName` (untuk void unit) atau nama pemohon
- Juga tampil NRP anggota dan badge unitType di bawah nama
- Nomor referensi dipersingkat (font mono kecil) agar tidak terlalu lebar

### [FEAT-7] Format Nomor Referensi Void yang Readable & Unik

- Format baru: `(SINGKATAN_UNIT)-(DDMMYYYY)-(9DIGIT_NRP_atau_TIMESTAMP)`
- Contoh: `CM-06042026-828293010` (Cuci Mobil, 6 Apr 2026, NRP anggota)
- Helper function `generateVoidRequestNo()` di `void-request/route.ts`
- Peta singkatan: CM, BB, PS, FT, LN, RC, TK, CL, SP, FC, AS

### [BUILD FIX] Production Build Deploy-Ready

- Fix: BUG-BUILD-001 → Terminate dev server sebelum `npm run build`
- Fix: BUG-BUILD-002 → Hapus Prisma JSON null filter yang tidak type-safe
- Fix: BUG-BUILD-003 → `(e.description ?? "").replace(...)` untuk null-safe
- Fix: BUG-BUILD-004 → Clear `.next` stale cache sebelum rebuild
- **Build ID:** `QeeabkWK3uqoollTE_LKX` — ✅ VERIFIED

### [UAT] Hasil Testing Staging — 7/7 PASS

- Database staging: Supabase `xlxrjlcnhvtvgkbmrfkm` (bukan production)
- Server: `npm run dev -p 3001` dengan `.env.test.local`
- Semua skenario terverifikasi via screenshot & recording (file: `uat_4_fitur_koperasi_final_*.webp`)

---

## UPDATE 06 April 2026

- **Menyelesaikan Seluruh Validasi UAT Tahap 1 (Unit Toko & Jasa)**: Telah berhasil menjalankan automated tester untuk module Kasir dan Admin Toko serta Kasir Cuci Mobil (Jasa) dan Admin Cuci Mobil. (100% Pass untuk POS Jastual / Toko / Void Approval / Settings).
- **Perbaikan Ketergantungan NextJS 15**: Update route dynamic access using React Promise (`React.use`) pada `[unitSlug]/layanan`.
- **Integrasi Backend Approval Void Unit**: Refactor tipe dan parameter payload di frontend agar persetujuan status pembatalan di Inbox masuk ke DB.

## UPDATE 04 April 2026 (Dini Hari)

**Berdasarkan:** BUG-054 s/d BUG-060 + Blueprint Implementation Plan

---

## FASE 1 — Fondasi Data & Form User

- [x] BUG-054: Buka dropdown unitType untuk Admin di Form User (`users/page.tsx`)
  - Admin sekarang BISA dipilihkan unitType saat dibuat/diedit
  - Tambah unit baru: `coffe_latar`, `resto`, `investasi_modal_jp`, `properti (tanah kapling)`
  - Hapus `laundry` (tidak ada di daftar unit Primkoppol)
  - Validasi: Admin/Kasir WAJIB pilih unit, tombol Simpan terkunci jika belum pilih

## FASE 2 — Keamanan: Middleware & Settings

- [x] BUG-055: Perbaiki blokade middleware Admin di `proxy.ts`
  - Admin unit sekarang DIBLOKIR dari /simpanan, /pinjaman, /kas-bank, /laporan, /master, dll
  - Admin unit BISA akses /approval (untuk approve void kasirnya)
  - Peta rute unit diperbarui ke URL baru `/unit/[slug]`
- [x] BUG-056: Sembunyikan tab berbahaya `/settings` dari Admin Unit
  - Tab: Umum, Notifikasi, Keamanan, Backup, & Reset Data → HANYA Operator
  - Admin Unit hanya melihat Tab QRIS
  - Kasir tetap melihat Tab QRIS seperti sebelumnya

## FASE 3 — Arsitektur Sidebar Independen

- [x] BUG-060: Buat `adminTokoNavigation` di `navigation.ts`
  - Berisi: Dashboard, Kasir POS, Manajemen Produk, Persediaan & Stok, Riwayat Penjualan, Inbox Approval, Profil, QRIS
- [x] BUG-060: Buat `adminUnitNavigation` di `navigation.ts`
  - Berisi: Dashboard, Panel Kasir, Kelola Layanan & Harga, Riwayat Transaksi, Inbox Approval, Profil, QRIS
- [x] BUG-060: Update `getNavigationForUser()` — logika routing navigasi
  - Admin Toko/Coffe Latar/Resto → `adminTokoNavigation`
  - Admin Carwash/Barbershop/PS/Fitness/Properti → `adminUnitNavigation`
  - Kasir Toko → `kasirTokoNavigation` (tidak berubah)
  - Kasir unit jasa → `kasirNavigation` (tidak berubah, tapi /settings dihapus)

## FASE 4 — Dedicated POS per Unit

- [x] BUG-057: Buat Dynamic Route `/unit/[unitSlug]/kasir/page.tsx`
- [x] BUG-058: Buat API CRUD paket layanan `/api/unit/[slug]/packages`
- [x] BUG-058: Buat halaman Admin "Kelola Layanan" per unit
- [x] Integrasi database: Buat schema `UnitServicePackage` dan jalankan seeder untuk migrasi hardcoded data.

## FASE 5 — Perbaikan Logika Void

- [x] BUG-059: Perbaiki `void-request/route.ts` untuk Kasir Toko
  - JALUR A: Operator → void langsung + kembalikan stok (bypass)
  - JALUR B: Kasir/Admin → buat ApprovalRequest `pending_void` di Inbox Admin
  - Cegah double request: cek `voidPending` di metadata sebelum buat request baru
- [x] Perbaiki `void-approve/route.ts` untuk handle tipe `void_store_sale`
  - Ditambahkan JALUR 1 untuk StoreSale: kembalikan stok saat approved, hapus voidPending saat rejected
  - JALUR 2 existing (UnitTransaction + Contra-Entry) tetap berjalan tidak berubah

## FASE 6 — Security Endpoint & Data Integrity (Final Fix)

- [x] BUG-FIX: Approval Inbox "Halaman tidak tersedia"
  - Menyesuaikan `ADMIN_ALLOWED_ROUTES` di `layout.tsx` sehingga rute `/approval` kini dizinkan untuk seluruh profil Admin Eksternal (Toko, Jasa, dsb).
  - Mengamankan `/api/approvals/route.ts` dengan *unit segregation* agar Loan Applications hilang dari daftar unit admin dan setiap admin unit hanya bisa melihat *Void Request* milik unitnya.
- [x] BUG-FIX: Transaksi dibatalkan (Void) masih nyangkut di Kasir/Dashboard/Riwayat
  - Memperbarui `/api/dashboard-stats`, `/api/unit-layanan/stats`, dan `/api/unit-transactions` untuk men-drop atau melabelkan `StoreSale` yang memiliki *flag* JSON `metadata.isVoided: true`.
  - Sekarang laporan *Total Hari Ini* & *Tunai* tidak akan ikut menghitung nilai pesanan berstatus batal. Teks "DIBATALKAN" akan muncul tegas di Riwayat Kasir.

## FASE 7 — Stabilitas Backend & Penanganan False Positive (UAT)

- [x] BUG-061: Memperbaiki Exception Foreign Key `branchId: 1`
  - Pengajuan dari Void Kasir Toko kini dapat sukses tersimpan di `ApprovalRequest` dengan `branchId: 10`.
- [x] BUG-062: Perbaikan *False Positive* Notifikasi Void di Kasir
  - Menghapus *hardcode* "Sukses" di frontend `transaksi-unit/riwayat/page.tsx`, beralih ke pengecekan `res.ok` dan pencetakan pesan logis dari API Backend.
- [x] BUG-063: Logika Ekstensi `isOperator` Dipangkas
  - Menertibkan kembali akses "bisa Auto-Approve" untuk `role: "admin"`. Admin Unit yang mengajukan pembatalan harus diterbitkan tiket `ApprovalRequest` sebagaimana mestinya, tidak membypass Inbox Approval miliknya.

## FASE 8 — Stabilisasi & QA Alur Potong Gaji (06 April Sore)

- [x] BUG-P01 & BUG-P04: Perbaikan Stok & Plafon Toko
  - Pemotongan `stockToko` kini dikerjakan lebih dahulu, mundur ke `stock` induk bila habis.
  - Plafon unit transaksi dan kasir khusus "Toko" tidak lagi ditumpuk 2 kali (*Double Count*).
- [x] BUG-P02 & BUG-P03: Validasi Realtime Potong Gaji Unit Layanan
  - Diterapkan validasi agregat piutang anggota dan pemeriksaan eksistensi member sehingga tagihan tidak tembus meski Plafon Piutang habis/Limit 0.
- [x] BUG-D01: Bug Akumulasi Dashboard "Pending Void"
  - Notifikasi sisa "Potong Gaji/Pending" di Dashboard Admin tidak akan menduplikat nilai yang tertahan di *Pending Void* atau yang sudah *Voided*.
- [x] FEAT-012, FEAT-013, & FEAT-014:
  - Penambahan form auto-detect **Edit NRP** (pada Riwayat Transaksi yg lupa NRP).
  - Penambahan **Kategori Filter (Belum Lunas, Pending Void, dsb)** di Frontend Riwayat Kasir.
  - Form Dialog Transaksi Kasir kini mengeluarkan notifikasi realtime "Sisa Limit, Total Plafon" untuk memantau kelayakan anggota (*block-action*).

---

## 🛠️ PANDUAN UAT & LINGKUNGAN STAGING (QA TEST GUIDE)

Untuk melakukan pengujian fungsionalitas (QA/UAT) di *device* manapun dengan aman (tanpa mengubah, menimpa, atau menyinggung data Sistem Produksi), silakan ikuti petunjuk Environment Setup berikut:

### 1. Kredensial Database Staging

Gunakan kredensial `DATABASE_URL` Staging berikut yang identik dengan schema asli, khusus untuk dev & dummy.

```env
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
```

### 2. Panduan Menjalankan Sistem Lokal Berbasis Staging

Jangan gunakan port standar (3000) agar tidak tumpang tindih dengan aplikasi utama jika sedang berjalan. Kita akan run di port **3001**.

Jalankan perintah ini di Terminal (Powershell) folder `koperasi-app`:

```powershell
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
npm run dev -- -p 3001
```

Jika menggunakan MacOS / Linux / Git Bash:

```bash
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres" npm run dev -- -p 3001
```

### 3. Skenario QA Checklist (Untuk Tester)

- Buka browser di <http://localhost:3001>
- [ ] Login sebagai Admin Unit atau Kasir (ex: Toko / Jasa Cuci Mobil).
- [ ] Melakukan Transaksi menggunakan opsi **Potong Gaji**.
- [ ] Cek *limit* piutang (Plafon vs Sisa Limit). Uji bila Sisa Limit kurang dari total keranjang (Tombol harus terkunci).
- [ ] Cek halaman **Riwayat Transaksi**, tes Dropdown *Filter Status* baru.
- [ ] Cek status Dashboard Admin (Grafik Mingguan dan nominal Hari Ini tidak boleh ikut terhitung jika Transaksi masih *Pending Void*).
- [ ] Lakukan percobaan klik logo Pensil (Edit NRP) pada Riwayat Transaksi yang belum punya nama Anggota, ketik "UAT99001" dan lihat apa *member detect* bekerja baik.

## FASE 9 — CRUD Rincian Pengeluaran & Enhancement Tabel Laporan

- [x] **FEAT-015: CRUD Pengeluaran Operasional Unit**
  - Membuat REST API tersendiri bernutrisi FormData `PUT` dan `DELETE` di `src/app/api/unit/[slug]/operational-expense/[id]/route.ts`.
  - Menerapkan kalkulasi *Cascading Update* pada `cash_bank_transactions` (untuk menyelaraskan integrasi `balanceBefore` & `balanceAfter` saat nominal pengeluaran diisi/diubah di masa lampau).
  - Mengimplementasikan `date-fns` `format` yang didentifikasikan penuh ke metrik ID lokal untuk format jam spesifik + nama bulan saat pelaporan rekap transaksi.

**39. Pembaruan Detail UI Riwayat Pada Kasir (Dashboard)**
   - Menambahkan param bulan dan tanggal (*contoh: 07 Apr*) pada jejak sub-waktu modul "Riwayat Transaksi Terbaru" di Dashboard Kasir. Menghilangkan kerancuan saat unit beroperasi melampaui batas tengah malam dengan menyajikan hari yang presisi, bukan sekedar jam.

- [x] **Enhancement Laporan Unit Cuci Mobil**
  - Pemisahan string `[Plat Nomor]` dari sel *Keterangan* menjadi satu kesatuan elemen *Badge* dan dialihkan ke kolom Web tersendiri khusus tabel Cuci Mobil.
  - Penyesuaian `handleExportExcel` (Export XLSX) yang secara cerdas menyelipkan Header dan Row "Plat Nomor" sehingga output Microsoft Excel Unit Cuci Mobil lebih rapi dan bersih.

### BUG-UI-013 — Isi Kolom Nominal Tidak Rata Kiri Sesuai Skeleton

### [FEAT-4] Input Plat Nomor di POS Cuci Mobil

- Field "🚗 Plat Nomor Kendaraan" muncul kondisional hanya saat `unitType === "cuci_mobil"`
- Auto-uppercase input, limit 12 karakter
- Disimpan ke `UnitTransaction.notes` dengan format `[PLAT:N 1234 ABC]`
- Parse dan tampil sebagai badge di laporan unit
- Disertakan di metadata `ApprovalRequest` untuk void request

### [FEAT-5] Autocomplete Search Anggota by Nama + NRP di POS Walk-In

- Ganti mekanisme detect-NRP pasif dengan **autocomplete aktif realtime**
- Cari saat ≥ 2 karakter diketik (debounce 350ms) — bekerja untuk NRP maupun nama
- Dropdown menampilkan: avatar inisial, nama, NRP, kategori (Polri/PNS)
- Klik untuk pilih → field terkunci + info bar anggota terpilih (nama, NRP, kategori)
- Tombol X untuk hapus pilihan dan reset ke mode search
- Menutup dropdown otomatis saat klik di luar area input

### [FEAT-6] Kolom Anggota / Pelanggan di Tabel Inbox Approval

- Kolom baru menampilkan nama anggota dari `metadata.memberName` (untuk void unit) atau nama pemohon
- Juga tampil NRP anggota dan badge unitType di bawah nama
- Nomor referensi dipersingkat (font mono kecil) agar tidak terlalu lebar

### [FEAT-7] Format Nomor Referensi Void yang Readable & Unik

- Format baru: `(SINGKATAN_UNIT)-(DDMMYYYY)-(9DIGIT_NRP_atau_TIMESTAMP)`
- Contoh: `CM-06042026-828293010` (Cuci Mobil, 6 Apr 2026, NRP anggota)
- Helper function `generateVoidRequestNo()` di `void-request/route.ts`
- Peta singkatan: CM, BB, PS, FT, LN, RC, TK, CL, SP, FC, AS

### [BUILD FIX] Production Build Deploy-Ready

- Fix: BUG-BUILD-001 → Terminate dev server sebelum `npm run build`
- Fix: BUG-BUILD-002 → Hapus Prisma JSON null filter yang tidak type-safe
- Fix: BUG-BUILD-003 → `(e.description ?? "").replace(...)` untuk null-safe
- Fix: BUG-BUILD-004 → Clear `.next` stale cache sebelum rebuild
- **Build ID:** `QeeabkWK3uqoollTE_LKX` — ✅ VERIFIED

### [UAT] Hasil Testing Staging — 7/7 PASS

- Database staging: Supabase `xlxrjlcnhvtvgkbmrfkm` (bukan production)
- Server: `npm run dev -p 3001` dengan `.env.test.local`
- Semua skenario terverifikasi via screenshot & recording (file: `uat_4_fitur_koperasi_final_*.webp`)

---

## UPDATE 06 April 2026

- **Menyelesaikan Seluruh Validasi UAT Tahap 1 (Unit Toko & Jasa)**: Telah berhasil menjalankan automated tester untuk module Kasir dan Admin Toko serta Kasir Cuci Mobil (Jasa) dan Admin Cuci Mobil. (100% Pass untuk POS Jastual / Toko / Void Approval / Settings).
- **Perbaikan Ketergantungan NextJS 15**: Update route dynamic access using React Promise (`React.use`) pada `[unitSlug]/layanan`.
- **Integrasi Backend Approval Void Unit**: Refactor tipe dan parameter payload di frontend agar persetujuan status pembatalan di Inbox masuk ke DB.

## UPDATE 04 April 2026 (Dini Hari)

**Berdasarkan:** BUG-054 s/d BUG-060 + Blueprint Implementation Plan

---

## FASE 1 — Fondasi Data & Form User

- [x] BUG-054: Buka dropdown unitType untuk Admin di Form User (`users/page.tsx`)
  - Admin sekarang BISA dipilihkan unitType saat dibuat/diedit
  - Tambah unit baru: `coffe_latar`, `resto`, `investasi_modal_jp`, `properti (tanah kapling)`
  - Hapus `laundry` (tidak ada di daftar unit Primkoppol)
  - Validasi: Admin/Kasir WAJIB pilih unit, tombol Simpan terkunci jika belum pilih

## FASE 2 — Keamanan: Middleware & Settings

- [x] BUG-055: Perbaiki blokade middleware Admin di `proxy.ts`
  - Admin unit sekarang DIBLOKIR dari /simpanan, /pinjaman, /kas-bank, /laporan, /master, dll
  - Admin unit BISA akses /approval (untuk approve void kasirnya)
  - Peta rute unit diperbarui ke URL baru `/unit/[slug]`
- [x] BUG-056: Sembunyikan tab berbahaya `/settings` dari Admin Unit
  - Tab: Umum, Notifikasi, Keamanan, Backup, & Reset Data → HANYA Operator
  - Admin Unit hanya melihat Tab QRIS
  - Kasir tetap melihat Tab QRIS seperti sebelumnya

## FASE 3 — Arsitektur Sidebar Independen

- [x] BUG-060: Buat `adminTokoNavigation` di `navigation.ts`
  - Berisi: Dashboard, Kasir POS, Manajemen Produk, Persediaan & Stok, Riwayat Penjualan, Inbox Approval, Profil, QRIS
- [x] BUG-060: Buat `adminUnitNavigation` di `navigation.ts`
  - Berisi: Dashboard, Panel Kasir, Kelola Layanan & Harga, Riwayat Transaksi, Inbox Approval, Profil, QRIS
- [x] BUG-060: Update `getNavigationForUser()` — logika routing navigasi
  - Admin Toko/Coffe Latar/Resto → `adminTokoNavigation`
  - Admin Carwash/Barbershop/PS/Fitness/Properti → `adminUnitNavigation`
  - Kasir Toko → `kasirTokoNavigation` (tidak berubah)
  - Kasir unit jasa → `kasirNavigation` (tidak berubah, tapi /settings dihapus)

## FASE 4 — Dedicated POS per Unit

- [x] BUG-057: Buat Dynamic Route `/unit/[unitSlug]/kasir/page.tsx`
- [x] BUG-058: Buat API CRUD paket layanan `/api/unit/[slug]/packages`
- [x] BUG-058: Buat halaman Admin "Kelola Layanan" per unit
- [x] Integrasi database: Buat schema `UnitServicePackage` dan jalankan seeder untuk migrasi hardcoded data.

## FASE 5 — Perbaikan Logika Void

- [x] BUG-059: Perbaiki `void-request/route.ts` untuk Kasir Toko
  - JALUR A: Operator → void langsung + kembalikan stok (bypass)
  - JALUR B: Kasir/Admin → buat ApprovalRequest `pending_void` di Inbox Admin
  - Cegah double request: cek `voidPending` di metadata sebelum buat request baru
- [x] Perbaiki `void-approve/route.ts` untuk handle tipe `void_store_sale`
  - Ditambahkan JALUR 1 untuk StoreSale: kembalikan stok saat approved, hapus voidPending saat rejected
  - JALUR 2 existing (UnitTransaction + Contra-Entry) tetap berjalan tidak berubah

## FASE 6 — Security Endpoint & Data Integrity (Final Fix)

- [x] BUG-FIX: Approval Inbox "Halaman tidak tersedia"
  - Menyesuaikan `ADMIN_ALLOWED_ROUTES` di `layout.tsx` sehingga rute `/approval` kini dizinkan untuk seluruh profil Admin Eksternal (Toko, Jasa, dsb).
  - Mengamankan `/api/approvals/route.ts` dengan *unit segregation* agar Loan Applications hilang dari daftar unit admin dan setiap admin unit hanya bisa melihat *Void Request* milik unitnya.
- [x] BUG-FIX: Transaksi dibatalkan (Void) masih nyangkut di Kasir/Dashboard/Riwayat
  - Memperbarui `/api/dashboard-stats`, `/api/unit-layanan/stats`, dan `/api/unit-transactions` untuk men-drop atau melabelkan `StoreSale` yang memiliki *flag* JSON `metadata.isVoided: true`.
  - Sekarang laporan *Total Hari Ini* & *Tunai* tidak akan ikut menghitung nilai pesanan berstatus batal. Teks "DIBATALKAN" akan muncul tegas di Riwayat Kasir.

## FASE 7 — Stabilitas Backend & Penanganan False Positive (UAT)

- [x] BUG-061: Memperbaiki Exception Foreign Key `branchId: 1`
  - Pengajuan dari Void Kasir Toko kini dapat sukses tersimpan di `ApprovalRequest` dengan `branchId: 10`.
- [x] BUG-062: Perbaikan *False Positive* Notifikasi Void di Kasir
  - Menghapus *hardcode* "Sukses" di frontend `transaksi-unit/riwayat/page.tsx`, beralih ke pengecekan `res.ok` dan pencetakan pesan logis dari API Backend.
- [x] BUG-063: Logika Ekstensi `isOperator` Dipangkas
  - Menertibkan kembali akses "bisa Auto-Approve" untuk `role: "admin"`. Admin Unit yang mengajukan pembatalan harus diterbitkan tiket `ApprovalRequest` sebagaimana mestinya, tidak membypass Inbox Approval miliknya.

## FASE 8 — Stabilisasi & QA Alur Potong Gaji (06 April Sore)

- [x] BUG-P01 & BUG-P04: Perbaikan Stok & Plafon Toko
  - Pemotongan `stockToko` kini dikerjakan lebih dahulu, mundur ke `stock` induk bila habis.
  - Plafon unit transaksi dan kasir khusus "Toko" tidak lagi ditumpuk 2 kali (*Double Count*).
- [x] BUG-P02 & BUG-P03: Validasi Realtime Potong Gaji Unit Layanan
  - Diterapkan validasi agregat piutang anggota dan pemeriksaan eksistensi member sehingga tagihan tidak tembus meski Plafon Piutang habis/Limit 0.
- [x] BUG-D01: Bug Akumulasi Dashboard "Pending Void"
  - Notifikasi sisa "Potong Gaji/Pending" di Dashboard Admin tidak akan menduplikat nilai yang tertahan di *Pending Void* atau yang sudah *Voided*.
- [x] FEAT-012, FEAT-013, & FEAT-014:
  - Penambahan form auto-detect **Edit NRP** (pada Riwayat Transaksi yg lupa NRP).
  - Penambahan **Kategori Filter (Belum Lunas, Pending Void, dsb)** di Frontend Riwayat Kasir.
  - Form Dialog Transaksi Kasir kini mengeluarkan notifikasi realtime "Sisa Limit, Total Plafon" untuk memantau kelayakan anggota (*block-action*).

---

## 🛠️ PANDUAN UAT & LINGKUNGAN STAGING (QA TEST GUIDE)

Untuk melakukan pengujian fungsionalitas (QA/UAT) di *device* manapun dengan aman (tanpa mengubah, menimpa, atau menyinggung data Sistem Produksi), silakan ikuti petunjuk Environment Setup berikut:

### 1. Kredensial Database Staging

Gunakan kredensial `DATABASE_URL` Staging berikut yang identik dengan schema asli, khusus untuk dev & dummy.

```env
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
```

### 2. Panduan Menjalankan Sistem Lokal Berbasis Staging

Jangan gunakan port standar (3000) agar tidak tumpang tindih dengan aplikasi utama jika sedang berjalan. Kita akan run di port **3001**.

Jalankan perintah ini di Terminal (Powershell) folder `koperasi-app`:

```powershell
$env:DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres"
npm run dev -- -p 3001
```

Jika menggunakan MacOS / Linux / Git Bash:

```bash
DATABASE_URL="postgresql://postgres:TqMqiuDIz4WCYUno@db.xlxrjlcnhvtvgkbmrfkm.supabase.co:5432/postgres" npm run dev -- -p 3001
```

### 3. Skenario QA Checklist (Untuk Tester)

- Buka browser di <http://localhost:3001>
- [ ] Login sebagai Admin Unit atau Kasir (ex: Toko / Jasa Cuci Mobil).
- [ ] Melakukan Transaksi menggunakan opsi **Potong Gaji**.
- [ ] Cek *limit* piutang (Plafon vs Sisa Limit). Uji bila Sisa Limit kurang dari total keranjang (Tombol harus terkunci).
- [ ] Cek halaman **Riwayat Transaksi**, tes Dropdown *Filter Status* baru.
- [ ] Cek status Dashboard Admin (Grafik Mingguan dan nominal Hari Ini tidak boleh ikut terhitung jika Transaksi masih *Pending Void*).
- [ ] Lakukan percobaan klik logo Pensil (Edit NRP) pada Riwayat Transaksi yang belum punya nama Anggota, ketik "UAT99001" dan lihat apa *member detect* bekerja baik.

## FASE 9 — CRUD Rincian Pengeluaran & Enhancement Tabel Laporan

- [x] **FEAT-015: CRUD Pengeluaran Operasional Unit**
  - Membuat REST API tersendiri bernutrisi FormData `PUT` dan `DELETE` di `src/app/api/unit/[slug]/operational-expense/[id]/route.ts`.
  - Menerapkan kalkulasi *Cascading Update* pada `cash_bank_transactions` (untuk menyelaraskan integrasi `balanceBefore` & `balanceAfter` saat nominal pengeluaran diisi/diubah di masa lampau).
  - Mengimplementasikan `date-fns` `format` yang didentifikasikan penuh ke metrik ID lokal untuk format jam spesifik + nama bulan saat pelaporan rekap transaksi.

**39. Pembaruan Detail UI Riwayat Pada Kasir (Dashboard)**
   - Menambahkan param bulan dan tanggal (*contoh: 07 Apr*) pada jejak sub-waktu modul "Riwayat Transaksi Terbaru" di Dashboard Kasir. Menghilangkan kerancuan saat unit beroperasi melampaui batas tengah malam dengan menyajikan hari yang presisi, bukan sekedar jam.

- [x] **Enhancement Laporan Unit Cuci Mobil**
  - Pemisahan string `[Plat Nomor]` dari sel *Keterangan* menjadi satu kesatuan elemen *Badge* dan dialihkan ke kolom Web tersendiri khusus tabel Cuci Mobil.
  - Penyesuaian `handleExportExcel` (Export XLSX) yang secara cerdas menyelipkan Header dan Row "Plat Nomor" sehingga output Microsoft Excel Unit Cuci Mobil lebih rapi dan bersih.

### BUG-UI-013 — Isi Kolom Nominal Tidak Rata Kiri Sesuai Skeleton

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`
**Gejala:** Nilai angka nominal transaksi pada tabel sebelumnya diratakan kanan (`text-right`), padahal skeleton tabel dan gaya kolom lainnya menggunakan format default rata kiri. Perbedaan ini menyebabkan desain kolom "Nominal" beserta isi baris di bawahnya terlihat melenceng dan tidak sejajar.
**Resolusi:** Menghapus class `text-right` pada detail transaksi nominal dan mengembalikan properti `header` ke format standar. Kini isi data rata kiri mengacu pada kerangka dasar (`skeleton`) tabel aplikasi.

| **BUG-064** | **Foreign key constraint violation (Failed to process sale) di Kasir Toko** | ✅ FIXED | 7 Apr 2026 |
| **BUG-P05** | **Validasi Gatekeeper Double-Count Piutang (Limit selalu Rp 0)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-065** | **Kolom Input Plafon Piutang/Limit tidak muncul di UI Edit Anggota** | ✅ FIXED | 7 Apr 2026 |
| **FEAT-016** | **Plafon Piutang Dinamis Otomatis (Sisa Gaji Fallback)** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **FEAT-017** | **Standarisasi Logo Primkoppol di Semua Halaman Cetak & Print** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **FEAT-018** | **Cetak 3 Lapis: Pemisahan Tabel Pengeluaran & Lembar Lampiran Bukti** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **UAT-019** | **Seed Data Staging: Akun Operator & Anggota Polri (UAT Tahap 2)** | ✅ SEEDED | 7 Apr 2026 |

---
*Total pembaruan tercatat: 103 item (Fitur, UI, Hotfix, UAT)*  
*Diperbarui: 7 April 2026*

---

## 📋 UPDATE 7 April 2026 (Sesi 2) — Implementasi Produk Pinjaman

### ✅ FEAT-020 — Produk Pinjaman Reguler & Khusus

**Perubahan:**
- **Database Seed:** `prisma/seed-loan-products.ts` — Menyeed 2 produk pinjaman ke staging:
  - **Pinjaman Reguler (PR):** Min 1jt, Maks 20jt, Tenor 1–36 bln, Bunga 1% flat/bln, Resiko 2% di muka
  - **Pinjaman Khusus (PK):** Min 30jt, No Limit, Tenor 1–60 bln, Bunga 1% flat/bln, Resiko 2% di muka
- **Backend Fix — Hapus Hard-limit AD-ART:**
  - `api/loans/applications/route.ts` — Dihapus validasi hardcode `AD_ART_MAX_LOAN = 20jt` dan `AD_ART_MAX_TENOR_MONTHS = 36`
  - Validasi kini **hanya dari atribut LoanProduct** (`minAmount`, `maxAmount`, `minTenorMonths`, `maxTenorMonths`)
  - Rate bunga cicilan juga dihitung dari `product.interestRate` (bukan hardcode 1%)
- **Backend Fix — Session User:**
  - `api/loans/applications/route.ts` → `createdById` kini dari session user (bukan hardcode `1`)
  - `api/loans/applications/[id]/approve/route.ts` → `approvedById` dari session + tambah auth check
  - `api/loans/applications/[id]/reject/route.ts` → `rejectedById` dari session + tambah auth check
- **Frontend — Form Pengajuan Baru (`tambah/page.tsx`):**
  - Tampilkan **kartu pilihan produk** dengan info limit, tenor, bunga, dan resiko per produk
  - Input `amount` dan `tenor` di-limit sesuai produk yang dipilih (min/max)
  - Penambahan **Simulasi detail:**
    - Akumulasi bunga **per hari** (~0.033%)
    - Akumulasi bunga **per bulan** (1%)
    - Akumulasi bunga **per tahun** (12%)
  - Label tenor lebih informatif: contoh "12 bulan (1 thn)"
- **Frontend — Detail Pengajuan (`[id]/page.tsx`):**
  - Tambah tombol **"Ajukan ke Operator"** untuk status `draft`
  - Memungkinkan alur: Buat Pengajuan (draft) → Ajukan → Operator dapat menyetujui

### ✅ UAT — Akun Operator & Anggota Siap Uji Pinjaman

**Akun UAT Pinjaman (Data Lengkap):**

| Role | Email | Password |
| --- | --- | --- |
| **Operator** | `operator.uat@primkoppol.test` | `uat123456` |
| **Anggota 1** | `anggota.uat.uat88001@primkoppol.test` | `uat123456` |
| **Anggota 2** | `anggota.uat.uat88002@primkoppol.test` | `uat123456` |
| **Kasir Toko** | `kasir.uat.toko@primkoppol.test` | `uat123456` |

**Alur UAT Pinjaman Lengkap:**
1. Login sebagai Anggota1 → `/pinjaman/pengajuan/tambah`
2. Pilih Produk Pinjaman (Reguler atau Khusus)
3. Isi jumlah & tenor sesuai limit produk → Lihat simulasi detail
4. Klik "Ajukan Pinjaman" → status jadi **draft**
5. Masuk ke detail pengajuan → Klik "Ajukan ke Operator" → status jadi **submitted**
6. Logout → Login sebagai Operator → `/approval`
7. Setujui pengajuan pinjaman → status jadi **approved**
8. Kembali ke `/pinjaman/pengajuan/[id]` → Klik "Cairkan & Cetak Kwitansi"

| **FEAT-020** | **Produk Pinjaman Reguler & Khusus (Seed + Backend + UI)** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **BUG-066** | **createdById/approvedById hardcode = 1 di semua loan routes** | ✅ FIXED | 7 Apr 2026 |
| **UAT-020** | **Seed Produk Pinjaman ke Staging Database** | ✅ SEEDED | 7 Apr 2026 |

---
*Total pembaruan tercatat: 106 item (Fitur, UI, Hotfix, UAT)*  
*Diperbarui: 7 April 2026*

---

## UPDATE 08 April 2026 — Sesi 9: Perbaikan Produk Pinjaman & Portal Pengajuan

### [CRITICAL FIX] 5 API Endpoint Pinjaman — Hapus Semua Hardcode

**Konteks:** Setelah atasan menyampaikan aturan baru produk pinjaman (Reguler: Max 20jt/36bln, Khusus: Min 30jt/No Limit/60bln), ditemukan 5 endpoint yang masih menerapkan pembatasan hardcode sehingga Pinjaman Khusus tidak bisa diproses.

**Endpoint yang diperbaiki:**

1. **`/api/loans/products`** (BUG-068)
   - Hapus override `interest_rate: 1` dan `admin_fee_value: 2`
   - Kini baca langsung dari database

2. **`/api/mobile/loan-apply`** (BUG-069)
   - Hapus `interestRate: 0`, `adminFee: 1%`, cap `Math.min(maxAmount, 20jt)`, cap `Math.min(maxTenor, 36)`
   - Hapus validasi AD-ART hardcode 20jt/36bln
   - Validasi kini per-produk dari database

3. **`/api/member-portal/loan-application`** (BUG-070)
   - Hapus validasi `AD_ART_MAX_LOAN = 20jt` dan `AD_ART_MAX_TENOR_MONTHS = 36`
   - Validasi per-produk (sudah ada di lines 48-63) menjadi satu-satunya gatekeeper

4. **`/api/master/loan-products` POST** (BUG-071)
   - Hapus blokade `maxTenorMonths > 36 → reject`
   - Admin kini bisa buat produk dengan tenor > 36 bulan

5. **`/api/loans/applications`** (sudah di-fix sebelumnya — BUG-067)
   - Dikonfirmasi tetap berfungsi per-produk

### [CRITICAL FIX] Portal Pengajuan Pinjaman — Produk Tidak Tampil (BUG-072)

**File:** `src/app/portal/pengajuan-pinjaman/page.tsx`

**Masalah:** Halaman `/portal/pengajuan-pinjaman` di `primkoppol.online` tidak menampilkan produk pinjaman sama sekali. Ditemukan 5 masalah kritis:

1. **Field mismatch:** API mengembalikan `minTenorMonths` (Prisma camelCase), UI mengharapkan `minTenor` → produk gagal di-parse
2. **Hidden selector:** Pilihan produk disembunyikan (`<input type="hidden">`)
3. **Hardcode limit:** Input dicap keras ke 20jt/36bln
4. **Bunga salah:** Estimasi bunga 0.3% (seharusnya 1%)
5. **Admin fee salah:** "Biaya Jasa 1%" (seharusnya "Biaya Resiko 2%")

**Fix:**
- Normalize Prisma field names (`minTenorMonths` → `minTenor`, Decimal → Number)
- Tampilkan **kartu pilihan produk** (selectable cards) dengan info limit, tenor, bunga, resiko
- Input amount/tenor dinamis sesuai produk (bukan hardcode)
- Kalkulasi bunga/resiko dari data produk aktual
- Tambah info **"Dana Cair (Bersih)"** setelah potong resiko di muka

### [DATA] Seed Produk Pinjaman ke Production (FEAT-021)

**Eksekusi:** `npx tsx prisma/seed-loan-products.ts` — berhasil dijalankan ke production database.

**Hasil:**
```
[5] PR — Pinjaman Reguler:  Rp0 s/d Rp20.000.000 | Tenor: 1–36 bln
[6] PK — Pinjaman Khusus:   Rp30.000.000 s/d Tidak Terbatas | Tenor: 1–60 bln
```

### [BUILD] Verifikasi
- `npm run build` → Exit code: 0 (Sukses)
- Semua 172 halaman compile tanpa error

| ID | Deskripsi | Status | Tanggal |
| --- | --- | --- | --- |
| **BUG-068** | API loans/products hardcode bunga & resiko | ✅ FIXED | 8 Apr 2026 |
| **BUG-069** | Mobile loan-apply hardcode rate & cap 20jt/36bln | ✅ FIXED | 8 Apr 2026 |
| **BUG-070** | Portal loan-application hardcode AD-ART limit | ✅ FIXED | 8 Apr 2026 |
| **BUG-071** | Master loan-products POST blokir tenor > 36 | ✅ FIXED | 8 Apr 2026 |
| **BUG-072** | Portal pengajuan pinjaman: produk tidak tampil | ✅ FIXED | 8 Apr 2026 |
| **BUG-073** | Dashboard: Pie Chart 'Pendapatan Unit Usaha' hanya Toko | ✅ FIXED | 8 Apr 2026 |
| **BUG-074** | Dashboard: Data 'Pencairan Hari Ini' ter-mapping nilai penarikan simpanan | ✅ FIXED | 8 Apr 2026 |
| **FEAT-021** | Seed produk pinjaman accurate (Reguler & Khusus) | ✅ IMPLEMENTED | 8 Apr 2026 |

---
*Total pembaruan tercatat: 114 item (Fitur, UI, Hotfix, UAT)*  
*Diperbarui: 8 April 2026 — Sesi 9*

---

## 🧪 UAT OPERATOR — FASE 1 (7 April 2026)

### Akun UAT Resmi untuk UAT Operator & Anggota

| Role | Email | Password | Keterangan |
|------|-------|----------|------------|
| **Operator** | `operator.uat@primkoppol.test` | `uat123456` | Akses penuh semua modul koperasi |
| **Anggota 1** | `anggota.uat.uat88001@primkoppol.test` | `uat123456` | Slamet Riyadi, UAT88001, Gaji Rp 7.500.000 |
| **Anggota 2** | `anggota.uat.uat88002@primkoppol.test` | `uat123456` | Wahyu Prasetyo, UAT88002, Gaji Rp 9.500.000 |
| **Anggota 3** | `anggota.uat.uat88003@primkoppol.test` | `uat123456` | Rizki Fauzan, UAT88003 |
| **Kasir Toko** | `kasir.uat.toko@primkoppol.test` | `uat123456` | Admin Toko PRIMKOPPOL UAT |

### Progress UAT Operator (Per Sesi)

| UAT ID | Modul | Status | Catatan |
|--------|-------|--------|---------|
| **UAT-OPS-01** | Anggota — Daftar, Detail, Kartu, Buku | ✅ PASS | Semua page load, data real dari DB |
| **UAT-OPS-03** | Simpanan — Rekening Anggota | ✅ PASS | 8 rekening UAT terlihat, saldo benar |
| **UAT-OPS-04** | Simpanan — Transaksi Tambah | ❌ BLOCKED | BUG-UAT-001: Form pakai MOCK data, tidak bisa dipakai |
| **UAT-OPS-06** | Pinjaman — Pengajuan + Approval | ✅ PASS | End-to-end: Draft→Submitted→Approved berhasil |
| **UAT-OPS-07..08** | Pinjaman — Angsuran & Jadwal | ⏳ PENDING | Belum diuji |
| **UAT-OPS-09..10** | Kas & Bank | ⏳ PENDING | Belum diuji |
| **UAT-OPS-11..12** | Non Simpan Pinjam | ⏳ PENDING | Belum diuji |
| **UAT-OPS-13..14** | Transaksi Unit Layanan | ⏳ PENDING | Belum diuji |
| **UAT-OPS-15** | Kwitansi | ⏳ PENDING | Belum diuji |

### Bug Ditemukan Selama UAT Fase 1

| ID | Deskripsi | Severity |
|----|-----------|----------|
| **BUG-UAT-001** | Simpanan Transaksi Tambah: MOCK data, bukan API real | 🔴 Critical |
| **BUG-UAT-002** | Dashboard: Total Pinjaman Aktif = Rp 0 (belum hitungkan status approved) | 🟡 Medium |
| **BUG-UAT-003** | Jurnal Umum Tambah Entry: setTimeout simulasi, bukan API | 🟠 High |

---
*Update: 7 April 2026 — UAT Operator Fase 1*
