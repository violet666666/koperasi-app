# Laba Kotor per Unit (Toko/Resto/Cafe LSP) + Fix Tabel Per-Unit SHU — Design Spec

- **Tanggal:** 2026-06-30
- **Branch:** `railway-migration`
- **Status:** Draft (menunggu review)
- **Terkait:** Audit SHU 2026-06-30 (dobel-hitung + Prisma JSON NULL bug); mirror pola `src/lib/services/shu-calculator.ts` & `neraca.ts`; memori `prisma-json-null-bug`, `shu-pendapatan-dobel-hitung-2026`

---

## 1. Konteks & Masalah

Audit empiris Laporan SHU vs DB produksi Neon (2026-06-30) menemukan **tiga bug berlapis** pada perhitungan pendapatan/beban per unit:

### Bug A — Dobel-hitung CB mirror di `unitBreakdown.revenue`
`shu-calculator.ts:542-562` menjumlahkan `StoreSale + UnitTransaction + CB income` tanpa dedup. Alur POS cash/QRIS (`api/toko/sales`, `api/unit-layanan/sales`) menciptakan **dua record** untuk satu penjualan (StoreSale/UnitTransaction **dan** CashBankTransaction `pendapatan_toko`/`pendapatan_unit`), sehingga revenue per-unit terhitung ganda.

**Bukti (DB prod 2026):** cuci_mobil — UnitTransaction Rp 86.950.000 ≈ CB `pendapatan_unit` Rp 87.310.120 (record penjualan yang sama); ditampilkan Rp 174.260.120, seharusnya ~Rp 87.000.000. Join decisif: 2.539/2.571 baris CB `pendapatan_unit` punya `transactionNo` cocok dgn UnitTransaction.

### Bug B — Prisma JSON NULL bug pada filter void StoreSale
Kalkulator memakai `NOT: { metadata: { path: ["isVoided"], equals: true } }` di `storeSalesByUnit` (groupBy), `soldItems` (COGS), dan `storeContrib` anggota. Filter ini **mengecualikan penjualan aktif** saat key `isVoided` tidak ada di metadata (mayoritas StoreSale) → membuang hampir semua penjualan.

**Bukti (DB prod 2026):**
```
StoreSale toko TANPA filter void: Rp 159.423.900  ← omzet asli
StoreSale toko DGN filter void  : Rp 0             ← yg dipakai kalkulator (BUG)
```
Inilah sebabnya `StoreSale` tampak Rp 0 di tabel per-unit (bukan data hilang). Bug sistemik ini juga membuat COGS (`soldItems`) ~Rp 0 → totalExpense understated.

### Bug C — (out-of-scope, dicatat) Dobel-hitung di summary card "Total Pendapatan"
Journal path: `totalIncome` = JournalLine income (akun 4201 type=income, Rp 239.962.800) + CB non-journaled `pendapatan_toko`+`pendapatan_unit` (Rp 272.813.920). Keduanya dari penjualan POS yg sama → ~Rp 240jt dobel. **Ditangani spec terpisah.**

### Kebutuhan fitur baru
Operator ingin melihat **Laba Kotor per Unit (Harga Jual − HPP)** untuk Toko, Resto & Cafe, dan Cafe LSP di Laporan SHU — sebagai indikator profitabilitas unit ber-inventory (unit jasa spt cuci_mobil tidak punya HPP).

---

## 2. Tujuan & Non-Tujuan

**Tujuan:**
1. Card baru **"Laba Kotor per Unit"** di `/laporan/shu` menampilkan Omzet, HPP, Laba Kotor, Margin % untuk Toko / Resto & Cafe / Cafe LSP — dihitung dari `StoreSaleItem` (level item) sehingga benar secara konstruksi.
2. Memperbaiki tabel **"Pendapatan Per Unit"** yg sudah ada (section `unitBreakdown` kalkulator): (a) filter void yg benar, (b) dedup CB mirror — agar dua view di SHU konsisten & benar.

**Non-Tujuan (di-luar scope, spec terpisah):**
- Summary card "Total Pendapatan" dobel-hitung (Bug C).
- COGS global di `totalExpense` (`soldItems` void bug mempengaruhi `netSurplus`).
- Void-filter bug sistemik di 15+ file lain (`prisma-json-null-bug`).
- Unit jasa (cuci_mobil, barbershop, dll) di card Laba Kotor — tidak punya HPP.
- Sinkronisasi mobile.

