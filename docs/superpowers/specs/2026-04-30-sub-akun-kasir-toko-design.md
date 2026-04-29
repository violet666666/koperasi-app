---
title: Sub-Akun Kasir Toko dengan PIN Login
date: 2026-04-30
status: approved
scope: Unit Toko — Platform Web
---

# Sub-Akun Kasir Toko dengan PIN Login

## 1. Latar Belakang

Saat ini setiap kasir toko memiliki akun email sendiri untuk login ke sistem. Di lapangan, ini kurang praktis karena:

- Device/tablet POS di kasir hanya 1 unit, dipakai bergantian oleh beberapa kasir
- Login/logout pakai email setiap ganti shift memakan waktu
- Admin harus membuat akun email baru setiap ada kasir baru
- Belum ada identitas kasir yang tercatat per transaksi (hanya email user)

## 2. Konsep

Pisahkan **device authentication** dari **kasir identity**:

- **Akun device** = 1 akun email `kasirtoko@...` yang login 1x di browser, session berlaku 30 hari
- **Identitas kasir** = sub-akun dengan username + PIN, dikelola oleh Admin Toko
- **Shift** = terikat identitas kasir yang login, bukan akun email

## 3. Alur Penggunaan

### 3.1 Setup Awal (oleh Admin Toko / Operator)

1. Login ke sistem dengan akun Admin Toko
2. Buka menu **Manajemen Kasir** di sidebar Toko
3. Tambah identitas kasir: username, PIN, nama tampilan
4. Ulangi untuk setiap kasir (Kasir 1, Kasir 2, dst)
5. Di device POS, login 1x pakai akun email `kasirtoko@...`

### 3.2 Alur Kasir Harian

```
Device POS (browser sudah login kasirtoko@...)
  │
  ▼
Lock Screen — pilih identitas + masukkan PIN
  │
  ▼
Shift Screen — pilih shift, isi modal awal, mulai shift
  │
  ▼
POS Kasir — transaksi normal, header tampil "Sari — Shift Pagi"
  │
  ▼
Tutup Shift — rekonsiliasi kas → kembali ke Lock Screen
```

### 3.3 Ganti Kasir

1. Kasir aktif klik **"Ganti Kasir"** di header POS
2. Sistem tutup shift otomatis jika masih terbuka (opsional)
3. Kembali ke Lock Screen
4. Kasir berikutnya pilih identitas + PIN
5. Buka shift baru

## 4. Data Model

### 4.1 Tabel Baru: `CashierIdentity`

| Field | Type | Keterangan |
|-------|------|------------|
| `id` | Int (auto, PK) | Primary key |
| `parentUserId` | Int (FK → users.id) | Akun device (email) pemilik identitas ini |
| `username` | String (unique per parent) | Username kasir, e.g. "kasir1", "sari" |
| `pin` | String | PIN 4-6 digit, di-hash dengan bcrypt |
| `displayName` | String | Nama tampilan, e.g. "Kasir 1 - Sari" |
| `isActive` | Boolean (default true) | Aktif atau nonaktif |
| `createdAt` | DateTime | Waktu pembuatan |
| `updatedAt` | DateTime | Waktu update terakhir |

**Constraint:** `(parentUserId, username)` unique — tidak boleh ada username sama dalam satu akun device.

### 4.2 Modifikasi: `CashierShift`

| Field Baru | Type | Keterangan |
|------------|------|------------|
| `cashierIdentityId` | Int? (FK → cashier_identities.id) | Identitas kasir yang buka shift |

### 4.3 Modifikasi: `StoreSale`

| Field Baru | Type | Keterangan |
|------------|------|------------|
| `cashierIdentityId` | Int? (FK → cashier_identities.id) | Identitas kasir yang memproses transaksi |

## 5. Halaman & Komponen

### 5.1 Lock Screen (BARU)

**Route:** Ditampilkan sebagai overlay/guard di `/toko/*` setelah login email.

**UI:**
- Grid kartu identitas kasir (tampilkan displayName)
- Input PIN (masked, auto-submit saat 4-6 digit)
- Tombol "Masuk"
- Error: "PIN salah" dengan counter percobaan

**Behavior:**
- Tampil otomatis saat kasir dengan role "kasir" mengakses halaman toko
- Tidak tampil untuk Admin Toko / Operator (langsung masuk dashboard)
- Setelah PIN benar → simpan `cashierIdentityId` ke session/cookie
- Redirect ke Shift Screen jika belum ada shift aktif, atau langsung POS jika sudah ada

### 5.2 Manajemen Kasir (BARU)

**Route:** `/toko/kasir-manajemen`

**Akses:** Admin Toko, Operator

**UI:**
- Tabel daftar identitas kasir (username, nama tampilan, status aktif)
- Tombol "Tambah Kasir" → dialog form (username, PIN, displayName)
- Edit → dialog form (displayName, ganti PIN)
- Toggle aktif/nonaktif
- Hapus (soft-delete, hanya jika tidak ada shift aktif)

**Validasi:**
- Username: 3-20 karakter, alfanumerik
- PIN: 4-6 digit angka
- DisplayName: max 50 karakter
- Tidak boleh ada username duplikat per akun device

### 5.3 POS Kasir (DIMODIFIKASI)

**Perubahan:**
- Header menampilkan: "Sari (Kasir 1) — Shift Pagi"
- Tombol "Ganti Kasir" di header → lock screen
- Semua `StoreSale` yang dibuat terikat `cashierIdentityId`
- `StoreSale.createdById` tetap ke parent user (akun device)

