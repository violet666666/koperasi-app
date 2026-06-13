# Unit Haji & Umrah

> **unitType:** `haji_umrah` | **Jalur:** Tabungan Bertarget + Talangan (bukan POS) | **API:** `/api/haji-umrah/*` + `/api/loans/*` + `/api/member-portal/haji-umrah`
> **Partner:** Bank BSI (Bank Syariah Indonesia) | **Kategori:** `service` | **Icon:** `Landmark`

---

## Ringkasan

Unit Haji & Umrah mengelola **tabungan bertarget** (anggota menabung untuk biaya Haji/Umrah) dan **talangan** (gap financing ketika saldo belum mencapai target). Berbeda dari semua unit lain yang berbasis POS (jual-beli langsung), unit ini berbasis **savings & loan** — durasi bulanan/tahunan, bukan detik/menit.

**Model bisnis:** Koperasi sebagai savings aggregator — anggota menabung di koperasi → koperasi pooling ke BSI → revenue dari spread bagi hasil + admin fee per setoran + margin talangan.

---

## Arsitektur

```
Tabungan (SavingsProduct type=tabungan_haji/umrah + SavingsAccount extended)
  → Setoran → SavingsTransaction + CashBankTransaction + admin fee
  → Potong Gaji → Billing Source 3 (savings_account)
  → Tracking → Progress bar, gap calculator

Talangan (LoanProduct type=talangan_haji/umrah + LoanApplication + Loan)
  → Gap = targetAmount - currentBalance
  → Apply → LoanApplication (approval) or auto-disburse (≤ Rp 10 juta)
  → Angsuran → reuse existing Loan infrastructure (schedules, payments, void)
  → Disburse → LoanSchedule + CashBankTransaction (outflow)

Semua data disimpan di model yang sudah ada (SavingsProduct, SavingsAccount,
SavingsTransaction, LoanProduct, LoanApplication, Loan, LoanSchedule).
TIDAK ADA model Prisma baru — hanya extend field pada model yang ada.
```

---

## Sidebar (Juni 2026)

### Operator (5 item dalam group HAJI & UMRAH)

| Menu | Route | Icon |
|---|---|---|
| Dashboard | `/haji-umrah` | Landmark |
| Tabungan | `/haji-umrah/tabungan` | Wallet |
| Talangan | `/haji-umrah/talangan` | HandCoins |
| Produk | `/haji-umrah/produk` | Package |
| Laporan | `/haji-umrah/laporan` | BarChart2 |

### Admin Haji & Umrah (5 item + Profil)

| Menu | Route | Icon | Permission |
|---|---|---|---|
| Dashboard H&U | `/haji-umrah` | Landmark | `manage_unit_transactions` |
| Tabungan | `/haji-umrah/tabungan` | Wallet | `manage_unit_transactions` |
| Talangan | `/haji-umrah/talangan` | HandCoins | `manage_unit_transactions` |
| Produk | `/haji-umrah/produk` | Package | `manage_unit_transactions` |
| Laporan | `/haji-umrah/laporan` | BarChart2 | `manage_unit_transactions` |
| Profil Saya | `/profil` | User | — |

### Routing Logic

```
dashboard/page.tsx:199 → admin haji_umrah auto-redirect ke /haji-umrah (bukan KasirDashboard)
navigation.ts:1398 → getNavigationForUser() routes admin+haji_umrah ke adminHajiUmrahNavigation
layout.tsx:58 → ADMIN_ALLOWED_ROUTES["haji_umrah"] = ["/haji-umrah", "/unit", "/transaksi-unit", "/kwitansi", "/approval"]
```

---

## Akun Testing

| Role | Email | Password | Detail |
|---|---|---|---|
| Operator | `operator@koperasi.com` | `password123` | Full access semua unit |
| Admin H&U | `adminhajiumrah@koperasi.com` | `password123` | roleId: 16, branchId: 10, unitType: haji_umrah |

---

## RBAC

