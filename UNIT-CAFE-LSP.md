# Dokumentasi Unit Cafe LSP

> **unitType:** `cafe_lsp`
> **Status:** All features implemented
> **Referensi Terkait:** `UNIT-CAFE-RESTO.md`, `UNIT-TOKO.md`

---

## 1. Ringkasan

Unit **Cafe LSP** adalah unit F&B counter-based (tanpa meja dine-in). Pelanggan order di counter, menerima nomor antrian, dan mengambil pesanan saat dipanggil.

**Jalur Sistem:** Jalur 2 — Retail/F&B (StoreSale). DB: `StoreSale` + `StoreSaleItem` + `StoreProduct`. API: `/api/toko/sales` dengan `unitType=cafe_lsp`.

---

## 2. Fitur POS

| Fitur | Status |
|---|---|
| POS Counter-based (grid visual + filter kategori + search) | ✅ |
| Tampilan foto menu (imageUrl) | ✅ |
| Quick Keys (tab best sellers, admin-configurable) | ✅ |
| Notes per item (max 60 char, saved in metadata) | ✅ |
| Nomor Antrian Otomatis (server-side atomic, configurable) | ✅ |
| 3 Metode bayar (Tunai/QRIS/Potong Gaji) | ✅ |
| Validasi plafon piutang + stok sebelum checkout | ✅ |
| Shift validation + lock checkout + shiftId auto-attach | ✅ |
| Order Queue Panel (di POS) + Queue Board (full page) | ✅ |
| Struk Receipt 80mm | ✅ |
| Zustand state (persist localStorage) | ✅ |
| Resep & HPP (ProductRecipe) + auto-calculate costPrice | ✅ |
| Manajemen Batch & Expiry (wrapper Toko) | ✅ |
| Kitchen Display System / KDS (wrapper Resto) | ✅ |
| Split Bill (shared module) | ✅ |
| Modifiers / Add-on System (shared module) | ✅ |
| Reporting Dashboard (shared module) | ✅ |
| Offline Mode (shared module) | ✅ |
| Hybrid Inventory — racikan + retail | ✅ |
| Bahan Baku management (mobile-first) | ✅ |
| Opname Stok (stock taking) | ✅ |

---

## 3. Role & Akses

### Kasir

| Fitur | Link |
|---|---|
| POS Cafe LSP | `/cafe-lsp/kasir` |
| Order Queue | `/cafe-lsp/antrian` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |

### Admin

| Fitur | Link |
|---|---|
| POS Cafe LSP | `/cafe-lsp/kasir` |
| Order Queue | `/cafe-lsp/antrian` |
| Manajemen Menu | `/cafe-lsp/produk` |
| Promo & Diskon | `/cafe-lsp/marketing` |
| Persediaan & Stok | `/cafe-lsp/persediaan` |
| Bahan Baku | `/cafe-lsp/bahan-baku` |
| Manajemen Batch | `/cafe-lsp/batch` |
| Opname Stok | `/cafe-lsp/opname` |
| Kitchen Display | `/cafe-lsp/kds` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |
| Laporan Penjualan | `/unit/cafe-lsp/laporan` |
| Inbox Approval | `/approval` |

---

## 4. Akun

| Role | Email | Password |
|---|---|---|
| Admin | `admincafelsp@koperasi.com` | `password123` |
| Kasir | `kasircafelsp@koperasi.com` | `password123` |

---

## 5. Arsitektur: Wrapper Pages

```
/cafe-lsp/kasir/page.tsx      → DEDICATED POS (counter-based)
/cafe-lsp/antrian/page.tsx    → DEDICATED Order Queue Board
/cafe-lsp/produk/page.tsx     → Wrapper → TokoProdukPage
/cafe-lsp/shift/page.tsx      → Wrapper → TokoShiftPage
/cafe-lsp/marketing/page.tsx  → Wrapper → TokoMarketingPage
/cafe-lsp/persediaan/page.tsx → Wrapper → TokoPersediaanPage
/cafe-lsp/bahan-baku/page.tsx → Wrapper → TokoBahanBakuPage
/cafe-lsp/batch/page.tsx      → Wrapper → TokoBatchPage
/cafe-lsp/opname/page.tsx     → Wrapper → TokoOpnamePage
/cafe-lsp/kds/page.tsx        → Wrapper → Resto KDS Page
```

