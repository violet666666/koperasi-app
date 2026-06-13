# Spread Bagi Hasil — Design Spec (Phase 4)

> **Branch:** `railway-migration` | **Status:** Design Approved 13 Juni 2026
> **Parent:** `haji-umrah-planning.md` | **Unit:** Haji & Umrah (`haji_umrah`)

---

## 1. Konteks & Model Bisnis

Koperasi sebagai **savings aggregator**: anggota menabung H&U di koperasi → dana di-pooling ke BSI → BSI membayar **bagi hasil** (profit share) ke koperasi. Koperasi menyimpan **spread** (margin) dan mendistribusikan sisanya ke anggota.

```
BSI bagi hasil X (input admin, per periode)
  ├─ memberPool = X × R%   → dikredit ke saldo tabungan H&U anggota (proporsional saldo)
  └─ spread     = X − pool → pendapatan koperasi (CashBank pendapatan_unit, masuk SHU)
```

**BSI tidak punya API** → admin input manual per periode (konfirmasi dari rekening koran/statement BSI).

## 2. Keputusan Design (dikonfirmasi user)

| Aspek | Keputusan |
|---|---|
| Split mechanism | **Configurable rate per input** — admin input total BSI `X` + member rate `R%` per distribusi |
| Mendarat di member | **Add to H&U savings balance** — `SavingsTransaction(type:"interest")` |
| Distribution basis | **Proportional to H&U balance** — snapshot saldo saat distribusi |
| Per product | **One combined input** — Haji + Umrah gabungan, distribusi ke semua rekening H&U |
| Akuntansi | Spread → CashBook income (`pendapatan_unit`); member pool → kredit saldo (bukan cash outflow) |

**Kenapa member pool bukan CashBank outflow:** Dana member adalah *liability* koperasi (koperasi pegang untuk member), bukan income. Kalau pool dicatat sebagai cash out / gross X sebagai income, SHU kelebihan hitung. Hanya spread = revenue koperasi yang masuk SHU. Sesuai design doc §5.3.

## 3. Data Model (Approach A — 2 new models)

```
BagiHasilDistribution (batch — input admin + hasil)
  id                Int       @id
  distributionNo    String    @unique   — "BHD-2026-<crypto9>"
  periodLabel       String              — "Mei 2026"
  periodStart       DateTime  @db.Date
  periodEnd         DateTime  @db.Date
  totalBsiAmount    Decimal   @db.Decimal(15,2)   — X
  memberRate        Decimal   @db.Decimal(5,2)    — R% (0-100)
  memberPoolAmount  Decimal   @db.Decimal(15,2)   — X × R%
  spreadAmount      Decimal   @db.Decimal(15,2)   — X − pool
  totalBalanceSnapshot Decimal @db.Decimal(15,2)  — sum saldo H&U saat distribusi
  memberCount       Int                              — penerima share
  status            String    @default("draft")    — draft | processed | voided
  cashBankAccountId Int?                             — akun pendaratan spread
  processedById     Int?
  processedAt       DateTime?
  voidedById        Int?
  voidedAt          DateTime?
  voidReason        String?
  notes             String?
  createdAt / updatedAt
  items             BagiHasilItem[]

BagiHasilItem (per-member share)
  id                Int       @id
  distributionId    Int       @map → BagiHasilDistribution
  memberId          Int
  savingsAccountId  Int
  memberName        String              — snapshot (denormalized untuk report)
  accountNo         String              — snapshot
  balanceSnapshot   Decimal   @db.Decimal(15,2)
  sharePercent      Decimal   @db.Decimal(8,4)     — balance/total × 100
  amount            Decimal   @db.Decimal(15,2)    — share aktual
  savingsTransactionId Int?                          — back-ref (null jika voided)
```

`savingsTransactionId` back-reference → void adalah reversal presisi (tidak perlu tebak txn mana yang dibalik).

## 4. Admin Input Flow + Distribution Algorithm

**Page:** `/haji-umrah/bagi-hasil` (RBAC: operator + admin haji_umrah)

**2-step: preview lalu process.**

1. **Form input:** periodLabel, periodStart, periodEnd, totalBsiAmount (`X`), memberRate (`R%`, default 70), cashBankAccountId, notes.
2. **Preview (dry-run, POST dengan `dryRun:true`):**
   - Fetch active H&U accounts: `SavingsAccount where status=active AND product.type IN (tabungan_haji, tabungan_umrah)`
   - `T = sum(balance)`. Guard: `T == 0` → error.
   - `memberPool = round(X × R/100)`, `spread = X − memberPool`.
   - Per account: `share = round(balance/T × memberPool)`. Return preview table + totals (T, memberPool, spread, memberCount).
