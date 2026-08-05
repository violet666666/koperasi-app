# "Catat Pemasukan" Bertipe (Transaksi Customer / Operasional) + Fix SHU Per-Unit — Design Spec

- **Tanggal:** 2026-06-30
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Audit alur "Catat Pemasukan" 2026-06-30; fix Task 5 `af1ae28` (regresi operational income di `unitBreakdown`); memori `shu-pendapatan-dobel-hitung-2026`

---

## 1. Konteks & Masalah

Audit alur **"Catat Pemasukan"** (tombol admin di halaman Laporan unit, `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx:968`) menemukan **income yatim di level unit**:

- Form POST ke `/api/unit/[slug]/operational-income` → create **satu `CashBankTransaction`** (`type=in`, `category="operational"`, `unitType`, `paymentMethod` cash/qris/lainnya) + increment saldo kas unit. **Tidak create UnitTransaction/StoreSale.** (`api/unit/[slug]/operational-income/route.ts:134-150`)
- Record ini **TIDAK muncul** di:
  - **Riwayat Transaksi unit** — `/api/unit-transactions` query `UnitTransaction`+`StoreSale` saja; CB tidak pernah di-query.
  - **SHU per-unit** — `unitBreakdown` (post-fix `af1ae28`) hanya baca StoreSale+UnitTransaction.
- Record ini **MUNCUL** di SHU **total** (`totalIncome`, via journal-path `nonJournaledIncome`; `operational` tidak ada di `NON_INCOME_CATEGORIES`).

**Kasus pemicu (Cafe LSP):** operator mencatat penjualan customer via "Catat Pemasukan" (kesalahan — seharusnya lewat POS). Akibatnya penjualan tsb mengisi saldo kas + total SHU, tapi **tidak terlihat** di riwayat transaksi LSP maupun di baris SHU per-unit LSP, dan tidak jadi poin jasa-usaha anggota pembeli.

**Kontribusi fix sebelumnya (mea culpa):** fix Task 5 (`af1ae28`) menghapus **semua** CB income dari `unitBreakdown` untuk membunuh dobel-hitung mirror POS. Itu benar untuk mirror (`pendapatan_unit`/`pendapatan_toko`), **TAPI ikut menghapus** `operational` (Catat Pemasukan) yg sah — sebelum fix itu, `operational` masuk `unitBreakdown` via `incomeByUnit` (karena `operational` tidak ada di `NON_INCOME_CATEGORIES`). Jadi eksklusi SHU per-unit untuk kasus ini sebagian adalah regresi dari fix saya sendiri.

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. Form "Catat Pemasukan" mendapat **"Jenis Pemasukan"**: **Transaksi Customer** (penjualan) atau **Pemasukan Operasional** (sewa/dll, default).
2. **Transaksi Customer** menciptakan **`UnitTransaction`** (+ CB `pendapatan_unit` mirror utk increment kas) sehingga otomatis masuk ke: riwayat transaksi ✅, SHU per-unit ✅, dan poin jasa-usaha anggota ✅ (bila `memberId` diisi). `memberId` **opsional** (walk-in/pengunjung biasa boleh kosong).
3. **Pemasukan Operasional** tetap CB-only (perilaku sekarang) **TAPI** `operational` kembali di-include di SHU per-unit (memperbaiki regresi + agar income non-customer unit tetap terhitung).
4. Pencegahan kesalahan LSP di masa depan secara struktural: operator yg mau catat penjualan customer dipaksa pilih "Transaksi Customer" (jadi transaksi proper).

**Non-Tujuan (di-luar scope):**
- Edit/void `UnitTransaction` hasil "Transaksi Customer" via form ini (ikut flow void UT existing — follow-up bila perlu). Form edit hanya utk jenis Operasional (CB) seperti sekarang.
- HPP/lab bersih utk "Transaksi Customer" (quick-sale tanpa item — by design tidak masuk card Laba Kotor; utk transaksi ber-inventory gunakan POS penuh).
- Sentuh summary card "Total Pendapatan", `memberRatio`, COGS global, atau void-bug sistemik (semua tetap deferred per spec sebelumnya).
- Menambah "Transaksi Customer" ke unit jasa (cuci_mobil dll) — sebenarnya jalan otomatis (UT universal), tapi UI form hanya di halaman Laporan unit (sdh ada di semua unit).

