# Analisis Dokumen LPJ Mei 2026

> Dokumen ini mencatat hasil analisis mendalam semua file di folder `docs-mei/`.
> Tujuan: referensi untuk pengembangan fitur dan code review ke depan.

---

## Daftar File

| File | Ukuran | Deskripsi |
|------|---------|-----------|
| `RINCIAN PIUTANG SP_0526.xlsx` | 611 KB | Piutang Simpan Pinjam per anggota per 31 Des 2025 |
| `REKAP mass debet Tunkin April 2026.xls` | 670 KB | Format mass debet BRI + database potongan |
| `LAPORAN PERTANGGUNGJAWABAN PERNGURUS PRIMKOPPOL TAHUN 2026.pdf` | 3.8 MB | LPJ Pengurus tahunan |
| `LAPORAN PERTANGGUNGJAWABAN PERNGURUS PRIMKOPPOL TAHUN 2026.docx` | 5.6 MB | LPJ editable version |

---

## 1. RINCIAN PIUTANG SP_0526.xlsx

### Sheet: `rincian SP` (1588 rows)

**Struktur Kolom:**

| Kolom | Contoh Data | Keterangan |
|-------|-------------|------------|
| NO | 1 | Nomor urut |
| NAMA | SUHARTININGSIH | Nama anggota |
| PANGKAT | IPTU | Pangkat polisi |
| NRP | 69010105 | NRP anggota |
| TGL PINJAM | (date) | Tanggal pinjaman |
| PINJAM | 10000000 | Pokok pinjaman |
| SELAMA | 20 | Tenor (bulan) |
| PER DESEMBER 2025 → ANGSURAN | 550000 | Besaran angsuran per bulan |
| X ANGSURAN | 5 | Angsuran ke- |
| BS | 2750000 | Total terbayar |
| JUMLAH | 2750000 | Jumlah terbayar |
| SISA SALDO | 7250000 | Sisa hutang |

**Catatan:**
- Anggota tanpa pinjaman: semua kolom pinjaman null/0, BS=0, SISA SALDO=0
- Data per 31 Desember 2025 (snapshot akhir tahun)

### Sheet: `Sheet1` (853 rows)

Sama dengan `rincian SP` tapi dengan kolom tambahan tracking multi-bulan:
- JUMLAH PER MARET, SISA SALDO PER MARET
- JUMLAH PER DES, SISA SALDO PER DES
- Kolom Jan, Peb, Maret per bulan

### Sheet: `Sheet2` (847 rows)

Versi paling lengkap dengan detail jasa:
- Tambahan kolom JASA (bunga per bulan)
- Tracking per bulan: DES, Jan, Peb, Maret, APRIL, MEI, TOTAL
- JUMLAH dan SISA SALDO per Desember

### Sheet: `Sheet3` (721 rows) — Detail Jasa Per Anggota Per Bulan

**Struktur:**

| Kolom | Contoh |
|-------|--------|
| NAMA | EKO KRISDIANSYAH |
| JASA (col B) | 1000000 |
| APRIL (col C) | 2667000 |

**Contoh data aktual:**

| Nama | Jasa | April | (dst per bulan) |
|------|------|-------|------------------|
| EKO KRISDIANSYAH | 1,000,000 | 2,667,000 | |
| INDRA RAHMAD S | null | 0 | 430,000 |
| YOGA WICAKSANA | 15,000 | 165,000 | |
| BAYU PRATIKTO SINGGIH | 600,000 | 1,550,000 | |
| TEGAR FEBRIANTO | 200,000 | 756,000 | |
| A'AN ANDRIONO | 350,000 | 1,517,000 | |
| PURWANTO | 500,000 | 2,167,000 | |

**Relasi dengan sistem:** Data ini berasal dari `LoanPayment.interestPortion` — sudah tercatat otomatis saat angsuran dibayar. Sheet ini adalah manual version dari fitur **Rekap Jasa Pinjaman** yang sudah diimplementasi di `/pinjaman/laporan-jasa`.

### Sheet: `sp per des 25` (1339 rows) — Piutang Gabungan

**Struktur Kolom:**

| Kolom | Contoh | Keterangan |
|-------|--------|------------|
| NO | 1 | Nomor urut |
| NAMA | ALEX SANDY SIREGAR | Nama anggota |
| PANGKAT | AKBP | Pangkat |
| NRP | 84041976 | NRP |
| TOKO | 500000 | Piutang toko (potongan gaji barang) |
| SP | 2000000 | Piutang simpan pinjam (pinjaman) |
| JML | 2500000 | Total gabungan (TOKO + SP) |

