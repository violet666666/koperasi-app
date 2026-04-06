# 🛠️ LAPORAN KERJA: CATATAN BUG, PERBAIKAN & FITUR BARU

**Sistem:** PRIMKOPPOL RESOR LUMAJANG — Aplikasi Manajemen Koperasi
**Terakhir Diperbarui:** 7 April 2026 (Sesi 8 — Timezone WIB, KPI Fix, Unit-Specific Columns)
**Pemelihara Dokumen:** Engineering Team

> Dokumen ini adalah satu-satunya sumber kebenaran (Source of Truth) untuk semua perubahan, perbaikan bug, dan penambahan fitur pada sistem. Gunakan sebagai referensi sebelum melakukan debugging ulang agar tidak terjadi pekerjaan redundan.

---

## 📑 DAFTAR ISI CEPAT

| ID | Judul | Status | Tanggal |
|----|-------|--------|---------|
| BUG-001 | Halaman Detail Pinjaman Data Hardcoded | ✅ FIXED | Apr 2026 |
| BUG-002 | CRUD Kas & Bank — Belum Ada Edit/Hapus | ✅ FIXED | Apr 2026 |
| BUG-003 | Tombol Titik Tiga Hilang di HP | ✅ FIXED | Apr 2026 |
| BUG-004 | Inbox Approval Kosong & Tab Riwayat Crash | ✅ FIXED | Apr 2026 |
| BUG-005 | Kolom Angsuran Ke- Selalu 0 | ✅ FIXED | Apr 2026 |
| BUG-006 | Fitur Cetak Kartu Hilang | ✅ FIXED | Apr 2026 |
| BUG-007 | Approval Kosong & Dashboard Data Acak | ✅ FIXED | Apr 2026 |
| BUG-008 | Limit Pinjaman 20 Juta Tidak Dikunci | ✅ FIXED | Apr 2026 |
| BUG-009 | Buku Anggota Selalu Data Hardcoded | ✅ FIXED | Apr 2026 |
| BUG-010 | Sinkronisasi Laporan SHU & Non-SP | ✅ FIXED | Apr 2026 |
| BUG-011 | Disparitas Saldo Kas vs Buku Kas | ✅ FIXED | Apr 2026 |
| BUG-012 | Data Simpanan Tak Tampil | ✅ FIXED | Apr 2026 |
| BUG-013 | Laporan Pinjaman Kosong | ✅ FIXED | Apr 2026 |
| **BUG-BUILD-001** | **npm run build EPERM — Dev server mengunci Prisma DLL** | ✅ FIXED | 6 Apr 2026 |
| **BUG-BUILD-002** | **TS2322: metadata null di validate/route.ts** | ✅ FIXED | 6 Apr 2026 |
| **BUG-BUILD-003** | **TS18047: e.description possibly null di operational-expense** | ✅ FIXED | 6 Apr 2026 |
| **BUG-BUILD-004** | **TS2307: unit-layanan/kasir page missing (stale .next cache)** | ✅ FIXED | 6 Apr 2026 |
| **BUG-CRIT-001** | **Data UAT masuk ke Production DB (1 ApprovalRequest bocor)** | ✅ FIXED + CLEANED | 6 Apr 2026 |
| **BUG-LOGIC-001** | **No. Referensi Approval generate random — seharusnya dari No. Transaksi** | ✅ FIXED | 6 Apr 2026 |
| **BUG-LOGIC-002** | **Format No. Transaksi tidak informatif (random base-36)** | ✅ FIXED | 6 Apr 2026 |
| **BUG-BUILD-005** | **TS2339: session.user.role?.name tidak valid (string bukan object)** | ✅ FIXED | 6 Apr 2026 |
| **BUG-TZ-001** | **Dashboard "Hari Ini" menampilkan data kemarin (UTC vs WIB)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-KPI-001** | **Total Hari Ini ≠ Tunai + QRIS di dashboard admin unit** | ✅ FIXED | 7 Apr 2026 |
| **BUG-NAV-001** | **Sidebar "Pengaturan QRIS" masih tampil di semua Admin Unit** | ✅ FIXED | 7 Apr 2026 |
| **BUG-UI-001** | **Kolom Dok. di riwayat transaksi selalu kosong/tidak berguna** | ✅ REMOVED | 7 Apr 2026 |
| **BUG-UI-002** | **Tabel riwayat transaksi sama untuk semua unit (Cuci Mobil format)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-LAPORAN-001** | **Laporan Toko tidak menampilkan data (timezone dateFrom salah)** | ✅ FIXED | 7 Apr 2026 |
| **FEAT-007** | **Edit Plat Nomor & Keterangan di riwayat transaksi (Admin/Operator)** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **FEAT-008** | **Upload foto bukti pengeluaran operasional di laporan unit** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **FEAT-009** | **Submit Laporan ke Inbox Operator (workflow review laporan unit)** | ✅ IMPLEMENTED | 7 Apr 2026 |

---

## 🔴 BUG-CRIT-001 — Data UAT Masuk ke Production Database

**Tanggal ditemukan:** 6 April 2026 | **Status:** ✅ FIXED + DATA CLEANED

**Gejala:** User menemukan 1 `ApprovalRequest` dengan description mengandung teks "UAT Final E2E" di database production Neon.

**Investigasi:**

- Production DB: Neon PostgreSQL (`ep-blue-rain-a1m11cd0.neon.tech`) — berbeda dari staging
- Staging DB: Supabase (`xlxrjlcnhvtvgkbmrfkm.supabase.co`) — berbeda
- Data UAT bukan dari sesi UAT terbaru kita (staging port 3001)
- Record dibuat tanggal **5 April 2026** oleh user production `admintoko@koperasi.com`
- Terjadi karena **sesi UAT sebelumnya** (sebelum staging disiapkan) dijalankan langsung di port default (3000) tanpa isolasi env

**Root Cause:** Sesi UAT pada 5 April berjalan di server production (port 3000, `.env` Neon), bukan di server staging.

**Data yang terkontaminasi:**

- 1x `ApprovalRequest`: `VD-TOKO-1775417610387-BLS` (status: pending) ← **DELETED**
- 1x `StoreSale.metadata.voidPending` flag di `TK-20260406-MNM5Q5XI` ← **RESET**
- 0x UAT user, 0x UAT transactions

**Solusi & Pencegahan:**

1. Cleanup data dilakukan via Node.js script langsung ke production DB
2. **Protocol UAT Wajib:** Selalu jalankan `$env:DATABASE_URL` dari `.env.test.local` SEBELUM `npm run dev -- -p 3001`
3. Verifikasi URL dengan `npx prisma db execute --stdin <<< "SELECT current_database()"` sebelum mulai UAT
4. Tag semua transaksi UAT dengan prefix `[UAT-TEST]` di description agar mudah cleanup

## 🔧 BUG-LOGIC-001 — No. Referensi Approval Generate Random

**Tanggal:** 6 April 2026 | **Status:** ✅ FIXED

**File:** `src/app/api/unit-transactions/void-request/route.ts`

**Gejala:** Tabel Inbox Approval menampilkan No. Referensi berformat `VD-TOKO-1775417610387-BLS` yang tidak terhubung dengan No. Transaksi asli. Di dalam dialog detail juga tampil No. Transaksi yang berbeda. Kasir tidak bisa langsung tahu mana yang terhubung ke transaksi mana.

**Root Cause:** `requestNo` di-generate fresh (`Date.now() + random`) tanpa referensi ke nomor transaksi asli.

**Solusi:** Ubah format `requestNo` menjadi `VOID-{originalTransactionNo}`. Contoh: `VOID-CM06042026001`. Dengan ini, staf langsung tahu approval ini terkait dengan transaksi mana.

## 🔧 BUG-LOGIC-002 — Format No. Transaksi Tidak Informatif

**Tanggal:** 6 April 2026 | **Status:** ✅ FIXED

**File:** `src/app/api/unit-layanan/sales/route.ts`

**Gejala:** Format lama: `CUC-MNMKU4YG` — random base-36 tidak bisa dibaca manusia, tidak ada tanggal, tidak ada nomor urut hari.

