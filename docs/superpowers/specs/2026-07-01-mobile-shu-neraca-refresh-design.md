# Refresh Mobile SHU (Laba Kotor) + Neraca (Ledger) — Design Spec

- **Tanggal:** 2026-07-01
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Audit mobile-app drift 2026-07-01 (3 sub-agent); memori `shu-pendapatan-dobel-hitung-2026`, `neraca-ledger-rebuild`; web route `/api/reports/shu` + `/api/reports/neraca`

---

## 1. Konteks & Masalah

Audit mobile app menemukan **2 layar laporan operator stale** vs kalkulasi web terkini:

**A. Laporan SHU mobile** (`mobile/src/screens/operator/LaporanSHUScreen.tsx`)
- Endpoint `/api/mobile/reports/shu-calculator/route.ts` SUDAH memakai `calculateSystemSHU` (kanonik) dan SUDAH men-forward `unitBreakdown` (baris 57).
- **Tapi:** (1) tidak memanggil `computeUnitGrossProfit` → field `unitGrossProfit` (Laba Kotor per Unit) absen dari response; (2) layar **tidak merender** `unitBreakdown` maupun Laba Kotor sama sekali.
- Akibat: operator mobile tidak melihat card "Laba Kotor per Unit" (Toko / Resto & Cafe / Cafe Lsp) yang sudah ada di web (fitur asli user 2026-06-30).

**B. Neraca mobile** (`mobile/src/screens/operator/NeracaScreen.tsx`)
- Endpoint `/api/mobile/reports/financial/route.ts` memakai **raw SQL atas `journal_lines`** (baris 32-57) — pendekatan **journal-only LAMA** yg sama dengan bug "simpanan = 0" (saldo SavingsAccount tidak terjurnal sbg neraca).
- Web sudah direbuild 2026-06-19 ke **ledger-based** via `buildBalanceSheet()` (`src/lib/services/neraca.ts`) — baca langsung SavingsAccount/Loan/CashBankAccount/Asset + SHU honest + plug "Selisih". Mobile belum ikut.
- Komplikasi: endpoint `/financial` yg sama juga melayani **LabaRugiScreen** (`mobile/.../LabaRugiScreen.tsx:29`) → bagian laba-rugi tidak boleh rusak.

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. Mobile SHU endpoint men-forward `unitGrossProfit` (memanggil `computeUnitGrossProfit` non-fatal, mirror web). Layar merender **card "Laba Kotor per Unit"** (3 baris: Toko / Resto & Cafe / Cafe Lsp; kolom Omzet, HPP, Laba Kotor).
2. Mobile `/financial` endpoint: bagian **neraca** diganti reshaping output `buildBalanceSheet()` ke bentuk layar yg sudah ada. Bagian **laba-rugi** tetap journal-based (tidak diubah).
3. Kedua layar tetap berfungsi; simpanan≠0 di Neraca mobile ter-fix.

**Non-Tujuan (di-luar scope):**
- Merubah kalkulasi web (`shu-calculator.ts`, `neraca.ts`, `shu-gross-profit.ts`) — sudah fix, hanya dipanggil.
- Rebuild laba-rugi mobile dari sumber lain (tetap journal YTD).
- Merender tabel per-unit (pendapatan/beban/laba) di SHU mobile — `unitBreakdown` tetap di-payload tapi tidak dirender (keputusan user: "Card Laba Kotor saja").
- Sentuh layar mobile lain (LabaRugi, BukuKas, dll).
- Menambah pagination/export di mobile SHU.

---

## 3. Pendekatan

Dipilih: **endpoint-level fix + 1 pure helper**, bukan rewrite layar.

- **SHU:** tambah pemanggilan `computeUnitGrossProfit(year, month)` (parallel `Promise.all` non-fatal, mirror `api/reports/shu/route.ts:23-29`) + sertakan `unitGrossProfit` di response. Layar tambah 1 card.
- **Neraca:** bagian neraca di `/financial` diambil dari `buildBalanceSheet()` lalu di-**reshape** ke shape mobile via pure helper `toMobileNeracaShape(bs)`. Layar praktis tak berubah (sudah render shape tsb).

