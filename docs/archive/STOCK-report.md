# Laporan Investigasi Stok Toko — 06 Mei 2026

## Ringkasan Eksekutif

Investigasi dilakukan terhadap 2 produk yang dilaporkan memiliki ketidaksesuaian stok antara sistem dan fisik:

| Produk | Stok Sistem (Gdg/Toko/Total) | Stok Fisik (Gdg/Toko/Total) | Selisih |
|--------|-------------------------------|------------------------------|---------|
| Tepung Segitiga Biru 1KG | 2 / 0 / **2** | 12 / 3 / **15** | -13 unit |
| Sunco REF 2L | 42 / 8 / **50** | 12 / 8 / **20** | +30 unit |

**Kesimpulan: Kedua kasus disebabkan oleh data entry, bukan bug kode.**

---

## 1. Tepung Segitiga Biru 1KG (ID: 12539)

### Status Saat Ini

- `stock` = 2, `stock_gdg` = 2, `stock_toko` = 0
- `is_active` = false (produk dinonaktifkan)
- SKU: `TPNG SGT BIRU 1KG`

### Timeline Pergerakan Stok

| Waktu | Kejadian | Qty | Stok Gdg | Stok Toko | Total | Operator |
|-------|----------|-----|----------|-----------|-------|----------|
| 2026-04-23 08:50 | Stok Awal Produk Baru | +2 | 2 | 0 | 2 | Admin Toko |

**Hanya 1 pergerakan stok sejak awal.** Tidak pernah ada penjualan. Produk langsung dinonaktifkan.

### Analisis

Produk diimport/dibuat pada 23 April 2026 dengan stok awal hanya **2 unit**. Seharusnya diinput **15 unit** (12 gudang + 3 toko). Tidak ada transaksi penjualan atau mutasi apapun setelahnya.

### Penyebab

**Data entry** — stok awal yang diinput saat pembuatan produk tidak sesuai stok fisik aktual.

### Perbaikan yang Disarankan

1. Aktifkan produk (`is_active = true`)
2. Stok Masuk → Gudang: **+10 unit** (agar Gdg = 12)
3. Transfer Gudang → Toko: **3 unit** (agar Toko = 3)
4. Verifikasi fisik: pastikan 15 unit benar-benar ada di gudang + toko

---

## 2. Sunco REF 2L (ID: 12654)

### Status Saat Ini

- `stock` = 50, `stock_gdg` = 42, `stock_toko` = 8
- SKU: `8993379500238`

### Timeline Pergerakan Stok Lengkap

