Resume this session with:
claude --resume aa30bc63-3606-499f-9d7b-ca93427ddb5e

# Panduan Migrasi Database: NeonDB → Railway PostgreSQL

> **Tujuan:** Memindahkan database dari NeonDB ke Railway PostgreSQL dalam satu proyek Railway yang sama, tanpa kehilangan data, dengan downtime minimal.
>
> **Ukuran database:** ~100 MB
> **Estimasi downtime:** ~30 detik - 2 menit (saat switch ENV)
> **Dibuat:** 10 Mei 2026

---

## Daftar Isi

1. [Arsitektur Saat Ini](#1-arsitektur-saat-ini)
2. [Prasyarat](#2-prasyarat)
3. [Ikhtisar Langkah](#3-ikhtisar-langkah)
4. [Tahap 1 — Provisioning Railway PostgreSQL](#tahap-1--provisioning-railway-postgresql)
5. [Tahap 2 — Backup NeonDB](#tahap-2--backup-neondb)
6. [Tahap 3 — Migrasi Data](#tahap-3--migrasi-data)
7. [Tahap 4 — Verifikasi Data](#tahap-4--verifikasi-data)
8. [Tahap 5 — Switch ENV (Langkah Kritis)](#tahap-5--switch-env-langkah-kritis)
9. [Tahap 6 — Monitoring Pasca-Migrasi](#tahap-6--monitoring-pasca-migrasi)
10. [Rollback Plan](#rollback-plan)
11. [FAQ](#faq)

---

## 1. Arsitektur Saat Ini

```
Saat ini:
┌─────────────────┐         ┌─────────────────────┐
│  Railway App    │ ──────> │  NeonDB PostgreSQL  │
│  (Next.js)      │  TCP    │  (ap-southeast-1)   │
│                 │ ──────> │  Pooler + Direct     │
└─────────────────┘         └─────────────────────┘
     DATABASE_URL ─── pooler connection (-pooler.ap-southeast-1...)
     DIRECT_URL   ─── direct connection

Setelah migrasi:
┌─────────────────┐         ┌─────────────────────┐
│  Railway App    │ ──────> │  Railway PostgreSQL  │
│  (Next.js)      │  TCP    │  (internal network)  │
│                 │         │  Latency ~0ms         │
└─────────────────┘         └─────────────────────┘
     DATABASE_URL ─── railway internal
     DIRECT_URL   ─── sama dengan DATABASE_URL
```

### Environment Variables yang Terpengaruh

| Variable | Saat Ini (NeonDB) | Sesudah (Railway PG) |
|----------|-------------------|----------------------|
| `DATABASE_URL` | `postgresql://neondb_owner:...@ep-...-pooler.ap-southeast-1.aws.neon.tech/neondb?...` | `postgresql://postgres:...@turntable.proxy.rlwy.net:.../railway` |
| `DIRECT_URL` | `postgresql://neondb_owner:...@ep-....ap-southeast-1.aws.neon.tech/neondb?...` | Sama dengan `DATABASE_URL` |

### Yang TIDAK berubah

- Schema Prisma (`prisma/schema.prisma`) — tidak perlu diubah
- Kode aplikasi — tidak perlu diubah
- Semua logika bisnis — tetap sama

---

## 2. Prasyarat

### Yang perlu disiapkan

- [ ] **Railway CLI** sudah terinstal dan login

  ```bash
  railway whoami
  ```

  Jika belum: `npm i -g @railway/cli && railway login`

- [ ] **pg_dump dan pg_restore** tersedia di komputer lokal

  ```bash
  pg_dump --version
  ```

  Jika belum ada: Install PostgreSQL client tools
  - Windows: Download dari [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) atau install via `choco install postgresql`
  - Atau gunakan Docker: `docker run --rm postgres:16 pg_dump --version`

- [ ] **Akses Railway Dashboard** di [railway.com](https://railway.com)

- [ ] **NeonDB Dashboard** untuk mendapatkan kredensial direct connection

### Pilih Waktu yang Tepat

> **Rekomendasi:** Lakukan migrasi di **jam sepi** (malam hari / weekend) ketika jumlah transaksi minimum. Ini meminimalkan risiko kehilangan data saat proses copy.

---

## 3. Ikhtisar Langkah

```
Tahap 1: Provision Railway PG      ← Tidak ada downtime
Tahap 2: Backup NeonDB              ← Tidak ada downtime
Tahap 3: Migrasi data               ← Tidak ada downtime (app tetap pakai NeonDB)
Tahap 4: Verifikasi data            ← Tidak ada downtime
Tahap 5: Switch ENV                 ← DOWNTIME ~30 detik - 2 menit
Tahap 6: Monitoring                  ← Tidak ada downtime
```

**Prinsip keamanan:** App tetap berjalan di NeonDB sampai Tahap 5. Jika ada masalah di Tahap 1-4, cukup batalkan — tidak ada dampak ke production.

---

## Tahap 1 — Provisioning Railway PostgreSQL

> **Downtime: Tidak ada.** Hanya membuat database baru di Railway.

### 1.1 Buka Railway Dashboard

Buka proyek Anda di Railway Dashboard. Pastikan ini proyek yang sama dengan aplikasi yang sudah deploy.

### 1.2 Tambahkan PostgreSQL Service

```
Railway Dashboard
├── Proyek Anda (yang sudah ada app-nya)
│   ├── Klik "+ New" (tombol di pojok kanan atas)
│   ├── Pilih "Database" → "PostgreSQL"
│   ├── Tunggu sampai status "ACTIVE" (hijau)
│   └── Klik service PostgreSQL yang baru dibuat
```

### 1.3 Ambil Connection String

Di halaman service PostgreSQL:

```
Tab "Variables" → Cari DATABASE_URL
```

Anda akan melihat sesuatu seperti:

```
postgresql://postgres:XXXXXXX@turntable.proxy.rlwy.net:12345/railway
```

**Simpan URL ini.** Ini akan menjadi `DATABASE_URL` baru Anda.

### 1.4 Catat Semua Variabel

Di tab "Variables", catat semua variabel berikut:

| Variable | Contoh Nilai | Kegunaan |
|----------|-------------|----------|
| `DATABASE_URL` | `postgresql://postgres:xxx@turntable.proxy.rlwy.net:12345/railway` | Connection string (proxy) |
| `DATABASE_PUBLIC_URL` | Sama seperti di atas | Public connection |
| `POSTGRES_USER` | `postgres` | Username |
| `POSTGRES_PASSWORD` | `xxx` (acak) | Password |
| `POSTGRES_URL` | `postgresql://postgres:xxx@postgres.railway.internal:5432/railway` | Internal connection |

> **PENTING:** `POSTGRES_URL` (tanpa PROXY) adalah koneksi internal Railway. Ini yang paling cepat untuk app di Railway yang sama. `DATABASE_URL` (dengan proxy) untuk akses dari luar Railway (termasuk dari komputer Anda saat migrasi).

---

## Tahap 2 — Backup NeonDB

> **Downtime: Tidak ada.** Hanya membuat salinan data NeonDB.

### 2.1 Identifikasi Direct Connection URL NeonDB

Anda butuh **direct URL** (bukan pooler) untuk pg_dump. Ini ada di `DIRECT_URL` di file `.env` Anda:

```
postgresql://neondb_owner:npg_LleFX1cIqT0z@ep-blue-rain-a1m11cd0.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

> **Jangan gunakan URL yang berakhiran `-pooler`** — pg_dump membutuhkan direct connection.

### 2.2 Buat Backup Full Database

Jalankan di terminal lokal Anda:

```bash
# Ganti NEONDB_DIRECT_URL dengan DIRECT_URL Anda
pg_dump "postgresql://neondb_owner:npg_LleFX1cIqT0z@ep-blue-rain-a1m11cd0.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose \
  -F c \
  -f neondb-backup.dump
```

**Penjelasan flag:**

- `--no-owner` — Tidak menyimpan ownership (supaya bisa di-restore ke user berbeda)
- `--no-acl` — Tidak menyimpan ACL permissions
- `--clean` — Tambahkan DROP statement sebelum CREATE (bersihkan jika ada data)
- `--if-exists` — DROP IF EXISTS (tidak error jika tabel belum ada)
- `-F c` — Format custom (compressed, efisien untuk 100MB)
- `-f neondb-backup.dump` — File output

### 2.3 Verifikasi Backup

```bash
# Cek ukuran file backup
ls -lh neondb-backup.dump

# Verifikasi isi backup (tanpa restore)
pg_restore --list neondb-backup.dump | head -30
```

Output harus menampilkan daftar tabel dan data. Jika muncul error di sini, **JANGAN lanjutkan** — perbaiki dulu masalahnya.

> **Simpan file `neondb-backup.dump` ini sebagai backup permanen.** Bahkan setelah migrasi selesai, simpan selama minimal 30 hari.

---

## Tahap 3 — Migrasi Data

> **Downtime: Tidak ada.** App tetap berjalan di NeonDB. Data sedang disalin ke Railway PG.

### 3.1 Restore ke Railway PostgreSQL

Gunakan `DATABASE_URL` (proxy URL) dari Railway PG yang Anda catat di Tahap 1.4:

```bash
pg_restore \
  --no-owner \
  --no-acl \
  --verbose \
  --if-exists \
  -d "postgresql://postgres:PASSWORD_ANDA@turntable.proxy.rlwy.net:PORT_ANDA/railway" \
  neondb-backup.dump
```

> **Ganti `PASSWORD_ANDA` dan `PORT_ANDA`** dengan nilai dari Railway Variables.

### 3.2 Jika Ada Warning

Jika muncul warning seperti:

```
WARNING: errors ignored on restore
```

Ini biasanya normal untuk warning berikut:

- `already exists` — tabel sudah ada dari Prisma preview
- `must be owner of` — permission issue (tidak kritis)

**Yang TIDAK boleh diabaikan:**

- `ERROR: could not create` — gagal buat tabel
- `ERROR: relation "..." does not exist` — tabel hilang
- `ERROR: permission denied for table ...` — data tidak masuk

Jika ada error kritis, **JANGAN lanjutkan** ke Tahap 5. Perbaiki dulu atau minta bantuan.

### 3.3 Jika pg_restore Gagal Total (Alternatif)

Jika pg_restore gagal, coba pendekatan SQL plain text:

```bash
# Step 1: Dump sebagai SQL plain text
pg_dump "NEONDB_DIRECT_URL?sslmode=require" \
  --no-owner --no-acl --clean --if-exists \
  -f neondb-backup.sql

# Step 2: Restore via psql
psql "RAILWAY_PG_DATABASE_URL" < neondb-backup.sql
```

---

## Tahap 4 — Verifikasi Data

> **Downtime: Tidak ada.** Hanya mengecek data di Railway PG.

### 4.1 Cek Jumlah Tabel

```bash
psql "RAILWAY_PG_DATABASE_URL" -c "\dt" | wc -l
```

Bandingkan dengan NeonDB:

```bash
psql "NEONDB_DIRECT_URL?sslmode=require" -c "\dt" | wc -l
```

Jumlah tabel harus **sama**.

### 4.2 Cek Row Count per Tabel Penting

Jalankan query berikut di KEDUA database dan bandingkan hasilnya:

```sql
SELECT 'users' as tabel, COUNT(*) FROM "User"
UNION ALL SELECT 'store_sales', COUNT(*) FROM "StoreSale"
UNION ALL SELECT 'store_sale_items', COUNT(*) FROM "StoreSaleItem"
UNION ALL SELECT 'unit_transactions', COUNT(*) FROM "UnitTransaction"
UNION ALL SELECT 'savings_accounts', COUNT(*) FROM "SavingsAccount"
UNION ALL SELECT 'savings_transactions', COUNT(*) FROM "SavingsTransaction"
UNION ALL SELECT 'loans', COUNT(*) FROM "Loan"
UNION ALL SELECT 'loan_installments', COUNT(*) FROM "LoanInstallment"
UNION ALL SELECT 'products', COUNT(*) FROM "StoreProduct"
UNION ALL SELECT 'cash_bank_transactions', COUNT(*) FROM "CashBankTransaction"
UNION ALL SELECT 'journal_entries', COUNT(*) FROM "JournalEntry"
UNION ALL SELECT 'accounts', COUNT(*) FROM "Account"
ORDER BY tabel;
```

**Hasil harus IDENTIK di kedua database.** Jika berbeda, ada data yang hilang — **JANGAN lanjutkan** ke Tahap 5.

### 4.3 Cek Data Terbaru

Pastikan data terbaru ada di Railway PG:

```sql
-- 5 transaksi terbaru
SELECT "saleNo", "createdAt" FROM "StoreSale"
ORDER BY "createdAt" DESC LIMIT 5;

-- 5 user terbaru
SELECT name, "createdAt" FROM "User"
ORDER BY "createdAt" DESC LIMIT 5;
```

### 4.4 Verifikasi Schema Prisma

Jalankan dari komputer lokal (dengan sementara mengarah ke Railway PG):

```bash
# Set DATABASE_URL sementara ke Railway PG
set DATABASE_URL=postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:PORT/railway

# Cek apakah schema di Prisma dan DB sinkron
npx prisma db pull --print
```

Bandingkan output dengan `prisma/schema.prisma`. Harus cocok.

> **JANGAN jalankan `prisma db push` atau `prisma migrate` ke Railway PG.** Schema sudah benar dari pg_restore.

---

## Tahap 5 — Switch ENV (Langkah Kritis)

> **DOWNTIME: ~30 detik - 2 menit.** App akan restart saat ENV berubah.

### 5.1 Siapkan Nilai ENV Baru

Anda butuh dua nilai:

**`DATABASE_URL` baru:**
Gunakan `POSTGRES_URL` (internal connection) dari Railway PG Variables — ini paling cepat karena lewat internal network:

```
postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

> **Jika `POSTGRES_URL` tidak ada**, gunakan `DATABASE_URL` (proxy URL). Tetap berfungsi, hanya sedikit lebih lambat.

**`DIRECT_URL` baru:**
Sama dengan `DATABASE_URL` baru. Railway PG tidak butuh pemisahan pooler/direct.

### 5.2 Update ENV di Railway Dashboard

```
Railway Dashboard
├── Klik service APLIKASI (bukan PostgreSQL)
├── Tab "Variables"
├── Update:
│   ├── DATABASE_URL = postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
│   └── DIRECT_URL   = postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
│
└── Railway akan OTOMATIS redeploy setelah ENV berubah
    └── Tunggu status "ACTIVE" (hijau) ≈ 30-60 detik
```

### 5.3 Verifikasi Instan

Segera setelah deploy selesai, buka website dan:

1. **Login** — Apakah bisa login?
2. **Buka Dashboard** — Apakah data muncul?
3. **Buka Kasir** — Apakah produk tampil?
4. **Cek Riwayat** — Apakah transaksi lama ada?
5. **Cek Anggota** — Apakah data anggota lengkap?

### 5.4 Jika Ada Masalah (ROLLBACK!)

Jika setelah switch app tidak berfungsi:

```
Railway Dashboard → Service App → Tab Variables
├── Kembalikan DATABASE_URL ke nilai NeonDB lama
├── Kembalikan DIRECT_URL ke nilai NeonDB lama
└── Railway akan auto-redeploy kembali ke NeonDB
    └── Downtime tambahan ~30 detik
```

> **INI ROLLBACK PLAN UTAMA.** Simpan nilai NeonDB URL di notepad sebelum switch.

---

## Tahap 6 — Monitoring Pasca-Migrasi

### 6.1 Monitoring 24 Jam Pertama

Periksa secara berkala selama 24 jam pertama:

- [ ] Website bisa diakses normal
- [ ] Login berfungsi
- [ ] Kasir bisa bertransaksi
- [ ] Data tersimpan dengan benar
- [ ] Laporan menampilkan data yang benar
- [ ] Tidak ada error 500 di log

### 6.2 Cek Logs Railway

```
Railway Dashboard → Service App → Tab "Deployments"
├── Klik deployment terbaru
├── Tab "Logs"
└── Cari error: grep "Error" atau "Prisma"
```

### 6.3 Setelah 7 Hari Stabil

Setelah 7 hari berjalan lancar tanpa masalah:

1. **NeonDB bisa di-pause/delete** — Tidak lagi dibutuhkan
2. **Hapus file backup lokal** — `neondb-backup.dump` sudah tidak perlu
3. **Update `.env.example`** — Update contoh connection string
4. **Pat yourself on the back** — Migrasi berhasil!

---

## Rollback Plan

### Scenario A: Masalah saat Tahap 1-4 (Sebelum switch)

**Dampak: TIDAK ADA.** App tetap berjalan di NeonDB.

**Aksi:**

1. Hapus service Railway PostgreSQL dari dashboard
2. Tidak perlu lakukan apa-apa lagi

### Scenario B: Masalah saat Tahap 5 (Setelah switch)

**Dampak: App down ~1-2 menit.**

**Aksi:**

1. Buka Railway Dashboard → Service App → Variables
2. Kembalikan `DATABASE_URL` ke NeonDB URL (simpan URL ini sebelum switch!)
3. Kembalikan `DIRECT_URL` ke NeonDB direct URL
4. Railway auto-redeploy ≈ 30 detik
5. App kembali ke NeonDB — semuanya normal

### Scenario C: Data bermasalah setelah switch (ditemukan belakangan)

**Dampak: Terbatas pada data yang dibuat setelah switch.**

**Aksi:**

1. Rollback ke NeonDB (Scenario B)
2. Data yang dibuat di Railway PG setelah switch mungkin perlu di-input ulang manual
3. Selama migrasi segera setelah switch ditemukan masalah, data loss minimal

### Nilai Rollback (SIMPAN INI!)

> **Sebelum Tahap 5, catat kedua nilai ini di tempat yang aman:**

```
DATABASE_URL (NeonDB) = postgresql://neondb_owner:npg_...@ep-...-pooler.ap-southeast-1.aws.neon.tech/neondb?...
DIRECT_URL (NeonDB)   = postgresql://neondb_owner:npg_...@ep-....ap-southeast-1.aws.neon.tech/neondb?...
```

---

## FAQ

### Q: Apakah data bisa hilang selama migrasi?

**Tidak**, selama mengikuti panduan ini. Data di-copy dari NeonDB ke Railway PG. NeonDB tetap utuh sampai Anda sendiri yang menghapusnya setelah 7 hari stabil.

### Q: Berapa lama downtime?

~30 detik - 2 menit, hanya saat Tahap 5 (switch ENV). App akan restart otomatis.

### Q: Apa yang terjadi pada transaksi yang sedang berjalan saat switch?

Jika ada kasir yang sedang checkout tepat saat switch, request-nya mungkin gagal. Kasir cukup refresh halaman dan ulangi checkout. Data NeonDB tetap utuh sehingga tidak ada transaksi yang hilang.

### Q: Apakah perlu ubah kode aplikasi?

**Tidak.** Semua perubahan hanya di level ENV variable. Kode aplikasi, Prisma schema, dan logika bisnis tetap sama persis.

### Q: Koneksi internal vs proxy, mana yang lebih baik?

**Internal (`postgres.railway.internal`)** lebih cepat karena tidak keluar dari jaringan Railway. Gunakan ini untuk `DATABASE_URL` pada app yang berada di proyek Railway yang sama.

### Q: Apakah Railway PG support connection pooling?

Railway PG versi standar tidak memiliki built-in connection pooler seperti PgBouncer. Namun untuk traffic koperasi (puluhan koneksi concurrent), Prisma default connection pool (default 5, max bisa diatur via `connection_limit` parameter) sudah cukup.

### Q: Berapa biaya Railway PostgreSQL?

Railway mengenakan biaya berdasarkan usage (compute + storage). Untuk database 100MB dengan traffic ringan, estimasi ~$1-3/bulan. Cek billing dashboard untuk angka pasti.

### Q: Bagaimana cara backup Railway PG setelah migrasi?

Railway PG memiliki auto-backup. Untuk backup manual:

```bash
pg_dump "RAILWAY_PG_DATABASE_URL" --no-owner --no-acl -F c -f railway-backup.dump
```

---

## Checklist Ringkas

Print atau copy checklist ini saat melakukan migrasi:

```
SEBELUM MIGRASI:
[ ] Railway CLI terinstal dan login
[ ] pg_dump/pg_restore tersedia
[ ] Waktu migrasi dipilih (jam sepi)
[ ] NeonDB URL dicatat untuk rollback

TAHAP 1 - PROVISIONING:
[ ] Railway PostgreSQL service dibuat
[ ] Status ACTIVE
[ ] Connection URL dicatat

TAHAP 2 - BACKUP:
[ ] pg_dump NeonDB berhasil
[ ] File backup ada dan berukuran wajar
[ ] pg_restore --list menampilkan tabel

TAHAP 3 - MIGRASI:
[ ] pg_restore ke Railway PG berhasil
[ ] Tidak ada error kritis

TAHAP 4 - VERIFIKASI:
[ ] Jumlah tabel sama
[ ] Row count per tabel identik
[ ] Data terbaru ada di Railway PG

TAHAP 5 - SWITCH:
[ ] Rollback URL NeonDB disimpan di tempat aman
[ ] DATABASE_URL diupdate di Railway
[ ] DIRECT_URL diupdate di Railway
[ ] App redeploy berhasil (status ACTIVE)
[ ] Website bisa diakses
[ ] Login berfungsi
[ ] Data tampil normal

TAHAP 6 - MONITORING:
[ ] 1 jam: Cek website normal
[ ] 24 jam: Cek tidak ada error
[ ] 7 hari: NeonDB bisa di-delete
```

---

*Dokumen panduan ini dibuat untuk migrasi production yang aman. Ikuti setiap langkah secara berurutan dan JANGAN skip verifikasi.*
