# Mobile savings-tx — Atomic CashBank + AD-ART Pasal 26 — Design Spec

- **Tanggal:** 2026-07-01
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Fase 2b dari effort mobile drift-fix (`progress-update-mobile-app.md`); memori `mobile-drift-audit-fase1-2026-07.md`; web reference `src/app/api/savings/transactions/route.ts`

---

## 1. Konteks & Masalah

`src/app/api/mobile/savings-tx/route.ts` POST menyimpang dari route web `api/savings/transactions` di 4 hal:

1. **CashBank sync non-atomic** (baris 70-100): setoran/penarikan simpanan + update saldo rekening di `$transaction` array, TAPI sync CashBank di **try/catch terpisah "non-fatal"**. Jika sync CB gagal, saldo simpanan sudah berubah tapi buku kas meleset → integritas saldo rusak.
2. **Tidak ada cek AD-ART Pasal 26** — tidak blok penarikan Simpanan Pokok/Wajib saat anggota aktif (bisa tarik modal koperasi). Web blok via `!product.canWithdraw && member.status === "active"`.
3. **Category salah**: `setoran_simpanan`/`penarikan_simpanan` (bukan `savings` konsisten web). Berdampak ke laporan/kategorisasi CB.
4. **CB record tidak lengkap**: tidak set `referenceType`/`referenceId`/`unitType`/`memberId`/`paymentMethod`; `branchId: cbAccount.branchId` (OK) tapi `SavingsTransaction.branchId: 1` hardcoded.
5. CB `transactionNo`: `SV-M-...-${Date.now().toString(36)}` (bukan crypto).

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. Jadikan CashBank sync **atomic** dgn transaksi simpanan (single `$transaction(callback)`, mirror web): SavingsTransaction create + SavingsAccount update + CashBankTransaction create + CashBankAccount update — semua atau tidak sama sekali.
2. Tambah cek **AD-ART Pasal 26**: blok penarikan jika `!product.canWithdraw && member.status === "active"`.
3. CB category seragam `"savings"` + field lengkap (`referenceType:"SavingsTransaction"`, `referenceId`, `unitType:"simpan_pinjam"`, `memberId`, `paymentMethod: null`).
4. `branchId` konsisten pakai `account.branchId` (bukan hardcoded 1). CB transactionNo crypto.

**Non-Tujuan:**
- Sentuh cabang GET route, route mobile lain, atau web route.
- Tambah `paymentMethod` ke kontrak input mobile (UI SavingsTransactionScreen tidak kirim; follow-up bila perlu) — `paymentMethod: null` di record.
- Backfill transaksi mobile masa lalu (non-retroactive).
- Auto-detect CashBankAccount (mobile kirim `cashBankAccountId` eksplisit; tetap opsional — skip CB bila tidak diisi).

---

## 3. Pendekatan

**Port langsung dari web `api/savings/transactions`** (sudah proven). Perbedaan: auth mobile (`getMobileUser`, BUKAN NextAuth) + kontrak input (`accountId` + opsional `cashBankAccountId`, BUKAN `memberId`+`productId`+Zod).

Extract **1 pure helper** `isWithdrawalBlocked(args)` untuk rule AD-ART (testable, regulatory) — mirror inline check web (`route.ts:137`). Selebihnya orchestration di route.

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| NEW | `src/lib/savings-helpers.ts` | Pure `isWithdrawalBlocked({ type, canWithdraw, memberStatus })` + type. |
| NEW | `src/__tests__/savings-helpers.test.ts` | Unit test rule AD-ART. |
| MODIFY | `src/app/api/mobile/savings-tx/route.ts` | POST: fetch product (canWithdraw) + cek AD-ART; switch ke `$transaction(callback)` atomic; CB category `savings` + field lengkap + crypto txnNo. GET tidak disentuh. |
| NEW (opsional) | `scripts/diagnose-mobile-savings-tx.ts` | Read-only vs prod: hitung SavingsTransaction mobile (`STX-M-*`) + CB category-nya (before: `setoran_simpanan`/non-`savings`). |

---

## 5. Detail Komponen

### 5.1 Pure helper `isWithdrawalBlocked` (`src/lib/savings-helpers.ts`)
```ts
export interface WithdrawalCheckInput {
  type: string;            // "deposit" | "withdrawal"
  canWithdraw: boolean;    // SavingsProduct.canWithdraw
  memberStatus: string;    // Member.status
}
/**
 * AD-ART Pasal 26: Simpanan Pokok & Wajib TIDAK boleh ditarik selama anggota aktif.
 * Hanya Simpanan Sukarela (canWithdraw=true) yang dapat ditarik sewaktu-waktu.
 * Pure; unit-tested. Mirror web api/savings/transactions:137.
 */
export function isWithdrawalBlocked(input: WithdrawalCheckInput): boolean {
  return input.type === "withdrawal" && !input.canWithdraw && input.memberStatus === "active";
}
```

### 5.2 Route (`api/mobile/savings-tx/route.ts` POST)
Alur baru (preserve GET):