**Solusi:** Format baru: `(Singkatan Unit)(DDMMYYYY)(Nomor Urut 4 Digit)`. Contoh:

- `CM060420260001` = Cuci Mobil, 6 April 2026, transaksi ke-1 hari itu
- `BB060420260003` = Barbershop, 6 April 2026, transaksi ke-3
- `TK060420260012` = Toko, 6 April 2026, transaksi ke-12

Nomor urut di-query dari count transaksi hari ini per unit type, sehingga sekuensial dan mudah audit.

## 🔧 BUG-BUILD-005 — TS2339: session.user.role?.name tidak valid

**Tanggal:** 6 April 2026 | **Status:** ✅ FIXED

**File:** `src/app/api/unit-transactions/[id]/member/route.ts`

**Gejala:** `Property 'name' does not exist on type 'string'` — `session.user.role` adalah `string`, bukan object.

**Solusi:** Ubah ke `(session.user as any).role ?? session.user.role`.

---

## 🔧 BUG-BUILD-001 — EPERM: Dev server mengunci Prisma DLL

**Tanggal:** 6 April 2026  
**Status:** ✅ FIXED

**Gejala:** `npm run build` gagal dengan error `EPERM: operation not permitted, rename query_engine-windows.dll.node`

**Root Cause:** Dev server (`npm run dev`) masih berjalan di background dan mengunci file DLL Prisma, mencegah Prisma generate overwrite file tersebut.

**Solusi:** Terminate dev server sebelum menjalankan build.

## 🔧 BUG-BUILD-002 — TS2322: null metadata filter Prisma tidak type-safe

**Tanggal:** 6 April 2026  
**Status:** ✅ FIXED

**File:** `src/app/api/unit-transactions/validate/route.ts`

**Gejala:** `Type 'null' is not assignable to type 'InputJsonValue | FieldRef<StoreSale, Json> | JsonNullValueFilter | undefined'`

**Root Cause:** `metadata: { path: ["isVoided"], equals: null }` tidak valid sebagai Prisma JSON filter type.

**Solusi:** Hapus filter JSON path yang tidak type-safe dari query aggregate. Gunakan `??` operator untuk optional chaining pada `_sum`.

## 🔧 BUG-BUILD-003 — TS18047: description possibly null

**Tanggal:** 6 April 2026  
**Status:** ✅ FIXED

**File:** `src/app/api/unit/[slug]/operational-expense/route.ts` baris 154

**Gejala:** `'e.description' is possibly 'null'` saat memanggil `.replace()` langsung.

**Solusi:** Gunakan `(e.description ?? "").replace(...)` untuk safe null coalescing.

## 🔧 BUG-BUILD-004 — TS2307: Stale .next cache validator

**Tanggal:** 6 April 2026  
**Status:** ✅ FIXED

**Gejala:** `.next/types/validator.ts` referensi ke file page yang sudah dihapus/dipindah (`unit-layanan/kasir`).

**Solusi:** `Remove-Item -Recurse -Force .next` untuk clear stale cache, kemudian rebuild.

---

| BUG-014 | Dashboard Navigation Links Salah | ✅ FIXED | Apr 2026 |
| BUG-015 | Saldo Buku Kas Minus Ratusan Juta (Import) | ✅ FIXED | Apr 2026 |
| BUG-016 | Buku Kas Default Filter Kosong | ✅ FIXED | Apr 2026 |
| BUG-017 | Data Import Maret Masuk ke Tahun 2005 | ✅ FIXED | Apr 2026 |
| BUG-018 | Laporan SHU Kosong / Tidak Realtime | ✅ FIXED | Apr 2026 |
| BUG-019 | Kas Toko Tidak Masuk Buku Kas | ✅ FIXED | 4 Apr 2026 |
| BUG-020 | Stok Masuk Silent Bug (TODO Placeholder) | ✅ FIXED | 4 Apr 2026 |
| BUG-021 | Penjualan Kredit Tidak Membuat Piutang | ✅ FIXED | 4 Apr 2026 |
| BUG-022 | Race Condition Nomor Penjualan (saleNo) | ✅ FIXED | 4 Apr 2026 |
| BUG-023 | Dashboard Tidak Hitung Pendapatan Toko | ✅ FIXED | 4 Apr 2026 |
| BUG-024 | Limit Fetch Non-SP Hanya 100 Data | ✅ FIXED | 4 Apr 2026 |
| BUG-025 | Label Duplikat NRP di Transaksi Unit | ✅ FIXED | 4 Apr 2026 |
| BUG-026 | COA Expand/Collapse Tidak Berfungsi | ✅ FIXED | 4 Apr 2026 |
| BUG-027 | Pencarian COA Hanya Tampil Level-1 | ✅ FIXED | 4 Apr 2026 |
| BUG-028 | Settings Halaman Data Hardcoded | ✅ FIXED | 4 Apr 2026 |
| BUG-029 | Tombol Backup Tampilkan Toast Palsu | ✅ FIXED | 4 Apr 2026 |
| BUG-030 | Privilege Escalation Kasir → Operator | ✅ FIXED | 5 Apr 2026 |
| BUG-031 | Kasir Toko Masuk ke Kasir Cepat | ✅ FIXED | 5 Apr 2026 |
| BUG-032 | Permission kasir_pos Tidak Ada di DB | ✅ FIXED | 5 Apr 2026 |
| BUG-033 | Type Definition unitType Hilang | ✅ FIXED | 5 Apr 2026 |
| BUG-034 | NextAuth Session Lockout Kasir | ✅ FIXED | 5 Apr 2026 |
| BUG-035 | Grafik Arus Kas Hardcoded | ✅ FIXED | 5 Apr 2026 |
| BUG-036 | Link Semua Riwayat Toko Salah URL | ✅ FIXED | 5 Apr 2026 |
| BUG-037 | Riwayat Toko Tidak Tampil (StoreSale vs UnitTransaction) | ✅ FIXED | 5 Apr 2026 |
| BUG-038 | QRIS Tidak Bisa Di-Upload Kasir | ✅ FIXED | 5 Apr 2026 |
| BUG-039 | Build Fail: Next.JS 16 Turbopack Errors | ✅ FIXED | 5 Apr 2026 |
| BUG-040 | Cabang Bisa Ditambah (Single-Entity Violation) | ✅ FIXED | 5 Apr 2026 |
| BUG-041 | Admin Unit Bisa Akses Modul Pusat | ✅ FIXED | 5 Apr 2026 |
| BUG-042 | Portal Simpan/Pinjam Anggota Blank | ✅ FIXED | 5 Apr 2026 |
| BUG-043 | Void POS — Payload transactionNo Salah | ✅ FIXED | 5 Apr 2026 |
| BUG-044 | Admin Unit Sidebar Sama dengan Operator | ✅ FIXED | 5 Apr 2026 |
| BUG-045 | Kasir Cepat: Failed to Process Quick Sale (P2003) | ✅ FIXED | 5 Apr 2026 |
| BUG-046 | Tabungan Wajib Tidak Tampil di Portal Simpanan | ✅ FIXED | 5 Apr 2026 |
| BUG-047 | Void Toko (POS-) Ditolak Server | ✅ FIXED | 5 Apr 2026 |
| BUG-048 | Operator Diminta Persetujuan Admin saat Void | ✅ FIXED | 5 Apr 2026 |
| BUG-049 | Sidebar: Riwayat Transaksi → Halaman Input | ✅ FIXED | 5 Apr 2026 |
| BUG-050 | Kasir POS: "Halaman Tidak Tersedia Untuk Unit Anda" | ✅ FIXED | 5 Apr 2026 |
| BUG-051 | Void Gagal untuk Role Admin | ✅ FIXED | 5 Apr 2026 |
| BUG-052 | Paket Cuci Mobil Keterangan Tidak Lengkap | ✅ FIXED | 5 Apr 2026 |
| BUG-053 | Button QRIS Overflow di Mobile | ✅ FIXED | 5 Apr 2026 |
| BUG-054 | Admin Unit Tidak Bisa Dipilihkan unitType (Form User) | 🔴 OPEN | 5 Apr 2026 |
| BUG-055 | Admin Dibebaskan dari Blokade Middleware (proxy.ts) | 🔴 OPEN | 5 Apr 2026 |
| BUG-056 | Halaman /settings Bocor ke Admin Unit (Reset Data, Backup) | 🔴 OPEN | 5 Apr 2026 |
| BUG-057 | Shared POS Dropdown: Satu Halaman untuk Semua Unit Jasa | 🔴 OPEN | 5 Apr 2026 |
| BUG-058 | Paket Layanan Unit Jasa Hardcoded (Hanya Carwash & Barbershop) | 🔴 OPEN | 5 Apr 2026 |
| BUG-059 | Kasir Toko Tidak Bisa Mengajukan Void (Langsung 403) | 🔴 OPEN | 5 Apr 2026 |
| BUG-060 | Tidak Ada Dedicated Sidebar untuk Admin Unit | 🔴 OPEN | 5 Apr 2026 |
| FEAT-001 | POS Multi-Unit (Kasir Cepat Jasa) | ✅ DONE | 5 Apr 2026 |
| FEAT-002 | Void System + Contra-Entry + SHA256 | ✅ DONE | 5 Apr 2026 |
| FEAT-003 | Limit Piutang Real-time (Core Banking) | ✅ DONE | 5 Apr 2026 |
| FEAT-004 | DatePeriodFilter Engine (8 Modul) | ✅ DONE | 5 Apr 2026 |
| FEAT-005 | POS Fullscreen Mode | ✅ DONE | 5 Apr 2026 |
| FEAT-006 | Mobile Auto-Lock Unit Kasir | ✅ DONE | 5 Apr 2026 |
| FEAT-007 | Ekspor PDF & Excel Universal | ✅ DONE | 5 Apr 2026 |
| FEAT-008 | Auto-Detect Unit Kasir dari Session | ✅ DONE | 5 Apr 2026 |
| FEAT-009 | QRIS Dialog Intercept saat Bayar | ✅ DONE | 5 Apr 2026 |
| FEAT-010 | Filter Unit pada Riwayat Transaksi | ✅ DONE | 5 Apr 2026 |
| FEAT-011 | Upload/CRUD QRIS per Unit (Dashboard Admin) | ✅ DONE | 5 Apr 2026 |

