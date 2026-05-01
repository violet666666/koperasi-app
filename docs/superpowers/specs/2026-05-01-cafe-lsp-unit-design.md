# Design Spec: Unit Cafe LSP

**Date:** 2026-05-01
**Status:** Approved
**Approach:** A — Dedicated POS Page

---

## 1. Overview

Unit baru **Cafe LSP** ditambahkan ke sistem Koperasi PRIMKOPPOL. Cafe ini bersifat **counter-based** (tanpa meja dine-in), pelanggan order di counter dan mengambil pesanan saat dipanggil via nomor antrian.

**unitType:** `cafe_lsp`
**Jalur:** Retail/F&B (StoreSale) — sama dengan Toko dan Resto Latar

---

## 2. Arsitektur & Data Model

### 2.1 Jalur Sistem

```
JALUR 2: Unit Retail/F&B (StoreSale)
├── Toko → /toko/kasir (tabel + barcode)
├── Resto Latar → /resto/kasir (grid + denah meja)
└── Cafe LSP → /cafe-lsp/kasir (grid + counter + antrian) ← NEW
```

### 2.2 Database

Tidak ada perubahan Prisma schema. `cafe_lsp` kompatibel dengan:
- `StoreSale.unitType` (String field)
- `StoreProduct.unitType` (String field)
- `CashierShift.unitType` (String field)
- `UnitSetting.unitType` (String field)

### 2.3 Validation Whitelist Updates

File yang perlu ditambah `"cafe_lsp"`:
- `src/app/api/users/route.ts` → `VALID_UNIT_TYPES` array
- `src/lib/validations/index.ts` → `unitType` z.enum
- `prisma/schema.prisma` → comment di User.unitType (dokumentasi saja)

### 2.4 Nomor Antrian

Disimpan di `StoreSale.metadata` JSON field:
```json
{
  "queueNumber": "A012",
  "orderType": "counter",
  "notes": []
}
```

Counter increment: hitung `StoreSale` hari ini dengan `unitType=cafe_lsp`, lalu +1.
Format: `A` + 3-digit zero-padded (`A001`, `A002`, ... `A999`).

### 2.5 Quick Keys

Disimpan di `StoreProduct.metadata` JSON field:
```json
{
  "isQuickKey": true
}
```

Admin toggle di halaman Manajemen Menu.
Fallback: jika tidak ada quick key diset, tampilkan 8 produk terlaris dari data penjualan.

---

## 3. POS Kasir — Layout & Flow

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ CAFE LSP POS                        [Shift: Pagi ✅] [⟳] │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│  SEARCH: [________]  │   KERANJANG (0 item)            │
│                      │   ─────────────────────          │
│  [★ Quick] [Semua]   │   (items here)                   │
│  [Minuman] [Makanan] │   - each item has qty +/-        │
│  [Snack]             │   - notes input per item         │
│                      │                                  │
│  ┌─────┐ ┌─────┐    │   ─────────────────────          │
│  │ foto │ │ foto │    │   Subtotal: Rp XX.XXX          │
│  │Kopi  │ │Teh   │    │                                  │
│  │15.000│ │10.000│    │   [Tunai] [QRIS] [Potong Gaji] │
│  └─────┘ └─────┘    │                                  │
│  ...more items...    │   Nomor Antrian: A012           │
│                      │                                  │
│                      │   [🧾 Cetak Struk]              │
├──────────────────────┴──────────────────────────────────┤
│  ORDER QUEUE:                                           │
│  [A010 Kopi 2x ✅ Siap] [A011 Nasi 1x ⏳] [A012 ...]    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Alur Kerja

1. Kasir pilih menu dari grid visual atau quick keys → item masuk keranjang
2. Edit keranjang: qty +/-, notes per item ("kurang manis", "tanpa es")
3. Pilih metode bayar: Tunai / QRIS / Potong Gaji
4. Checkout → sistem generate nomor antrian otomatis (A001, A002...)
5. Cetak struk 80mm dengan nomor antrian tercetak
6. Pesanan muncul di Order Queue Board bawah dengan status "Menunggu"
7. Barista/kasir klik "Selesai" → status berubah "Siap Diambil"

### 3.3 Fitur POS

| Fitur | Detail |
|---|---|
| Grid menu visual | Tile card + foto + fallback icon |
| Filter kategori | Dinamis dari data produk (Semua, Minuman, Makanan, Snack) |
| Quick Keys | Tab khusus ★ Quick — 6-8 item paling sering dipesan |
| Search | Cari menu by nama |
| Keranjang | Qty +/-, hapus item, notes per item (max 60 char) |
| 3 Metode bayar | Tunai, QRIS, Potong Gaji (dengan validasi plafon) |
| Nomor antrian | Auto-increment per hari, format A001-A999 |
| Shift validation | Cek shift aktif `unitType=cafe_lsp`, lock checkout jika belum buka |
| shiftId auto-attach | Kirim shiftId aktif ke API saat checkout |
| Struk 80mm | Thermal receipt dengan nomor antrian, nama menu, harga |
| Order queue | Panel bawah: kartu pesanan aktif, status menunggu/selesai |
| Stok validation | Cek stok sebelum checkout |

### 3.4 State Management

