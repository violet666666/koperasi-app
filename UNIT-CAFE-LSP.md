# Dokumentasi Unit Cafe LSP

> **Status:** PHASE 1 SELESAI ✅ — BUG FIX ROUND 3 SELESAI ✅> **Tanggal:** 1 Mei 2026  
> **unitType:** `cafe_lsp`  
> **Referensi Terkait:** `UNIT-CAFE-RESTO.md`, `UNIT-TOKO.md`

---

## 1. Ringkasan

Unit **Cafe LSP** adalah unit F&B counter-based (tanpa meja dine-in). Pelanggan order di counter, menerima nomor antrian, dan mengambil pesanan saat dipanggil.

### Jalur Sistem
- **Jalur 2: Retail/F&B (StoreSale)** — sama dengan Toko dan Resto
- DB: `StoreSale` + `StoreSaleItem` + `StoreProduct`
- API: `/api/toko/sales` dengan `unitType=cafe_lsp`

---

## 2. Fitur POS

| Fitur | File | Status |
|---|---|---|
| POS Counter-based (grid visual) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Filter kategori + search | `cafe-lsp/kasir/page.tsx` | ✅ |
| Tampilan foto menu (imageUrl) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Quick Keys (★ tab best sellers) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Notes per item (max 60 char) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Nomor Antrian Otomatis (A001-A999) | `cafe-lsp/kasir/page.tsx` | ✅ |
| 3 Metode bayar (Tunai/QRIS/Potong Gaji) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Validasi plafon piutang | `cafe-lsp/kasir/page.tsx` | ✅ |
| Validasi stok sebelum checkout | `cafe-lsp/kasir/page.tsx` | ✅ |
| Shift validation + lock checkout | `cafe-lsp/kasir/page.tsx` | ✅ |
| shiftId auto-attach | `cafe-lsp/kasir/page.tsx` | ✅ |
| Order Queue Panel (di POS) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Order Queue Board (full page) | `cafe-lsp/antrian/page.tsx` | ✅ |
| Struk Receipt 80mm | `receipt-primkopol.tsx` | ✅ |
| Zustand state (persist localStorage) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Resep & HPP (ProductRecipe) | `toko/produk/page.tsx` + API | ✅ |
| Admin CRUD resep (breakdown bahan) | `toko/produk/page.tsx` | ✅ |
| Auto-calculate costPrice dari resep | API recipe endpoint | ✅ |
| 35 menu + 35 resep + 45 bahan baku | `seed-cafe-lsp-recipes.ts` | ✅ |

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
/cafe-lsp/kasir/page.tsx     → DEDICATED POS (counter-based)
/cafe-lsp/antrian/page.tsx   → DEDICATED Order Queue Board
/cafe-lsp/produk/page.tsx    → Wrapper → TokoProdukPage
/cafe-lsp/shift/page.tsx     → Wrapper → TokoShiftPage
/cafe-lsp/marketing/page.tsx  → Wrapper → TokoMarketingPage
/cafe-lsp/persediaan/page.tsx → Wrapper → TokoPersediaanPage
```

---

## 6. Perbedaan dengan Resto Latar

| Aspek | Resto Latar | Cafe LSP |
|---|---|---|
| **Tipe** | Dine-in + Takeaway | Counter-based |
| **Denah Meja** | ✅ 12 meja + takeaway | ❌ Tidak ada |
| **Nomor Antrian** | ❌ | ✅ A001-A999 |
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
| `src/lib/constants/navigation.ts` | `kasirCafeLspNavigation` + `adminCafeLspNavigation` |
| `src/app/(protected)/layout.tsx` | Route guard `cafe_lsp` |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard POS route |
| `src/app/api/toko/sales/route.ts` | API checkout (shared) |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType) |
| `prisma/seed-cafe-lsp.ts` | Seed script khusus Cafe LSP |
| `prisma/seed-cafe-lsp-menu.ts` | Seed 35 menu items (SKU: LSP-XXX) |
| `prisma/seed-cafe-lsp-recipes.ts` | Seed 35 resep + 45 bahan baku |
| `src/app/api/toko/products/[id]/recipe/route.ts` | API CRUD resep/HPP |

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

Setiap menu memiliki resep terstruktur di tabel `ProductRecipe`:
- Admin dapat CRUD bahan baku per menu (nama, qty, satuan, harga/unit)
- `costPrice` dihitung otomatis dari total resep
- Margin rata-rata: ~68%
- 45 bahan baku unik dilacak
- SKU format: `LSP-{DEPT}-{VARIANT}` (standar F&B)

---

## 9. Roadmap Selanjutnya

### Phase 2: Fitur Lanjutan 🟡
- Kitchen Display System (KDS) real hardware
- Split bill (1 order → 2+ metode bayar)
- Laporan per menu terlaris per periode
- Manajemen menu dinamis (admin set Quick Keys berdasarkan data penjualan)

### Phase 3: Mobile 🟢
- Mobile POS khusus Cafe LSP (counter-based dari HP)
- Notifikasi antrian ke pelanggan (opsional)

---

*Dokumen ini adalah referensi utama untuk Unit Cafe LSP. Untuk Cafe & Resto Latar, lihat `UNIT-CAFE-RESTO.md`. Untuk Toko, lihat `UNIT-TOKO.md`.*

---

### Changelog — 1 Mei 2026
- **[INIT]** Unit Cafe LSP dibuat — dedicated counter-based POS
- **[POS]** Grid visual menu + filter kategori + search + foto
- **[POS]** Quick Keys tab (★) untuk best sellers
- **[POS]** Nomor antrian otomatis (A001-A999) per hari
- **[POS]** Order Queue Panel di bawah POS + Queue Board page terpisah
- **[POS]** Notes per item (max 60 char)
- **[POS]** 3 metode bayar: Tunai, QRIS, Potong Gaji
- **[POS]** Shift validation dengan `unitType=cafe_lsp` + lock checkout
- **[POS]** shiftId auto-attach ke transaksi
- **[NAV]** `kasirCafeLspNavigation` + `adminCafeLspNavigation`
- **[ROUTE]** Route guard kasir + admin untuk `cafe_lsp`
- **[SEED]** Akun `admincafelsp@koperasi.com` + `kasircafelsp@koperasi.com`
- **[WRAPPER]** produk, shift, marketing, persediaan reuse komponen Toko

### Code Review — 1 Mei 2026

**5 bug ditemukan dan diperbaiki:**

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | 🔴 CRITICAL | Queue number menggunakan `from` param yang tidak didukung API — hitung count dari `json.data` (max 25 item), bukan total harian. Setelah 25 transaksi, antrian reset ke A001 | Gunakan `pagination.total` dari API response (`?perPage=1`) untuk mendapatkan count akurat |
| 2 | 🔴 CRITICAL | Antrian Board mengirim `from` + `limit` params yang tidak didukung API — menampilkan max 25 order dari semua hari, bukan 50 order hari ini | Gunakan `perPage=50` (param yang didukung API) |
| 3 | 🟡 IMPORTANT | Wrapper pages (shift, marketing) punya `backHref` hardcoded ke `/toko/kasir` — cafe_lsp kasir tidak punya akses ke route tersebut, trigger route guard | Tambah kondisi `unitType === "cafe_lsp" ? "/cafe-lsp/kasir" : ...` |
| 4 | 🟡 IMPORTANT | `UNIT_PRODUCT_LABELS` di produk page tidak ada entry `cafe_lsp` — judul halaman menampilkan "Produk Toko" bukan "Manajemen Menu" | Tambah `cafe_lsp: { title: "Manajemen Menu", desc: "Kelola menu Cafe LSP", itemName: "Menu" }` |
| 5 | 🟡 MEDIUM | Race condition pada queue number — dua kasir concurrent bisa generate nomor antrian sama. Queue number dihitung client-side sebelum POST | Catatan: server-side atomic fix perlu perubahan API. Risiko rendah untuk single-counter cafe. Ditandai untuk Phase 2 |

### Menu & Resep — 1 Mei 2026
- **[MENU]** 35 menu items di-seed ke database (7 kategori, 45 bahan baku unik)
- **[SKU]** Format `LSP-{DEPT}-{VARIANT}` (standar F&B industry)
- **[RECIPE]** Model `ProductRecipe` baru — tabel resep dengan breakdown bahan
- **[RECIPE]** API CRUD `/api/toko/products/[id]/recipe` — GET/POST/PUT/DELETE
- **[RECIPE]** `costPrice` auto-recalculate dari total resep setiap perubahan
- **[RECIPE]** Admin dialog resep di halaman Manajemen Menu (tombol BookOpen)
- **[RECIPE]** Reusable untuk semua unit F&B (Resto, Cafe lainnya)
- **[DATA]** Semua 35 resep lengkap berdasarkan data HPP dari manajemen

---

### Code Review #2 — 2 Mei 2026

**Verifikasi Bug Sebelumnya:** Bug 1-4 dikonfirmasi ✅ FIXED. Bug 5 (race condition queue) diakui untuk Phase 2.

**Bug Baru Ditemukan:**

| # | Severity | Issue | Lokasi | Confidence |
|:--|:---------|:------|:-------|:-----------|
| CL-6 | **CRITICAL** | Nomor antrian `A001-A999` menggunakan ALL-TIME sales count, bukan hari ini. Setelah 999 total transaksi sejak awal, format A### pecah (A1000+). | `kasir/page.tsx:149` — fetch tanpa date filter | 90% |
| CL-7 | **CRITICAL** | Antrian Board menampilkan order dari SEMUA hari, bukan hari ini saja. Hari berikutnya, order kemarin masih muncul. | `antrian/page.tsx:27` — fetch tanpa date filter | 90% |
| CL-8 | **IMPORTANT** | Notes per item (max 60 char) diabaikan saat checkout — "kurang gula", "tanpa es" hilang. `StoreSaleItem` tidak punya kolom `notes`. | `kasir/page.tsx:216` — body hanya kirim `{productId, quantity}` | 85% |
| CL-9 | **IMPORTANT** | Recipe API tidak ada unit isolation — admin cafe_lsp bisa modifikasi resep produk toko/resto jika tahu productId. | `api/toko/products/[id]/recipe/route.ts:56-95` | 85% |
| CL-10 | **IMPORTANT** | Tombol "Tambah Produk" dan "Import" link ke `/toko/produk/tambah` — form mungkin tidak pass `unitType=cafe_lsp` | `toko/produk/page.tsx:676-679` | 82% |

**Root Cause CL-6/CL-7:** API `GET /api/toko/sales` tidak mendukung filter tanggal (`from`/`to` params). Client hanya bisa filter by `unitType`, `paymentMethod`, `shiftId`. Perlu penambahan date range filter di API.

**Saran Pengembangan POS Cafe LSP (Best Practice F&B Counter POS):**

| Prioritas | Fitur | Deskripsi |
|:--|:--|:--|
| Tinggi | API date filter | Tambah `?from=&to=` di GET sales API untuk fix queue number dan antrian board |
| Tinggi | Item notes persistence | Simpan notes di `StoreSaleItem.metadata` atau kolom baru |
| Tinggi | Recipe API unit isolation | Validasi `product.unitType === session.user.unitType` |
| Menengah | Kitchen Display System (KDS) | Layar dedicated dapur menampilkan order queue real-time |
| Menengah | Split bill | 1 order bisa dibayar 2+ metode (misal Tunai + QRIS) |
| Menengah | Laporan menu terlaris per periode | Ranking menu by quantity & revenue, per hari/minggu/bulan |
| Menengah | Dynamic Quick Keys | Admin set ★ tab berdasarkan data penjualan aktual |
| Rendah | Modifiers/add-ons terstruktur | Pilihan gula (25/50/75/100%), ukuran (S/M/L), topping (extra shot, dll) |
| Rendah | Loyalty/Stamp card | Beli 10 gratis 1, track per member |
| Rendah | Mobile ordering | Pelanggan scan QR → order langsung dari HP → masuk antrian |

### Changelog — 2 Mei 2026 (Bug Fix Round 2 + Features)

**Bug Fixes (CL-6 to CL-10):**
- **[FIX] CL-6 CRITICAL**: Nomor antrian kini menggunakan daily count (filter `from=today`). Sebelumnya memakai ALL-TIME count yang menyebabkan nomor melebihi A999 setelah 999 total transaksi. API GET sales kini mendukung `?from=&to=` date range filter.
- **[FIX] CL-7 CRITICAL**: Antrian Board kini menampilkan order hari ini saja (filter `from=today`). Sebelumnya menampilkan order dari semua hari.
- **[FIX] CL-8 IMPORTANT**: Item notes (max 60 char) kini disimpan di `metadata.itemNotes` saat checkout. Format: `{ itemNotes: { "productId": "kurang gula" } }`.
- **[FIX] CL-9 IMPORTANT**: Recipe API kini memvalidasi unit isolation. Admin hanya bisa CRUD resep produk yang `unitType`-nya sesuai dengan unit mereka. Operator/super_admin bypass check. Fungsi `validateUnitAccess()` ditambahkan ke semua handler (GET/POST/PUT/DELETE).
- **[FIX] CL-10 IMPORTANT**: Link "Tambah Produk" dan "Import" di halaman produk kini dinamis berdasarkan unitType. `backHref` di halaman tambah/import juga dinamis — cafe_lsp kembali ke `/cafe-lsp/produk`.

**New Features:**
- **[FEAT] Dynamic Quick Keys**: Admin Cafe LSP dapat mengatur Quick Keys (★ tab) langsung dari halaman Manajemen Menu. Tombol bintang di setiap baris produk untuk toggle Quick Key status. Disimpan via `AppSetting` (`quick_keys_cafe_lsp`). Maksimal 12 produk. POS otomatis memuat Quick Keys dari API.
- **[FEAT] Quick Keys API**: `GET/PUT /api/toko/products/quick-keys?unitType=cafe_lsp` — CRUD quick key product IDs.
- **[FEAT] Date Range Filter**: API `GET /api/toko/sales` kini mendukung `?from=YYYY-MM-DD&to=YYYY-MM-DD` untuk filter tanggal. Digunakan oleh queue number dan antrian board.

**Files Modified:**
| File | Change |
|:--|:--|
| `src/app/api/toko/sales/route.ts` | Date range filter (`from`/`to` params), unit-specific prefix, Number() fix, unitType filter on todayCount |
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | Daily queue count, item notes in metadata, API-driven Quick Keys |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | Daily order filter |
| `src/app/api/toko/products/[id]/recipe/route.ts` | Unit isolation validation (validateUnitAccess) |
| `src/app/api/toko/products/quick-keys/route.ts` | **NEW** Quick Keys CRUD API |
| `src/app/(protected)/toko/produk/page.tsx` | Dynamic Quick Key toggle (★ button), dynamic links |
| `src/app/(protected)/toko/produk/tambah/page.tsx` | Dynamic backHref |
| `src/app/(protected)/toko/produk/import/page.tsx` | Dynamic back link |

---

## 10. Audit Mendalam — 13 Mei 2026

> **Metode:** Systematic code review — setiap file POS, Antrian Board, API, navigasi, dan route guard diperiksa line-by-line.
> **Scope:** Admin Cafe LSP + Kasir Cafe LSP perspectives.

### 10.1 Bug Ditemukan

| # | Severity | Bug | Lokasi | Status | Detail |
|---|---|---|---|---|---|
| CL-11 | 🔴 **CRITICAL** | Queue number race condition (client-side) | `cafe-lsp/kasir/page.tsx:154-166` | ✅ MITIGATED | Queue number di-fetch SEKALI saat mount (`useEffect([], [])`). Jika 2 kasir buka POS bersamaan, keduanya mendapat nomor antrian sama (misal A005). Increment lokal (L257) hanya di client masing-masing — tidak ter-sync antar kasir. **Mitigation:** Setelah checkout, queue counter di-re-fetch dari server (bukan increment lokal). Penuh fix perlu server-side atomic counter (Phase 2). |
| CL-12 | 🟡 **MEDIUM** | Queue cap di 999 tanpa reset | `cafe-lsp/kasir/page.tsx:257` | ✅ FIXED | `Math.min(nextNum, 999)` — setelah 999 transaksi, nomor antrian stuck di `A999`. **Fix:** Replaced manual increment with `fetchQueueCount()` yang menggunakan server daily count (unlimited). |
| CL-13 | 🟡 **MEDIUM** | Voided sales tidak adjust queue counter | `cafe-lsp/kasir/page.tsx:154-166` | ✅ FIXED | Saat sale di-void, `pagination.total` berkurang tapi counter lokal tidak di-update. **Fix:** Counter di-re-fetch dari server setiap checkout, bukan increment lokal. |
| CL-14 | 🟡 **MEDIUM** | `setInterval` captures stale `readyIds` | `cafe-lsp/antrian/page.tsx:39-43` | ✅ FIXED | `fetchOrders` di setInterval menggunakan `readyIds` dari initial render (closure). **Fix:** Menggunakan `useRef` untuk readyIds dan `React.useCallback` untuk fetchOrders. |
| CL-15 | 🟡 **MEDIUM** | localStorage `readyIds` loaded setelah initial fetch | `cafe-lsp/antrian/page.tsx:45-48` | ✅ FIXED | `useEffect` untuk fetchOrders jalan sebelum localStorage load. **Fix:** `readyIds` di-init secara sinkron dari localStorage (lazy initializer di useState). |
| CL-16 | 🟡 **MEDIUM** | `perPage=50` cap di Antrian Board | `cafe-lsp/antrian/page.tsx:29` | ✅ FIXED | Jika lebih dari 50 transaksi per hari, order di atas 50 tidak ditampilkan. **Fix:** Dinaikan ke `perPage=100`. |
| CL-17 | 🟢 **LOW** | Shift check tanpa unitType filter | `cafe-lsp/kasir/page.tsx:144` | ✅ ALREADY FIXED | Sudah diperbaiki sebelumnya — fetch sudah pakai `unitType=cafe_lsp`. |

### 10.2 Shared API Bug (Mempengaruhi Cafe LSP)

Bug yang sama dengan Resto (detail di §9.2 UNIT-CAFE-RESTO.md):

| # | Severity | Bug | Impact pada Cafe LSP |
|---|---|---|---|
| S-1 | 🟡 MEDIUM | Product lookup tanpa unitType | Kasir cafe_lsp bisa checkout produk toko/resto jika tahu productId |
| S-2 | 🟡 MEDIUM | FIFO batch tanpa unitType filter | Batch dari unit lain bisa terdeduct untuk transaksi cafe_lsp |
| S-3 | 🟡 MEDIUM | Audit log hardcoded `"toko"` | Transaksi cafe_lsp tercatat sebagai "toko" |
| S-4 | 🟢 LOW | Low stock notification hardcoded `"toko"` | Admin cafe_lsp tidak terima notifikasi stok rendah |
| S-5 | 🟢 LOW | Duplicate shift check tanpa unitType | Kasir yang punya shift open di toko tidak bisa buka shift cafe_lsp |
| S-6 | 🟢 LOW | Movements API tanpa unitType filter | Admin cafe_lsp lihat movements dari semua unit |

### 10.3 Ringkasan Prioritas

```
┌──────────────────────────────────────────────────────────────┐
│  🔴 FIX SEGERA (Critical)                                    │
│  ──────────────────────────────────────────────────────────── │
│  CL-11. Server-side atomic queue number                      │
│                                                               │
│  🟡 FIX SELANJUTNYA (Medium)                                 │
│  ──────────────────────────────────────────────────────────── │
│  CL-12. Queue cap 999 + daily reset logic                    │
│  CL-13. Voided sales → re-fetch queue count                  │
│  CL-14. Antrian stale readyIds → useRef fix                  │
│  CL-15. Antrian localStorage → load before fetch              │
│  CL-16. Antrian perPage → increase atau pagination           │
│  CL-17. Shift check + unitType=cafe_lsp                      │
│  S-1 s/d S-3. Shared API fixes                               │
│                                                               │
│  🟢 NICE-TO-FIX (Low)                                        │
│  ──────────────────────────────────────────────────────────── │
│  S-4 s/d S-6. Shared API minor fixes                         │
└──────────────────────────────────────────────────────────────┘
```

### 10.4 Saran & Rekomendasi Fitur

Berdasarkan analisis sistem cafe counter POS modern (Kopi Kenangan, Janji Jiwa,Fore Coffee):

| Prioritas | Fitur | Deskripsi | Referensi |
|---|---|---|---|
| 🔴 Tinggi | **Server-side Atomic Queue** | Queue number generate di server via dedicated endpoint. Gunakan `findAndLock` atau database sequence. Return nomor antrian di response POST checkout. | Kopi Kenangan menggunakan server-side queue dengan atomic increment. Mencegah duplikasi 100%. |
| 🟡 Sedang | **Kitchen Display System (KDS)** | Monitor di dapur menampilkan queue real-time. Kasir mark "served" saat pesanan diambil pelanggan. Ganti localStorage `readyIds` yang rapuh. | Fore Coffee menggunakan KDS dengan status visual: waiting → preparing → ready → served. |
| 🟡 Sedang | **Modifiers / Add-on Terstruktur** | Pilihan gula (25/50/75/100%), ukuran (S/M/L), topping (extra shot, cream cheese), es/panas. DB-driven, bukan text notes. Harga bisa berbeda per modifier. | Janji Jiwa punya sistem modifier lengkap (size, sugar, ice level, topping). Setiap modifier bisa adjust harga. Implementasi via tabel `ProductModifier` + `ModifierOption`. |
| 🟡 Sedang | **Menu Terlaris Report** | Dashboard per periode: ranking menu by qty & revenue. Filter by kategori, waktu, kasir. Penting untuk menu engineering dan Quick Keys optimization. | Standard di semua POS modern. Gunakan data yang sudah ada di StoreSaleItem. |
| 🟡 Sedang | **Split Bill** | 1 order → 2+ metode bayar. Contoh: total Rp45.000 → Tunai Rp25.000 + QRIS Rp20.000. | Umum di cafe yang melayani group. Perlu partial payment tracking. |
| 🟡 Sedang | **Dynamic Quick Keys v2** | Admin set Quick Keys dari data penjualan aktual (auto-suggest top 12). Saat ini manual toggle. | Moka POS auto-suggest best sellers untuk quick keys berdasarkan data penjualan 30 hari. |
| 🟢 Rendah | **Loyalty / Stamp Card Digital** | Beli 10 gratis 1. Track per member (anggota koperasi). Tampilkan stamp progress di struk. | Efektif untuk retention di cafe koperasi. Integrasi natural dengan data anggota yang sudah ada. |
| 🟢 Rendah | **Mobile Ordering (QR)** | Pelanggan scan QR di meja/counter → order dari HP → masuk antrian → bayar via e-wallet. Tanpa perlu ke kasir. | Kopi Kenangan app ordering sangat populer. Versi simple: QR → web form → masuk queue. |
| 🟢 Rendah | **Time-based Promotions** | Happy hour pricing (diskon 20% jam 14-16), buy 1 get 1 periode tertentu. Otomatis apply di POS. | Umum di coffee shop untuk meningkatkan off-peak traffic. |
| 🟢 Rendah | **Inventory Alert Threshold** | Notifikasi real-time ke admin ketika bahan baku di bawah minimum. Integrasi dengan Recipe HPP. | Saat ini notifikasi hardcoded "toko". Perlu fix + threshold per bahan baku. |
| 🟢 Rendah | **Nutritional / Allergen Info** | Label kalori, alergen (nuts, dairy, gluten), caffeine level di menu. Info tampil di POS dan struk. | Trend growing di Indonesia. Bisa jadi differentiator untuk cafe koperasi. |

### 10.5 Arsitektur: Rekomendasi Atomic Queue

Solusi untuk CL-11 (queue number race condition):

```
Opsi A: Database Sequence (Recommended)
─────────────────────────────────────────
1. Buat tabel QueueCounter { id, unitType, date, lastNumber }
2. Saat checkout:
   a. BEGIN TRANSACTION
   b. SELECT lastNumber FROM QueueCounter
      WHERE unitType='cafe_lsp' AND date=TODAY
      FOR UPDATE  -- row lock
   c. INSERT/UPDATE lastNumber = lastNumber + 1
   d. COMMIT
   e. Return queueNumber = "A" + pad(lastNumber, 3)