| Role | Tabungan | Talangan | Produk | Laporan |
|---|---|---|---|---|
| **operator** | Full CRUD + setoran | Full: apply, approve, disburse, auto-disburse any amount | Full CRUD | Full + export |
| **admin haji_umrah** | Full CRUD + setoran | Apply + approve + disburse ≤ Rp 10 juta; > 10 juta butuh operator approve | Full CRUD | Full + export |
| **admin_sp** | Tidak ada akses | Tidak ada akses | Tidak ada akses | Tidak ada akses |
| **anggota** | View-only (Phase 3) | View-only (Phase 3) | — | — |

---

## Data Model

### SavingsProduct — Extended Fields (+5 field)

| Field | Type | Default | Keterangan |
|---|---|---|---|
| `targetAmount` | `Decimal?` | null | Target tabungan (BPIH Rp 50jt / Umrah Rp 25jt) |
| `adminFeeType` | `String?` | null | `"percent"` / `"fixed"` — biaya admin per setoran |
| `adminFeeValue` | `Decimal?` | null | Nilai admin fee (misal 0.5%) |
| `linkedBankName` | `String?` | null | Bank partner — "BSI" |
| `allowEarlyWithdraw` | `Boolean` | `true` | `false` untuk haji/umrah (tidak bisa tarik dini) |

`SavingsProduct.type` tambah nilai: `"tabungan_haji"`, `"tabungan_umrah"` (existing: pokok, wajib, sukarela, lainnya)

### SavingsAccount — Extended Fields (+3 field)

| Field | Type | Keterangan |
|---|---|---|
| `targetAmount` | `Decimal?` | Override target per-account |
| `monthlyTarget` | `Decimal?` | Setoran bulanan target (untuk billing & tracking) |
| `maturityDate` | `DateTime?` | Target tanggal tercapai |

### LoanProduct — New Field (+1 field)

| Field | Type | Keterangan |
|---|---|---|
| `type` | `String?` | `"reguler"` / `"talangan_haji"` / `"talangan_umrah"` — null = reguler |

### LoanApplication — New Field (+1 field)

| Field | Type | Keterangan |
|---|---|---|
| `linkedSavingsAccountId` | `Int?` | Links talangan ke rekening tabungan H&U |

### Loan — New Field (+1 field, denormalized)

| Field | Type | Keterangan |
|---|---|---|
| `linkedSavingsAccountId` | `Int?` | Copy dari LoanApplication. Permanent record. |

### Seed Products

| Code | Name | Model | Type | Target/Max | Rate | Admin Fee |
|---|---|---|---|---|---|---|
| **TH** | Tabungan Haji | SavingsProduct | `tabungan_haji` | Rp 50.000.000 | — | 0.5% per setoran |
| **TU** | Tabungan Umrah | SavingsProduct | `tabungan_umrah` | Rp 25.000.000 | — | 0.5% per setoran |
| **TLH** | Talangan Haji | LoanProduct | `talangan_haji` | Rp 1M-50M | 0.5%/bln flat | 1% |
| **TLU** | Talangan Umrah | LoanProduct | `talangan_umrah` | Rp 500K-25M | 0.5%/bln flat | 1% |

---

## API Endpoints

