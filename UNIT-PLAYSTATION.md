# UNIT PLAYSTATION — Dokumentasi Operasional

## Informasi Unit
| Parameter | Nilai |
|:--|:--|
| **Nama Unit** | Play Station |
| **Unit Type (DB)** | `playstation` |
| **Unit Slug** | `play-station` |
| **Status** | ✅ Aktif (Dedicated POS — Timer-based) |
| **POS Type** | Dedicated POS (`/play-station/kasir`) |
| **Jumlah Console** | 8 TV (PS5 default) |
| **Tarif** | Rp 15.000/jam |

---

## Arsitektur POS

### Routing
- **Kasir POS**: `/play-station/kasir` (dedicated — timer-based rental dashboard)
- **Manajemen Produk & Jasa**: `/toko/produk` (CRUD produk snack, console config, Admin only)
- **Laporan**: `/unit/playstation/laporan` (Admin only)
- **Dashboard**: `/dashboard` (kasir-dashboard.tsx)

### Database Schema
- Transaksi: `store_sales` + `store_sale_items` (`unitType = "playstation"`)
- Produk (snack/minuman): `store_products` (`unitType = "playstation"`)
- Konfigurasi (tarif per jam): Hardcode `PS_RATE_PER_HOURS = 15000` di POS page

### Metode Pembayaran
1. **Tunai (Cash)** — default
2. **QRIS** — scan kode QR
3. **Potong Gaji** — debit gaji anggota (validasi limit plafon)

---

## Fitur Khusus

### 1. Timer-based Billing
POS PS menggunakan sistem timer untuk menghitung biaya sewa:
- **Start**: Mulai timer saat pelanggan duduk
- **Stop**: Stop timer → kalkulasi durasi → hitung biaya
- **Rumus**: `Math.ceil(durasiMenit / 60) × PS_RATE_PER_HOURS`
- Minimum charge: 1 jam

### 2. TV Dashboard (8 Unit)
Dashboard visual menampilkan 8 TV/console:
- Status: **Kosong** (hijau), **Bermain** (kuning/animasi), **Selesai** (merah)
- Masing-masing TV menampilkan: Timer berjalan, nama pelanggan
- State management: Zustand store (persistent di client)

### 3. Penjualan Snack/Minuman
Selain sewa PS, kasir bisa menjual snack/minuman:
- Produk diambil dari `store_products` (`isService = false`)
- Bisa ditambahkan ke tagihan sewa PS

### 4. Manajemen Produk & Harga (Admin CRUD)
Admin dapat mengelola tarif dan produk via `/toko/produk`:
- **Tambah** snack/minuman baru
- **Edit** harga, nama, status
- **Hapus** produk tidak aktif
- Tarif PS per jam bisa diubah di kode (akan dibuat configurable di masa depan)

---

## Role & Akses

| Role | Akses |
|:--|:--|
| **Kasir** | POS PS (timer dashboard), Riwayat Transaksi |
| **Admin** | POS, Manajemen Produk (CRUD), Laporan, Catat Pengeluaran/Pemasukan, Inbox Approval |
| **Operator** | Full akses semua unit |

---

## Navigation
```
Kasir PS:
├── Dashboard
├── Kasir POS → /play-station/kasir
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=playstation
└── Profil Saya

Admin PS:
├── Dashboard
├── Kasir POS → /play-station/kasir
├── Manajemen Produk & Jasa → /toko/produk
├── Riwayat Transaksi → /transaksi-unit/riwayat?unitType=playstation
├── Laporan Transaksi → /unit/playstation/laporan
├── Inbox Approval → /approval
└── Profil Saya
```

---

## Code Review — 2 Mei 2026

### Temuan Bug