---

## 3. Pendekatan (Approach A — pure-function card + fix tabel terkandung)

Dipilih: **Approach A**. Card baru via pure helper teruji + perbaikan kalkulator dibatasi hanya di section `unitBreakdown`.

Ditolak:
- **Approach B (card saja)** — tabel per-unit tetap salah sementara; menyalahi pilihan user "card + fix tabel".
- **Approach C (overhaul penuh)** — memperbaiki void-filter di SEMUA query SHU (totalIncome, COGS, storeContrib); scope & risiko regresi besar, semua angka SHU berubah sekaligus.

---

## 4. Arsitektur & File

| Aksi | File | Isi |
|---|---|---|
| NEW | `src/lib/services/shu-gross-profit.ts` | Pure helper `aggregateGrossProfit(items, unitGroups)` + fetcher `computeUnitGrossProfit(start, end)` + types. |
| NEW | `src/__tests__/shu-gross-profit.test.ts` | Unit-test pure helper (omzet/hpp/margin, roll-up alias, eksklusi voided, fallback costPrice, div-by-zero). |
| MODIFY | `src/lib/services/shu-calculator.ts` | Fix `unitBreakdown`: ganti `storeSalesByUnit` & `storeSalesByMethod` (groupBy+NOT bug) → findMany+agregasi JS dgn filter void benar; hapus merge `incomeByUnit` dari revenue. |
| MODIFY | `src/app/api/reports/shu/route.ts` | Panggil `computeUnitGrossProfit()`, passthrough sebagai `unitGrossProfit` di response. |
| MODIFY | `src/app/(protected)/laporan/shu/page.tsx` | Tambah card "Laba Kotor per Unit" + type `UnitGrossProfit` di interface `SHUData`. |
| NEW (diagnostik) | `scripts/diagnose-shu-hpp-per-unit.ts` | SUDAH ADA (dibuat saat audit). Dipakai sbg before/after verifikasi. |

**Prinsip isolasi:** semua logika agregasi laba kotor di pure helper (array-in/array-out) → teruji tanpa DB. Fetcher tipis baca Prisma. Page hanya presentasi. Fix kalkulator terkandung di section `unitBreakdown` saja — tidak menyentuh path totalIncome/fallback.

---

## 5. Detail Komponen

### 5.1 Pure helper `aggregateGrossProfit()` — `shu-gross-profit.ts`

```ts
export interface GrossProfitRow {
  unitType: string;       // "toko" | "resto" | "cafe_lsp"
  label: string;          // "Toko PRIMKOPPOL" | "Resto & Cafe" | "Cafe LSP"
  omzet: number;          // Σ subtotal (harga jual)
  hpp: number;            // Σ (costPrice ?? product.costPrice) × quantity
  labaKotor: number;      // omzet − hpp
  margin: number;         // labaKotor / omzet × 100 (0 jika omzet 0), dibulatkan 2 desimal
  itemCount: number;      // jumlah baris item
}

// Input: item mentah dari Prisma + mapping grup unit (dgn alias).
// Output: satu baris per grup unit, urut omzet desc.
export function aggregateGrossProfit(
  items: RawStoreSaleItem[],
  unitGroups: { unitType: string; label: string; aliases: string[] }[]
): GrossProfitRow[];
```

**Aturan:**
- Roll-up alias: `resto_cafe` & `coffe_latar` → grup `resto` (via `STORE_SALE_ALIASES`). `toko` & `cafe_lsp` tanpa alias.
- HPP per item: `costPrice > 0 ? costPrice : product.costPrice ?? 0` (konsisten dgn `shu-calculator.ts:298`).
- Voided item **sudah disaring di fetcher** sebelum masuk helper (helper murni terima item aktif).

**Nuansa omzet (subtutal vs totalAmount):** Card memakai `StoreSaleItem.subtotal` (nilai barang), sedangkan tabel per-unit memakai `StoreSale.totalAmount` (subtotal + takeaway surcharge). Selisih ~Rp 3,5jt (toko 2026) = takeaway surcharge. Ini **by design**: "Laba Kotor = Harga Jual − HPP" mengukur margin barang, bukan termasuk biaya layanan takeaway. Ditetapkan eksplisit agar tidak dilihat sbg inkonsistensi bug.