### Tabungan (Phase 1)

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/api/haji-umrah/savings` | Authenticated | List rekening tabungan haji/umrah (paginated, search, filter type/status) |
| `POST` | `/api/haji-umrah/savings` | Authenticated | Buka rekening baru (accountNo: `HU-{memberId}-{productId}-{timestamp4}`) |
| `GET` | `/api/haji-umrah/savings/[accountId]` | Authenticated | Detail rekening + stats (monthlyDeposits, totalDeposits, remaining, monthsRemaining, isTargetReached) |
| `GET` | `/api/haji-umrah/savings/[accountId]/transactions` | Authenticated | Riwayat transaksi (paginated) |
| `POST` | `/api/haji-umrah/savings/[accountId]/transactions` | Authenticated (non-anggota) | Setoran — atomic: SavingsTransaction + update balance + CashBankTransaction + admin fee CashBank |
| `GET` | `/api/haji-umrah/products` | Authenticated | List produk tabungan haji/umrah |
| `POST` | `/api/haji-umrah/products` | operator / admin haji_umrah | Buat produk tabungan baru |
| `PUT` | `/api/haji-umrah/products/[productId]` | operator / admin haji_umrah | Update produk tabungan |
| `GET` | `/api/haji-umrah/reports` | Authenticated | Laporan: `?type=rekap|progress|admin_fee|talangan` |

### Talangan (Phase 2B)

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/api/haji-umrah/talangan` | Authenticated | List talangan + stats (totalActive, totalOutstanding, paidThisMonth, gapDetected, totalPaidOff) |
| `GET` | `/api/haji-umrah/talangan/gap` | Authenticated | Gap calculator per rekening. `?onlyWithGap=true&productType=tabungan_haji` |
| `GET` | `/api/haji-umrah/talangan/products` | Authenticated | Produk talangan (filtered by type). `?type=talangan_haji` |
| `GET` | `/api/haji-umrah/talangan/[applicationId]` | Authenticated | Detail: application + loan + schedules + payments + savings account info |
| `POST` | `/api/haji-umrah/talangan/apply` | operator / admin haji_umrah | Buat pengajuan + auto-disburse (jika ≤ Rp 10 juta atau operator) |

### Member Portal (Phase 3) — view-only, member-scoped

