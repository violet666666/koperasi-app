# Dokumentasi Unit Café & Resto (Latar) — Analisis & Rencana Pengembangan

> **Status:** PHASE 1 SELESAI ✅  
> **Tanggal:** 25 April 2026  
> **Referensi Terkait:** `UNIT-TOKO.md`

---

## 1. Ringkasan Masalah (SOLVED ✅)

### 1.1 Masalah Awal

Unit **Resto & Cafe (Latar)** memiliki **identitas ganda** (split identity) di dalam sistem:

- Kasir `resto_cafe` diarahkan ke POS **jasa** (`/unit/resto-cafe/kasir`) yang berupa dropdown layanan sederhana — **SALAH**
- Halaman "Kelola Layanan" (`/unit/resto-cafe/layanan`) menampilkan paket layanan jasa tanpa gambar/stok — **TIDAK RELEVAN** untuk Resto
- POS Resto yang benar sudah ada di `/resto/kasir` (denah meja + grid menu) tapi **tidak terhubung** ke navigasi `resto_cafe`

### 1.2 Solusi yang Diterapkan (25 April 2026)

#### ✅ Fix 1: Navigasi Kasir Resto (`navigation.ts`)
Dibuat `kasirRestoNavigation` baru yang mengarahkan kasir `resto_cafe` ke:
- **Kasir POS** → `/resto/kasir` (denah meja + grid menu)
- **Shift Kasir** → `/toko/shift` (shared)
- **Riwayat Penjualan** → `/transaksi-unit/riwayat?unitType=resto`

#### ✅ Fix 2: Navigasi Admin Resto (`navigation.ts`)
Dibuat `adminRestoNavigation` baru yang mengarahkan admin `resto_cafe` ke:
- **Kasir POS** → `/resto/kasir` (denah meja + grid menu)
- **Manajemen Menu** → `/toko/produk` (CRUD produk + gambar)
- **Promo & Diskon** → `/toko/marketing`
- **Persediaan & Stok** → `/toko/persediaan`
- **Shift Kasir** → `/toko/shift`
- **Riwayat Penjualan** → `/transaksi-unit/riwayat?unitType=resto`
- **Laporan** → `/unit/resto-cafe/laporan`
- **Inbox Approval** → `/approval`

**Menu "Kelola Layanan & Harga" DIHAPUS** dari navigasi admin resto.

#### ✅ Fix 3: Route Guard (`layout.tsx`)
- Kasir `resto_cafe` → ditambahkan akses `/resto` dan `/toko/shift`
- Admin `resto_cafe` → ditambahkan akses `/resto`

#### ✅ Fix 4: Dashboard POS Link (`kasir-dashboard.tsx`)
- `resto_cafe`, `resto`, `coffe_latar` → tombol "Buka Kasir POS" sekarang mengarah ke `/resto/kasir`

#### ✅ Fix 5: Routing Logic (`navigation.ts` → `getNavigationForUser`)
- Kasir `resto_cafe`/`resto`/`coffe_latar` → `kasirRestoNavigation`
- Admin `resto_cafe`/`resto`/`coffe_latar` → `adminRestoNavigation`
- Admin `toko` → `adminTokoNavigation` (tetap)
- Admin jasa lain → `adminUnitNavigation` (tetap, dengan "Kelola Layanan")

---

## 2. Arsitektur POS: Dua Jalur Sistem

```
┌─────────────────────────────────────────────────────┐
│  JALUR 1: Unit Jasa (UnitTransaction)               │
│  Cocok untuk: Barbershop, Cuci Mobil, PlayStation    │
│  ─────────────────────────────────────────────────── │
│  • Tidak ada stok fisik                             │
│  • Input = dropdown "Paket Layanan" + nominal        │
│  • Kasir: /unit/[slug]/kasir (form sederhana)        │
│  • Admin: /unit/[slug]/layanan (CRUD paket & harga)  │
│  • API: /api/unit-layanan/sales                      │
│  • DB: UnitTransaction + UnitServicePackage          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  JALUR 2: Unit Retail/F&B (StoreSale)               │
│  Cocok untuk: Toko, Resto & Cafe                    │
│  ─────────────────────────────────────────────────── │
│  • Ada stok fisik (atau isService=true untuk menu)   │
│  • Input = pilih produk dari katalog, masukkan cart   │
│  • Kasir Toko: /toko/kasir (tabel + barcode)         │
│  • Kasir Resto: /resto/kasir (grid + denah meja) ✅  │
│  • Admin: /toko/produk (CRUD produk + gambar + HPP)  │
│  • API: /api/toko/sales                              │
│  • DB: StoreSale + StoreSaleItem + Product            │
└─────────────────────────────────────────────────────┘
```

---

## 3. Fitur POS Resto yang Sudah Ada

