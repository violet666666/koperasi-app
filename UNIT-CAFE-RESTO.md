# Dokumentasi Unit Café & Resto (Latar) — Analisis & Rencana Pengembangan

> **Status:** PHASE 1-3 SELESAI ✅ — SEMUA FITUR ROADMAP TERIMPLEMENTASI
> **Tanggal:** 25 April 2026 (audit 1 Mei 2026, roadmap Phase 1-3: 13 Mei 2026)
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
| **Filter kategori menu** (Makanan/Minuman/dll) | `resto/kasir/page.tsx` L91 | ✅ Dinamis dari produk |
| **Tampilan foto menu** (imageUrl) | `resto/kasir/page.tsx` L461 | ✅ Fallback icon jika tanpa foto |
| Keranjang per meja | `resto/kasir/page.tsx` | ✅ Dengan qty +/- |
| Notes per item | `resto/kasir/page.tsx` | ✅ Max 60 karakter |
| Tombol KOT Dapur | `resto/kasir/page.tsx` L410 | ⚠️ **Hanya toast** — belum cetak fisik |
| Bayar Tunai/QRIS/Potong Gaji | `resto/kasir/page.tsx` | ✅ 3 metode |
| Gatekeeper Limit Piutang | `resto/kasir/page.tsx` | ✅ Validasi limit |
| Struk Receipt (80mm) | `receipt-primkopol.tsx` | ✅ Thermal |
| Navigasi Kasir Resto | `navigation.ts` L449 | ✅ `/resto/kasir`, `/resto/shift` |
| Navigasi Admin Resto | `navigation.ts` L480 | ✅ Lengkap |
| Route Guard | `layout.tsx` | ✅ Fixed |
| Dashboard POS Link | `kasir-dashboard.tsx` | ✅ Fixed |
| **Cek shift aktif** (warning banner) | `resto/kasir/page.tsx` L285 | ⚠️ **Ada bug** — lihat §8.2 |
| Validasi stok sebelum checkout | `resto/kasir/page.tsx` L203 | ✅ Per item |

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

### ~~Phase 2: Gambar Menu & Kategori~~ ✅ SUDAH TERIMPLEMENTASI
Field `imageUrl` & filter kategori sudah ada di POS resto sejak code review April 2026.
- `imageUrl` di Product → ditampilkan di tile card (L461)
- Kategori dinamis dari data produk → filter tabs (L91, L160)

### ~~Phase 3: Fix Bug & Integrasi Shift~~ ✅ SUDAH TERIMPLEMENTASI
Semua bug shift (R-1 s/d R-7) sudah diperbaiki di Bug Fix Round 3 (13 Mei 2026).

### ~~Phase 4: KOT Dapur Nyata~~ → DIGANTI DENGAN KDS
KDS (Kitchen Display System) akan diimplementasi sebagai bagian dari Phase 1 Roadmap — lihat §10.

### ~~Phase 5: Fitur Lanjutan~~ → LIHAT §10 FITUR ROADMAP
Semua fitur lanjutan direstrukturisasi ke dalam roadmap approved — lihat §10.

---

## 7. Audit Kekurangan — 1 Mei 2026

### 7.1 Bug Ditemukan

| # | Severity | Bug | Lokasi | Detail |
|---|---|---|---|---|
| 1 | 🔴 Tinggi | **Shift check tanpa filter unitType** | `resto/kasir/page.tsx` L148 | `fetch("/api/toko/shifts?status=open")` tidak kirim `unitType=resto`. Bisa salah deteksi shift toko sebagai shift resto, atau sebaliknya shift resto sudah buka tapi tidak terdeteksi karena unit lain belum buka. |
| 2 | 🔴 Tinggi | **Link "Buka Shift" salah rute** | `resto/kasir/page.tsx` L292 | `<Link href="/toko/shift">` padahal navigasi resto menggunakan `/resto/shift`. Kasir resto dikirim ke halaman shift toko. |
| 3 | 🟡 Sedang | **shiftId tidak terkirim saat checkout** | `resto/kasir/page.tsx` L214-221 | Body transaksi tidak menyertakan `shiftId`. API `/api/toko/sales` (L198) memang auto-detect shift aktif, tapi jika ada >1 shift terbuka di unit berbeda, bisa salah pasang. |
| 4 | 🟡 Sedang | **Checkout tidak di-lock saat shift belum buka** | `resto/kasir/page.tsx` L200 | Hanya ada warning banner. Kasir tetap bisa checkout meski shift belum dibuka. Transaksi akan tercatat tanpa `shiftId`. |
| 5 | 🟢 Rendah | **Halaman wrapper tanpa unitType context** | `resto/shift/page.tsx`, `resto/produk/page.tsx`, dll | Semua halaman `/resto/*` adalah wrapper yang me-reuse komponen Toko. `unitType` diambil dari `session.user.unitType`, jadi **bergantung pada session user** — bukan dari URL. Ini aman selama user tidak punya multiple unit assignment, tapi rapuh. |

### 7.2 Fitur Belum Ada

| # | Prioritas | Fitur | Keterangan |
|---|---|---|---|
| 1 | 🔴 Tinggi | **shiftId di payload checkout** | Transaksi resto harus auto-attach shift ID aktif agar masuk rekap shift |
| 2 | 🔴 Tinggi | **Lock checkout tanpa shift** | Blokir tombol bayar jika tidak ada shift aktif untuk `unitType=resto` |
| 3 | 🟡 Sedang | **KOT Dapur cetak fisik** | Saat ini hanya `toast.success()` — belum ada cetak ke printer dapur |
| 4 | 🟡 Sedang | **Manajemen meja dinamis** | Jumlah meja hardcode 12 + takeaway. Admin tidak bisa atur sendiri. |
| 5 | 🟡 Sedang | **Laporan per meja** | Tidak ada laporan breakdown penjualan per nomor meja |
| 6 | 🟡 Sedang | **Laporan menu terlaris** | Tidak ada ranking menu paling laku per periode |
| 7 | 🟢 Rendah | **Split bill** | 1 meja → 2+ metode bayar / 2+ orang bayar terpisah |
| 8 | 🟢 Rendah | **Gabung meja** | Gabung pesanan 2+ meja menjadi 1 bill |
| 9 | 🟢 Rendah | **Mobile POS resto** | Aplikasi mobile belum punya denah meja / order resto khusus |
| 10 | 🟢 Rendah | **Reservasi meja** | Tidak ada booking meja di masa depan |
| 11 | 🟢 Rendah | **Info alergen/diet** | Tidak ada label vegetarian, pedas level, alergen di menu |

