# Talangan Haji/Umrah — Design Spec

> **Tanggal:** 12 Juni 2026 | **Status:** Draft — Pending Approval
> **Pendekatan:** Hybrid — Reuse Loan infrastructure + H&U wrapper API
> **Prasyarat:** Phase 1 (Tabungan) COMPLETE
> **Estimasi:** 5-7 hari kerja | ~18 file | ~2.500-3.000 baris

---

## 1. Konteks

Atasan menginformasikan: "Unit ini akan mengelola umrah dan hajinya serta ada fitur talangan juga." Talangan adalah **gap financing** — ketika saldo tabungan anggota belum mencapai target BPIH/biaya paket, koperasi membiayai selisihnya sebagai pinjaman.

### Keputusan Bisnis

| Aspek | Keputusan |
|-------|-----------|
| **Alur** | Keduanya — anggota bisa request & admin bisa auto-create. Approval untuk amount > Rp 10 juta. |
| **Bunga/Margin** | Flexible — configurable per produk (flat/margin/annuity) |
| **Repayment** | Flexible — potong gaji via billing atau bayar sendiri |
| **Pendekatan Teknis** | Hybrid C — Reuse Loan infra 90% + H&U wrapper API + gap-aware UX |

### Mengapa Hybrid?

- Infrastruktur pinjaman (LoanProduct → LoanApplication → Loan → LoanSchedule → LoanPayment) sudah production-tested dengan 45+ API routes
- Talangan butuh konteks tabungan (gap calculator, linked account) yang tidak ada di loan API generic
- Wrapper API tipis (~5 files) memberikan UX yang context-aware tanpa duplikasi logic

---

## 2. Data Layer — Schema Changes

### 2.1 LoanProduct — Tambah `type` (1 field)

```prisma
model LoanProduct {
  // ... existing 24 fields ...

  type  String?  @map("type")  // "reguler" | "talangan_haji" | "talangan_umrah"
}
```

- **Nullable** — backward compatible. Null = reguler by convention.
- **Tidak perlu data migration** — semua produk yang sudah ada dianggap "reguler".

### 2.2 LoanApplication — Tambah `linkedSavingsAccountId` (1 field)

```prisma
model LoanApplication {
  // ... existing fields ...

  linkedSavingsAccountId  Int?     @map("linked_savings_account_id")
  linkedSavingsAccount    SavingsAccount?  @relation(fields: [linkedSavingsAccountId], references: [id])
}
```

### 2.3 Loan — Tambah `linkedSavingsAccountId` (1 field, denormalized)

```prisma
model Loan {
  // ... existing fields ...

  linkedSavingsAccountId  Int?     @map("linked_savings_account_id")
  linkedSavingsAccount    SavingsAccount?  @relation(fields: [linkedSavingsAccountId], references: [id])
}
```

**Kenapa denormalisasi?** LoanApplication bisa rejected/cancelled, tapi Loan adalah permanent record. Link harus tetap ada meskipun application sudah tidak relevan. Pattern sama dengan `productSnapshot`.

### 2.4 Seed Data — 2 Produk Talangan

| Code | Name | Type | Min Amount | Max Amount | Rate | Tenor | Admin Fee |
|------|------|------|-----------|-----------|------|-------|-----------|
| `TLH` | Talangan Haji | `talangan_haji` | 1,000,000 | 50,000,000 | 0.5%/bln flat | 6-36 bln | 1% |
| `TLU` | Talangan Umrah | `talangan_umrah` | 500,000 | 25,000,000 | 0.5%/bln flat | 3-24 bln | 1% |

### 2.5 Total Perubahan

- **+3 field** di schema (LoanProduct.type, LoanApplication.linkedSavingsAccountId, Loan.linkedSavingsAccountId)
- **0 model baru**
- **+2 produk seed** (TLH, TLU)

---

## 3. API Layer — Wrapper Endpoints

Semua di bawah `/api/haji-umrah/talangan/`. Wrapper tipis yang memanfaatkan infrastruktur Pinjaman.

### 3.1 Struktur Route

```
src/app/api/haji-umrah/talangan/
  route.ts                              ← GET: daftar talangan + stats
  gap/route.ts                          ← GET: kalkulasi gap per rekening
  apply/route.ts                        ← POST: buat pengajuan + auto-disburse
  products/route.ts                     ← GET: daftar produk talangan
  [applicationId]/route.ts              ← GET: detail pengajuan talangan
```