1. Auth `getMobileUser`; roles `operator`/`admin`/`admin_sp` (tidak berubah).
2. Body `{ accountId, amount, type, description, cashBankAccountId }` (tidak berubah). Manual validation (amount>0, type deposit|withdrawal).
3. Fetch `savingsAccount` `include: { member: { select: { id, name, memberNo, status } }, product: { select: { id, name, type, canWithdraw } } }`. 404 jika tidak ada / tidak aktif.
4. **AD-ART check**: `if (isWithdrawalBlocked({ type, canWithdraw: product.canWithdraw, memberStatus: member.status })) → 400` dgn pesan AD-ART (mirror web).
5. Withdrawal saldo check: `numAmount > currentBalance → 400`.
6. `newBalance` = deposit? + : -.
7. txNo: `STX-M-${crypto.randomBytes(4).readUInt32BE(0) % 1_000_000}`.
8. **Atomic `$transaction(async (tx) => {...})`**:
   - `tx.savingsTransaction.create({ ...branchId: account.branchId, paymentMethod: null, ... })`.
   - `tx.savingsAccount.update({ balance: newBalance })`.
   - Jika `cashBankAccountId`: `tx.cashBankAccount.findUnique` → 404-throw bila tidak aktif; `cashType` in/out; create `tx.cashBankTransaction` via `buildCashBankTransactionData({ accountId, branchId: account.branchId, type: cashType, category: "savings", amount, balanceBefore, balanceAfter, description, transactionDate: now, createdById, referenceType:"SavingsTransaction", referenceId: savingsTx.id, unitType:"simpan_pinjam", memberId: account.memberId, paymentMethod: null, transactionNo: <crypto> })`; `tx.cashBankAccount.update({ currentBalance })`.
   - `return savingsTx`.
9. `logAudit` CREATE Simpanan.
10. Response (preserve): `{ message, data: { newBalance } }`.

### 5.3 Crypto txnNo
`savingsTxNo = STX-M-${crypto.randomBytes(4).readUInt32BE(0) % 1_000_000}`; CB `transactionNo: CBT-${savingsTxNo}` atau crypto terpisah. Hindari `Date.now()`/`Math.random()`.

---

## 6. Alur Data

| Aspek | Mobile sebelum | Mobile sesudah | Web (reference) |
|---|---|---|---|
| Atomicity | array `$transaction` + CB try/catch terpisah | **single `$transaction(callback)`** | callback |
| AD-ART Pasal 26 | ❌ | ✅ (isWithdrawalBlocked) | ✅ |
| CB category | `setoran_simpanan`/`penarikan_simpanan` | **`savings`** | `savings` |
| CB referenceType/memberId/unitType | ❌ | ✅ | ✅ |
| branchId (SavingsTransaction) | hardcoded 1 | `account.branchId` | `member.branchId` |
| txnNo | Date.now | crypto | Math.random (pre-existing web) |

---

## 7. Testing & Verifikasi

### Unit test (pure helper) — TDD
`src/__tests__/savings-helpers.test.ts`:
- withdrawal + canWithdraw=false + active → blocked (true).
- withdrawal + canWithdraw=true → not blocked (Sukarela).
- withdrawal + canWithdraw=false + status `pensiun`/`resigned` → not blocked (bisa tarik saat keluar).
- deposit (any) → never blocked.
- type invalid → not blocked (handled elsewhere).

### Route
- `npx tsc --noEmit` (no new errors) + diagnostic before/after + manual Expo (deferred, no emulator).

### Diagnostic (opsional)
`scripts/diagnose-mobile-savings-tx.ts`: hitung `SavingsTransaction` dgn `transactionNo` prefix `STX-M-` + distribusi category CB terkait (before: `setoran_simpanan`/`penarikan_simpanan`; setelah fix: `savings`).

### Regresi
- `npm run test` — 0 regresi (3 pre-existing OK).

---

## 8. Error Handling & Edge Cases
- `cashBankAccountId` tidak aktif → throw di dalam tx → rollback (saldo simpanan TIDAK berubah). Ini perbaikan kunci vs behavior lama (non-fatal = saldo berubah, kas meleset).
- Penarikan melebihi saldo → 400 (tetap).
- AD-ART block → 400 dgn pesan jelas.
- Deposit ke rekening Pokok/Wajib → tidak diblokir (AD-ART hanya blok withdrawal).

---

## 9. Keamanan & RBAC
- Gate tidak berubah (`operator`/`admin`/`admin_sp`). Tidak tambah endpoint.
- Catatan (sama dgn 2a): tidak ada scope per-member/branch — pre-existing systemic, Fase 4 RBAC hardening.
- Crypto txnNo. Audit log dipertahankan.

---

## 10. Rollout
1. TDD helper: RED → GREEN.
2. Rewrite route POST (atomic callback + AD-ART + category savings + field lengkap).
3. (Opsional) diagnostic before/after.
4. `npm run test` + `npx tsc --noEmit`.
5. Commit `railway-migration` (deploy API). Verifikasi manual Expo.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Switch array→callback tx mengubah behavior | Mirror web (proven); callback strictly stronger (atomic read-modify-write). |
| AD-ART block mengubah UX (penarikan Pokok/Wajib kini ditolak) | Itu tujuannya (regulatory compliance); pesan error jelas. Check product.canWithdraw ada di schema. |
| Historis CB category `setoran_simpanan` tetap (non-retroactive) | Dokumentasi; laporan mungkin perlu handle kedua category sementara. Bisa follow-up backfill bila perlu. |
| `paymentMethod: null` | Nullable; UI follow-up. |

---

## 12. Open Questions (resolve saat plan)
- Helper file: `src/lib/savings-helpers.ts`? (Asumsi: ya.)
- CB transactionNo: `CBT-${savingsTxNo}` (reuse) atau crypto terpisah? (Asumsi: reuse savingsTxNo utk link.)
- Auto-detect CashBankAccount bila `cashBankAccountId` kosong? (Asumsi: TIDAK — skip CB, behavior existing.)

---

*Dibuat: 2026-07-01 | Port langsung dari web, disetujui pendekatannya | Siap review → writing-plans.*
