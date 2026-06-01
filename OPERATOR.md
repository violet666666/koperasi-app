# Operator Role — Audit & Documentation

> Role: `operator` | Permission: `manage_all` | Deskripsi: Super Admin sistem
> Audit date: 2026-05-18 | Branch: `railway-migration`

---

## 1. Sidebar Navigation (Operator)

Operator memiliki akses **penuh** ke seluruh sidebar. Mekanisme: `manage_all` permission melewati semua filter di `getNavigationForUser()` dan `filterNavigationByUser()` (`src/lib/constants/navigation.ts:1284-1286`).

### OPERASIONAL
| Menu | Route | Anak |
|------|-------|------|
| Dashboard | `/dashboard` | - |
| Anggota | `/anggota` | Daftar Anggota, Kartu Anggota, Buku Anggota |
| Simpanan | `/simpanan` | Rekening Anggota, Transaksi Simpanan, Rekap Simpanan |
| Pinjaman | `/pinjaman` | Pengajuan, Daftar Pinjaman, Angsuran, Jadwal Angsuran, Laporan Jasa |
| Kas & Bank | `/kas-bank` | Buku Kas, Transaksi Kas, Transaksi Bank, Transfer |
| Non Simpan Pinjam | `/non-sp` | Penerimaan, Pengeluaran |
| Transaksi Unit Layanan | `/transaksi-unit` | Kasir POS, Piutang & Riwayat |
| Kwitansi | `/kwitansi` | - |

### TAGIHAN (operator-only)
| Menu | Route | Anak |
|------|-------|------|
| Tagihan Piutang | `/tagihan` | Rekap Piutang, Riwayat Tagihan |

### AKUNTANSI (operator + admin)
| Menu | Route | Anak |
|------|-------|------|
| Aset | `/aset` | Daftar Aset, Penyusutan |
| Jurnal | `/jurnal/umum` | Buku Besar, Jurnal Umum, Jurnal Penyesuaian |
| Laporan | `/laporan` | Neraca, Laba Rugi, Arus Kas, SHU, Rekap Simpanan, Rekap Pinjaman, Faktur Potongan, Piutang Gabungan |
| Gaji & Slip | `/gaji` | (operator-only) |

### PERIODE & SHU (operator-only)
| Menu | Route | Anak |
|------|-------|------|
| Tutup Buku | `/periode/tutup-buku` | - |
| Alokasi SHU | `/periode/shu/perhitungan` | Perhitungan, Distribusi |

### MANAJEMEN UNIT (operator-only)
| Menu | Route | Anak |
|------|-------|------|
| Manajemen Unit | `/manajemen-unit` | Dashboard Unit |

### KOMUNIKASI
| Menu | Route |
|------|-------|
| Pengumuman | `/pengumuman` |

### APPROVAL (operator + admin)
| Menu | Route |
|------|-------|
| Inbox Approval | `/approval` |
| Audit Log | `/audit-log` |

### PENGATURAN
| Menu | Route | Operator-only |
|------|-------|:---:|
| Master Data | `/master` | Ya |
| User Management | `/master/users` | Ya |
| Profil PRIMKOPPOL | `/profil-koperasi` | Ya |
| Pengaturan | `/settings` | Tidak |
| Profil Saya | `/profil` | Tidak |

Master Data sub-items: Produk Simpanan, Produk Pinjaman, Bagan Akun, Mapping Jurnal, Parameter SHU, Saldo Awal, Master Kas & Bank, Import & Export Data.

---

## 2. Route Guard Mechanism

**File:** `src/app/(protected)/layout.tsx:83-84`

```typescript
// Operator (manage_all) -> akses penuh, tidak ada batasan
if (user.permissions.includes("manage_all")) return;
```

Operator melewati seluruh route guard. Tidak ada pembatasan path. Semua route di bawah `/(protected)` dapat diakses.

---

## 3. API Access Matrix

### Endpoints dengan RBAC benar (operator diizinkan)

| Kategori | Endpoints | Role Check |
|----------|-----------|------------|
| Members | GET/POST/PUT/DELETE `/api/members/*` | `["operator", "admin", "admin_sp", "super_admin", "kasir"]` |
| Loans | GET/PUT/POST `/api/loans/*` | `["operator", "admin_sp"]` |
| Savings | `/api/savings/*` | `["operator", "admin", "admin_sp"]` |
| Journals | GET `/api/journals` | `["operator", "admin", "admin_sp", "super_admin"]` |
| Reports | GET `/api/reports/neraca|laba-rugi|arus-kas` | `["operator", "admin", "admin_sp", "super_admin"]` |
| Kas-Bank | GET `/api/cash-bank/*` | `["operator", "admin", "admin_sp", "super_admin"]` |
| Unit Tx | `/api/unit-transactions/*` | `["operator", "admin", ...]` |
| Payroll | `/api/payroll/*` | Operator-only |
| Audit Log | GET `/api/audit-logs` | `["operator", "admin_sp"]` |
| Billing | `/api/billing/*` | `permissions.includes("manage_all")` |
| Toko | `/api/toko/sales|split-bill|queue|shifts` | `["operator", "admin", ...]` |

### Operator-only endpoints (admin/super_admin DIBLOKIR)

| Endpoint | Catatan |
|----------|---------|
| `/api/loans/sync-installment` | Sync angsuran |
| `/api/loans/purge` | Hapus data pinjaman |
| `/api/loans/import-update` | Import update pinjaman |
| `/api/loans/import-migrasi` | Import migrasi pinjaman |
| `/api/loans/generate-schedules` | Generate jadwal angsuran |
| `/api/toko/products/sync-stock` | Sync stok produk |
| `/api/payroll/*` | Semua payroll |
| `/api/audit-logs` | Hanya operator + admin_sp |

---

## 4. Security Issues (Ditemukan saat audit)

### CRITICAL — Tidak ada auth sama sekali

