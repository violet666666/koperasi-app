# Spec: Payroll Slip Gaji — Import, Display & Cetak

**Tanggal:** 4 Mei 2026
**Status:** Approved

## Ringkasan

Fitur import data gaji dari file Excel BRI, tampilkan semua potongan (30+ kategori) per anggota, dan cetak slip gaji mirip AMPLOP_SIP/AMPLOP_POL. Sistem berfungsi sebagai **delivery mechanism** — data dari BRI ditampilkan apa adanya — plus **kalkulasi internal** Sisa Gaji (Gaji Bersih - total potongan koperasi) untuk keperluan operasional koperasi.

## Konteks

Saat ini operator menerima file Excel gaji dari BRI (`5. GAJI MEI 2026 POLRES.xls`, `E. GAJI MEI 2026 POLSEK.xls`) yang berisi sheet AMPLOP_SIP/AMPLOP_POL dengan format amplop slip per anggota. Anggota tidak bisa mengakses rincian gaji secara digital. Koperasi perlu memfasilitasi distribusi digital + cetak slip.

Sumber data utama: sheet **POT GAJI** (format tabular bersih, 1 baris per anggota, ~30 kolom potongan).

## Model Data

### PayrollPeriod

```prisma
model PayrollPeriod {
  id           Int      @id @default(autoincrement())
  periodName   String                           // "Mei 2026"
  periodMonth  Int                              // 5
  periodYear   Int                              // 2026
  sourceFile   String?                          // "5. GAJI MEI 2026 POLRES.xls"
  sourceType   String   @default("polres")      // polres / polsek
  status       String   @default("draft")        // draft / processed
  totalMembers Int      @default(0)
  totalGaji    Decimal  @default(0) @db.Decimal(15,2)
  totalPotongan Decimal @default(0) @db.Decimal(15,2)
  createdById  Int
  createdAt    DateTime @default(now())
  createdBy    User     @relation(fields: [createdById], references: [id])
  slips        PayrollSlip[]

  @@map("payroll_periods")
}
```

### PayrollSlip

```prisma
model PayrollSlip {
  id          Int      @id @default(autoincrement())
  periodId    Int
  period      PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  memberId    Int?
  member      Member?  @relation(fields: [memberId], references: [id])

  // Identifikasi
  nrp         String
  nama        String
  pangkat     String?

  // Gaji (dari Excel)
  gajiBersih  Decimal  @db.Decimal(15,2)        // JML GAJI dari POT GAJI sheet
  tunkin      Decimal  @default(0) @db.Decimal(15,2)

  // Potongan Koperasi Primkoppol (structured — untuk kalkulasi internal)
  potTajib          Decimal @default(0) @db.Decimal(15,2)
  potSP             Decimal @default(0) @db.Decimal(15,2)   // SP Pinjaman
  potBarang         Decimal @default(0) @db.Decimal(15,2)   // Barang Toko
  potSukarela       Decimal @default(0) @db.Decimal(15,2)
  potKoperasiLain   Decimal @default(0) @db.Decimal(15,2)   // Simpedes koperasi, dll

  // Kalkulasi internal koperasi
  totalPotKoperasi  Decimal @default(0) @db.Decimal(15,2)
  sisaGaji          Decimal @default(0) @db.Decimal(15,2)   // gajiBersih - totalPotKoperasi
  sisaTunkin        Decimal @default(0) @db.Decimal(15,2)

  // Semua potongan lain (JSON — display saja, tidak dihitung)
  otherDeductions   Json?   // { "Adm BRI": 0, "Catur Sakti": 0, "BNI46": 1469445, ... }

  // Total dari BRI (langsung dari Excel, bukan kalkulasi sistem)
  jumlahPotNonBRI   Decimal @default(0) @db.Decimal(15,2)
  jumlahPotBRI      Decimal @default(0) @db.Decimal(15,2)
  terimaBersih      Decimal @default(0) @db.Decimal(15,2)   // sudah termasuk semua potongan
  sisaRekening      Decimal @default(0) @db.Decimal(15,2)   // disisakan di rekening (100K)
  bisaDiambilATM    Decimal @default(0) @db.Decimal(15,2)   // terimaBersih - sisaRekening

  createdAt    DateTime @default(now())

  @@unique([periodId, nrp])
  @@map("payroll_slips")
}
```

**Kolom `otherDeductions` (JSON)** menyimpan semua potongan non-Primkoppol persis seperti di Excel:
```json
{
  "Mutasi/Berkala": 0,
  "Adm BRI": 0,
  "Catur Sakti": 0,
  "Lain2 Tunai": 0,
  "BNI46": 1469445,
  "Dana Sosial": 6000,
  "Arisan Polwan": 0,
  "Simpedes": 0,
  "Arisan Bhy": 0,
  "Koperasi Bhy": 0,
  "KPR/BTN YB": 0,
  "KPR/BTN Pekas": 0,
  "Jiwa Sraya": 0,
  "Aspol": 0,
  "Parkir": 0,
  "Tenis": 0,
  "Kantin": 0,
  "Bumi Putera": 0,
  "Fitnes": 0,
  "Iuran Kas PNS": 50000,
  "BRI Sudirman": 0,
  "BRI Cabang": 0,
  "BRI Unit Lain": 0
}
```