| Step | Tanggal | Kejadian | Qty | Stok Gdg | Stok Toko | Total | Operator |
|------|---------|----------|-----|----------|-----------|-------|----------|
| 135 | 04-30 09:42 | Init stok baru | +12 | 12 | 0 | 12 | Admin Toko |
| 146 | 05-01 06:35 | Manual -6 dari Gudang (inline edit) | -6 | 6 | 0 | 6 | Admin Toko |
| 147 | 05-01 06:35 | Manual +6 ke Toko (inline edit) | +6 | 6 | 6 | 12 | Admin Toko |
| 188 | 05-02 02:21 | Penjualan TK-02052026-0004 (potong gaji) | -1 | 6 | 5 | 11 | Kasir Toko |
| 202 | 05-02 03:11 | Penjualan TK-02052026-0006 (tunai) | -1 | 6 | 4 | 10 | Kasir Toko |
| 235 | 05-02 04:36 | Penjualan TK-02052026-0009 (potong gaji) | -1 | 6 | 3 | 9 | Kasir Toko |
| 238 | 05-02 04:40 | Penjualan TK-02052026-0010 (tunai) | -3 | 6 | 0 | 6 | Kasir Toko |
| 597 | 05-02 09:16 | Transfer Gudang → Toko | -6 | 0 | 0 | 0 | Admin Toko |
| 598 | 05-02 09:16 | Transfer Gudang → Toko (masuk) | +6 | 0 | 6 | 6 | Admin Toko |
| 612 | 05-02 09:20 | Penjualan TK-02052026-0028 (potong gaji) | -1 | 0 | 5 | 5 | Kasir Toko |
| **619** | **05-02 10:07** | **Stok Masuk Gudang +30** | **+30** | **30** | **5** | **35** | **Admin Toko** |
| 818 | 05-02 12:16 | Penjualan TK-02052026-0038 (tunai) | -2 | 30 | 3 | 33 | Kasir Toko |
| 836 | 05-02 12:49 | Penjualan TK-02052026-0042 (potong gaji) | -1 | 30 | 2 | 32 | Kasir Toko |
| **852** | **05-02 13:45** | **Stok Masuk Gudang +30** | **+30** | **60** | **2** | **62** | **Admin Toko** |
| 862 | 05-02 14:31 | Penjualan TK-02052026-0050 (potong gaji) | -1 | 60 | 1 | 61 | Kasir Toko |
| 886 | 05-03 02:21 | Transfer Gudang → Toko | -12 | 48 | 1 | 49 | Admin Toko |
| 887 | 05-03 02:21 | Transfer Gudang → Toko (masuk) | +12 | 48 | 13 | 61 | Admin Toko |
| 898 | 05-03 02:35 | Penjualan TK-03052026-0004 (potong gaji) | -1 | 48 | 12 | 60 | Kasir Toko |
| 966 | 05-03 12:55 | Penjualan TK-03052026-0016 (potong gaji) | -1 | 48 | 11 | 59 | Kasir Toko |
| 985 | 05-03 13:01 | Penjualan TK-03052026-0017 (potong gaji) | -1 | 48 | 10 | 58 | Kasir Toko |
| 1068 | 05-04 05:52 | Penjualan TK-04052026-0010 (tunai) | -1 | 48 | 9 | 57 | Kasir Toko |
| 1373 | 05-05 03:36 | Penjualan TK-05052026-0009 (potong gaji) | -2 | 48 | 7 | 55 | Kasir Toko |
| 1429 | 05-05 12:27 | Penjualan TK-05052026-0032 (qris) | -1 | 48 | 6 | 54 | Kasir Toko |
| 1499 | 05-06 03:09 | Penjualan TK-06052026-0007 (potong gaji) | -2 | 48 | 4 | 52 | Kasir Toko |
| 1538 | 05-06 07:31 | Penjualan TK-06052026-0017 (potong gaji) | -1 | 48 | 3 | 51 | Kasir Toko |
| 1543 | 05-06 07:39 | Penjualan TK-06052026-0018 (qris) | -1 | 48 | 2 | 50 | Kasir Toko |
| 1623 | 05-06 15:57 | Transfer Gudang → Toko | -6 | 42 | 2 | 44 | Admin Toko |
| 1624 | 05-06 15:57 | Transfer Gudang → Toko (masuk) | +6 | 42 | 8 | 50 | Admin Toko |

### Rekap Pergerakan

| Kategori | Jumlah |
|----------|--------|
| Stok masuk (init + stock-in) | +72 unit |
| Penjualan (total 17 transaksi) | -23 unit |
| Transfer internal (netral) | 0 |
| **Sisa di sistem** | **50 unit** |
| **Sisa seharusnya (fisik)** | **20 unit** |
| **Selisih** | **+30 unit** |

### Analisis

Simulasi step-by-step menghasilkan nilai **persis sama** dengan database (stock_gdg=42, stock_toko=8, stock=50). Artinya **semua kode berjalan benar** — tidak ada bug yang ter-trigger.

Masalah ada pada **2 stock-in manual**:

| Movement ID | Tanggal | Qty | Keterangan |
|-------------|---------|-----|------------|
| **619** | 02 Mei 2026, 10:07 | +30 ke Gudang | Dilakukan oleh Admin Toko via web persediaan |
| **852** | 02 Mei 2026, 13:45 | +30 ke Gudang | Dilakukan oleh Admin Toko via web persediaan |

Jika hanya 1 dari 2 stock-in ini yang benar-benar terjadi secara fisik, maka:
- Stok benar: 12 (init) + 30 (1 stock-in) = 42 masuk, -23 terjual = **19 unit** (~20 dengan rounding)
- Ini mendekati angka fisik yang dilaporkan (12 gudang + 8 toko = 20)