| # | Endpoint | Method | Risiko |
|---|----------|--------|--------|
| 1 | `/api/journals` | POST | Siapapun bisa buat jurnal (hanya 400 karena body kosong, bukan 401) |
| 2 | `/api/cash-bank/transfers` | POST | Siapapun bisa buat transfer kas-bank |
| 3 | `/api/cash-bank/import` | POST | Hanya cek `session?.user?.id`, tidak cek role |
| 4 | `/api/reports/shu` | GET | **Public** — data keuangan SHU tanpa auth |
| 5 | `/api/reports/members-recap` | GET | **Public** — data keuangan anggota |
| 6 | `/api/reports/savings-recap` | GET | **Public** — data simpanan |
| 7 | `/api/dashboard-charts` | GET | **Public** — data grafik keuangan |
| 8 | `/api/users` | GET | **Public** — daftar semua user |
| 9 | `/api/master/cash-bank` | POST | Siapapun bisa buat akun kas-bank |
| 10 | `/api/settings/cooperative` | GET | **Public** — profil koperasi |
| 11 | `/api/pengumuman/[id]` | PUT/DELETE | **Tanpa auth** — edit/hapus pengumuman |

### HIGH — Auth lemah

| # | Endpoint | Method | Masalah |
|---|----------|--------|---------|
| 12 | `/api/settings` | PUT | Hanya blokir `kasir`, `anggota` bisa ubah settings |
| 13 | `/api/settings/shu` | POST | Tidak ada role check |
| 14 | `/api/pengumuman` | POST | Tidak ada role check |
| 15 | `/api/reports/shu/calculate` | GET | Hanya cek session, tidak cek role |
| 16 | `/api/reports/shu/distribute` | POST | Lock SHU tanpa role check |
| 17 | `/api/billing/[periodId]` | GET/DELETE | Tidak ada role check |
| 18 | `/api/non-sp/penerimaan|pengeluaran` | GET | Tidak ada auth |
| 19 | `/api/non-sp/penerimaan|pengeluaran/[id]` | DELETE | Hanya cek session |

### MEDIUM — Over-restrictive / Inconsistent

| # | Issue | Detail |
|---|-------|--------|
| 20 | Audit Log terlalu restrictive | Hanya `operator` + `admin_sp`, `admin` dan `super_admin` diblokir |
| 21 | Loan APIs operator-only | `sync-installment`, `purge`, `import-*`, `generate-schedules` mengecualikan `admin_sp`/`super_admin` |
| 22 | Inconsistent role naming | `superadmin` (tanpa underscore) di beberapa route unit packages dan mobile API, padahal seharusnya `super_admin` |

---

## 5. Browser Test Results (2026-05-18)

| Halaman | Status | Catatan |
|---------|--------|---------|
| `/audit-log` | WORKING | 3,740 records, filter, pagination OK |
| `/periode/tutup-buku` | WORKING | Periode Mei 2026, 200 jurnal, balance |
| `/pengumuman` | WORKING | 200 OK |
| `/approval` | WORKING | 200 OK |
| `/settings` | WORKING | 200 OK, operator-specific tabs rendered |
| `/master` | WORKING | 200 OK |
| `/master/users` | WORKING | 200 OK |
| `/profil-koperasi` | WORKING | 200 OK |
| `/periode/shu/perhitungan` | WORKING | 200 OK |
| `/manajemen-unit` | WORKING | 200 OK |
| `/gaji` | WORKING | 200 OK |
| `/jurnal/umum` | WORKING | 200 OK |
| `/laporan/neraca` | WORKING | 200 OK |
| `/aset` | WORKING | 200 OK |
| `/kwitansi` | WORKING | 200 OK |

### API Auth Test Results

| Endpoint | Expected | Actual | Bug? |
|----------|----------|--------|------|
| `POST /api/journals` | 401/403 | 400 (bad body) | YA — no auth gate |
| `POST /api/cash-bank/transfers` | 401/403 | 400 (bad body) | YA — no auth gate |
| `GET /api/reports/shu` | 401 | 200 | YA — public |
| `GET /api/reports/members-recap` | 401 | 200 | YA — public |
| `GET /api/users` | 401 | 200 | YA — public |
| `GET /api/dashboard-charts` | 401 | 200 | YA — public |
| `DELETE /api/pengumuman/999` | 401/403 | 500 (not found) | YA — no auth gate |
| `PUT /api/settings` | 403 (role check) | 400 (bad body) | YA — weak auth |

---

## 6. Rekomendasi Perbaikan

### Priority 1 — Critical (harus segera diperbaiki)

1. **Tambah auth ke POST `/api/journals`** — Copy pattern dari GET handler (`ALLOWED_ROLES`)
2. **Tambah auth ke POST `/api/cash-bank/transfers`** — Tambah session + role check
3. **Tambah auth ke `/api/reports/shu|members-recap|savings-recap|dashboard-charts`** — Minimum session check
4. **Tambah auth ke GET `/api/users`** — Minimum `["operator", "admin", "admin_sp"]`
5. **Tambah auth ke PUT/DELETE `/api/pengumuman/[id]`** — Role check untuk write operations
6. **Tambah auth ke POST `/api/master/cash-bank`** — Role check
7. **Tambah auth ke GET `/api/non-sp/*`** — Minimum session check

### Priority 2 — High

8. **Fix `/api/settings` PUT** — Ganti `if (role === "kasir") block` dengan `ALLOWED_ROLES` whitelist
9. **Fix `/api/settings/shu` POST** — Tambah role check operator-only
10. **Fix `/api/pengumuman` POST** — Tambah role check
11. **Fix `/api/reports/shu/distribute` POST** — Operator-only (ini lock SHU)
12. **Fix `/api/billing/[periodId]` GET/DELETE** — Tambah role check
13. **Fix `/api/cash-bank/import` POST** — Tambah role check

### Priority 3 — Medium

14. **Perluas `/api/audit-logs`** — Tambahkan `admin` dan `super_admin` ke allowed roles
15. **Review loan operator-only endpoints** — Pertimbangkan menambah `admin_sp` ke `sync-installment`, `generate-schedules`
16. **Standardize `superadmin` → `super_admin`** — Di unit packages dan mobile API routes

---

## 7. Update 18 Mei 2026 — Role Cleanup, Tagihan, Edit NRP

### 7.1 Role Hierarchy Final
- **Operator** (`manage_all`) = satu-satunya super admin
- Dihapus: `superadmin`, `super_admin` dari 59 file (role tidak ada di DB)
- Admin unit = akses terbatas ke unit sendiri saja

### 7.2 Fitur Terbaru

