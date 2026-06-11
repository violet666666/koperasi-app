# Unit Haji & Umrah — Planning Document

> **Status:** Phase 1 COMPLETE ✅ | **Dibuat:** 9 Juni 2026 | **Updated:** 11 Juni 2026 | **Branch:** railway-migration
> **Partnership:** MOU dengan Bank BSI (Bank Syariah Indonesia)
> **Implementation:** 26 files, ~2,900 lines, 20/20 E2E tests passing

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

### Phase 1: Tabungan ✅ COMPLETE (11 Juni 2026)

> **8 commits** | **26 files** | **~2,900 lines** | **20/20 E2E tests passing**
> Tested with: `operator@koperasi.com` / `password123`

#### 1A: Data Layer ✅

| # | File | Aksi | Commit |
|---|------|------|--------|
| 1 | `prisma/schema.prisma` | ✅ Modify — tambah 8 field (5 SavingsProduct + 3 SavingsAccount) | `0eac197` |
| 2 | `prisma/seed.ts` | ✅ Modify — tambah TH/TU products + GL mapping | `0eac197` |
| 3 | `src/app/api/admin/migrate/route.ts` | ✅ Modify — idempotent column migration | `0eac197` |
| 4 | Schema push to NeonDB | ✅ Run — `prisma db push` synced successfully | `0eac197` |

#### 1B: API Layer ✅

| # | File | Aksi | Commit |
|---|------|------|--------|
| 5 | `src/app/api/haji-umrah/products/route.ts` | ✅ GET list + POST create | `3c60a39` |
| 6 | `src/app/api/haji-umrah/products/[productId]/route.ts` | ✅ PUT update | `3c60a39` |
| 7 | `src/app/api/haji-umrah/savings/route.ts` | ✅ GET list with progress + POST buka rekening | `3c60a39` |
| 8 | `src/app/api/haji-umrah/savings/[accountId]/route.ts` | ✅ GET detail + stats | `3c60a39` |
| 9 | `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | ✅ GET riwayat + POST setoran with atomic CashBank + admin fee | `3c60a39` |
| 10 | `src/app/api/haji-umrah/reports/route.ts` | ✅ GET rekap + progress + admin_fee revenue | `3c60a39`, fixed `15004ea` |

#### 1C: UI Layer ✅

| # | File | Aksi | Commit |
|---|------|------|--------|
| 11 | `src/app/(protected)/haji-umrah/layout.tsx` | ✅ Passthrough layout | `521bd17` |
| 12 | `src/app/(protected)/haji-umrah/page.tsx` | ✅ Dashboard — 6 stat cards + target alert + quick links | `521bd17` |
| 13 | `src/app/(protected)/haji-umrah/tabungan/page.tsx` | ✅ Listing + progress bars + buka rekening dialog | `521bd17` |
| 14 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` | ✅ Detail + stats + riwayat + kwitansi print | `521bd17` |
| 15 | `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` | ✅ Setoran form + admin fee preview | `521bd17` |
| 16 | `src/app/(protected)/haji-umrah/produk/page.tsx` | ✅ CRUD produk (create + edit) | `521bd17` |
| 17 | `src/app/(protected)/haji-umrah/laporan/page.tsx` | ✅ Export Excel/PDF + summary cards | `521bd17` |

#### 1D: Integration ✅

| # | File | Aksi | Commit |
|---|------|------|--------|
| 18 | `src/lib/constants/units.ts` | ✅ Added `haji_umrah` (Landmark icon, service) | `7de4647` |
| 19 | `src/lib/constants/index.ts` | ✅ Added `tabungan_haji` + `tabungan_umrah` types | `7de4647` |
| 20 | `src/lib/constants/navigation.ts` | ✅ Added HAJI & UMRAH sidebar group (operator) | `7de4647` |
| 21 | `src/app/(protected)/layout.tsx` | ✅ Added `haji_umrah` route guard for admin | `7de4647` |
| 22 | `src/lib/validations/haji-umrah.ts` | ✅ 4 Zod schemas (account, setoran, product create/update) | `7de4647` |
| 23 | `src/lib/validations/index.ts` | ✅ Extended SavingsProduct type enum + haji/umrah fields | `7de4647` |
| 24 | `src/app/api/billing/generate/route.ts` | ✅ Source 3: savings_account with monthlyTarget | `7de4647` |
| 25 | `src/app/api/billing/[periodId]/process/route.ts` | ✅ Settlement: SavingsTransaction + balance update | `7de4647` |
| 26 | `src/lib/services/shu-calculator.ts` | ✅ Verified — `haji_umrah` auto-covered via groupBy | (no changes) |

#### Security & Bug Fixes ✅

