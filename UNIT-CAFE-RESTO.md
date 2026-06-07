# Unit Cafe & Resto (Latar)

> **unitType:** `resto_cafe` / `resto` / `coffe_latar` | **Jalur:** Retail/F&B (StoreSale) | **API:** `/api/toko/sales`

---

## Ringkasan

Unit Resto & Cafe (Latar) — dine-in + takeaway. Kasir kelola denah meja dinamis, kitchen display, modifier/add-on.
**Manajemen tidak menggunakan resep/bahan baku otomatis.** HPP diisi manual. Produk default `trackStock=false`.

---

## Sidebar (Mei 2026)

### Kasir (3 item)

| Menu | Route |
|---|---|
| Kasir POS | `/resto/kasir` |
| Shift Kasir | `/resto/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=resto` |

### Admin (10 item)

| Menu | Route | Icon |
|---|---|---|
| Kasir POS | `/resto/kasir` | UtensilsCrossed |
| Kitchen Display | `/resto/kds` | Monitor |
| Manajemen Menu | `/resto/produk` | Package |
| Promo & Diskon | `/resto/marketing` | Tag |
| Persediaan & Stok | `/resto/persediaan` | Boxes |
| Opname Stok | `/resto/opname` | ClipboardCheck |
| Denah Meja | `/resto/floor-plan` | Grid3x3 |
| Modifier & Add-on | `/resto/modifiers` | Settings2 |
| Shift Kasir | `/resto/shift` | Timer |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=resto` | ClipboardList |

+ LAPORAN (`/unit/resto/laporan`), PERSETUJUAN (`/approval`), AKUN (`/profil`)

### Hidden dari Sidebar

| Route | Status |
|---|---|
| `/resto/bahan-baku` | Hidden — manajemen tidak pakai resep otomatis |
| `/resto/batch` | Hidden — tidak dipakui |

---

## Akun

| Role | Email | Password |
|---|---|---|
| Admin | `adminresto@koperasi.com` | `password123` |
| Kasir | `kasirresto@koperasi.com` | `password123` |

---

## Fitur POS

| Fitur | Status |
|---|---|
| Denah meja dinamis + takeaway | ✅ |
| Grid menu visual + filter kategori | ✅ |
| Keranjang per meja + qty +/- | ✅ |
| Notes per item (max 60 char) | ✅ |
| Split Bill (multi-payment) | ✅ |
| Modifiers / Add-on | ✅ |
| 3 Metode bayar (Tunai/QRIS/Potong Gaji) | ✅ |
| Shift check + checkout lock | ✅ |
| Struk Receipt 80mm | ✅ |
| Kitchen Display System (KDS) | ✅ |
| Dynamic Floor Plan editor | ✅ |
| HPP Manual (field costPrice, tidak otomatis dari resep) | ✅ |
| Opname Stok | ✅ |
| Reporting + CSV export | ✅ |
| Catat Pengeluaran Operasional | ✅ |
| Catat Pemasukan Operasional | ✅ |
| Laba Bersih + HPP + Net Profit | ✅ |
| Excel multi-sheet export (4 sheet) | ✅ |
| Print layout kop surat | ✅ |
| Submit Laporan ke Operator | ✅ |

---

## Arsitektur: Dua Jalur Sistem

```
JALUR 1: Unit Jasa (UnitTransaction) — Barbershop, Cuci Mobil, PlayStation
  API: /api/unit-layanan/sales | DB: UnitTransaction + UnitServicePackage

JALUR 2: Unit Retail/F&B (StoreSale) — Toko, Resto, Cafe LSP
  API: /api/toko/sales | DB: StoreSale + StoreSaleItem + StoreProduct