| Fitur | Route | Deskripsi |
|-------|-------|-----------|
| Tagihan Piutang | `/tagihan` | Generate draft, custom date range, toggle items, process/settle, delete draft |
| Riwayat Tagihan | `/tagihan/riwayat` | List semua billing period, link ke detail |
| Edit NRP Riwayat | `/transaksi-unit/riwayat` | Edit NRP pada transaksi non-voided (termasuk yang sudah punya member) |
| Custom Date Range | `/tagihan` | Operator pilih tanggal sendiri saat generate tagihan |
| Edit Detail Anggota | `/anggota/[id]/edit` | Gaji bersih, tunles, sisa gaji, plafon piutang, pangkat, golongan, kesatuan, employeeType, noRekening + NRP sync |
| Kelola Duplikasi | `/anggota/kelola` | Deteksi duplikat, merge anggota, enhanced delete |
| Edit Tenor Pinjaman | `/pinjaman/[id]` | 7 bug fix: rounding, date helper, audit trail, role fix, copy, notes, import guard |

### 7.2.1 Member Edit — Field Lengkap

| Field | Kategori | Keterangan |
|-------|----------|------------|
| `salary` | Keuangan | Gaji Bersih |
| `tunlesKinerja` | Keuangan | Tunjangan Kinerja / Tunkin |
| `sisaGaji` | Keuangan | Sisa Gaji (digunakan untuk plafon piutang: 50% × sisaBersih) |
| `plafonPiutang` | Keuangan | Limit piutang potong gaji |
| `pangkat` | Klasifikasi | Pangkat anggota |
| `golongan` | Klasifikasi | Golongan anggota |
| `kesatuan` | Klasifikasi | Kesatuan/Unit kerja |
| `employeeType` | Klasifikasi | Jenis pegawai |
| `noRekening` | Klasifikasi | Nomor rekening bank |
| `nrp` | Identitas | NRP (perubahan trigger credential sync + password reset) |
| `phone`, `email`, `address` | Kontak | Info kontak |

### 7.2.2 Member Merge/Delete

| Operasi | API | Deskripsi |
|---------|-----|-----------|
| Deteksi Duplikat | `GET /api/members/duplicates` | Group by normalized name + NRP |
| Merge Anggota | `POST /api/members/merge` | Reassign 13 jenis child records, soft-delete source |
| Enhanced Delete | `DELETE /api/members/[id]` | 4 validasi: loans, savings, billing, unit tx |

### 7.2.3 Loan Edit (7 Bug Fix)

| Bug | Fix |
|-----|-----|
| Rounding error pada paidInstallmentCount | `Math.floor(newPrincipalPaid / monthlyPrincipal)` + remainder |
| JS Date setMonth() overflow | Helper `addMonths()` di `src/lib/date-helpers.ts` |
| Role inconsistency (admin_sp) | Permission-based gate (`manage_all`) |
| Misleading "Riwayat Pembayaran" message | Updated copy |
| Field `notes` silently discarded | Removed from accepted body |
| Missing audit trail | `logAuditFromRequest()` added |
| Import bypass payment guard | Inline comment (by design) |

### 7.3 Production API Test Results (18 Mei 2026)

| API | Method | Status | Catatan |
|-----|--------|--------|---------|
| `/api/billing/generate` | POST | 200 OK | Custom date range works |
| `/api/billing/current` | GET | 200 OK | Returns active period |
| `/api/billing/[id]` | DELETE | 200 OK | Delete draft works |
| `/api/billing/[id]/process` | POST | 200 OK | Process & settle works |
| `/api/unit-transactions/[id]/member` | PATCH | 200 OK | Edit NRP verified end-to-end |
| `/api/members/lookup` | GET | 200 OK | NRP search works |
| `/api/admin/migrate` | POST | 200 OK | Creates billing tables + member columns |

### 7.4 Akun Testing Production

| Email | Password | Role | Keterangan |
|-------|----------|------|------------|
| `operator@koperasi.com` | `password123` | operator | Akses penuh (manage_all) |
| `admintoko@koperasi.com` | `password123` | admin (toko) | Admin unit toko |

### 7.5 Member Columns Migration

Kolom baru ditambahkan via migration endpoint ke NeonDB:
- `sisa_gaji` (DECIMAL) — sisa gaji untuk kalkulasi plafon piutang
- `employee_type`, `pangkat`, `golongan`, `kesatuan`, `no_rekening` — klasifikasi anggota

---

## 8. Update 18 Mei 2026 — Billing Code Review, Portal Faktur, Export

### 8.1 Code Review Bug Fixes (Billing API)

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | DELETE tidak reverse `isPaid` untuk draft yang sudah partial-settle | HIGH | Cek `period.billingItems.some((i) => i.isMarkedPaid)` selain `period.status === "processed"` |
| 2 | `totalMembers` = jumlah item, bukan unique member | MEDIUM | `new Set(period.billingItems.map((i) => i.memberId)).size` |
| 3 | Partial settle `totalAmount` overwrite (bukan kumulatif) | HIGH | Re-query semua paid items: `tx.billingItem.findMany({ where: { isMarkedPaid: true } })` |
| 4 | GET endpoint tidak ada permission check | CRITICAL | Tambah `permissions.includes("manage_all")` |
| 5 | Tidak ada indikator visual untuk member yang sudah settle | MEDIUM | Tambah `isPaid` field, sorting unpaid-first, "Lunas" badge, opacity |

**File yang diperbaiki:**
- `src/app/api/billing/[periodId]/route.ts` — Fix #1, #4
- `src/app/api/billing/[periodId]/process/route.ts` — Fix #2, #3
- `src/app/(protected)/tagihan/page.tsx` — Fix #5

### 8.2 Faktur Page — Portal Anggota (NEW)

| Komponen | File | Deskripsi |
|----------|------|-----------|
| API | `src/app/api/member-portal/faktur/route.ts` | GET billing periods + items untuk member login |
| Page | `src/app/portal/faktur/page.tsx` | Expandable cards, Lunas/Menunggu badge, detail table |
| Nav | `src/app/portal/layout.tsx` | Menu "Faktur" (icon: FileText) |

**Fitur:**
- Member melihat riwayat tagihan piutang yang digenerate operator
- Expandable card per periode dengan status Lunas/Menunggu
- Unit summary pills per periode (breakdown per unit)
- Detail table: Unit, Keterangan, Status per item, Jumlah
- "Cetak Faktur" button → professional A4 document print
- Auto-sync: saat operator delete billing period, faktur hilang dari portal (Cascade)

### 8.3 Export Piutang — PDF & Excel