Zustand store (persist localStorage) untuk:
- Keranjang belanja
- Nomor antrian terakhir
- State order queue

---

## 4. Admin Portal

### 4.1 Navigasi Kasir (`kasirCafeLspNavigation`)

| Menu | Route | Icon |
|---|---|---|
| Dashboard | `/dashboard` | LayoutDashboard |
| **CAFE LSP** | | |
| Kasir POS | `/cafe-lsp/kasir` | Coffee |
| Order Queue | `/cafe-lsp/antrian` | ClipboardList |
| Shift Kasir | `/cafe-lsp/shift` | Timer |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` | Receipt |
| **AKUN** | | |
| Profil Saya | `/profil` | User |

### 4.2 Navigasi Admin (`adminCafeLspNavigation`)

| Menu | Route | Icon |
|---|---|---|
| Dashboard | `/dashboard` | LayoutDashboard |
| **CAFE & MENU** | | |
| Kasir POS | `/cafe-lsp/kasir` | Coffee |
| Order Queue | `/cafe-lsp/antrian` | ClipboardList |
| Manajemen Menu | `/cafe-lsp/produk` | Package |
| Promo & Diskon | `/cafe-lsp/marketing` | Tag |
| Persediaan & Stok | `/cafe-lsp/persediaan` | Boxes |
| Shift Kasir | `/cafe-lsp/shift` | Timer |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` | Receipt |
| **LAPORAN & KEUANGAN** | | |
| Laporan Penjualan | `/unit/cafe-lsp/laporan` | BarChart2 |
| **PERSETUJUAN** | | |
| Inbox Approval | `/approval` | Bell |
| **AKUN** | | |
| Profil Saya | `/profil` | User |

### 4.3 Admin CRUD Capabilities

| Fitur | CRUD Detail |
|---|---|
| Manajemen Menu | Tambah/edit/hapus menu, upload foto, set kategori, set harga, set isService, atur stok |
| Quick Keys | Toggle "Quick Key" di halaman produk (metadata.isQuickKey) |
| Promo & Diskon | CRUD promo (persen/fixed), tanggal mulai/selesai |
| Persediaan & Stok | Update stok, riwayat masuk/keluar, opname |
| Shift | Buka/tutup shift, atur jadwal shift |
| Laporan | Harian/mingguan/bulanan, export Excel, filter per shift/kategori/metode bayar |
| Void | Approval void transaksi via inbox approval |
| QRIS | Upload/update QRIS image per unit |

---

## 5. Route Guard

```typescript
// KASIR_ALLOWED_ROUTES
cafe_lsp: ["/unit", "/transaksi-unit", "/cafe-lsp"]

// ADMIN_ALLOWED_ROUTES
cafe_lsp: ["/unit", "/transaksi-unit", "/cafe-lsp", "/toko", "/approval"]
```

---

## 6. User Accounts

| Role | Email | Password | unitType |
|---|---|---|---|
| Admin | `admincafelsp@koperasi.com` | `password123` | `cafe_lsp` |
| Kasir | `kasircafelsp@koperasi.com` | `password123` | `cafe_lsp` |

Dibuat via seed script agar konsisten dengan pattern unit lain.

---

## 7. File Changes Summary

### BARU

| File | Deskripsi |
|---|---|
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | POS Dedicated counter-based (~500-600 baris) |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | Order Queue Board — display pesanan aktif |
| `src/app/(protected)/cafe-lsp/produk/page.tsx` | Wrapper → TokoProdukPage |
| `src/app/(protected)/cafe-lsp/shift/page.tsx` | Wrapper → TokoShiftPage |
| `src/app/(protected)/cafe-lsp/marketing/page.tsx` | Wrapper → TokoMarketingPage |
| `src/app/(protected)/cafe-lsp/persediaan/page.tsx` | Wrapper → TokoPersediaanPage |
| `UNIT-CAFE-LSP.md` | Dokumentasi unit Cafe LSP |

### EDIT

| File | Perubahan |
|---|---|
| `src/lib/constants/navigation.ts` | Tambah `kasirCafeLspNavigation` + `adminCafeLspNavigation` + mapping di `getNavigationForUser` |
| `src/app/(protected)/layout.tsx` | Tambah `cafe_lsp` ke route guard |
| `src/app/api/users/route.ts` | Tambah `"cafe_lsp"` ke `VALID_UNIT_TYPES` |
| `src/lib/validations/index.ts` | Tambah `"cafe_lsp"` ke unitType enum |
| `prisma/seed.ts` | Tambah `{ unit: "cafe_lsp", label: "Cafe LSP", emailKey: "cafelsp" }` ke `UNIT_STAFF` |

### MOBILE (EDIT)

| File | Perubahan |
|---|---|
| `mobile/screens/KasirScreen.tsx` (atawa setara) | Tambah `{ id: 'cafe_lsp', name: 'Cafe LSP' }` ke `UNIT_TYPES` |

---

## 8. Out of Scope (Nice-to-Have / Future)

- Split bill
- Kitchen Display System (KDS) real hardware integration
- Reservasi meja
- Customer display (monitor terpisah)
- Integrasi printer KOT dapur
- Mobile POS dedicated untuk Cafe LSP (counter-based layout khusus)