## Import Flow

### Sumber Data: Sheet POT GAJI

Sheet POT GAJI memiliki format tabular bersih (1 baris per anggota):

| Kolom | Contoh Header | Mapping |
|-------|--------------|---------|
| A | NO | urutan |
| B | PANGKAT | pangkat |
| C | NAMA | nama |
| D | NRP/NIP | nrp (matching ke Member) |
| E | JML GAJI | gajiBersih |
| F | MUTASI/BERKALA | otherDeductions.Mutasi |
| G | ADM BRI | otherDeductions.Adm BRI |
| H | CATUR SAKTI | otherDeductions.Catur Sakti |
| I | LAIN2 TUNAI | otherDeductions.Lain2 Tunai |
| J | BNI'46 | otherDeductions.BNI46 |
| K | TAJIP PRIMKOPPOL | potTajib |
| L | DANA SOSIAL | otherDeductions.Dana Sosial |
| M | ARISAN POLWAN | otherDeductions.Arisan Polwan |
| ... | ... | ... |
| AC | BARANG PRIMKOPPOL | potBarang |
| AD | SP PRIMKOPPOL | potSP |
| ... | ... | ... |
| AK | JUMLAH POT NON KRETAP | jumlahPotNonBRI |
| AL | JUMLAH POT KRETAP | jumlahPotBRI |
| AM | JUMLAH GAJI DITERIMA | terimaBersih |

**Mapping header dinamis** — tidak hardcode posisi kolom, tapi baca header dari baris pertama sheet dan map berdasarkan nama kolom. Ini menangani perbedaan antara POLRES dan POLSEK (kolom bisa sedikit berbeda).

### Alur Import

```
1. Operator buka /gaji → klik "Import Gaji"
2. Upload file Excel → pilih sheet (POT GAJI terdeteksi otomatis)
3. Sistem parse header → deteksi kolom secara dinamis
4. Preview: tabel menampilkan semua data yang akan diimport
5. Commit: simpan PayrollPeriod + PayrollSlip
6. Redirect ke /gaji/[periodId]
```

### Matching Anggota

- Primary: NRP dari Excel → `Member.nrp` atau `Member.memberNo`
- Fallback: Nama → fuzzy name match
- Jika tidak ditemui: tetap simpan slip (memberId = null), tandai sebagai "Tidak terdaftar"

### Kalkulasi Internal

```typescript
totalPotKoperasi = potTajib + potSP + potBarang + potSukarela + potKoperasiLain
sisaGaji = gajiBersih - totalPotKoperasi
sisaTunkin = tunkin - (potongan dari tunkin, jika ada)
```

Ini untuk keperluan internal koperasi (eligibilitas pinjaman, laporan). Angka ini TIDAK menggantikan angka BRI di slip — slip tetap menampilkan "Terima Bersih" dan "Bisa Diambil ATM" persis dari Excel.

## Halaman UI

### 1. `/gaji` — Daftar Periode Gaji

- Tabel: Periode | File Sumber | Tipe | Total Anggota | Total Gaji | Status | Aksi
- Tombol "Import Gaji Baru" → modal upload
- Aksi: Lihat Detail, Cetak Semua, Hapus

### 2. `/gaji/[periodId]` — Detail Periode

- Card ringkasan: Total Anggota, Total Gaji, Total Potongan, Rata-rata Sisa Gaji
- Tabel: NRP | Nama | Pangkat | Gaji Bersih | Pot Koperasi | Sisa Gaji | Terima Bersih | Aksi
- Search/filter by NRP/Nama
- Tombol: "Cetak Semua Slip" | "Export Excel"

### 3. `/gaji/[periodId]/slip/[memberId]` — Preview & Cetak Slip

Slip format AMPLOP lengkap (lihat layout di bawah).
Tombol: "Cetak" (print dialog browser)

### 4. `/portal/gaji` — Portal Anggota (self-service)

Anggota login → lihat slip gaji miliknya saja (berdasarkan NRP).
Menampilkan daftar periode yang tersedia + bisa buka/cetak slip.

## Slip Layout (AMPLOP-style)