---

## 6. Perbedaan dengan Resto Latar

| Aspek | Resto Latar | Cafe LSP |
|---|---|---|
| **Tipe** | Dine-in + Takeaway | Counter-based |
| **Denah Meja** | ✅ 12 meja + takeaway | ❌ Tidak ada |
| **Nomor Antrian** | ❌ | ✅ Server-side atomic |
| **Quick Keys** | ❌ | ✅ Tab ★ Quick |
| **Order Queue** | ❌ | ✅ Panel + Board |
| **Shift Lock** | ⚠️ Warning saja | ✅ Lock checkout |
| **shiftId** | ⚠️ Tidak terkirim | ✅ Auto-attach |
| **API** | `/api/toko/sales` | `/api/toko/sales` (shared) |

---

## 7. File-File Terkait

| File | Fungsi |
|---|---|
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | POS Dedicated counter-based |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | Order Queue Board |
| `src/app/(protected)/cafe-lsp/produk/page.tsx` | Wrapper → TokoProdukPage |
| `src/app/(protected)/cafe-lsp/shift/page.tsx` | Wrapper → TokoShiftPage |
| `src/app/(protected)/cafe-lsp/marketing/page.tsx` | Wrapper → TokoMarketingPage |
| `src/app/(protected)/cafe-lsp/persediaan/page.tsx` | Wrapper → TokoPersediaanPage |
| `src/app/(protected)/cafe-lsp/bahan-baku/page.tsx` | Wrapper → TokoBahanBakuPage |
| `src/app/(protected)/cafe-lsp/batch/page.tsx` | Wrapper → TokoBatchPage |
| `src/app/(protected)/cafe-lsp/opname/page.tsx` | Wrapper → TokoOpnamePage |
| `src/app/(protected)/cafe-lsp/kds/page.tsx` | Wrapper → Resto KDS Page |
| `src/lib/constants/navigation.ts` | `kasirCafeLspNavigation` + `adminCafeLspNavigation` |
| `src/app/(protected)/layout.tsx` | Route guard `cafe_lsp` |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard POS route |
| `src/app/api/toko/sales/route.ts` | API checkout (shared, hybrid) |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType + productType) |
| `src/app/api/toko/products/[id]/recipe/route.ts` | API CRUD resep/HPP |
| `src/app/api/toko/products/quick-keys/route.ts` | API CRUD Quick Keys |
| `src/app/api/toko/queue/route.ts` | Atomic queue number (GET/POST) |
| `src/app/api/toko/queue/config/route.ts` | Queue config (PUT) |
| `src/app/api/toko/stock-tracking/opname/route.ts` | API stock opname |
| `src/app/api/toko/stock-tracking/products/route.ts` | API products for stock tracking |
| `src/lib/queue.ts` | Queue config & formatting |
| `src/lib/stock-opname.ts` | Opname validation |
| `prisma/seed-cafe-lsp.ts` | Seed script khusus Cafe LSP |
| `prisma/seed-cafe-lsp-menu.ts` | Seed 35 menu items (SKU: LSP-XXX) |
| `prisma/seed-cafe-lsp-recipes.ts` | Seed 35 resep + 45 bahan baku |
| `prisma/seed-raw-materials.ts` | Seed 46 bahan baku + link resep |

---

## 8. Menu & Resep

### 8.1 Daftar Menu (35 items)