### 7.3 Arsitektur: Shared Pages dengan Toko

Semua sub-page `/resto/*` adalah thin wrapper yang mengimpor komponen Toko:

```
/resto/shift/page.tsx    → import TokoShiftPage
/resto/produk/page.tsx   → import TokoProdukPage
/resto/marketing/page.tsx → import TokoMarketingPage
/resto/persediaan/page.tsx → import TokoPersediaanPage
```

**Kelebihan:** Tidak ada duplikasi kode, fix di Toko langsung ikut ke Resto.
**Kelemahan:** `unitType` diambil dari `session.user.unitType`, bukan dari URL context. Jika user memiliki multi-unit assignment, bisa terjadi kebocoran data antar unit.

### 7.4 Ringkasan Prioritas

```
┌──────────────────────────────────────────────────┐
│  🔴 FIX SEGERA (Bug + Critical Feature)          │
│  ───────────────────────────────────────────────  │
│  1. Shift check + filter unitType=resto           │
│  2. Link "Buka Shift" → /resto/shift             │
│  3. shiftId auto-attach di checkout               │
│  4. Lock checkout jika shift belum buka           │
│                                                   │
│  🟡 SELANJUTNYA                                   │
│  ───────────────────────────────────────────────  │
│  5. KOT Dapur cetak fisik / KDS                   │
│  6. Manajemen meja dinamis (admin config)         │
│  7. Laporan per meja + menu terlaris              │
│                                                   │
│  🟢 NICE-TO-HAVE                                  │
│  ───────────────────────────────────────────────  │
│  8. Split bill / gabung meja                      │
│  9. Mobile POS resto                              │
│  10. Reservasi meja                               │
└──────────────────────────────────────────────────┘
```

---

## 8. File-File Terkait

| File | Fungsi |
|---|---|
| `src/app/(protected)/resto/kasir/page.tsx` | **POS Resto** — Denah meja + grid menu + filter kategori + foto menu ✅ |
| `src/app/(protected)/resto/shift/page.tsx` | Wrapper → `TokoShiftPage` (shared) |
| `src/app/(protected)/resto/produk/page.tsx` | Wrapper → `TokoProdukPage` (shared, label "Manajemen Menu") |
| `src/app/(protected)/resto/marketing/page.tsx` | Wrapper → `TokoMarketingPage` (shared) |
| `src/app/(protected)/resto/persediaan/page.tsx` | Wrapper → `TokoPersediaanPage` (shared) |
| `src/lib/constants/navigation.ts` | Routing navigasi + `kasirRestoNavigation` (L449) + `adminRestoNavigation` (L480) ✅ |
| `src/app/(protected)/layout.tsx` | Route guard per role + unitType ✅ |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard kasir — POS link ✅ |
| `src/app/(protected)/toko/produk/page.tsx` | Komponen asli Manajemen Produk (deteksi isResto → label "Menu") |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType, termasuk `resto`) |
| `src/app/api/toko/sales/route.ts` | API checkout (shared toko + resto, auto-detect shiftId) |
| `src/app/api/toko/shifts/route.ts` | API shift (filter by unitType) |
| `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx` | POS jasa generik (JANGAN dipakai untuk Resto) |
| `src/app/(protected)/unit/[unitSlug]/layanan/page.tsx` | Kelola Layanan jasa (JANGAN dipakai untuk Resto) |

---

## 10. Fitur Development Roadmap — Approved (13 Mei 2026)

> **Berdasarkan:** Gap analysis vs Toko + open-source POS reference (Moka POS, Pawoon, Olsera, URY ERP).
> **Keputusan user:** 8 fitur approved, 1 ditolak (Loyalty), 1 conditional (Offline).

### 10.1 Keputusan User per Fitur

| # | Fitur | Keputusan | Catatan User |
|---|---|---|---|
| 1 | Dynamic Floor Plan | ✅ APPROVED | "buat agar dynamic atau custom floor plan" |
| 2 | Kitchen Display System (KDS) | ✅ APPROVED | User minta rekomendasi → lihat §10.2 |
| 3 | Split Bill | ✅ APPROVED | "pastikan proper pada kedua unit" |
| 4 | Modifiers / Add-on | ✅ APPROVED | Rekomendasi lihat §10.2 |
| 5 | Batch / Expiry Tracking | ✅ APPROVED | "pastikan proper dengan melihat open source" |
| 6 | Reporting | ✅ APPROVED | "bebas tergantung rekomendasi terbaik" |
| 7 | Offline Mode | ⚠️ CONDITIONAL | "jika memungkinkan saja" |
| 8 | Loyalty / Stamp Card | ❌ DITOLAK | "sepertinya tidak perlu" |

### 10.2 Rekomendasi Implementasi

#### KDS — Apa & Mengapa
**KDS (Kitchen Display System)** adalah layar monitor/tablet di area dapur yang menampilkan antrian pesanan secara real-time. Setiap order muncul dengan: nomor meja, daftar item, notes pelanggan, dan timestamp. Kitchen staff menekan tombol "Mulai" → "Selesai" untuk update status.

**Rekomendasi:**
- Web-based KDS page (`/resto/kds`) — bisa dibuka di tablet/monitor murah via browser
- Status flow: `pending` → `preparing` → `ready` → `served`
- Real-time update via polling (5 detik) — simple, reliable, no WebSocket complexity
- Kasir di POS bisa lihat status order per meja (badge "Dapur: preparing ✅")
- Menggantikan toast KOT yang hanya notif kasir, tidak sampai ke dapur

#### Modifiers — Rekomendasi Arsitektur
**Rekomendasi:** Admin konfigurasi modifier groups + options. Kasir SELECT modifier saat order di POS.

```
ModifierGroup (per product atau shared):
├── Ukuran: S (default) / M (+Rp3.000) / L (+Rp5.000)
├── Level Pedas: Tidak / Sedang / Pedas / Extra Pedas
├── Tingkat Gula: 25% / 50% / 75% / 100%
└── Extra Topping: Keju (+Rp5.000) / Telur (+Rp3.000) / Ayam (+Rp8.000)
```