---

## 3. Pendekatan (B + fix operational)

Dipilih: **B (entry bertipe) + re-include operational di SHU per-unit**.

Ditolak:
- **A (inklusi sederhana — tampilkan operational di riwayat+SHU dgn badge)**: tidak memperbaiki akar masalah (kesalahan operator); income non-member tetap bukan transaksi proper; tidak masuk poin jasa anggota.
- **C (SHU per-unit saja)**: tidak mengatasi gejala riwayat; tidak mencegah kesalahan LSP.
- **Ide awal "tambah payment method 'Pemasukan Transaksi'"**: payment method tidak mengontrol record masuk laporan mana; lever yg benar adalah **tipe record** (CB vs UT).

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| MODIFY | `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` | Tambah field "Jenis Pemasukan" (Transaksi Customer / Operasional) + field "Anggota (opsional)" (tampil saat Transaksi Customer). Submit membawa `jenis` + `memberId`. |
| MODIFY | `src/app/api/unit/[slug]/operational-income/route.ts` | Branch pada `jenis`: "customer" → create `UnitTransaction` (+ CB `pendapatan_unit` utk cash/qris, increment kas, generate transactionNo) dalam `$transaction`; "operasional" → current behavior (CB `operational`). |
| MODIFY | `src/lib/services/shu-calculator.ts` | `unitBreakdown`: re-include CB income **non-mirror** (kategori `operational` + lainnya yg bukan `pendapatan_unit`/`pendapatan_toko`) ke revenue. |
| NEW (opsional) | `src/lib/services/unit-customer-sale.ts` | Pure/semi helper `recordUnitCustomerSale(tx, {...})` utk hindari duplikasi dgn `unit-layanan/sales` (diputuskan di plan). |
| NEW | `src/__tests__/operational-income-branch.test.ts` | Test logic branch jenis (bisa di-extract ke pure helper utk testability). |
| EXISTING | `scripts/diagnose-shu-unit-revenue-duplikasi.ts` | Verifikasi before/after operational re-include + mirror tetap exclude. |

**Prinsip isolasi:** logika "Transaksi Customer" bila kompleks di-extract ke helper teruji; route hanya orchestration; SHU fix adalah satu query filter di `unitBreakdown`.

---

## 5. Detail Komponen

### 5.1 Form (`unit/[unitSlug]/laporan/page.tsx`)
- Tambah state `incomeJenis: "operasional" | "customer"` (default `"operasional"`).
- Radio/Select "Jenis Pemasukan" di paling atas dialog `showIncomeDialog` (sebelum Nominal).
- Saat `incomeJenis === "customer"`: tampilkan field **"Anggota (opsional)"** (komponen pilih anggota yg sudah ada di repo, search by NRP/nama; boleh kosong).
- `handleSaveIncome` menyertakan `jenis` + `memberId` (jika customer) di FormData/JSON.
- Mode edit (`isEdit`): hanya utk jenis Operasional (record CB existing). Edit record Customer (UT) di-luar scope — disable select jenis saat edit, atau sembunyikan opsi customer saat edit.

### 5.2 API branch (`/api/unit/[slug]/operational-income/route.ts`)
Validasi: `jenis ∈ {"operasional","customer"}` (default `"operasional"`). `memberId` required-only-if… tidak; opsional. Jika `jenis==="customer"` dan `paymentMethod` tidak valid → 400.