### 3.2 GET /api/haji-umrah/talangan — Daftar Talangan + Stats

**Response:**
```json
{
  "stats": {
    "totalActive": 5,
    "totalOutstanding": 45000000,
    "paidThisMonth": 3500000,
    "gapDetected": 3
  },
  "data": [
    {
      "loanId": 42,
      "loanNo": "PJM-2026-00042",
      "memberName": "A'AN ANDRIONO",
      "productType": "talangan_haji",
      "principalAmount": 10000000,
      "outstanding": 8500000,
      "status": "active",
      "savingsAccountNo": "HU-776-10-1715",
      "gap": 10000000,
      "tenorMonths": 12,
      "monthlyInstallment": 883333
    }
  ]
}
```

**Query params:** `?status=active|paid_off|all`, `?type=talangan_haji|talangan_umrah`, `?search=memberName`, `?page=1&perPage=20`

### 3.3 GET /api/haji-umrah/talangan/gap — Gap Calculator

**Response:**
```json
{
  "data": [
    {
      "accountId": 15,
      "accountNo": "HU-776-10-1715",
      "memberName": "A'AN ANDRIONO",
      "productType": "tabungan_haji",
      "balance": 1000000,
      "targetAmount": 50000000,
      "gap": 49000000,
      "progress": 2.0,
      "hasActiveTalangan": false,
      "activeTalanganId": null,
      "status": "needs_talangan"
    }
  ],
  "summary": {
    "totalAccounts": 10,
    "withGap": 7,
    "coveredByTalangan": 2,
    "targetReached": 1
  }
}
```

**Query params:** `?onlyWithGap=true`, `?productType=tabungan_haji`

**Status values:** `needs_talangan` | `has_talangan` | `target_reached` | `no_target`

**Logika:**
1. Ambil semua SavingsAccount aktif dimana product.type IN (tabungan_haji, tabungan_umrah)
2. Hitung gap = max(0, targetAmount - currentBalance)
3. Cek Loan aktif where linkedSavingsAccountId = accountId
4. Klasifikasi: gap > 0 & no talangan → "needs_talangan"

### 3.4 POST /api/haji-umrah/talangan/apply — Buat Pengajuan

**Request:**
```json
{
  "savingsAccountId": 15,
  "productId": 8,
  "amount": 10000000,
  "tenorMonths": 12,
  "deductionSource": "gaji",
  "cashBankAccountId": 1,
  "notes": "Talangan haji - gap 49jt",
  "autoDisburse": false
}
```

**Validasi:**
1. SavingsAccount harus aktif
2. LoanProduct.type harus IN (talangan_haji, talangan_umrah)
3. **Type matching:** tabungan_haji hanya pakai talangan_haji, tabungan_umrah hanya pakai talangan_umrah
4. amount <= gap (tidak boleh melebihi kekurangan)
5. amount dalam range produk minAmount - maxAmount
6. tenor dalam range produk minTenorMonths - maxTenorMonths
7. Tidak ada talangan aktif yang sudah ada untuk rekening ini

**Mode Auto-Disburse (threshold Rp 10.000.000):**
```
IF amount <= 10.000.000 OR roleName === "operator":
  → Create LoanApplication (status: "approved")
  → Auto-call disburse logic: create Loan + LoanSchedule + CashBankTransaction
  → Return { loanId, applicationId }
ELSE:
  → Create LoanApplication (status: "submitted")
  → Return { applicationId, status: "submitted" }
  → Admin approve via /api/loans/applications/[id]/approve
  → Admin disburse via /api/loans/applications/[id]/disburse
```

### 3.5 GET /api/haji-umrah/talangan/products — Produk Talangan

**Query:** `SELECT LoanProduct WHERE type IN ('talangan_haji', 'talangan_umrah') AND isActive = true`

Simple dropdown data. Dengan filter `?type=talangan_haji` jika hanya butuh satu jenis.

### 3.6 GET /api/haji-umrah/talangan/[applicationId] — Detail Talangan

