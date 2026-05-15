# Dokumentasi Unit Cafe & Resto (Latar)

> **Status:** SEMUA FITUR ROADMAP TERIMPLEMENTASI
> **Terakhir diperbarui:** 16 Mei 2026
> **Referensi Terkait:** `UNIT-TOKO.md`, `UNIT-CAFE-LSP.md`

---

## 1. Ringkasan Masalah (SOLVED)

Unit Resto & Cafe (Latar) memiliki identitas ganda di sistem: kasir `resto_cafe` diarahkan ke POS jasa yang salah, halaman "Kelola Layanan" tidak relevan untuk Resto, dan POS Resto yang benar (`/resto/kasir`) tidak terhubung ke navigasi.

**Solusi yang diterapkan:**
- **Navigasi Kasir** (`kasirRestoNavigation`): Kasir diarahkan ke `/resto/kasir`, `/toko/shift`, dan riwayat penjualan
- **Navigasi Admin** (`adminRestoNavigation`): Admin mendapat akses POS + manajemen menu + persediaan + batch + KDS + floor plan + modifiers + laporan + opname
- **Route Guard** (`layout.tsx`): `resto_cafe`, `resto`, `coffe_latar` ditambahkan akses `/resto/*`
- **Dashboard POS Link**: Tombol "Buka Kasir POS" mengarah ke `/resto/kasir`
- **Routing Logic**: `getNavigationForUser` memetakan unitType ke navigasi yang tepat

---

## 2. Arsitektur POS: Dua Jalur Sistem

```
JALUR 1: Unit Jasa (UnitTransaction)
  Cocok: Barbershop, Cuci Mobil, PlayStation
  - Tidak ada stok fisik, input = dropdown "Paket Layanan"
  - Kasir: /unit/[slug]/kasir | Admin: /unit/[slug]/layanan
  - API: /api/unit-layanan/sales | DB: UnitTransaction + UnitServicePackage

JALUR 2: Unit Retail/F&B (StoreSale)
  Cocok: Toko, Resto & Cafe
  - Ada stok fisik (atau isService=true), input = pilih produk masuk cart
  - Kasir Toko: /toko/kasir | Kasir Resto: /resto/kasir
  - Admin: /toko/produk | API: /api/toko/sales | DB: StoreSale + StoreSaleItem + Product
```

---

## 3. Fitur POS Resto

| Fitur | File | Status |
|---|---|---|
| Denah meja dinamis + takeaway | `resto/kasir/page.tsx` | Done |
| Grid menu visual (tile card + foto) | `resto/kasir/page.tsx` | Done |
| Filter kategori menu | `resto/kasir/page.tsx` | Done |
| Keranjang per meja + qty +/- | `resto/kasir/page.tsx` | Done |
| Notes per item (max 60 char) | `resto/kasir/page.tsx` | Done |
| Split Bill (multi-payment) | `resto/kasir/page.tsx` | Done |
| Modifiers / Add-on di POS | `resto/kasir/page.tsx` | Done |
| Bayar Tunai/QRIS/Potong Gaji | `resto/kasir/page.tsx` | Done |
| Gatekeeper Limit Piutang | `resto/kasir/page.tsx` | Done |
| Struk Receipt (80mm thermal) | `receipt-primkopol.tsx` | Done |
| Shift check + checkout lock | `resto/kasir/page.tsx` | Done |
| Validasi stok sebelum checkout | `resto/kasir/page.tsx` | Done |
| Kitchen Display System (KDS) | `resto/kds/page.tsx` | Done |
| Dynamic Floor Plan editor | `resto/floor-plan/page.tsx` | Done |
| Modifier admin CRUD | `resto/modifiers/page.tsx` | Done |
| Reporting + CSV export | `resto/laporan/page.tsx` | Done |
| Batch & Expiry tracking | `resto/batch/page.tsx` | Done |
| Bahan Baku (hybrid inventory) | `resto/bahan-baku/page.tsx` | Done |
| Opname Stok | `resto/opname/page.tsx` | Done |
| Offline mode (conditional) | `lib/offline-sync.ts` | Done |

---

## 4. Role & Akses

### 4.1 Kasir Resto

| Fitur | Link |
|---|---|
| Dashboard Kasir | `/dashboard` |
| POS Resto (Denah Meja) | `/resto/kasir` |
| Shift Kasir | `/toko/shift` |
| Riwayat Transaksi | `/transaksi-unit/riwayat?unitType=resto` |

