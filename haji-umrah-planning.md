# Unit Haji & Umrah — Planning Document

> **Status:** Brainstorming Phase | **Dibuat:** 9 Juni 2026 | **Branch:** railway-migration
> **Partnership:** MOU dengan Bank BSI (Bank Syariah Indonesia)

---

## 1. Latar Belakang

Koperasi PRIMKOPPOL memiliki MOU dengan Bank BSI untuk menyediakan layanan Haji dan Umrah kepada anggota. Saat ini sistem memiliki 9 unit usaha (toko, resto, cafe, cuci mobil, barbershop, fitness, playstation, fotocopy, laundry) yang semuanya berbasis POS (transaksi langsung). Unit Haji & Umrah membutuhkan pendekatan fundamental berbeda karena melibatkan **lifecycle jangka panjang** dari pendaftaran hingga keberangkatan.

### Perbedaan Kunci dengan Unit yang Ada

| Aspek | Unit Saat Ini (Toko, Resto, dll) | Unit Haji & Umrah |
|-------|----------------------------------|--------------------|
| Transaksi | POS — bayar → selesai | Lifecycle — daftar → tabungan → berkas → visa → berangkat |
| Durasi | Detik/menit | Bulan/tahun |
| Data Model | StoreSale / UnitTransaction | Jamaah, Paket, Tabungan Bertarget, Dokumen, Keberangkatan |
| Revenue | Margin penjualan langsung | Margin paket + spread tabungan + admin fee |
| Compliance | Internal | PPIU/PIHK (Kemenag), SISKOPATUH, SISKOHAT |
| Partner | — | Bank BSI, Kemenag, Saudi Muassasah |

---

## 2. Keputusan Requirements

| Aspek | Keputusan | Catatan |
|-------|-----------|---------|
| **Peran Koperasi** | Full-Service (Tabungan + Travel + Financing) | Koperasi mengelola seluruh lifecycle |
| **Regulasi** | Asumsi PPIU + PIHK terdaftar | Feature-flagged, bisa di-hide jika belum |
| **Tabungan** | Desain 2 opsi (extend simpanan + model baru) | Dipresentasikan ke pengguna sebagai pilihan |
| **Scope** | Phased Spec (4 phase) | Build incrementally |

---

## 3. Model Bisnis — Koperasi Haji & Umrah

### 3.1 Revenue Streams

| Sumber | Estimasi | Deskripsi |
|--------|----------|-----------|
| **Margin Paket Umrah** | Rp 3–15 juta/jemaah | Selisih harga jual ke anggota vs biaya aktual (akomodasi, penerbangan, visa) |
| **Margin Paket Haji Plus** | Rp 10–30 juta/jemaah | Paket haji khusus dengan akomodasi premium |
| **Margin Paket Haji Furoda** | Rp 20–50 juta/jemaah | Paket VVIP via visa khusus Saudi |
| **Spread Tabungan** | % dari saldo mengendap | Selisih bunga simpanan di BSI vs bagi hasil ke anggota |
| **Admin Fee / Biaya Administrasi** | Rp 100k–500k/transaksi | Biaya pendaftaran, pengurusan visa, dll |
| **Pembiayaan/Talangan** | Margin pembiayaan | Talangan haji dengan margin syariah |
| **Asuransi Perjalanan** | Komisi dari partner | Referral ke perusahaan asuransi |
| **Perlengkapan Ibadah** | Profit penjualan | Ihram, mukena, koper, botol zamzam, dll |
| **SHU** | Sisa hasil usaha unit | Keuntungan unit dialokasikan ke anggota (keunggulan koperasi vs travel biasa) |

### 3.2 Tipe Paket

#### Paket Umrah

| Tier | Harga Estimasi | Durasi | Akomodasi |
|------|---------------|--------|-----------|
| **Economy** | Rp 18–25 juta | 7–9 hari | Hotel bintang 2–3 (jauh dari Masjid) |
| **Regular** | Rp 25–35 juta | 9–12 hari | Hotel bintang 3 (±500m dari Masjid) |
| **Premium** | Rp 35–50 juta | 12–14 hari | Hotel bintang 4 (±200m dari Masjid) |
| **VIP/VVIP** | Rp 50–80 juta+ | 14 hari | Hotel bintang 5 (dekat Masjidil Haram) |

#### Paket Haji

| Tipe | Harga | Wait Time | Organizer |
|------|-------|-----------|-----------|
| **Haji Reguler** | Rp 50–95 juta | 20–40 tahun | Kemenag langsung |
| **Haji Plus (ONH Plus)** | Rp 125–280 juta | 5–9 tahun | PIHK (koperasi) |
| **Haji Furoda** | Rp 300–400 juta+ | 1–2 tahun | PIHK (visa khusus Saudi) |

### 3.3 Partnership BSI — Produk yang Tersedia