**Ini adalah Prioritas 3 (Piutang Gabungan) dalam roadmap.**
- TOKO = akumulasi `StoreSale.salaryCut` + `UnitTransaction.salaryCut` yang belum lunas
- SP = `Loan.outstandingAmount` (sisa saldo pinjaman)
- JML = TOKO + SP

---

## 2. REKAP mass debet Tunkin April 2026.xls

### Sheet: `POLRI_` (317 rows) — Format Mass Debet BRI

**Struktur Kolom:**

| Kolom | Contoh | Format |
|-------|--------|--------|
| NO | 1 | Nomor urut |
| NAMA | EKO BASUKI TEGUH AGROWIBOWO SH | Nama lengkap |
| (col C) | 79120294 | NRP (tanpa header) |
| NO. REKENING GAJI BRI CAB. | '124501002684500 | Diawali petik, 15 digit |
| JUMLAH MASS DEBET | 1710000 | Nominal potongan |

**Format rekening BRI yang ditemukan:**
- `124501002684500` — 15 digit, tanpa strip
- `004501038075506` — 15 digit, tanpa strip
- `009601078204504` — 15 digit, tanpa strip
- `632701025377535` — 15 digit, tanpa strip
- `314201012730531` — 15 digit, tanpa strip

**Catatan penting:** Kolom NRP tidak punya header (col C kosong headernya). Semua rekening diawali petik `'` sebagai text marker di Excel.

### Sheet: `DATABASE` (857 rows) — Detail Potongan Per Sumber

**Kolom utama:** NO, NRP, NAMA, lalu kolom per kreditur/penyedia:

| Kreditur | Contoh Nominal | Keterangan |
|----------|----------------|------------|
| MBAK MONIKA | 1,134,000 | Penyedia arisan/pinjaman pribadi |
| LAIN2 | 6,000 | |
| MBAK ANIK | - | |
| LETING LENY | 100,000 | Letting/arisan |
| PAK EDI | - | |
| LETING HASAN | - | |
| GIRI | - | |
| AAN | - | |
| ARISAN 40 JUTA | - | Arisan besar |
| ARISAN 34 JUTA | - | Arisan besar |
| TABUNGAN | 150,000 | Tabungan koperasi |
| LETING Bu DANI | - | |
| LETING BAGUS | - | |
| AFIF | - | |
| LETING MBK ANGGA | - | |
| LETING ILHAM | - | |
| **JUMLAH** | 1,140,000 | Total potongan |

**Contoh data:**

| NRP | Nama | Monika | Lain2 | Leny | Hasan | Tabungan | Jumlah |
|-----|------|--------|-------|------|-------|----------|--------|
| 97081149 | adi tri | 1,134,000 | 6,000 | - | - | - | 1,140,000 |
| 82071186 | BORNEO | - | - | - | - | 150,000 | 150,000 |
| 78020121 | UNTORO | 2,257,000 | 0 | - | - | - | 2,257,000 |

**Insight:** Potongan BUKAN hanya dari koperasi. Ada many creditors (arisan, letting, tabungan) yang dipotong dari tunkin secara bersamaan. Koperasi hanya sebagian dari total mass debet.

### Sheet: `SISA_TUNKIN` (661 rows)

**Struktur:**

| Kolom | Contoh | Keterangan |
|-------|--------|------------|
| NO | 1 | |
| NAMA | ALEX SANDY SIREGAR | |
| NRP | 84041976 | |
| NO. REKENING | '177601007134503 | Rekening BRI |
| TUNKIN MARET | 5,183,000 | Total tunkin bulan Maret |
| MASS DEBET | 0 | Total potongan |
| SISA TUNKIN | 5,183,000 | Selisih (TUNKIN - MASS_DEBET) |

**Formula:** `SISA = TUNKIN - MASS_DEBET`

**Contoh data:**

| Nama | NRP | Rekening | Tunkin Maret | Mass Debet | Sisa |
|------|-----|----------|-------------|------------|------|
| ALEX SANDY SIREGAR | 84041976 | 177601007134503 | 5,183,000 | 0 | 5,183,000 |
| IRWAN LUKITO HADI | 81110966 | 004401025460506 | 4,551,000 | 100,000 | 4,451,000 |
| SUWARNO SH | 74120235 | 009601078204504 | 4,551,000 | 100,000 | 4,451,000 |
| WAHONO PUDJI SANTOSO | 69120075 | 004401025175509 | 3,781,000 | 2,000,000 | 1,781,000 |

### Sheet: `TUNKIN` (1390 rows)

Format sederhana: NRP → Jumlah Tunkin. Ada duplikat NRP.

### Sheet: `ARISAN_38` / `ARISAN_34`

Daftar peserta arisan (38 dan 34 orang). Format: NO, Kode, NAMA.