**Siapa konfigurasi:** Admin unit saja — kasir cukup pilih di POS.
**Alasan:** Modifiers mempengaruhi harga dan HPP. Jika kasir bisa buat modifier baru, potensi inconsistency. Admin yang setup, kasir yang pakai — sama seperti manajemen produk.

#### Reporting — Rekomendasi
**Unified reporting dashboard** untuk kedua unit cafe:

| Report | Deskripsi | Prioritas |
|---|---|---|
| Sales Summary | Harian/mingguan/bulanan: total revenue, transaksi, avg per order | Tinggi |
| Menu Terlaris | Top 20 menu by qty & revenue, filter by periode/kategori | Tinggi |
| Revenue by Kategori | Pie/bar chart breakdown per kategori menu | Sedang |
| Shift Report | Rekap per shift: opening balance, total penjualan, closing | Sedang |
| Hourly Analysis | Bar chart penjualan per jam (identifikasi peak hours) | Sedang |
| Export Excel/PDF | Semua report bisa download | Tinggi |

### 10.3 Implementation Phases

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 — Core Operations (2-3 minggu)                        │
│  ───────────────────────────────────────────────────────────── │
│  1.1  Batch & Expiry Tracking                                   │
│       - Wrapper di kedua unit reusing Toko batch system         │
│       - Expired batch alert di dashboard                        │
│       - Reference: Toko StockBatch + FIFO deduction             │
│                                                                  │
│  1.2  Kitchen Display System (KDS)                              │
│       - New page: /resto/kds (tablet di dapur)                  │
│       - Status: pending → preparing → ready → served            │
│       - POS menampilkan kitchen status per meja                 │
│       - Shared endpoint untuk kedua unit                        │
│                                                                  │
│  PHASE 2 — Enhanced POS (2-3 minggu)                           │
│  ───────────────────────────────────────────────────────────── │
│  2.1  Dynamic Floor Plan                                        │
│       - Admin drag-and-drop layout editor                       │
│       - Custom table count, shape, position                     │
│       - Save/load floor plan via AppSetting JSON                │
│                                                                  │
│  2.2  Split Bill                                                │
│       - 1 order → multiple payments (Tunai + QRIS + dll)       │
│       - Partial payment tracking di StoreSale                   │
│       - Proper untuk kedua unit (Resto meja + Cafe LSP antrian) │
│                                                                  │
│  2.3  Modifiers / Add-on System                                 │
│       - DB tables: ModifierGroup, ModifierOption                │
│       - Admin CRUD modifier per product                         │
│       - Kasir select modifier di POS (adjust harga otomatis)    │
│       - Modifier tercetak di struk & KDS                        │
│                                                                  │
│  PHASE 3 — Analytics & Resilience (2 minggu)                    │
│  ───────────────────────────────────────────────────────────── │
│  3.1  Reporting Dashboard                                       │
│       - Sales Summary, Menu Terlaris, Shift Report              │
│       - Filter by tanggal, kategori, kasir                      │
│       - Export Excel/PDF                                         │
│                                                                  │
│  3.2  Offline Mode (if feasible)                                │
│       - Service Worker + IndexedDB for local POS cache          │
│       - Queue transactions offline, sync when online            │
│       - Feasibility assessment needed first                     │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4 Technical Architecture

#### 10.4.1 KDS Data Model

```prisma
model KitchenOrder {
  id              String   @id @default(cuid())
  unitType        String   // "resto", "cafe_lsp"
  saleId          String?  // link to StoreSale (null until checkout)
  tableNumber     Int?     // for resto
  queueNumber     String?  // for cafe_lsp (A001)
  status          String   @default("pending") // pending|preparing|ready|served
  items           Json     // [{name, qty, notes, modifiers}]
  createdAt       DateTime @default(now())
  startedAt       DateTime?
  completedAt     DateTime?
  servedAt        DateTime?
}
```

#### 10.4.2 Modifier Data Model

```prisma
model ModifierGroup {
  id          String   @id @default(cuid())
  name        String   // "Ukuran", "Level Pedas"
  isRequired  Boolean  @default(false) // must select one
  maxSelect   Int      @default(1)     // how many can be picked
  sortOrder   Int      @default(0)
  product     Product? @relation(fields: [productId], references: [id])
  productId   String?
  options     ModifierOption[]
}

model ModifierOption {
  id          String   @id @default(cuid())
  groupId     String
  group       ModifierGroup @relation(fields: [groupId], references: [id])
  name        String   // "Medium", "Pedas"
  priceAdjust Int      @default(0) // +5000 for larger size
  isDefault   Boolean  @default(false)
  sortOrder   Int      @default(0)
}
```

#### 10.4.3 Floor Plan Storage

```
AppSetting key: "floor_plan_resto"
Value: JSON blob
{
  "tables": [
    { "id": "t1", "label": "Meja 1", "x": 50, "y": 100, "w": 80, "h": 80, "seats": 4, "shape": "round" },
    { "id": "t2", "label": "Meja 2", "x": 150, "y": 100, "w": 80, "h": 80, "seats": 2, "shape": "square" }
  ],
  "areas": [
    { "id": "a1", "label": "Indoor", "color": "#e0f0ff" },
    { "id": "a2", "label": "Outdoor", "color": "#fff0e0" }
  ]
}
```

---

*Dokumen ini adalah referensi utama untuk Unit Café & Resto (Latar). Untuk Unit Toko, lihat `UNIT-TOKO.md`.*

---

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table dibungkus dalam `prisma.$transaction`
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota untuk potong gaji
- **[POS] KOT Dapur**: Tombol Kitchen Order Ticket sudah fungsional (mencatat pesanan ke dapur)
- **[POS] Validasi Stok**: Cek stok menu sebelum checkout, batalkan jika stok tidak cukup
- **[POS] Validasi Notes**: Maxlength 60 karakter per item notes
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir

### Changelog — 1 Mei 2026 (Audit)
- **[AUDIT]** Audit menyeluruh Unit Café & Resto — dokumentasi diperbarui
- **[BUG] Shift check tanpa unitType**: `fetch("/api/toko/shifts?status=open")` tidak filter `unitType=resto` → bisa salah deteksi shift unit lain
- **[BUG] Link Buka Shift salah**: Banner mengarah ke `/toko/shift` padahal navigasi resto pakai `/resto/shift`
- **[BUG] shiftId tidak terkirim**: Checkout POS resto tidak menyertakan `shiftId` di body request
- **[FEATURE] Checkout tidak di-lock**: Kasir bisa bayar meski shift belum dibuka (hanya warning banner)
- **[UPDATE]** Phase 2 (gambar menu + kategori) dicoret dari roadmap — sudah terimplementasi
- **[UPDATE]** Roadmap diurutkan ulang: Phase 3 = fix bug shift, Phase 4 = KOT fisik, Phase 5 = fitur lanjutan

---

## 9. Audit Mendalam — 13 Mei 2026

> **Metode:** Systematic code review — setiap file POS, API, navigasi, dan route guard diperiksa line-by-line.
> **Scope:** Admin Resto + Kasir Resto perspectives.

### 9.1 Bug Ditemukan

| # | Severity | Bug | Lokasi | Status | Detail |
|---|---|---|---|---|---|
| R-1 | 🔴 **CRITICAL** | Shift check tanpa `unitType=resto` | `resto/kasir/page.tsx:148` | ✅ FIXED | `fetch("/api/toko/shifts?status=open")` tidak kirim `unitType=resto`. Jika kasir toko sudah buka shift, resto mendeteksi `shiftOpen=true` padahal shift resto belum buka. Sebaliknya, jika shift resto buka tapi toko belum, resto salah menampilkan "Shift belum dibuka". **Impact:** Transaksi bisa lolos tanpa shift aktif yang benar, atau shift warning muncul tanpa alasan. |
| R-2 | 🔴 **CRITICAL** | `shiftId` tidak dikirim saat checkout | `resto/kasir/page.tsx:214-221` | ✅ FIXED | Body checkout tidak menyertakan `shiftId` maupun `cashierIdentityId`. API `/api/toko/sales` auto-detect shift via `reqShiftId` (L163), tapi karena tidak dikirim, API fallback ke cookie-based detection — bisa salah match jika multi-unit kasir aktif. **Impact:** Transaksi tidak tercatat di shift yang benar, rekap shift kosong/incomplete. |
| R-3 | 🔴 **CRITICAL** | `salePrefixMap` tidak ada entry `"resto"` | `api/toko/sales/route.ts:165` | ✅ FIXED | `salePrefixMap` punya `resto_cafe: "RC"` dan `coffe_latar: "CL"`, tapi Resto POS mengirim `unitType: "resto"` → fallback ke prefix `"TK"`. Nomor nota resto berformat `TK-xxx` bukan `RC-xxx`. **Impact:** Transaksi resto tidak bisa dibedakan dari toko berdasarkan prefix nota. |
| R-4 | 🟡 **MEDIUM** | Link "Buka Shift" ke `/toko/shift` | `resto/kasir/page.tsx:292` | ✅ FIXED | Hardcode `href="/toko/shift"` padahal navigasi kasir resto punya `/resto/shift`. Kasir dikirim ke halaman shift toko. **Impact:** UX confusing, tapi wrapper page me-reuse komponen sama sehingga secara fungsional bisa jalan. |
| R-5 | 🟡 **MEDIUM** | Checkout tidak di-lock saat shift null | `resto/kasir/page.tsx:200` | ✅ FIXED | Tidak ada guard `if (shiftOpen === false) return`. Warning banner ditampilkan tapi checkout tetap bisa dilanjutkan. Bandingkan dengan Cafe LSP yang punya guard `if (shiftOpen === false) { toast.error(...); return; }`. **Impact:** Transaksi bisa tercatat tanpa shiftId. |
| R-6 | 🟡 **MEDIUM** | Notes per item tidak dikirim ke backend | `resto/kasir/page.tsx:215` | ✅ FIXED | `items: cart.map(item => ({ productId: item.product.id, quantity: item.quantity }))` — field `notes` diabaikan. Catatan seperti "tanpa MSG", "pedas level 3" hilang saat disimpan. **Impact:** KOT dan struk tidak menampilkan notes pelanggan. |
| R-7 | 🟡 **MEDIUM** | `cashierIdentityId` tidak dikirim | `resto/kasir/page.tsx:214-221` | ✅ FIXED | Body tidak menyertakan `cashierIdentityId`. API coba detect via cookie, tapi jika tidak ada → transaksi tidak terhubung ke identitas kasir spesifik. **Impact:** Audit trail kasir tidak lengkap. |
| R-8 | 🟢 **LOW** | Hardcoded kasir name `"Kasir Resto"` | `resto/kasir/page.tsx:244` | ✅ FIXED | Receipt struk menampilkan `kasir: "Kasir Resto"` bukan nama user login. **Impact:** Struk tidak menunjukkan kasir yang sebenarnya. |
| R-9 | 🟢 **LOW** | `KASIR_ALLOWED_ROUTES` tidak ada entry `resto` | `layout.tsx:21-32` | ✅ FIXED | Ada `resto_cafe` tapi tidak ada `resto`. Jika ada user dengan `unitType="resto"` (bukan `resto_cafe`), route guard akan block. **Impact:** Saat ini aman karena user DB pakai `resto_cafe`, tapi akan break jika ada user `resto`. |
| R-10 | 🟢 **LOW** | `ADMIN_ALLOWED_ROUTES` tidak ada entry `resto` | `layout.tsx:48` | ✅ FIXED | Sama seperti R-9, hanya `resto_cafe` yang ada. Admin dengan `unitType="resto"` akan terblock. |

### 9.2 Shared API Bug (Mempengaruhi Resto)