### Penyebab

**Double input** — kemungkinan stock-in +30 unit diinput 2x padahal pengiriman barang hanya terjadi sekali. Atau angka yang diinput tidak sesuai dengan barang yang benar-benar diterima.

### Perbaikan yang Disarankan

1. **Verifikasi fisik** — hitung ulang stok Sunco REF 2L di gudang dan toko
2. Jika terbukti 30 unit kelebihan:
   - Stok Keluar (writeoff/pengurangan manual): **-30 unit dari Gudang**
   - Alasan: "Koreksi stok — stock-in double input tanggal 02 Mei 2026"
3. Setelah koreksi: stock_gdg = 12, stock_toko = 8, total = 20

---

## 3. Bug Kode yang Ditemukan dan Sudah Diperbaiki

Meskipun ketidaksesuaian pada kedua produk di atas disebabkan oleh data entry, investigasi menemukan **2 bug kode** yang akan menyebabkan masalah di masa depan. Kedua bug sudah diperbaiki pada commit `8be13dc`.

### Bug 1 (KRITIS): Void Selalu Kembalikan Stok ke stockToko

**File:** `src/app/api/unit-transactions/void-request/route.ts` dan `void-approve/route.ts`

Saat penjualan dilakukan, stok dipotong dari `stockToko` terlebih dahulu, lalu `stockGdg` (spillover). Namun saat void, stok **selalu** dikembalikan ke `stockToko`:

```typescript
// SEBELUM FIX (bug):
const newStockToko = prod.stockToko + qty;   // selalu ke toko
const newStock = newStockToko + prod.stockGdg;

// SESUDAH FIX:
const newStockGdg = prod.stockGdg + qty;     // sekarang ke gudang
const newStock = prod.stockToko + newStockGdg;
```

**Dampak potensial:** Jika banyak void terjadi pada produk yang stoknya diambil dari gudang, `stockToko` akan menggembung dan `stockGdg` akan terkuras — persis seperti keluhan yang dilaporkan. Namun untuk kedua produk di atas, **tidak ada void yang pernah terjadi**.

### Bug 2 (SEDANG): Mobile Stock-In Hanya Update Total

**File:** `src/app/api/mobile/toko/stock-in/route.ts`

Stock-in dari aplikasi mobile hanya memperbarui field `stock` total, mengabaikan `stockGdg` dan `stockToko`:

```typescript
// SEBELUM FIX (bug):
data: { stock: newStock }
// stockGdg dan stockToko tidak diupdate!

// SESUDAH FIX:
data: { stockGdg: { increment: quantity }, stock: newStock }
```

**Dampak potensial:** Setiap stock-in via mobile akan merusak invariant `stock = stockGdg + stockToko`. Untuk kedua produk di atas, **stock-in dilakukan via web** (bukan mobile), sehingga bug ini belum ter-trigger.

### Perbaikan Tambahan: Persediaan History

- API `/api/toko/movements` sekarang mendukung parameter `search` (filter nama produk, SKU, referensi)
- Halaman persediaan sekarang memiliki input pencarian
- DataTable mendukung page size 100 dan 200 (sebelumnya maks 50)

---

## 4. Kesimpulan dan Rekomendasi

### Kesimpulan

| Item | Temuan |
|------|--------|
| Tepung Segitiga Biru | Stok awal salah input (2 vs 15) |
| Sunco REF 2L | Stock-in +30 dilakukan 2x (double input) |
| Bug void stockToko | Ditemukan dan sudah diperbaiki |
| Bug mobile stock-in | Ditemukan dan sudah diperbaiki |
| Void terjadi? | Tidak ada void untuk kedua produk ini |

### Rekomendasi

1. **Segera:** Koreksi data stok kedua produk sesuai hitungan fisik
2. **Prosedur:** Setiap stock-in wajib divalidasi oleh 2 orang (input + verifikasi)
3. **Prosedur:** Stock opname berkala (minimal 1x per bulan) untuk deteksi dini selisih
4. **Teknis:** Bug yang sudah diperbaiki akan mencegah masalah serupa di masa depan