---

## 3. lampiranspm_tunkinTHR (590 rows)

### Sheet: `lampiranspm_tunkin`

Format resmi SPM (Surat Perintah Membayar) dari SIKEU Polri.

**Kolom kunci (dari 60 kolom):**

| Kolom | Contoh | Keterangan |
|-------|--------|------------|
| nip | 84041976 | NIP/NRP anggota |
| nmpeg | ALEX SANDY SIREGAR | Nama pegawai |
| kdgol | 42 | Kode golongan |
| npwp | 788061984822000 | NPWP |
| nmrek | ALEX SANDY SIREGAR | Nama rekening |
| nm_bank | PT.BANK RAKYAT INDONESIA (Persero) Tbk. KC SURABAYA PAHLAWAN | Nama bank |
| rekening | 177601007134503 | No rekening (format bersih) |
| gjpokok | 4,418,600 | Gaji pokok |
| tjistri | 441,860 | Tunjangan istri |
| tjanak | 88,372 | Tunjangan anak |
| tjstruk | 1,260,000 | Tunjangan struktural |
| tjpph | 657,969 | PPh |
| iwp | 0 | Iuran pensiun |
| bpjs | 0 | BPJS |
| bersih | 6,484,100 | Gaji bersih |

### Sheet: `Sheet1` (630 rows)

Mapping NIP → Rekening:

| nip | nmrek | rekening (asli) | rekening (bersih) |
|-----|-------|-----------------|-------------------|
| 84041976 | ALEX SANDY SIREGAR | 177601007134503 | 177601007134503 |
| 81101270 | A. RISKY FARDIAN C | 0147-01-001791-53-5 | 014701001791535 |
| 69010105 | SUHARTININGSIH | 0044-01-025359-50-1 | 004401025359501 |
| 84050083 | JENI TRIANTO | 3142-01-012730-53-1 | 314201012730531 |

**Catatan:** Kolom `rekening` ke-4 adalah versi bersih (strip dihapus). Format asli bervariasi.

---

## 4. CSV Tunkin (integrasi-data-gaji-april)

File: `NO,NAMA,NRPNIP,NO_REKENING,TUNKIN_M.csv`

**Struktur:**

| Kolom | Contoh | Keterangan |
|-------|--------|------------|
| NO | 1.0 | Nomor urut (float!) |
| NAMA | ALEX SANDY SIREGAR | Nama anggota |
| NRP/NIP | 84041976 | NRP/NIP |
| NO_REKENING | '177601007134503 | Diawali petik |
| TUNKIN_MARET | 5183000.0 | Total tunkin (float!) |
| MASS_DEBET | 0.0 | Total potongan |
| SISA_TUNKIN | 5183000.0 | Selisih |

**Ini adalah source file untuk import tunkin ke sistem.**

---

## Gap Analysis: Dokumen vs Sistem

### Field yang Sudah Ada di Schema

| Data Dokumen | Field Prisma | Tabel | Status |
|---|---|---|---|
| NRP/NIP | `Member.nrp` | Member | ✅ |
| NAMA | `Member.name` | Member | ✅ |
| Tunkin | `Member.tunlesKinerja` | Member | ✅ |
| Gaji | `Member.salary` | Member | ✅ |
| Pokok Pinjaman | `Loan.principalAmount` | Loan | ✅ |
| Tenor | `Loan.tenorMonths` | Loan | ✅ |
| Angsuran ke- | `LoanSchedule.installmentNumber` | LoanSchedule | ✅ |
| Terbayang (BS) | `Loan.paidAmount` | Loan | ✅ |
| Sisa Saldo | `Loan.outstandingAmount` | Loan | ✅ |
| Jasa per bulan | `LoanPayment.interestPortion` | LoanPayment | ✅ |
| Pokok per bulan | `LoanPayment.principalPortion` | LoanPayment | ✅ |
| Piutang Toko | `StoreSale.salaryCut` | StoreSale | ✅ |
| Piutang Unit | `UnitTransaction.salaryCut` | UnitTransaction | ✅ |

### Field yang BELUM Ada di Schema

| Data Dokumen | Dibutuhkan Untuk | Prioritas | Catatan |
|---|---|---|---|
| `Member.noRekening` | Mass Debet Tunkin Export | Prioritas 4 | No rekening BRI, format bervariasa |
| `Member.pangkat` | Laporan piutang per pangkat | Nice to have | Bisa diambil dari SPM |
| `Member.unit` | Grouping per bagian (KABID, SIWAS, dll) | Ditunda | Perlu waktu saat import |

### Format Rekening BRI — Variasi yang Ditemukan

