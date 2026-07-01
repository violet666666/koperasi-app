# Mobile loan-payment — Port Alokasi FIFO Terpadu (match web) — Design Spec

- **Tanggal:** 2026-07-01
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Fase 2a dari effort mobile drift-fix (lihat `progress-update-mobile-app.md`); memori `mobile-drift-audit-fase1-2026-07.md`; web reference `src/app/api/loans/[id]/payments/route.ts`

---

## 1. Konteks & Masalah

Audit menemukan `src/app/api/mobile/loan-payment/route.ts` **tidak mengalokasikan pembayaran ke `LoanSchedule`**, menyimpang dari route web `api/loans/[id]/payments`:

- **Cabang reguler (baris 230-338):** loan di-fetch **tanpa schedules**. Hanya update total loan-level (`principalOutstanding`, `interestOutstanding`, `principalPaid`, `status`). **Tidak update `LoanSchedule` per angsuran, tidak bikin `PaymentAllocation`, tidak simpan `paymentMethod`.** Akibat: pelacakan "angsuran ke berapa yang sudah dibayar" rusak total untuk pembayaran via mobile; laporan jadwal & status pinjaman menyesatkan.
- **Cabang early-settlement (91-228):** `updateMany` semua schedule → "paid" (bulk, tanpa `PaymentAllocation` record per jadwal); `branchId: 1` di-hardcode; entri CB tidak set `referenceType`/`referenceId`/`unitType`/`memberId`.
- **CB transactionNo:** route memanggil `buildCashBankTransactionData` TANPA `transactionNo` eksplisit → pakai default helper yg memakai `Math.random()` (rule repo: harus `crypto.randomBytes()`).
- **paymentNo:** `PAY-M-${Date.now()}` (collision-prone under concurrency).

Route web menyatukan kedua cabang ke **satu loop alokasi FIFO** (early-settlement hanya nol-kan bunga + mark sisa paid) + atomic `$transaction` + `PaymentAllocation` records.

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. Pure helper `allocatePayment(schedules, amount, isEarlySettlement)` → FIFO allocation (late-fee → jasa → pokok per schedule). TDD.
2. Route mobile loan-payment POST ditulis ulang memakai helper tsb + atomic `$transaction` (callback form): create `LoanPayment` **dengan `allocations` (PaymentAllocation)**, update tiap `LoanSchedule` per alokasi, update loan totals, cek `paid_off`, posting CashBank (3 kategori) dengan `referenceType:"LoanPayment"` + `referenceId` + `unitType:"simpan_pinjam"` + `memberId` + `transactionNo` crypto. Kedua mode (reguler + early-settlement) disatukan.
3. Kontrak API mobile dipertahankan (input + response shape) sehingga UI `LoanPaymentScreen` tetap jalan tanpa perubahan.

**Non-Tujuan (di-luar scope):**
- Refactor route web `api/loans/[id]/payments` utk pakai helper baru (follow-up; hindari sentuh web yg bekerja). Helper faithful ke algoritma web shg web bisa adopt nanti.
- Perubahan UI mobile (`LoanPaymentScreen`) — termasuk menambah input `paymentMethod`/`paymentDate` di UI (follow-up bila perlu).
- Fix default `Math.random()` di `buildCashBankTransactionData` (Fase 4; affect all callers).
- Sentuh cabang GET route, route mobile lain, atau web route.

---

## 3. Pendekatan

**Port terpadu penuh (match web)** — disetujui user. Kedua cabang diganti satu flow FIFO.

Ditolak:
- **Reguler-only:** meninggalkan 2 jalur kode berbeda (reguler pakai alokasi, early-settlement bulk) → inkonsisten, teknologi utang.
- **Perbaiki kedua cabang tapi tetap terpisah:** duplikasi logika vs menyatukan.

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| NEW | `src/lib/loan-payment-helpers.ts` | Pure `allocatePayment()` + types `ScheduleInput`/`Allocation`/`AllocationResult`. Match algoritma web (`api/loans/[id]/payments:138-185`). |
| NEW | `src/__tests__/loan-payment-helpers.test.ts` | Unit test alokasi (reguler, partial, multi-schedule, early-settlement, late-fee order, edge). |
| MODIFY | `src/app/api/mobile/loan-payment/route.ts` | POST ditulis ulang: fetch loan+schedules → `allocatePayment` → atomic `$transaction` callback. GET tidak disentuh. Kontrak input/response dipertahankan. |
| NEW (opsional) | `scripts/diagnose-mobile-loan-payment-allocation.ts` | Read-only vs prod: hitung berapa `LoanPayment` mobile (prefix `PAY-M-`) yg punya 0 `PaymentAllocation` (before) vs setelah fix. |

