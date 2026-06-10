# Unit Haji & Umrah — Design Spec: Tabungan & Finance Only

> **Tanggal:** 10 Juni 2026 | **Status:** Approved
> **Pendekatan:** Hybrid (Extend SavingsProduct + UI Khusus)
> **Scope:** Tabungan bertarget + admin fee + potong gaji + export

---

## 1. Konteks & Perubahan dari Planning Awal

### Planning Awal (Full-Service) → Planning Baru (Savings & Finance Only)

| Aspek | Planning Awal | Planning Baru |
|-------|---------------|---------------|
| **Peran Koperasi** | Full-Service (Tabungan + Travel + Financing) | Tabungan & Finance Only |
| **Booking & Travel** | Dikelola koperasi | **Diserahkan ke BSI** |
| **Revenue** | Margin paket + spread + admin fee | **Spread bagi hasil + admin fee** |
| **Compliance** | PPIU/PIHK (Kemenag) | **Tidak perlu** |
| **Model Baru** | 7 model Prisma baru | **0 model baru** (extend 2 model) |
| **Phase** | 4 phase (8-12 minggu) | **1 phase (2-3 minggu)** |
| **Lifecycle Jamaah** | Full (register → docs → visa → depart) | **Tidak ada** (BSI yang handle) |

### Alasan Perubahan

Koperasi PRIMKOPPOL berperan sebagai **savings aggregator** — mengumpulkan tabungan anggota, pooling ke BSI, menghasilkan revenue dari spread bagi hasil dan admin fee. Booking dan travel diserahkan ke BSI sebagai pihak ketiga.

---

## 2. Keputusan Design

| Aspek | Keputusan | Catatan |
|-------|-----------|---------|
| **Pendekatan Arsitektur** | Hybrid — extend SavingsProduct/SavingsAccount + UI/route khusus | Data di model yang ada, UI terpisah |
| **Model Prisma Baru** | Tidak ada — extend 2 model (tambah 8 field) | Minimal migration risk |
| **Tabungan** | Anggota nabung di koperasi, koperasi pooling ke BSI | Dana melewati koperasi |
| **Revenue** | Spread bagi hasil BSI + admin fee per setoran | Flexible, configurable per product |
| **Talangan/Pembiayaan** | Phase 2 — extend LoanProduct yang sudah ada | Reuse infrastructure |
| **Billing** | Extend billing generate untuk support `savings_account` source | Potong gaji otomatis |
| **Member Portal** | Phase 2 — section `/portal/haji-umrah` | Anggota lihat tabungan sendiri |

---

## 3. Data Model Changes

### 3.1 SavingsProduct — Field Baru (5 field)

```prisma
model SavingsProduct {
  // ... existing fields ...
  
  targetAmount       Decimal?  @map("target_amount") @db.Decimal(15, 2)    // Target tabungan (BPIH / biaya paket). Null = tidak bertarget
  adminFeeType       String?   @map("admin_fee_type")                       // "percent" / "fixed" — biaya admin per setoran
  adminFeeValue      Decimal?  @map("admin_fee_value") @db.Decimal(15, 2)  // Nilai admin fee (misal 0.5% atau Rp 5.000)
  linkedBankName     String?   @map("linked_bank_name")                     // "BSI" — bank partner
  allowEarlyWithdraw Boolean   @default(true) @map("allow_early_withdraw") // false untuk tabungan haji/umrah
}
```

**SavingsProduct.type** — tambah nilai: `"tabungan_haji"`, `"tabungan_umrah"`
(Existing types: `"pokok"`, `"wajib"`, `"sukarela"`, `"lainnya"`)

### 3.2 SavingsAccount — Field Baru (3 field)

```prisma
model SavingsAccount {
  // ... existing fields ...
  
  targetAmount Decimal?  @map("target_amount") @db.Decimal(15, 2)  // Override target per-account (jika beda dari product default)
  monthlyTarget Decimal? @map("monthly_target") @db.Decimal(15, 2) // Setoran bulanan yang diharapkan (untuk billing & tracking)
  maturityDate DateTime? @map("maturity_date") @db.Date            // Target tanggal tercapai (estimasi)
}
```

### 3.3 Tidak Ada Model Baru

Total perubahan:
- **SavingsProduct**: +5 field
- **SavingsAccount**: +3 field
- **0 model baru** (dibanding planning awal yang butuh 7 model baru)