Ditolak:
- Pisah endpoint `/api/mobile/reports/neraca` khusus (Option C): lebih bersih tapi sentuh LabaRugiScreen + tambah file; tidak sebanding untuk scope "refresh".
- Rebuild laba-rugi juga (Option B): risiko/effort lebih besar, laba-rugi tidak ter-flag stale.

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| MODIFY | `src/app/api/mobile/reports/shu-calculator/route.ts` | `Promise.all([calculateSystemSHU, computeUnitGrossProfit.catch(()=>[])])`; tambah `unitGrossProfit` ke response `data`. |
| MODIFY | `src/app/api/mobile/reports/financial/route.ts` | Bagian neraca (baris 72-98 saat ini) diganti: `const bs = await buildBalanceSheet(); const neraca = toMobileNeracaShape(bs);`. Bagian laba-rugi (baris 59-70) tetap. Import `buildBalanceSheet` + `toMobileNeracaShape`. |
| MODIFY | `mobile/src/screens/operator/LaporanSHUScreen.tsx` | Tambah card "Laba Kotor per Unit" setelah `inExRow` (sebelum `incomeDetails`). Render `data.unitGrossProfit` (array); sembunyikan jika kosong. |
| NEW | `src/lib/services/mobile-neraca-shape.ts` | Pure helper `toMobileNeracaShape(bs: BalanceSheetResult): MobileNeracaShape`. + types. |
| NEW | `src/__tests__/mobile-neraca-shape.test.ts` | Unit test reshape (round-trip, baris depresiasi, baris Selisih, konsistensi total). |
| NEW (opsional) | `scripts/diagnose-mobile-neraca-shu-parity.ts` | Snapshot vs prod Neon: bandingkan `neraca.totalAssets` (journal vs ledger) + `unitGrossProfit` vs web. |

**Prinsip isolasi:** logika reshape = pure function teruji; route = orchestration tipis; layar = render data yg sudah berbentuk.

---

## 5. Detail Komponen

### 5.1 Endpoint SHU (`api/mobile/reports/shu-calculator/route.ts`)

Ganti baris 22 (`const result = await calculateSystemSHU(year, month);`) menjadi:
```ts
const [result, unitGrossProfit] = await Promise.all([
  calculateSystemSHU(year, month),
  computeUnitGrossProfit(year, month).catch((err) => {
    console.error("computeUnitGrossProfit failed:", err);
    return [];
  }),
]);
```
Tambah import: `import { computeUnitGrossProfit } from "@/lib/services/shu-gross-profit";`

Tambah ke object `data` response (sebelum/sesudah `unitBreakdown`):
```ts
unitGrossProfit, // GrossProfitRow[] (3 baris: toko/resto/cafe_lsp) atau [] jika gagal
```

`GrossProfitRow = { unitType: string; label: string; omzet: number; hpp: number; labaKotor: number; margin: number; itemCount: number }`.

### 5.2 Pure helper `toMobileNeracaShape` (`src/lib/services/mobile-neraca-shape.ts`)

Input: `BalanceSheetResult` (dari `neraca.ts`):
```
{ asOf, assets: { current: BalanceSheetItem[], fixedGross: BalanceSheetItem[], accumulatedDepreciation: number, totalAssets: number },
  liabilities: { savings: BalanceSheetItem[], other: BalanceSheetItem[], totalLiabilities: number },
  equity: { items: BalanceSheetItem[], shuBerjalan, selisih, totalEquity }, isBalanced, meta }
```
dengan `BalanceSheetItem = { code: string; name: string; amount: number; source?: "ledger"|"journal"|"computed" }`.

Output: `MobileNeracaShape` (kompatibel dgn `NeracaScreen.tsx`):
```
{ assets: { current: Item[]; fixed: Item[]; totalCurrentAssets: number; totalFixedAssets: number; totalAssets: number },
  liabilities: { shortTerm: Item[]; longTerm: Item[]; totalLiabilities: number },
  equity: { items: Item[]; totalEquity: number },
  totalLiabilitiesAndEquity: number }
```
dengan `Item = { code: string; name: string; amount: number }` (field `source` di-drop).

Aturan mapping:
- `assets.current` ← `bs.assets.current` (kas/bank + Piutang Pinjaman + Persediaan).
- `assets.fixed` ← `[...bs.assets.fixedGross]` lalu **push** `{ code: "1499", name: "Akumulasi Penyusutan", amount: -bs.assets.accumulatedDepreciation }` **hanya jika** `accumulatedDepreciation !== 0`.
- `totalCurrentAssets` ← `sum(assets.current)`.
- `totalFixedAssets` ← `sum(assets.fixed)` (= gross − depresiasi = net).
- `totalAssets` ← `bs.assets.totalAssets` (= totalCurrent + fixed.net; konsisten dgn `totalCurrentAssets + totalFixedAssets`).
- `liabilities.shortTerm` ← `[...bs.liabilities.savings, ...bs.liabilities.other]` (Simpanan Pokok/Wajib/Sukarela + hutang jurnal).
- `liabilities.longTerm` ← `[]` (tidak dipakai layar).
- `liabilities.totalLiabilities` ← `bs.liabilities.totalLiabilities`.
- `equity.items` ← `bs.equity.items` (sudah memuat SHU berjalan + baris "Selisih Penyesuaian" jika tidak balanced).
- `equity.totalEquity` ← `bs.equity.totalEquity`.
- `totalLiabilitiesAndEquity` ← `totalLiabilities + totalEquity` (karena plug Selisih, ≈ totalAssets → layar tampil "Seimbang").