---

# 🔴 BUG SEBELUM UAT (Pra-Testing)

## BUG-001 — Halaman Detail Pinjaman Data Hardcoded

**Lokasi:** `src/app/(protected)/pinjaman/[id]/page.tsx`
**Gejala:** Halaman selalu menampilkan data dummy "Budi Santoso" tanpa terhubung database.
**Akar Masalah:** Template UI belum pernah disambungkan ke API/database oleh pembuat awal.
**Resolusi:** Dihapus total kode palsu, disambungkan ke real API dengan fetch berdasarkan `id`.

## BUG-002 — CRUD Kas & Bank Belum Ada Edit/Hapus

**Lokasi:** `src/app/(protected)/kas-bank/kas/page.tsx`, `src/app/api/cash-bank/transactions/[id]`
**Gejala:** Tidak ada tombol Edit atau Hapus pada tabel transaksi kas/bank.
**Resolusi:** Implementasi cascading recalculation — saat hapus/edit, sistem menghitung ulang seluruh `balanceBefore` dan `balanceAfter` transaksi yang mengikuti.

## BUG-003 — Tombol Titik Tiga Hilang di HP

**Lokasi:** `src/components/patterns/data-table.tsx`
**Gejala:** Kolom aksi (titik tiga) tersembunyi karena horizontal scroll tabel.
**Resolusi:** Injeksi CSS `sticky right-0 bg-background shadow z-10` pada kolom Action.

## BUG-004 — Inbox Approval Kosong & Tab Riwayat Crash

**Lokasi:** `src/app/api/approvals/route.ts`, `src/components/ui/status-badge.tsx`
**Gejala:** Data approval kosong; halaman riwayat crash.
**Akar Masalah:** 3 isu: (1) Vercel cache statis; (2) Field mapping salah (`type` vs `requestType`); (3) StatusBadge crash pada status tidak dikenal.
**Resolusi:** `force-dynamic`, perbaikan field mapping, tambah fallback status.

## BUG-005 — Kolom Angsuran Ke- Selalu 0

**Lokasi:** `src/app/(protected)/pinjaman/page.tsx`
**Gejala:** Kolom "Angsuran Ke" selalu 0 untuk data import Excel.
**Akar Masalah:** Import data tidak membuat `LoanSchedule` — hanya `Loan` saja.
**Resolusi:** Logika 3 tahap (schedule → principalPaid/installment → clamp ke tenor).

## BUG-006 — Fitur Cetak Kartu Hilang dari Dropdown Anggota

**Lokasi:** `src/app/(protected)/anggota/page.tsx`
**Resolusi:** Opsi "Cetak Kartu" ditambahkan ke dropdown aksi tabel anggota.

## BUG-007 — Approval Kosong & Dashboard Data Acak

**Lokasi:** `src/app/api/approvals/route.ts`
**Gejala:** 100 transaksi cair menenggelamkan 2 transaksi pending.
**Resolusi:** Backend filter `?status=pending`; Frontend panggil dua API paralel.

## BUG-008 — Limit Pinjaman 20 Juta Tidak Dikunci

**Lokasi:** `src/app/api/mobile/loan-apply/route.ts`, `src/app/portal/pengajuan-pinjaman/page.tsx`
**Resolusi:** Hardcoded max 20 juta dan max 36 bulan di level API dan UI.

## BUG-009 — Buku Anggota Selalu Data Hardcoded

**Lokasi:** `src/app/(protected)/anggota/buku/page.tsx`, `src/app/api/members/book/route.ts`
**Resolusi:** Dibuat endpoint API baru yang gabungkan SavingsAccount + Loans menjadi General Ledger tunggal.

## BUG-010 — Laporan SHU & Sinkronisasi Non-SP

**Lokasi:** `src/app/api/non-sp/*`, `src/app/(protected)/laporan/*`
**Gejala:** Non-SP fiktif; rekap kosong; bunga salah label; Dashboard crash.
**Resolusi:** Hapus mock data, buat API baru berbasis Jurnal Buku Besar, fix extraction layer.

## BUG-011 — Disparitas Saldo Kas vs Buku Kas

**Gejala:** `/kas-bank/kas` vs `/kas-bank/buku-kas` menampilkan saldo berbeda.
**Resolusi:** Perbaiki API `/api/cash-bank/book` — hitung `openingBalance` dari seluruh histori transaksi sebelum periode.

## BUG-012 — Data Simpanan Tidak Tampil

**Resolusi:** Generate 828 rekening Simpanan Wajib otomatis; fix data extraction frontend.

## BUG-013 — Laporan Pinjaman & Jadwal Kosong

**Resolusi:** Generate 7.811 `LoanSchedule` dari 278 pinjaman aktif; fix double-wrapping Axios.

## BUG-014 — Dashboard Navigation Links Salah

**Resolusi:** Update href StatsCard: "Anggota" → `/anggota`, "Simpanan" → `/simpanan/rekap`.

## BUG-015 — Saldo Buku Kas Minus Ratusan Juta (Import Excel)

**Gejala:** Buku Kas menampilkan saldo awal `-Rp 191 juta` setelah import.
**Akar Masalah:** 3 faktor: (1) Baris "saldo awal" di-skip; (2) Tanggal kosong default hari ini; (3) `new Date("2")` → tahun 2001.
**Resolusi:** Regex year dari sheet name; angka hari diparse langsung; baris saldo awal dipasang di tanggal -1.

## BUG-016 — Buku Kas Default Filter Kosong

**Gejala:** Buku Kas selalu "tidak ada transaksi" saat dibuka (filter default bulan berjalan kosong).
**Resolusi:** Tambah opsi "Semua Bulan", ubah default ke `month=all`.

## BUG-017 — Data Import Maret Masuk ke Tahun 2005

**Gejala:** Transaksi Maret tercatat di tahun 2005 karena sheet berisi teks "RAT 2005".
**Resolusi:** Filter regex year — hanya tahun dalam jarak ±2 dari tahun sekarang yang diterima.