| Export | Function | File |
|--------|----------|------|
| PDF (A4) | `generateFakturPiutangPDF()` | `src/lib/export-utils.ts` |
| Excel (3 sheets) | `exportFakturPiutangExcel()` | `src/lib/export-utils.ts` |

**PDF — Faktur Piutang A4:**
- Kop surat: Logo PRIMKOPPOL, nama, alamat, telepon
- Double-line divider
- Info grid: Nama, NRP, Periode, Rentang, Status, Dikonfirmasi oleh, Dicetak
- Unit summary pills
- Detail table per item (Unit, Keterangan, Jumlah)
- Total row
- Footer: dokumen saham bukti resmi

**Excel — 3 Sheets:**
1. "Detail Anggota" — satu row per unit per member (NRP, Nama, Unit, Jumlah)
2. "Ringkasan Unit" — total per unit
3. "Rekap Anggota" — satu row per member dengan string detail per unit

**Alamat & Telepon (diperbaiki):**
- `Jl. Alun-Alun Utara No. 11, Rogotrunan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67316`
- `Telp. (0334) 881110`

### 8.4 Mobile Responsive — Tagihan

| Page | Fix |
|------|-----|
| `/tagihan` | NRP hidden on `sm:`, Unit hidden on `md:`, inline info below name on mobile |
| `/tagihan/riwayat` | Status/Anggota/Dibuat columns progressively hidden on mobile |
| Header buttons | Icon-only on mobile, text on `sm:+` |

### 8.5 API Reference — Portal Faktur

```
GET /api/member-portal/faktur
Auth: session.user.memberId (NextAuth JWT)
Response: { data: BillingPeriod[] } filtered by memberId
```

### 8.6 Key Source Files (Update)

| File | Fungsi |
|------|--------|
| `src/lib/export-utils.ts` | PDF generator + Excel export for piutang |
| `src/app/portal/faktur/page.tsx` | Member portal faktur page |
| `src/app/api/member-portal/faktur/route.ts` | Portal faktur API |

---

## 9. Update 30 Mei 2026 — Manajemen Unit Insights

### 9.1 Fitur Insight (Phase 1 + Phase 2)

Route `/manajemen-unit` sekarang memiliki dashboard insight lengkap untuk monitoring real-time performa unit usaha.

**Dashboard Utama** (`/manajemen-unit`):

| Insight | Deskripsi |
|---------|-----------|
| Tren Pendapatan | Badge ↑/↓% per unit (vs kemarin) |
| Summary Cards | Total unit, produk, transaksi, pendapatan hari ini |

**Detail Unit** (`/manajemen-unit/[slug]`):

| ID | Insight | Deskripsi | Ketersediaan |
|----|---------|-----------|-------------|
| I-01 | Tren Pendapatan | Pendapatan hari ini + dynamic trend icon vs rata-rata mingguan | Semua unit |
| I-02 | Jam Ramai | Bar chart distribusi transaksi per jam (06:00–22:00 WIB), highlight jam puncak | Semua unit |
| I-03 | Metode Pembayaran | Progress bar breakdown: Tunai vs QRIS vs Potong Gaji | Semua unit |
| I-04 | Keuntungan | Total profit, margin %, top 3 produk paling menguntungkan | Store units only |
| I-05 | Top 5 Produk | Produk terlaris hari ini berdasarkan quantity | Store units only |
| I-06 | Perbandingan Mingguan | Dual-bar chart: minggu ini vs minggu lalu per hari | Semua unit |

### 9.2 Bug Fixes (Phase 1+2 Side Effects)

| Issue | Severity | Fix |
|-------|----------|-----|
| #5 Double Revenue Counting | HIGH | `isStoreUnit` guard — store units hanya query StoreSale, service hanya UnitTransaction |
| #6 Store Tx Count Inflation | MEDIUM | Same fix as #5 |
| #7 Placeholder Payment Card | LOW | Diganti dengan data real (progress bar breakdown) |

### 9.3 Spec Bugs Found During Implementation

| Bug | Impact | Fix |
|-----|--------|-----|
| Profit math error | Test expectation `29000` seharusnya `36000` | Corrected in test |
| `getHours()` timezone | Double WIB offset pada mesin UTC+7 | Changed to `getUTCHours()` |

### 9.4 Key Source Files — Manajemen Unit

| File | Fungsi |
|------|--------|
| `src/app/(protected)/manajemen-unit/page.tsx` | Dashboard — unit card grid + trend badges |
| `src/app/(protected)/manajemen-unit/[unitSlug]/page.tsx` | Detail — stats + products + transactions + insights |
| `src/app/api/manajemen-unit/stats/route.ts` | Aggregated stats API (9 units, trend data) |
| `src/app/api/manajemen-unit/[unitSlug]/stats/route.ts` | Per-unit stats API (11 parallel queries, 14-day chart, profit, peak hours) |
| `src/lib/services/manajemen-unit.ts` | Pure helpers: aggregateUnitStats, computeUnitDetail, computePeakHours, computeProfitFromItems |
| `src/lib/constants/units.ts` | UNIT_TYPES registry (9 units) + slug/name helpers |
| `manajemen-unit.md` | Full audit & documentation |

### 9.5 UX Polish (30 Mei 2026)

| Fix | Deskripsi |
|-----|-----------|
| Pagination UI | Products (50/page) dan Transactions (25/page) sekarang memiliki navigasi halaman |
| Transaction Detail | Baris expandable: POS menampilkan item breakdown, service menampilkan member + keterangan |
| Configurable Stock | API menggunakan `min_stock` per produk. UI highlight merah menggunakan `p.stock <= p.minStock`. |
| Export CSV | Tombol "Export CSV" di header detail — download CSV dengan semua insight data |

### 9.6 Re-Audit Fixes (30 Mei 2026)

| Fix | Severity | Deskripsi |
|-----|----------|-----------|
| #11 Sales Range Refetch | MEDIUM | Toggle "Hari Ini" sekarang refetch data setelah pindah dari 7d/30d |
| #12 Dashboard res.ok | LOW | Dashboard page sekarang cek `res.ok` sebelum `.json()` |
| #13 Stock Threshold UI | LOW | Teks dan highlight stok menipis sekarang dinamis per produk (bukan hardcode ≤5) |
| revenueTrend tests | LOW | 3 test baru: positive trend, negative trend, null when zero |