Dalam `prisma.$transaction`:
- **`jenis === "customer"`:**
  1. Generate `transactionNo` (prefix unit, pola `UNIT_ABBR_TX` + DDMMYYYY + seq — konsisten dgn `unit-layanan/sales`).
  2. `tx.unitTransaction.create({ transactionNo, memberId: memberId ?? null, unitType, description, amount, paymentMethod, isPaid: true, paidDate: now, transactionDate: txDate, notes: "[Transaksi Customer - Catat Pemasukan]" + (receipt ref?), createdById })`.
  3. Untuk cash/qris: `findUnitAccount` + increment kas + `tx.cashBankTransaction.create({ ..., type:"in", category:"pendapatan_unit", unitType, paymentMethod, amount, description: "Pendapatan {unit} {method} - {transactionNo}", ... })` (mirror `unit-layanan/sales:166-213`). Untuk "lainnya": tidak increment kas (atau treat sesuai konvensi — detail di plan).
  4. Audit log.
  > Catatan: `memberId` divalidasi optional. Plafon-piutang check TIDAK berlaku (ini pembayaran langsung, bukan salary_cut).
- **`jenis === "operasional"` (default, current behavior):** create CB `operational` + increment kas + receipt upload (tidak berubah).

### 5.3 Fix SHU calculator (`shu-calculator.ts` — section `unitBreakdown`)
Tambah query CB income non-mirror + merge ke `unitRevenueMap`:
```ts
// CB income NON-MIRROR (operational, dll) — masuk revenue per unit.
// EXCLUDE mirror POS (pendapatan_unit/pendapatan_toko) supaya tidak dobel dgn StoreSale/UnitTransaction.
const MIRROR_INCOME_CATEGORIES = ["pendapatan_unit", "pendapatan_toko"];
const nonMirrorIncomeByUnit = await prisma.cashBankTransaction.groupBy({
    by: ['unitType'],
    where: {
        transactionDate: { gte: startDate, lte: endDate },
        type: "in",
        journalId: null,
        category: { notIn: [...NON_INCOME_CATEGORIES, ...VOID_CATEGORIES, ...MIRROR_INCOME_CATEGORIES] },
    },
    _sum: { amount: true }, _count: true,
});
// merge ke unitRevenueMap per canonical unit (ut = i.unitType || "_lainnya")
```
Hasil: `operational` (Catat Pemasukan) **kembali masuk** SHU per-unit; `pendapatan_unit`/`pendapatan_toko` (mirror POS) tetap exclude (no double-count); fix Task 5 preserved.

**Kategori apa saja yg re-include:** semua CB `type=in` `journalId=null` KECUALI mirror POS (`pendapatan_unit`,`pendapatan_toko`) + `NON_INCOME_CATEGORIES` + `VOID_CATEGORIES`. Ini mencakup `operational` (Catat Pemasukan) dan juga `jasa_pinjaman`/`dana_resiko`/`penalti_pelunasan` (income SP, di-atribusikan ke `unitType`-nya — biasanya `simpan_pinjam`/null). Ini **restore perilaku pre-Task-5** utk income non-mirror (bukan regresi baru); double-count hanya terjadi pada mirror, yg tetap di-exclude. Tidak ada double-count dgn StoreSale/UnitTransaction karena kategori SP tidak ada di tabel tsb.

---

## 6. Alur Data (verified matrix)

| Aksi "Catat Pemasukan" | Record | Riwayat | SHU per-unit | SHU jasa anggota |
|---|---|---|---|---|
| Transaksi Customer, memberId diisi | UT + CB pendapatan_unit | ✅ UT | ✅ UT revenue | ✅ jasa-usaha (member.unitTransactions) |
| Transaksi Customer, walk-in | UT + CB pendapatan_unit | ✅ UT | ✅ UT revenue | — |
| Pemasukan Operasional | CB operational | — (CB) | ✅ (re-include fix) | — |

---

## 7. Testing & Verifikasi