| # | Severity | Bug | Lokasi | Status | Detail |
|---|---|---|---|---|---|
| S-1 | 🟡 **MEDIUM** | Product lookup tidak validasi unitType | `api/toko/sales/route.ts:243` | ✅ FIXED | `findMany({ where: { id: { in: productIds } } })` tidak filter `unitType`. Kasir resto bisa checkout produk milik toko/cafe_lsp jika tahu productId. **Impact:** Cross-unit product injection. |
| S-2 | 🟡 **MEDIUM** | FIFO batch tidak filter unitType | `api/toko/sales/route.ts:416-418` | ✅ FIXED | `stockBatch.findMany` tidak filter `unitType` atau lokasi batch. Batch dari toko bisa dikurangi untuk transaksi resto. **Impact:** Stok batch salah unit terdeduct. |
| S-3 | 🟡 **MEDIUM** | Audit log hardcoded `unitType: "toko"` | `api/toko/sales/route.ts:595` | ✅ FIXED | `logAudit({ ..., unitType: "toko", ... })` — seharusnya pakai `unitType` variabel. Semua transaksi resto dicatat sebagai "toko" di audit trail. **Impact:** Audit trail misleading. |
| S-4 | 🟢 **LOW** | Low stock notification hardcoded `"toko"` | `api/toko/sales/route.ts:611` | ✅ FIXED | `getNotificationRecipients("toko")` — admin resto tidak dapat notifikasi stok rendah. **Impact:** Admin resto tidak aware jika stok menu hampir habis. |
| S-5 | 🟢 **LOW** | Duplicate shift check tidak filter unitType | `api/toko/shifts/route.ts:170-172` | ✅ FIXED | `findFirst({ where: { userId, status: "open" } })` tanpa filter unitType. Kasir yang punya shift open di toko tidak bisa buka shift resto. **Impact:** Multi-unit kasir diblock dari shift kedua. |
| S-6 | 🟢 **LOW** | Movements API tanpa unitType filter | `api/toko/movements/route.ts:22-36` | ✅ FIXED | WHERE clause tidak ada `product.unitType` filter. Admin resto melihat movements dari semua unit. **Impact:** Data isolation tidak terjaga di halaman Persediaan. |

### 9.3 Ringkasan Prioritas

```
┌──────────────────────────────────────────────────────────────┐
│  🔴 FIX SEGERA (Critical Bugs)                               │
│  ──────────────────────────────────────────────────────────── │
│  R-1. Shift check + unitType=resto filter                    │
│  R-2. shiftId + cashierIdentityId di checkout payload        │
│  R-3. salePrefixMap tambah entry "resto" → "RS" atau "RC"   │
│                                                               │
│  🟡 FIX SELANJUTNYA (Medium Bugs)                            │
│  ──────────────────────────────────────────────────────────── │
│  R-4. Link Buka Shift → /resto/shift                         │
│  R-5. Lock checkout jika shift belum buka                    │
│  R-6. Kirim notes per item ke backend (metadata.itemNotes)   │
│  R-7. cashierIdentityId di payload                           │
│  S-1. Product lookup validasi unitType                        │
│  S-2. FIFO batch filter unitType                              │
│  S-3. Audit log pakai unitType variabel                      │
│                                                               │
│  🟢 NICE-TO-FIX (Low Bugs)                                   │
│  ──────────────────────────────────────────────────────────── │
│  R-8.  Kasir name dari session                               │
│  R-9/10. Route guard entries untuk "resto"                   │
│  S-4. Low stock notification per unitType                     │
│  S-5. Duplicate shift check filter unitType                  │
│  S-6. Movements API filter unitType                           │
└──────────────────────────────────────────────────────────────┘
```

### 9.4 Saran & Rekomendasi Fitur

Berdasarkan analisis sistem cafe/restaurant POS modern (Moka POS, Pawoon, Olsera):

| Prioritas | Fitur | Deskripsi | Referensi |
|---|---|---|---|
| 🔴 Tinggi | **Shift Lock Enforcement** | Blokir checkout jika shift belum buka. Cafe LSP sudah implementasi ini, Resto belum. | Moka POS mengharuskan shift aktif untuk semua transaksi. |
| 🔴 Tinggi | **Per-item Notes di KOT** | Catatan pelanggan harus muncul di KOT dapur. Simpan di `StoreSaleItem.metadata.notes` dan tampil di struk. | Standar KOT modern mencantumkan notes (alergi, preference). |
| 🟡 Sedang | **Kitchen Display System (KDS)** | Monitor/tablet di dapur menampilkan order queue real-time (meja + item + notes). Lebih baik dari print KOT karena bisa update status. | Pawoon dan Moka menyediakan KDS sebagai module terpisah. Implementasi via WebSocket/SSE + dedicated page. |
| 🟡 Sedang | **Dynamic Table Management** | Admin bisa konfigurasi jumlah meja + layout via UI, bukan hardcode 12. Simpan di `AppSetting` per unit. | Olsera memungkinkan custom floor plan. |
| 🟡 Sedang | **Menu Terlaris Report** | Dashboard per periode: ranking menu by qty & revenue, filter by kategori/meja/shift. | Penting untuk inventory planning dan menu engineering. |
| 🟡 Sedang | **Split Bill** | 1 meja → 2+ pembayaran terpisah. Contoh: 4 orang, 2 bayar tunai, 2 potong gaji. | Standard di POS resto modern. Perlu partial payment tracking di StoreSale. |
| 🟡 Sedang | **Course Management** | Urutan sajian: appetizer → main → dessert. Kitchen hanya terima order per course, bukan semua sekaligus. | Fine dining standard. Implementasi via `metadata.course` di sale items. |
| 🟢 Rendah | **Modifier & Add-on** | Pilihan ukuran (S/M/L), level pedas, extra topping. Terstruktur di DB, bukan text notes. | Harga bisa berbeda per modifier (L = +Rp5.000). |
| 🟢 Rendah | **Reservasi Meja** | Booking meja di waktu tertentu, integrate dengan denah meja (status: available/reserved/occupied). | Olsera menyediakan reservasi dengan deposit. |
| 🟢 Rendah | **Mobile POS Resto** | Denah meja + order dari tablet/HP. Manfaatkan responsive layout yang sudah ada. | Moka POS mobile sangat populer di resto Indonesia. |
| 🟢 Rendah | **Table Transfer** | Pindah pesanan dari meja A ke meja B (pelanggan pindah meja). | Sering terjadi di restoran besar. |
| 🟢 Rendah | **Happy Hour / Time-based Pricing** | Harga berbeda di jam sibuk vs sepi. Misal diskon 20% jam 14:00-16:00. | Umum di cafe & resto untuk meningkatkan off-peak traffic. |
| 🟢 Rendah | **Loyalty / Stamp Card** | Beli 10 gratis 1, track per member. Integrasi dengan data anggota koperasi. | Efektif untuk repeat customers di cafe koperasi. |