Total tests: 34 (sebelumnya 31).

### 9.7 Deep Audit — SHU & Manajemen Unit (30 Mei 2026 — Malam)

| Fix | Severity | Fitur | Deskripsi |
|-----|----------|-------|-----------|
| #17 Unit Breakdown Expense | 🔴 CRITICAL | SHU | Interface `UnitBreakdown` di halaman SHU tidak punya field `expense` — data pengeluaran per unit dari backend tidak pernah tampil. Diganti visualisasi progress bar menjadi tabel 5 kolom (Pendapatan, Pengeluaran, Laba/Rugi) |
| #18 Allocation Labels | 🟠 HIGH | SHU | Tabel alokasi SHU menampilkan key teknis (`jasa_usaha`) bukan label readable (`Jasa Anggota`). Diganti `alloc.category` → `alloc.label` |
| #19 Interface Alignment | 🟡 MEDIUM | SHU | Interface `SHUAllocation` punya `category` tapi calculator kirim `key` + `label`. Diselaraskan |
| #14 Dashboard Invalid Data | 🟡 MEDIUM | Unit | Dashboard silently shows 0 saat `json.data` undefined. Ditambahkan error state |
| #15 Pagination res.ok | 🟢 LOW | Unit | Refetch pagination produk/transaksi belum cek `res.ok` (inkonsisten dengan fix #12) |

All known issues resolved.

## 10. Update 31 Mei 2026 — Sinkronisasi Beban SHU & UI/UX Manajemen Unit

### 10.1 Sinkronisasi Database-Level Beban Biaya SHU

Telah dilakukan investigasi dan perbaikan mendalam terhadap masalah ketidaksinkronan data total beban biaya SHU dengan pengeluaran operasional riil unit usaha koperasi pada basis data.

**Temuan Akar Masalah (Database-Level Root Causes):**
- **RC-1 (Journal Path Ignored Expenses):** Jalur kalkulasi berbasis Jurnal (3.984 baris di database) sama sekali tidak mengikutsertakan transaksi pengeluaran dari `CashBankTransaction` (transaksi kas/bank keluar yang diinput manual oleh operator namun belum dibuatkan jurnal otomatisnya). Dampaknya, **Rp 2.578.988.041** beban operasional terlewatkan dari perhitungan SHU.
- **RC-2 (NULL Unit Type):** Sebanyak 99% transaksi pengeluaran bermerek `biaya_operasional` tercatat dengan `unitType = NULL`. Ini menyebabkan pemecahan beban per unit usaha selalu menghasilkan angka Rp 0.
- **RC-3 (Whitelist Terlalu Sempit):** Kategori pengeluaran operasional bernilai besar seperti `operational` (164 transaksi) dan `lainnya` (86 transaksi) tidak masuk dalam whitelist `EXPENSE_CATEGORIES` yang lama. Hal ini menyembunyikan pengeluaran sebesar **Rp 1.620.055.001**.
- **RC-4 (StoreSale Revenue 0):** Seluruh pendapatan toko dicatat langsung via transaksi kas/bank atau unit transaction, sehingga StoreSale bernilai kosong.

**Penyelesaian Teknis (100% CLOSED):**
1. **Merge Journal & CashBankTransaction:** Logika kalkulator di `shu-calculator.ts` dirombak. Ketika sistem masuk ke jalur jurnal (`journalLines.length > 0`), kalkulator sekarang mengambil pengeluaran dari `CashBankTransaction` yang belum dijurnal (`journalId = null`).
2. **Penerapan Metode Blacklist:** Whitelist kategori pengeluaran dihapus. Sistem kini mendeteksi pengeluaran dengan metode blacklist (`NON_EXPENSE_CATEGORIES`), menyaring keluar transaksi non-biaya seperti `pencairan_pinjaman`, `transfer`, dan `savings`. Ini menjamin seluruh pengeluaran riil (`biaya_operasional`, `beban_unit`, `operational`, `lainnya`) terhitung secara aman dan otomatis.
3. **Deduplikasi Aman:** Untuk menghindari risiko perhitungan ganda (*double-counting*), transaksi kas/bank yang sudah memiliki `journalId` dilewatkan (karena nilainya sudah terwakili di baris jurnal).
4. **Beban Umum (Belum Dialokasi):** Transaksi pengeluaran yang tidak memiliki label unit (`unitType = null/none`) sekarang otomatis dikelompokkan ke dalam kategori **"Beban Umum (Belum Dialokasi)"** sehingga visualisasi laporan SHU tetap seimbang dan akurat.

**Dampak Angka Hasil Perbaikan:**
- Total beban biaya SHU bertambah presisi sebesar **+Rp 2.578.988.041** (mengoreksi laba bersih fiktif sebelumnya).
- Distribusi pengeluaran per unit tampil secara real-time di UI:
  - Unit Toko: Rp 118.641.401
  - Unit Cuci Mobil: Rp 14.814.700
  - Unit Cafe LSP: Rp 2.292.500
  - Beban Umum: Rp 2.367.366.565

---

### 10.2 Penyempurnaan 8 Poin UI/UX Manajemen Unit

Untuk meningkatkan kenyamanan operator saat memantau data unit usaha, dilakukan penyempurnaan menyeluruh pada antarmuka *Manajemen Unit* agar lebih premium dan responsif:

| ID | Perbaikan / Fitur | Tingkat Kepentingan | Lokasi File | Deskripsi |
|---|---|---|---|---|
| **U1** | Dashboard Category Filter | MEDIUM | `manajemen-unit/page.tsx` | Menyediakan filter kategori di atas grid dashboard ("Semua", "Toko/POS", "Layanan") agar operator dapat mengelompokkan 9 unit usaha dengan cepat tanpa scroll berlebih. |
| **U2** | Label "Layanan" Dinamis | LOW | `[unitSlug]/page.tsx` | Mengubah label kartu statistik "Produk" menjadi "Layanan" secara dinamis khusus untuk unit berbentuk jasa/layanan (seperti cuci mobil, barbershop, dll.). |
| **U3** | Penggabungan Grafik Mingguan | HIGH | `api/[unitSlug]/stats/route.ts` | Menggabungkan data mingguan dari `StoreSale` dan `UnitTransaction` secara simultan untuk semua unit. Menjamin visualisasi grafik tren mingguan pada unit campuran seperti Toko tampil utuh. |
| **U4** | Search Filter Produk | MEDIUM | `[unitSlug]/page.tsx` | Menambahkan kolom pencarian produk dengan ikon search dan debounce 300ms untuk menangani pencarian responsif pada ribuan item di unit retail. |
| **U5** | Date Filter & API Transaksi | MEDIUM | `[unitSlug]/page.tsx`, `api/[unitSlug]/transactions/route.ts` | Menambahkan opsi filter rentang waktu ("Hari Ini", "7 Hari", "30 Hari") pada tabel transaksi unit detail, didukung parameter `range` di backend API. |
| **U6** | Custom Empty State Jam Ramai | LOW | `[unitSlug]/page.tsx` | Mengganti tampilan kosong yang kaku jika transaksi hari ini belum ada dengan petunjuk edukatif agar operator memeriksa grafik mingguan. |
| **U7** | Clean Trend Icon (Revenue=0) | LOW | `[unitSlug]/page.tsx` | Menghilangkan ikon `TrendingDown` (merah) yang bias negatif saat pendapatan unit hari ini Rp 0, digantikan dengan ikon `Minus` (netral) yang bersih. |
| **U8** | Laba/Rugi Unit Minus Terlacak | LOW | `[unitSlug]/page.tsx` | Memastikan unit usaha yang hanya mencatatkan biaya pengeluaran (tanpa pendapatan) tetap muncul dengan laba bersih bernilai minus di visualisasi laporan. |

---

### 10.3 ✅ Bug CLOSED: SHU Bersih = Rp 0 (Diperbaiki: 1 Juni 2026)

**Status:** CLOSED — Diperbaiki 1 Juni 2026.

Setelah fix Section 10.1 (penambahan pengeluaran CB non-journaled ke journal path), SHU Bersih turun menjadi **Rp 0** karena asimetri income/expense. Sekarang telah diperbaiki dengan menambahkan CB income merge yang simetris.

**Perbaikan yang dilakukan:**
- **CB Income Merge:** Query `CashBankTransaction type=in, journalId=NULL` ditambahkan ke journal path — menangkap jasa_pinjaman, pendapatan_unit, pendapatan_toko, operational, lainnya
- **Dana Resiko:** Query langsung `Loan.adminFee` dari tabel Loan — mencatat pendapatan admin fee sebagai income SP
- **3-Group Categorization:** Income dikelompokkan menjadi Pendapatan Unit Usaha, Pendapatan SimpanPinjam (SP), Pendapatan Lainnya
- **Per-Unit Income:** CB income per unitType di-merge ke unitBreakdown yang sudah ada
- **UI Income Cards:** 3 card berwarna (hijau/biru/kuning) ditambahkan di Laporan SHU

> Dokumentasi lengkap: **SHU-BUG-AND-UPDATE.md Section 11 & 12**

*Ditemukan: 1 Juni 2026, 01:16 WIB*
*Ditutup: 1 Juni 2026*

---

## 11. Update 1 Juni 2026 — SHU Income Fix & Categorization

### 11.1 Fitur Baru

| Fitur | Deskripsi |
|-------|-----------|
| Income 3-Group Cards | 3 card berwarna di Laporan SHU: Unit Usaha (hijau), SimpanPinjam (biru), Lainnya (kuning) |
| Dana Resiko Income | `Loan.adminFee` otomatis masuk sebagai Pendapatan SimpanPinjam |
| Per-Unit Revenue Akurat | Revenue per unit sekarang mencakup StoreSale + UnitTransaction + CB income |
| Payment Method Breakdown | Expandable rows per unit menunjukkan rincian Tunai/QRIS/Potong Gaji dengan persentase dan jumlah transaksi |
| Audit Detail per Unit | Section baru "Audit Transaksi per Unit" dengan filter: pilih unit, jenis (pemasukan/pengeluaran), metode pembayaran (Tunai/QRIS/Potong Gaji). Tabel detail dengan paginasi dan ringkasan. |
| Monthly Filter | Sudah ada sebelumnya, berfungsi baik |

### 11.2 Bug Fixes

| Bug | Severity | Status | Deskripsi |
|-----|----------|--------|-----------|
| SHU Bersih = Rp 0 | 🔴 CRITICAL | ✅ CLOSED | Asimetri income/expense di journal path — income hanya dari JournalLine (~Rp 95jt) sementara expense dari CB non-journaled (~Rp 2,58M) |
| Dana Resiko tidak masuk SHU | 🟠 HIGH | ✅ CLOSED | `Loan.adminFee` tidak pernah tercatat sebagai income — sekarang diquery langsung dari tabel Loan |
| Income tidak terkategorisasi | 🟡 MEDIUM | ✅ CLOSED | Pendapatan bercampur tanpa pengelompokan — sekarang 3 grup: Unit, SP, Lainnya |
| Unit revenue tidak akurat | 🟡 MEDIUM | ✅ CLOSED | Revenue per unit hanya dari StoreSale/UnitTransaction — sekarang ditambah CB income |

---

## 12. Update 1 Juni 2026 (Siang) — SHU Detail Dialog Breakdown

### 12.1 Fitur Baru: Detail Dialog

| Fitur | Deskripsi |
|-------|-----------|
| Klik Detail pada Card SHU | Klik Total Pendapatan/Total Beban/SHU Anggota/SHU Non-Anggota → buka dialog detail |
| Income Group Card Click | Klik 3 card (Unit Usaha, SimpanPinjam, Lainnya) → buka dialog filtered per grup |
| Tab Ringkasan | Tabel breakdown per kategori dengan kode, nama, jumlah, dan persentase |
| Tab Transaksi | Daftar transaksi individual (lazy-loaded, paginated, filterable) dari 5 sumber data |
| Tab Kalkulasi | Step-by-step calculation flow untuk SHU Anggota/Non-Anggota (7 langkah visual) |
| Nested Drill-down | Dari kalkulasi tab bisa buka dialog income/expense untuk verifikasi |
| Visual Cues | Hover highlight + eye icon + dashed underline pada semua clickable metric |
| API detail-transactions | `GET /api/reports/shu/detail-transactions` — flat transaction list dengan filter + pagination (auth required) |

### 12.2 File yang Dibuat