**Invarian uji:** `Math.abs(totalAssets − (totalCurrentAssets + totalFixedAssets)) < 1` dan (jika `bs.isBalanced`) `Math.abs(totalAssets − totalLiabilitiesAndEquity) < 1`.

### 5.3 Endpoint Neraca (`api/mobile/reports/financial/route.ts`)

Import: `import { buildBalanceSheet } from "@/lib/services/neraca"; import { toMobileNeracaShape } from "@/lib/services/mobile-neraca-shape";`

Ganti blok susun neraca (baris 72-98: `currentAssets`/`fixedAssets`/`totalCurrentAssets`/`totalFixedAssets`/`totalAssets`/`currentLiabilities`/`totalLiabilities`/`equityItems`/`hasShuAccount`/`totalEquity`) dengan:
```ts
const bs = await buildBalanceSheet();
const neraca = toMobileNeracaShape(bs);
```
Pertahankan blok laba-rugi (baris 59-70: `revenueItems`/`expenseItems`/`totalRevenue`/`totalExpense`/`netIncome`) **apa adanya**.

Response `neraca` field sekarang diisi `neraca` (bukan object literal lama). Struktur object response JSON lain (`labaRugi`, `period`) tidak berubah.

> Catatan performa: `buildBalanceSheet()` memanggil `calculateSystemSHU(currentYear)` internal (berat). Endpoint `/financial` dipanggil saat focus NeracaScreen/LabaRugiScreen. Dapat di-cache di follow-up bila perlu — **bukan** scope spec ini.

### 5.4 Layar SHU (`LaporanSHUScreen.tsx`)

Tambah blok card setelah `inExRow` (sekitar baris 185, sebelum `incomeDetails`):
```tsx
{/* Laba Kotor per Unit */}
{Array.isArray(data.unitGrossProfit) && data.unitGrossProfit.length > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>🏷️ Laba Kotor per Unit</Text>
    <Text style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
      Pendapatan bersih item terjual = Omzet − HPP
    </Text>
    {data.unitGrossProfit.map((u: any) => (
      <View key={u.unitType} style={styles.detailRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailLabel}>{u.label}</Text>
          <Text style={{ fontSize: 10, color: "#94a3b8" }}>
            Omzet {formatRupiah(u.omzet)} · HPP {formatRupiah(u.hpp)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#10B981" }}>
            {formatRupiah(u.labaKotor)}
          </Text>
          <Text style={{ fontSize: 10, color: "#94a3b8" }}>{u.margin}% margin</Text>
        </View>
      </View>
    ))}
  </View>
)}
```
Reuse `styles.section`/`sectionTitle`/`detailRow`/`detailLabel` yg sudah ada. Tidak ada style baru wajib.

---

## 6. Alur Data (verified)

| Sumber data | Mobile sebelum | Mobile sesudah |
|---|---|---|
| SHU kalkulasi | `calculateSystemSHU` ✅ | `calculateSystemSHU` ✅ (parallel) |
| Laba Kotor per Unit | ❌ tidak dipanggil | `computeUnitGrossProfit` → `unitGrossProfit` ✅ |
| unitBreakdown | di-payload, tak dirender | di-payload, tak dirender (sama) |
| Neraca | raw SQL journal (simpanan=0) ❌ | `buildBalanceSheet` (ledger) → reshape ✅ |
| Laba-rugi | raw SQL journal YTD | raw SQL journal YTD (sama) |

---

## 7. Testing & Verifikasi

### Unit test (pure helper)
File `src/__tests__/mobile-neraca-shape.test.ts`:
- **basic mapping:** fixture `BalanceSheetResult` (kas + piutang + persediaan; simpanan pokok/wajib; modal) → assert shape mobile, `totalAssets` konsisten, `shortTerm` = savings+other.
- **depresiasi:** fixture dgn `accumulatedDepreciation > 0` → assert baris `1499` muncul dgn amount negatif & `totalFixedAssets` = net.
- **selisih plug:** fixture `isBalanced=false` dgn equity items memuat "Selisih" → assert `totalLiabilitiesAndEquity ≈ totalAssets`.
- **balanced:** fixture `isBalanced=true` → assert `Math.abs(totalAssets − totalLiabilitiesAndEquity) < 1`.
- **zero:** fixture semua-nol (no current, no fixed, accum=0) → tidak crash, baris depresiasi tidak di-push.