| Produk BSI | Fungsi | Relevansi |
|------------|--------|-----------|
| **Tabungan Haji (BIP/BIH)** | Akumulasi BPIH, booking porsi haji | Setoran awal ~Rp 25 juta untuk nomor porsi |
| **Tabungan Umrah** | Tabungan khusus umrah, setoran awal Rp 100rb | Launch Feb 2026, terintegrasi BYOND app |
| **Talangan Haji BSI** | Pembiayaan/pinjaman untuk pelunasan BPIH | Anggota bayar cicilan talangan |
| **BEWIZE** | Platform cash management untuk travel agency | Kelola dana jemaah secara institusional |
| **BYOND by BSI** | Super-app BSI, listing paket umrah | Jemaah bisa beli paket langsung dari app |

### 3.4 Regulatory Framework

| Regulasi | Fungsi | Koperasi Perlu |
|----------|--------|---------------|
| **SISKOHAT** | Sistem Komputerisasi Haji Terpadu (Kemenag) | Registrasi jemaah haji, tracking porsi |
| **SISKOPATUH** | Monitoring online PPIU | Compliance reporting untuk umrah |
| **SURI** | Surat Registrasi Umrah | Diterbitkan per jemaah umrah |
| **PPIU** | Izin Penyelenggara Perjalanan Ibadah Umrah | Izin Kemenag untuk jual paket umrah |
| **PIHK** | Izin Penyelenggara Ibadah Haji Khusus | Izin Kemenag untuk jual paket haji plus/furoda |
| **BPS BPIH** | Bank Penerima Setoran BPIH | BSI adalah BPS BPIH |
| **PMA 8/2018** | Regulasi Penyelenggaraan Umrah | Standar layanan umrah |
| **PMA 19/2018** | Regulasi Penyelenggaraan Haji | Standar layanan haji khusus |
| **UU 13/2008** | UU Penyelenggaraan Haji | Legal framework |

---

## 4. Workflow Lengkap — Dari Pendaftaran ke Keberangkatan

### 4.1 Alur Haji Khusus (via PIHK)

```
[1] Pendaftaran Jamaah
    ├─ Isi formulir (data diri, NIK, NRP, kontak)
    ├─ Pilih paket (Plus / Furoda)
    ├─ Upload dokumen awal (KTP, KK, Akte Nikah)
    └─ Status: REGISTERED

[2] Verifikasi Dokumen
    ├─ Cek kelengkapan dokumen
    ├─ Verifikasi passport (min 6 bulan valid, min 4 halaman kosong)
    ├─ Pas photo 4x6
    └─ Status: DOCUMENTS_VERIFIED

[3] Pembayaran
    ├─ DP / Setoran Awal (Rp 2–10 juta)
    ├─ Cicilan bulanan via tabungan program
    ├─ Pelunasan sebelum keberangkatan
    └─ Status: PAYMENT_SETTLED

[4] Registrasi Kemenag
    ├─ Submit ke SISKOHAT
    ├─ Terima nomor porsi / SURI
    ├─ Interview & biometric di PLHUT
    └─ Status: REGISTERED_KEMENAG

[5] Persiapan Keberangkatan
    ├─ Manasik haji di KBIHU
    ├─ Medical checkup
    ├─ Pengurusan visa
    ├─ Briefing jemaah
    └─ Status: PRE_DEPARTURE

[6] Keberangkatan
    ├─ Check-in bandara
    ├─ Tracking di Arab Saudi
    └─ Status: DEPARTED

[7] Kembali
    ├─ Evaluasi layanan
    ├─ Input feedback
    └─ Status: RETURNED
```

### 4.2 Alur Umrah (via PPIU)

```
[1] Pendaftaran → [2] Verifikasi → [3] Pembayaran → [4] Visa Processing
    → [5] Manasik → [6] Keberangkatan → [7] Kembali

(Sama seperti haji khusus tapi tanpa SISKOHAT/porsi, tanpa wait time,
 dan bisa kapanpun sepanjang tahun — tidak ada kuota pemerintah)
```

### 4.3 Alur Tabungan Program

```
Anggota mendaftar tabungan → Set target (BPIH / biaya paket)
    → Setoran awal → Cicilan bulanan (potong gaji / transfer manual)
    → Setiap setoran → CashBankTransaction + SavingsTransaction
    → Tracking progress (saldo saat ini vs target)
    → Notifikasi ketika mendekati target
    → Ketika lunas → trigger booking paket
```

---

## 5. Arsitektur — 3 Pendekatan

### Pendekatan A: Unit Pattern Extension (RECOMMENDED)

**Konsep:** Buat module khusus `/haji-umrah/*` yang **reuse infrastruktur** (CashBank, billing, member, journal) tapi dengan model data dan UI sendiri. Tidak dipaksakan ke pola unit POS.

