# Admin Simpan Pinjam Role (`admin_sp`) Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new `admin_sp` database role that provides operator-level access to Simpanan, Pinjaman, Anggota, Kas-Bank, Jurnal, Laporan, Kwitansi, and Approval — without access to Master Data, User Management, Payroll, Periode/SHU, Tutup Buku, or POS Unit Layanan.

**Architecture:** Extend existing RBAC system with a new role + permission set + navigation array. No structural changes to auth flow. API routes gain `admin_sp` alongside `operator` in role checks.

**Tech Stack:** Next.js API routes, Prisma seed, React navigation config, NextAuth session

---

## 1. Role Definition

### Database: New Role Row

| Field | Value |
|-------|-------|
| `name` | `admin_sp` |
| `displayName` | `Admin Simpan Pinjam` |
| `description` | `Admin khusus Simpan Pinjam — akses simpanan, pinjaman, anggota, kas-bank, jurnal, laporan` |
| `isSystem` | `true` |

### Permissions (14 of 24)

| Permission | Access |
|-----------|--------|
| `view_dashboard` | Dashboard page |
| `manage_anggota` | Member list, detail, edit (override saldo), kartu, buku |
| `view_anggota` | Read member data |
| `manage_simpanan` | Savings: rekening, transaksi, rekap |
| `view_simpanan` | Read savings data |
| `manage_pinjaman` | Loans: list, angsuran, jadwal, pengajuan, approve/reject |
| `view_pinjaman` | Read loan data |
| `approve_pinjaman` | Approve/reject loan applications |
| `manage_kas_bank` | Cash/bank: buku kas, transaksi, transfer |
| `view_jurnal` | Journal: buku besar, jurnal umum, penyesuaian |
| `view_laporan` | Reports: neraca, laba rugi, arus kas, SHU, rekap simpanan/pinjaman |
| `approve_transactions` | Approval inbox |
| `manage_unit_transactions` | Kwitansi |
| `manage_pengumuman` | Announcements |

### NOT Granted (Explicitly Excluded)

- `manage_all` — no wildcard access
- `master_data` — cannot manage master products, COA, mappings
- `user_management` — cannot create/edit users
- `tutup_buku` — cannot close accounting periods
- `alokasi_shu` — cannot distribute SHU
- `manage_aset` — no asset management
- `manage_jurnal` — cannot create/edit journal entries (view only)
- `manage_toko` — no retail/POS access
- `view_audit_log` — no audit trail
- `view_all_branches` — scoped to own branch

---

## 2. Navigation

### New `adminSpNavigation` Array

```
OPERASIONAL:
  - Dashboard (view_dashboard)
  - Anggota (manage_anggota)
    - Daftar Anggota
    - Kartu Anggota
    - Buku Anggota
  - Simpanan (manage_simpanan)
    - Rekening
    - Transaksi
    - Rekap Simpanan
  - Pinjaman (manage_pinjaman)
    - Pengajuan
    - Daftar Pinjaman
    - Bayar Angsuran
    - Jadwal Angsuran
    - Laporan Jasa
  - Kas & Bank (manage_kas_bank, roles: [admin_sp])
    - Buku Kas
    - Transaksi Kas
    - Transaksi Bank
    - Transfer
  - Non Simpan Pinjam (manage_kas_bank, roles: [admin_sp])
    - Penerimaan
    - Pengeluaran
  - Kwitansi (manage_unit_transactions, roles: [admin_sp])

AKUNTANSI (roles: [admin_sp]):
  - Jurnal (view_jurnal)
    - Buku Besar
    - Jurnal Umum
    - Jurnal Penyesuaian
  - Laporan (view_laporan)
    - Neraca
    - Laba Rugi
    - Arus Kas
    - SHU
    - Rekap Simpanan
    - Rekap Pinjaman
    - Faktur Potongan
    - Piutang Gabungan

KOMUNIKASI:
  - Pengumuman (manage_pengumuman)

APPROVAL (roles: [admin_sp]):
  - Inbox Approval (approve_transactions)

PENGATURAN:
  - Pengaturan (no restriction)
  - Profil Saya (no restriction)
```

### Route in `getNavigationForUser()`

Add after existing admin routing, before the fallback:
```typescript
else if (user.roleName === "admin_sp") {
    finalNav = filterNavigationByUser(adminSpNavigation, user);
}
```

---

## 3. Route Guards

### `layout.tsx` — ADMIN_SP_ALLOWED_ROUTES

```typescript
const ADMIN_SP_ALLOWED_ROUTES = [
    "/dashboard", "/profil", "/settings", "/pengumuman",
    "/simpanan", "/pinjaman", "/anggota",
    "/kas-bank", "/non-sp",
    "/unit", "/transaksi-unit",
    "/kwitansi", "/jurnal", "/laporan",
    "/approval",
];
```

In `ProtectedContent`, add after the operator check:
```typescript
// Admin SP — akses simpan pinjam + keuangan
if (roleName === "admin_sp") {
    const allowed = [...ADMIN_SP_ALLOWED_ROUTES];
    if (!isPathAllowed(pathname, allowed)) {
        router.replace("/dashboard");
    }
    return;
}
```

### `proxy.ts` — Unit Isolation Bypass

In the unit isolation block (where `simpan_pinjam` admin is already partially allowed), add `admin_sp` to the bypass list so it can access financial modules.

---

## 4. API Route Changes

### Pattern: Extend Operator-Only Checks