**Response:** Full detail termasuk:
- LoanApplication data + status history
- Jika sudah disburse: Loan data + outstanding + payment summary
- LoanSchedule list (jadwal angsuran)
- LoanPayment history (riwayat bayar)
- Linked SavingsAccount info (saldo, target, progress)

### 3.7 Reuse — Endpoint yang Tidak Perlu Baru

| Operasi | Endpoint | Status |
|---------|----------|--------|
| Approve | `POST /api/loans/applications/[id]/approve` | ✅ Reuse |
| Reject | `POST /api/loans/applications/[id]/reject` | ✅ Reuse |
| Disburse | `POST /api/loans/applications/[id]/disburse` | ✅ Reuse (+1 baris copy linkedSavingsAccountId) |
| Bayar angsuran | `POST /api/loans/[id]/payments` | ✅ Reuse |
| Void pinjaman | `POST /api/loans/[id]/void` | ✅ Reuse |
| Void pembayaran | `POST /api/loans/[id]/payments/[paymentId]/void` | ✅ Reuse |

### 3.8 Validation Schema

```typescript
// src/lib/validations/haji-umrah.ts — tambah:

export const createTalanganSchema = z.object({
  savingsAccountId: z.number().int().positive(),
  productId: z.number().int().positive(),
  amount: z.number().positive(),
  tenorMonths: z.number().int().min(1).max(60),
  deductionSource: z.enum(["gaji", "tunkin", "bs"]).default("gaji"),
  cashBankAccountId: z.number().int().positive().optional(),
  notes: z.string().optional(),
  autoDisburse: z.boolean().default(false),
});
```

---

## 4. UI Layer

### 4.1 Route Structure

```
src/app/(protected)/haji-umrah/
  talungan/
    page.tsx                           ← Daftar + gap overview
    apply/page.tsx                     ← Multi-step form
    [applicationId]/page.tsx           ← Detail + jadwal + riwayat
```

### 4.2 /haji-umrah/talangan — Daftar Talangan

**Layout:** Stats cards + tabbed data table

**Stats Cards (4):**

| Kartu | Data Source |
|-------|-------------|
| Total Talangan Aktif | Count Loan where type=talangan_* and status=active |
| Total Outstanding | Sum principalOutstanding |
| Angsuran Bulan Ini | Sum LoanPayment this month |
| Gap Terdeteksi | Count SavingsAccount where gap > 0 AND no active talangan |

**Tabs:**

| Tab | Filter |
|-----|--------|
| Semua | Semua rekening tabungan aktif |
| Perlu Talangan | gap > 0 AND no active talangan |
| Aktif | Rekening dengan talangan aktif |
| Lunas | Talangan paid_off |

**Kolom tabel:** Anggota | Jenis | Saldo | Target | Gap (highlight merah) | Status | Aksi ("Ajukan Talangan")

### 4.3 /haji-umrah/talangan/apply — Form Pengajuan

**Multi-step form (3 langkah):**

**Langkah 1 — Pilih Rekening:**
- Dropdown rekening aktif yang punya gap
- Auto-fill: memberName, balance, targetAmount, gap
- Progress bar visual

**Langkah 2 — Pilih Produk & Tenor:**
- Dropdown produk talangan (filter by type matching)
- Slider tenor (range dari produk)
- **Simulasi otomatis:**
  ```
  Gap Rp 10.000.000, tenor 12 bln, rate 0.5%/bln flat
  → Angsuran: Rp 883.333/bln (pokok 833.333 + bunga 50.000)
  → Total bunga: Rp 600.000
  → Total bayar: Rp 10.600.000
  ```

**Langkah 3 — Konfirmasi:**
- Ringkasan: rekening, amount, tenor, deduction source, estimasi angsuran
- "Ajukan Talangan" (mode approval) atau "Langsung Cairkan" (operator/auto-disburse)

### 4.4 /haji-umrah/talangan/[applicationId] — Detail Talangan

**Konten:**
- Header: nama anggota, jenis talangan, status badge
- Stats grid: pokok, bunga, total, outstanding, terbayar
- Jadwal angsuran tabel (LoanSchedule — status per installment)
- Riwayat pembayaran (LoanPayment list)
- Action buttons:
  - "Setujui" (status: submitted) → POST approve
  - "Cairkan" (status: approved) → POST disburse
  - "Bayar Angsuran" (status: active) → redirect payment
  - "Void" (jika perlu reversal)

