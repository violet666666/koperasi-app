# Design: Penyederhanaan Sidebar & Behavior Cafe LSP + Resto

**Date:** 2026-05-21
**Status:** Approved
**Units affected:** Cafe LSP (`cafe_lsp`), Resto & Cafe Latar (`resto`, `resto_cafe`, `coffe_latar`)

---

## Context

Manajemen Cafe LSP dan Resto Latar tidak menggunakan fitur resep/bahan baku otomatis. Mereka menghitung HPP secara manual di Excel dan memasukkan angka manual ke sistem. Menu sering berubah dan takuran dapur masih "kira-kira". Fitur Bahan Baku, Batch, dan Resep dianggap membingungkan dan tidak dipakai.

**Tujuan:** Pangkas sidebar agar fokus pada fitur yang dipakai, dan ubah default behavior produk agar produk olahan tidak memotong stok otomatis.

---

## Decision: Pendekatan B — Smart Trim + Behavior Change

### 1. Sidebar Navigation

#### Cafe LSP Admin (`adminCafeLspNavigation`) — 7 items

| # | Item | Route | Icon |
|---|---|---|---|
| 1 | Kasir POS | `/cafe-lsp/kasir` | Coffee |
| 2 | Kitchen Display | `/cafe-lsp/kds` | Monitor |
| 3 | Manajemen Menu | `/cafe-lsp/produk` | Package |
| 4 | Promo & Diskon | `/cafe-lsp/marketing` | Tag |
| 5 | Persediaan & Stok | `/cafe-lsp/persediaan` | Boxes |
| 6 | Shift Kasir | `/cafe-lsp/shift` | Timer |
| 7 | Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` | ClipboardList |

**Dihapus:** Bahan Baku, Manajemen Batch, Opname Stok (terpisah), Order Queue (terpisah)

**Persediaan & Stok:** Tambah tombol "Opname Stok" yang navigasi ke `/cafe-lsp/opname`. Route tetap ada, hanya disembunyikan dari sidebar.

#### Resto Admin (`adminRestoNavigation`) — 10 items

| # | Item | Route | Icon |
|---|---|---|---|
| 1 | Kasir POS | `/resto/kasir` | UtensilsCrossed |
| 2 | Kitchen Display | `/resto/kds` | Monitor |
| 3 | Manajemen Menu | `/resto/produk` | Package |
| 4 | Promo & Diskon | `/resto/marketing` | Tag |
| 5 | Persediaan & Stok | `/resto/persediaan` | Boxes |
| 6 | Opname Stok | `/resto/opname` | ClipboardCheck |
| 7 | Denah Meja | `/resto/floor-plan` | Grid3x3 |
| 8 | Modifier & Add-on | `/resto/modifiers` | Settings2 |
| 9 | Shift Kasir | `/resto/shift` | Timer |
| 10 | Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=resto` | ClipboardList |

**Dihapus:** Bahan Baku, Manajemen Batch

#### Kasir — Tidak berubah

- `kasirCafeLspNavigation` tetap (Kasir POS, Order Queue, Shift, Riwayat)
- `kasirRestoNavigation` tetap (Kasir POS, Shift, Riwayat)

---

### 2. Product Behavior Changes

#### 2a. Default `trackStock` per unitType

**File:** `src/app/api/toko/products/route.ts`

**Current:**
```typescript
trackStock: trackStock !== undefined ? trackStock : true,
```

**New:**
```typescript
const nonInventoryUnits = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"];
const defaultTrackStock = nonInventoryUnits.includes(unitType || "") ? false : true;
trackStock: trackStock !== undefined ? trackStock : defaultTrackStock,
```

Apply same logic to both CREATE and UPDATE endpoints.

**Effect:** Produk baru di unit F&B default tidak memotong stok saat checkout. Kasir bisa jual tanpa error "Stok Habis". Admin bisa manual set `trackStock=true` untuk barang jadi (minuman kaleng, dll).

#### 2b. Form Tambah Produk — HPP Tooltip

**File:** `src/app/(protected)/toko/produk/tambah/page.tsx`

- Label "Harga Beli (Modal / HPP)" tetap
- Tambah tooltip/description text: "Isi manual sesuai perhitungan HPP dari manajemen"
- Untuk unit F&B, checkbox "Lacak Stok" default **unchecked**

#### 2c. Laporan Penjualan — HPP Indicator

**Files:** Reporting pages (shared module)

- Jika `costPrice === 0`: tampilkan badge "HPP belum diisi" pada baris produk
- Kolom Keuntungan tetap dihitung (0 jika HPP=0) tapi diberi indikator visual berbeda

---

### 3. Existing Data Migration

Produk Cafe LSP & Resto yang sudah ada dengan `trackStock=true` perlu di-update:

**SQL migration:**
```sql
UPDATE "StoreProduct"
SET "trackStock" = false
WHERE "unitType" IN ('cafe_lsp', 'resto', 'resto_cafe', 'coffe_latar')
  AND "productType" = 'finished'
  AND "trackStock" = true;
```

Barang jadi (minuman kaleng, rokok) yang memang butuh stok tracking harus di-set manual `trackStock=true` oleh admin setelah migration.

---

### 4. Files to Modify

| File | Change |
|---|---|
| `src/lib/constants/navigation.ts` | Update `adminCafeLspNavigation` (remove 5 items) dan `adminRestoNavigation` (remove 2 items) |
| `src/app/api/toko/products/route.ts` | Default `trackStock=false` untuk F&B units |
| `src/app/api/toko/products/[id]/route.ts` | Same default for PATCH |
| `src/app/(protected)/toko/produk/tambah/page.tsx` | Tooltip HPP, default trackStock unchecked for F&B |
| `src/app/(protected)/toko/produk/[id]/page.tsx` | Same form updates for edit |
| Reporting pages (laporan) | Badge for missing HPP |
| `docs/UNIT-CAFE-LSP.md` | Update feature status table |
| `docs/UNIT-CAFE-RESTO.md` | Update feature status table |

---

### 5. Out of Scope

- Routes yang dihapus dari sidebar tetap bisa diakses via URL langsung (tidak dihapus dari filesystem)
- Toko unit tidak terpengaruh (tetap `trackStock=true`)
- Kitchen Display System (KDS) tetap berfungsi normal
- POS checkout flow tidak berubah — hanya stock validation di-skip untuk `trackStock=false`