| Fitur | File | Status |
|---|---|---|
| Denah meja 12 + takeaway dinamis | `resto/kasir/page.tsx` | ✅ Berjalan |
| Zustand state (persist localStorage) | `resto/kasir/page.tsx` | ✅ Bill tahan refresh |
| Grid menu visual (tile card) | `resto/kasir/page.tsx` | ✅ Grid responsif |
| Keranjang per meja | `resto/kasir/page.tsx` | ✅ Dengan qty +/- |
| Notes per item | `resto/kasir/page.tsx` | ✅ "Pedes", "Es dipisah" |
| Tombol KOT Dapur | `resto/kasir/page.tsx` | ⚠️ Placeholder |
| Bayar Tunai/QRIS/Potong Gaji | `resto/kasir/page.tsx` | ✅ 3 metode |
| Gatekeeper Limit Piutang | `resto/kasir/page.tsx` | ✅ Validasi limit |
| Struk Receipt (80mm) | `receipt-primkopol.tsx` | ✅ Thermal |
| Navigasi Kasir Resto | `navigation.ts` | ✅ Fixed |
| Navigasi Admin Resto | `navigation.ts` | ✅ Fixed |
| Route Guard | `layout.tsx` | ✅ Fixed |
| Dashboard POS Link | `kasir-dashboard.tsx` | ✅ Fixed |

---

## 4. Role & Akses: Admin vs Kasir Resto

### 4.1 Kasir Resto

| Fitur | Akses | Link |
|---|---|---|
| Dashboard Kasir | ✅ | `/dashboard` |
| POS Resto (Denah Meja) | ✅ | `/resto/kasir` |
| Shift Kasir | ✅ | `/toko/shift` |
| Riwayat Transaksi | ✅ | `/transaksi-unit/riwayat?unitType=resto` |
| Profil Saya | ✅ | `/profil` |
| Kelola Menu / Produk | ❌ | — |
| Approve Void | ❌ | — |
| Laporan | ❌ | — |

### 4.2 Admin Resto

| Fitur | Akses | Link |
|---|---|---|
| Dashboard Admin | ✅ | `/dashboard` |
| POS Resto (Denah Meja) | ✅ | `/resto/kasir` |
| Manajemen Menu | ✅ | `/toko/produk` |
| Promo & Diskon | ✅ | `/toko/marketing` |
| Persediaan & Stok | ✅ | `/toko/persediaan` |
| Shift Kasir | ✅ | `/toko/shift` |
| Riwayat Penjualan | ✅ | `/transaksi-unit/riwayat?unitType=resto` |
| Laporan Penjualan | ✅ | `/unit/resto-cafe/laporan` |
| Inbox Approval | ✅ | `/approval` |
| Profil Saya | ✅ | `/profil` |

---

## 5. Perbandingan dengan Unit Toko

| Aspek | Unit Toko | Unit Resto & Cafe |
|---|---|---|
| **Sifat barang** | Produk fisik + jasa | Menu makanan/minuman |
| **POS Layout** | Tabel + search + barcode | Grid visual + denah meja |
| **Barcode Scanner** | ✅ Ya | ❌ Tidak relevan |
| **Denah Meja** | ❌ | ✅ 12 meja + takeaway |
| **KOT Dapur** | ❌ | ✅ (placeholder) |
| **Notes per item** | ❌ | ✅ |
| **Shift** | ✅ | ✅ (shared) |
| **Struk** | 58mm | 80mm |
| **API transaksi** | `/api/toko/sales` | `/api/toko/sales` (shared) |
| **Navigasi** | `kasirTokoNavigation` | `kasirRestoNavigation` ✅ |

---

## 6. Roadmap Selanjutnya

### Phase 2: Gambar Menu & Kategori 🟡
- Tambah field `imageUrl` ke Product (Prisma)
- Update tile card di POS resto → tampilkan foto menu
- Tab/filter kategori: Makanan, Minuman, Snack, Paket

### Phase 3: Integrasi Shift Kasir 🟡
- Lock POS resto jika shift belum dibuka
- `shiftId` auto-attach ke transaksi
- Rekap kas per shift

### Phase 4: Fitur Lanjutan 🟢
- KOT Dapur (real print implementation)
- Manajemen meja dinamis (admin atur jumlah meja)
- Split bill / gabung meja
- Laporan per meja / per shift

---

## 7. File-File Terkait

| File | Fungsi |
|---|---|
| `src/app/(protected)/resto/kasir/page.tsx` | **POS Resto** — Denah meja + grid menu ✅ |
| `src/lib/constants/navigation.ts` | Routing navigasi + `kasirRestoNavigation` + `adminRestoNavigation` ✅ |
| `src/app/(protected)/layout.tsx` | Route guard per role + unitType ✅ |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard kasir — POS link ✅ |
| `src/app/(protected)/toko/produk/` | Manajemen Produk (shared toko + resto) |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType) |
| `src/app/api/toko/sales/route.ts` | API checkout (shared toko + resto) |
| `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` | POS jasa generik (JANGAN dipakai untuk Resto) |
| `src/app/(protected)/unit/[unitSlug]/layanan/page.tsx` | Kelola Layanan jasa (JANGAN dipakai untuk Resto) |

---

*Dokumen ini adalah referensi utama untuk Unit Café & Resto (Latar). Untuk Unit Toko, lihat `UNIT-TOKO.md`.*