```
┌──────────────────────────────────────────────┐
│  KOPERASI PRIMKOPPOL                         │
│  POLRES LUMAJANG                             │
│──────────────────────────────────────────────│
│  SLIP GAJI & POTONGAN                        │
│  Periode: Mei 2026                           │
│──────────────────────────────────────────────│
│  Nama      : MARDIANA, S.SOS                 │
│  Pangkat   : PENATA TK I                     │
│  NRP       : 73040054                        │
│──────────────────────────────────────────────│
│  GAJI BERSIH               Rp  4.820.000     │
│──────────────────────────────────────────────│
│  POTONGAN KOPERASI PRIMKOPPOL:               │
│  ├ Tajip Primkoppol        Rp    100.000     │
│  ├ SP Pinjaman             Rp    500.000     │
│  ├ Barang Primkoppol       Rp    200.000     │
│  └ Simpedes Koperasi       Rp     50.000     │
│  TOTAL POT KOPERASI        Rp    850.000     │
│──────────────────────────────────────────────│
│  POTONGAN LAINNYA:                           │
│  ├ Mutasi/Berkala          Rp          -     │
│  ├ Adm BRI                 Rp          -     │
│  ├ Catur Sakti             Rp          -     │
│  ├ Lain-lain Tunai         Rp          -     │
│  ├ BNI'46                  Rp          -     │
│  ├ Dana Sosial             Rp      6.000     │
│  ├ Arisan Polwan           Rp          -     │
│  ├ Simpedes                Rp          -     │
│  ├ Arisan Bhy              Rp          -     │
│  ├ Koperasi Bhy            Rp          -     │
│  ├ KPR/BTN YB              Rp          -     │
│  ├ KPR/BTN Pekas           Rp          -     │
│  ├ Jiwa Sraya              Rp          -     │
│  ├ Aspol                   Rp          -     │
│  ├ Parkir                  Rp          -     │
│  ├ Tenis                   Rp          -     │
│  ├ Kantin                  Rp          -     │
│  ├ Bumi Putera             Rp          -     │
│  ├ Fitnes                  Rp          -     │
│  └ Iuran Kas PNS           Rp     50.000     │
│──────────────────────────────────────────────│
│  JML POTONGAN NON BRI       Rp    906.000    │
│  ├ BRI Sudirman            Rp          -     │
│  ├ BRI Cabang              Rp          -     │
│  └ BRI Unit Lain           Rp          -     │
│  JML POTONGAN BRI          Rp          0     │
│──────────────────────────────────────────────│
│  TERIMA BERSIH              Rp  3.914.000    │
│  SISA DI REKENING          Rp    100.000     │
│  BISA DIAMBIL DI ATM       Rp  3.814.000    │
│──────────────────────────────────────────────│
│  *) Sisa Gaji (internal)    Rp  3.970.000    │
│  *) Sisa Tunkin (internal)  Rp          0    │
│  * = kalkulasi koperasi, bukan dari BRI      │
│──────────────────────────────────────────────│
│                          Lumajang, 1 Mei 2026│
│  Ketua Koperasi         Bendahara            │
│  (_________)            (_________)          │
└──────────────────────────────────────────────┘
```

Bagian atas (GAJI BERSIH + POTONGAN KOPERASI): dari structured fields.
Bagian tengah (POTONGAN LAINNYA): dari `otherDeductions` JSON.
Bagian bawah (TERIMA BERSIH, ATM): dari `terimaBersih`, `bisaDiambilATM`.
Bagian internal (*): dari kalkulasi `sisaGaji`, `sisaTunkin`.

## Files to Create/Modify

### New Files
- `prisma/schema.prisma` — tambah model `PayrollPeriod` + `PayrollSlip`
- `src/app/api/payroll/import/route.ts` — import Excel BRI
- `src/app/api/payroll/[periodId]/route.ts` — get period detail
- `src/app/api/payroll/[periodId]/slip/[memberId]/route.ts` — get single slip
- `src/app/(protected)/gaji/page.tsx` — daftar periode
- `src/app/(protected)/gaji/[periodId]/page.tsx` — detail periode
- `src/app/(protected)/gaji/[periodId]/slip/[memberId]/page.tsx` — preview & cetak slip
- `src/app/portal/gaji/page.tsx` — portal anggota (self-service)

### Modified Files
- `src/app/(protected)/master/import-data/page.tsx` — tambah import type "gaji_slip"
- `src/app/(protected)/laporan/page.tsx` — tambah link ke /gaji
- Navigation/sidebar — tambah menu "Gaji & Slip"

## Edge Cases

1. **Sheet tidak ditemukan**: Jika tidak ada sheet "POT GAJI", fallback ke sheet pertama dengan keyword matching
2. **Header berbeda**: POLRES vs POLSEK punya kolom berbeda — mapping dinamis berdasarkan header
3. **Anggota tidak ditemukan**: Slip tetap disimpan (memberId = null), bisa di-match manual nanti
4. **Import ulang periode sama**: Reject jika PayrollPeriod dengan month+year sama sudah ada, atau tawarkan overwrite
5. **File besar (>5000 baris)**: Batch processing dengan progress indicator

## Prioritas Implementasi

1. Schema + migration (PayrollPeriod, PayrollSlip)
2. Import API (parse POT GAJI, dynamic column mapping)
3. Halaman /gaji (list + detail + import modal)
4. Slip page (preview + print)
5. Portal anggota (/portal/gaji)