3. **Process (POST `dryRun:false`):** atomic `prisma.$transaction`:
   - **Rounding:** hitung semua share kecuali item terakhir; item terikat = `memberPool − sum(sebelumnya)` agar total tepat.
   - Per account: `SavingsTransaction(type:"interest", amount:share, notes:"Bagi Hasil BSI {periodLabel}")` + `SavingsAccount.balance += share`. Simpan `savingsTransactionId`.
   - `CashBankTransaction(type:"in", amount:spread, category:"pendapatan_unit", unitType:"haji_umrah")` + `CashBankAccount.balance += spread`.
   - Create `BagiHasilDistribution` (status "processed") + `BagiHasilItem[]`.
   - Transaction numbers pakai `crypto.randomBytes(4)` (security).

## 5. Member Visibility + Reports

- **Member portal:** bagi hasil **otomatis muncul** di `/portal/haji-umrah` riwayat — Phase 3 sudah label `SavingsTransaction.type:"interest"` → "Bagi Hasil". **Zero portal work.**
- **Admin API:**
  - `GET /api/haji-umrah/bagi-hasil` — list distributions + summary (total spread, total distributed, count, last distribution)
  - `GET /api/haji-umrah/bagi-hasil/[id]` — detail + items
  - `POST /api/haji-umrah/bagi-hasil` — create (dryRun + process)
  - `POST /api/haji-umrah/bagi-hasil/[id]/void` — void (operator only)
- **Admin UI:**
  - `/haji-umrah/bagi-hasil/page.tsx` — list history + "Distribusi Baru" form + live preview
  - `/haji-umrah/bagi-hasil/[id]/page.tsx` — detail (items table) + void action

## 6. Void / Reversal

Void pada distribution `processed` (RBAC: **operator only** — financial reversal). Atomic:
1. Setiap `BagiHasilItem` dengan `savingsTransactionId`: normalkan `SavingsAccount.balance -= amount`, tandai `SavingsTransaction.status = "voided"`.
2. Reverse CashBank spread: buat **compensating** `CashBankTransaction(type:"out", category:"pendapatan_unit", unitType:"haji_umrah", amount:spread, description:"Reversal BHD-...")` + `CashBankAccount.balance -= spread`. (CashBank ledger append-only — tidak ada flag voided, jadi pakai compensating entry, konsisten dengan pola reversal codebase.)
3. `BagiHasilDistribution.status = "voided"`, `voidedAt`, `voidedById`, `voidReason`. Null-kan `savingsTransactionId` di items.
4. Edge cases: account closed since → tetap reverse (normalkan saldo); already voided → 409; backdating allowed.

## 7. File Plan

| Layer | File | Action |
|---|---|---|
| Data | `prisma/schema.prisma` | +2 models (BagiHasilDistribution, BagiHasilItem) |
| Data | `src/app/api/admin/migrate/route.ts` | +idempotent table migration |
| Data | `src/lib/validations/haji-umrah.ts` | +`createBagiHasilSchema`, +`voidBagiHasilSchema` |
| API | `src/app/api/haji-umrah/bagi-hasil/route.ts` | GET list + POST (dryRun/process) |
| API | `src/app/api/haji-umrah/bagi-hasil/[id]/route.ts` | GET detail |
| API | `src/app/api/haji-umrah/bagi-hasil/[id]/void/route.ts` | POST void |
| UI | `src/app/(protected)/haji-umrah/bagi-hasil/page.tsx` | list + form + preview |
| UI | `src/app/(protected)/haji-umrah/bagi-hasil/[id]/page.tsx` | detail + void |
| Integration | `src/lib/constants/navigation.ts` | +Bagi Hasil menu (admin H&U + main) |
| Integration | `src/app/api/haji-umrah/reports/route.ts` | +`?type=bagi_hasil` |
| Tests | `e2e/haji-umrah-bagi-hasil.spec.ts` | API + UI + void RBAC |

## 8. Testing Plan

- Build + lint verify
- E2E: create dry-run preview → process → verify member balances naik + spread CashBank → void → verify reversal → RBAC (admin can't void, operator can)
- Test data: pakai existing member 87011378 (A'AN ANDRIONO) + verify bagi hasil muncul di portal mereka
- Regression: existing 41 H&U E2E tests tetap pass

## 9. Out of Scope (YAGNI)

- BSI API integration (BSI belum ada API — manual input)
- Per-product split (Haji/Umrah terpisah) — gabungan cukup
- Auto-scheduling distribusi — manual per periode
- Bagi hasil untuk produk simpanan non-H&U — scope H&U only