| Format Asli | Bersih | Sumber |
|---|---|---|
| `177601007134503` | `177601007134503` | lampiran SPM |
| `0044-01-025359-50-1` | `004401025359501` | lampiran SPM |
| `0147-01-001791-53-5` | `014701001791535` | lampiran SPM |
| `3142-01-012730-53-1` | `314201012730531` | lampiran SPM |
| `'124501002684500` | `124501002684500` | Mass Debet |
| `'004501038075506` | `004501038075506` | Mass Debet |

**Normalisasi yang diperlukan saat import:**
1. Hapus petik awal `'`
2. Hapus strip `-`
3. Hapus spasi
4. Result: 15 digit numeric string

---

## Mapping: Dokumen → Import Code

### Import Tunkin (`/api/members/import` type=tunkin)

**Source:** CSV `NO,NAMA,NRPNIP,NO_REKENING,TUNKIN_M.csv`

**Flow:**
1. Parse CSV/XLSX → cari header row (nama/nrp/tunkin)
2. Match anggota: NRP dulu → exact name → fuzzy name
3. Update `Member.tunlesKinerja` dengan nilai SISA_TUNKIN

**Yang belum ditangani:**
- `NO_REKENING` diabaikan (field belum ada)
- `MASS_DEBET` tidak disimpan
- Hanya menyimpan SISA_TUNKIN sebagai tunlesKinerja

### Import Potongan (`/api/transactions/import-potongan`)

**Source:** Multi-sheet Excel dari SIKEU

**Flow:**
1. Parse per sheet (1 sheet = 1 bulan)
2. Frontend merge semua sheet → tambah kolom BULAN
3. Format: NRP, TAJIB, BARANG, SP, JUMLAH, NAMA, BULAN
4. Create: SavingsAccount deposit (TAJIB), StoreSale salary_cut (BARANG), LoanPayment (SP)
5. Dedup by NRP + BULAN

---

## Relasi Antar Dokumen

```
lampiran SPM (gaji resmi)
    ├── NRP, NAMA, GAJI POKOK, TUNKIN, REKENING
    │
    ├──→ Import Tunkin → Member.tunlesKinerja
    ├──→ Import Gaji → Member.salary
    └──→ (masalah) NO_REKENING tidak tersimpan

CSV Tunkin (summary)
    ├── NRP, NAMA, NO_REKENING, TUNKIN, MASS_DEBET, SISA
    │
    ├──→ Import Tunkin → Member.tunlesKinerja (SISA saja)
    └──→ (masalah) NO_REKENING, MASS_DEBET tidak tersimpan

REKAP Mass Debet (BRI format)
    ├── NAMA, NRP, NO_REKENING, JUMLAH MASS DEBET
    │
    └──→ (belum ada) Export Mass Debet → format BRI untuk upload

RINCIAN PIUTANG SP
    ├── NAMA, PANGKAT, NRP, TGL PINJAM, POKOK, TENOR, ANGSURAN KE-, TERBAYAR, SISA
    │
    ├──→ Sheet3: Jasa per bulan → cocok dengan Rekap Jasa (/pinjaman/laporan-jasa)
    └──→ sp per des 25: Piutang Gabungan → Prioritas 3 (belum ada)

DATABASE (detail potongan)
    ├── NRP, NAMA, + kolom per kreditur, JUMLAH
    │
    └──→ (di luar scope) Penyedia non-koperasi (arisan, letting pribadi)
```

---

## Rekomendasi Pengembangan

### Prioritas 3: Piutang Gabungan (Toko + SP)

**Data source:** Sheet `sp per des 25`
- Query: `StoreSale.salaryCut` (unpaid) + `UnitTransaction.salaryCut` (unpaid) + `Loan.outstandingAmount`
- Grouping: per Member, total per sumber
- Output: Tabel Nama, Pangkat, NRP, Piutang Toko, Piutang SP, Total

### Prioritas 4: Mass Debet Tunkin Export

**Data source:** Sheet `POLRI_`
- Butuh: `Member.noRekening` (schema migration)
- Import source: CSV tunkin (kolom NO_REKENING) atau lampiran SPM (kolom rekening)
- Output: Format BRI — NAMA, NO_REKENING, JUMLAH MASS_DEBET
- Normalisasi rekening: hapus strip, hapus petik, hasil 15 digit

### Prioritas (ditunda): Member.unit

**Data source:** Tidak ada langsung di dokumen, tapi bisa diinfer dari:
- `kdgol` di lampiran SPM → golongan kepangkatan
- Pangkat → bisa mapping ke unit/bagian
- Alternatif: input manual saat import atau edit member

---

*Terakhir dianalisis: 1 Mei 2026*