---

## 5. Detail Komponen

### 5.1 Pure helper `allocatePayment` (`src/lib/loan-payment-helpers.ts`)

```ts
export interface ScheduleInput {
  id: number;
  installmentNo: number;
  principalAmount: number; principalPaid: number;
  interestAmount: number;  interestPaid: number;
  lateFee: number;         lateFeePaid: number;
}
export interface Allocation {
  scheduleId: number;
  principalAmount: number;
  interestAmount: number;
  lateFeeAmount: number;
}
export interface AllocationResult {
  allocations: Allocation[];
  totalPrincipal: number;
  totalInterest: number;
  totalLateFee: number;
}

/**
 * FIFO allocation: late-fee → interest → principal per schedule (asc installmentNo).
 * `schedules` HARUS sudah difilter (pending/partial/overdue) + sorted installmentNo asc oleh pemanggil.
 * Pure; unit-tested. Match web api/loans/[id]/payments:149-185.
 */
export function allocatePayment(
  schedules: ScheduleInput[],
  amount: number,
  isEarlySettlement: boolean,
): AllocationResult {
  let remaining = amount;
  const allocations: Allocation[] = [];
  let totalPrincipal = 0, totalInterest = 0, totalLateFee = 0;

  for (const s of schedules) {
    if (remaining <= 0) break;
    const principalDue = s.principalAmount - s.principalPaid;
    const interestDue  = s.interestAmount  - s.interestPaid;
    const lateFeeDue   = s.lateFee - s.lateFeePaid;
    const effectiveInterestDue = isEarlySettlement ? 0 : interestDue; // pelunasan: hanya pokok
    const totalDue = principalDue + effectiveInterestDue + lateFeeDue;
    if (totalDue <= 0) continue;

    const payAmount = Math.min(remaining, totalDue);
    const lateFeePay = Math.min(payAmount, lateFeeDue);
    const interestPay = Math.min(payAmount - lateFeePay, effectiveInterestDue);
    const principalPay = payAmount - lateFeePay - interestPay;

    allocations.push({ scheduleId: s.id, principalAmount: principalPay, interestAmount: interestPay, lateFeeAmount: lateFeePay });
    totalPrincipal += principalPay; totalInterest += interestPay; totalLateFee += lateFeePay;
    remaining -= payAmount;
  }
  return { allocations, totalPrincipal, totalInterest, totalLateFee };
}
```

### 5.2 Route (`api/mobile/loan-payment/route.ts` POST)

Alur baru (preserve GET, preserve response shape):

