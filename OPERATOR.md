# Operator Role — Audit & Documentation

> Role: `operator` | Permission: `manage_all` | Deskripsi: Super Admin sistem
> Branch: `railway-migration` | Updated: 9 Juni 2026

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

**Billing Lifecycle:** `Draft` → (settle semua) → `Diproses` (= final/selesai). Draft bisa partial settle per anggota. "Diproses" = semua lunas, uang masuk kas/bank, tidak bisa di-toggle lagi. Hapus = reverse semua isPaid.

**Status di Riwayat:** Setelah settle, transaksi salary_cut berubah: badge "LUNAS" (hijau), keterangan "(Potong Gaji - Lunas)" / "(Potong Gaji ✓ Lunas)" di portal anggota. Mekanisme: `StoreSale.metadata.isSettled = true`.

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
| Profil PRIMKOPPOL | `/profil-koperasi` | Ja |
| Pengaturan | `/settings` | Tidak |
| Profil Saya | `/profil` | Tidak |

Master Data sub-items: Produk Simpanan, Produk Pinjaman, Bagan Akun, Mapping Jurnal, Parameter SHU, Saldo Awal, Master Kas & Bank, Import & Export Data.

---

## 2. Route Guard & Role Hierarchy

**File:** `src/app/(protected)/layout.tsx:83-84`

```typescript
if (user.permissions.includes("manage_all")) return; // bypasses all guards
```

### Role Hierarchy
- **Operator** (`manage_all`) = satu-satunya super admin
- **Admin** = akses terbatas ke unit sendiri saja (toko, resto_cafe, cafe_lsp, dll)
- **Admin SP** = Simpan Pinjam operations
- **Kasir** = POS-scoped (cashier)
- ❌ `superadmin`/`super_admin` — dihapus dari 59 file, role tidak ada di DB

---

## 3. API Access Matrix

### ✅ RBAC Benar

| Kategori | Endpoints | Allowed Roles |
|----------|-----------|---------------|
| Members | `/api/members/*` | operator, admin, admin_sp, kasir |
| Loans | `/api/loans/*` | operator, admin_sp |
| Savings | `/api/savings/*` | operator, admin, admin_sp |
| Journals | `GET /api/journals` | operator, admin, admin_sp |
| Reports | `GET /api/reports/neraca\|laba-rugi\|arus-kas` | operator, admin, admin_sp |
| Kas-Bank | `/api/cash-bank/*` | operator, admin, admin_sp |
| Unit Tx | `/api/unit-transactions/*` | operator, admin, ... |
| Payroll | `/api/payroll/*` | operator-only |
| Audit Log | `GET /api/audit-logs` | operator, admin_sp |
| Billing | `/api/billing/*` | manage_all |
| Toko | `/api/toko/sales\|split-bill\|queue\|shifts` | operator, admin, ... |

### 🔒 Operator-only Endpoints

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

## 4. Security Issues

### 🔴 CRITICAL — No Auth (11 endpoints)

| # | Endpoint | Method | Risiko |
|---|----------|--------|--------|
| 1 | `/api/journals` | POST | Siapapun bisa buat jurnal |
| 2 | `/api/cash-bank/transfers` | POST | Siapapun bisa buat transfer |
| 3 | `/api/cash-bank/import` | POST | Hanya cek session, tidak cek role |
| 4 | `/api/reports/shu` | GET | **Public** — data keuangan SHU |
| 5 | `/api/reports/members-recap` | GET | **Public** — data keuangan anggota |
| 6 | `/api/reports/savings-recap` | GET | **Public** — data simpanan |
| 7 | `/api/dashboard-charts` | GET | **Public** — data grafik keuangan |
| 8 | `/api/users` | GET | **Public** — daftar semua user |
| 9 | `/api/master/cash-bank` | POST | Siapapun bisa buat akun kas-bank |
| 10 | `/api/settings/cooperative` | GET | **Public** — profil koperasi |
| 11 | `/api/pengumuman/[id]` | PUT/DELETE | **Tanpa auth** — edit/hapus pengumuman |

### 🟠 HIGH — Weak Auth (8 endpoints)