---

## 5. Integration

### 5.1 Navigation

**adminHajiUmrahNavigation** — tambah 1 item (setelah Tabungan):
```typescript
{ title: "Talangan", href: "/haji-umrah/talangan", icon: HandCoins, permission: "manage_unit_transactions" },
```

**Main HAJI & UMRAH group** — tambah 1 child:
```typescript
{ title: "Talangan", href: "/haji-umrah/talangan" },
```

**Urutan menu:** Dashboard, Tabungan, **Talangan** ← baru, Produk, Laporan

### 5.2 Dashboard H&U — Extend Stats

Di `/haji-umrah/page.tsx`, tambah:
- 2 stats cards: Total Talangan Aktif, Gap Terdeteksi
- Section "Talangan Terbaru" — 5 terbaru dengan status badge

### 5.3 Reports — Tambah Tipe Laporan

`GET /api/haji-umrah/reports?type=talangan`:
- Total disburse, total dibayar, total outstanding per periode
- Daftar talangan per anggota dengan status
- Export Excel/PDF

### 5.4 Billing — Tidak Ada Perubahan

`deductionSource: "gaji"` → sudah ditangani billing existing (potong gaji 16-15).
`deductionSource: "bs"` → bayar manual, tanpa billing.

### 5.5 Disburse Route — 1 Baris Perubahan

```typescript
// src/app/api/loans/applications/[id]/disburse/route.ts
// Di dalam prisma.loan.create():
linkedSavingsAccountId: application.linkedSavingsAccountId,
```

---

## 6. Business Logic

### 6.1 Gap Calculator

```typescript
function calculateGap(account: SavingsAccount): number {
  if (!account.targetAmount) return 0;                    // no target = no gap
  const gap = Number(account.targetAmount) - Number(account.balance);
  return Math.max(0, gap);
}
```

### 6.2 Validasi Ganda (Apply)

1. SavingsAccount.status === "active"
2. LoanProduct.type IN ("talangan_haji", "talangan_umrah")
3. **Type matching:** savingsProduct.type suffix harus cocok dengan loanProduct.type suffix
   - tabungan_haji → talangan_haji
   - tabungan_umrah → talangan_umrah
4. amount <= gap (tidak boleh melebihi kekurangan)
5. amount >= product.minAmount && <= product.maxAmount
6. tenor >= product.minTenorMonths && <= product.maxTenorMonths
7. Tidak ada Loan aktif where linkedSavingsAccountId = accountId (satu rekening satu talangan)

### 6.3 Auto-Disburse Threshold

```typescript
const AUTO_DISBURSE_THRESHOLD = 10_000_000; // Rp 10 juta

if (amount <= AUTO_DISBURSE_THRESHOLD || roleName === "operator") {
  // Direct disburse — skip approval
} else {
  // Submit for approval
}
```

### 6.4 Talangan vs Tabungan — Independent Entities

```
Tabungan → saldo naik dari setoran → tracking progress → target tercapai → dana ke BSI
Talangan → pinjaman terpisah → angsuran via gaji/manual → lunas → selesai
```

Talangan dan tabungan berjalan **paralel**. Setoran tabungan tidak membayar talangan. Pembayaran talangan tidak mengurangi saldo tabungan.

### 6.5 Void Talangan

| Stadium | Mekanisme |
|---------|-----------|
| Sebelum disburse | Hapus LoanApplication |
| Setelah disburse, belum bayar | `POST /api/loans/[id]/void` — full reversal |
| Setelah sebagian bayar | `POST /api/loans/[id]/void` — partial reversal (handled by existing void helper) |

---

## 7. RBAC

| Role | Talangan Access |
|------|----------------|
| **operator** | Full: create, approve, disburse, view all, auto-disburse any amount |
| **admin haji_umrah** | Branch manager: create, approve, disburse up to threshold, view own branch |
| **admin_sp** | Tidak ada akses (bukan unit H&U) |
| **anggota** | View-only data sendiri (Phase 3 — member portal) |

---

## 8. Implementation Plan

### Sub-Phase 2B-1: Data Layer (1 hari)