```
src/
  app/(protected)/
    haji-umrah/              ← Route group BARU (bukan unit/[unitSlug])
      dashboard/             ← Overview: jamaah stats, tabungan, keberangkatan
      paket/                 ← CRUD paket Haji/Umrah (store + F&B like catalog)
      jamaah/                ← Daftar jamaah, registrasi baru, profil lengkap
      tabungan/              ← Tabungan program: setoran, tracking, milestone
      pendaftaran/           ← Booking pendaftaran paket oleh jamaah
      dokumen/               ← Upload & verifikasi dokumen per jamaah
      keberangkatan/         ← Tracking status keberangkatan (per batch/group)
      pembiayaan/            ← Talangan haji/umrah (mirip pinjaman)
      laporan/               ← Revenue report, SHU unit, jamaah report
  app/api/
    haji-umrah/
      packages/              ← CRUD paket
      jamaah/                ← CRUD jamaah + dokumen
      savings/               ← Setoran tabungan, tracking progress
      bookings/              ← Booking/pendaftaran paket
      documents/             ← Upload/verify dokumen
      departures/            ← Tracking keberangkatan
      financing/             ← Pembiayaan/talangan
      reports/               ← Laporan & analytics
  lib/
    services/
      haji-umrah/
        types.ts             ← TypeScript interfaces
        savings-service.ts   ← Logika tabungan bertarget
        booking-service.ts   ← Lifecycle booking management
        document-service.ts  ← Document checklist & verification
```

**Keuntungan:**
- ✅ Route terpisah (`/haji-umrah/*`) — tidak bentrok dengan unit POS
- ✅ Reuse CashBank integration (setoran → CBTransaction otomatis)
- ✅ Reuse billing/tagihan untuk potong gaji tabungan otomatis
- ✅ Reuse journal posting (double-entry accounting)
- ✅ Member portal bisa ditambah section "Haji & Umrah"
- ✅ API pattern konsisten dengan yang ada
- ✅ Model data baru yang proper untuk lifecycle jamaah

**Kekurangan:**
- ⚠️ Butuh model Prisma baru (5–8 tabel)
- ⚠️ Tidak bisa pakai generic `/unit/[unitSlug]` pages
- ⚠️ Butuh page & komponen UI baru (bukan reuse POS)

---

### Pendekatan B: Extended Simpanan + Existing Unit Pattern

**Konsep:** Anggap Haji/Umrah sebagai tipe simpanan + tipe unit biasa. Pakai model yang sudah ada.

```
SavingsProduct: tambah type "tabungan_haji", "tabungan_umrah"
UnitTransaction: tambah unitType "haji_umrah"
StoreProduct: paket sebagai "products" dengan isService: true
```

**Keuntungan:**
- ✅ Minimal perubahan — reuse semua UI yang ada
- ✅ Tabungan = simpanan biasa (tinggal tambah SavingsProduct)
- ✅ Paket = StoreProduct, booking = StoreSale

**Kekurangan:**
- ❌ **Force-fit** — paksa data model yang tidak cocok
- ❌ SavingsAccount tidak punya field `targetAmount`, `milestone`, `paymentSchedule`
- ❌ Jamaah lifecycle (register → docs → visa → depart) tidak bisa direpresentasikan
- ❌ Dokumen upload, passport tracking, porsi number — tidak ada di model yang ada
- ❌ Akan menciptakan hack di banyak tempat
- ❌ Tidak sustainable untuk scope full-service

---

### Pendekatan C: Micro-Module dengan Shared Primitives

**Konsep:** Modul independen yang share primitives (auth, members, cash/bank) tapi tidak bergantung pada unit pattern.

```
src/lib/services/haji-umrah/
  types.ts
  savings-service.ts
  booking-service.ts
  document-service.ts
  departure-service.ts
```

**Keuntungan:**
- ✅ Bersih, terisolasi, tidak ada coupling
- ✅ Bisa deploy/hapus tanpa affect unit lain
- ✅ Testing mudah (isolated)

**Kekurangan:**
- ❌ Duplikasi — perlu reimplement cash/bank sync, journal posting, billing
- ❌ Tidak bisa reuse tagihan piutang
- ❌ SHU integration perlu custom
- ❌ Lebih banyak kode

---

### Rekomendasi: **Pendekatan A**

Alasan:
1. Reuse infrastruktur yang sudah solid (CashBank, billing, member, journal)
2. Route terpisah jelas — `/haji-umrah/*`
3. Model data baru yang proper, bukan force-fit
4. Bisa tetap pegang tagihan/billing untuk potong gaji tabungan otomatis
5. Seimbang — tidak terlalu coupled (B), tidak terlalu isolated (C)

---

## 6. Data Model Proposal — Prisma Models Baru

### 6.1 Opsi 1: Model Terpisah (Rekomendasi untuk Pendekatan A)