### 5.2 Fetcher `computeUnitGrossProfit(start, end)` — `shu-gross-profit.ts`

```ts
export async function computeUnitGrossProfit(start: Date, end: Date): Promise<GrossProfitRow[]> {
  const items = await prisma.storeSaleItem.findMany({
    where: { sale: { createdAt: { gte: start, lte: end }, unitType: { in: ALL_STORE_UNIT_TYPES } } },
    select: { subtotal: true, costPrice: true, quantity: true,
              sale: { select: { metadata: true } },
              product: { select: { costPrice: true } } },
  });
  // Filter void di JS (HINDARI Prisma JSON NULL bug)
  const active = items.filter(it => !((it.sale?.metadata as any)?.isVoided));
  return aggregateGrossProfit(active, STORE_UNIT_GROUPS);
}
```
`ALL_STORE_UNIT_TYPES = ["toko", "resto", "resto_cafe", "coffe_latar", "cafe_lsp"]`; `STORE_UNIT_GROUPS` pakai label dari `UNIT_TYPES`.

### 5.3 Fix `unitBreakdown` di `shu-calculator.ts`

**(a) Void filter — ganti 2 query groupBy:**
- `storeSalesByUnit` (baris ~433): dari `prisma.storeSale.groupBy({..., NOT: {metadata path}})` → `prisma.storeSale.findMany({where:{createdAt, unitType: {in: storeUnitTypes}}, select:{unitType, totalAmount, metadata}})` lalu agregasi JS: saring `!metadata.isVoided`, kelompokkan per `unitType` (roll-up alias via `STORE_SALE_ALIASES`), jumlahkan `totalAmount` + count.
- `storeSalesByMethod` (baris ~477): sama, tambah group by `paymentMethod` di JS.

**(b) Dedup — hapus merge CB income dari revenue (baris ~556-562):**
Hapus blok `for (const i of incomeByUnit) { unitRevenueMap[ut].revenue += ... }`. CB `pendapatan_toko`/`pendapatan_unit` adalah mirror dari StoreSale/UnitTransaction; sumber truth revenue adalah StoreSale (store) + UnitTransaction (service). Query `incomeByUnit` boleh dihapus atau dibiarkan unused (prefer remove untuk menghindari dead code).

**Hasil ekspektasi (DB prod 2026):**
- cuci_mobil revenue: Rp 174.260.120 → ~Rp 86.950.000 (UnitTransaction saja).
- toko revenue: ~Rp 144.000.000 → ~Rp 200.000.000 (StoreSale asli ~Rp 159jt + UnitTx ~Rp 41jt, tanpa CB dobel).
- resto/cafe_lsp: StoreSale revenue muncul (sebelumnya 0 krn bug filter).

### 5.4 UI card — `page.tsx`

```tsx
{data.unitGrossProfit && data.unitGrossProfit.length > 0 && (
  <Card>
    <CardHeader><CardTitle>Laba Kotor per Unit (Toko / Resto & Cafe / Cafe LSP) — {periodDisplay}</CardTitle></CardHeader>
    <CardContent>
      <Table>
        <TableHead>Unit | Omzet | HPP | Laba Kotor | Margin</TableHead>
        {/* map data.unitGrossProfit → baris dgn warna laba kotor hijau/merah */}
      </Table>
    </CardContent>
  </Card>
)}
```
Ditempatkan **tepat di atas** tabel "Pendapatan Per Unit" yg sudah ada. Tipe `UnitGrossProfit` ditambahkan ke interface `SHUData` + `unitGrossProfit?: UnitGrossProfit[]`.

---

## 6. Alur Data

1. User buka `/laporan/shu`, pilih tahun (default 2026).
2. `reportsApi.shu()` → `GET /api/reports/shu?year=2026`.
3. Route memanggil `calculateSystemSHU(2026)` (utk data lama) DAN `computeUnitGrossProfit(start, end)` (utk card baru).
4. Response: `{ ...dataLama, unitBreakdown: <FIXED>, unitGrossProfit: [...] }`.
5. Page render: card Laba Kotor + tabel per-unit (yg sekarang benar).