Tidak ada akses: Manajemen Menu, Laporan, Approve Void, Persediaan.

### 4.2 Admin Resto

| Fitur | Link |
|---|---|
| Dashboard Admin | `/dashboard` |
| Kasir POS | `/resto/kasir` |
| Manajemen Menu | `/resto/produk` |
| Promo & Diskon | `/resto/marketing` |
| Persediaan & Stok | `/resto/persediaan` |
| Bahan Baku | `/resto/bahan-baku` |
| Manajemen Batch | `/resto/batch` |
| Opname Stok | `/resto/opname` |
| Kitchen Display | `/resto/kds` |
| Denah Meja | `/resto/floor-plan` |
| Modifier & Add-on | `/resto/modifiers` |
| Shift Kasir | `/toko/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=resto` |
| Laporan Penjualan | `/resto/laporan` |
| Inbox Approval | `/approval` |

---

## 5. Perbandingan dengan Unit Toko

| Aspek | Unit Toko | Unit Resto & Cafe |
|---|---|---|
| POS Layout | Tabel + search + barcode | Grid visual + denah meja dinamis |
| Denah Meja | Tidak | Ya (drag-and-drop editor) |
| KDS | Tidak | Ya (`/resto/kds`) |
| Split Bill | Ya | Ya |
| Modifiers | Ya | Ya |
| Notes per item | Tidak | Ya |
| Hybrid Inventory | Ya | Ya (racikan + retail) |
| Bahan Baku | Ya | Ya |
| Opname Stok | Ya | Ya |
| Struk | 58mm | 80mm |
| API transaksi | `/api/toko/sales` | `/api/toko/sales` (shared) |
| Navigasi | `kasirTokoNavigation` | `kasirRestoNavigation` |

---

## 6. Roadmap (SEMUA COMPLETED)

| Phase | Fitur | Status |
|---|---|---|
| 1.1 | Batch & Expiry Tracking | DONE |
| 1.2 | Kitchen Display System (KDS) | DONE |
| 1.3 | Dynamic Queue System (Cafe LSP) | DONE |
| 2.1 | Dynamic Floor Plan | DONE |
| 2.2 | Split Bill | DONE |
| 2.3 | Modifiers / Add-on System | DONE |
| 3.1 | Reporting Dashboard + CSV | DONE |
| 3.2 | Offline Mode (conditional) | DONE |
| - | Hybrid Inventory (Bahan Baku) | DONE |
| - | Opname Stok | DONE |

---

## 7. File-File Terkait

### Halaman Resto (wrapper → komponen Toko)

| File | Fungsi |
|---|---|
| `src/app/(protected)/resto/kasir/page.tsx` | POS Resto — denah meja + grid menu + split bill + modifiers |
| `src/app/(protected)/resto/shift/page.tsx` | Wrapper -> TokoShiftPage |
| `src/app/(protected)/resto/produk/page.tsx` | Wrapper -> TokoProdukPage (label "Manajemen Menu") |
| `src/app/(protected)/resto/marketing/page.tsx` | Wrapper -> TokoMarketingPage |
| `src/app/(protected)/resto/persediaan/page.tsx` | Wrapper -> TokoPersediaanPage |
| `src/app/(protected)/resto/bahan-baku/page.tsx` | Wrapper -> TokoBahanBakuPage |
| `src/app/(protected)/resto/batch/page.tsx` | Wrapper -> TokoBatchPage |
| `src/app/(protected)/resto/opname/page.tsx` | Wrapper -> TokoOpnamePage |
| `src/app/(protected)/resto/kds/page.tsx` | Kitchen Display System |
| `src/app/(protected)/resto/floor-plan/page.tsx` | Dynamic Floor Plan editor |
| `src/app/(protected)/resto/modifiers/page.tsx` | Modifier admin CRUD |
| `src/app/(protected)/resto/laporan/page.tsx` | Reporting dashboard |

### Core Files

| File | Fungsi |
|---|---|
| `src/lib/constants/navigation.ts` | `kasirRestoNavigation` + `adminRestoNavigation` |
| `src/app/(protected)/layout.tsx` | Route guard per role + unitType |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard kasir POS link |
| `src/app/api/toko/sales/route.ts` | API checkout (shared toko + resto) |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType) |
| `src/app/api/toko/shifts/route.ts` | API shift (filter by unitType) |
| `src/app/api/toko/split-bill/route.ts` | API split bill |
| `src/app/api/toko/modifiers/route.ts` | API modifiers |
| `src/app/api/toko/floor-plan/route.ts` | API floor plan |
| `src/app/api/toko/reports/sales-summary/route.ts` | API reporting |
| `src/app/api/kitchen-orders/route.ts` | API kitchen orders (KDS) |
| `src/app/api/toko/stock-tracking/opname/route.ts` | API opname stok |