| File | Fungsi |
|------|--------|
| `src/app/(protected)/laporan/shu/_types.ts` | Shared TypeScript interfaces |
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | Dialog utama dengan tab switching |
| `src/app/(protected)/laporan/shu/_components/shu-summary-tab.tsx` | Tab ringkasan per kategori |
| `src/app/(protected)/laporan/shu/_components/shu-transactions-tab.tsx` | Tab daftar transaksi (lazy fetch) |
| `src/app/(protected)/laporan/shu/_components/shu-calculation-tab.tsx` | Tab langkah kalkulasi |
| `src/app/api/reports/shu/detail-transactions/route.ts` | API: flat paginated transaction list (auth guarded) |

### 12.3 Code Review Fixes (Post-Implementation)

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 35 | 🔴 CRITICAL | API endpoint tanpa auth — data keuangan bisa diakses publik | Ditambahkan `auth()` + 401 check |
| 36 | 🔴 CRITICAL | Double counting income — CB `jasa_pinjaman`/`dana_resiko`/`pendapatan_unit`/`pendapatan_toko` terhitung 2x (CB + direct query) | 4 kategori ditambahkan ke `NON_INCOME_CATEGORIES` blacklist |
| 37 | 🔴 CRITICAL | `adjustedNetSurplus` = `netSurplus` — deduksi Cuci Mobil tidak berpengaruh di calculation tab | Kalkulasi dirombak: `adjustedNetSurplus = max(0, netSurplus - carwashBonus)` |
| 38 | 🔴 CRITICAL | `memberGrossIncome` = 0 — rasio bar menunjukkan "Rp 0" padahal persentase benar | `memberGrossIncome = totalIncome * memberRatio` |
| 39 | 🟠 HIGH | API tanpa error handling — Prisma error → unhandled exception | Ditambahkan try-catch + console.error logging |
| 40 | 🟠 HIGH | Stale category filter — dropdown terkunci setelah dialog buka ulang | Guard dihapus: null/undefined sekarang reset ke "all" |
| 41 | 🟠 HIGH | Nested dialog state leak — `nestedSource` tidak reset | Ditambahkan ke reset effect |
| 42 | 🟡 MEDIUM | Percentage guard `total > 0` gagal untuk total negatif | Diganti `total !== 0` + `Math.abs()` |
| 43 | 🟢 LOW | Unused imports (`Package`, `Minus`) | Dihapus |

> Dokumentasi lengkap bug: **SHU-BUG-AND-UPDATE.md Section 14**

---

## 13. Key Source Files

| File | Fungsi |
|------|--------|
| `src/lib/constants/navigation.ts` | Konfigurasi sidebar + role filter |
| `src/app/(protected)/layout.tsx` | Route guard per role |
| `src/lib/hooks/use-auth.tsx` | Auth hook + permissions |
| `src/lib/auth.ts` | NextAuth config |
| `src/types/next-auth.d.ts` | Session type declarations |
| `prisma/seed-staging.ts` | Role + permission seed data |
| `src/app/api/admin/migrate/route.ts` | Migration endpoint (DB schema sync) |
| `src/app/api/billing/generate/route.ts` | Billing period generation + custom dates |
| `src/app/api/unit-transactions/[id]/member/route.ts` | Edit NRP on transactions |
| `akun-primkoppol.md` | Test accounts documentation |
| `src/lib/services/shu-calculator.ts` | Kalkulator SHU utama — income merge + 3-group categorization (✅ fixed Section 11.2) |

---

## 14. Update 1 Juni 2026 (Siang) — Live Testing SHU Detail Dialog

### 14.1 Bug Fix: detail-transactions API 500

| Bug | Severity | Status | Deskripsi |
|-----|----------|--------|-----------|
| detail-transactions API 500 | 🔴 CRITICAL | ✅ CLOSED | Route meng-select `paymentMethod` dan `referenceNo` dari `CashBankTransaction` yang tidak memiliki field tersebut. Fix: gunakan `transactionNo` sebagai reference, `paymentMethod: null`. |

**File diperbaiki:** `src/app/api/reports/shu/detail-transactions/route.ts` — Commit `e0fcc50`

### 14.2 Playwright E2E Test Results (Production)

**URL:** `www.primkoppol.site/laporan/shu` | **Akun:** `operator@koperasi.com`

| # | Test Case | Hasil |
|---|-----------|:---:|
| 1 | SHU page load — data lengkap (Total SHU Rp 4,44M, 829 anggota) | ✅ |
| 2 | Card Total Pendapatan → Detail Dialog (9 kategori, Total Rp 7,02M) | ✅ |
| 3 | Tab Ringkasan — instant load, client-side data, clickable rows | ✅ |
| 4 | Tab Daftar Transaksi — lazy fetch 2.830 tx, 114 halaman, filter | ✅ |
| 5 | Card SHU Anggota → Tab Kalkulasi (7-step visual flow) | ✅ |
| 6 | Fix #37 verified: adjustedNetSurplus ≠ netSurplus (Cuci Mobil deducted) | ✅ |
| 7 | Fix #38 verified: memberGrossIncome = Rp 2,17M (bukan Rp 0) | ✅ |
| 8 | Fix #35 verified: API 401 tanpa session | ✅ |
| 9 | Nested drill-down buttons di Kalkulasi tab | ✅ |
| 10 | Income Group Cards (3x) clickable → filtered dialog | ✅ |
| 11 | Unit Breakdown Table (7 unit + Beban Umum) | ✅ |
| 12 | Member SHU Table (829 anggota, semua kolom) | ✅ |

### 14.3 Key Source Files (Update)