| # | Severity | Issue | Lokasi | Confidence | Detail |
|:--|:---------|:------|:-------|:-----------|:-------|
| 1 | **CRITICAL** | Float quantity di-truncate ke 0 oleh `parseInt()` | `api/toko/sales/route.ts:152` + `schema.prisma:887` | 95% | `hoursRounded` adalah float (0.25, 0.5, 0.75). API lakukan `parseInt(item.quantity, 10)` → truncate 0.25→0 → reject "Jumlah item harus lebih dari 0". Semua rental < 1 jam GAGAL. `StoreSaleItem.quantity` = `Int` di schema. |
| 2 | **CRITICAL** | Tidak ada validasi shift | `play-station/kasir/page.tsx` | 90% | POS tidak cek shift aktif, tidak kirim `shiftId`. Tidak ada halaman `/play-station/shift`. Transaksi dibuat `shiftId: null`. |
| 3 | **CRITICAL** | `updateCart "add"` increment +1 bukan hoursRounded | `kasir/page.tsx:66` | 88% | Line 66: `existing.quantity += 1` mengabaikan `item.quantity` yang dikirim. Saat timer stop mengirim `quantity: 0.25`, cart hanya +1 bukan +0.25. |
| 4 | **IMPORTANT** | Tidak ada deteksi timer stale dari localStorage | `kasir/page.tsx:48-89` | 85% | Zustand persist ke `ps-pos-storage`. Jika browser crash/restart, timer resume dari timestamp lama → bisa menampilkan durasi tidak akurat (misal 48 jam). |
| 5 | **IMPORTANT** | Tidak ada CashierLockScreen | `play-station/` (no layout.tsx) | 82% | Tidak ada `layout.tsx` dengan `CashierLockScreen`. Kasir tidak perlu identitas — transaksi tanpa audit trail kasir. |
| 6 | **IMPORTANT** | Subtotal client-side bisa berbeda dari server-side total | `kasir/page.tsx:220` vs `api/toko/sales` | 80% | Client kalkulasi `price * quantity` (float), server kalkulasi dari `unitPrice * parseInt(quantity)`. Diskrepansi pada rental < 1 jam. |

### Root Cause #1: Float vs Int Mismatch