```prisma
// ═══════════════════════════════════════════════════════════════
// HAJI & UMRAH MODULE
// ═══════════════════════════════════════════════════════════════

/// Katalog paket Haji/Umrah yang dijual koperasi
model HajiUmrahPackage {
  id              Int       @id @default(autoincrement())
  code            String    @unique                    // PKT-HAJI-PLUS-2026, PKT-UMRAH-REG-01
  name            String                               // "Umrah Regular 9 Hari", "Haji Plus 2026"
  type            String                               // umrah, haji_plus, haji_furoda
  tier            String                               // economy, regular, premium, vip
  duration        Int                                  // Durasi dalam hari (7, 9, 12, 14)
  price           Decimal   @db.Decimal(15, 2)         // Harga jual ke anggota
  costPrice       Decimal?  @db.Decimal(15, 2)         // Biaya aktual (untuk hitung margin)
  quota           Int?                                  // Kuota jemaah per batch
  departureCity   String?                              // Kota keberangkatan (Jakarta, Surabaya)
  accommodation   Json?                                 // Detail hotel (nama, bintang, jarak ke masjid)
  includes        Json?                                 // Apa saja yang termasuk (flight, meal, transport)
  excludes        Json?                                 // Apa yang tidak termasuk
  isActive        Boolean   @default(true)
  validFrom       DateTime? @db.Date                   // Periode berlaku paket
  validUntil      DateTime? @db.Date
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  bookings        HajiUmrahBooking[]

  @@map("haji_umrah_packages")
}

/// Profil jamaah (extend data Member yang sudah ada)
model HajiUmrahJamaah {
  id                  Int       @id @default(autoincrement())
  memberId            Int       @unique @map("member_id")
  passportNumber      String?   @map("passport_number")
  passportExpiry      DateTime? @map("passport_expiry") @db.Date
  passportIssuingCity String?   @map("passport_issuing_city")
  porsiHaji           String?   @map("porsi_haji")       // Nomor porsi SISKOHAT (untuk haji)
  siskohatRegistered  Boolean   @default(false) @map("siskohat_registered")
  suriNumber          String?   @map("suri_number")      // Surat Registrasi Umrah
  bloodType           String?   @map("blood_type")
  emergencyContact    String?   @map("emergency_contact")
  emergencyPhone      String?   @map("emergency_phone")
  mahramName          String?   @map("mahram_name")      // Untuk wanita < 45 tahun
  mahramRelation      String?   @map("mahram_relation")
  vaccineCertificate  String?   @map("vaccine_certificate") // Path/Base64
  medicalClearance    String?   @map("medical_clearance")   // Path/Base64
  photoPath           String?   @map("photo_path")         // Pas photo 4x6
  notes               String?
  createdBy           Int       @map("created_by")
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  member      Member              @relation(fields: [memberId], references: [id])
  bookings    HajiUmrahBooking[]
  documents   HajiUmrahDocument[]
  savings     HajiUmrahSavings[]
  user        User                @relation(fields: [createdBy], references: [id])

  @@map("haji_umrah_jamaah")
}

/// Booking / Pendaftaran paket oleh jamaah
model HajiUmrahBooking {
  id                Int       @id @default(autoincrement())
  bookingNo         String    @unique @map("booking_no")  // HU-20260609-0001
  jamaahId          Int       @map("jamaah_id")
  packageId         Int       @map("package_id")
  batchGroup        String?   @map("batch_group")        // Grup keberangkatan (batch ID/tanggal)
  status            String    @default("registered")
    // registered → documents_verified → payment_settled → registered_kemenag
    // → visa_processing → pre_departure → departed → returned → cancelled
  totalAmount       Decimal   @db.Decimal(15, 2)         // Harga paket yang di-booking
  paidAmount        Decimal   @default(0) @db.Decimal(15, 2)
  dpAmount          Decimal?  @db.Decimal(15, 2)         // Down payment
  dpPaidAt          DateTime? @map("dp_paid_at")
  settledAt         DateTime? @map("settled_at")         // Tanggal pelunasan
  departureDate     DateTime? @map("departure_date") @db.Date
  returnDate        DateTime? @map("return_date") @db.Date
  visaStatus        String?   @map("visa_status")        // pending, issued, rejected
  visaIssuedAt      DateTime? @map("visa_issued_at")
  manasikDate       DateTime? @map("manasik_date") @db.Date
  manasikAttended   Boolean   @default(false) @map("manasik_attended")
  medicalDate       DateTime? @map("medical_date") @db.Date
  medicalCleared    Boolean   @default(false) @map("medical_cleared")
  cancellationReason String?  @map("cancellation_reason")
  cancelledAt       DateTime? @map("cancelled_at")
  notes             String?
  createdBy         Int       @map("created_by")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  jamaah       HajiUmrahJamaah    @relation(fields: [jamaahId], references: [id])
  package      HajiUmrahPackage   @relation(fields: [packageId], references: [id])
  payments     HajiUmrahPayment[]
  documents    HajiUmrahDocument[]
  user         User               @relation(fields: [createdBy], references: [id])

  @@index([status])
  @@index([jamaahId])
  @@index([packageId])
  @@map("haji_umrah_bookings")
}

/// Pembayaran untuk booking (DP, cicilan, pelunasan)
model HajiUmrahPayment {
  id                Int       @id @default(autoincrement())
  bookingId         Int       @map("booking_id")
  paymentNo         String    @unique @map("payment_no") // HP-20260609-0001
  type              String                               // dp, installment, settlement, refund
  amount            Decimal   @db.Decimal(15, 2)
  paymentMethod     String    @map("payment_method")     // cash, bank_transfer, salary_cut, internal_savings
  cashBankAccountId Int?      @map("cash_bank_account_id")
  savingsAccountId  Int?      @map("savings_account_id") // Jika bayar dari tabungan program
  referenceNo       String?   @map("reference_no")
  notes             String?
  status            String    @default("completed")      // completed, voided
  voidedAt          DateTime? @map("voided_at")
  voidedById        Int?      @map("voided_by_id")
  voidReason        String?   @map("void_reason")
  createdBy         Int       @map("created_by")
  createdAt         DateTime  @default(now())

  booking        HajiUmrahBooking  @relation(fields: [bookingId], references: [id])
  cashBankAccount CashBankAccount? @relation(fields: [cashBankAccountId], references: [id])
  user           User              @relation(fields: [createdBy], references: [id])

  @@index([bookingId])
  @@index([createdAt])
  @@map("haji_umrah_payments")
}

/// Tabungan program Haji/Umrah (bertarget)
model HajiUmrahSavings {
  id              Int       @id @default(autoincrement())
  jamaahId        Int       @map("jamaah_id")
  accountNo       String    @unique @map("account_no")  // TS-HAJI-0001, TS-UMRAH-0001
  type            String                               // tabungan_haji, tabungan_umrah
  targetAmount    Decimal   @db.Decimal(15, 2)          // Target (BPIH atau biaya paket)
  currentBalance  Decimal   @default(0) @db.Decimal(15, 2)
  monthlyDeposit  Decimal?  @db.Decimal(15, 2)          // Setoran bulanan target (optional)
  status          String    @default("active")          // active, completed, withdrawn, closed
  linkedBookingId Int?      @map("linked_booking_id")   // Terhubung ke booking tertentu
  cashBankAccountId Int?    @map("cash_bank_account_id") // Rekening kas/bank tabungan ini
  openedDate      DateTime  @map("opened_date") @db.Date
  closedDate      DateTime? @map("closed_date") @db.Date
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  jamaah          HajiUmrahJamaah   @relation(fields: [jamaahId], references: [id])
  linkedBooking   HajiUmrahBooking? @relation(fields: [linkedBookingId], references: [id])
  transactions    HajiUmrahSavingsTx[]
  cashBankAccount CashBankAccount?  @relation(fields: [cashBankAccountId], references: [id])

  @@index([jamaahId])
  @@index([status])
  @@map("haji_umrah_savings")
}

/// Transaksi tabungan (setoran, penarikan, koreksi)
model HajiUmrahSavingsTx {
  id                Int       @id @default(autoincrement())
  savingsId         Int       @map("savings_id")
  transactionNo     String    @unique @map("transaction_no") // TS-TX-000001
  type              String                               // deposit, withdrawal, correction, auto_debit
  amount            Decimal   @db.Decimal(15, 2)
  balanceBefore     Decimal   @db.Decimal(15, 2)
  balanceAfter      Decimal   @db.Decimal(15, 2)
  paymentMethod     String    @map("payment_method")     // cash, bank_transfer, salary_cut
  cashBankTxId      Int?      @map("cash_bank_tx_id")    // Link ke CashBankTransaction
  notes             String?
  transactionDate   DateTime  @map("transaction_date") @db.Date
  status            String    @default("completed")      // completed, voided
  voidedAt          DateTime? @map("voided_at")
  createdBy         Int       @map("created_by")
  createdAt         DateTime  @default(now())

  savings       HajiUmrahSavings   @relation(fields: [savingsId], references: [id])
  cashBankTx    CashBankTransaction? @relation(fields: [cashBankTxId], references: [id])
  user          User                @relation(fields: [createdBy], references: [id])

  @@index([savingsId])
  @@index([transactionDate])
  @@map("haji_umrah_savings_tx")
}

/// Checklist dokumen per jamaah per booking
model HajiUmrahDocument {
  id              Int       @id @default(autoincrement())
  jamaahId        Int       @map("jamaah_id")
  bookingId       Int?      @map("booking_id")
  documentType    String    @map("document_type")
    // ktp, passport, kk, akte_nikah, akte_kelahiran, pas_photo,
    // vaccine_certificate, medical_clearance, surat_mahram,
    // bukti_setoran, payment_proof
  fileName        String?   @map("file_name")
  fileData        String?   @map("file_data")          // Base64 (sesuai pattern UploadedFile)
  filePath        String?   @map("file_path")
  fileSize        Int?      @map("file_size")
  mimeType        String?   @map("mime_type")
  status          String    @default("pending")
    // pending → uploaded → verified → rejected
  verifiedById    Int?      @map("verified_by_id")
  verifiedAt      DateTime? @map("verified_at")
  rejectReason    String?   @map("reject_reason")
  notes           String?
  uploadedAt      DateTime? @map("uploaded_at")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  jamaah     HajiUmrahJamaah   @relation(fields: [jamaahId], references: [id])
  booking    HajiUmrahBooking? @relation(fields: [bookingId], references: [id])
  verifiedBy User?             @relation(fields: [verifiedById], references: [id])

  @@unique([jamaahId, bookingId, documentType])
  @@index([jamaahId])
  @@index([status])
  @@map("haji_umrah_documents")
}

/// Batch/Grup keberangkatan
model HajiUmrahDeparture {
  id              Int       @id @default(autoincrement())
  batchNo         String    @unique @map("batch_no")    // BATCH-U-2026-001 (Umrah), BATCH-H-2026-001 (Haji)
  type            String                               // umrah, haji_plus, haji_furoda
  packageId       Int?      @map("package_id")
  departureDate   DateTime  @map("departure_date") @db.Date
  returnDate      DateTime  @map("return_date") @db.Date
  departureCity   String    @map("departure_city")
  maxCapacity     Int       @map("max_capacity")
  currentCapacity Int       @default(0) @map("current_capacity")
  status          String    @default("open")           // open, closed, departed, completed
  airline         String?
  hotelMakkah     String?   @map("hotel_makkah")
  hotelMadinah    String?   @map("hotel_madinah")
  leaderName      String?   @map("leader_name")        // Ketua rombongan
  notes           String?
  createdBy       Int       @map("created_by")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  package    HajiUmrahPackage?  @relation(fields: [packageId], references: [id])
  user       User               @relation(fields: [createdBy], references: [id])

  @@index([departureDate])
  @@index([status])
  @@map("haji_umrah_departures")
}
```

