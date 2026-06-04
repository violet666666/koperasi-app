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

+ LAPORAN (`/resto/laporan`), PERSETUJUAN (`/approval`), AKUN (`/profil`)

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
| `src/app/(protected)/resto/laporan/page.tsx` | Reporting dashboard |
| `src/app/api/toko/products/route.ts` | Produk API (`trackStock` default false) |
| `src/app/api/toko/sales/route.ts` | Checkout (shared) |
| `src/app/api/kitchen-orders/route.ts` | Kitchen orders (KDS) |

---

## Changelog

- **21 Mei 2026** — Sidebar dipangkas 12→10 item. Hapus Bahan Baku, Manajemen Batch dari sidebar admin. Default `trackStock=false` untuk produk baru. HPP manual tooltip di form Tambah Menu.
- **18 Mei 2026** — Edit NRP fix, operator hierarchy cleanup.
