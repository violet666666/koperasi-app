# Neraca Berbasis Ledger — Design Spec

- **Tanggal:** 2026-06-18
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Audit NERACA 2026-06-18; mirror pola `src/lib/services/shu-calculator.ts`

---

## 1. Konteks & Masalah

Laporan Neraca (`/laporan/neraca`, API `GET /api/reports/neraca`) saat ini **100% bersumber dari `journal_lines`**. Audit + verifikasi empiris ke DB produksi (2026-06-18) menunjukkan jurnal **tidak dibuat** untuk transaksi terbesar koperasi:

- `/api/savings/*` — tidak ada `journal.create` (simpanan pokok/wajib/sukarela)
- `/api/loans/*` — tidak ada `journal.create` (pencairan & angsuran)
- `/api/cash-bank/*` — tidak ada `journal.create` (transfer/setor kas-bank)

Hanya penjualan toko/unit, transaksi Non-SP, dan jurnal manual yang membentuk jurnal.

**Bukti empiris (DB produksi):**

```
Jurnal (satu-satunya sumber neraca):  asset = Rp 177.294.400 | income = Rp 177.294.400
                                      liability = 0 | equity = 0 | expense = 0
Posisi nyata:  Simpanan anggota = Rp 9.341.154.850  |  Kas & Bank = Rp 2.917.259.784
```

Neraca lama menampilkan ≈ Rp 177 jt di kedua sisi (hanya kas & laba dari penjualan) — **<2% posisi nyata**, dan **Rp 0 simpanan**. Ini akar masalah yang sama dengan bug "SHU = 0" yang sudah ditambal di modul SHU dengan service yang membaca `CashBankTransaction`. Modul neraca belum ditambal.

**Bagian kode neraca yang SUDAH benar** (tidak diubah logikanya): saldo normal debit/credit, penanganan kontra-aset 1403, klasifikasi akun, auth RBAC, injeksi laba berjalan.

## 2. Tujuan & Non-Tujuan

**Tujuan:** Neraca menampilkan posisi keuangan **per hari ini** yang akurat dari sumber ledger paling andal, mencakup seluruh unit usaha (multi-unit), dan honest terhadap inkonsistensi data historis.

**Non-Tujuan (di-luar scope v1):**
- Neraca historis / point-in-time "per 31-Mei" (tidak ada tabel Saldo Awal untuk anchor).
- Filter per cabang (konsolidasi dulu).
- Drill-down per akun.
- Sinkronisasi mobile `/api/mobile/reports/financial` (follow-up).
- Memposting jurnal retroaktif untuk semua transaksi (itulah "Approach 3" yang ditolak).

## 3. Pendekatan (Approach 1 — Service pure-function)

Dipilih: **service pure-function** `buildBalanceSheet()` di `src/lib/services/neraca.ts`, dipanggil route API. Mirror pola `shu-calculator.ts` (pure helper teruji unit-test + orchestrator tipis baca prisma).

Ditolak:
- **Approach 2 (UNION SQL di route)** — sulit di-test, logic numpuk di route.
- **Approach 3 (posting jurnal penuh + backfill)** — sangat besar & berisiko di prod; menyinggung semua path transaksi.

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| NEW | `src/lib/services/neraca.ts` | `buildBalanceSheet(): Promise<BalanceSheetResult>` + pure helper mappers + types. |
| NEW | `src/__tests__/neraca.test.ts` | Unit-test pure helper. |
| MODIFY | `src/app/api/reports/neraca/route.ts` | Hapus SQL lama → panggil `buildBalanceSheet()`. Auth & error handling tetap. |
| MODIFY | `src/app/(protected)/laporan/neraca/page.tsx` | Konsumsi shape baru; hapus selector bulan/tahun; tampilkan baris baru + selisih; update export. |

**Prinsip isolasi:** semua logika akuntansi di `neraca.ts`. Pure helper terima array biasa (array-in/array-out) → teruji tanpa DB. Route & page hanya orchestration/presentasi.

## 5. Sumber Saldo & Mapping