### 5.4 Shift (DIMODIFIKASI)

**Perubahan:**
- Buka shift: terikat `cashierIdentityId` (otomatis dari kasir yang login)
- Tutup shift: terikat identitas yang sama
- Riwayat shift: tampilkan kolom "Kasir" (displayName)
- Filter per kasir identitas

### 5.5 Riwayat Transaksi (DIMODIFIKASI)

**Perubahan:**
- Kolom "Kasir" menampilkan `displayName` dari identitas kasir
- Filter per kasir identitas

### 5.6 Laporan Unit (DIMODIFIKASI)

**Perubahan:**
- Filter per kasir identitas
- Summary per kasir di shift report

## 6. API Endpoints

### 6.1 Baru: Identitas Kasir

| Method | Endpoint | Akses | Deskripsi |
|--------|----------|-------|-----------|
| `GET` | `/api/toko/cashier-identities` | Admin Toko, Operator | List identitas kasir |
| `POST` | `/api/toko/cashier-identities` | Admin Toko, Operator | Buat identitas baru |
| `PUT` | `/api/toko/cashier-identities/[id]` | Admin Toko, Operator | Update identitas |
| `DELETE` | `/api/toko/cashier-identities/[id]` | Admin Toko, Operator | Soft-delete identitas |
| `POST` | `/api/toko/cashier-identities/verify-pin` | Kasir (device) | Verifikasi PIN untuk login kasir |

### 6.2 Dimodifikasi

| Endpoint | Perubahan |
|----------|-----------|
| `POST /api/toko/shifts` | Tambah `cashierIdentityId` saat buka shift |
| `GET /api/toko/shifts` | Return `cashierIdentity` info di response |
| `POST /api/toko/sales` | Tambah `cashierIdentityId` saat buat transaksi |
| `GET /api/toko/sales` | Return `cashierIdentity` info di response |
| `GET /api/toko/stats` | Opsional: stats per kasir |

## 7. Keamanan

### 7.1 PIN Security

- PIN di-hash menggunakan **bcrypt** (cost factor 10)
- Tidak ada PIN dalam plain text yang disimpan di DB
- API verify-pin rate-limited: max 5 percobaan, lock 5 menit setelah 5x gagal
- PIN tidak dikembalikan di response API manapun

### 7.2 Session Management

- Identitas kasir disimpan di **cookie** (`cashier_identity_id`) — httpOnly, secure
- Cookie expire saat browser ditutup atau saat "Ganti Kasir"
- Parent session (NextAuth) tetap berlaku 30 hari
- Identitas kasir hanya valid jika `parentUserId` cocok dengan user yang login

### 7.3 Access Control

- Lock screen hanya muncul untuk role `kasir` dengan `unitType = toko`
- Admin Toko dan Operator langsung masuk tanpa PIN (sudah terautentikasi email)
- API cashier-identities hanya bisa diakses oleh Admin Toko/Operator pada unit sendiri
- Verifikasi PIN memvalidasi `parentUserId` cocok dengan session user

## 8. Navigasi

### Sidebar Admin Toko (ditambah)

```
Toko PRIMKOPPOL
├── Dashboard
├── POS Kasir
├── Produk
├── Persediaan
├── Manajemen Kasir    ← BARU
├── Manajemen Harga
├── Shift Kasir
├── Riwayat Transaksi
└── Laporan
```

### Sidebar Kasir (tidak berubah)

```
Toko PRIMKOPPOL
├── POS Kasir
├── Shift Kasir
└── Riwayat Transaksi
```

## 9. Migrasi Data

### Langkah migrasi:

1. **Buat tabel** `cashier_identities` via Prisma migration
2. **Tambah field** `cashierIdentityId` di `cashier_shifts` dan `store_sales` (nullable)
3. **Data lama** tetap berfungsi — field baru nullable, transaksi lama tidak terpengaruh
4. **Untuk transaksi baru** — kasir harus pilih identitas + PIN dulu

### Prisma Schema:

```prisma
model CashierIdentity {
  id            Int       @id @default(autoincrement())
  parentUserId  Int       @map("parent_user_id")
  username      String    @db.VarChar(20)
  pin           String    @db.Text
  displayName   String    @map("display_name") @db.VarChar(50)
  isActive      Boolean   @default(true) @map("is_active")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  parentUser    User      @relation(fields: [parentUserId], references: [id])
  shifts        CashierShift[]
  sales         StoreSale[]

  @@unique([parentUserId, username])
  @@map("cashier_identities")
}
```

```prisma
// Tambah di model CashierShift
cashierIdentityId  Int?              @map("cashier_identity_id")
cashierIdentity    CashierIdentity?  @relation(fields: [cashierIdentityId], references: [id])
```

```prisma
// Tambah di model StoreSale
cashierIdentityId  Int?              @map("cashier_identity_id")
cashierIdentity    CashierIdentity?  @relation(fields: [cashierIdentityId], references: [id])
```

## 10. Urutan Implementasi

1. Prisma migration — tabel baru + field baru
2. API cashier-identities — CRUD + verify-pin
3. Lock Screen component + route guard
4. Session/cookie management untuk identitas kasir
5. Manajemen Kasir page (admin)
6. Modifikasi POS — header + cashierIdentityId
7. Modifikasi Shift — cashierIdentityId + display
8. Modifikasi Riwayat & Laporan — display + filter
9. Testing end-to-end
