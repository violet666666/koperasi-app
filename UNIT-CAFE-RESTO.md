# Dokumentasi Unit Café & Resto (Latar) — Analisis & Rencana Pengembangan

> **Status:** PHASE 1 SELESAI ✅ — AUDIT MEI 2026 SELESAI ✅
> **Tanggal:** 25 April 2026 (audit 1 Mei 2026)
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

### Phase 3: Fix Bug & Integrasi Shift 🔴 PRIORITAS TINGGI
- **Bug:** Cek shift tanpa `unitType=resto` → bisa salah deteksi shift unit lain
- **Bug:** Link "Buka Shift" di banner mengarah ke `/toko/shift` bukan `/resto/shift`
- **Bug:** `shiftId` tidak dikirim saat checkout → transaksi tidak tercatat di shift
- **Feature:** Lock checkout jika shift belum dibuka (saat ini hanya warning banner)
- **Feature:** Rekap kas per shift khusus resto

### Phase 4: KOT Dapur Nyata 🟡
- Ganti toast placeholder → cetak KOT ke thermal printer dapur
- Atau integrasi kitchen display system (KDS)
- Nomor meja + item + notes di tiket KOT

### Phase 5: Fitur Lanjutan 🟢
- Manajemen meja dinamis (admin atur jumlah meja, bukan hardcode 12)
- Split bill (1 meja → 2+ metode bayar)
- Gabung meja (2 meja → 1 bill)
- Laporan per meja / per shift / per menu terlaris
- Mobile POS khusus resto (denah meja + order dari HP)

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