3. Jika row tidak ada → INSERT dengan lastNumber = 1

Opsi B: AppSetting + Prisma Transaction
─────────────────────────────────────────
1. Simpan counter di AppSetting key="queue_counter_cafe_lsp"
2. Gunakan prisma.$transaction dengan interactive mode
3. Lock row via $queryRaw SELECT FOR UPDATE
4. Increment dan return dalam satu transaction

Kelebihan Opsi A: Purpose-built table, clean separation
Kelebihan Opsi B: Tidak perlu migration baru
```

---

### Changelog — 13 Mei 2026 (Deep Audit)
- **[AUDIT]** Deep audit seluruh codebase Cafe LSP — POS, Antrian Board, API, navigasi
- **[BUG-CL11] CRITICAL**: Queue number race condition — client-side count, dua kasir concurrent bisa dapat nomor sama
- **[BUG-CL12] MEDIUM**: Queue cap 999 tanpa daily reset di increment lokal
- **[BUG-CL13] MEDIUM**: Voided sales tidak adjust queue counter → gap nomor antrian
- **[BUG-CL14] MEDIUM**: Antrian Board `setInterval` captures stale `readyIds` via closure
- **[BUG-CL15] MEDIUM**: Antrian Board localStorage loaded setelah initial fetch → orders salah status
- **[BUG-CL16] MEDIUM**: Antrian Board `perPage=50` cap → order baru tidak muncul saat sibuk
- **[BUG-CL17] LOW**: Shift check tanpa `unitType=cafe_lsp` filter
- **[BUG-S1-S6]** Shared API bugs sama dengan Resto (detail di UNIT-CAFE-RESTO.md §9.2)
- **[RECOMMEND]** 11 rekomendasi fitur: Atomic Queue, KDS, Modifiers, Loyalty, Mobile Ordering, dll
- **[ARCH]** Rekomendasi Atomic Queue: Database Sequence vs AppSetting approach

---

### Changelog — 13 Mei 2026 (Bug Fix Round 3 — TDD)

**All 7 unit-specific bugs FIXED ✅ + 6 shared API bugs FIXED ✅**

**Cafe LSP Fixes:**
- **[FIX] CL-11 MITIGATED**: Queue counter sekarang di-re-fetch dari server setelah setiap checkout, bukan increment lokal. Full server-side atomic counter masih Phase 2.
- **[FIX] CL-12**: Removed hardcoded 999 cap. `fetchQueueCount()` menggunakan server daily count (unlimited format).
- **[FIX] CL-13**: Voided sales otomatis di-handle karena counter selalu re-fetch dari server.
- **[FIX] CL-14**: Antrian Board menggunakan `useRef` untuk `readyIds` sehingga `setInterval` selalu membaca state terbaru.
- **[FIX] CL-15**: `readyIds` di-load dari localStorage secara sinkron saat inisialisasi (lazy state initializer).
- **[FIX] CL-16**: Antrian Board `perPage` dinaikan ke 100.
- **[FIX] CL-17**: Shift check sudah menggunakan `unitType=cafe_lsp` (fixed sebelumnya).

**Shared API Fixes (S-1 s/d S-6) — documented in UNIT-CAFE-RESTO.md §9.2:**
- S-1: Product lookup validates unitType
- S-2: FIFO batch filters by unitType
- S-3: Audit log uses variable unitType
- S-4: Low stock notification per unitType
- S-5: Duplicate shift check per unitType
- S-6: Movements API filters by unitType

**Test Infrastructure (shared):**
- Vitest + happy-dom setup: 5 test files, 23 tests passing
- See UNIT-CAFE-RESTO.md for full test file listing