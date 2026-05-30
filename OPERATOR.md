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

All known issues resolved.

---

## 10. Key Source Files

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