| # | Endpoint | Method | Masalah |
|---|----------|--------|---------|
| 12 | `/api/settings` | PUT | Hanya blokir `kasir` |
| 13 | `/api/settings/shu` | POST | Tidak ada role check |
| 14 | `/api/pengumuman` | POST | Tidak ada role check |
| 15 | `/api/reports/shu/calculate` | GET | Hanya cek session |
| 16 | `/api/reports/shu/distribute` | POST | Lock SHU tanpa role check |
| 17 | `/api/billing/[periodId]` | GET/DELETE | Tidak ada role check |
| 18 | `/api/non-sp/penerimaan\|pengeluaran` | GET | Tidak ada auth |
| 19 | `/api/non-sp/penerimaan\|pengeluaran/[id]` | DELETE | Hanya cek session |

### 🟡 MEDIUM — Inconsistencies (3 issues)

| # | Issue |
|---|-------|
| 20 | Audit Log terlalu restrictive — admin diblokir |
| 21 | Loan sync/generate mengecualikan admin_sp |
| 22 | `superadmin` (tanpa underscore) di beberapa route unit/mobile |

---

## 5. Key Source Files

| File | Fungsi |
|------|--------|
| `src/lib/constants/navigation.ts` | Sidebar nav config + role filter |
| `src/app/(protected)/layout.tsx` | Route guard per role |
| `src/lib/hooks/use-auth.tsx` | Auth hook + permissions |
| `src/lib/auth.ts` | NextAuth v5 config |
| `src/types/next-auth.d.ts` | Session type declarations |
| `prisma/seed-staging.ts` | Role + permission seed data |
| `src/lib/services/shu-calculator.ts` | SHU calculator — income merge + 3-group categorization + CB income merge |
| `src/lib/export-utils.ts` | PDF generator + Excel export (piutang, kwitansi, dll) |
| `src/app/api/admin/migrate/route.ts` | Migration endpoint (DB schema sync + StoreSale isSettled backfill) |
| `src/app/api/billing/generate/route.ts` | Billing period generation + custom dates |
| `src/app/api/billing/[periodId]/process/route.ts` | Billing settlement: mark items paid, update source UT + StoreSale, create CashBank |
| `src/app/api/member-portal/transactions/route.ts` | Member portal transaction history (unit/savings/loan) with isSettled check |
| `src/app/api/reports/shu/detail-transactions/route.ts` | SHU detail API — flat paginated transaction list (auth guarded) |
| `src/app/(protected)/laporan/shu/_components/shu-detail-dialog.tsx` | SHU dialog — 3 tab (Ringkasan, Transaksi, Kalkulasi) |
| `src/app/(protected)/laporan/shu/_components/shu-sp-monthly-tab.tsx` | SP monthly breakdown tab |
| `src/app/(protected)/laporan/shu/_types.ts` | Shared SHU TypeScript interfaces |
| `akun-primkoppol.md` | Test accounts documentation |

---

## 6. Changelog

### Mei 2026

| Tgl | Fitur / Fix | Detail |
|-----|-------------|--------|
| 18 | Role Cleanup | Hapus `superadmin`/`super_admin` dari 59 file. Operator = satu-satunya super admin |
| 18 | Tagihan Piutang | Generate draft, custom date range, toggle items, process/settle, delete draft (`/tagihan`) |
| 18 | Member Enhancements | Edit detail (gaji, tunles, pangkat, golongan, kesatuan, employeeType, noRekening), merge duplikat, enhanced delete |
| 18 | Loan Edit (7 fix) | Rounding, date helper, audit trail, role fix, copy, notes, import guard |
| 18 | Member Columns Migration | `sisa_gaji`, `employee_type`, `pangkat`, `golongan`, `kesatuan`, `no_rekening` via migration endpoint |
| 18 | Billing Code Review | 5 fix: DELETE reverse isPaid, totalMembers unique count, partial settle cumulative, GET permission check, isPaid badge |
| 18 | Portal Faktur | Member self-service: lihat riwayat tagihan, expandable cards, cetak faktur A4, auto-sync delete |
| 18 | Export Piutang | PDF A4 (kop surat, double-line, info grid, detail table) + Excel 3-sheet (Detail, Ringkasan Unit, Rekap) |
| 18 | Mobile Responsive Tagihan | Progressive column hide, icon-only buttons on mobile |
| 30 | Manajemen Unit Insights Phase 1+2 | 6 insight: Tren Pendapatan, Jam Ramai, Metode Pembayaran, Keuntungan, Top 5 Produk, Perbandingan Mingguan |
| 30 | Manajemen Unit Phase 3 | Full product sales breakdown with range selector |
| 30 | Unit Audit Fixes | 15 issue resolved: double revenue, stock threshold, pagination, search, date filter, error state, res.ok checks |
| 31 | Manajemen Unit UI/UX | Category filter, dynamic labels, search produk, date filter transaksi, clean trend icon |
| 31 | Sinkronisasi Beban SHU | CB expense merge (+Rp 2.58B), blacklist method, deduplikasi aman, beban umum grouping |