| File | Fungsi |
|------|--------|
| `src/app/api/reports/shu/detail-transactions/route.ts` | API flat transaction list + filter + pagination (✅ fixed #44) |
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | Dialog utama — 3 tab (Ringkasan, Transaksi, Kalkulasi) |
| `src/app/(protected)/laporan/shu/_components/shu-summary-tab.tsx` | Tab ringkasan per kategori |
| `src/app/(protected)/laporan/shu/_components/shu-transactions-tab.tsx` | Tab daftar transaksi (lazy fetch) |
| `src/app/(protected)/laporan/shu/_components/shu-calculation-tab.tsx` | Tab langkah kalkulasi (7-step) |
| `src/app/(protected)/laporan/shu/_components/shu-sp-monthly-tab.tsx` | Tab rincian bulanan SP (BarChart + tabel + link) |
| `src/app/(protected)/laporan/shu/_types.ts` | Shared TypeScript interfaces |

---

## 15. SHU Detail Enhancement: SP Monthly Breakdown & Expense Groups (1 Juni 2026)

### 15.1 Fitur Baru

| Fitur | Deskripsi | Lokasi |
|-------|-----------|--------|
| **SP Monthly Mini-Table** | Expandable tabel bulanan (Jasa Pinjaman, Dana Resiko, Penalti) di dalam card SP income | Card "Pendapatan SimpanPinjam (SP)" |
| **SP Monthly Tab** | Tab "📊 Rincian Bulanan" di detail dialog SP — BarChart + tabel + link ke laporan lengkap | Detail Dialog (income, group=sp) |
| **Expense Group Cards** | 3 card beban berwarna: Operasional Umum (merah), Unit Usaha (oranye), Lainnya (abu-abu) | Bawah income group cards |
| **Expense Group Filtering** | Filter transaksi beban berdasarkan grup (operasional/unit_beban/lainnya) | Detail Dialog (expense) |
| **Link ke Laporan** | Link ke `/pinjaman/laporan-jasa` dan `/pinjaman/laporan-dana-resiko` dari card SP | Card SP + SP Monthly Tab |

### 15.2 API Updates

| Endpoint | Parameter Baru | Deskripsi |
|----------|---------------|-----------|
| `GET /api/reports/shu` | — | Response sekarang termasuk `spMonthlyBreakdown[]` dan `expenseGroups[]` |
| `GET /api/reports/shu/detail-transactions` | `expenseGroup` | Filter expense by group: `operasional`, `unit_beban`, `lainnya` |

### 15.3 Data Produksi

**SP Monthly (2026):** 5 bulan terdata, total SP = Rp 298.010.332

**Expense Groups (2026):**
- Beban Operasional Umum: Rp 1.031.155.040
- Beban Unit Usaha: Rp 63.213.300
- Beban Lainnya: Rp 1.485.149.401

### 15.4 Source Files

| File | Fungsi |
|------|--------|
| `src/lib/services/shu-calculator.ts` | SP monthly query (Promise.all 3 sumber) + expense grouping |
| `src/app/(protected)/laporan/shu/_components/shu-sp-monthly-tab.tsx` | Komponen baru: BarChart + summary + tabel bulanan |
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | Tab "Rincian Bulanan" + expenseGroup prop |
| `src/app/api/reports/shu/detail-transactions/route.ts` | `expenseGroup` filter param |

---

## 16. Update 1 Juni 2026 (Sore) — Fix: SP Income Bocor ke Detail Dialog Lainnya

### 16.1 Bug Fix

| Bug | Severity | Status | Deskripsi |
|-----|----------|--------|-----------|
| SP income leaking to all groups | 🔴 CRITICAL | ✅ CLOSED | `jasa_pinjaman` (1,000 items, Rp 234M) dan `dana_resiko` (105 items, Rp 58M) bocor ke semua income group di detail dialog karena conditional logic salah (`!category || incomeGroup === "sp"` selalu true saat category=null). Fix: conditional hanya aktif untuk grup yang benar. |
| CB + Direct double counting | 🔴 CRITICAL | ✅ CLOSED | Saat filter `incomeGroup=sp`, CB query mengembalikan `jasa_pinjaman` entries (via GROUP_CATEGORIES override) DAN LoanPayment direct query juga mengembalikan data yang sama = double counting. Fix: CB filter sekarang mengecualikan categories yang di-handle oleh direct queries. |

**Commit:** `7df2979` (railway-migration)

### 16.2 Dampak

- Detail dialog "Pendapatan Lainnya": 1,184 item → **79 item** (hapus 1,105 SP items yang bocor)
- Total amount "Lainnya": Rp 6,998,558,631 → **Rp 6,705,367,799** (hapus Rp 293M duplikasi)
- Zero cross-group leakage: setiap grup hanya berisi kategori yang benar

---

## 17. Update 1 Juni 2026 (Sore) — Fix: Akun 4201 Salah SP + Pendapatan Toko Hilang

### 17.1 Bug Fix

| Bug | Severity | Status | Deskripsi |
|-----|----------|--------|-----------|
| Akun 4201 salah masuk SP | 🔴 CRITICAL | ✅ CLOSED | Calculator menggunakan `startsWith("4")` yang merutekan SEMUA akun 4xxx ke SP, termasuk 4201 "Pendapatan Toko/Unit" (Rp 97M). Fix: `startsWith("41")` → SP, `startsWith("42")` → Unit, `startsWith("43+")` → Lainnya. |
| Pendapatan toko hilang dari detail Unit | 🟠 HIGH | ✅ CLOSED | `DIRECT_QUERY_CATEGORIES` mengecualikan `pendapatan_toko` dari CB query karena mengharapkan StoreSale, tapi StoreSale kosong (RC-4). Fix: hapus dari DIRECT_QUERY_CATEGORIES & NON_INCOME_CATEGORIES. |

**Commit:** `f16c6eb` (railway-migration)

### 17.2 Dampak

**Calculator incomeGroups:**
- Card Unit: Rp 130.625.000 → **Rp 228.423.700** (4201 "Pendapatan Toko" pindah ke Unit ✅)
- Card SP: Rp 182.947.100 → **Rp 85.851.000** (4201 keluar dari SP ✅)
- Card Lainnya: Rp 6.705.367.799 → **Rp 6.705.367.799** (tidak berubah ✅)

**Detail-transactions API:**
- Unit detail: Rp 78.208.400 → **Rp 131.836.200** (+1.194 items pendapatan_toko senilai Rp 53.627.800 ✅)
- SP detail: Rp 298.010.832 → Rp 298.010.832 (tidak berubah)
- Lainnya detail: Rp 6.705.367.799 → Rp 6.705.367.799 (tidak berubah ✅)

### 17.3 Sisa Discrepancy (Design Difference)

Detail API dan Calculator menggunakan sumber data berbeda untuk jasa pinjaman dan pendapatan unit:
- Calculator: JournalLine + CB non-journaled → subset yang terekam di akuntansi
- Detail API: Direct LoanPayment/UnitTransaction → semua data riil dari tabel sumber
- Detail API **lebih akurat** untuk SP (Rp 298M vs Rp 85.9M calculator)
- Sinkronisasi penuh membutuhkan perubahan calculator ke direct queries — task terpisah