**Alur yang rusak:**
1. Timer stop → `handleStopTV()` kalkulasi `hoursRounded = 0.25` (15 menit)
2. `updateCart(tvId, { product: rentalProduct, quantity: 0.25 }, "add")`
3. Di store: `existing.quantity += 1` (BUG #3) → quantity jadi 1 (salah)
4. `processPayment()` kirim `quantity: 1` ke API
5. API: `parseInt(1, 10)` = 1 → lolos validasi
6. Tapi harga yang dibayar = 1 jam penuh (Rp15.000), bukan 15 menit (Rp3.750)

**Jika BUG #3 diperbaiki (existing.quantity += hoursRounded):**
1. Timer stop → `hoursRounded = 0.25`
2. `existing.quantity += 0.25` → quantity = 0.25
3. `processPayment()` kirim `quantity: 0.25` ke API
4. API: `parseInt(0.25, 10)` = 0 → REJECT ("Jumlah item harus lebih dari 0")
5. **Transaksi GAGAL TOTAL** — rental tidak bisa dibayar

**Solusi yang dibutuhkan:** Konversi quantity float ke menit (integer) + kalkulasi harga berdasarkan menit, BUKAN jam. Atau ubah schema `quantity` ke `Decimal`.

---

## Saran Fitur

### Prioritas Tinggi (Mendesak untuk Operasional)

1. **Konversi Billing ke Menit (Integer)**
   - Ubah perhitungan: quantity = total menit (integer), bukan jam (float)
   - Contoh: 15 menit → quantity=15, unitPrice=Rp250/menit
   - Atau tetap quantity=1 dengan `subtotal = (menit/60) × tarif`
   - Ini menyelesaikan BUG #1 dan #6 sekaligus

2. **Halaman Shift Management** (`/play-station/shift`)
   - Mirip Toko/Cafe LSP — kasir harus buka shift sebelum transaksi
   - Cashier identity tracking untuk audit trail
   - Close shift dengan rekap transaksi

3. **CashierLockScreen** (`layout.tsx`)
   - Setiap unit store punya lock screen — kecuali PlayStation
   - Kasir harus verifikasi identitas sebelum akses POS

4. **Stale Timer Detection**
   - Saat load Zustand dari localStorage, cek `startTime`
   - Jika timer aktif tapi > 12 jam, flag sebagai stale
   - Opsi: reset otomatis atau tampilkan warning

### Prioritas Menengah (Peningkatan Fungsionalitas)

5. **Configurable Rate per Jam**
   - Saat ini hardcode `PS_RATE_PER_HOURS = 15000`
   - Pindahkan ke `UnitSetting` atau `store_products` (harga produk rental)
   - Admin bisa ubah tarif tanpa redeploy

6. **Console Type Selection (PS5/PS4/PS3)**
   - 8 TV saat ini semua "PS5" hardcode
   - Tambah pilihan tipe console per TV
   - Tarif bisa berbeda per tipe (PS5 Rp15.000, PS4 Rp10.000)

7. **Pre-paid / Session Package**
   - Paket 1 jam, 2 jam, 3 jam, daily pass
   - Timer auto-stop saat paket habis
   - Bonus waktu untuk paket (misal bayar 2 jam dapat 2.5 jam)

8. **Riwayat Rental per Console**
   - Laporan per TV: total jam terpakai, revenue, utilization rate
   - Grafik peak hours (jam sibuk)
   - Export Excel per console

### Prioritas Rendah (Nice-to-have)

9. **Multi-rate (Weekday vs Weekend)**
   - Tarif berbeda weekday/weekend/holiday
   - Konfigurasi di admin settings

10. **Waiting Queue**
    - Antrian saat semua console penuh
    - Notifikasi saat console tersedia
    - Estimasi waktu tunggu

11. **Digital Signage / TV Display**
    - Tampilan untuk monitor di depan toko
    - Menampilkan console status (available/in-use)
    - Auto-refresh, read-only

---

## Changelog
| Tanggal | Perubahan |
|:--|:--|
| 2026-04-25 | ✅ Fix routing: kasir/admin diarahkan ke dedicated POS `/play-station/kasir` |
| 2026-04-25 | ✅ Tambah navigasi dedicated (kasirPSNavigation, adminPSNavigation) |
| 2026-04-25 | ✅ Tambah route guard di layout.tsx (`/play-station`) |
| 2026-04-25 | ✅ Admin dapat CRUD produk/jasa via `/toko/produk` |

### Changelog — 26 April 2026
- **[API] Transaction Safety**: Semua operasi multi-table dibungkus dalam `prisma.$transaction`
- **[API] Validasi Input**: Amount harus > 0, unitType & paymentMethod divalidasi
- **[API] Validasi Plafon Piutang**: Cek limit plafon anggota untuk potong gaji
- **[POS] Billing System**: Pembulatan billing ke 15 menit terdekat, durasi maksimal 12 jam
- **[POS] Bug Fix**: Hapus double declaration `if (!activeTv) return null`
- **[API] RBAC**: Anggota tidak diizinkan membuat transaksi kasir

### Changelog — 2 Mei 2026
- **[REVIEW] Code Review**: 6 bug ditemukan (3 CRITICAL, 3 IMPORTANT)
- **[REVIEW] Saran Fitur**: 11 fitur direkomendasikan (4 prioritas tinggi, 4 menengah, 3 rendah)

### Changelog — 2 Mei 2026 (Implementation)
- **[FIX] BUG #1 CRITICAL**: Billing dikonversi ke sistem blok 15 menit (integer quantity). Rental product sellPrice = tarif per blok, bukan per jam. `parseInt()` di API kini menerima integer blocks tanpa truncation.
- **[FIX] BUG #2 CRITICAL**: Halaman shift dibuat (`/play-station/shift`), POS memvalidasi shift aktif sebelum transaksi, `shiftId` dikirim di body request.
- **[FIX] BUG #3 CRITICAL**: `updateCart "add"` kini menggunakan `item.quantity` bukan hardcoded `+1`.
- **[FIX] BUG #4 IMPORTANT**: Deteksi timer stale (>12 jam) saat load, dialog peringatan dengan tombol reset per TV.
- **[FIX] BUG #5 IMPORTANT**: `layout.tsx` dibuat dengan CashierLockScreen (PIN verification untuk kasir).
- **[FIX] BUG #6 IMPORTANT**: Otomatis terselesaikan oleh fix BUG #1 (block-based integer quantity).
- **[FEAT] Pengaturan Console**: Halaman `/play-station/pengaturan` — admin atur jumlah console, tipe (PS5/PS4/PS3), tarif per jam, durasi blok billing.
- **[FEAT] Config API**: `GET/PUT /api/playstation/config` — simpan ke `AppSetting`, auto-update rental product sellPrice saat tarif berubah.
- **[FEAT] Dynamic Config**: POS memuat konfigurasi console dari API saat init, tidak lagi hardcoded 8 TV.
- **[FEAT] Shift Kasir**: Tautan shift ditambahkan ke navigasi kasir dan admin PS.

### Code Review #2 — 2 Mei 2026

**Verifikasi Bug Sebelumnya:** Semua 6 bug dikonfirmasi ✅ FIXED.

**Bug Baru Ditemukan:**

| # | Severity | Issue | Lokasi | Confidence |
|:--|:---------|:------|:-------|:-----------|
| PS-1 | **CRITICAL** | Stale closure `staleTvs.length` di onClick — dialog tidak tutup saat dismiss TV terakhir karena state belum terupdate | `kasir/page.tsx` onClick dismiss stale | 85% |
| PS-2 | **CRITICAL** | Sale number prefix `TK-` untuk semua unit — PS sales seharusnya `PS-` prefix | `api/toko/sales/route.ts:299,482,503` | 85% |
| PS-3 | **IMPORTANT** | PS kasir tidak kirim `cashierIdentityId` ke sales API — transaksi tanpa audit trail kasir spesifik | `kasir/page.tsx:344-358` | 90% |
| PS-4 | **IMPORTANT** | Shift page backHref ke `/toko/kasir` untuk PS — harusnya `/play-station/kasir` | `toko/shift/page.tsx:394` | 90% |
| PS-5 | **IMPORTANT** | `parseInt()` pada quantity — latent bug sama dengan Bug #1 asli, bisa rekuren untuk unit lain | `api/toko/sales/route.ts:152` | 80% |
| PS-6 | **IMPORTANT** | Sale number `todayCount` tidak filter by `unitType` — nomor saling tumpang tindih antar unit | `api/toko/sales/route.ts:301-303` | 82% |
| PS-7 | **IMPORTANT** | Harga rental basi di cart setelah admin ubah config — client pakai harga lama | `kasir/page.tsx:283,565` | 80% |

**Saran Pengembangan POS PlayStation (Berdasarkan Best Practice):**

| Prioritas | Fitur | Deskripsi |
|:--|:--|:--|
| Tinggi | Unit-specific sale prefix | `PS-DDMMYYYY-SEQ` bukan `TK-DDMMYYYY-SEQ` |
| Tinggi | Cashier identity context | Pass `activeIdentity` dari layout ke kasir via React Context |
| Tinggi | Shift backHref fix | Tambah kondisi `playstation` di ternary chain |
| Menengah | Paket sesi prabayar | Paket 1/2/3 jam, daily pass, bonus waktu |
| Menengah | Riwayat per konsol | Laporan per TV: total jam, pendapatan, tingkat utilisasi |
| Menengah | Konfigurasi tarif multi-tipe | PS5 Rp15.000, PS4 Rp10.000 per tipe konsol |
| Rendah | Antrean digital | Antrian saat semua konsol penuh, notifikasi saat tersedia |
| Rendah | Tarif weekend vs weekday | Harga berbeda hari kerja vs weekend/libur |
| Rendah | TV Display / Signage | Monitor depan toko menampilkan status konsol |

### Changelog — 2 Mei 2026 (Bug Fix Round 2 + Features)

**Bug Fixes (PS-1 to PS-7):**
- **[FIX] PS-1 CRITICAL**: Stale closure `staleTvs.length` diperbaiki — gunakan functional state updater `setStaleTvs(prev => { ... })` agar state selalu terkini saat dismiss stale timer.
- **[FIX] PS-2 CRITICAL**: Sale number prefix kini unit-specific. Mapping: `TK-` (toko), `PS-` (playstation), `CF-` (cafe_lsp), `RC-` (resto_cafe), `CL-` (coffe_latar). Transaksi bank dan piutang juga menggunakan prefix unit.
- **[FIX] PS-3 IMPORTANT**: `cashierIdentityId` kini dikirim ke sales API. Layout menyediakan `PlayStationCashierContext`, kasir mengkonsumsinya via `useContext`.
- **[FIX] PS-4 IMPORTANT**: Shift page backHref kini dinamis berdasarkan unitType — playstation mengarah ke `/play-station/kasir`.
- **[FIX] PS-5 IMPORTANT**: `parseInt(item.quantity, 10)` diganti `Number(item.quantity)` di sales API — mendukung integer blocks tanpa truncation.
- **[FIX] PS-6 IMPORTANT**: `todayCount` kini memfilter by `unitType` — nomor transaksi tidak lagi tumpang tindih antar unit.
- **[FIX] PS-7 IMPORTANT**: `refreshProductPrice` ditambahkan ke Zustand store — harga rental di cart otomatis diperbarui saat `rentalProduct` berubah.

**New Features:**
- **[FEAT] Console Type Rates**: Admin dapat mengatur tarif berbeda per tipe console (PS5/PS4/PS3) di halaman Pengaturan. POS otomatis menggunakan tarif sesuai tipe console saat timer dihentikan. `rateByType` disimpan di config API.
- **[FEAT] Cashier Identity Context**: `PlayStationCashierContext` dibuat di layout.tsx untuk menyediakan `activeIdentity` ke semua child pages. Kasir identity tercatat di setiap transaksi untuk audit trail.

**Files Modified:**
| File | Change |
|:--|:--|
| `src/app/(protected)/play-station/kasir/page.tsx` | PS-1 stale closure fix, PS-3 cashierIdentityId, PS-7 refreshProductPrice, console type rates, psConfig state |
| `src/app/(protected)/play-station/layout.tsx` | PlayStationCashierContext export + Provider |
| `src/app/(protected)/play-station/pengaturan/page.tsx` | Per-type rate configuration UI |
| `src/app/api/playstation/config/route.ts` | rateByType support in PUT handler |
| `src/app/api/toko/sales/route.ts` | PS-2 unit-specific prefix, PS-5 Number() fix, PS-6 unitType filter, date range filter |
| `src/app/(protected)/toko/shift/page.tsx` | PS-4 backHref for playstation |