---

## 7. Testing & Verifikasi

### Unit test (`shu-gross-profit.test.ts`)
- `aggregateGrossProfit` dasar: 3 item toko → omzet/hpp/laba/margin benar.
- Roll-up alias: item `resto_cafe` & `coffe_latar` masuk grup `resto`.
- Fallback costPrice: item `costPrice=null` → pakai `product.costPrice`.
- Item `costPrice=0` & `product.costPrice=0` → HPP 0 (bukan error).
- Margin div-by-zero: omzet 0 → margin 0 (bukan NaN).
- Pengurutan: urut omzet desc.

### Verifikasi before/after (diagnostic-vs-prod, pola repo)
- Re-run `scripts/diagnose-shu-unit-revenue-duplikasi.ts`: konfirmasi cuci_mobil revenue turun ~50% (174jt → ~87jt); toko tidak lagi 0 untuk StoreSale.
- Re-run `scripts/diagnose-shu-hpp-per-unit.ts`: card numbers cocok (Toko Rp 6.051.564 / Resto Rp 40.651.180 / Cafe LSP Rp 8.700.756 untuk 2026).
- `npm run test` — 0 regresi (373+ tests pass, kecuali pre-existing failures yg terdokumentasi: split-bill, batch-navigation, floor-plan/queue-system).

### Manual / E2E (opsional)
- Buka `/laporan/shu` prod-staging, verifikasi card muncul dgn angka masuk akal & tabel per-unit konsisten.

---

## 8. Error Handling & Edge Cases

- `costPrice` null/0 → fallback `product.costPrice`; jika keduanya 0 → HPP 0 (item dianggap tidak punya HPP).
- StoreSale tanpa items → tidak kontribusi (tidak crash).
- Voided sale → disaring di JS fetcher.
- `computeUnitGrossProfit` dibungkus try-catch di route; jika gagal, `unitGrossProfit = []` (card tidak render, SHU lain tetap jalan).
- Period change (year/month) → start/end konsisten dgn kalkulator utama (UTC midnight, lihat `calculateSystemSHU:144-153`).

---

## 9. Keamanan & RBAC

Card & API memakai auth yg sudah ada di `/api/reports/shu` (sudah ada `auth()` check per audit OPERATOR.md — meski ada catatan security terpisah, tidak di-scope di sini). Tidak menambah endpoint baru → tidak menambah surface serang.

---

## 10. Rollout

1. Implementasi TDD: tulis test `aggregateGrossProfit` dulu (merah) → implementasi (hijau).
2. Fix `unitBreakdown` di kalkulator.
3. Passthrough API + UI card.
4. Jalankan diagnostic before/after vs prod.
5. `npm run test` + `npm run lint`.
6. Commit ke `railway-migration` (auto-deploy Railway). Verifikasi manual di primkoppol.site.

---

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Angka tabel per-unit berubah signifikan (cuci_mobil turun 50%, toko naik) → operator kebingungan | Komunikasi: angka lama MEMANG salah (dobel/hilang). Sediakan diagnostic before/after sbg bukti. |
| Fix void-filter di `unitBreakdown` berdampak ke `memberRatio`/`memberDistribution`? | TIDAK — fix hanya di section `unitBreakdown` (baris 428-590). `memberRatio` pakai query terpisah (baris 596-620) yg TIDAK disentuh. Verifikasi dgn test. |
| Roll-up alias salah hitung (resto_cafe dobel/tdk terhitung) | Unit test eksplisit utk alias; cross-check dgn `diagnose-shu-hpp-per-unit.ts`. |

---

## 12. Open Questions (resolve sebelum/diskusi saat plan)

- Apakah card Laba Kotor juga ditambahkan ke export Excel/PDF SHU? (Asumsi awal: tidak dulu — cetakan fokus distribusi anggota. Konfirmasi saat plan.)
- Penempatan card: di atas atau di bawah tabel per-unit? (Asumsi: di atas.)

---

*Dibuat: 2026-06-30 | Pendekatan A disetujui user | Siap untuk review → writing-plans.*