Setiap baris diambil dari tabel paling andal (snapshot "per hari ini"). Mapping akun mengikuti chart of accounts di `prisma/seed.ts`.

| Baris Neraca | Sumber | Filter | Mapping akun |
|---|---|---|---|
| Kas Besar/Kecil, Bank BRI/BCA | `CashBankAccount.currentBalance` | `isActive=true`, `deletedAt=null`; group by `type`/`glAccountId` | 1101-1104 (Aktiva Lancar) |
| Piutang Pokok Pinjaman | `SUM(Loan.principalOutstanding)` | `status='active'` | 1201 |
| Piutang Bunga Berjalan | `SUM(Loan.interestOutstanding)` | `status='active'` | 1202 |
| Piutang Dihapusbukukan | `SUM(Loan.principalOutstanding)` | `status='written_off'` | baris terpisah (non-realisable) |
| Persediaan | `SUM(StoreProduct.stock × costPrice)` | `trackStock=true`, `isService=false`, `deletedAt=null`, semua `unitType` | 1301 |
| Aset Tetap (bruto) | `SUM(Asset.acquisitionCost)` | `status='active'`, `deletedAt=null` | 1401/1402 |
| (−) Akumulasi Penyusutan | `SUM(Asset.accumulatedDepreciation)` | sama | 1403 (kontra, tampil terpisah) |
| Simpanan Pokok/Wajib/Sukarela | `SavingsAccount.balance` group by `SavingsProduct.type` | `status='active'` (2-step: findMany product → aggregate, hindari bug `groupBy`+relation) | 2101/2102/2103 |
| Simpanan Lain (haji/umrah/lainnya) | sisa `SavingsAccount.balance` by type | sama | baris "Simpanan Lainnya" |
| Hutang Usaha & lainnya | jurnal (liability) | **kecuali** akun 2101-2103 (anti dobel) | 2201+ |
| Modal Disetor / Cadangan | jurnal (equity) | **kecuali** akun 3103 | 3101/3102 |

**Catatan `groupBy`:** `Prisma aggregate()/groupBy()` tidak mendukung relation filter (lihat CLAUDE.md). Untuk simpanan: `findMany` SavingsProduct → kumpulkan id per type → `aggregate` SavingsAccount dengan `productId: { in: [...] }`.

## 6. Ekuitas — SHU Tahun Berjalan & "Selisih"

Keputusan kunci (honest accounting, bukan plug-asal-balance):

1. **SHU Tahun Berjalan** = laba bersih **kumulatif** sejak awal, ledger-based: `income − expense` dari `CashBankTransaction` dengan **blacklist kategori yang sama** dengan `shu-calculator.ts` (`NON_INCOME_CATEGORIES`, `NON_EXPENSE_CATEGORIES`) — setoran simpanan, pokok pinjaman, pencairan, transfer BUKAN revenue/expense. Rentang tanggal tak terbatas (sejak awal). **Bukan residual/plug.**
2. **Selisih Penyesuaian:** `selisih = totalAssets − (totalLiabilities + modalLainnya + SHU_berjalan)`. Jika `|selisih| > 1`, tampilkan baris **"Selisih Penyesuaian (beda data/jurnal)"** sebagai plug di sisi ekuitas, dengan warna indikator + flag `isBalanced=false`. Tidak memaksa balance semu.

Alasan: SHU sebagai plug (= residual) menyembunyikan masalah data. Menghitung laba dari income statement + menampilkan selisih terbuka = laporan yang bisa diaudit.

## 7. Output Shape (typed)