**Total: 7 model baru** — `HajiUmrahPackage`, `HajiUmrahJamaah`, `HajiUmrahBooking`, `HajiUmrahPayment`, `HajiUmrahSavings`, `HajiUmrahSavingsTx`, `HajiUmrahDocument`, `HajiUmrahDeparture`

### 6.2 Relasi dengan Model yang Ada

```
Member ──1:1──→ HajiUmrahJamaah (profil extended)
HajiUmrahPayment → CashBankAccount (kas/bank integration)
HajiUmrahSavingsTx → CashBankTransaction (setoran otomatis ke buku kas)
HajiUmrahBooking lifecycle → AuditLog (tracking perubahan status)
```

### 6.3 Opsi 2: Extend Simpanan Existing (Alternatif untuk Tabungan)

Daripada buat `HajiUmrahSavings` + `HajiUmrahSavingsTx`, bisa extend model yang ada:

```prisma
// Tambah field ke SavingsProduct
model SavingsProduct {
  // ... existing fields ...
  targetAmount   Decimal?  @map("target_amount") @db.Decimal(15, 2)  // Baru: untuk tabungan bertarget
  linkedUnitType String?   @map("linked_unit_type")                    // Baru: "haji_umrah"
  autoDeductDay  Int?      @map("auto_deduct_day")                     // Baru: tanggal potong otomatis
}
```