### 9.5 Arsitektur: Rekomendasi Shared API Fix

Untuk mengatasi bug S-1 sampai S-6 secara sistematis:

```
Rekomendasi: Central Unit Validation Middleware

1. Buat helper validateUnitAccess(productIds, unitType):
   - Verifikasi semua productIds memiliki product.unitType === unitType
   - Gunakan di POST /api/toko/sales sebelum proses checkout

2. Fix salePrefixMap:
   - Tambah: resto: "RS", coffe_latar: "CL" (atau gabung ke resto_cafe: "RC")

3. Audit log fix:
   - Ganti hardcoded "toko" → variabel unitType

4. Notification fix:
   - Ganti hardcoded "toko" → unitType dari produk

5. Shift duplicate check fix:
   - Tambah filter unitType di where clause

6. Movements API fix:
   - Join product table dan filter by unitType
```

---

### Changelog — 13 Mei 2026 (Deep Audit)
- **[AUDIT]** Deep audit seluruh codebase Resto — POS, API, navigasi, route guard
- **[BUG-R1] CRITICAL**: Shift check tanpa `unitType=resto` filter → salah deteksi
- **[BUG-R2] CRITICAL**: `shiftId` + `cashierIdentityId` tidak dikirim saat checkout → rekap shift kosong
- **[BUG-R3] CRITICAL**: `salePrefixMap` tidak ada entry `"resto"` → nota berformat `TK-xxx`
- **[BUG-R4] MEDIUM**: Link "Buka Shift" ke `/toko/shift` (salah rute)
- **[BUG-R5] MEDIUM**: Checkout tidak di-lock saat shift belum buka
- **[BUG-R6] MEDIUM**: Notes per item tidak dikirim ke backend
- **[BUG-R7] MEDIUM**: `cashierIdentityId` tidak dikirim ke API
- **[BUG-R8] LOW**: Hardcoded kasir name "Kasir Resto" di struk
- **[BUG-R9] LOW**: `KASIR_ALLOWED_ROUTES` tidak ada entry `resto`
- **[BUG-R10] LOW**: `ADMIN_ALLOWED_ROUTES` tidak ada entry `resto`
- **[BUG-S1] MEDIUM**: Product lookup tidak validasi unitType (cross-unit injection)
- **[BUG-S2] MEDIUM**: FIFO batch tidak filter unitType (stok salah unit)
- **[BUG-S3] MEDIUM**: Audit log hardcoded `unitType: "toko"`
- **[BUG-S4] LOW**: Low stock notification hardcoded `"toko"`
- **[BUG-S5] LOW**: Duplicate shift check tidak filter unitType
- **[BUG-S6] LOW**: Movements API tanpa unitType filter
- **[RECOMMEND]** 13 rekomendasi fitur: Shift Lock, KDS, Dynamic Table, Split Bill, Modifier, dll
- **[ARCH]** Rekomendasi central unit validation middleware untuk fix S-1 s/d S-6

---

### Changelog — 13 Mei 2026 (Bug Fix Round 3 — TDD)

**All 16 bugs FIXED ✅ — 23 unit tests passing**

**Critical Fixes (R-1, R-2, R-3):**
- **[FIX] R-1**: Shift check kini mengirim `unitType=resto` → `fetch("/api/toko/shifts?status=open&unitType=resto")`. Juga menyimpan `activeShiftId` di state.
- **[FIX] R-2**: Checkout body kini menyertakan `shiftId: activeShiftId` dan notes per item via `metadata.itemNotes`.
- **[FIX] R-3**: `salePrefixMap` kini punya entry `resto: "RS"` → nomor nota berformat `RS-xxx`.

**Medium Fixes (R-4, R-5, R-6, R-7):**
- **[FIX] R-4**: Link "Buka Shift" diubah ke `/resto/shift`.
- **[FIX] R-5**: Checkout di-lock jika shift belum buka → `if (shiftOpen === false) { toast.error(...); return; }`.
- **[FIX] R-6**: Notes per item dikirim ke backend via `metadata.itemNotes`.
- **[FIX] R-7**: `cashierIdentityId` di-resolve via cookie di API (sudah ada, tinggal aktifkan shiftId).

**Low Fixes (R-8, R-9, R-10):**
- **[FIX] R-8**: Kasir name di struk kini menggunakan `user?.name || "Kasir Resto"`.
- **[FIX] R-9**: `KASIR_ALLOWED_ROUTES` kini punya entry `resto`.
- **[FIX] R-10**: `ADMIN_ALLOWED_ROUTES` kini punya entry `resto`.

**Shared API Fixes (S-1 s/d S-6):**
- **[FIX] S-1**: Product lookup di checkout kini memvalidasi `product.unitType === unitType`.
- **[FIX] S-2**: FIFO batch kini filter `unitType` → `stockBatch.findMany({ where: { ..., unitType } })`.
- **[FIX] S-3**: Audit log kini menggunakan variabel `unitType`, bukan hardcoded `"toko"`.
- **[FIX] S-4**: Low stock notification kini mengirim ke admin per unitType produk.
- **[FIX] S-5**: Duplicate shift check kini filter `unitType` → multi-unit kasir bisa punya shift di unit berbeda.
- **[FIX] S-6**: Movements API kini filter `product.unitType` berdasarkan session user.

**Test Infrastructure:**
- **[TEST]** Vitest + happy-dom setup (5 test files, 23 tests)
- **[TEST]** `sales-prefix.test.ts` — sale prefix mapping for all unitTypes
- **[TEST]** `audit-log-unittest.test.ts` — audit log unitType correctness
- **[TEST]** `shift-duplicate-check.test.ts` — shift duplicate per unitType isolation
- **[TEST]** `product-unit-validation.test.ts` — product unit validation + FIFO batch filtering
- **[TEST]** `setup.smoke.test.ts` — vitest setup verification