### Unit test
- API branch logic: extract ke pure helper jika memungkinkan (mis. `resolveIncomeCreatePayload(jenis, {...})` → `{ createUT: bool, category, ... }`). Test: customer → UT+CB pendapatan_unit; operasional → CB operational; memberId null ok; invalid jenis → error.
- SHU non-mirror filter: pastikan `operational` included, `pendapatan_unit`/`pendapatan_toko` excluded.

### Diagnostic before/after (vs prod Neon)
- Re-run `scripts/diagnose-shu-unit-revenue-duplikasi.ts`: setelah fix, `operational` muncul di revenue per unit; mirror tetap tidak dobel.
- Tambah section di diagnostic (atau script baru) utk mengukur: sum CB `operational` per unit 2026 → konfirmasi masuk ke `unitBreakdown` setelah fix.

### Regresi
- `npm run test` — 0 regresi (selain pre-existing).
- Verifikasi manual: "Catat Pemasukan" dgn jenis Customer (memberId diisi) → cek muncul di riwayat unit + baris SHU per-unit unit + poin jasa anggota naik.

---

## 8. Error Handling & Edge Cases

- `jenis` invalid → 400. `memberId` tidak ada di DB → 404 (saat diisi). `paymentMethod` invalid → 400.
- Quick-sale Customer tanpa item: by design tidak ada HPP/lab bersih (tidak masuk card Laba Kotor). Operator yg butuh tracking inventory → gunakan POS penuh.
- Backdate: `transactionDate` divalidasi ≤ hari ini (konsisten existing).
- Receipt foto: utk jenis Customer, simpan ref di `UnitTransaction.notes` (mis. `[RECEIPT:/api/uploads/N]`).
- CB `lainnya` utk Customer: tidak increment kas (atau konvensi di plan) — tidak boleh ganggu balance.

---

## 9. Keamanan & RBAC

- Form & route sudah admin-only (`isAdmin` di page, auth di route). Tidak tambah endpoint baru (branch di route existing) → tidak tambah surface.
- Plafon-piutang check TIDAK berlaku (bukan salary_cut).
- Audit log utk kedua jenis.

---

## 10. Rollout

1. TDD: test branch logic + SHU non-mirror filter.
2. Implementasi form + API + SHU fix.
3. Diagnostic before/after + `npm run test` + `npm run build`.
4. Commit ke `railway-migration` (auto-deploy). Verifikasi manual di primkoppol.site.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Duplikasi logic UT+CB dgn `unit-layanan/sales` | Extract helper `recordUnitCustomerSale()` (diputuskan di plan); atau reuse parsial. |
| Re-include `operational` tidak sengaja memasukkan kategori mirror lain | `MIRROR_INCOME_CATEGORIES` eksplisit + `NON_INCOME_CATEGORIES`/`VOID_CATEGORIES` tetap di-exclude; test + diagnostic. |
| Quick-sale Customer utk unit store (cafe_lsp) tanpa item → tidak masuk Laba Kotor card | By design (dokumentasi di form: "utk transaksi ber-inventory, gunakan POS"). |
| Edit mode form bercampur jenis | Disable jenis saat edit (hanya edit Operasional); edit Customer ikut void-UT flow terpisah. |
| Transaksi Customer tertanggal backdate → `unitBreakdown` (groupBy bulan) konsisten? | Ya, `transactionDate` dipakai utk range — sama dgn UT POS lain. |

---

## 12. Open Questions (resolve saat plan)

- Prefix `transactionNo` Customer: reuse `UNIT_ABBR_TX` (CM/RC/CL…) atau prefix baru (mis. `TC-`) utk membedakan dari POS? (Asumsi: reuse prefix unit + seq; dibedakan via `notes`/description.)
- CB `lainnya` utk Customer: increment kas atau skip? (Asumsi: skip — "lainnya" = non-kas.)
- Helper extraction: extract `recordUnitCustomerSale()` atau inline di route? (Asumsi: extract bila >1 pemanggil dgn `unit-layanan/sales`; else inline.)

---

*Dibuat: 2026-06-30 | Pendekatan B + operational fix disetujui user | Siap untuk review → writing-plans.*