**Catatan:** Opsi 1 (model terpisah) lebih disarankan karena:
- Field tabungan Haji/Umrah sangat spesifik (linkedBooking, monthlyDeposit target)
- Lifecycle berbeda (active → completed when target reached → linked to booking)
- Tidak mencemari model Simpanan yang sudah stabil

---

## 7. Phased Implementation Plan

### Phase 1: Master Data & Paket (Foundation)

**Estimasi:** 2–3 minggu | **Priority:** CRITICAL

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 1.1 | **Prisma Models** | Buat 7 model baru, migration, seed data |
| 1.2 | **Manajemen Paket** | CRUD paket Umrah & Haji (kode, nama, tipe, tier, harga, durasi, kuota) |
| 1.3 | **Registrasi Jamaah** | Extend profil anggota → profil jamaah (passport, porsi, dokumen dasar) |
| 1.4 | **Dashboard Unit** | Overview: total jamaah, total tabungan, booking aktif, keberangkatan mendatang |
| 1.5 | **Navigasi** | Sidebar entry "Haji & Umrah" dengan sub-menu |
| 1.6 | **Constants & Routing** | Register unit baru di `units.ts`, navigation.ts, validations |

**Deliverable:** Operator bisa membuat paket, mendaftarkan jamaah, melihat dashboard.

