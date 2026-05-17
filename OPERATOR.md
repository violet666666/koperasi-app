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
| Manajemen Unit | `/manajemen-unit` | Dashboard Unit, Pengaturan Unit |

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

## 7. Key Source Files

| File | Fungsi |
|------|--------|
| `src/lib/constants/navigation.ts` | Konfigurasi sidebar + role filter |
| `src/app/(protected)/layout.tsx` | Route guard per role |
| `src/lib/hooks/use-auth.tsx` | Auth hook + permissions |
| `src/lib/auth.ts` | NextAuth config |
| `src/types/next-auth.d.ts` | Session type declarations |
| `prisma/seed-staging.ts` | Role + permission seed data |