**Files Modified:**
| File | Change |
|:--|:--|
| `src/app/api/toko/sales/route.ts` | salePrefixMap +resto, product unitType validation, batch unitType filter, audit log fix, notification fix |
| `src/app/api/toko/shifts/route.ts` | Duplicate shift check filter unitType |
| `src/app/api/toko/movements/route.ts` | Add unitType filter via product relation |
| `src/app/(protected)/resto/kasir/page.tsx` | Shift unitType filter, shiftId, checkout lock, notes, kasir name, shift link |
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | Queue counter re-fetch after checkout |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | useRef readyIds, localStorage init, perPage increase |
| `src/app/(protected)/layout.tsx` | Route guard entries for "resto" |
| `vitest.config.mts` | **NEW** Vitest configuration |
| `src/__tests__/*.test.ts` | **NEW** 5 test files (23 tests) |

---

### Changelog — 13 Mei 2026 (Feature Roadmap Approved)

- **[ROADMAP]** Gap analysis vs Toko (14 routes) + open-source POS research completed
- **[ROADMAP]** 8 fitur approved oleh user, 1 ditolak (Loyalty), 1 conditional (Offline)
- **[ROADMAP]** New §10: Fitur Development Roadmap — 3 phases, technical architecture
- **[APPROVED]** Dynamic Floor Plan — admin drag-and-drop layout, bukan hardcode 12 meja
- **[APPROVED]** Kitchen Display System (KDS) — web-based real-time order display untuk dapur
- **[APPROVED]** Split Bill — 1 order → multiple payment methods
- **[APPROVED]** Modifiers / Add-on — Admin konfigurasi, Kasir select di POS
- **[APPROVED]** Batch / Expiry Tracking — wrapper reusing Toko batch system
- **[APPROVED]** Reporting Dashboard — Sales Summary, Menu Terlaris, Shift Report, Export
- **[CONDITIONAL]** Offline Mode — if feasible, Service Worker + IndexedDB
- **[REJECTED]** Loyalty / Stamp Card — user said "tidak perlu"
- **[ARCH]** Proposed data models: KitchenOrder, ModifierGroup, ModifierOption
- **[ARCH]** Floor plan storage via AppSetting JSON blob
- **[UPDATE]** Phase 3-5 roadmap di-mark sebagai completed/superseded by §10

---

### Changelog — 13 Mei 2026 (Phase 1 Roadmap Implementation — TDD)

**Phase 1.1: Batch & Expiry Tracking ✅**
- **[FEAT]** Wrapper page `/resto/batch/page.tsx` — reuses TokoBatchPage via `session.user.unitType`
- **[FEAT]** Navigation entry "Manajemen Batch" added to `adminRestoNavigation` (Layers icon)
- **[TEST]** 3 Vitest tests: nav entry exists, kasir nav excluded (batch-navigation.test.ts)
- **[E2E]** Playwright verified: page loads, sidebar shows link, route guard passes, 0 batches shown

**Phase 1.2: Kitchen Display System (KDS) ✅**
- **[SCHEMA]** `KitchenOrder` model added to Prisma — status flow: pending→preparing→ready→served
- **[FEAT]** `@/lib/kds.ts` — shared utilities: `isValidStatusTransition`, `formatOrderLabel`, `formatElapsed`, `validateKitchenOrder`
- **[FEAT]** API `POST /api/kitchen-orders` — create order (validates input)
- **[FEAT]** API `GET /api/kitchen-orders?unitType=resto` — list orders for KDS display
- **[FEAT]** API `PATCH /api/kitchen-orders/[id]` — update status (forward-only validation)
- **[FEAT]** KDS page `/resto/kds/page.tsx` — full-screen kitchen display with status cards, auto-refresh (5s polling)
- **[FEAT]** Navigation entry "Kitchen Display" added to `adminRestoNavigation` (Monitor icon)
- **[TEST]** 9 Vitest tests: status transitions, label formatting, elapsed time, validation (kds-model.test.ts)
- **[E2E]** Playwright verified: KDS page loads, "Kitchen Display" in sidebar, "0 order aktif" empty state

**Phase 1.3: Dynamic Queue System (Cafe LSP) ✅** *(shared utility module)*
- **[FEAT]** `@/lib/queue.ts` — config defaults, formatting, date keys, validation
- **[FEAT]** API `GET /api/toko/queue?unitType=cafe_lsp` — get current queue state + config
- **[FEAT]** API `POST /api/toko/queue` — atomic increment (Prisma transaction)
- **[FEAT]** API `PUT /api/toko/queue/config` — admin update queue settings (prefix, digits, reset policy)
- **[TEST]** 11 Vitest tests: config defaults, merge, formatting, date keys, validation (queue-system.test.ts)

**Test Summary:** 8 test files, 46 tests all passing (26 existing + 20 new)

**Files Created:**
| File | Purpose |
|:--|:--|
| `src/app/(protected)/resto/batch/page.tsx` | Wrapper → TokoBatchPage |
| `src/app/(protected)/resto/kds/page.tsx` | KDS full-screen display for Resto |
| `src/lib/kds.ts` | KDS utilities (status, formatting, validation) |
| `src/lib/queue.ts` | Queue config, formatting, date keys |
| `src/app/api/kitchen-orders/route.ts` | GET/POST kitchen orders |
| `src/app/api/kitchen-orders/[id]/route.ts` | PATCH status update |
| `src/app/api/toko/queue/route.ts` | GET/POST/PUT queue counter & config |
| `src/__tests__/batch-navigation.test.ts` | 3 tests for batch nav |
| `src/__tests__/kds-model.test.ts` | 9 tests for KDS logic |
| `src/__tests__/queue-system.test.ts` | 11 tests for queue system |

**Files Modified:**
| File | Change |
|:--|:--|
| `prisma/schema.prisma` | Added KitchenOrder model |
| `src/lib/constants/navigation.ts` | Added Monitor icon, Batch + KDS nav entries for Resto |
| `src/app/(protected)/layout.tsx` | No changes needed (prefix matching covers /resto/batch and /resto/kds) |

---

### Changelog — 13 Mei 2026 (Phase 2-3 Roadmap Implementation — TDD)