---

### Phase 2: Tabungan Program & Billing

**Estimasi:** 2 minggu | **Priority:** HIGH

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 2.1 | **Buka Tabungan** | Jamaah buka rekening tabungan Haji/Umrah dengan target amount |
| 2.2 | **Setoran Manual** | Input setoran (cash/bank transfer) → auto-create CBTransaction + journal |
| 2.3 | **Potong Gaji Otomatis** | Integrasi billing/tagihan — setoran bulanan via salary_cut |
| 2.4 | **Tracking Progress** | Progress bar: saldo saat ini vs target, estimasi waktu tercapai |
| 2.5 | **Penarikan / Penutupan** | Penarikan dana (jika batal), penutupan rekening |
| 2.6 | **Auto-complete** | Ketika saldo mencapai target → notifikasi → trigger booking flow |

**Deliverable:** Jamaah bisa menabung, saldo tertracking, integrasi billing untuk potong gaji.

---

### Phase 3: Booking, Dokumen & Keberangkatan

**Estimasi:** 2–3 minggu | **Priority:** HIGH

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 3.1 | **Booking Paket** | Jamaah booking paket, pilih batch keberangkatan |
| 3.2 | **Pembayaran** | DP, cicilan, pelunasan — link ke tabungan atau bayar langsung |
| 3.3 | **Checklist Dokumen** | Upload dokumen per jamaah, verifikasi oleh operator |
| 3.4 | **Status Lifecycle** | Tracking status booking (registered → documents_verified → ... → returned) |
| 3.5 | **Batch Keberangkatan** | Buat batch/grup, assign jamaah ke batch, tracking |
| 3.6 | **Visa & Manasik** | Tracking visa status, jadwal manasik, medical checkup |
| 3.7 | **Member Portal** | Anggota bisa lihat tabungan, booking status, upload dokumen |

**Deliverable:** Full lifecycle dari booking hingga tracking keberangkatan. Portal anggota aktif.

---

### Phase 4: Pembiayaan, SHU & Analytics

**Estimasi:** 1–2 minggu | **Priority:** MEDIUM

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 4.1 | **Pembiayaan/Talangan** | Mirip pinjaman — talangan biaya haji/umrah, cicilan bulanan |
| 4.2 | **SHU Integration** | Revenue unit Haji & Umrah masuk ke SHU calculation |
| 4.3 | **Laporan Revenue** | Revenue per paket, per batch, margin analysis |
| 4.4 | **Export & Print** | Kwitansi setoran, faktur booking, kartu jamaah |
| 4.5 | **Analytics Dashboard** | Tren pendaftaran, tabungan growth, conversion rate |
| 4.6 | **Compliance Report** | SISKOPATUH reporting format, SURI tracking |

**Deliverable:** Pembiayaan aktif, SHU terintegrasi, laporan lengkap.

---

## 8. Files yang Perlu Diubah / Dibuat

### Phase 1 Files

| # | File | Aksi | Deskripsi |
|---|------|------|-----------|
| 1 | `prisma/schema.prisma` | Modify | Tambah 7+ model HajiUmrah |
| 2 | `src/lib/constants/units.ts` | Modify | Tambah entry `haji_umrah` |
| 3 | `src/lib/constants/navigation.ts` | Modify | Tambah navigasi Haji & Umrah |
| 4 | `src/lib/validations/index.ts` | Modify | Tambah validasi HajiUmrah |
| 5 | `src/app/(protected)/haji-umrah/` | Create | Route group baru |
| 6 | `src/app/(protected)/haji-umrah/dashboard/page.tsx` | Create | Dashboard |
| 7 | `src/app/(protected)/haji-umrah/paket/page.tsx` | Create | Manajemen paket |
| 8 | `src/app/(protected)/haji-umrah/jamaah/page.tsx` | Create | Daftar jamaah |
| 9 | `src/app/api/haji-umrah/packages/` | Create | CRUD paket API |
| 10 | `src/app/api/haji-umrah/jamaah/` | Create | CRUD jamaah API |
| 11 | `src/app/api/admin/migrate/route.ts` | Modify | Tambah table creation untuk model baru |

### Phase 2 Files (estimasi)

| # | File | Aksi |
|---|------|------|
| 12 | `src/app/(protected)/haji-umrah/tabungan/page.tsx` | Create |
| 13 | `src/app/api/haji-umrah/savings/` | Create |
| 14 | `src/lib/services/haji-umrah/savings-service.ts` | Create |

### Phase 3 Files (estimasi)