Current pattern in ~30 API routes:
```typescript
if (roleName !== "operator") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}
```

Change to:
```typescript
if (!["operator", "admin_sp"].includes(roleName)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
}
```

### Affected API Routes (~30 files)

**Simpanan (4 files):**
- `api/savings/transactions/route.ts` — GET (list), POST (create)
- `api/savings/transactions/[id]/route.ts` — PUT, DELETE
- `api/savings/accounts/route.ts` — GET, POST
- `api/savings/accounts/[id]/route.ts` — PUT

**Pinjaman (8 files):**
- `api/loans/route.ts` — GET (list loans)
- `api/loans/[id]/route.ts` — GET, PUT
- `api/loans/[id]/payments/route.ts` — POST (bayar angsuran)
- `api/loans/[id]/void/route.ts` — POST (void)
- `api/loans/applications/route.ts` — GET (pengajuan list)
- `api/loans/applications/[id]/approve/route.ts` — POST
- `api/loans/applications/[id]/reject/route.ts` — POST
- `api/loans/applications/[id]/disburse/route.ts` — POST

**Pinjaman Kompen (3 files):**
- `api/loans/kompen/eligible/route.ts` — GET
- `api/loans/kompen/simulate/route.ts` — GET
- `api/loans/kompen/disburse/route.ts` — POST

**Pinjaman Reports (2 files):**
- `api/loans/reports/interest/route.ts` — GET
- `api/loans/reports/interest/_lib/report-helpers.ts` — auth helper

**Anggota (2 files):**
- `api/members/route.ts` — GET, POST
- `api/members/[id]/route.ts` — GET, PUT

**Kas-Bank (3 files):**
- `api/cash-bank/route.ts` — GET
- `api/cash-bank/transactions/route.ts` — GET, POST
- `api/cash-bank/accounts/route.ts` — GET

**Jurnal (2 files):**
- `api/journals/route.ts` — GET
- `api/journals/[id]/route.ts` — GET

**Laporan (3 files):**
- `api/reports/neraca/route.ts`
- `api/reports/laba-rugi/route.ts`
- `api/reports/arus-kas/route.ts`

**Kwitansi (1 file):**
- `api/receipts/route.ts` — GET, POST

**Unit Transactions (2 files):**
- `api/unit-transactions/route.ts` — GET, POST
- `api/unit-transactions/validate/route.ts` — POST

**Mobile API (3 files):**
- `api/mobile/loans-operator/route.ts` — GET (mobile loan list)
- `api/mobile/loans-operator/direct-disburse/route.ts` — POST
- `api/mobile/loans-operator/kompen-disburse/route.ts` — POST

### Routes That Stay Operator-Only (NOT Extended)

These remain `roleName !== "operator"` only:
- `api/audit-logs/route.ts`
- `api/payroll/*` (all payroll routes)
- `api/master/*` (all master data routes)
- `api/users/*` (user management)
- `api/periods/*` (tutup buku, SHU distribusi)
- `api/settings/*` (system settings — admin_sp doesn't need this)
- `api/loans/import-update/route.ts` (bulk import — operator only)
- `api/loans/import-migrasi/route.ts` (bulk import — operator only)
- `api/loans/generate-schedules/route.ts` (migration tool — operator only)
- `api/toko/*` (POS — not relevant)

---

## 5. Mobile App Changes

### Auth Context

In `mobile/src/lib/auth-context.tsx`, add `admin_sp` to recognized roles. The role should be treated similarly to `admin` for navigation purposes but with the `admin_sp` navigation items.

### Dashboard Menu Items

In `mobile/App.tsx` or the operator dashboard component, when role is `admin_sp`, show:
- Simpanan (transaksi simpanan)
- Pinjaman (pengajuan, angsuran)
- Anggota (cari, lihat detail)
- Kas-Bank (mutasi)
- Laporan

Hide:
- Toko, Unit Layanan, Master Data, User Management
- Payroll, Periode/SHU

### Mobile Operator Screens

Existing operator screens that need `admin_sp` access:
- `mobile/src/screens/operator/SimpananScreen.tsx` — add admin_sp
- `mobile/src/screens/operator/PinjamanScreen.tsx` — add admin_sp
- `mobile/src/screens/operator/AngsuranScreen.tsx` — add admin_sp
- `mobile/src/screens/operator/AnggotaScreen.tsx` — add admin_sp
- `mobile/src/screens/operator/KompenScreen.tsx` — add admin_sp

The mobile API routes under `/api/mobile/*` that check for `operator` role also need `admin_sp` added.

---

## 6. UAT Seed Data

Add a test user:
```sql
email: admin_sp@primkoppol.online
password: (hashed)
role: admin_sp
unitType: simpan_pinjam
branchId: 1
isActive: true
```

---

## 7. Scope Boundaries

### What This Role Can Do
- Full CRUD on savings transactions and accounts
- Full CRUD on loans, applications, disbursements, void
- View and edit members (including override saldo simpanan)
- Manage kas-bank transactions and transfers
- View journals and all financial reports
- Approve/reject loan applications and transactions
- Create and view kwitansi

### What This Role Cannot Do
- Create/edit/delete master data (products, COA, mappings)
- Manage users (create, edit, delete, assign roles)
- Access payroll (gaji, slip)
- Close accounting periods (tutup buku)
- Distribute SHU
- Access any POS unit (toko, cuci mobil, barbershop, etc.)
- Import bulk data (pinjaman, members)
- View audit logs
- Edit system settings or koperasi profile