1. Auth `getMobileUser`; roles `operator`/`admin`/`admin_sp` (tidak berubah).
2. Body `{ loanId, amount, notes, cashBankAccountId, isEarlySettlement }` (tidak berubah). Manual validation: `loanId`+`amount` wajib, `numAmount > 0`.
3. Fetch loan `include: { member, application.product, schedules: { where: { status: { in: ["pending","partial","overdue"] } }, orderBy: { installmentNo: "asc" } } }`. 404 jika tidak ada / bukan active|overdue.
4. Jika `isEarlySettlement`: hitung `earlySettlementFee` (tenor ≤24 → 1×, >24 → 2× bunga bulanan; `monthlyInterest = round(principalAmount × interestRate/100)` — sama dgn web & cabang lama). `allocationAmount = numAmount - earlySettlementFee`. Validasi `allocationAmount >= principalOut`-ish (-match cabang lama: `Math.abs(numAmount - expectedTotal) > 100` → 400, `expectedTotal = principalOut + penaltyFee`).
5. `const { allocations, totalPrincipal, totalInterest, totalLateFee } = allocatePayment(loan.schedules (numeric-coerced), allocationAmount, isEarlySettlement)`.
6. **Atomic `prisma.$transaction(async (tx) => {...}, { timeout: 30000 })`:**
   - Generate `paymentNo` di dalam tx: `PAY-M-${year}-${crypto.randomBytes(4).readUInt32BE(0) % 1_000_000}`, retry 5× on collision, fallback `PAY-M-${year}-${Date.now().toString().slice(-8)}`.
   - `tx.loanPayment.create({ data: { paymentNo, loanId, memberId: loan.memberId, branchId: loan.branchId, amount: numAmount, principalPortion: totalPrincipal, interestPortion: totalInterest, lateFeePortion: totalLateFee, earlySettlementFee, paymentType: isEarlySettlement ? "early_settlement" : "installment", paymentMethod: null, cashBankAccountId: cashBankAccountId ?? null, notes, paymentDate: new Date(), createdById: Number(user.id), allocations: { create: allocations } } })`.
   - Update tiap schedule per alokasi: `newPrincipalPaid = schedule.principalPaid + alloc.principalAmount` (etc.); `isFullyPaid = isEarlySettlement ? newPrincipalPaid >= principalAmount : totalPaid >= totalScheduleDue`; set status `paid`|`partial` + paidDate.
   - Early-settlement: mark unallocated schedules `status:"paid"` + paidDate.
   - Update loan totals (increment principalPaid/interestPaid/lateFeePaid; decrement outstanding). Early-settlement: force outstanding 0 + status `paid_off` + paidOffDate. Reguler: cek jika outstanding ≤0 → paid_off.
   - CB posts (jika `cashBankAccountId`): `resolveCashBankAccount`-style findUnique; running balance; 3 entri (angsuran_pokok if totalPrincipal>0, jasa_pinjaman if totalInterest>0, penalti_pelunasan if isEarlySettlement && fee>0) via `buildCashBankTransactionData({ ..., referenceType:"LoanPayment", referenceId: payment.id, unitType:"simpan_pinjam", memberId: loan.memberId, transactionNo: <crypto> })`; update cashAccount balance.
   - `return payment`.
7. `logAudit` CREATE Pinjaman.
8. Response (preserve): `{ message, data: { newPrincipalOutstanding, newInterestOutstanding, status } }` (`newPrincipalOutstanding` dll dihitung dari hasil tx).

### 5.3 numeric coercion
Field Decimal Prisma (`principalOutstanding` dll) di-coerce `Number()` sebelum ke helper & math (sama dgn web). Helper `ScheduleInput` field `number`.

---

## 6. Alur Data

| Aspek | Mobile sebelum | Mobile sesudah | Web (reference) |
|---|---|---|---|
| Loan fetch | tanpa schedules | **+ schedules pending/partial/overdue** | schedules |
| Alokasi | interest-first simple math (reguler) / bulk (early) | **FIFO per-schedule** | FIFO |
| `PaymentAllocation` records | ❌ | ✅ | ✅ |
| Schedule update | ❌ (reguler) / bulk (early) | ✅ per-alokasi | ✅ |
| `paymentMethod` | ❌ | null (UI follow-up) | ✅ |
| CB `referenceType`/`memberId`/`unitType` | ❌ | ✅ | ✅ |
| CB transactionNo | Math.random (helper default) | **crypto** | Math.random (pre-existing web) |
| Atomicity | `$transaction(array)` | `$transaction(callback)` | callback |
| branchId | hardcoded 1 | `loan.branchId` | `loan.branchId` |

---

## 7. Testing & Verifikasi

### Unit test (pure helper) — TDD
`src/__tests__/loan-payment-helpers.test.ts`:
- reguler: 1 schedule, amount = pokok+jasa → allocasi penuh, status implicated.
- partial: amount < 1 schedule due → alokasi sebagian, sisa remaining.
- multi-schedule: amount melampaui schedule-1 → FIFO ke schedule-2.
- early-settlement: `isEarlySettlement=true` → interestPortion=0 semua, hanya pokok.
- late-fee order: schedule dgn lateFee due → lateFee didahulukan sebelum interest/principal.
- edge: schedules kosong → `{ allocations: [], 0,0,0 }`. amount melebihi totalDue → semua paid, remaining sisa (tidak crash).
- angka konsisten: `totalPrincipal+totalInterest+totalLateFee ≤ amount` (tidak over-allocate).

