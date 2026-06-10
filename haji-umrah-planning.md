# Unit Haji & Umrah — Planning Document

> **Status:** Approved Design | **Dibuat:** 9 Juni 2026 | **Updated:** 10 Juni 2026 | **Branch:** railway-migration
> **Partnership:** MOU dengan Bank BSI (Bank Syariah Indonesia)
> **Design Spec:** `docs/superpowers/specs/2026-06-10-haji-umrah-savings-only-design.md`

---

## 1. Latar Belakang

Koperasi PRIMKOPPOL memiliki MOU dengan Bank BSI untuk menyediakan layanan tabungan Haji dan Umrah kepada anggota. **Peran koperasi adalah sebagai Savings & Finance** — mengelola tabungan haji/umrah anggota dan talangan/pembiayaan. Booking dan travel diserahkan ke pihak ketiga (BSI).

### Model Bisnis: Tabungan & Finance Only

| Aspek | Detail |
|-------|--------|
| **Peran Koperasi** | Tabungan (savings aggregator) + Finance (talangan Phase 2) |
| **Booking & Travel** | Diserahkan ke BSI (Bank Syariah Indonesia) |
| **Revenue** | Spread bagi hasil BSI + admin fee per setoran |
| **Regulasi** | Internal koperasi — tidak perlu PPIU/PIHK |
| **Anggota** | Menabung di koperasi → koperasi pooling ke BSI |

### Perbedaan dengan Unit yang Ada

| Aspek | Unit Saat Ini (Toko, Resto, dll) | Unit Haji & Umrah |
|-------|----------------------------------|--------------------|
| Transaksi | POS — bayar → selesai | Tabungan bertarget — setor bulanan → tracking progress |
| Durasi | Detik/menit | Bulan/tahun |
| Data Model | StoreSale / UnitTransaction | SavingsAccount (extended) + SavingsTransaction |
| Revenue | Margin penjualan langsung | Spread bagi hasil + admin fee |
| Partner | — | Bank BSI |

---

## 2. Keputusan Requirements

| Aspek | Keputusan | Catatan |
|-------|-----------|---------|
| **Peran Koperasi** | Tabungan & Finance Only | Booking/travel diserahkan ke BSI |
| **Pendekatan Arsitektur** | Hybrid (Extend Savings + UI Khusus) | Reuse model yang ada, route terpisah |
| **Model Prisma Baru** | 0 — extend SavingsProduct + SavingsAccount | Tambah 8 field, 0 model baru |
| **Tabungan** | Anggota nabung di koperasi, pooling ke BSI | Dana melewati koperasi |
| **Revenue** | Spread bagi hasil + admin fee per setoran | Flexible, configurable per product |
| **Talangan/Pembiayaan** | Phase 2 — extend LoanProduct | Reuse infrastructure |
| **Scope** | Phase 1: Tabungan. Phase 2: Talangan + Portal | Build incrementally |

---

## 3. Model Bisnis — Revenue Streams

### 3.1 Revenue Sources

| Sumber | Deskripsi | Config |
|--------|-----------|--------|
| **Admin Fee** | Biaya administrasi per setoran | `SavingsProduct.adminFeeType` + `adminFeeValue` |
| **Spread Bagi Hasil** | Selisih bagi hasil BSI vs yang diberikan ke anggota | Manual input oleh admin (BSI belum ada API) |
| **Talangan (Phase 2)** | Margin pembiayaan / talangan haji | Extend LoanProduct |

### 3.2 Partnership BSI — Peran

| Aspek | Koperasi | BSI |
|-------|----------|-----|
| Tabungan | Kelola rekening, terima setoran, tracking progress | Pooling dana, bayar bagi hasil |
| Booking & Travel | Tidak terlibat | Mengelola booking, paket, keberangkatan |
| Pembiayaan | Talangan internal (Phase 2) | Talangan Haji BSI (produk sendiri) |
| Compliance | Internal koperasi | BPS BPIH, SISKOHAT |

---

## 4. Arsitektur — Hybrid Approach

### 4.1 Konsep

Buat module `/haji-umrah/*` dengan **route dan UI sendiri**, tapi **data disimpan di model Simpanan yang sudah ada** (SavingsProduct + SavingsAccount + SavingsTransaction). Reuse infrastruktur CashBank, billing, journal.

### 4.2 Data Layer

```
SavingsProduct (existing, extended):
  + targetAmount       Decimal?    — target tabungan (null = tidak bertarget)
  + adminFeeType       String?     — "percent" / "fixed"
  + adminFeeValue      Decimal?    — nilai admin fee
  + linkedBankName     String?     — "BSI"
  + allowEarlyWithdraw Boolean     — false untuk haji/umrah
  type: tambah "tabungan_haji", "tabungan_umrah"

SavingsAccount (existing, extended):
  + targetAmount  Decimal?   — override target per-account
  + monthlyTarget Decimal?   — setoran bulanan target (untuk billing)
  + maturityDate  DateTime?  — target tanggal tercapai

SavingsTransaction (unchanged):
  Setoran & penarikan tetap pakai model ini
  CashBankTransaction auto-create tetap jalan
```

### 4.3 Route Structure

```
src/app/(protected)/haji-umrah/
  layout.tsx                — Layout dengan sidebar khusus
  page.tsx                  — Dashboard: overview stats, progress
  tabungan/
    page.tsx                — Daftar rekening + progress tracking
    [accountId]/
      page.tsx              — Detail rekening: riwayat, progress, kwitansi
      setoran/
        page.tsx            — Form setoran
  produk/
    page.tsx                — CRUD produk tabungan
  laporan/
    page.tsx                — Export laporan

src/app/api/haji-umrah/
  savings/
    route.ts                — GET: list tabungan
    [accountId]/
      route.ts              — GET: detail
      transactions/
        route.ts            — GET/POST: riwayat & setoran
  products/
    route.ts                — GET/POST: CRUD produk
  reports/
    route.ts                — GET: export
```