## BUG-018 — Laporan SHU Kosong

**Gejala:** Total SHU, Pendapatan, Beban semua 0.
**Akar Masalah:** Backend hanya hitung dari `JournalLine` yang kosong (belum ada penjurnalan).
**Resolusi:** Fallback ke `CashBankTransaction` + `StoreSale` jika JournalLine 0.

---

# 🔴 BUG KRITIS — 4 APRIL 2026

## BUG-019 — Kas Penjualan Toko Tidak Masuk Buku Kas

**Lokasi:** `src/app/api/toko/sales/route.ts`
**Gejala:** Checkout tunai di Toko tidak menambah saldo Kas/Bank.
**Akar Masalah:** API hanya buat Journal Entry — tidak buat `CashBankTransaction`.
**Resolusi:** Ditambahkan blok sinkronisasi kas setelah deduct stok.

## BUG-020 — Stok Masuk Silent Bug (TODO Placeholder)

**Lokasi:** `src/app/(protected)/toko/persediaan/page.tsx`, `src/app/api/toko/products/[id]/stock/route.ts` (baru)
**Gejala:** Form Stok Masuk tampilkan `toast.success` tapi tidak ada data tersimpan.
**Akar Masalah:** Kode hanya berisi komentar `// TODO`.
**Resolusi:** Buat API baru `POST .../stock`, update UI untuk memanggil API tersebut.

## BUG-021 — Penjualan Kredit Tidak Membuat Piutang

**Lokasi:** `src/app/api/toko/sales/route.ts`
**Gejala:** Pembelian kredit (potong gaji) tidak muncul di modul piutang.
**Resolusi:** Buat `UnitTransaction` dengan `isPaid: false` untuk setiap transaksi kredit.

## BUG-022 — Race Condition Nomor Penjualan

**Lokasi:** `src/app/api/toko/sales/route.ts`
**Gejala:** 2 kasir checkout bersamaan → `saleNo` sama → unique constraint error.
**Resolusi:** Ganti `count() + 1` dengan `Date.now()` + random string.

## BUG-023 — Dashboard Tidak Hitung Pendapatan Toko

**Lokasi:** `src/app/api/dashboard-stats/route.ts`
**Resolusi:** Tambahkan query `StoreSale` ke dalam hitungan statistik harian.

## BUG-024 — Limit Fetch Non-SP Hanya 100 Data

**Lokasi:** `src/app/api/non-sp/penerimaan/route.ts`, `non-sp/pengeluaran/route.ts`
**Resolusi:** Implementasi pagination proper (`page` & `perPage`) menggantikan `take: 100`.

## BUG-025 — Label Duplikat NRP di Transaksi Unit

**Lokasi:** `src/app/(protected)/transaksi-unit/page.tsx` baris 380
**Resolusi:** Label baris ke-2 diubah dari "NRP" menjadi "No. Anggota".

## BUG-026 — Bagan Akun COA Expand/Collapse Tidak Berfungsi

**Lokasi:** `src/app/(protected)/master/coa/page.tsx`
**Akar Masalah:** `Collapsible` tanpa `CollapsibleContent`.
**Resolusi:** Ganti dengan native button toggle state `isOpen`.

## BUG-027 — Pencarian COA Hanya Tampil Level-1

**Lokasi:** `src/app/(protected)/master/coa/page.tsx`
**Resolusi:** Pindahkan logika filter ke dalam masing-masing `AccountNode`.

## BUG-028 — Halaman Settings Data Hardcoded

**Lokasi:** `src/app/(protected)/settings/page.tsx`
**Gejala:** `useEffect` hanya delay 500ms lalu set nilai mock.
**Resolusi:** Fetch dari `/api/settings/cooperative`; simpan ke localStorage.

## BUG-029 — Tombol Backup Toast Palsu

**Lokasi:** `src/app/(protected)/settings/page.tsx`
**Gejala:** Tombol Backup tampilkan sukses padahal tidak ada yang di-backup.
**Resolusi:** Ganti dengan `toast.info` yang jujur menginstruksikan backup via hosting panel.

---

# 🔴 BUG RBAC & POS — 5 APRIL 2026

## BUG-030 — Privilege Escalation: Kasir → Akses Operator

**Status:** ✅ FIXED
**Lokasi:** `prisma/seed-fix-permissions.ts`, `src/lib/constants/navigation.ts`, `src/app/(protected)/layout.tsx`
**Gejala:** Role Kasir dapat mengakses fitur keuangan inti seperti simpanan, pinjaman, approval.
**Resolusi:** (1) Seed reset permissions kasir ke 2 poin saja; (2) Navigation dual-filter: role + unitType; (3) Whitelist route guard berdasar unitType; (4) Role-aware dashboard.

## BUG-031 — Kasir Toko Masuk ke Kasir Cepat

**Status:** ✅ FIXED
**Lokasi:** `src/lib/constants/navigation.ts`, `src/lib/validations/index.ts`, `src/app/api/users/[id]/route.ts`, `src/app/(protected)/master/users/page.tsx`
**Gejala:** Login kasir Toko → sidebar Kasir Cepat (tanpa stok/barcode).
**Akar Masalah:** 5 lapisan: navigation tidak cek unitType; schema Zod buang unitType; PUT handler users tidak ada; UI tidak ada dropdown unitType; nama hardcoded.
**Resolusi:** Buat `kasirTokoNavigation` khusus; update schema; buat handler PUT; tambah dropdown unit di master users.

## BUG-032 — Permission kasir_pos Tidak Ada di DB

**Status:** ✅ FIXED
**Lokasi:** `src/lib/constants/navigation.ts`
**Gejala:** Semua menu dengan permission `kasir_pos` tidak pernah muncul.
**Resolusi:** Ganti `kasir_pos` → `manage_toko` (kasirToko) dan `manage_unit_transactions` (kasirNavigation).

## BUG-033 — Type Definition unitType Hilang

**Status:** ✅ FIXED
**Lokasi:** `src/types/index.ts`, `src/components/patterns/sidebar.tsx`
**Gejala:** Race condition; `unitType` tidak terbawa ke frontend meski ada di JWT.
**Resolusi:** Update interface User; sidebar baca langsung via `useSession()`.

## BUG-034 — NextAuth Session Lockout Kasir

**Status:** ✅ FIXED
**Lokasi:** `src/lib/hooks/use-auth.tsx`
**Gejala:** Kasir terjebak redirect loop setelah login.
**Resolusi:** Mapping `unitType: session.user.unitType || null` ke AuthContext.

## BUG-035 — Grafik Arus Kas Dashboard Hardcoded

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/dashboard-stats/route.ts`, `src/components/patterns/cash-flow-chart.tsx`
**Resolusi:** Query GroupBy bulanan `CashBankTransaction` 7 bulan terakhir; Chart menjadi prop dinamis.

## BUG-036 — Link "Semua" Riwayat Toko Salah URL

**Status:** ✅ FIXED
**Lokasi:** `src/components/patterns/kasir-dashboard.tsx`
**Resolusi:** Kondisi href: `unitType === "toko" ? "/transaksi-unit/riwayat?unitType=toko" : "/transaksi-unit/riwayat"`.

## BUG-037 — Riwayat Toko Tidak Tampil (StoreSale Terpisah)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/route.ts`, `src/app/api/unit-layanan/stats/route.ts`
**Gejala:** Grafik dan riwayat terbaru kosong untuk kasir Toko meski transaksi ada.
**Akar Masalah:** Stats API query hanya `UnitTransaction`, tidak menyertakan `StoreSale`.
**Resolusi:** Detect `unitType === "toko"` → query paralel ke kedua tabel → merge & sort descending.

## BUG-038 — QRIS Tidak Bisa Di-Upload Kasir (Akses Settings Terblokir)

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/settings/page.tsx`
**Gejala:** Kasir diblokir total dari Settings sehingga tidak bisa upload QRIS.
**Resolusi:** Kasir hanya bisa melihat tab QRIS di Settings; semua tab lain disembunyikan.

## BUG-039 — Build Fail: Next.JS 16 Turbopack

**Status:** ✅ FIXED
**Masalah:** `middleware` deprecated; ESLint config deprecated; `metadataBase` tidak set.
**Resolusi:** Migrasi `middleware.ts` → `proxy.ts`; hapus eslint config dari `next.config.ts`; set `metadataBase`.

## BUG-040 — Cabang Bisa Ditambah (Single-Entity Violation)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/master/branches/route.ts`
**Gejala:** Admin bisa buat cabang baru yang memecah ledger koperasi.
**Resolusi:** Hard-lock 403 di `POST /api/master/branches` dan `DELETE .../[id]`. `branchId: 1` static.

