# Mobile Void Angsuran — Design Spec (Fase 3)

- **Tanggal:** 2026-07-02
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Fase 3 (fitur parity); memori `mobile-drift-audit-fase1-2026-07.md`; web reference `src/app/api/loans/[id]/payments/[paymentId]/void/route.ts` + `src/lib/payment-void-helpers.ts`

---

## 1. Konteks & Masalah

Web punya **void per pembayaran angsuran** (`POST /api/loans/[id]/payments/[paymentId]/void`) — reversal atomic: rollback `LoanSchedule`, reverse `CashBankTransaction` + saldo, hapus `LoanPaymentAllocation`, mark `LoanPayment` voided, update counter loan. **Mobile tidak punya** — manajemen pinjaman mobile view/pay-only, tidak ada jalur koreksi untuk angsuran yg salah-posting.

**Kabar baik:** logika reversal kompleks SUDAH ada sebagai **pure helpers teruji** di `src/lib/payment-void-helpers.ts` (`calcPaymentCbReversalAmount`, `buildScheduleRollbackOps`, `buildLoanRollbackData`, `buildPaymentVoidResponse`, type `AllocationReversal`). Route mobile cukup **reuse** helper tsb + orchestration (mirror web) dgn auth mobile. Tidak perlu pure helper baru.

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. **API void mobile** `POST /api/mobile/loan-payment-void` body `{ paymentId, reason? }` — port web void, reuse `payment-void-helpers`, atomic `$transaction(callback)`, auth `getMobileUser` (operator/admin_sp).
2. **API list payments mobile** `GET /api/mobile/loan-payments?loanId=X` — list `LoanPayment` utk loan (+ `_count allocations`, `status`, `voidedAt`) utk konsumsi UI. (Mobile saat ini tidak punya endpoint ini.)
3. **UI:** jalur koreksi di mobile — tampilkan riwayat angsuran sebuah pinjaman + tombol "Batalkan (VOID)" dgn dialog konfirmasi (input reason) → panggil API void.

**Non-Tujuan:**
- Void pinjaman keseluruhan (sudah ada helper `loan-void-helpers.ts` — scope berbeda).
- Sentuh web void route (sudah bekerja).
- Backfill/retroaktif.
- Validasi plafon dll (void = reversal murni).

---

## 3. Pendekatan

**Reuse helper yg ada + mirror web orchestration.** Tidak ekstrak helper baru (payment-void-helpers sudah teruji). Route = orchestration tipis (auth mobile + fetch + atomic tx body yg identik dgn web langkah 1-9). UI = screen/ekstensi baru dgn confirm dialog.

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| NEW | `src/app/api/mobile/loan-payment-void/route.ts` | POST `{ paymentId, reason? }` — mirror web void route, reuse `payment-void-helpers`, auth mobile. |
| NEW | `src/app/api/mobile/loan-payments/route.ts` | GET `?loanId=X` — list LoanPayment (+ `_count allocations`, status, voidedAt). |
| MODIFY | `mobile/src/screens/operator/DaftarPinjamanScreen.tsx` ATAU NEW `mobile/.../RiwayatAngsuranScreen.tsx` | Tampilkan riwayat angsuran loan + tombol VOID (confirm dialog + reason) → panggil API void. Wire di App.tsx bila screen baru. |
| REUSE | `src/lib/payment-void-helpers.ts` | Sudah ada + teruji — TIDAK diubah. |

---

## 5. Detail Komponen

### 5.1 API void (`api/mobile/loan-payment-void/route.ts`)
Mirror `api/loans/[id]/payments/[paymentId]/void/route.ts` langkah 1-9, perbedaan:
- Auth: `getMobileUser(request)` (bukan NextAuth); roles `operator`/`admin_sp` (sama web).
- Input: body `{ paymentId, reason? }` (bukan URL param). `loanId` di-derive dari `payment.loanId` (fetch payment dulu).
- Audit: `logAudit({ userId, userName, action:"UPDATE", module:"Pinjaman", ipAddress:"mobile-app", ... })` (mirror web field, tanpa `logAuditFromRequest`).
- Response: `{ message, detail, data:{ paymentId, status:"voided" } }`.
- Atomic tx body (web langkah 1-9) **identik**: fetch schedules fresh → `buildScheduleRollbackOps` → update schedules → early-settlement unallocated revert → fetch CB txns (`referenceType:"LoanPayment"`, `referenceId:payment.id`) → `calcPaymentCbReversalAmount` → reverse CashBankAccount balance (`Math.max(0, ...)`) → deleteMany CB txns → deleteMany LoanPaymentAllocation → update LoanPayment (status voided + voidedAt + voidedById + voidReason) → `buildLoanRollbackData` (+ early-settlement recalc outstanding) → update loan.
- Error catch: generic message (NO `error.message` leak — pelajaran dari Fase 2a), `console.error` server-side.