| # | File | Aksi | Detail |
|---|------|------|--------|
| 1 | `prisma/schema.prisma` | Modify | +3 field (LoanProduct.type, LoanApplication.linkedSavingsAccountId, Loan.linkedSavingsAccountId) |
| 2 | `prisma/seed.ts` | Modify | +2 produk talangan (TLH, TLU) |
| 3 | `src/app/api/admin/migrate/route.ts` | Modify | +3 idempotent column migrations |
| 4 | Schema push | Run | `npm run db:push` sync to NeonDB |

### Sub-Phase 2B-2: API Layer (2 hari)

| # | File | Aksi | Detail |
|---|------|------|--------|
| 5 | `src/app/api/haji-umrah/talangan/route.ts` | Create | GET: list talangan + stats |
| 6 | `src/app/api/haji-umrah/talangan/gap/route.ts` | Create | GET: gap calculator per rekening |
| 7 | `src/app/api/haji-umrah/talangan/apply/route.ts` | Create | POST: create application + auto-disburse |
| 8 | `src/app/api/haji-umrah/talangan/products/route.ts` | Create | GET: filtered talangan products |
| 9 | `src/app/api/haji-umrah/talangan/[applicationId]/route.ts` | Create | GET: detail + schedules + payments |
| 10 | `src/app/api/loans/applications/[id]/disburse/route.ts` | Modify | +1 line: copy linkedSavingsAccountId |
| 11 | `src/app/api/haji-umrah/reports/route.ts` | Modify | +type=talangan report |
| 12 | `src/lib/validations/haji-umrah.ts` | Modify | +createTalanganSchema |

### Sub-Phase 2B-3: UI Layer (2-3 hari)

| # | File | Aksi | Detail |
|---|------|------|--------|
| 13 | `src/app/(protected)/haji-umrah/talangan/page.tsx` | Create | List + gap overview + stats cards |
| 14 | `src/app/(protected)/haji-umrah/talangan/apply/page.tsx` | Create | Multi-step form (3 langkah) |
| 15 | `src/app/(protected)/haji-umrah/talangan/[applicationId]/page.tsx` | Create | Detail + jadwal + payments + actions |
| 16 | `src/app/(protected)/haji-umrah/page.tsx` | Modify | +2 talangan stats cards + recent section |

### Sub-Phase 2B-4: Integration + Testing (1-2 hari)

| # | File | Aksi | Detail |
|---|------|------|--------|
| 17 | `src/lib/constants/navigation.ts` | Modify | +Talangan menu (admin nav + main nav) |
| 18 | `src/app/(protected)/haji-umrah/laporan/page.tsx` | Modify | +talangan report tab |
| 19 | `e2e/haji-umrah-talangan.spec.ts` | Create | E2E: gap calc, apply, disburse, payment |
| 20 | `Docs-Haji-umrah-plan/README.md` | Update | Phase 2B status |

### Total Summary

| Metric | Value |
|--------|-------|
| **Files baru** | 9 (5 API + 3 UI + 1 E2E) |
| **Files diubah** | 9 |
| **Total files** | ~18 |
| **Estimasi LOC** | ~2.500-3.000 |
| **Durasi** | 5-7 hari kerja |
| **Model Prisma baru** | 0 |
| **API endpoints baru** | 5 |
| **UI pages baru** | 3 |
| **Endpoints di-reuse** | 100% (approve, disburse, payment, void, billing) |

---

## 9. Risk & Mitigasi

| # | Risk | Mitigasi |
|---|------|----------|
| 1 | LoanProduct.type nullable bisa miss-filter | Null-safe query: `WHERE type IS NOT NULL AND type IN (...)` |
| 2 | Gap amount berubah setelah talangan dibuat | Talangan amount di-lock saat disburse, gap re-calculate hanya untuk display |
| 3 | Anggota punya multiple tabungan haji | Satu talangan per tabungan (validated), tapi bisa punya banyak talangan jika banyak rekening |
| 4 | Type mismatch (haji product + umrah savings) | Backend validation: suffix matching `tabungan_${suffix}` ↔ `talangan_${suffix}` |
| 5 | Auto-disburse skip approval bisa salah amount | Threshold di-hardcode, hanya operator/admin H&U yang bisa trigger |

---

*Dibuat: 12 Juni 2026 | Branch: railway-migration | Prasyarat: Phase 1 COMPLETE*