## BUG-041 — Admin Unit Bisa Akses Modul Pusat (SP, Approval)

**Status:** ✅ FIXED
**Lokasi:** `src/proxy.ts` (Next.js middleware)
**Resolusi:** Logika isolasi rute eksekutif per `unitType` ditanamkan di layer middleware.

## BUG-042 — Portal Simpan/Pinjam Anggota Blank

**Status:** ✅ FIXED
**Lokasi:** Portal member pages
**Akar Masalah:** `export const dynamic = "force-dynamic"` di Client Component; `memberId null` → 401.
**Resolusi:** Hapus directives server-side; tambah Error State Card.

## BUG-043 — Void POS Payload transactionNo Salah

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`
**Gejala:** Void selalu error "transactionNo wajib diisi" meski form diisi.
**Resolusi:** Ubah payload dari `id: selectedTx.id` menjadi `transactionNo: selectedTx.transactionNo`.

---

# 🟡 BUG UAT FASE 1–4 — 5 APRIL 2026

## BUG-044 — Admin Unit Sidebar Sama dengan Operator

**Status:** ✅ FIXED
**Lokasi:** `src/lib/constants/navigation.ts`
**Gejala:** Login sebagai Admin Unit Cuci Mobil → sidebar identik dengan Operator (ada modul SP, Aset, Jurnal).
**Resolusi:** Update `getNavigationForUser()` — Admin unit non-pusat diarahkan ke `kasirNavigation` (jasa) atau `kasirTokoNavigation` (toko).

## BUG-045 — Kasir Cepat Failed to Process Quick Sale (P2003)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-layanan/sales/route.ts`
**Gejala:** Transaksi gagal dengan Foreign Key Constraint Error pada `createdById`.
**Akar Masalah:** `auth()` tidak dipanggil di awal; `currentUserId` tidak tersedia saat buat record.
**Resolusi:** Pindah `auth()` ke baris pertama; fallback ke kas pusat jika kas unit tidak ada; parseInt session user id.

## BUG-046 — Tabungan Wajib Tidak Tampil di Portal Simpanan

**Status:** ✅ FIXED
**Lokasi:** `src/app/portal/simpanan/page.tsx`
**Gejala:** Total saldo dashboard menunjukkan angka benar, tapi card Tabungan Wajib tidak muncul.
**Akar Masalah:** Sumber data berbeda — `tabunganWajib` ada di objek `member`, bukan di `savingsAccount`.
**Resolusi:** Inject card statis yang membaca `response.data.member.tabunganWajib` secara langsung.

## BUG-047 — Void Toko (saleNo POS-xxx) Ditolak Server

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts`
**Gejala:** API void selalu error "transaksi tidak ditemukan" untuk ID bertipe POS-xxx.
**Akar Masalah:** API hanya mencari di tabel `UnitTransaction`, tidak mendeteksi tabel `StoreSale` untuk transaksi toko.
**Resolusi:** Deteksi prefix `POS-` / `TK-` / `TS-` → arahkan ke `StoreSale` → kembalikan stok produk → mark voided di metadata.

## BUG-048 — Operator Diminta Persetujuan Admin saat Void

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts`
**Gejala:** Role `OPERATOR` tetap masuk alur `pending_void` dan diminta persetujuan Admin.
**Resolusi:** Operator langsung mendapat Auto-Approve → buat Contra-Entry dengan SHA256 security hash → status jadi `voided` tanpa pending.

---

# 🟡 BUG UAT FASE 5–6 — 5 APRIL 2026

## BUG-049 — Sidebar: Menu Riwayat Transaksi Mengarah ke Halaman Input

**Status:** ✅ FIXED
**Lokasi:** `src/lib/constants/navigation.ts` (`kasirNavigation`)
**Gejala:** Klik "Riwayat Transaksi" di sidebar → masuk ke `/transaksi-unit` (Form Input Transaksi).
**Akar Masalah:** `href: "/transaksi-unit"` seharusnya `href: "/transaksi-unit/riwayat"`.
**Resolusi:** Update href + tambahkan item "Pengaturan" ke menu Akun kasir.

## BUG-050 — Kasir POS: "Halaman Tidak Tersedia Untuk Unit Anda"

**Status:** ✅ FIXED
**Lokasi:** `src/components/patterns/kasir-dashboard.tsx`
**Gejala:** Klik tombol "Buka Kasir POS" dari dashboard Admin Unit → error access denied.
**Akar Masalah:** `posLink` di-generate dinamis ke `/{unitType}/kasir` (misal `/cuci-mobil/kasir`) yang tidak ada route-nya.
**Resolusi:** Kembalikan `posLink = "/unit-layanan/kasir"` — halaman tersebut sudah auto-lock `unitType` dari sesi.

## BUG-051 — Void Transaksi Gagal untuk Role Admin

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts`
**Gejala:** Admin unit memilih Void → "Gagal mengajukan void transaksi".
**Akar Masalah:** `isOperator` check tidak mencakup role `admin`.
**Resolusi:** Tambah `session.user.role === "admin"` ke kondisi isOperator — admin pun dapat bypass langsung.

## BUG-052 — Paket Cuci Mobil Keterangan Tidak Lengkap

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit-layanan/kasir/page.tsx`
**Gejala:** Paket hanya menampilkan "Mobil Kecil (Avanza, Xenia, dll)" — tidak ada keterangan resmi.
**Resolusi:** Update `CARWASH_PACKAGES` dengan field `keterangan` resmi:

- Motor: Motor Bebek, Matic, Sport (Rp 15.000)
- Mobil Kecil (Small): Agya, Ayla, Brio, Jazz (Rp 35.000)
- Mobil Sedang (Medium): Avanza, Xenia, Ertiga (Rp 40.000)
- Mobil Besar (Large): Innova, Fortuner, Pajero (Rp 45.000)
- Mobil XL: Hiace, Elf, Alphard, Minibus (Rp 50.000)