| Commit | Fix |
|--------|-----|
| `4febb77` | `Math.random()` → `crypto.randomBytes(4)` with 9-digit space (1 billion) |
| `15004ea` | Prisma aggregate() doesn't support relation filters — two-step query |
| `4baca42` | Formula injection fix — sanitize leading `=+@-` in Excel export |
| `a786521` | Lint: remove unused import, eslint-disable for intentional dep |

**Deliverable:** ✅ Operator bisa buat produk tabungan, buka rekening, terima setoran, tracking progress, potong gaji, export laporan. Semua terverifikasi via 20 E2E tests.

---

### Phase 2B: Talangan Haji/Umrah 🔲 Pending (~1-2 minggu)

| # | Fitur | Pendekatan | Estimasi |
|---|-------|------------|----------|
| 1 | Extend `LoanProduct` | Tambah `type: "talangan_haji"`, reuse Loan infra | 2-3 hari |
| 2 | Gap Financing | Auto-calculate `targetAmount - currentBalance` = jumlah pinjaman | 1 hari |
| 3 | UI pengajuan talangan | `/haji-umrah/talangan` — form + approval flow | 3-5 hari |
| 4 | Integrasi angsuran | Auto-debet dari tabungan saat cicilan jatuh tempo | 2-3 hari |

### Phase 3: Member Portal 🔲 Pending (~3-5 hari)

| # | Fitur | Pendekatan | Estimasi |
|---|-------|------------|----------|
| 1 | Portal section | `/portal/haji-umrah` — anggota lihat tabungan sendiri | 2-3 hari |
| 2 | Progress tracker | Visualisasi progress ke target per anggota | 1-2 hari |
| 3 | Riwayat setoran | History setoran milik anggota yang login | 1 hari |

### Phase 4: Spread Bagi Hasil 🔲 Pending (~2-3 hari)

| # | Fitur | Pendekatan | Estimasi |
|---|-------|------------|----------|
| 1 | Admin input | Form input bagi hasil dari BSI per periode | 1-2 hari |
| 2 | Distribusi spread | Otomatis selisih bagi hasil BSI vs yang diberikan ke anggota | 1 hari |

### Phase 5: Mobile App Integration 🔲 Pending (~3-5 hari)

| # | Fitur | Pendekatan | Estimasi |
|---|-------|------------|----------|
| 1 | Mobile API | `/api/mobile/haji-umrah/*` endpoints | 2-3 hari |
| 2 | Mobile screens | Tabungan, detail, setoran di Expo app | 3-5 hari |
| 3 | Push notification | Alert saat target mendekati/tercapai | 1-2 hari |

## 7. Files yang Diubah / Dibuat

### Phase 1 — Total: 26 file ✅ COMPLETE

**Modified (8 files):**
1. `prisma/schema.prisma` — +8 nullable fields + BillingItem comment
2. `prisma/seed.ts` — +TH/TU products + GL mapping
3. `src/app/api/admin/migrate/route.ts` — +8 column migrations
4. `src/lib/constants/units.ts` — +haji_umrah entry
5. `src/lib/constants/index.ts` — +tabungan_haji/umrah types
6. `src/lib/constants/navigation.ts` — +HAJI & UMRAH sidebar group
7. `src/app/api/billing/generate/route.ts` — +Source 3 savings_account
8. `src/app/api/billing/[periodId]/process/route.ts` — +savings_account settlement
9. `src/lib/validations/index.ts` — +extended enum + haji/umrah fields
10. `src/app/(protected)/layout.tsx` — +haji_umrah route guard

**Created (16 files):**
11. `src/app/api/haji-umrah/products/route.ts`
12. `src/app/api/haji-umrah/products/[productId]/route.ts`
13. `src/app/api/haji-umrah/savings/route.ts`
14. `src/app/api/haji-umrah/savings/[accountId]/route.ts`
15. `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts`
16. `src/app/api/haji-umrah/reports/route.ts`
17. `src/app/(protected)/haji-umrah/layout.tsx`
18. `src/app/(protected)/haji-umrah/page.tsx`
19. `src/app/(protected)/haji-umrah/tabungan/page.tsx`
20. `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx`
21. `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx`
22. `src/app/(protected)/haji-umrah/produk/page.tsx`
23. `src/app/(protected)/haji-umrah/laporan/page.tsx`
24. `src/lib/validations/haji-umrah.ts`
25. `e2e/haji-umrah.spec.ts` — basic E2E (8 tests)
26. `e2e/haji-umrah-full.spec.ts` — full flow E2E (12 tests)

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

*Diperbarui: 11 Juni 2026 | Status: Phase 1 COMPLETE ✅ — 20/20 E2E tests passing, Phase 2-5 pending*