```ts
interface BalanceSheetItem {
  code: string;
  name: string;
  amount: number;
  source?: string; // "ledger" | "journal" | "computed"
}

interface BalanceSheetResult {
  asOf: string; // ISO date hari ini
  assets: {
    current: BalanceSheetItem[];      // kas/bank, piutang pokok, piutang bunga, piutang dihapusbukukan, persediaan
    fixedGross: BalanceSheetItem[];   // 1401/1402 bruto
    accumulatedDepreciation: number;  // 1403 kontra
    totalAssets: number;              // current + (fixedGross − accumulatedDepreciation)
  };
  liabilities: {
    savings: BalanceSheetItem[];      // 2101/2102/2103 + Simpanan Lainnya
    other: BalanceSheetItem[];        // 2201+ dari jurnal
    totalLiabilities: number;
  };
  equity: {
    items: BalanceSheetItem[];        // 3101/3102 + SHU Tahun Berjalan + (Selisih jika ada)
    shuBerjalan: number;
    selisih: number;
    totalEquity: number;              // termasuk selisih
  };
  isBalanced: boolean;
  meta: {
    generatedAt: string;
    note?: string; // penjelasan "per hari ini" + sumber
  };
}
```

Identitas uji: `totalAssets − totalLiabilities − (equity.items excl. selisih) ≈ selisih`.

## 8. UI (page.tsx)

- Hapus selector bulan/tahun. Header: "Posisi per [tanggal hari ini]".
- Layout 2-kolom (AKTIVA / PASIVA) dipertahankan.
- Baris baru di sisi Aktiva: Persediaan, Piutang Bunga Berjalan, Piutang Dihapusbukukan, Aset Tetap bruto + baris "(−) Akumulasi Penyusutan".
- Baris "Selisih Penyesuaian" hanya muncul di Pasiva jika `selisih ≠ 0`, warna kuning/amber + badge "cek data".
- `formatCurrency` & format negatif `(…)` merah dipakai konsisten di kedua sisi.
- Export Excel/PDF (`buildExportRows`) diperbarui menyertakan semua baris baru.

## 9. Testing

- **Pure helper unit-test** (`src/__tests__/neraca.test.ts`, mirror `billing-detection.test.ts`):
  - `mapSavingsByType(accounts, products)` → grouping benar per type.
  - `sumLoanReceivables(loans)` → active vs written_off terpisah.
  - `computeInventory(products)` → `stock × costPrice`, skip service/non-track.
  - `computeFixedAssets(assets)` → gross, accumulated, net.
  - `buildEquityWithSelisih(modal, shu, totalAssets, totalLiab)` → selisih & total benar.
- **Integrasi ringan:** validasi `BalanceSheetResult` shape + identitas selisih.

## 10. Verifikasi Empiris (wajib sebelum dianggap selesai)

Setelah implement, panggil API ke DB produksi & bandingkan:

| Baris | Neraca lama | Target neraca baru (≈) |
|---|---|---|
| Simpanan (liability) | Rp 0 | ≈ Rp 9.341.154.850 |
| Kas & Bank (asset) | Rp 177.294.400 | ≈ Rp 2.917.259.784 |
| Piutang Pokok (asset) | Rp 0 | `SUM(Loan.principalOutstanding WHERE active)` |

Jika angka baru mendekati posisi nyata → fix terbukti. Selisih yang besar → indikator sisa data-quality issue (dilaporkan, tidak dipaksa).

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Net-income kumulatif salah (blacklist kategori) | Reuse blacklist `shu-calculator.ts` persis; unit-test edge (setoran, pokok, transfer) |
| Dobel hitung saat jurnal akhirnya diisi | Exclude 2101-2103 (liability) & 3103 (equity) dari sumber jurnal |
| `selisih` besar mengejutkan user | Label jelas + badge + penjelasan di `meta.note`; bukan error |
| Performa (banyak query) | Paralelkan `Promise.all`; aggregate di DB, bukan findMany semua |
| `Loan.principalOutstanding` stale (bug import lama) | Pakai field outstanding apa adanya; catat sebagai data-quality follow-up |

## 12. Follow-up (di-luar scope v1)

- Neraca historis (butuh tabel Saldo Awal / period snapshot).
- Filter cabang & per-unit breakdown.
- Sinkronisasi `/api/mobile/reports/financial` ke sumber yang sama.
- Audit & penyelesaian "Selisih" yang muncul (data-quality).
- (Jangka panjang) Approach 3: posting jurnal penuh agar laba-rugi & neraca self-consistent tanpa hybrid.