| # | File | Aksi |
|---|------|------|
| 15 | `src/app/(protected)/haji-umrah/pendaftaran/page.tsx` | Create |
| 16 | `src/app/(protected)/haji-umrah/dokumen/page.tsx` | Create |
| 17 | `src/app/(protected)/haji-umrah/keberangkatan/page.tsx` | Create |
| 18 | `src/app/api/haji-umrah/bookings/` | Create |
| 19 | `src/app/api/haji-umrah/documents/` | Create |
| 20 | `src/app/api/haji-umrah/departures/` | Create |
| 21 | `src/app/portal/haji-umrah/` | Create (member portal) |
| 22 | `src/app/api/member-portal/haji-umrah/` | Create |

### Phase 4 Files (estimasi)

| # | File | Aksi |
|---|------|------|
| 23 | `src/app/(protected)/haji-umrah/pembiayaan/page.tsx` | Create |
| 24 | `src/app/(protected)/haji-umrah/laporan/page.tsx` | Create |
| 25 | `src/app/api/haji-umrah/financing/` | Create |
| 26 | `src/app/api/haji-umrah/reports/` | Create |
| 27 | `src/lib/services/shu-calculator.ts` | Modify (tambah unit HajiUmrah income) |

---

## 9. Integrasi dengan Sistem yang Ada

### 9.1 CashBank Integration

Setiap transaksi keuangan (setoran tabungan, DP, pelunasan, refund) harus menciptakan `CashBankTransaction`:

```
HajiUmrahPayment (type: "dp", paymentMethod: "cash")
  → CashBankTransaction (type: "income", category: "pendapatan_unit",
    unitType: "haji_umrah", amount: same, paymentMethod: "cash")
```

### 9.2 Journal / Double-Entry

Setiap transaksi harus posting jurnal:

```
Setoran Tabungan Haji:
  Debit: Kas/Bank (1201)     Rp 1.000.000
  Credit: Tabungan Haji (2xxx)  Rp 1.000.000

DP Booking Umrah:
  Debit: Kas/Bank (1201)     Rp 5.000.000
  Credit: Pendapatan Umrah (41xx) Rp 5.000.000

Pelunasan Booking:
  Debit: Kas/Bank (1201)     Rp 25.000.000
  Credit: Piutang Booking (13xx)  Rp 25.000.000
```

### 9.3 Billing / Tagihan

Potong gaji untuk setoran tabungan bulanan:

```
HajiUmrahSavings.monthlyDeposit → billing generate
  → BillingItem (memberId, amount: monthlyDeposit, description: "Setoran Tabungan Haji/Umrah")
  → billing process → salary_cut → CBTransaction → HajiUmrahSavingsTx
```

### 9.4 SHU Integration

Revenue unit Haji & Umrah masuk ke SHU calculator:

```
CashBankTransaction WHERE type = "income" AND unitType = "haji_umrah"
  → SHU income group "Unit Usaha"
  → SHU distribution ke anggota
```

### 9.5 Member Portal

Tambah section di portal anggota:

```
/portal/haji-umrah
  ├─ Tabungan Saya (progress, riwayat setoran)
  ├─ Booking Aktif (status, dokumen checklist)
  ├─ Riwayat (booking selesai)
  └─ Upload Dokumen
```

---

## 10. Pertanyaan yang Belum Dijawab

Pertanyaan ini perlu diklarifikasi sebelum masuk ke implementation planning per phase:

1. **BSI Integration Depth** — Apakah ada API integration langsung dengan BSI (BEWIZE/BYOND), atau cukup manual input (operator catat setoran dari rekening BSI)?
2. **SISKOHAT/SISKOPATUH** — Apakah perlu API integration, atau cukup tracking manual nomor porsi/SURI?
3. **Pembiayaan Model** — Talangan haji apakah menggunakan model pinjaman yang sudah ada (Loan), atau butuh model terpisah (margin syariah vs bunga)?
4. **Multi-Anggota per Booking** — Apakah 1 booking bisa untuk keluarga (suami+istri+anak), atau 1 jamaah = 1 booking?
5. **Currency** — Paket dalam IDR saja, atau ada yang dalam SAR/USD (Furoda)?
6. **Refund Policy** — Bagaimana aturan refund/cancellation? Apakah ada penalty?
7. **Anggota Non-Polri** — Koperasi melayani umum juga, atau hanya anggota Polri?

---

## 11. Open Items & Risks

| # | Risk | Mitigasi |
|---|------|----------|
| 1 | Scope terlalu besar untuk 1 phase | Phased approach, MVP per phase |
| 2 | BSI API belum tersedia | Mulai dengan manual input, add API layer nanti |
| 3 | Regulasi berubah (PMA) | Keep compliance features feature-flagged |
| 4 | Data migration dari sistem manual | Design import tool di Phase 1 |
| 5 | Perubahan BPIH setiap tahun | Package price must be editable, not hardcoded |
| 6 | Skema bagi hasil syariah vs bunga | Financing model must support both |

---

*Diperbarui: 9 Juni 2026 | Status: Brainstorming — Menunggu approval untuk lanjut ke design spec*