### Route
- Tidak ada harness integration test DB → verifikasi via `npx tsc --noEmit` (no new errors) + diagnostic before/after.
- Manual Expo `LoanPaymentScreen` (deferred — no emulator): reguler angsuran + early-settlement, cek response shape sama.

### Diagnostic (opsional, before deploy)
`scripts/diagnose-mobile-loan-payment-allocation.ts` (read-only vs prod): hitung `LoanPayment` dgn `paymentNo` prefix `PAY-M-` yg **tidak punya `PaymentAllocation`** (before). Setelah fix, pembayaran mobile baru akan punya. Bukti bug + bukti fix.

### Regresi
- `npm run test` — 0 regresi (3 pre-existing OK).
- `npx tsc --noEmit` — no new errors.

---

## 8. Error Handling & Edge Cases
- `allocationAmount < 0` (early-settlement, amount < penaltyFee) → 400.
- `cashBankAccountId` tidak aktif → throw di dalam tx → rollback.
- Schedules kosong (loan baru tanpa schedule pending) → `allocations=[]`, totals 0; tx tetap jalan (update loan totals 0, no CB). Atau 400 "tidak ada angsuran jatuh tempo" — putuskan di plan (default: lanjut dgn 0, mirror web yg break-only-if `remainingAmount<=0` setelah loop).
- Collision paymentNo setelah 5 retry → fallback timestamp (uniq).
- Decimal coercion: semua `Number()` sebelum math.

---

## 9. Keamanan & RBAC
- Gate tidak berubah (`operator`/`admin`/`admin_sp`). Tidak tambah endpoint.
- `paymentNo` crypto (rule-compliant). CB transactionNo crypto (explicit, hindari Math.random helper default).
- Audit log dipertahankan.
- `memberId` scope: route menerima `loanId` apa pun (operator-scoped, bukan member-self-service) — konsisten dgn behavior existing (operator input manual). Tidak regress.

---

## 10. Rollout
1. TDD helper: RED → GREEN (loan-payment-helpers.test.ts).
2. Rewrite route POST (atomic callback + allocations + CB).
3. (Opsional) diagnostic before/after vs prod.
4. `npm run test` + `npx tsc --noEmit`.
5. Commit `railway-migration` (deploy API). Verifikasi manual Expo.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Rewrite route besar → regress early-settlement yg berfungsi | Helper faithful ke algoritma web (sudah proven); TDD helper; diagnostic before/after; preserve response shape agar UI tak break. |
| Perubahan angka pinjaman live (schedule kini ter-update) | Itu tujuannya (fix); tapi pinjaman yg SUDAH dibayar via mobile di masa lalu tetap punya schedule stale (tidak retroaktif) — dokumentasi: fix berlaku utk pembayaran baru. |
| `branchId: loan.branchId` vs hardcoded 1 | Koperasi 1-cabang → sama; correct bila multi-cabang. |
| Decimal precision (Prisma Decimal vs JS number) | Coerce `Number()` konsisten; helper pure number. |
| `paymentMethod: null` → laporan paymentMethod kosong utk mobile | Acceptable (UI follow-up utk kirim paymentMethod); LoanPayment.paymentMethod nullable. |

---

## 12. Open Questions (resolve saat plan)
- Helper file: `src/lib/loan-payment-helpers.ts`? (Asumsi: ya, match konvensi.)
- `paymentMethod` default: `null` atau derive dari ada-nya cashBankAccountId? (Asumsi: null; UI follow-up.)
- Schedules kosong (tidak ada jatuh tempo): lanjut dgn alokasi 0 atau 400? (Asumsi: lanjut 0, mirror web.)
- Early-settlement validation: pertahankan `Math.abs(numAmount - expectedTotal) > 100 → 400`? (Asumsi: ya, behavior existing.)

---

*Dibuat: 2026-07-01 | Pendekatan "port terpadu penuh" disetujui user | Siap review → writing-plans.*