### 3.4 Seed Data

Produk tabungan default yang harus di-seed:

| Code | Name | Type | Target | Admin Fee |
|------|------|------|--------|-----------|
| `TH` | Tabungan Haji | `tabungan_haji` | Rp 50.000.000 (BPIH, editable) | 0.5% per setoran |
| `TU` | Tabungan Umrah | `tabungan_umrah` | Rp 25.000.000 (editable) | 0.5% per setoran |

---

## 4. UI & Route Structure

### 4.1 Route Group

```
src/app/(protected)/haji-umrah/
  layout.tsx                              ← Layout dengan sidebar khusus
  page.tsx                                ← Dashboard overview
  tabungan/
    page.tsx                              ← Daftar rekening + progress tracking
    [accountId]/
      page.tsx                            ← Detail rekening: riwayat, progress, kwitansi
      setoran/
        page.tsx                          ← Form setoran
  produk/
    page.tsx                              ← CRUD produk tabungan (SavingsProduct haji/umrah)
  laporan/
    page.tsx                              ← Export laporan: rekap, progress, admin fee
```

### 4.2 API Routes

```
src/app/api/haji-umrah/
  savings/
    route.ts                              ← GET: list tabungan haji/umrah
    [accountId]/
      route.ts                            ← GET: detail + stats
      transactions/
        route.ts                          ← GET/POST: riwayat & setoran baru
  products/
    route.ts                              ← GET/POST: CRUD produk
  reports/
    route.ts                              ← GET: export data laporan
```

### 4.3 Dashboard Components

| Komponen | Data Source |
|----------|-------------|
| Total Tabungan Aktif | Count SavingsAccount where product.type IN (haji, umrah), status=active |
| Total Saldo | Sum balance across all active accounts |
| Target vs Realisasi | Sum targetAmount vs Sum currentBalance — progress global |
| Setoran Bulan Ini | Sum SavingsTransaction where type=deposit, this month |
| Admin Fee Revenue | Sum admin fees collected this month |
| Rekening Baru | Recent 5 accounts opened |
| Mendekati Target | Accounts where balance >= 80% of targetAmount |

### 4.4 Key UI Features

1. **Progress Bar per Rekening** — saldo saat ini vs target, persentase tercapai
2. **Setoran Form** — input amount + paymentMethod, auto-calculate admin fee
3. **Kwitansi Setoran** — template khusus haji/umrah via `export-utils.ts`
4. **Export Excel/PDF** — rekap tabungan per periode, per anggota, per jenis
5. **Notifikasi Target** — alert ketika saldo >= 90% targetAmount

---

## 5. Billing & Revenue Flow

### 5.1 Alur Setoran Manual (Cash / Transfer)

```
Admin input setoran di /haji-umrah/tabungan/[accountId]/setoran
  → Atomic prisma.$transaction:
    1. Create SavingsTransaction (type: deposit, amount)
       → auto-update SavingsAccount.balance
    2. Create CashBankTransaction (type: in, category: "savings",
       unitType: "simpan_pinjam", amount, paymentMethod)
    3. IF admin fee > 0:
       → Create CashBankTransaction (type: in, category: "pendapatan_unit",
         unitType: "haji_umrah", amount: adminFee)   ← revenue koperasi
    4. Update CashBankAccount.currentBalance
  → IF balanceAfter >= targetAmount:
    → Flag: "Tabungan telah mencapai target!"
```

### 5.2 Alur Potong Gaji Otomatis (via Billing)

```
Billing Generate (period 16th → 15th):
  → Scan SavingsAccount where product.type IN ('tabungan_haji','tabungan_umrah')
    AND monthlyTarget IS NOT NULL AND status = 'active'
  → Create BillingItem per account:
    → amount = monthlyTarget
    → transactionSource = 'savings_account'   ← NEW source type
    → unitType = 'haji_umrah'
    → description = "Setoran Tabungan [Haji/Umrah] - [memberName]"

Billing Settlement:
  → Admin marks items as paid
  → Process → CashBankTransaction (salary_cut_settlement)
  → ALSO create SavingsTransaction (deposit) per settled item
  → Update SavingsAccount.balance
```

**Perubahan billing:** Tambah support `transactionSource: 'savings_account'` (saat ini hanya `unit_transaction` dan `store_sale`).

### 5.3 Revenue Sources