### 5.2 API list payments (`api/mobile/loan-payments/route.ts`)
GET `?loanId=X`:
- Auth `getMobileUser`; roles operator/admin/admin_sp.
- `prisma.loanPayment.findMany({ where:{ loanId }, orderBy:{ paymentDate:"desc" }, include:{ _count:{ select:{ allocations:true } } } })`.
- Return `data: payments.map(p => ({ id, paymentNo, amount, principalPortion, interestPortion, lateFeePortion, paymentType, status, voidedAt, paymentDate, allocCount: p._count.allocations }))`.

### 5.3 UI
- Lokasi: ekstensi `DaftarPinjamanScreen` (tombol "Riwayat Angsuran" per loan → buka list) ATAU screen baru `RiwayatAngsuranScreen` (lebih bersih, wire di App.tsx + Dashboard quick-action). **Putuskan di plan** (asumsi: screen baru `RiwayatAngsuranScreen` agar DaftarPinjaman tidak bengkak).
- List: tiap payment card (paymentNo, tanggal, amount, status badge incl. "VOID"). Tombol "Batalkan (VOID)" hanya utk payment `status !== "voided"` + loan active.
- Confirm: dialog (Alasan input, default "Dibatalkan oleh Operator") → POST void API → toast sukses/gagal → refresh list.

---

## 6. Alur Data
| Aksi | Record di-reverse | Hasil |
|---|---|---|
| Void angsuran reguler | schedule rollback (per alokasi) + CB reverse + hapus allocation + LoanPayment voided + loan counter reverse | Pinjaman kembali ke state pre-pembayaran |
| Void pelunasan dipercepat | + revert unallocated schedules + recalc outstanding from schedules + loan `paid_off`→`active` | Pinjaman re-activated |

---

## 7. Testing & Verifikasi
- **API void:** tidak ada helper baru (reuse tested). Verifikasi `npx tsc --noEmit` + diagnostic before/after (lihat catatan). TDD tidak wajib (logic di helper yg sudah teruji) — tapi bisa tambah test integrasi ringan jika memungkinkan.
- **API list:** typecheck + manual.
- **UI:** manual Expo (deferred, no emulator). Confirm dialog, reason, refresh, badge VOID.
- **Diagnostic (opsional):** `scripts/diagnose-mobile-void-angsuran.ts` — cekLoanPayment mobile (`PAY-M-*`) void-able count (before fix belum bisa di-void via mobile).
- Regresi: `npm run test` (0 baru), `npx tsc --noEmit`.

---

## 8. Error Handling & Edge Cases
- Payment sudah voided → 400.
- Loan voided/written_off → 400 (tidak bisa void payment).
- Payment tidak punya CB (cashBankAccountId null / impor) → skip CB reversal (web step 5 guard `payment.cashBankAccountId && cbReversalAmount > 0`).
- Saldo CB setelah reverse `< 0` → `Math.max(0, ...)` (mirror web).
- Early-settlement void → recalc outstanding dari schedule aktual (bukan payment.portion).

---

## 9. Keamanan & RBAC
- Gate `operator`/`admin_sp` (mirror web). Tidak tambah endpoint surface utk non-staff.
- Catatan (sama Fase 2): tidak ada scope per-loan/branch — pre-existing systemic, Fase 4 RBAC hardening.
- Generic error (no leak). Audit log.

---

## 10. Rollout
1. API void route (reuse helpers) + list-payments route.
2. UI screen + confirm dialog.
3. (Opsional) diagnostic.
4. `npm run test` + `npx tsc --noEmit` + mobile tsc.
5. Commit `railway-migration`. EAS build batch (bukan per-fitur).

---

## 11. Risiko
| Risiko | Mitigasi |
|---|---|
| Reuse helper tapi mobile routing flat (bukan `[id]`) | Input via body `{ paymentId }`; loanId di-derive dari payment. Konsisten dgn konvensi mobile. |
| UI screen baru → wire App.tsx + nav | Plan detailkan wiring; ikuti pola screen operator existing. |
| Void mobile bisa dipakai utk loan跨-unit (RBAC) | Pre-existing systemic; Fase 4. |
| `payment-void-helpers` berubah di web | Helper stabil (reversal logic); low risk. |

---

## 12. Open Questions (resolve saat plan)
- UI: ekstensi DaftarPinjaman vs screen baru `RiwayatAngsuranScreen`? (Asumsi: screen baru.)
- list-payments: include `member`? (Asumsi: tidak — loan-scoped.)
- Void reason wajib atau opsional? (Asumsi: opsional, default "Dibatalkan oleh Operator", mirror web.)

---

*Dibuat: 2026-07-02 | Reuse payment-void-helpers + mirror web | Siap review → writing-plans.*