### Juni 2026

| Tgl | Fitur / Fix | Detail |
|-----|-------------|--------|
| 1 | SHU Income Fix (CRITICAL) | CB income merge + Dana Resiko via Loan.adminFee + 3-group categorization (Unit/SP/Lainnya) |
| 1 | SHU Detail Dialog | 3-tab dialog (Ringkasan, Transaksi paginated, Kalkulasi 7-step) + nested drill-down |
| 1 | SP Monthly Breakdown | Expandable tabel bulanan + BarChart + link ke laporan |
| 1 | Expense Group Cards | 3 card beban: Operasional Umum, Unit Usaha, Lainnya |
| 1 | SP Income Leak Fix | `jasa_pinjaman`/`dana_resiko` bocor ke semua group → conditional logic fix |
| 1 | Akun 4201 Categorization | `startsWith("4")` salah → `startsWith("41")`=SP, `startsWith("42")`=Unit, `startsWith("43+")`=Lainnya |
| 1 | Pendapatan Toko Restore | `pendapatan_toko` dihapus dari DIRECT_QUERY_CATEGORIES & NON_INCOME_CATEGORIES |
| 1 | Exclude Pendapatan/Beban Lainnya | `lainnya` + `biaya_operasional` type=in ditambahkan ke blacklist. SHU hanya hitung Unit + SP income |
| 1 | Voided Income Fix | 30 voided CB (Rp 3.02M) diexclude dari SHU income via void exclusion query |
| 9 | Print Nota Encoding Fix | `Intl.NumberFormat` currency style sisipkan U+00A0 NBSP → karakter Rusia di print window. Fix: `formatRupiah()` ASCII-only + `<meta charset="utf-8">` di 6 file |
| 9 | Takeaway Surcharge | Resto: tambahan Rp 1.000/item untuk takeaway. Config via `AppSetting`, auto-seed default, validasi server, receipt, riwayat, laporan |
| 9 | Billing Settlement Status Fix (CRITICAL) | 3-layer fix: billing settle tidak update StoreSale → riwayat & portal selalu "BELUM LUNAS". Fix: `StoreSale.metadata.isSettled` pattern + linked StoreSale via saleNo + portal fix + migration backfill 122 records |

### Test Accounts (Production)

| Email | Password | Role |
|-------|----------|------|
| `operator@koperasi.com` | `password123` | operator (manage_all) |
| `admintoko@koperasi.com` | `password123` | admin (toko) |

---

## 7. Rekomendasi Perbaikan (Security)

### Priority 1 — Critical
1. Tambah auth ke POST `/api/journals`
2. Tambah auth ke POST `/api/cash-bank/transfers`
3. Tambah auth ke `/api/reports/shu|members-recap|savings-recap|dashboard-charts`
4. Tambah auth ke GET `/api/users`
5. Tambah auth ke PUT/DELETE `/api/pengumuman/[id]`
6. Tambah auth ke POST `/api/master/cash-bank`
7. Tambah auth ke GET `/api/non-sp/*`

### Priority 2 — High
8. Fix `/api/settings` PUT — ganti blacklist → whitelist
9. Fix `/api/settings/shu` POST — tambah role check
10. Fix `/api/pengumuman` POST — tambah role check
11. Fix `/api/reports/shu/distribute` POST — operator-only
12. Fix `/api/billing/[periodId]` GET/DELETE — tambah role check
13. Fix `/api/cash-bank/import` POST — tambah role check

### Priority 3 — Medium
14. Perluas `/api/audit-logs` — tambahkan `admin`
15. Review loan operator-only endpoints — tambahkan `admin_sp`
16. Standardize `superadmin` → hapus sisa di unit packages & mobile API

*Diperbarui: 9 Juni 2026*