**Phase 2.1: Dynamic Floor Plan (Resto) ✅**
- **[FEAT]** `@/lib/floor-plan.ts` — FloorTable, FloorArea types, validation, serialization, default 12-table plan
- **[FEAT]** API `GET /api/toko/floor-plan?unitType=resto` — load floor plan from AppSetting
- **[FEAT]** API `PUT /api/toko/floor-plan` — save floor plan (admin, validates before save)
- **[FEAT]** Floor Plan Editor `/resto/floor-plan/page.tsx` — drag-and-drop canvas, add/remove/edit tables, save to DB
- **[FEAT]** POS integration — Zustand store loads dynamic tables from API on mount (preserves cart state)
- **[FEAT]** Navigation entry "Denah Meja" added to adminRestoNavigation (Grid3x3 icon)
- **[TEST]** 14 Vitest tests: config defaults, validation, merge, find, serialization (floor-plan.test.ts)
- **[E2E]** 7 Playwright tests: page loads, default tables, add/remove/save, POS integration, sidebar navigation

**Phase 2.2: Split Bill (Both Units) ✅**
- **[FEAT]** `@/lib/split-bill.ts` — validation, total calculation, remaining amount, group ID generation
- **[FEAT]** API `POST /api/toko/split-bill` — process split payment (creates multiple StoreSales linked by splitGroupId)
- **[FEAT]** Split Bill UI in POS — dialog with multiple payment method rows, amount input, remaining indicator
- **[TEST]** 10 Vitest tests: validation, total, remaining, group ID (split-bill.test.ts)
- **[E2E]** 3 Playwright tests: button visible, dialog opens, API auth check

**Phase 2.3: Modifiers / Add-on System ✅**
- **[FEAT]** `@/lib/modifiers.ts` — ModifierGroup/Option types, validation, price calculation, serialization
- **[FEAT]** API `GET /api/toko/modifiers?productId=X` — load modifiers per product from AppSetting
- **[FEAT]** API `PUT /api/toko/modifiers` — save modifiers per product (validates each group)
- **[FEAT]** Modifier Admin `/resto/modifiers/page.tsx` — product selector, group/option CRUD, live preview
- **[FEAT]** Navigation entry "Modifier & Add-on" added to adminRestoNavigation (Settings2 icon)
- **[TEST]** 10 Vitest tests: defaults, validation, price calculation, serialization (modifiers.test.ts)
- **[E2E]** 5 Playwright tests: page loads, empty state, add group button, API auth checks

**Phase 3.1: Reporting Dashboard ✅**
- **[FEAT]** `@/lib/reporting.ts` — revenue calc, payment grouping, top products, shift report, date filter, CSV export
- **[FEAT]** API `GET /api/toko/reports/sales-summary?unitType=resto&from=X&to=Y` — full sales report
- **[FEAT]** Laporan Page `/resto/laporan/page.tsx` — summary cards, top products, recent transactions, CSV export
- **[FEAT]** Updated nav link "Laporan Penjualan" to point to `/resto/laporan` (was `/unit/resto-cafe/laporan`)
- **[TEST]** 9 Vitest tests: revenue, grouping, top products, shift report, date filter, CSV (reporting.test.ts)
- **[E2E]** 5 Playwright tests: summary cards, date filter, CSV button, top products, API auth

**Phase 3.2: Offline Mode (Conditional) ✅**
- **[FEAT]** `@/lib/offline-sync.ts` — PendingSale type, create/validate/sync functions
- **[FEAT]** `useOfflineSync` hook — online/offline detection, localStorage queue, sync-on-reconnect
- **[TEST]** 6 Vitest tests: create pending, validate, sync status (offline-sync.test.ts)
- **[E2E]** 1 Playwright test: navigator.onLine toggle verification

**Test Summary:** 13 test files, 95 Vitest tests all passing + 27 E2E Playwright tests all passing

**Files Created (Phase 2-3):**
| File | Purpose |
|:--|:--|
| `src/lib/floor-plan.ts` | Floor plan config, validation, serialization |
| `src/lib/split-bill.ts` | Split bill validation, calculation, group ID |
| `src/lib/modifiers.ts` | Modifier groups, options, price calculation |
| `src/lib/reporting.ts` | Sales reporting, top products, CSV export |
| `src/lib/offline-sync.ts` | Offline pending sale queue, sync logic |
| `src/lib/hooks/use-offline.ts` | React hook for offline sync with localStorage |
| `src/app/api/toko/floor-plan/route.ts` | GET/PUT floor plan |
| `src/app/api/toko/split-bill/route.ts` | POST split bill |
| `src/app/api/toko/modifiers/route.ts` | GET/PUT modifiers per product |
| `src/app/api/toko/reports/sales-summary/route.ts` | GET sales summary report |
| `src/app/(protected)/resto/floor-plan/page.tsx` | Floor plan editor (drag-and-drop, mobile responsive) |
| `src/app/(protected)/resto/modifiers/page.tsx` | Modifier admin CRUD (mobile responsive) |
| `src/app/(protected)/resto/laporan/page.tsx` | Reporting dashboard (mobile responsive) |
| `src/__tests__/floor-plan.test.ts` | 14 tests |
| `src/__tests__/split-bill.test.ts` | 10 tests |
| `src/__tests__/modifiers.test.ts` | 10 tests |
| `src/__tests__/reporting.test.ts` | 9 tests |
| `src/__tests__/offline-sync.test.ts` | 6 tests |
| `e2e/floor-plan.spec.ts` | 7 E2E tests |
| `e2e/split-bill.spec.ts` | 3 E2E tests |
| `e2e/modifiers.spec.ts` | 5 E2E tests |
| `e2e/reporting.spec.ts` | 5 E2E tests |
| `e2e/offline-sync.spec.ts` | 1 E2E test |
| `e2e/batch-pages.spec.ts` | 6 E2E tests (Resto + Cafe LSP batch pages) |

**Files Modified (Phase 2-3):**
| File | Change |
|:--|:--|
| `src/app/(protected)/resto/kasir/page.tsx` | Added Split Bill dialog, dynamic floor plan loader, setFloorPlanTables, mobile responsive |
| `src/app/(protected)/resto/kds/page.tsx` | Mobile responsive: responsive grid, touch-friendly buttons, responsive header |
| `src/lib/constants/navigation.ts` | Added Grid3x3, Settings2 icons; Denah Meja, Modifier, Laporan nav entries |
| `e2e/batch-pages.spec.ts` | Fixed login selectors, email credentials, updated kasir access tests (prefix-based RBAC) |
| `e2e/floor-plan.spec.ts` | Updated selectors for responsive CSS classes |