## BUG-053 — Button QRIS Overflow di Mobile

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit-layanan/kasir/page.tsx`
**Gejala:** Tombol "Bayar QRIS" terpotong / overflow di layar kecil.
**Resolusi:** Ubah layout `grid grid-cols-2` → `flex flex-col sm:flex-row` untuk responsivitas.

---

# ✅ FITUR BARU YANG DIIMPLEMENTASIKAN

## FEAT-001 — POS Multi-Unit (Kasir Cepat Jasa)

**Tanggal:** 5 Apr 2026
**File Baru:** `src/app/(protected)/unit-layanan/kasir/page.tsx`, `src/app/api/unit-layanan/sales/route.ts`
**Deskripsi:** Sistem POS sederhana untuk unit jasa (Cuci Mobil, Barbershop, PS, Fitness, dll) tanpa perlu master stok. Mendukung 3 metode bayar: Tunai, QRIS, Potong Gaji.

## FEAT-002 — Void System + Contra-Entry + SHA256

**Tanggal:** 5 Apr 2026
**File:** `src/app/api/unit-transactions/void-request/route.ts`, `src/app/api/unit-transactions/void-approve/route.ts`
**Deskripsi:** Penghapusan diganti alur Void (Kasir → pending_void → Admin approve → Contra-Entry). Setiap contra-entry dilindungi SHA256 hash untuk audit trail.

## FEAT-003 — Limit Piutang Real-time (Core Banking 3-Layer)

**Tanggal:** 5 Apr 2026
**File:** `src/app/api/unit-transactions/validate/route.ts`
**Deskripsi:** Sebelum kasir proses "Potong Gaji", sistem validasi total hutang semua unit vs plafon anggota. Tombol merah dan blokir API jika melebihi limit.

## FEAT-004 — DatePeriodFilter Engine (8 Modul)

**Tanggal:** 5 Apr 2026
**Deskripsi:** Filter tanggal (Hari ini / Minggu ini / Bulan ini / Custom range) ditanamkan ke 8 modul: Kas, Bank, Simpanan, Pinjaman, Non-SP Masuk/Keluar, Kwitansi, Transaksi Unit. Data di-fetch semua (perPage=9999), filter dilakukan client-side.

## FEAT-005 — POS Fullscreen Mode

**Tanggal:** 5 Apr 2026
**Deskripsi:** Tombol "Mode POS" pada kasir web memanggil `document.documentElement.requestFullscreen()` untuk imersi layar penuh saat operasional.

## FEAT-006 — Mobile Auto-Lock Unit Kasir

**Tanggal:** 5 Apr 2026
**File:** `mobile/src/screens/kasir/KasirScreen.tsx`
**Deskripsi:** Aplikasi mobile membaca `unitType` dari SecureStore → menghilangkan chip selector unit → tampilkan badge statis unit kasir.

## FEAT-007 — Ekspor PDF & Excel Universal

**Tanggal:** 5 Apr 2026
**File:** `src/lib/export-utils.ts`
**Deskripsi:** Utility ekspor terintegrasi ke Laporan SHU, Arus Kas, Kwitansi, Riwayat Transaksi Unit. Mendukung format Excel (XLSX) dan PDF A4.

## FEAT-008 — Auto-Detect Unit Kasir dari Session

**Tanggal:** 5 Apr 2026
**Deskripsi:** Halaman `/unit-layanan/kasir` otomatis membaca `userUnitType` dari session. Kasir terkunci ke unit mereka; Admin/Operator bisa pilih unit dari dropdown.

## FEAT-009 — QRIS Dialog Intercept saat Bayar

**Tanggal:** 5 Apr 2026
**Deskripsi:** Saat kasir tekan "Bayar QRIS", muncul modal dialog yang menampilkan gambar barcode QRIS per unit dari `/uploads/qris/qris-{unitType}.png`. Kasir konfirmasi setelah pelanggan scan.

## FEAT-010 — Filter Unit pada Riwayat Transaksi

**Tanggal:** 5 Apr 2026
**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`
**Deskripsi:** Dropdown pilih unit tersedia untuk Operator (Semua, Cuci Mobil, Barbershop, dll). Kasir/Admin Unit secara otomatis dikunci ke unit mereka dengan Badge non-interaktif.

## FEAT-011 — Upload/CRUD QRIS per Unit (Dashboard Admin)

**Tanggal:** 5 Apr 2026
**File Baru:** `src/app/api/unit-layanan/qris/route.ts`
**File Diubah:** `src/components/patterns/kasir-dashboard.tsx`
**Deskripsi:** Card "Kelola QRIS" muncul di dashboard Admin Unit. Modal upload/preview/delete gambar QRIS. File disimpan ke `/public/uploads/qris/qris-{unitType}.png`.
**Validasi:** Tipe file PNG/JPG/WebP; maks. 2MB; path traversal protection.

---

# 🔐 CATATAN KEAMANAN PENTING

## RBAC Berlapis (Selesai)

1. **Database**: Permissions kasir diminimalkan ke 2 hak akses
2. **Navigation**: Dual-filter `role` + `unitType` di `navigation.ts`
3. **Route Guard**: Whitelist method berdasar `unitType` di `proxy.ts`
4. **API Level**: Setiap API endpoint validasi `session.user.role` dan `unitType`

## Anti-Manipulasi Transaksi

- Tidak ada fitur Delete transaksi kasir; hanya Void
- Setiap void menghasilkan Contra-Entry dengan `securityHash` SHA256
- Audit trail tetap utuh

## Single-Entity Lock

- POST `/api/master/branches` → 403 Forbidden permanent
- `branchId: 1` selalu static untuk semua transaksi

---

# 📋 CATATAN TEKNIS

## Stack Teknologi

- **Frontend**: Next.js 16 (App Router), TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Next.js Route Handlers, Prisma ORM
- **Database**: PostgreSQL (via Vercel Postgres)
- **Auth**: NextAuth.js v5
- **Mobile**: React Native (Expo)

## Konvensi Penting

- `export const dynamic = "force-dynamic"` wajib di semua API route yang tidak boleh di-cache
- `perPage: 9999` digunakan di semua query list untuk mendukung DatePeriodFilter client-side
- `unitType` kasir ada di JWT session → dipetakan via `useSession()` bukan `useAuth()` untuk menghindari race condition
- Prefiks ID transaksi: `UL-` (Unit Layanan), `POS-` / `TK-` / `TS-` (Toko StoreSale), `CE-` (Contra-Entry Void)

## File-File Kritis (Jangan Ubah Tanpa Konsultasi)

| File | Alasan |
|------|--------|
| `src/lib/constants/navigation.ts` | Mengontrol akses sidebar seluruh role |
| `src/proxy.ts` | Route guard middleware — salah konfigurasi → lockout |
| `src/lib/auth.ts` | Session JWT mapping |
| `prisma/schema.prisma` | Skema database — perubahan butuh migrasi |
| `src/app/api/unit-transactions/void-request/route.ts` | Logika void terpusat untuk semua unit |

---

# 🔴 BUG DITEMUKAN DARI BRAINSTORM — 5 APRIL 2026 (Malam)

## BUG-054 — Admin Unit Tidak Bisa Dipilihkan unitType (Form User)

**Status:** 🔴 OPEN
**Lokasi:** `src/app/(protected)/master/users/page.tsx` baris 161
**Gejala:** Saat membuat/mengedit user dengan Role `admin`, dropdown pemilihan Unit Usaha sama sekali tidak muncul. Hanya role `kasir` yang bisa dipilihkan unitnya.
**Akar Masalah:** Kondisi hardcode `isKasirRole ? (formData.unitType || null) : null` memaksa `unitType` selalu NULL untuk semua role selain kasir.
**Akibat Nyata:** Semua Admin tidak pernah terikat ke unit manapun → diperlakukan sebagai Admin Global → mendapat sidebar Operator penuh → bisa mengakses `/settings`, reset data, dll.
**Resolusi (Direncanakan):** Buka dropdown `unitType` juga untuk role `admin`. Tambahkan validasi wajib isi unitType jika role adalah `admin` atau `kasir`.

## BUG-055 — Admin Dibebaskan dari Blokade Akses Finansial (Middleware)

**Status:** 🔴 OPEN
**Lokasi:** `src/proxy.ts` baris 122
**Gejala:** Admin Cuci Mobil bisa mengakses langsung URL `/pinjaman`, `/kas-bank`, `/laporan`, `/master` tanpa diblokir.
**Akar Masalah:** Kondisi middleware `userRole !== "admin"` membebaskan semua role admin dari blokade finansial — yang seharusnya hanya berlaku untuk Operator.
**Resolusi (Direncanakan):** Hapus pengecualian `admin` dari whitelist. Jika `admin` punya `unitType`, perlakukan seperti kasir (blokir semua rute finansial kecuali `/approval` dan halaman unitnya sendiri).

## BUG-056 — Halaman /settings Bocor ke Admin Unit (Tab Reset Data & Backup)

**Status:** 🔴 OPEN
**Lokasi:** `src/app/(protected)/settings/page.tsx` baris 280–314
**Gejala:** Admin mana pun (termasuk Admin Cuci Mobil) dapat membuka halaman `/settings` dan melihat Tab: General, Keamanan, Backup & Restore, dan Tab Reset Data yang bisa menghapus seluruh database sistem.
**Akar Masalah:** Kondisi penyembunyi tab hanya menyaring role `kasir`. Role `admin` tidak difilter.
**Resolusi (Direncanakan):** Ubah kondisi penyembunyi tab agar hanya `operator` yang bisa melihat Tab berbahaya. Admin Unit hanya boleh melihat Tab QRIS (dan ke depannya dipindah ke sidebar masing-masing unit).

## BUG-057 — Shared POS Dropdown: Satu Halaman untuk Semua Unit Jasa

