# Unit Cafe LSP

> **unitType:** `cafe_lsp` | **Jalur:** Retail/F&B (StoreSale) | **API:** `/api/toko/sales`

---

## Ringkasan

Counter-based F&B. Pelanggan order di counter → nomor antrian → ambil pesanan saat dipanggil.
**Manajemen tidak menggunakan resep/bahan baku otomatis.** HPP diisi manual. Produk default `trackStock=false` (stok tidak dipotong saat jual).

---

## Sidebar (Mei 2026)

### Kasir (4 item)

| Menu | Route |
|---|---|
| Kasir POS | `/cafe-lsp/kasir` |
| Order Queue | `/cafe-lsp/antrian` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |

### Admin (7 item)

| Menu | Route | Icon |
|---|---|---|
| Kasir POS | `/cafe-lsp/kasir` | Coffee |
| Kitchen Display | `/cafe-lsp/kds` | Monitor |
| Manajemen Menu | `/cafe-lsp/produk` | Package |
| Promo & Diskon | `/cafe-lsp/marketing` | Tag |
| Persediaan & Stok | `/cafe-lsp/persediaan` | Boxes |
| Shift Kasir | `/cafe-lsp/shift` | Timer |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` | ClipboardList |

+ LAPORAN (`/unit/cafe-lsp/laporan`), PERSETUJUAN (`/approval`), AKUN (`/profil`)

### Hidden dari Sidebar (tetap accessible via URL)

| Route | Status |
|---|---|
| `/cafe-lsp/bahan-baku` | Hidden — manajemen tidak pakai resep otomatis |
| `/cafe-lsp/batch` | Hidden — tidak dipakai |
| `/cafe-lsp/opname` | Hidden — tombol Opname ada di halaman Persediaan |

---

## Akun

| Role | Email | Password |
|---|---|---|
| Admin | `admincafelsp@koperasi.com` | `password123` |
| Kasir | `kasircafelsp@koperasi.com` | `password123` |

---

## Fitur POS

| Fitur | Status |
|---|---|
| POS Counter-based (grid + filter + search) | ✅ |
| Foto menu (imageUrl) + Quick Keys | ✅ |
| Notes per item (metadata) | ✅ |
| Nomor Antrian (server-side atomic) | ✅ |
| 3 Metode bayar (Tunai/QRIS/Potong Gaji) | ✅ |
| Shift validation + lock + shiftId | ✅ |
| Order Queue Panel + Board | ✅ |
| Struk Receipt 80mm | ✅ |
| Kitchen Display System (KDS) | ✅ |
| HPP Manual (field costPrice, tidak otomatis dari resep) | ✅ |
| Persediaan & Stok + tombol Opname | ✅ |

---

## Perbedaan vs Resto Latar

| Aspek | Resto Latar | Cafe LSP |
|---|---|---|
| Tipe | Dine-in + Takeaway | Counter-based |
| Denah Meja | ✅ | ❌ |
| Nomor Antrian | ❌ | ✅ |
| Quick Keys | ❌ | ✅ |
| Modifier & Add-on | ✅ | ❌ (hidden) |
| Opname di sidebar | ✅ | ❌ (via Persediaan) |

---

## File Terkait

| File | Fungsi |
|---|---|
| `src/lib/constants/navigation.ts` | `adminCafeLspNavigation` (7 item) + `kasirCafeLspNavigation` (4 item) |
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | POS Dedicated |
| `src/app/(protected)/cafe-lsp/kds/page.tsx` | KDS wrapper |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | Order Queue Board |
| `src/app/api/toko/products/route.ts` | Produk API (`trackStock` default false) |
| `src/app/api/toko/sales/route.ts` | Checkout (shared) |
| `src/app/api/toko/queue/route.ts` | Nomor antrian |

---

## Changelog

- **21 Mei 2026** — Sidebar dipangkas 12→7 item. Hapus Bahan Baku, Batch, Opname, Order Queue dari sidebar admin. Default `trackStock=false` untuk produk baru. HPP manual tooltip di form Tambah Menu. Tombol Opname di Persediaan.
- **18 Mei 2026** — Edit NRP fix, operator hierarchy cleanup.