| Kategori | Jumlah | Harga Range |
|---|---|---|
| Mocktail | 5 | Rp14.000 – Rp19.000 |
| Tea Series | 5 | Rp12.000 |
| Frappe | 2 | Rp18.000 |
| Choco Series | 4 | Rp16.000 – Rp18.000 |
| Matcha Series | 3 | Rp17.000 – Rp20.000 |
| Ice Coffee | 9 | Rp15.000 – Rp18.000 |
| Hot Coffee | 7 | Rp8.000 – Rp17.000 |

### 8.2 Resep & HPP

- Setiap menu memiliki resep di tabel `ProductRecipe` (breakdown bahan, qty, satuan, harga/unit)
- `costPrice` dihitung otomatis dari total resep; margin rata-rata ~68%
- 45+ bahan baku unik dilacak; 96/96 recipe rows linked ke ingredient products
- SKU format: `LSP-{DEPT}-{VARIANT}`
- Admin CRUD resep via halaman Manajemen Menu (tombol BookOpen)
- Ingredient linking: bahan terhubung ke `StoreProduct` via `ingredientProductId`

---

## 9. Opname Stok

**Page:** `/cafe-lsp/opname` — wrapper reuses `TokoOpnamePage` (reads `unitType` from session).

**Fitur:**
- **Product type filter:** Semua Produk / Produk Jadi / Bahan Baku
- **Location filter:** Gudang / Toko
- **Search:** filter by nama produk atau SKU
- **Physical count input:** input stok fisik per produk, tampil selisih vs sistem secara real-time
- **Progress tracker:** stats card (total, sudah dihitung, belum, progress %)
- **Discrepancy display:** color-coded status (hijau = sesuai, biru = lebih, merah = kurang)
- **Save adjustments:** POST ke API, buat `StoreStockMovement` untuk penyesuaian
- **Result dialog:** ringkasan diperiksa / sesuai / disesuaikan + detail per produk

**API:** `POST /api/toko/stock-tracking/opname` — body: `{ items: [{productId, physicalStock}], location }`. Returns `{ results, summary }`.

**Navigation:** "Opname Stok" (ClipboardCheck icon) di `adminCafeLspNavigation`, permission `manage_unit_transactions`.

---

## 10. Audit & Bug Fix Summary

| Item | Status |
|---|---|
| Fixed: Queue number race condition — server-side atomic counter (was client-side) | ✅ |
| Fixed: Queue cap 999 removed — unlimited via server daily count | ✅ |
| Fixed: Antrian Board stale readyIds — useRef fix + perPage increased to 100 | ✅ |
| Fixed: Item notes not persisted — saved in `metadata.itemNotes` | ✅ |
| Fixed: Recipe API unit isolation — validate `product.unitType` matches session | ✅ |
| Fixed: Dynamic backHref/links for wrapper pages (no hardcoded `/toko/kasir`) | ✅ |
| Fixed: Movements API fallback `unitType` filter | ✅ |
| Fixed: Bahan Baku page crash (API response format) | ✅ |
| Fixed: Products API not saving `productType`/`trackStock` fields | ✅ |
| Fixed: Shared API bugs — product lookup, FIFO batch, audit log, notifications, shift check, movements — all scoped by `unitType` | ✅ |
| New: Opname Stok feature — stock taking with physical count vs system | ✅ |
| New: Hybrid Inventory — racikan deducts ingredients via FIFO, retail deducts product stock | ✅ |
| New: Dynamic Queue System — admin-configurable prefix, digits, reset policy | ✅ |
| New: Kitchen Display System (KDS) — shared with Resto | ✅ |
| New: Quick Keys — admin configurable from Manajemen Menu | ✅ |
| New: Date range filter on sales API (`?from=&to=`) | ✅ |

---

*Dokumen ini adalah referensi utama untuk Unit Cafe LSP. Untuk Cafe & Resto Latar, lihat `UNIT-CAFE-RESTO.md`. Untuk Toko, lihat `UNIT-TOKO.md`.*