| Revenue | Source | CashBank Category | unitType |
|---------|--------|-------------------|----------|
| Admin Fee | Per setoran (configurable per product) | `pendapatan_unit` | `haji_umrah` |
| Spread Bagi Hasil | Selisih bagi hasil BSI vs anggota (manual input) | `pendapatan_unit` | `haji_umrah` |

### 5.4 SHU Integration

Revenue otomatis masuk ke SHU calculator karena `CashBankTransaction` dengan `unitType: "haji_umrah"` dan `type: "in"` sudah ter-cover oleh query SHU income.

---

## 6. Implementation Plan

### Phase 1A: Data Layer (3-4 hari)

| # | File | Aksi |
|---|------|------|
| 1 | `prisma/schema.prisma` | Modify — tambah 8 field ke SavingsProduct + SavingsAccount |
| 2 | `prisma/seed-savings-products.ts` | Create — seed produk tabungan haji & umrah |
| 3 | Schema push via `npm run db:push` | Run |

### Phase 1B: API Layer (3-4 hari)

| # | File | Aksi |
|---|------|------|
| 4 | `src/app/api/haji-umrah/savings/route.ts` | Create |
| 5 | `src/app/api/haji-umrah/savings/[accountId]/route.ts` | Create |
| 6 | `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | Create |
| 7 | `src/app/api/haji-umrah/products/route.ts` | Create |
| 8 | `src/app/api/haji-umrah/reports/route.ts` | Create |

### Phase 1C: UI Layer (5-6 hari)

| # | File | Aksi |
|---|------|------|
| 9 | `src/app/(protected)/haji-umrah/layout.tsx` | Create |
| 10 | `src/app/(protected)/haji-umrah/page.tsx` | Create |
| 11 | `src/app/(protected)/haji-umrah/tabungan/page.tsx` | Create |
| 12 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` | Create |
| 13 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` | Create |
| 14 | `src/app/(protected)/haji-umrah/produk/page.tsx` | Create |
| 15 | `src/app/(protected)/haji-umrah/laporan/page.tsx` | Create |

### Phase 1D: Integration (2-3 hari)

| # | File | Aksi |
|---|------|------|
| 16 | `src/lib/constants/units.ts` | Modify — tambah `haji_umrah` |
| 17 | `src/lib/constants/navigation.ts` | Modify — tambah menu |
| 18 | `src/lib/validations/haji-umrah.ts` | Create — Zod schemas |
| 19 | `src/app/api/billing/generate/route.ts` | Modify — support `savings_account` source |
| 20 | `src/app/api/admin/migrate/route.ts` | Modify — add new columns |
| 21 | `src/lib/services/shu-calculator.ts` | Verify — `haji_umrah` unitType covered |

### Total: 21 file, ~14-17 hari kerja

---

## 7. Phase 2 Roadmap (Mendatang)

| Fitur | Pendekatan | Estimasi |
|-------|------------|----------|
| Talangan Haji/Umrah | Extend `LoanProduct` dengan `type: "talangan_haji"`, reuse Loan infrastructure | 1-2 minggu |
| Gap Financing | Auto-calculate `targetAmount - currentBalance` | 2-3 hari |
| Member Portal | Section `/portal/haji-umrah` — anggota lihat tabungan sendiri | 3-5 hari |
| Spread Bagi Hasil Input | Admin input bagi hasil dari BSI per periode | 2-3 hari |

---

## 8. Files yang Tidak Diperlukan Lagi (dari planning awal)

Model/komponen berikut dari planning awal (Full-Service) **tidak diperlukan**:

| Model/Route | Alasan |
|-------------|--------|
| `HajiUmrahPackage` | Booking/travel diserahkan ke BSI |
| `HajiUmrahJamaah` | Lifecycle jamaah tidak dikelola koperasi |
| `HajiUmrahBooking` | Booking diserahkan ke BSI |
| `HajiUmrahPayment` | Reuse SavingsTransaction |
| `HajiUmrahDocument` | Dokumen dikelola BSI |
| `HajiUmrahDeparture` | Keberangkatan dikelola BSI |
| `/haji-umrah/pendaftaran/` | Booking diserahkan ke BSI |
| `/haji-umrah/dokumen/` | Dokumen dikelola BSI |
| `/haji-umrah/keberangkatan/` | Keberangkatan dikelola BSI |
| Compliance (SISKOHAT/SISKOPATUH) | Koperasi bukan travel agency |