| Method | Endpoint | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/api/member-portal/haji-umrah` | Member (`session.user.memberId` wajib) | Rekening H&U milik anggota yang login + progress + riwayat setoran + talangan aktif per rekening + summary stats |

> **Penting:** Endpoint ini TIDAK menerima `memberId` dari client — selalu pakai session. Berbeda RBAC dari `/api/haji-umrah/*` (operator/admin). Operator (memberId=null) → 401. Endpoint `/api/haji-umrah/*` TIDAK boleh di-reuse untuk portal.

### Reused Endpoints (dari infrastruktur Loan)

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/loans/applications/[id]/approve` | Approve pengajuan talangan |
| `POST` | `/api/loans/applications/[id]/disburse` | Cairkan talangan (create Loan + Schedules + CashBank) |
| `POST` | `/api/loans/[id]/payments` | Bayar angsuran talangan |
| `POST` | `/api/loans/[id]/void` | Void pinjaman talangan |
| `POST` | `/api/loans/[id]/payments/[paymentId]/void` | Void pembayaran angsuran |

---

## UI Pages

### Struktur Route

```
src/app/(protected)/haji-umrah/
  layout.tsx                             ← Pass-through layout
  page.tsx                               ← Dashboard (8 stat cards + target alert + 4 quick links)
  tabungan/
    page.tsx                             ← Daftar rekening + progress bars + buka rekening dialog
    [accountId]/
      page.tsx                           ← Detail rekening: stats, riwayat, kwitansi print
      setoran/
        page.tsx                         ← Form setoran: amount, payment method, admin fee preview
  talangan/
    page.tsx                             ← Gap overview table + stats cards + tabs filter
    apply/
      page.tsx                           ← Multi-step form (3 steps: pilih rekening → produk/tenor → konfirmasi)
    [applicationId]/
      page.tsx                           ← Detail: application info, savings progress, loan stats, jadwal, riwayat bayar
  produk/
    page.tsx                             ← CRUD produk tabungan (card grid + dialog)
  laporan/
    page.tsx                             ← Export Excel/PDF + summary cards

src/app/portal/haji-umrah/                ← Phase 3 — Member self-service (view-only)
  page.tsx                               ← Tabungan H&U milik anggota: summary gradient card,
                                            per-account progress tracker, maturity countdown,
                                            collapsible riwayat setoran, talangan aktif block, empty state
```

### Dashboard Stats Cards (8 cards)

| Card | Data Source |
|---|---|
| Total Rekening Aktif | Count active savings accounts |
| Total Saldo | Sum balance |
| Target Keseluruhan | Sum targetAmount |
| Setoran Bulan Ini | Sum deposits this month |
| Admin Fee Bulan Ini | Sum admin fee revenue this month |
| Mendekati Target ≥80% | Count accounts ≥80% progress |
| Talangan Aktif | Count active talangan loans |
| Gap Terdeteksi | Count accounts needing talangan |

---

## Alur Bisnis

### 1. Tabungan — Setoran Manual

```
Admin input setoran → prisma.$transaction:
  ├─ Create SavingsTransaction (type: deposit, amount)
  │  → update SavingsAccount.balance
  ├─ Create CashBankTransaction (type: in, category: "savings", unitType: "simpan_pinjam")
  ├─ IF adminFee > 0:
  │  → CashBankTransaction (type: in, category: "pendapatan_unit", unitType: "haji_umrah")
  └─ Update CashBankAccount.currentBalance
  → IF balanceAfter >= targetAmount: Flag "Tabungan telah mencapai target!"
```

### 2. Tabungan — Potong Gaji (Billing)

```
Billing Generate (16th → 15th):
  → Scan SavingsAccount WHERE product.type IN ('tabungan_haji','tabungan_umrah')
    AND monthlyTarget IS NOT NULL AND status = 'active'
  → Create BillingItem:
    → transactionSource = 'savings_account'
    → amount = monthlyTarget
    → unitType = 'haji_umrah'

Billing Settlement:
  → CashBankTransaction (salary_cut_settlement)
  → SavingsTransaction (deposit)
  → Update SavingsAccount.balance
```

### 3. Talangan — Full Flow

```
Gap Calculator:
  gap = max(0, targetAmount - currentBalance)
  IF gap > 0 AND no active talangan → status: "needs_talangan"

Apply (POST /api/haji-umrah/talangan/apply):
  Validasi:
    ├─ SavingsAccount.status === "active"
    ├─ Member.status bukan inactive/resigned/pensiun
    ├─ Type matching: tabungan_haji ↔ talangan_haji
    ├─ amount <= gap
    ├─ amount dalam range produk min/max
    ├─ tenor dalam range produk min/max
    └─ Tidak ada talangan aktif untuk rekening ini (1:1)
  
  IF amount <= 10.000.000 OR operator:
    → Auto-disburse: LoanApplication (approved) → Loan + Schedules + CashBank
  ELSE:
    → LoanApplication (submitted) → Admin approve → disburse via /api/loans/...

Repayment:
  → reuse /api/loans/[id]/payments (FIFO allocation)
  → deductionSource: gaji → billing auto-detect
  → deductionSource: bs → bayar manual
```

### 4. Talangan & Tabungan — Independent

```
Tabungan → saldo naik dari setoran → tracking progress → target tercapai → dana ke BSI
Talangan → pinjaman terpisah → angsuran via gaji/manual → lunas → selesai

Talangan dan tabungan berjalan PARALEL. Setoran tabungan TIDAK membayar talangan.
Pembayaran talangan TIDAK mengurangi saldo tabungan.
```

---

## Billing Integration

### Source 3: savings_account

**Generate** (`api/billing/generate/route.ts:198-211`):
```typescript
// Scan SavingsAccount WHERE product.type IN ('tabungan_haji','tabungan_umrah')
// AND monthlyTarget IS NOT NULL AND status = 'active'
// Create BillingItem per account:
//   transactionSource: "savings_account"
//   unitType: "haji_umrah"
//   amount: monthlyTarget
```

**Settlement** (`api/billing/[periodId]/process/route.ts:109-129`):
```typescript
// When transactionSource === "savings_account":
//   1. Create SavingsTransaction (deposit)
//   2. Update SavingsAccount.balance
//   3. txNo format: HU-{year}-{random}
```

---

## SHU Integration

Revenue otomatis masuk SHU karena `CashBankTransaction` dengan:
- `type: "in"` + `unitType: "haji_umrah"` + `category: "pendapatan_unit"` → ter-cover oleh SHU income query
- Admin fee per setoran → recorded as `pendapatan_unit` / `haji_umrah`
- Margin talangan → via loan interest (jasa_pinjaman)

---

## Files Inventory

### API Routes (12 files)

| File | Endpoint(s) |
|---|---|
| `src/app/api/haji-umrah/savings/route.ts` | GET list, POST buka rekening |
| `src/app/api/haji-umrah/savings/[accountId]/route.ts` | GET detail + stats |
| `src/app/api/haji-umrah/savings/[accountId]/transactions/route.ts` | GET riwayat, POST setoran |
| `src/app/api/haji-umrah/products/route.ts` | GET list, POST create |
| `src/app/api/haji-umrah/products/[productId]/route.ts` | PUT update |
| `src/app/api/haji-umrah/reports/route.ts` | GET 4 report types |
| `src/app/api/haji-umrah/talangan/route.ts` | GET list + stats |
| `src/app/api/haji-umrah/talangan/gap/route.ts` | GET gap calculator |
| `src/app/api/haji-umrah/talangan/apply/route.ts` | POST apply + auto-disburse |
| `src/app/api/haji-umrah/talangan/products/route.ts` | GET talangan products |
| `src/app/api/haji-umrah/talangan/[applicationId]/route.ts` | GET detail |
| `src/app/api/member-portal/haji-umrah/route.ts` | GET member's H&U (view-only, member-scoped) — Phase 3 |

### UI Pages (11 files)

| File | Route |
|---|---|
| `src/app/(protected)/haji-umrah/layout.tsx` | Pass-through |
| `src/app/(protected)/haji-umrah/page.tsx` | Dashboard |
| `src/app/(protected)/haji-umrah/tabungan/page.tsx` | Rekening list |
| `src/app/(protected)/haji-umrah/tabungan/[accountId]/page.tsx` | Detail rekening |
| `src/app/(protected)/haji-umrah/tabungan/[accountId]/setoran/page.tsx` | Form setoran |
| `src/app/(protected)/haji-umrah/talangan/page.tsx` | Gap overview |
| `src/app/(protected)/haji-umrah/talangan/apply/page.tsx` | Multi-step apply |
| `src/app/(protected)/haji-umrah/talangan/[applicationId]/page.tsx` | Detail talangan |
| `src/app/(protected)/haji-umrah/produk/page.tsx` | CRUD produk |
| `src/app/(protected)/haji-umrah/laporan/page.tsx` | Export laporan |
| `src/app/portal/haji-umrah/page.tsx` | Member self-service (view-only) — Phase 3 |

### E2E Tests (6 files, ~88 tests)

| File | Tests |
|---|---|
| `e2e/haji-umrah.spec.ts` | ~9 basic flow |
| `e2e/haji-umrah-full.spec.ts` | ~13 full E2E |
| `e2e/haji-umrah-comprehensive.spec.ts` | ~36 operator + admin + RBAC |
| `e2e/haji-umrah-admin-setup.spec.ts` | ~8 admin CRUD |
| `e2e/haji-umrah-talangan.spec.ts` | ~14 talangan API + UI + flow |
| `e2e/haji-umrah-portal.spec.ts` | 7 member portal (RBAC + member data-flow + UI) — Phase 3 |

### Validations (1 file)

| File | Schemas |
|---|---|
| `src/lib/validations/haji-umrah.ts` | `createHajiUmrahAccountSchema`, `createHajiUmrahSetoranSchema`, `createHajiUmrahProductSchema`, `updateHajiUmrahProductSchema`, `createTalanganSchema`, `AUTO_DISBURSE_THRESHOLD`, `TALANGAN_PRODUCT_TYPES` |

### Modified Shared Files

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | +5 field SavingsProduct, +3 field SavingsAccount, +1 field LoanProduct.type, +1 field LoanApplication.linkedSavingsAccountId, +1 field Loan.linkedSavingsAccountId, +relation fields |
| `prisma/seed.ts` | +2 savings products (TH, TU), +2 loan products (TLH, TLU) |
| `src/app/api/admin/migrate/route.ts` | +8 column migrations SavingsProduct/SavingsAccount, +3 column migrations LoanProduct/LoanApplication/Loan |
| `src/lib/constants/units.ts` | +`haji_umrah: { label, slug, category, icon }` |
| `src/lib/constants/index.ts` | +`tabungan_haji`, `tabungan_umrah` in SAVINGS_PRODUCT_TYPES |
| `src/lib/constants/navigation.ts` | +`adminHajiUmrahNavigation` (6 items) + `HAJI & UMRAH` main group + `HandCoins` import |
| `src/lib/validations/index.ts` | +`type` field in `createLoanProductSchema` |
| `src/app/(protected)/layout.tsx` | +`haji_umrah` in ADMIN_ALLOWED_ROUTES |
| `src/app/(protected)/dashboard/page.tsx` | +redirect admin haji_umrah → /haji-umrah |
| `src/app/api/users/route.ts` | +`"haji_umrah"` in VALID_UNIT_TYPES |
| `src/app/api/billing/generate/route.ts` | +Source 3: savings_account |
| `src/app/api/billing/[periodId]/process/route.ts` | +savings_account settlement |
| `src/app/api/loans/applications/[id]/disburse/route.ts` | +1 line: copy linkedSavingsAccountId |
| `src/app/api/member-portal/summary/route.ts` | +H&U fields in product.select + account response (targetAmount, monthlyTarget, maturityDate) — Phase 3 |
| `src/lib/api/services.ts` | +`memberPortalApi.hajiUmrah()` — Phase 3 |
| `src/app/portal/layout.tsx` | +`Haji & Umrah` nav link (Landmark icon) — Phase 3 |
| `src/app/portal/simpanan/page.tsx` | +filter H&U out of simpanan cards + pointer banner to /portal/haji-umrah — Phase 3 |

---

## Phase History

| Phase | Fitur | Status | Commit | Tested |
|---|---|---|---|---|
| 1A | Data Layer (schema + seed + migration) | ✅ DONE | `0eac197` | Prisma validate + db push |
| 1B | API Layer (6 tabungan endpoints) | ✅ DONE | `3c60a39` | E2E 20/20 |
| 1C | UI Layer (7 pages + layout) | ✅ DONE | `521bd17` | E2E 20/20 |
| 1D | Integration (constants + nav + billing + Zod) | ✅ DONE | `7de4647` | E2E 20/20 |
| 1E | Security Fix + Bug Fix | ✅ DONE | `4febb77`, `15004ea` | E2E re-pass |
| 2A | Seed Products + Live E2E | ✅ DONE | `4baca42`, `a786521` | E2E 20/20 |
| 2A-ext | Admin Unit Support (nav + redirect + CRUD) | ✅ DONE | `81567df`, `aa6eb4d` | E2E 58/58 |
| **2B** | **Talangan Haji/Umrah** | **✅ DONE** | **`5c885cb`** | **E2E 14/14** |
| **3** | **Member Portal** (view-only, member-scoped) | **✅ DONE** | _see commit_ | **E2E 7/7 + 34/34 no regression** |
| 4 | Spread Bagi Hasil | 🔲 Pending | — | — |
| 5 | Mobile App | 🔲 Pending | — | — |

---

## Known Issues & Technical Notes

| # | Issue | Status | Detail |
|---|---|---|---|
| 1 | Produk edit (PUT) belum pakai Zod schema | Low priority | Inline validation works, bisa upgrade ke `updateHajiUmrahProductSchema` |
| 2 | Kwitansi print pakai `document.write` | Acceptable | Pola thermal yang konsisten dengan codebase |
| 3 | Setoran tanpa CashBankAccountId | Expected | Tidak posting ke CashBook jika tidak pilih akun kas — perlu warning UI |
| 4 | `Math.random` → `crypto.randomBytes` | ✅ Fixed | Transaction numbers sekarang 9-digit cryptographically secure |
| 5 | Formula injection Excel export | ✅ Fixed | Sanitasi leading `=+@-` characters |
| 6 | Member.isActive tidak ada | ✅ Fixed | Member model pakai `status` field. Apply route diperbaiki. |
| 7 | session.user.id bertipe String | ✅ Fixed | Harus `parseInt()` untuk field Prisma Int (createdById, approvedById) |
| 8 | createLoanProductSchema tanpa `type` | ✅ Fixed | Field `type` ditambah ke Zod schema agar tidak di-strip |
| 9 | LoanProduct admin fee hardcoded 2% | Noted | Disburse route reguler hardcode 2%. Talangan apply route pakai product config. Harmonize di masa depan. |

---

## Gotchas (Penting untuk Developer)

1. **SavingsProduct.type** support `tabungan_haji` dan `tabungan_umrah` — jangan confuse dengan LoanProduct.type (`talangan_haji` / `talangan_umrah`)
2. **Member model pakai `status`** (bukan `isActive`) — value: active, inactive, resigned, pensiun
3. **session.user.id bertipe String** — selalu `parseInt()` sebelum ke Prisma Int field
4. **Prisma `aggregate()` does NOT support relation filters** — gunakan two-step: findMany IDs dulu, lalu aggregate dengan `productId: { in: [...] }`
5. **Transaction numbers harus `crypto.randomBytes()`** — jangan pakai `Math.random()` (security scanner CRITICAL)
6. **Loan disburse route** (reguler) meng-copy `linkedSavingsAccountId` dari LoanApplication → Loan
7. **Talangan apply route** punya disburse logic sendiri — tidak memanggil `/api/loans/.../disburse`. Ini by design (auto-disburse mode). Approval flow memakai `/api/loans/.../disburse` yang sudah ada.
8. **Billing Source 3** (`savings_account`) hanya generate untuk SavingsAccount yang punya `monthlyTarget`
9. **Admin fee CashBank** dikategorikan `pendapatan_unit` + `unitType: haji_umrah` — auto masuk SHU
10. **One talangan per rekening** — validasi di apply route, tidak boleh ada 2 talangan aktif untuk 1 SavingsAccount
11. **Type matching wajib** — `tabungan_haji` hanya bisa pakai `talangan_haji`, `tabungan_umrah` hanya bisa pakai `talangan_umrah`
12. **Member portal ≠ admin API** — `/api/member-portal/haji-umrah` (Phase 3) pakai RBAC member (`session.user.memberId` wajib, scoped ke anggota yang login, view-only). `/api/haji-umrah/*` pakai RBAC operator/admin. Jangan di-reuse — operator (memberId=null) → 401 di portal endpoint by design.
13. **Talangan di portal** muncul otomatis via `Loan.linkedSavingsAccountId` (denormalized Phase 2B) — query by `memberId + linkedSavingsAccountId IN (accountIds)`. Member lihat outstanding + cicilan bulanan + jatuh tempo berikutnya (LoanSchedule pending terdekat).
14. **Test member portal** pakai akun member nyata: `87011378@koperasi.local` / `87011378` (A'AN ANDRIONO, member_id 776, punya HU-776-10-1715 + talangan). Password = NRP (konvensi seed). Login harus di **fresh browser context** (`browser.newContext()`) agar tidak ikut session operator.

---

## Testing Commands

```bash
# Run all H&U E2E tests
npx playwright test e2e/haji-umrah --workers=1 --reporter=line

# Run specific test suite
npx playwright test e2e/haji-umrah-talangan.spec.ts --workers=1

# Build check
npx next build

# Schema check
npx prisma validate

# Column migration (run once after deploy)
curl -X POST http://localhost:3000/api/admin/migrate -H "Cookie: <session>"
```

---

*Diperbarui: 13 Juni 2026 | Status: Phase 1 + 2B COMPLETE — Tabungan + Talangan aktif, 14 E2E tests passing*