```

---

## Perbandingan vs Unit Toko

| Aspek | Toko | Resto & Cafe |
|---|---|---|
| POS Layout | Tabel + barcode | Grid visual + denah meja |
| Denah Meja | ❌ | ✅ |
| KDS | ❌ | ✅ |
| Split Bill | ✅ | ✅ |
| Modifier | ✅ | ✅ |
| Notes per item | ❌ | ✅ |
| Struk | 80mm | 80mm |

---

## File Terkait

| File | Fungsi |
|---|---|
| `src/lib/constants/navigation.ts` | `adminRestoNavigation` (10 item) + `kasirRestoNavigation` (3 item) |
| `src/app/(protected)/resto/kasir/page.tsx` | POS — denah meja + split bill + modifiers |
| `src/app/(protected)/resto/kds/page.tsx` | Kitchen Display System |
| `src/app/(protected)/resto/floor-plan/page.tsx` | Dynamic Floor Plan editor |
| `src/app/(protected)/resto/modifiers/page.tsx` | Modifier admin CRUD |
| `src/app/(protected)/resto/laporan/page.tsx` | Redirect → `/unit/resto/laporan` (shared unit laporan page) |
| `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx` | Shared laporan: CRUD pengeluaran/pemasukan, Excel, print, HPP, pagination |
| `src/app/api/toko/products/route.ts` | Produk API (`trackStock` default false) |
| `src/app/api/toko/sales/route.ts` | Checkout (shared) |
| `src/app/api/kitchen-orders/route.ts` | Kitchen orders (KDS) |

---

## Bugs & Fixes

| Tanggal | Bug | Root Cause | Fix |
|---------|-----|-----------|-----|
| 5 Jun 2026 | Void transaksi `SL-*` gagal ("tidak ditemukan") | `STORE_SALE_PREFIXES` di void-request route tidak punya `"SL-"`, lookup jatuh ke UnitTransaction → 404 | Tambah `"SL-"` ke prefix list + fallback `StoreSale.findUnique` |
| 5 Jun 2026 | Unit Insight page blank untuk admin Resto | `STORE_UNIT_TYPES` hanya `["toko","resto","cafe_lsp"]` — `resto_cafe` di-reject 400 + `StoreProduct` tanpa alias expansion | Alias normalize via reverse lookup + expand whitelist + alias expansion di product query |
| 5 Jun 2026 | QRIS management 403 untuk admin `resto_cafe` | QRIS endpoint pakai exact match `userUnitType !== unitType`, `resto_cafe` ≠ `resto` → blocked | Ganti ke `isSameUnit()` untuk alias-aware RBAC |
| 5 Jun 2026 | Alias `UNIT_TYPE_ALIASES` salah: `coffe_latar` di `cafe_lsp` | `UNIT_TYPE_ALIASES.cafe_lsp` include `coffe_latar`, padahal `coffe_latar` produknya = Resto (Ayam Bakar, Ayam Katsu) | Pindah `coffe_latar` dari `cafe_lsp` ke `resto` aliases |
| 5 Jun 2026 | Duplicated alias maps tidak konsisten | `unit-transactions/route.ts` dan `unit-layanan/stats/route.ts` punya alias map sendiri tanpa `resto_cafe` | Unify semua alias map: `resto` → `["resto", "resto_cafe", "coffe_latar"]` |
| 5 Jun 2026 | Laporan `/resto/laporan` kosong (0 transaksi) | Prisma JSON NULL bug: `NOT: { metadata: { path: ["isVoided"], equals: true } }` — saat key `isVoided` tidak ada di JSON, `metadata->'isVoided'` return SQL NULL, `NOT NULL` → NULL (falsy), semua transaksi aktif tersaring | Pindah void filter dari Prisma ke JavaScript post-filter: `allSales.filter(s => !s.metadata || !s.metadata?.isVoided)` |
| 5 Jun 2026 | Insight revenue menggelembung (Rp 497K vs Rp 269K) | Insight API tidak memfilter voided sales sama sekali — filter Prisma NOT sebelumnya dihapus karena bug, tapi tidak diganti JS filter. 16 voided sales ikut terhitung | Tambah JS void filter di 4 query (range, allTime, thisWeek, lastWeek) |
| 8 Jun 2026 | "Produk 'Air Mineral' bukan milik unit Resto" saat checkout | `sales/route.ts` dan `split-bill/route.ts` pakai exact match `product.unitType !== unitType` — produk disimpan sebagai `"resto_cafe"` tapi request kirim `"resto"` → gagal | Ganti semua 16 exact match `unitType` di 13 file API ke `isSameUnit()`: sales, split-bill, products/recipe, shifts (3), cashier-identities (3), unit-transactions (2), packages (3), laporan |
| 8 Jun 2026 | Menu baru selalu tersimpan sebagai `"resto_cafe"` bukan `"resto"` | `FbMenuForm` kirim raw `session.unitType` (`"resto_cafe"`) → API simpan apa adanya tanpa normalisasi | Tambah `normalizeUnitType()` di POST `/api/toko/products` — DB selalu simpan bentuk kanonikal `"resto"` |
| 8 Jun 2026 | Fitur Laporan Resto tidak ada catat pengeluaran | `/resto/laporan` pakai legacy standalone page (237 baris) — hanya ringkasan penjualan, tidak ada CRUD pengeluaran/pemasukan | Redirect ke shared unit laporan `/unit/resto/laporan` (2312 baris): full features (pengeluaran, pemasukan, laba bersih, HPP, Excel, print, pagination) |
| 8 Jun 2026 | Admin `resto_cafe` dapat 403 saat catat pengeluaran operasional | 8 operational API pakai exact match `userUnitType === unitType` — `"resto_cafe" !== "resto"` → blocked | Ganti ke `isSameUnit()` di: operational-expense (2), operational-income (2), operational-batch (1), submit-review (1) |
| 8 Jun 2026 | Laporan API tidak temukan pengeluaran alias `RESTO_CAFE` | `description contains [RESTO]` hanya match prefix exact — lepas `RESTO_CAFE` dan `COFFE_LATAR` | Ganti ke `unitType: storeSaleUnitTypeFilter(unitType)` + regex `^\[[A-Z_]+\]` untuk parsing |
| 8 Jun 2026 | Admin `resto_cafe` tidak bisa akses halaman Laporan `/unit/resto/laporan` | Client-side exact match `userUnitType !== unitType` — `"resto_cafe" !== "resto"` → `isWrongUnit=true`, page blocked | Ganti ke `isSameUnit()` di client-side `isAdmin` dan `isWrongUnit` check |
| 8 Jun 2026 | Riwayat `useEffect` bypass normalisasi unitType | `setFilterUnit(urlUnitType)` tanpa `normalizeUnitType()` — navigasi langsung ke `?unitType=resto_cafe` tidak normalisasi | Tambah `normalizeUnitType()` di `useEffect` sebelum `setFilterUnit` |
| 8 Jun 2026 | GET `/api/unit/[slug]/operational-expense` 500 error | `checkAccess(slug)` dipanggil tapi tidak pernah didefinisikan di file → ReferenceError | Ganti ke inline RBAC check (sama pattern dengan POST handler): `isSameUnit` + role check |

## Data Isolation: Resto vs Cafe LSP

| Aspek | Resto & Cafe | Cafe LSP |
|-------|-------------|----------|
| unitType | `resto` / `resto_cafe` / `coffe_latar` | `cafe_lsp` |
| Produk khas | Ayam Bakar, Nasi Goreng, Ice Americano | Butterscotch, Matcha Latte, Banana Cheese |
| API aliases | `STORE_SALE_ALIASES["resto"]` = `["resto", "resto_cafe", "coffe_latar"]` | `STORE_SALE_ALIASES["cafe_lsp"]` = `["cafe_lsp"]` |
| RBAC (isSameUnit) | `normalizeUnitType("resto_cafe")` → `"resto"` | `normalizeUnitType("cafe_lsp")` → `"cafe_lsp"` |
| Akun admin | `admincafe@koperasi.com` | `admincafelsp@koperasi.com` |
| Insight terpisah | ✅ | ✅ |
| QRIS terpisah | ✅ | ✅ |
| Product creation | `normalizeUnitType()` → selalu simpan `"resto"` | N/A (no aliases) |

## Changelog

- **8 Jun 2026** — **7 fix major:**
  1. Fix "Produk bukan milik unit" across 13 API files: all `unitType !==` exact matches replaced with `isSameUnit()` alias-aware comparison. Security: `isSameUnit()` fail-closed (null → false).
  2. Fix menu baru tersimpan `"resto_cafe"`: tambah `normalizeUnitType()` di POST `/api/toko/products` — DB selalu simpan bentuk kanonikal `"resto"`.
  3. Redirect `/resto/laporan` → `/unit/resto/laporan` (shared page 2312 baris). Fitur baru: catat pengeluaran/pemasukan operasional, laba bersih, HPP, Excel 4-sheet, print kop surat, pagination, submit ke operator.
  4. Fix 8 operational API RBAC (exact match → `isSameUnit`) + laporan API expense query alias-aware (`description contains` → `storeSaleUnitTypeFilter` + regex parsing).
  5. Fix Laporan page client-side gate: `userUnitType !== unitType` → `isSameUnit()` — admin `resto_cafe` bisa akses `/unit/resto/laporan`.
  6. Fix Riwayat `useEffect` normalization: `setFilterUnit(urlUnitType)` tanpa normalize → tambah `normalizeUnitType()`.
  7. Fix GET `/api/unit/[slug]/operational-expense` 500: undefined `checkAccess()` → inline RBAC check dengan `isSameUnit()`.
  - **Verified**: LAPORAN & Riwayat data isolation — 0 cafe_lsp leaks, 81 transaksi RS- only, expense CRUD end-to-end tested.
- **5 Jun 2026** — Fix insight revenue bubble (Rp 497K→Rp 269K): voided sales excluded via JS filter. Fix laporan page kosong. Fix void `SL-` prefix. Fix QRIS RBAC. Fix `UNIT_TYPE_ALIASES`. Data isolation verified: Resto vs Cafe-LSP terpisah, produk "LSP" names are Resto products.
- **21 Mei 2026** — Sidebar dipangkas 12→10 item. Hapus Bahan Baku, Manajemen Batch dari sidebar admin. Default `trackStock=false` untuk produk baru. HPP manual tooltip di form Tambah Menu.
- **18 Mei 2026** — Edit NRP fix, operator hierarchy cleanup.