---

## 5. Cash Flow & Integration

### 5.1 Alur Setoran

```
[1] Admin input setoran
    → prisma.$transaction:
      ├─ SavingsTransaction (type: deposit, amount)
      │  → update SavingsAccount.balance
      ├─ CashBankTransaction (type: in, category: "savings")
      ├─ IF admin fee > 0:
      │  → CashBankTransaction (type: in, category: "pendapatan_unit",
      │    unitType: "haji_umrah", amount: adminFee)
      └─ Update CashBankAccount.currentBalance

[2] Progress check
    → IF balanceAfter >= targetAmount:
      → Flag: "Tabungan telah mencapai target!"
```

### 5.2 Potong Gaji Otomatis (Billing)

```
Billing Generate (16th → 15th):
  → Scan SavingsAccount where product.type IN ('tabungan_haji','tabungan_umrah')
    AND monthlyTarget IS NOT NULL AND status = 'active'
  → Create BillingItem:
    → transactionSource = 'savings_account' (NEW)
    → amount = monthlyTarget

Billing Settlement:
  → Create CashBankTransaction (salary_cut_settlement)
  → Create SavingsTransaction (deposit)
  → Update SavingsAccount.balance
```

### 5.3 SHU Integration

Revenue otomatis masuk SHU: `CashBankTransaction WHERE type = "in" AND unitType = "haji_umrah"`.

---

## 6. Phased Implementation Plan

### Phase 1: Tabungan (Current — ~14-17 hari)

#### 1A: Data Layer (3-4 hari)

| # | File | Aksi |
|---|------|------|
| 1 | `prisma/schema.prisma` | Modify — tambah 8 field |
| 2 | `prisma/seed-savings-products.ts` | Create — seed produk |
| 3 | Schema push | Run |

#### 1B: API Layer (3-4 hari)

| # | File | Aksi |
|---|------|------|
| 4 | `src/app/api/haji-umrah/savings/route.ts` | Create |
| 5 | `src/app/api/haji-umrah/savings/[accountId]/route.ts` | Create |
| 6 | `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | Create |
| 7 | `src/app/api/haji-umrah/products/route.ts` | Create |
| 8 | `src/app/api/haji-umrah/reports/route.ts` | Create |

#### 1C: UI Layer (5-6 hari)

| # | File | Aksi |
|---|------|------|
| 9 | `src/app/(protected)/haji-umrah/layout.tsx` | Create |
| 10 | `src/app/(protected)/haji-umrah/page.tsx` | Create |
| 11 | `src/app/(protected)/haji-umrah/tabungan/page.tsx` | Create |
| 12 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` | Create |
| 13 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` | Create |
| 14 | `src/app/(protected)/haji-umrah/produk/page.tsx` | Create |
| 15 | `src/app/(protected)/haji-umrah/laporan/page.tsx` | Create |

#### 1D: Integration (2-3 hari)

| # | File | Aksi |
|---|------|------|
| 16 | `src/lib/constants/units.ts` | Modify — tambah `haji_umrah` |
| 17 | `src/lib/constants/navigation.ts` | Modify — tambah menu |
| 18 | `src/lib/validations/haji-umrah.ts` | Create — Zod schemas |
| 19 | `src/app/api/billing/generate/route.ts` | Modify — support `savings_account` |
| 20 | `src/app/api/admin/migrate/route.ts` | Modify — add columns |
| 21 | `src/lib/services/shu-calculator.ts` | Verify — `haji_umrah` covered |

**Deliverable:** Operator bisa buat produk tabungan, buka rekening, terima setoran, tracking progress, potong gaji, export laporan.

---

### Phase 2: Talangan + Member Portal (Mendatang)

| Fitur | Pendekatan | Estimasi |
|-------|------------|----------|
| Talangan Haji/Umrah | Extend `LoanProduct` type `"talangan_haji"`, reuse Loan infra | 1-2 minggu |
| Gap Financing | Auto-calculate `targetAmount - currentBalance` | 2-3 hari |
| Member Portal | `/portal/haji-umrah` — anggota lihat tabungan | 3-5 hari |
| Spread Bagi Hasil | Admin input bagi hasil BSI per periode | 2-3 hari |

---

## 7. Files yang Perlu Diubah / Dibuat

### Phase 1 — Total: 21 file

**Modify (6 files):**
1. `prisma/schema.prisma`
2. `src/lib/constants/units.ts`
3. `src/lib/constants/navigation.ts`
4. `src/app/api/billing/generate/route.ts`
5. `src/app/api/admin/migrate/route.ts`
6. `src/lib/services/shu-calculator.ts` (verify only)

**Create (15 files):**
7. `prisma/seed-savings-products.ts`
8-12. 5 API route files
13-19. 7 UI page files
20. `src/lib/validations/haji-umrah.ts`
21. (1 additional as needed)

---

## 8. Risk & Mitigasi

| # | Risk | Mitigasi |
|---|------|----------|
| 1 | Field baru di SavingsProduct tidak flexible cukup | Semua field nullable — tidak affect produk simpanan lain |
| 2 | Billing generate perlu extend untuk `savings_account` source | Perubahan minimal — tambah 1 branch di generate logic |
| 3 | BSI API belum tersedia | Spread bagi hasil di-input manual oleh admin |
| 4 | Revenue model belum pasti | Admin fee configurable per product — bisa adjust kapanpun |
| 5 | Anggota ingin lihat tabungan sendiri (Phase 2) | Member portal section sudah di-roadmap |

---

*Diperbarui: 10 Juni 2026 | Status: Approved — Ready for Implementation Planning*