### Library Modules

| File | Fungsi |
|---|---|
| `src/lib/kds.ts` | KDS utilities (status, formatting, validation) |
| `src/lib/floor-plan.ts` | Floor plan config, validation, serialization |
| `src/lib/split-bill.ts` | Split bill validation, calculation |
| `src/lib/modifiers.ts` | Modifier groups, options, price calculation |
| `src/lib/reporting.ts` | Sales reporting, top products, CSV export |
| `src/lib/queue.ts` | Queue config, formatting (Cafe LSP) |
| `src/lib/offline-sync.ts` | Offline pending sale queue |
| `src/lib/stock-opname.ts` | Opname stok utilities |

---

## 8. Opname Stok

**Page:** `/resto/opname`
**Wrapper:** Reuses `TokoOpnamePage` (shared komponen dengan Toko dan Cafe LSP)
**Navigasi:** "Opname Stok" (ClipboardCheck icon) di `adminRestoNavigation`

**Fitur:**
- Filter produk berdasarkan product type (semua / bahan baku / produk jadi)
- Filter berdasarkan lokasi penyimpanan
- Input jumlah fisik (physical count) per produk
- Tampilkan selisih (discrepancy) antara stok sistem vs fisik
- Simpan penyesuaian stok (stock adjustment)

**API:** `POST /api/toko/stock-tracking/opname`

---

## 9. Fitur Development Roadmap — Approved Reference

> Keputusan user berdasarkan gap analysis vs open-source POS (Moka, Pawoon, Olsera, URY ERP).

| # | Fitur | Keputusan |
|---|---|---|
| 1 | Dynamic Floor Plan | APPROVED — implemented |
| 2 | Kitchen Display System (KDS) | APPROVED — implemented |
| 3 | Split Bill | APPROVED — implemented |
| 4 | Modifiers / Add-on | APPROVED — implemented |
| 5 | Batch & Expiry Tracking | APPROVED — implemented |
| 6 | Reporting Dashboard | APPROVED — implemented |
| 7 | Offline Mode | CONDITIONAL — implemented |
| 8 | Loyalty / Stamp Card | REJECTED |

### KDS — Ringkasan
Web-based KDS page (`/resto/kds`) untuk monitor/tablet dapur. Status flow: `pending` -> `preparing` -> `ready` -> `served`. Polling 5 detik. Data model: `KitchenOrder` (Prisma).

### Modifiers — Ringkasan
Admin konfigurasi modifier groups + options. Kasir select di POS. Data model: `ModifierGroup` + `ModifierOption` (disimpan via AppSetting).

### Floor Plan — Ringkasan
Admin drag-and-drop layout editor. Data disimpan di `AppSetting` key `floor_plan_resto` sebagai JSON blob.

### Reporting — Ringkasan
Sales Summary, Menu Terlaris, Revenue by Kategori, Shift Report, Hourly Analysis, Export CSV/PDF.

### Hybrid Inventory — Ringkasan
Produk `trackStock=true` = retail (potong stok langsung). `trackStock=false` = racikan (potong stok bahan baku via resep saat checkout).

---

## 10. Audit & Bug Fix Summary

| Item | Status | Detail |
|---|---|---|
| Movements API fallback unitType filter | FIXED | Filter `product.unitType` berdasarkan session user |
| Bahan Baku page crash (API response format) | FIXED | API response format disesuaikan untuk wrapper Resto |
| Products API not saving productType/trackStock | FIXED | Field `productType` dan `trackStock` sekarang tersimpan dengan benar |
| 16 bug audit (R-1 s/d R-10, S-1 s/d S-6) | FIXED | Shift unitType filter, shiftId payload, salePrefixMap, checkout lock, notes, audit log, dll |
| Opname Stok feature | NEW | Wrapper `/resto/opname` reusing TokoOpnamePage, navigasi + ClipboardCheck icon |

---

*Dokumen ini adalah referensi utama untuk Unit Cafe & Resto (Latar). Untuk Unit Toko, lihat `UNIT-TOKO.md`.*