**Status:** 🔴 OPEN
**Lokasi:** `src/app/(protected)/unit-layanan/kasir/page.tsx`
**Gejala:** Satu halaman kasir digunakan bersama untuk Cuci Mobil, Barbershop, Fitness, Playstation, dsb. Admin/Operator bisa mengganti unit via dropdown. Ini membuka risiko salah pencatatan pembukuan ke unit yang salah.
**Akar Masalah:** Desain arsitektur "Shared POS" yang tidak mencerminkan standar aplikasi Enterprise.
**Akibat:** Sistem terlihat seperti prototipe/proyek tugas. Tidak ada dedicated URL, tidak ada branding unit yang tegas.
**Resolusi (Direncanakan):** Buat halaman POS mandiri per unit via Dynamic Route `/unit/[unitSlug]/kasir`. Hapus halaman sharing `/unit-layanan/kasir`.

## BUG-058 — Paket Layanan Unit Jasa Hardcoded (Hanya Carwash & Barbershop)

**Status:** 🔴 OPEN
**Lokasi:** `src/app/(protected)/unit-layanan/kasir/page.tsx` baris 33–55
**Gejala:** Hanya Carwash dan Barbershop yang punya daftar paket. Unit lain (Fitness, Playstation, Properti, dll) tidak memiliki paket preset sama sekali — kasirnya harus mengetik harga manual setiap transaksi.
**Akar Masalah:** Paket layanan ditulis langsung (*hardcode*) di dalam kode sebagai konstanta TypeScript, bukan diambil dari database.
**Akibat:** Admin unit tidak bisa mengubah harga layanan tanpa menyentuh source code. Sangat tidak profesional dan tidak scalable.
**Resolusi (Direncanakan):** Buat tabel database `UnitServicePackage`. Buat halaman admin "Kelola Layanan & Harga" per unit. API endpoint CRUD paket.

## BUG-059 — Kasir Toko Tidak Bisa Mengajukan Void (Langsung Error 403)

**Status:** 🔴 OPEN
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts` baris 38–40
**Gejala:** Kasir Toko menekan tombol "Void/Batal" pada transaksi → sistem langsung menolak dengan pesan "Hanya Operator yang dapat mengambil tindakan void".
**Akar Masalah:** Kode mengecek `if (!isOperator) return 403` untuk semua transaksi Toko (StoreSale), tanpa memberikan jalan alternatif bagi Kasir untuk mengajukan permintaan (Pending Void).
**Resolusi (Direncanakan):** Ubah logika — jika bukan Operator, jangan 403, tapi buatkan `ApprovalRequest` dengan status `pending`. Admin unit bisa approve/reject dari Inbox-nya.

## BUG-060 — Tidak Ada Dedicated Sidebar untuk Admin Unit

**Status:** 🔴 OPEN
**Lokasi:** `src/lib/constants/navigation.ts` fungsi `getNavigationForUser()`
**Gejala:** Admin Unit (misal Admin Cuci Mobil) menerima navigasi dari `kasirNavigation` yang identik dengan kasir biasa — tanpa menu Inbox Approval, tanpa Kelola Layanan, tanpa QRIS.
**Akar Masalah:** Tidak ada konstanta navigasi `adminTokoNavigation` maupun `adminUnitNavigation`. Fungsi `getNavigationForUser()` tidak membedakan Kasir vs Admin untuk unit non-pusat.
**Resolusi (Direncanakan):** Buat dua konstanta navigasi baru. Update `getNavigationForUser()` agar Admin unit Retail mendapat `adminTokoNavigation` dan Admin unit Jasa mendapat `adminUnitNavigation`.

### [2026-04-06] Perbaikan Bug UAT Kasir Unit Jasa Penuh

1. **BUG-U03 (Kelola Layanan Crash - 500 Error)**: Memperbaiki crash di `LayananUnitPage` di mana object `params` diakses secara sinkron (membawa behavior dari Next.js 14). Diperbaiki dengan meng-unwrap `params` menggunakan `React.use(params)`. ([unitSlug]/layanan/page.tsx).
2. **BUG-U04 (Void Request Tidak Ada Action)**: Terdapat disfungsi tombol "Setujui" pada Inbox Approval bagi Admin Unit. Transaksi bertipe `"unit_void"` salah memanggil body API (menggunakan `approvalId` untuk key dan text string `approve` bukan expected `approved`). Diperbaiki di backend services dan ApprovalDialog.

## BUG-061 — Void Kasir Toko Membuahkan Foreign Key Constraint (500)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts`
**Gejala:** Kasir Toko klik Void, sistem melempar 500 internal error di *backend* karena backend mencoba *insert* record persetujuan dengan `branchId: 1`. Sementara cabang yang terdaftar di database cloud hanya memiliki ID `10`.
**Resolusi:** Data fallback `branchId` disesuaikan dari pola *hardcoded* (1) menjadi (10).

## BUG-062 — Kasir Riwayat Mengabaikan Pesan Error dari Server (False Positive)

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`
**Gejala:** Meski server menghasilkan error 500 (akibat BUG-061), toast notifikasi di *browser* menyembunyikan error dan menampilkan teks *hardcoded* "Pengajuan void berhasil dikirim. Menunggu persetujuan Admin". Ini menyesatkan QA/User seolah-olah pengajuan masuk, padahal gagal total.
**Resolusi:** Menambahkan handler untuk me-*throw* nilai error API yang sesungguhnya ke layer antarmuka jika `res.ok` bermasalah, dan mem-passing respon berhasil langsung dari server.

## BUG-063 — Admin Unit Mem-Bypass Alur Persetujuan Void Sendiri

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/void-request/route.ts`
**Gejala:** Saat "Admin Toko" menguji coba menu Void, alih-alih masuk daftar `Inbox Approval`, sistem langsung mendaulat transaksi batal. Tiket Void tidak muncul.
**Akar Masalah:** Kondisi `isOperator` membebaskan siapapun dengan `role === "admin"`.
**Resolusi:** `admin` dikeluarkan dari pengecualian bypass. Kini pembuatan dan pengunggahan Void akan serempak diikat lewat `ApprovalRequest` untuk disiplin administratif.

---

*Dokumen ini diperbarui terakhir: 5 April 2026, 22:55 WIB*
*Total bug tercatat: 60 | Total fitur baru: 11*

---

## [2026-04-06] Audit & Perbaikan Alur POTONG GAJI

### BUG-P01 — Stok Toko Tidak Berkurang Saat Transaksi Potong Gaji

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/toko/sales/route.ts` baris 235–244
**Gejala:** Stock deduction menggunakan `stock` (gudang) bukan `stockToko` (toko fisik) — menyebabkan stok toko tidak turun setelah checkout.
**Resolusi:** Prioritaskan pengurangan `stockToko` jika > 0, fallback ke `stock` gudang.

### BUG-P02 — Tidak Ada Validasi Plafon Piutang di Unit Layanan

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-layanan/sales/route.ts`
**Gejala:** Kasir Cuci Mobil bisa proses Potong Gaji meski limit piutang anggota sudah 0. Server tidak memblokir.
**Penyebab:** Tidak ada query validasi plafon sebelum membuat UnitTransaction untuk `salary_cut`.
**Resolusi:** Tambah validasi server-side agregat `UnitTransaction + StoreSale` vs `plafonPiutang` sebelum membuat transaksi.

### BUG-P03 — Member Tidak Divalidasi di Unit Layanan

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-layanan/sales/route.ts`
**Gejala:** Hanya cek `memberId` null, tidak verifikasi member ada di DB → 500 error jika `memberId` invalid.
**Resolusi:** Tambah `prisma.member.findUnique` sebelum proses transaksi.

### BUG-P04 — Double-Count Piutang Saat Validasi Plafon Toko

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/toko/sales/route.ts` baris 109–126
**Gejala:** Validasi plafon Toko menghitung `UnitTransaction + StoreSale` — padahal checkout Toko akan membuat `UnitTransaction` baru, sehingga tagihan dihitung 2x dari StoreSale.
**Resolusi:** Hapus query `StoreSale` dari validasi plafon Toko. Hanya hitung dari `UnitTransaction` saja sebagai sumber kebenaran piutang.