### Diagnostic vs prod Neon (opsional, sebelum deploy)
`scripts/diagnose-mobile-neraca-shu-parity.ts` (read-only, `NODE_ENV=production npx tsx --env-file=.env`):
- Jalankan `buildBalanceSheet()` → cetak `totalAssets`, `totalLiabilities`, `totalEquity`, `isBalanced`.
- Bandingkan dgn query journal-only lama (snapshot angka "simpanan" harus ≠ 0 setelah ledger).
- Jalankan `computeUnitGrossProfit(2026)` → cetak 3 baris (harus match web card: Toko/Resto/Cafe Lsp).

### Regresi
- `npm run test` — 0 regresi (selain pre-existing split-bill/batch-navigation/floor-plan).
- `npx tsc --noEmit` — tidak tambah error baru (abaikan pre-existing di `api/mobile/toko/shifts/[id]` + seed-*.ts).
- Verifikasi manual Expo: buka LaporanSHU (card Laba Kotor muncul), Neraca (simpanan terisi, badge Seimbang/Selisih), LabaRugi (tetap jalan).

---

## 8. Error Handling & Edge Cases

- `computeUnitGrossProfit` gagal → `.catch(() => [])` → `unitGrossProfit=[]` → card disembunyikan (conditional render). SHU lain tetap tampil.
- `buildBalanceSheet` melempar → ditangkap `try/catch` route → 500 + log (sama pola lama). Layar menampilkan state error/fallback.
- `accumulatedDepreciation = 0` → baris 1499 tidak di-push (hindari baris nol).
- Unit store dgn omzet 0 → `computeUnitGrossProfit` tetap kembalikan baris (label, 0,0,0,0); card tetap valid.
- `asOfDate` param: `buildBalanceSheet` selalu pakai hari ini (`asOf = new Date()`). NeracaScreen tidak mengirim `asOfDate` → tidak ada regresi. (Menghormati `asOfDate` = follow-up.)

---

## 9. Keamanan & RBAC

- Kedua endpoint sudah membatasi `operator`/`admin`/`admin_sp` (`shu-calculator/route.ts:11`, `financial/route.ts:19`). Tidak ubah gate, tidak tambah endpoint → tidak tambah surface.
- `buildBalanceSheet` & `computeUnitGrossProfit` read-only (tidak tulis DB). Aman vs prod.

---

## 10. Rollout

1. TDD: tulis `mobile-neraca-shape.test.ts` (RED) → implement `toMobileNeracaShape` (GREEN).
2. Modify SHU endpoint (+ `unitGrossProfit`) + Neraca endpoint (reshape) — tipis.
3. Modify `LaporanSHUScreen` (card).
4. (Opsional) diagnostic vs prod Neon.
5. `npm run test` + `npx tsc --noEmit`.
6. Commit ke `railway-migration` (auto-deploy). Verifikasi manual primkoppol.site / Expo.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Reshape mengubah angka Neraca mobile drastis (dari journal→ledger) → user terkejut | Itulah tujuannya (fix simpanan=0); dokumentasi perubahan di changelog + screenshot before/after. |
| `buildBalanceSheet` berat (`calculateSystemSHU` internal) → load Neraca lambat | Dapat di-cache follow-up; untuk koperasi 1-cabang masih acceptable. Bukan scope. |
| LabaRugiScreen rusak krn endpoint `/financial` diubah | Bagian laba-rugi TIDAK disentuh (tetap raw SQL); test manual layar LabaRugi pasca-deploy. |
| Field `unitGrossProfit` tiba-tiba `undefined` di app lama (cache) | Client sudah defensive (`Array.isArray` check); restart app bersihkan cache. |
| `source` field di-drop saat reshape → layar error? | Layar hanya baca `code`/`name`/`amount` (verified `NeracaScreen.tsx:67-69`); aman. |

---

## 12. Open Questions (resolve saat plan)

- Penempatan card Laba Kotor: persis setelah `inExRow` atau setelah incomeDetails? (Asumsi: setelah `inExRow`, sebelum incomeDetails — dekat konteks pendapatan.)
- Tampilkan `margin`% dan `itemCount` di card, atau hanya Omzet/HPP/Laba Kotor? (Asumsi: Omzet+HPP di sub-label, Laba Kotor+margin di kanan; itemCount disembunyikan.)
- Helper file name: `mobile-neraca-shape.ts` (services/) vs `src/lib/mobile/neraca-shape.ts`? (Asumsi: `src/lib/services/mobile-neraca-shape.ts` — konsisten dgn `operational-income-helpers.ts`.)

---

*Dibuat: 2026-07-01 | Pendekatan "endpoint fix + 1 pure helper" disetujui user | Siap untuk review → writing-plans.*