### BUG-D01 — Dashboard Counter "Potong Gaji Pending" Tidak Akurat (Ikut Hitung Voided)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-layanan/stats/route.ts` baris 74
**Gejala:** Container "Potong Gaji — N Pending" di dashboard Admin masih muncul meski transaksi sudah di-void atau pending_void.
**Penyebab:** Filter hanya `isPaid === false` tanpa exclude `status === 'voided'` atau `status === 'pending_void'`.
**Resolusi:** Filter `todayPending` dan `todaySalaryCut` sekarang exclude `voided` dan `pending_void`. Tambah counter `pendingVoid` terpisah.

## [2026-04-06] Fitur Baru

### FEAT-012 — Filter Status Riwayat Transaksi Unit

**Tanggal:** 6 Apr 2026
**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`
**Deskripsi:** Dropdown filter status ditambahkan di halaman Riwayat Transaksi Unit: Semua / Lunas / Belum Lunas (Piutang) / Pending Void / Dibatalkan. Filter bekerja client-side untuk kecepatan.

### FEAT-013 — Edit NRP Anggota pada Riwayat Transaksi (Admin & Operator)

**Tanggal:** 6 Apr 2026
**File:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`, `src/app/api/unit-transactions/[id]/member/route.ts`
**Deskripsi:** Tombol Edit (✏️) muncul di kolom Aksi untuk transaksi yang belum memiliki anggota terkait. Hanya Admin Unit (di unitnya) atau Operator yang dapat menggunakan. Dialog input NRP dengan auto-detect seperti POS Kasir. Audit log dicatat setiap perubahan.

### FEAT-014 — Validasi Limit Piutang Realtime di Dialog Potong Gaji (Unit Layanan)

**Tanggal:** 6 Apr 2026
**File:** `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx`
**Deskripsi:** Saat Admin memilih anggota di dialog Potong Gaji unit, sistem langsung fetch data plafon, tagihan aktif, dan sisa limit. Tombol "Proses Potong Gaji" diblokir jika sisa limit tidak mencukupi.

### BUG-UI-003 — Kontras Button "Tambah Layanan" Sangat Rendah

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit/[unitSlug]/layanan/page.tsx` baris 145-148
**Gejala:** Tombol "Tambah Layanan" menggunakan class `bg-gemini-blue` tanpa Tailwind Theme yang mendefinisikannya, sehingga button menjadi sangat putih dan menyatu dengan background. 
**Resolusi:** Merubah class menjadi standar UI kit yaitu `bg-primary text-primary-foreground` serta `text-primary`.

### FEAT-015 — CRUD Pengeluaran Operasional Unit

**Tanggal:** 7 Apr 2026
**File:** `src/app/api/unit/[slug]/operational-expense/[id]/route.ts`, `[unitSlug]/laporan/page.tsx`
**Deskripsi:** Endpoint baru mengakomodir `PUT` dan `DELETE` transaksi buku kas pengeluaran operasional unit. Di panel Rincian Pengeluaran, ditambahkan kolom Aksi. Selain itu, fitur visual *Plat Nomor* juga dipisah ke grid tabel tersendiri dalam HTML Laporan dan Ekspor ke format Excel apabila unitnya merupakan **Cuci Mobil**.

### BUG-UI-004 — Spacing Tabel Laporan Kosong di Tengah (Belah Tengah) & Kaki Tabel Melenceng

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx`
**Gejala:** Pada laporan transaksi, terdapat sela yang sangat luas antar deskripsi ('Keterangan') dan tabel kolom selanjutnya. Hal ini karena teks terpotong oleh `max-w-[220px]` sementara kolom ditarik merangkap *width* responsif. Kedua, total Nominal di kaki tabel ('Total Pendapatan') melenceng ke kiri untuk unit Cuci Mobil.
**Resolusi:** Menghapus pembatasan *max-width* limit tersebut sehingga elemen teks mencair memenuhi sisa table. Memperbaiki atribut statis menjadi dinamis: `colSpan={isCuciMobil ? 8 : 7}` pada empty state dan `colSpan={isCuciMobil ? 7 : 6}` pada tabel ringkasan kaki *(footer)* agar menyesuaikan presisi proporsi tabel.

### BUG-UI-005 — Tombol Bayar QRIS Overflow (Melewati Batas Dialog)

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx`
**Gejala:** Pada modal pop-up QRIS, tombol konfirmasi pembayaran dan batal meluber (*overflow*) ke kanan dan ke kiri layar sehingga melanggar kotak *dialog*.
**Resolusi:** Mengganti pembungkus dari konstruktor bawaan `<DialogFooter>` yang mewarisi class `sm:flex-row sm:space-x-2` dengan `<div>` standard khusus kelas kolumnar vertikal (`flex-col gap-2 w-full`), mencegah konflik `w-full` merentang menjadi 200%.

### BUG-UI-006 — QRIS Stale Cache Setelah Dihapus

**Status:** ✅ FIXED
**Lokasi:** `src/components/patterns/kasir-dashboard.tsx`
**Gejala:** Saat fitur Hapus QRIS dijalankan, sistem berhasil membuang *file* dari *server*, namun UI *dashboard* (ketika pop-up kembali dibuka) tetap menampilkan *file* yang tertinggal dalam memori *cache browser*. Hal ini menimbulkan ilusi bahwa gambar tidak terhapus.
**Resolusi:** Diimplementasikan variabel referensi `imageKey` yang bertugas memperbaharui nilai *URL query parameter* `?bust=${imageKey}` setiap kali berkas dimutakhirkan. Ini memaksa *browser* mengunduh aset terbaru (*cache busting*).

### BUG-UI-007 — Bottleneck Interaksi Utama Ke Frame Selanjutnya (INP Lag) di Kasir

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/unit/[unitSlug]/kasir/page.tsx`
**Gejala:** Nilai metrik INP (*Interaction to Next Paint*) sangat buruk pada layar Kasir ketika tombol "Bayar Tunai" atau "Pelanggan Sudah Membayar" ditekan. Halaman mengalami cegukan (*freeze/lag*) selama sepersekian detik dan animasi transisi menekan tombol tidak tereksekusi dengan mulus.
**Resolusi:** Kesalahan ini muncul karena pemanggilan `setIsProcessing(true)` dan pelepasan status *modal* dilakukan selaras di *main UI thread* bersamaan dengan beban komputasi transaksi berat (blok fungsi rekonsiliasi yang disinkronkan). Diperbaiki dengan menginjeksikan fitur *timeout yield* (`setTimeout`) sebesar 15 milidetik pada pengendali *onClick*. Langkah ini memberi "nafas" pada CPU sistem *browser* untuk me-*render* umpan balik visual transisi tombol/tutup *modal* terlebih dahulu sebelum disandera paksa oleh siklus logika fungsi `processPayment()`.

### BUG-UI-008 — Rekam Jejak Waktu Mundur 1 Hari Buntut Konversi `@db.Date` UTC (Timezone Shift)

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/transaksi-unit/riwayat/page.tsx`, `src/app/api/unit-[...]/route.ts`
**Gejala:** Nilai transaksi baru (misal *CM07042026...*) yang dibuat pada hari ini dini hari / sewaktu-waktu bisa saja terlempar ke tanggal kemarin, misalnya "6 Apr 2026 07:00 WIB".
**Resolusi:** Pada struktur *database*, *field* `transactionDate` disimpan sebagai wujud statis `@db.Date`. Prisma/PostgreSQL otomatis mencukur (*strip*) nilai jam (*Time*) dan menyisakan tanggal saja dalam UTC, yang ekuivalen ke `00:00:00 UTC` alias `07:00:00 WIB` keesokan paginya - mengakibatkan hilangnya akurasi detik waktu lokal. Diatasi dengan mengarahkan seluruh *endpoint* riwayat dan tabel visualnya merujuk pada metrik bayangan yang jauh lebih *rigid*, yaitu properti `createdAt` (bertipe absolut `timestamp`), lalu mengawinkannya dengan wujud waktu peramban lokal agar keakuratannya selaras 1:1.

---

*Total bug tercatat: 71 | Total fitur baru: 15*
*Diperbarui: 7 April 2026*
