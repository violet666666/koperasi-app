# 🛠️ LAPORAN KERJA: CATATAN BUG, PERBAIKAN & FITUR BARU

**Sistem:** PRIMKOPPOL RESOR LUMAJANG — Aplikasi Manajemen Koperasi
**Terakhir Diperbarui:** 8 April 2026 (Sesi 9 — Perbaikan Produk Pinjaman & Portal Pengajuan)
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
| BUG-007 | Skrip Import TAJIB Memasukkan Angka Target Potongan ke Balance Terakhir | ✅ FIXED | Apr 2026 | Mengalihkan Target ke Balance SavingsTransaction |
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
| **BUG-UI-013** | **Isi kolom nominal tidak rata kiri sesuai skeleton** | ✅ FIXED | 7 Apr 2026 |
| **BUG-P05** | **Validasi Gatekeeper Double-Count Piutang (Limit selalu Rp 0)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-065** | **Kolom Input Plafon Piutang/Limit tidak muncul di UI Edit Anggota** | ✅ FIXED | 7 Apr 2026 |
| **BUG-UAT-001** | **Simpanan Transaksi Tambah — Pencarian Anggota Masih Mock Data** | 🔴 OPEN | 7 Apr 2026 |
| **BUG-UAT-002** | **Dashboard Operator — Total Pinjaman Aktif Rp 0 Meski Ada Pinjaman Approved** | 🔴 OPEN | 7 Apr 2026 |
| **BUG-UAT-003** | **Jurnal Umum Tambah Entry — Simulasi setTimeout (Tidak Ke API Real)** | 🔴 OPEN | 7 Apr 2026 |
| **BUG-UAT-004** | **Pengajuan Pinjaman List — Selalu Kosong (response.data.data Bug)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-UAT-005** | **Pengajuan Pinjaman — Kolom Tenor "undefined bulan" (accessor: tenor vs tenorMonths)** | ✅ FIXED | 7 Apr 2026 |
| **BUG-TZ-002** | **Laporan Unit — Filter "Hari Ini" Menampilkan Tanggal kemarin (UTC display tanpa WIB timezone)** | ✅ FIXED | 7 Apr 2026 |
| **FEAT-017** | **Laporan Unit — Total Pendapatan hanya di akhir cetak + Total Pengeluaran di tabel ops** | ✅ IMPLEMENTED | 7 Apr 2026 |
| **BUG-TZ-003** | **Data tanggal 6 April masuk juga pada filtering Hari Ini (Postgres @db.Date timezone coercion)** | ✅ FIXED | 7 Apr 2026 |


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
| BUG-020 | Stok Masuk Silent Bug (TODO Placeholder) | ✅ FIXED | 4 Apr 2026 |
| BUG-021 | Penjualan Kredit Tidak Membuat Piutang | ✅ FIXED | 4 Apr 2026 |
| BUG-022 | Race Condition Nomor Penjualan (saleNo) | ✅ FIXED | 4 Apr 2026 |
| BUG-024 | Limit Fetch Non-SP Hanya 100 Data | ✅ FIXED | 4 Apr 2026 |
| BUG-025 | Label Duplikat NRP di Transaksi Unit | ✅ FIXED | 4 Apr 2026 |
| BUG-026 | COA Expand/Collapse Tidak Berfungsi | ✅ FIXED | 4 Apr 2026 |
| BUG-027 | Pencarian COA Hanya Tampil Level-1 | ✅ FIXED | 4 Apr 2026 |
| BUG-028 | Settings Halaman Data Hardcoded | ✅ FIXED | 4 Apr 2026 |
| BUG-029 | Tombol Backup Tampilkan Toast Palsu | ✅ FIXED | 4 Apr 2026 |
| BUG-030 | Privilege Escalation Kasir → Operator | ✅ FIXED | 5 Apr 2026 |
| BUG-032 | Permission kasir_pos Tidak Ada di DB | ✅ FIXED | 5 Apr 2026 |
| BUG-033 | Type Definition unitType Hilang | ✅ FIXED | 5 Apr 2026 |
| BUG-034 | NextAuth Session Lockout Kasir | ✅ FIXED | 5 Apr 2026 |
| BUG-035 | Grafik Arus Kas Hardcoded | ✅ FIXED | 5 Apr 2026 |
| BUG-038 | QRIS Tidak Bisa Di-Upload Kasir | ✅ FIXED | 5 Apr 2026 |
| BUG-039 | Build Fail: Next.JS 16 Turbopack Errors | ✅ FIXED | 5 Apr 2026 |
| BUG-040 | Cabang Bisa Ditambah (Single-Entity Violation) | ✅ FIXED | 5 Apr 2026 |
| BUG-041 | Admin Unit Bisa Akses Modul Pusat | ✅ FIXED | 5 Apr 2026 |
| BUG-042 | Portal Simpan/Pinjam Anggota Blank | ✅ FIXED | 5 Apr 2026 |
| BUG-043 | Void POS — Payload transactionNo Salah | ✅ FIXED | 5 Apr 2026 |
| BUG-044 | Admin Unit Sidebar Sama dengan Operator | ✅ FIXED | 5 Apr 2026 |
| BUG-045 | Kasir Cepat: Failed to Process Quick Sale (P2003) | ✅ FIXED | 5 Apr 2026 |
| BUG-046 | Tabungan Wajib Tidak Tampil di Portal Simpanan | ✅ FIXED | 5 Apr 2026 |
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

## BUG-060 — Tidak Ada Dedicated Sidebar untuk Admin Unit

**Status:** 🔴 OPEN
**Lokasi:** `src/lib/constants/navigation.ts` fungsi `getNavigationForUser()`
**Gejala:** Admin Unit (misal Admin Cuci Mobil) menerima navigasi dari `kasirNavigation` yang identik dengan kasir biasa — tanpa menu Inbox Approval, tanpa Kelola Layanan, tanpa QRIS.
**Akar Masalah:** Tidak ada konstanta navigasi `adminTokoNavigation` maupun `adminUnitNavigation`. Fungsi `getNavigationForUser()` tidak membedakan Kasir vs Admin untuk unit non-pusat.
**Resolusi (Direncanakan):** Buat dua konstanta navigasi baru. Update `getNavigationForUser()` agar Admin unit Retail mendapat `adminTokoNavigation` dan Admin unit Jasa mendapat `adminUnitNavigation`.

### [2026-04-06] Perbaikan Bug UAT Kasir Unit Jasa Penuh

1. **BUG-U03 (Kelola Layanan Crash - 500 Error)**: Memperbaiki crash di `LayananUnitPage` di mana object `params` diakses secara sinkron (membawa behavior dari Next.js 14). Diperbaiki dengan meng-unwrap `params` menggunakan `React.use(params)`. ([unitSlug]/layanan/page.tsx).
2. **BUG-U04 (Void Request Tidak Ada Action)**: Terdapat disfungsi tombol "Setujui" pada Inbox Approval bagi Admin Unit. Transaksi bertipe `"unit_void"` salah memanggil body API (menggunakan `approvalId` untuk key dan text string `approve` bukan expected `approved`). Diperbaiki di backend services dan ApprovalDialog.

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

### BUG-UI-006 — Usang/Stale View pada Gambar QRIS Setelah Diperbarui (Cache Issue)

**Status:** ✅ FIXED
**Lokasi:** `src/components/patterns/kasir-dashboard.tsx`
**Gejala:** Setelah pengguna sukses mengklik tombol "Ganti QRIS" dan mengunggah gambar baru, gambar PRatinjau (Preview) tidak berubah bila *browser* masih menyimpan *cache* gambar di direktori `/uploads/qris/...`.
**Resolusi:** Memperbarui parameter `src` pada tag `<img />` di Kasir Dashboard dengan metode *Cache Busting*: Menginjeksikan `?v=${imageKey}` pada *query string* URL gambar, dengan fungsi *React State* khusus `setImageKey(Date.now())` yang menyala ketika proses fungsi unggah QRIS terselesaikan di sisi *backend*. Ini memaksa struktur HTML untuk mengabaikan *cache cache control* pada browser Anda dan merekuisis *file* segar.

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

### BUG-UI-009 — Restriksi Direktori dan Blind Error pada Fitur Kelola QRIS (Vercel Serverless Read-Only)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-layanan/qris/route.ts`, `prisma/schema.prisma`
**Gejala:** Pesan lambat "Gagal mengunggah QRIS" / "Gagal menghapus" pada Produksi karena arsitektur *serverless* milik Vercel memblokir fungsi modifikasi berkas statis (*Read-Only File System*).
**Resolusi:** Mengubah fundamental struktur penyimpanan gambar QRIS dari *File System* lokal bawaan Node.js (`/public/uploads/`) menjadi penyimpanan rekam jejak biner *Base64* murni tersentralisasi di *Database* (Tabel `UnitSetting`). 

### BUG-UI-010 — Jeda Interaksi Window Confirm (INP Block) pada Tombol Hapus QRIS

**Status:** ✅ FIXED
**Lokasi:** `src/components/patterns/kasir-dashboard.tsx`
**Gejala:** Metrik interaksi INP mencatat *delay* ekstrim hingga 1,674ms saat tombol "Hapus QRIS" berwarna merah ditekan.
**Resolusi:** Mengamankan eksekusi `window.confirm()` dengan mengisolasinya di dalam blok `setTimeout(..., 50)`. Hal ini mencegah pembekuan *main-thread* UI peramban saat mengeksekusi kotak dialog peringatan natif sistem operasi (Mac/Windows).

### BUG-P05 — Validasi Gatekeeper Double-Count Piutang (Limit Kasir Selalu Rp 0)

**Status:** ✅ FIXED
**Lokasi:** `src/app/api/unit-transactions/validate/route.ts`, `src/app/api/unit-layanan/sales/route.ts`
**Gejala:** Ketika mencoba melayani pembayaran via "Potong Gaji", Dialog Validasi memblokir transaksi dengan pesan "Sisa Limit Piutang Aktif Rp 0", padahal secara riil limit anggota tersebut masih sangat sehat sisa jutaan di Dashboard.
**Akar Masalah:** Kendala ini merupakan sisa kepingan luput dari **BUG-P04** kemarin. Penghapusan double-counting alias penghitungan ganda (mengakumulasi `UnitTransaction + StoreSale` bersamaan) kemarin *hanya* ditambal di `toko/sales`, namun luput ditambal ke dua rute penjaga gerbang utamanya yaitu: `validate` endpoint kasir reaktif dan unit layanan. Akibatnya, plafon tagihan *dummy* masih membengkak ganda mencapai atas batas di mata sistem.
**Resolusi:** Menghapus sepenuhnya blok agresi query ke tabel `StoreSale` dari dalam rute kalkulasi Piutang/Gatekeeper. Entitas yang dihitung kini 100% murni merujuk pada perwujudan final `UnitTransaction`.

### BUG-065 — Kolom Input Plafon Piutang/Limit tidak muncul di UI Edit Anggota

**Status:** ✅ FIXED
**Lokasi:** `src/app/(protected)/anggota/[id]/edit/page.tsx`
**Gejala:** Pelanggan/Anggota tercatat selalu ditolak saat proses kasir karena limit "Plafon Belanja Potong Gaji" memunculkan output nilai `Rp 0`.
**Akar Masalah:** Desain *Database* secara keamanan *zero-trust* mengunci profil member baru agar nilai Limit Kasir bawaan/default disetel presisi ke titik 0 di belakang layar. Untuk bisa berhutang, figur `plafonPiutang` ini **wajib** dikonfigurasi ulang secara otoritatif oleh Operator. Sayangnya, form/kolom input UI untuk profil `plafonPiutang` tersebut secara *Front-end* tertinggal belum dirajut ke formulir halaman utama "Edit Data Anggota", sehingga hal ini menyandera admin untuk tidak berdaya membuka gembok 0 Limit tersebut.
**Resolusi:** Memasukkan *Field* khusus label `"Plafon Piutang Belanja (Limit Kasir)"` di dalam blok form Data Pribadi di antarmuka Edit Anggota sehingga Operator berwenang bisa seketika menetapkan/menurunkan limit kustom dengan leluasa.

## 📋 BUG & FITUR BARU — 7 April 2026 (Sesi 2 — Produk Pinjaman)

---

### BUG-066 — createdById/approvedById Hardcode = 1 di Semua Loan Routes

**Status:** ✅ FIXED  
**Tanggal:** 7 April 2026  
**Severity:** High (Keamanan & Audit Trail)

**Deskripsi:**  
Seluruh endpoint pinjaman menggunakan nilai hardcode `userId = 1` untuk field `createdById`, `approvedById`, dan `rejectedById`. Ini berarti semua aktivitas pinjaman tercatat atas nama user dengan ID=1, membuat audit trail tidak akurat dan tidak bisa melacak siapa sebenarnya yang melakukan aksi.

**Root Cause:**  
Komentar `// TODO: Get from session` ditinggalkan di kode tidak lengkap dari versi awal pengembangan.

**Files Fixed:**
- `src/app/api/loans/applications/route.ts` → `createdById: parseInt(session.user.id)`
- `src/app/api/loans/applications/[id]/approve/route.ts` → `approvedById: parseInt(session.user.id)` + auth guard
- `src/app/api/loans/applications/[id]/reject/route.ts` → `rejectedById: parseInt(session.user.id)` + auth guard

---

### BUG-067 — Validasi Hardcode AD-ART Memblokir Pinjaman Khusus > 20jt

**Status:** ✅ FIXED  
**Tanggal:** 7 April 2026  
**Severity:** Critical (Fitur Utama Tidak Bisa Berjalan)

**Deskripsi:**  
Endpoint `POST /api/loans/applications` memiliki validasi hardcode:
```
const AD_ART_MAX_LOAN = 20000000;
if (data.amount > AD_ART_MAX_LOAN) → reject
const AD_ART_MAX_TENOR_MONTHS = 36;
if (data.tenorMonths > AD_ART_MAX_TENOR_MONTHS) → reject
```
Ini berarti Produk Pinjaman Khusus (Min 30jt, Tenor hingga 60 bln) tidak pernah bisa diproses.

**Fix:** Validasi kini hanya menggunakan atribut dari `LoanProduct` (`minAmount`, `maxAmount`, `minTenorMonths`, `maxTenorMonths`). Tidak ada lagi konstanta hardcode. Jika produk tidak punya `maxAmount` (null), tidak ada batas atas.

---

### FEAT-020 — Produk Pinjaman Reguler & Pinjaman Khusus

**Status:** ✅ IMPLEMENTED  
**Tanggal:** 7 April 2026

**Deskripsi:**  
Implementasi lengkap 2 jenis produk pinjaman dengan kartu pilihan UI, limit per produk, dan simulasi rinci.

**Komponen:**
1. **Seed Script:** `prisma/seed-loan-products.ts`  
   - Pinjaman Reguler (PR): Min 1jt, Maks 20jt, Tenor 1-36 bln
   - Pinjaman Khusus (PK): Min 30jt, No Limit, Tenor 1-60 bln
   - Keduanya dengan bunga 1% flat/bln, biaya resiko 2% di muka
2. **Form Pengajuan UI** (`tambah/page.tsx`):  
   - Kartu pilihan produk interaktif
   - Input amount/tenor di-constrain ke min/max produk
   - Simulasi per hari / per bulan / per tahun untuk bunga 1%
3. **Detail Pengajuan** (`[id]/page.tsx`):  
   - Tombol "Ajukan ke Operator" untuk status draft

---

*Total bug tercatat: 82 | Total fitur baru: 18*  
*Diperbarui: 7 April 2026*

---

## 🔴 BUG-UAT-001 — Simpanan Transaksi Tambah: Pencarian Anggota Masih Mock Data

**Ditemukan:** 7 April 2026 (UAT-OPS-04)  
**Status:** 🔴 OPEN  
**Severity:** Critical (fitur tidak bisa digunakan sama sekali)  
**File:** `src/app/(protected)/simpanan/transaksi/tambah/page.tsx`

**Deskripsi:**
Halaman `/simpanan/transaksi/tambah` masih menggunakan data **hardcoded MOCK** untuk pencarian anggota. Semua data anggota (Budi Santoso, Siti Aminah, Joko Widodo) adalah data fiktif dan **NOT terhubung ke database**. Submit transaksi juga hanya `setTimeout(1000)` simulasi — **tidak ada API call real**.

**Root Cause:**
```typescript
// src/app/(protected)/simpanan/transaksi/tambah/page.tsx
const MOCK_MEMBERS = [
  { id: 1, member_no: "A-001", name: "Budi Santoso", savings_balance: 5000000 },
  { id: 2, member_no: "A-002", name: "Siti Aminah", savings_balance: 3500000 },
  { id: 3, member_no: "A-003", name: "Joko Widodo", savings_balance: 2200000 },
];
// handleSubmit() → await new Promise(resolve => setTimeout(resolve, 1000)) ← TIDAK ADA API!
```

**Fix Diperlukan:**
1. Ganti `MOCK_MEMBERS` dengan API call ke `GET /api/members?search={query}`
2. Ganti `handleSubmit()` dengan `POST /api/savings/transactions`
3. Dropdown Produk Simpanan harus dari `GET /api/savings/products` (bukan hardcoded id 1/2/3)

---

## 🔴 BUG-UAT-002 — Dashboard Operator: Total Pinjaman Aktif Rp 0

**Ditemukan:** 7 April 2026 (Observasi Screenshot Dashboard)  
**Status:** 🔴 OPEN  
**Severity:** Medium (display issue, data ada tapi tidak ditampilkan)  
**Lokasi:** Dashboard card "Total Pinjaman Aktif"

**Deskripsi:**
Dashboard menampilkan "Total Pinjaman Aktif: **Rp 0**" padahal dari UAT sebelumnya terbukti ada pinjaman dengan status `approved` (APP-2026-53224, Rp 3.000.000). Card linked ke `/laporan/rekap-pinjaman`.

**Kemungkinan Root Cause:**
- Query dashboard mungkin menghitung pinjaman dengan status `active` (setelah pencairan/disbursed) bukan `approved`
- Pinjaman APP-2026-53224 mungkin masih status `submitted`/`approved` tapi belum `disbursed`
- Perlu verifikasi query di API dashboard endpoint

**Fix Diperlukan:**
- Cek status pinjaman di DB: apakah `approved` sudah dihitung sebagai "aktif" di dashboard
- Jika perlu, update query dashboard untuk memasukan status `approved` dan `disbursed`

---

## 🔴 BUG-UAT-003 — Jurnal Umum Tambah Entry: Tidak Terhubung API

**Ditemukan:** 7 April 2026 (Code Review — grep setTimeout)  
**Status:** 🔴 OPEN  
**Severity:** High (transaksi jurnal tidak tersimpan ke database)  
**File:** `src/app/(protected)/jurnal/umum/page.tsx` line 128

**Deskripsi:**
Form tambah entri Jurnal Umum juga menggunakan `setTimeout(resolve, 1000)` sebagai simulasi, bukan API call nyata. Jurnal yang "berhasil disimpan" tidak akan tersimpan ke database.

**Fix Diperlukan:**
- Ganti simulasi dengan `POST /api/journal/entries`
- Validasi debit = kredit sebelum submit

---

*Total bug tercatat: 85 | Total fitur baru: 18*  
*Diperbarui: 7 April 2026 — Sesi UAT Operator Fase 1*

## ?? BUG-TZ-003  Data tanggal 6 April masuk juga pada filtering Hari Ini

**Tanggal ditemukan:** 7 April 2026 | **Status:** ? FIXED

**Lokasi:** "src/app/api/unit/[slug]/laporan/route.ts"

**Gejala:** Saat filter "Hari Ini" dipilih (7 April), data dari tanggal 6 April jam 00:00 (dan seterusnya) ikut masuk di halaman /unit/cuci-mobil/laporan.

**Akar Masalah:** 
1. Filter backend menggunakan offset jam UTC (+7 jam) sehingga boundaries menjadi gte: 2026-04-06T17:00:00Z dan lte: 2026-04-07T16:59:59Z.
2. Namun kolom 	ransactionDate untuk pendaftaran jasa/transaksi unit di-mapping sebagai @db.Date pada Prisma schema, yang secara native di Postgres hanya menyimpan bentuk kalender (YYYY-MM-DD).
3. Saat Postgres membandingkan tanggal kalender dengan boundary timestamp dengan zona waktu (2026-04-06T17:00:00Z), Postgres secara otomatis melonggarkan filter / melakukan *coercive timezone cast* ke boundary hari sesuai tanggal kalender yaitu 2026-04-06. Karenanya, transaksi tertanggal 6 April 00:00 terbawa dalam query.

**Solusi:** Memisahkan boundaries Timestamptz dengan Date. Untuk filter tabel yang menggunakan @db.Date, string yang dimasukkan *wajib* dibulatkan sepenuhnya ke boundary UTC: 2026-04-07T00:00:00Z hingga 23:59:59Z, agar Postgres mengeksekusi dengan tanggal lokal kalender yang persis tepat sesuai UI Hari Ini.

---

## 📋 BUG & FITUR BARU — 8 April 2026 (Sesi 9 — Perbaikan Produk Pinjaman)

---

### BUG-068 — API `/api/loans/products` Hardcode Bunga & Resiko (Override Database)

**Status:** ✅ FIXED  
**Tanggal:** 8 April 2026  
**Severity:** Critical (Data UI tidak sesuai database)

**Deskripsi:**  
API `GET /api/loans/products` menimpa nilai bunga (`interest_rate: 1`) dan biaya resiko (`admin_fee_value: 2`) secara hardcode, mengabaikan data yang tersimpan di tabel `LoanProduct` database. Akibatnya, jika Admin mengubah rate dari halaman Master, perubahan tidak pernah tampil di UI.

**File:** `src/app/api/loans/products/route.ts`  
**Fix:** Hapus hardcode. API kini mengembalikan nilai `interestRate` dan `adminFeeValue` langsung dari database. Handle `maxAmount: null` sebagai "Tidak Terbatas".

---

### BUG-069 — API Mobile `/api/mobile/loan-apply` Hardcode Rate & Cap Global 20jt/36bln

**Status:** ✅ FIXED  
**Tanggal:** 8 April 2026  
**Severity:** Critical (Pinjaman Khusus tidak bisa diajukan dari mobile)

**Deskripsi:**  
Endpoint mobile loan apply memiliki 3 masalah kritis:
1. Hardcode `interestRate: 0`, `adminFee: 1%` — mengabaikan data produk
2. `Math.min(maxAmount, 20000000)` — cap global membatasi Pinjaman Khusus ke 20jt
3. `Math.min(maxTenor, 36)` — cap global membatasi tenor ke 36 bulan
4. Validasi AD-ART hardcode `AD_ART_MAX_LOAN = 20000000` dan `AD_ART_MAX_TENOR = 36`

**File:** `src/app/api/mobile/loan-apply/route.ts`  
**Fix:** Hapus semua hardcode. Validasi kini per-produk dari database. Kalkulasi bunga dari `product.interestRate`.

---

### BUG-070 — API Portal `/api/member-portal/loan-application` Hardcode AD-ART Limit

**Status:** ✅ FIXED  
**Tanggal:** 8 April 2026  
**Severity:** Critical (Member portal tidak bisa ajukan Pinjaman Khusus)

**Deskripsi:**  
Endpoint portal anggota memiliki validasi hardcode:
```
AD_ART_MAX_LOAN = 20000000 → reject jika amount > 20jt
AD_ART_MAX_TENOR_MONTHS = 36 → reject jika tenor > 36 bulan
```
Padahal validasi per-produk sudah diterapkan di baris sebelumnya (lines 48-63). Validasi ganda ini memblokir Pinjaman Khusus.

**File:** `src/app/api/member-portal/loan-application/route.ts`  
**Fix:** Hapus validasi AD-ART hardcode. Validasi per-produk (sudah ada) menjadi satu-satunya gatekeeper.

---

### BUG-071 — API Master `/api/master/loan-products` POST Blokir Tenor > 36

**Status:** ✅ FIXED  
**Tanggal:** 8 April 2026  
**Severity:** High (Admin tidak bisa buat/edit Pinjaman Khusus 60 bulan)

**Deskripsi:**  
Endpoint POST untuk membuat produk pinjaman baru memiliki validasi:
```
if (data.maxTenorMonths > 36) → reject "tenor maksimal 36 bulan"
```
Ini mencegah Admin membuat Produk Pinjaman Khusus yang memiliki tenor 60 bulan.

**File:** `src/app/api/master/loan-products/route.ts`  
**Fix:** Hapus pembatasan tenor global. Tenor limit kini product-specific (Reguler: 36, Khusus: 60).

---

### BUG-072 — Portal Pengajuan Pinjaman: Produk Tidak Tampil & Field Mismatch

**Status:** ✅ FIXED  
**Tanggal:** 8 April 2026  
**Severity:** Critical (Halaman pengajuan pinjaman portal tidak berfungsi)

**Deskripsi:**  
Halaman `/portal/pengajuan-pinjaman` memiliki 5 masalah kritis:
1. **Field name mismatch:** API `/api/master/loan-products` mengembalikan `minTenorMonths`, `maxTenorMonths`, `minAmount` (Decimal/string). UI mengharapkan `minTenor`, `maxTenor`, `maxAmount` (number). Akibatnya produk gagal di-parse dan tidak tampil.
2. **Produk tersembunyi:** Selector produk disembunyikan sebagai `<input type="hidden">`. Member tidak bisa memilih produk.
3. **Hardcode limit 20jt/36bln:** Input amount dicap keras ke Rp 20.000.000, input tenor dicap keras ke 36 bulan — menghalangi Pinjaman Khusus.
4. **Bunga salah:** Estimasi bunga dihitung 0.3% padahal seharusnya 1% flat/bulan.
5. **Biaya admin salah:** Ditampilkan "Biaya Jasa 1%" padahal seharusnya "Biaya Resiko 2%".

**File:** `src/app/portal/pengajuan-pinjaman/page.tsx`  
**Fix:**
- Normalize field names dari Prisma camelCase ke interface (`minTenorMonths` → `minTenor`, Decimal → Number)
- Tampilkan kartu pilihan produk (selectable cards dengan info limit, tenor, bunga, resiko)
- Limit amount/tenor dinamis sesuai produk yang dipilih
- Bunga dan biaya resiko dihitung dari data produk aktual
- Tambah kalkulasi "Dana Cair (Bersih)" = nominal - biaya resiko

---

### FEAT-021 — Seed Data Produk Pinjaman Accurate (Pinjaman Reguler & Khusus)

**Status:** ✅ IMPLEMENTED  
**Tanggal:** 8 April 2026

**Deskripsi:**  
Update data seed produk pinjaman agar sesuai aturan bisnis terbaru:

| Produk | Min Amount | Max Amount | Tenor | Bunga | Resiko |
|--------|-----------|-----------|-------|-------|--------|
| **Pinjaman Reguler (PR)** | Rp 0 | Rp 20.000.000 | 1–36 bln | 1% flat/bln | 2% di muka |
| **Pinjaman Khusus (PK)** | Rp 30.000.000 | Tidak Terbatas | 1–60 bln | 1% flat/bln | 2% di muka |

**File:** `prisma/seed-loan-products.ts`, `prisma/seed.ts`  
**Eksekusi:** Seed berhasil dijalankan ke production database.

---

### BUG-074 (8 April 2026) - Data "Pencairan Hari Ini" di Dashboard Menampilkan Nominal Penarikan Simpanan
**Masalah:** Kartu statistik "Pencairan Hari Ini" di Dashboard (yang deskripsinya menjelaskan tentang pencairan *loan/pinjaman*) justru menampilkan nominal dari "Penarikan Simpanan Sukarela".
**Investigasi:** Terdapat *salah mapping payload*. Interface frontend `pencairanHariIni` diisi dengan data dari `todayWithdrawals` (yang diambil dari agregasi transaksi simpanan bertipe "withdrawal"). Belum ada agregasi untuk *pencairan pinjaman* yang mengarah ke tanggal pencairan (`disbursementDate`) pada tabel `Loan`.
**Solusi:** Menambahkan agregasi sum baru `todayLoanDisbursements` untuk tabel `Loan` berdasarkan `disbursementDate`, memastikan nilainya merepresentasikan uang kelar untuk pinjaman, lalu memetakan ulang nilai tersebut pada file `page.tsx` Dashboard.
**File:** 
- `/src/app/api/dashboard-stats/route.ts`
- `/src/app/(protected)/dashboard/page.tsx`

---

*Total bug tercatat: 89 | Total fitur baru: 21*  
*Diperbarui: 8 April 2026 — Sesi 9*

### [FIX] Update Produk Pinjaman Gagal Tersimpan
**File:** `src/app/api/master/loan-products/[id]/route.ts`
**Masalah:** Mengubah LIMIT Pinjaman, Tenor, dan Admin Fee pada halaman /master/produk-pinjaman terlihat berhasil di layar (Toast sukses), namun setelah refresh nilainya kembali ke awal. API Endpoint PUT hanya memfilter field tertentu dan mengabaikan nilai minAmount, salah mapping maxTenorMonths, dan lupa dminFeeValue.
**Solusi:** Membongkar ulang parameter update prisma.loanProduct.update dan menyuntikkan seluruh parsing payload yang sah: minAmount, maxAmount, minTenorMonths, maxTenorMonths, dminFeeType, dminFeeValue dari *request body*.

---

### BUG-075 (9 April 2026) - Void Pinjaman Build Error (Import Usang)
**File:** `src/app/api/loans/[id]/void/route.ts`
**Masalah:** Fitur endpoint void pinjaman baru yang dibuat menyebabkan Turbopack build failed dengan 2 error setelah deploy:
1. `import { getServerSession } from "next-auth"` � getServerSession tidak lagi diekspor oleh versi Auth.js terbaru yang digunakan.
2. `import { authOptions } from "@/lib/auth"` � uthOptions tidak diekspor dari uth.ts, karena project menggunakan pola NextAuth v5 baru yaitu export const { auth }.
3. params bertipe { id: string } (non-async) sedangkan Next.js 15 / Turbopack mensyaratkan params: Promise<{ id: string }>.
**Solusi:** Mengganti seluruh impor sesi dari pola lama ke pola baru import { auth } from "@/lib/auth" + const session = await auth(). Mengubah tipe params menjadi Promise<{id: string}> dan menerapkan const resolvedParams = await params.
**Status:** FIXED ? � Build berhasil Exit Code 0.

---

### BUG-076 (9 April 2026) - Double-Count Simpanan Wajib di Halaman Anggota
**File:** `src/app/api/members/[id]/route.ts`, `src/lib/services/shu-calculator.ts`
**Dilaporkan Oleh:** Atasan Operasional (via pesan internal)
**Masalah:** Nominal "Simpanan Wajib" yang terbaca di kartu ringkasan anggota (Total Simpanan) berbeda dengan angka di Tab Simpanan. Kadang Total Simpanan membengkak tidak wajar. Disinyalir ada kalkulasi ganda.
**Root Cause:** Sistem memiliki DUA sumber data simpanan wajib:
- `Member.tabunganWajib`: Saldo lama dari import CSV (sebelum sistem akun aktif)
- `SavingsAccount` tipe `wajib`: Rekening resmi yang di-update real-time via transaksi setoran

Kode sebelumnya **selalu menjumlahkan keduanya tanpa pengecekan**, sehingga jika anggota sudah memiliki rekening wajib resmi, nilai simpanannya dihitung 2x. Akibatnya:
1. Kartu "Total Simpanan" menampilkan angka yang bengkak (inflated)
2. Tab Simpanan menampilkan 2 baris "Simpanan Wajib" dengan nominal berbeda

**Solusi:** Implementasi logika fallback `hasWajibAccount`:
- Cek apakah anggota memiliki `SavingsAccount` dengan `product.type === "wajib"`
- Jika YA ? `tabunganWajibFallback = 0` (tidak dihitung lagi, pakai saldo rekening resmi)
- Jika TIDAK ? `tabunganWajibFallback = Member.tabunganWajib` (data CSV lama masih relevan)
- Perbaikan yang sama diterapkan di SHU Calculator agar distribusi SHU per anggota juga tidak bias.
**Status:** FIXED ?

---

## BUG REPORT � 10 April 2026

| ID | Modul | Deskripsi Bug | Severity | Status |
|----|-------|---------------|----------|--------|
| **BUG-075** | Kas & Bank / Riwayat | Search bar tidak berfungsi � searchColumn tidak di-pass ke DataTable component | Medium | ? FIXED |
| **BUG-076** | Kas & Bank / Transaksi Unit | Tidak ada filter per-unit pada tab Transaksi Unit | Medium | ? FIXED |
| **BUG-077** | Import Excel Kas | Angka artifact kecil (< Rp 10) dari sel Excel kosong terimpor sebagai transaksi valid | High | ? FIXED |
| **BUG-078** | Import Excel Kas | Stop-sequence 'sisa' terlalu broad � memotong baris 'Sisa Setelah Serah Terima' (Saldo Awal) sehingga tidak diimpor | Critical | ? FIXED |
| **BUG-079** | Import Excel Kas | Semua baris dalam satu tanggal mendapat timestamp persis sama, membuat urutan Buku Kas acak/non-deterministik | High | ? FIXED |
| **BUG-080** | Import Excel Kas | isSaldoAwal tidak mengenali keyword 'sisa awal' � hanya 'saldo awal' | Medium | ? FIXED |
| **BUG-081** | Kas & Bank Modal | Form Kas Masuk/Keluar tidak memiliki field Tanggal (hardcode 
ew Date()) � operator tidak bisa input transaksi masa lalu | Medium | ?? OPEN � Target: Sesi berikutnya |
| **BUG-082** | Kas & Bank Modal | Form Kas Masuk/Keluar tidak memiliki field Unit Usaha � tidak bisa trigger automasi Split Ledger Cuci Mobil | High | ?? OPEN � Target: Sesi berikutnya |
| **BUG-083** | Kas & Bank Modal | Form Kas Masuk/Keluar tidak memiliki field Anggota � SHU Rp2.000 tidak dapat dipotong otomatis | High | ?? OPEN � Target: Sesi berikutnya |
| **BUG-084** | Kas & Bank Schema | Tabel CashBankTransaction tidak memiliki kolom unitType dan memberId � laporan Arus Kas per-Unit tidak bisa disajikan secara efisien | Medium | ?? OPEN � Target: Schema Migration |

---

### BUG-085 (10 April 2026) - Saldo Awal Periode Selalu Rp 0 di Buku Kas
**File:** `src/app/api/cash-bank/book/route.ts`
**Masalah:** Saat membuka halaman Buku Kas (`/kas-bank/buku-kas`), baris "Saldo Awal Periode" selalu menunjukkan Rp 0. Padahal data "Sisa Setelah Serah Terima" sudah diimpor dari Excel.
**Root Cause:** API `/api/cash-bank/book` menghitung `openingBalance` dari transaksi **sebelum** periode yang dipilih. Namun saat user memilih "Semua Bulan" pada tahun dimana data pertama kali diimpor, tidak ada transaksi sebelumnya, sehingga `openingBalance = 0`. Sementara itu, baris "Sisa Setelah Serah Terima" diperlakukan sebagai transaksi biasa (`category: lainnya`), bukan sebagai saldo awal.
**Solusi:** Menambahkan logika deteksi `isOpeningBalanceDescription()` yang mengenali keyword: "saldo bulan", "saldo awal", "sisa awal", "sisa setelah serah terima". Jika `openingBalance == 0` dan terdapat transaksi bertipe saldo awal di periode tersebut, maka:
1. Jumlahkan sebagai `detectedOpeningBalance`
2. Ekstrak dari daftar entri (tidak ditampilkan sebagai transaksi biasa)
3. Tampilkan sebagai Saldo Awal di kartu ringkasan dan baris pembuka tabel
4. Hitung per-akun breakdown untuk ditampilkan di UI
**Status:** FIXED

---

### BUG-086 (10 April 2026) - Transaksi Sampah < Rp 10 Masih Ada di Production
**File:** `prisma/cleanup-garbage-transactions.ts`
**Masalah:** Meski filter `< 10` sudah ditambahkan ke logika import (BUG-077), 2 transaksi sampah yang **sudah terimpor sebelumnya** masih bertengger di database production:
- ID 1625: Bank BRI | Rp 9 | "[IMPORT EXCEL - MARET] 4"
- ID 1641: Kas Tunai | Rp 7 | "[IMPORT EXCEL - MARET] 4"
**Solusi:** Membuat dan menjalankan skrip cleanup (`prisma/cleanup-garbage-transactions.ts`) yang:
1. Menemukan semua transaksi `amount < 10`
2. Menghapus transaksi tersebut
3. Merekalkukasi ulang `balanceBefore` dan `balanceAfter` untuk seluruh transaksi di akun yang terdampak
4. Memperbarui `currentBalance` akun
- Akun 9 (Bank BRI): Saldo dikoreksi ke 2.207.282.591
- Akun 12 (Kas Tunai): Saldo dikoreksi ke 10.814.076
**Status:** FIXED + DATA CLEANED

---

### BUG-087 (10 April 2026) - Modal Kas Masuk/Keluar Overflow (Teks Akun Menutupi Tanggal)
**File:** `src/app/(protected)/kas-bank/kas/page.tsx`
**Masalah:** Saat memilih Akun Kas di modal Kas Masuk/Keluar, teks nama akun yang panjang (misal "KAS TUNAI KOPERASI (Rp 10.814.076)") meluap (overflow) keluar dari batas selector dan menutupi field Tanggal Transaksi di sebelahnya.
**Root Cause:** Modal menggunakan `max-w-lg` (512px) yang terlalu sempit untuk layout 2-kolom dengan teks akun panjang. SelectTrigger tidak memiliki constraint `w-full` dan tidak ada truncation.
**Solusi:**
1. Memperbesar modal dari `max-w-lg` menjadi `max-w-2xl` (672px)
2. Mengubah layout baris pertama dari `grid-cols-2` menjadi `grid-cols-1 sm:grid-cols-3` dengan Akun Kas mendapat `col-span-2`
3. Menambahkan `className="w-full"` pada SelectTrigger
4. Memperbesar scroll area dari `max-h-[60vh]` ke `max-h-[70vh]`
**Status:** FIXED

---

*Total bug tercatat: 92 | Total fitur baru: 22*
*Diperbarui: 10 April 2026 - Sesi 10*


### BUG-090 (11 April 2026) - Import TAJIB Membaca Kolom Saldo LAMA (Grup 1) Bukan Saldo TERKINI (Grup 2)
**File:** src/app/api/members/import/route.ts
**Masalah:** Excel TABUNGAN WAJIB memiliki 2 kelompok kolom identik (Pokok/Wajib/MS/JML masing-masing muncul 2x). Grup 1 = saldo periode lalu, Grup 2 = saldo terkini + kolom bulanan. Script menggunakan indIndex yang selalu mengambil Grup 1 (kolom pertama), sehingga saldo Wajib terbaca 7.800.000 padahal seharusnya 7.900.000.
**Solusi:** Mengganti indIndex menjadi indLastIdx (reverse search) untuk kolom Pokok, Wajib, dan MS agar selalu mengambil kolom dari Grup 2 (Saldo Terkini) yang berdampingan dengan kolom bulan.
**Status:** FIXED


### BUG-091 (11 April 2026) - Gagal Import TAJIB: accountNo Wajib Diisi (Prisma Required Field)
**File:** src/app/api/members/import/route.ts
**Masalah:** Saat import TAJIB commit, sistem mencoba membuat akun Simpanan baru (Pokok/Sukarela) untuk anggota yang belum memiliki. Namun field ccountNo pada model SavingsAccount bersifat **required** (wajib) di Prisma schema, sementara kode tidak pernah menyediakannya. Akibatnya 789 dari 827 anggota gagal karena mereka membutuhkan pembuatan akun Pokok/Sukarela baru.
**Kenapa 38 Berhasil?** 38 anggota tersebut kebetulan sudah memiliki akun Wajib dari import sebelumnya dan saldo Pokok/Sukarela = 0 di Excel, sehingga tidak perlu membuat akun baru.
**Solusi:** Menambahkan auto-generate ccountNo unik (PKK-{NRP}-{timestamp}, WJB-{NRP}-{timestamp}, SKR-{NRP}-{timestamp}) pada setiap pembuatan akun simpanan baru.
**Status:** FIXED

### BUG-092 (11 April 2026) - Gagal Memuat Produk Simpanan pada Transaksi Tambah
**File:** src/app/(protected)/simpanan/transaksi/tambah/page.tsx
**Masalah:** Saat membuka halaman Transaksi Simpanan Baru, muncul toast error "Gagal memuat produk simpanan" dan dropdown produk simpanan kosong.
**Root Cause:** Halaman mencoba melakukan fetch data produk simpanan ke endpoint /api/savings/products, namun endpoint tersebut tidak ada (404 Not Found), karena endpoint sebenarnya adalah /api/master/savings-products.
**Solusi:** Merubah endpoint fetch dari /api/savings/products menjadi /api/master/savings-products.
**Status:** FIXED

### BUG-093 (11 April 2026) - Gagal Import TAJIB: openedDate dan branchId Wajib Diisi
**File:** src/app/api/members/import/route.ts
**Masalah:** Walaupun Bug-091 (accountNo missing) sudah diperbaiki, Prisma masih menggagalkan secara diam-diam (silent failure) proses penyimpanan riwayat anggota baru karena field openedDate dan ranchId wajib diisi saat pembuatan SavingsAccount. Akibatnya, layout detail Dashboard terlihat kosong karena datanya tidak berhasil masuk database.
**Solusi:** Memastikan pemanggilan 	x.savingsAccount.create selalu menyertakan openedDate: new Date() dan mapping ke cabang yang benar ranchId: member.branchId.
**Status:** FIXED

### BUG-094 (11 April 2026) - Import TAJIB Gagal Total Akibat Vercel Timeout (504)
**File:** Data Injection Manual (skrip background Node.js)
**Masalah:** Endpoint Import API Next.js mencoba melakukan eksekusi ~800 baris x 5 transaksi secara sekuensial. Layanan Vercel Serverless Function otomatis memutus (timeout) seluruh API yang merespon lebih dari 10-15 detik. Hal ini membuat mayoritas anggota terbawah tidak pernah terimpor riwayatnya meski ada tombol berhasil di Front-End (karena proses loop terhenti paksa di Backend).
**Solusi:** Menyuntikkan seluruh 805 histori bulanan secara manual dan langsung (bypass via script Node.js dari background) ke Neon Database Production (dengan tambahan Prisma Transaction Timeout maxWait: 10000, timeout: 30000ms).
**Status:** FIXED secara Data Integrity

### BUG-095 (11 April 2026) - Transaksi VOID Bengkak di Tagihan Piutang Dashboard Anggota
**File:** `src/app/api/member-portal/summary/route.ts` & UI Dashboard
**Masalah:** Saat admin toko menyetujui pembatalan/void (pembayaran dengan Potong Gaji), sistem mengubah status transaksi asli menjadi `voided` namun status `isPaid` secara default tetap `false`. Agregasi query Prisma hanya memfilter `{ isPaid: false }` tanpa mengesampingkan `status: "voided"`. Alhasil, transaksi basi yang sudah di-void masih terekam sebagai tagihan aktif (BELUM LUNAS) dan memberatkan total tagihan pada Dashboard Anggota. Selain itu, UI tidak memahami cara menampilkan baris/badge berstatus "voided".
**Solusi:** Memasang pengecualian `status: { not: "voided" }` pada backend untuk melindungi kebersihan angka Piutang. Merombak mapping antarmuka dan `page.tsx` pada Dashboard serta Transaksi Anggota agar mendeteksi status "voided" & menempelkan badge peringatan berwarna abu-abu **"DIBATALKAN"**.
**Status:** FIXED

### BUG-096 (11 April 2026) - Dropdown Kas Koperasi Kosong pada Tambah Transaksi Simpanan
**File:** `src/app/(protected)/simpanan/transaksi/tambah/page.tsx`
**Masalah:** Frontend memaksa filter URL `purpose=simpanan` saat fetch akun Kas/Bank, padahal tidak ada satupun akun di database yang memiliki purpose tersebut. Akibatnya dropdown "Kas Koperasi" selalu berputar menampilkan "Memuat akun..." tanpa pernah terisi opsi.
**Solusi:** Menghapus filter `purpose=simpanan` dan menggantinya dengan filter logis: tampilkan semua akun kas/bank umum (`!unitType && !purpose?.startsWith("shu_")`) sehingga akun operasional utama (Kas Besar, Bank BRI, Bank JATIM, dll) muncul dengan benar.
**Status:** FIXED

### BUG-097 (11 April 2026) - SHU Jasa Anggota Minus Akibat Void Contra-Entry
**File:** `src/app/api/member-portal/summary/route.ts`
**Masalah:** Query agregasi SHU pada `unitTransaction.aggregate` (baik system-wide maupun per-anggota) tidak mengecualikan transaksi berstatus `voided`. Contra-entry dari proses void memiliki nominal negatif (misal -Rp 15.000), sehingga saat dijumlahkan ke dalam pool SHU, total margin anggota menjadi minus dan menghasilkan persentase Jasa Anggota negatif (-0.03%).
**Solusi:** Menambahkan filter `status: { not: "voided" }` pada seluruh query agregasi unit transaction yang terkait perhitungan SHU: `sysUnit` (system-wide income), `myUnit` (kontribusi per-anggota), dan `unitStats` (ringkasan per unit).
**Status:** FIXED

### BUG-098 (11 April 2026) - Setoran Baru Tidak Muncul di Detail Bulanan Dashboard
**File:** `src/app/api/member-portal/summary/route.ts`, `src/app/portal/dashboard/page.tsx`
**Masalah:** API summary hanya mengirimkan transaksi yang notes-nya dimulai dengan "Setoran Import TAJIB:" — sehingga setoran manual baru (bulan April dst) yang dibuat melalui form Tambah Transaksi Simpanan tidak pernah muncul di breakdown bulanan Dashboard anggota.
**Solusi:** Menghapus filter notes yang terlalu ketat di API, dan memperbarui logika frontend agar menampilkan SEMUA transaksi deposit wajib. Label bulan sekarang diekstrak dari tanggal transaksi (untuk entri manual) atau dari notes (untuk entri import historis).
**Status:** FIXED

### BUG-099 (12 April 2026) - Total Simpanan Dashboard & Rekap Mengalami Double Counting
**File:** `src/app/api/dashboard-stats/route.ts`, `src/app/api/reports/savings-recap/members/route.ts`
**Masalah:** Dashboard memunculkan nominal Total Simpanan hingga 17 Miliar, padahal data asli adalah 8.5 Miliar. Penyebabnya adalah perhitungan agregasi backend secara keliru menjumlahkan saldo rekening `SavingsAccount` DITAMBAH dengan angka profil lawas di tabel `Member.tabunganWajib`. Karena data anggota sebelumnya sudah diimpor dan dipindah jadi `SavingsAccount` aktif, terjadi perhitungan ganda/dobel. Masalah serupa juga terjadi di logic halaman Rekap Anggota.
**Solusi:** Menghapus peran ganda `member.tabunganWajib` dalam penjumlahan total. Satu-satunya Source of Truth sekarang mutlak berpatokan pada saldo aktif yang tertera di `SavingsAccount`.
**Status:** FIXED

### BUG-100 (12 April 2026) - PDF/Excel Rekap Simpanan Tidak Merekam Anggota Secara Penuh (Hanya Halaman 1) dan Kehilangan Total
**File:** `src/app/(protected)/simpanan/rekap/page.tsx`, `src/lib/utils/export.ts`, `src/components/patterns/export-button.tsx`
**Masalah:** User yang mencetak/export PDF dari halaman Rekap Simpanan hanya mendapatkan daftar berisi 50 data anggota saja (halaman aktif), tanpa ada ringkasan GRAND TOTAL di paling bawah.
**Solusi:** Menyambungkan *data source* di komponen `ExportButton` menuju state `allData` (yang disokong oleh `fetchGrandTotals()` secara asinkronus). Kemudian, saya memperluas dukungan antarmuka utilitas `exportToPDF` & `exportToExcel` untuk menerima parameter baris total di bawah tabel (variabel `foot`), sehingga GRAND TOTAL dapat ditancapkan dan turut di-render oleh `jsPDF-autotable`.
**Status:** FIXED

### BUG-101 (12 April 2026) - Mobile API: Double Counting Total Simpanan
**File:** `src/app/api/mobile/summary/route.ts`
**Masalah:** Backend mobile summary masih menjumlahkan `SavingsAccount.balance` + legacy `member.tabunganWajib` sehingga Total Simpanan anggota dan operator terlihat 2x lipat. Bug ini sudah diperbaiki di Web (BUG-099) tetapi belum diterapkan di endpoint mobile.
**Solusi:** Menghapus semua referensi ke `tabunganWajib` dalam kalkulasi total. Single Source of Truth = saldo aktif di tabel `SavingsAccount`. Berlaku untuk: (1) operator totalSavings, (2) member totalSavingsBalance, (3) SHU capital calculation.
**Status:** FIXED

### BUG-102 (12 April 2026) - Mobile API: Transaksi Void Masih Terhitung di Piutang & SHU
**File:** `src/app/api/mobile/summary/route.ts`
**Masalah:** Query `unitTransaction` di endpoint mobile tidak mengecualikan `status: "voided"`. Akibatnya tagihan piutang anggota bengkak dan pool SHU Jasa Anggota terkontaminasi transaksi batal. Bug paritas dari BUG-095 dan BUG-097 Web.
**Solusi:** Menambahkan filter `status: { not: "voided" }` pada 3 query: (1) `unitUnpaid` aggregation, (2) `sysUnit` system-wide income, (3) `myUnit` per-member contribution.
**Status:** FIXED

### BUG-103 (13 April 2026) - Filter Simpanan Hari Ini Miss Date UTC
**File:** src/app/(protected)/simpanan/transaksi/tambah/page.tsx, src/app/api/savings/transactions/route.ts`n**Masalah:** Transaksi yang dilakukan antara jam 00:00 hingga 06:59 WIB pada form frontend ter-generate sebagai tanggal lokal UTC (tanggal kemarin) pada 	oISOString(), dan saat backend memproses tanggal string murni format YYYY-MM-DD, backend membacanya sebagai Midnight UTC, sehingga jika difilter berdasarkan rentang Hari Ini WIB, tanggal transaksi tidak terpanggil (hilang).
**Solusi:** Merombak kalkulasi di form frontend untuk mencampur offset WIB ke dalam init state 	ransactionDate. Di Backend dipasang custom validator yang secara diam-diam memparsing setiap parameter jenis string (YYYY-MM-DD) sebagai 12:00:00+07:00 (noon time WIB) agar dijamin aman mendarat pada rentang calendar day yang semestinya saat difilter.
**Status:** FIXED

### BUG-104 (13 April 2026) - Global Search Transaksi Tidak Mengenali Nama Anggota
**File:** src/app/(protected)/simpanan/transaksi/page.tsx`n**Masalah:** Fitur cari dari DataTable DataTables/TanStack Table gagal menemukan nama member. Penyebabnya adalah ccessorKey: 'member' me-return Objek { id, name, memberNo }, dimana mesin pencari String global hanya sanggup melakukan [object Object].includes().
**Solusi:** Mengganti kolom identifier dari ccessorKey: 'member' menjadi custom fungsi penarik metadata teks penuh dengan ccessorFn: (row) => row.member?.name + ' ' + row.member?.memberNo.
**Status:** FIXED

### BUG-105 (13 April 2026) - Import Kas/Bank Gagal Mengenali Sisa Bulan Lalu
**File:** `src/app/api/cash-bank/import/route.ts`
**Masalah:** Saat file buku kas terbaru (`bukukas_04.xlsx`) diimpor, saldo awal pada sheet APRIL luput tertangkap oleh sistem. Penyebabnya adalah panitia menggunakan label yang tidak terduga yaitu "SISA BULAN LALU", dan parahnya lagi label tersebut diletakkan di Kolom 1 (kolom NO), alih-alih di Kolom 4 (kolom URAIAN) seperti pada sheet bulan MARET. Logika detektor sebelumnya statis dan hanya menscan kolom ke-4.
**Solusi:** Merombak fungsi iterasi detektor dengan membuat agregat teks dari Kolom 1, Kolom 2, dan Kolom 4 (`allTextCols = firstCol + secondCol + uraian`) menggunakan ekspresi regex universal. Menambahkan keyword baru "sisa bulan lalu" ke dalam perbendaharaan kamus deteksi saldo koperasi, memastikan tidak ada lagi baris yang luput tanpa memandang cara admin menempatkan kolom ketikannya.
**Status:** FIXED

### BUG-106 (13 April 2026) - Auto-Mapping Import Kas Bank Salah Mengarahkan ke Bank JATIM Dana Pegawai
**File:** `src/app/(protected)/kas-bank/page.tsx`
**Masalah:** Saat Import Buku Kas dengan mode "Konsolidasi Penuh", kolom JATIM secara otomatis dipetakan ke akun **Bank JATIM – Dana Pegawai** (BNK-JATIM-PGWI, ID=14) alih-alih akun utama **Bank JATIM** (B-002, ID=10). Penyebabnya adalah logika auto-mapping menggunakan `.includes("jatim")` yang mengembalikan akun JATIM pertama dalam array (yaitu Dana Pegawai, yang punya ID lebih kecil dan muncul lebih awal). Dampaknya fatal: 32 transaksi senilai Rp 5,29 Miliar masuk ke akun yang salah pada production.
**Solusi:** (1) Mengubah logika auto-mapping menjadi prioritas bertingkat: pertama cari exact match `name === "bank jatim"`, kedua cari `code === "B-002"`, ketiga fallback ke akun jatim tanpa purpose/unitType khusus; (2) Memindahkan 32 transaksi dari akun ID=14 ke ID=10 via skrip migrasi dan menghitung ulang running balance kedua akun; (3) Memperbaiki logika BRI juga agar hanya match akun tanpa purpose khusus.
**Status:** FIXED
### BUG-107 (13 April 2026) - Mobile API SHU Modal Masih Menghitung Simpanan Sukarela
**File:** `src/app/api/mobile/summary/route.ts`
**Masalah:** Kalkulasi Estimasi SHU Jasa Simpanan (Modal) di endpoint mobile masih menggunakan SELURUH saldo SavingsAccount (termasuk Simpanan Sukarela) sebagai basis pembagi pool SHU. Padahal sesuai AD-ART Pasal 42, hanya Simpanan Pokok dan Wajib yang dianggap sebagai equity/modal SHU. Bug ini menyebabkan porsi SHU anggota yang memiliki Simpanan Sukarela besar menjadi terlalu tinggi (inflasi), dan sebaliknya mendeflasi porsi anggota lain.
**Solusi:** Menambahkan filter `product.type: { in: ['pokok', 'wajib'] }` pada query aggregate system-wide (`totalActiveSavBal`) dan menambahkan `.filter()` Pokok+Wajib pada kalkulasi per-anggota (`mySavCont`). Paritas sempurna dengan web portal dashboard yang sudah diperbaiki sebelumnya.
**Status:** FIXED
### BUG-108 (13 April 2026) - Javascript US Locale Meleset Membaca Tanggal Excel (DD-MM-YYYY menjadi DD-Jan)
**File:** `src/app/api/cash-bank/import/route.ts`
**Masalah:** Saat mengimpor Buku Kas bulan April, baris transaksi yang diinput panitia dengan string tanggal regional Indonesia misalnya `01-04-2026` atau `1/4` telah diurai oleh Javascript V8 engine (yang menggunakan standard US Locale MM/DD/YYYY) menjadi tanggal 4 Januari 2026 (terbalik antara bulan dan tanggal). Transaksi April pun melompat secara keliru ke Januari.
**Solusi:** Memodifikasi engine parser tanggal pada `import/route.ts` dengan menggunakan custom Regex `match(/^(\d{1,2})/)` yang sangat ketat untuk mendeteksi hanya susunan 1-31 dari depan string (Day of Month). Nilai integer hari ini selanjutnya dikawinkan secara absolut dengan parameter Date Konstruktor menggunakan `sheetYear` dan `sheetMonth` dari nama tab Excel (Maret=2, April=3), sehingga mencegah engine mengambil keputusan fallback ke US style default.
**Status:** FIXED

### BUG-109 (13 April 2026) - Sisa Bulan Lalu Terekam Sebagai Setoran Ekstra (Double Balance)
**File:** `src/app/api/cash-bank/import/route.ts`
**Masalah:** Label 'SISA BULAN LALU' pada awal lembar bulan April tertangkap oleh flag `isSaldoAwal` dengan nominal Saldo Debet yang utuh. Namun, alih-alih melewatinya, baris ini ikut diproses menjadi setoran (IN) layaknya transaksi biasa. Padahal, buku kas pada sistem secara berkesinambungan telah mengakumulasi seluruh transaksi di bulan Maret, sehingga setoran saldo awal bulan lalu tersebut memicu total Saldo Akhir bulan menjadi berlipat ganda dari buku fisik koperasi.
**Solusi:** Menyematkan constraint validitas di engine backend. Setiap temuan row label `isSaldoAwal` akan dicek cross-reference pada database; jika `currentBalance !== 0` (sudah ada sisa berkesinambungan), maka baris penginisialisasi tersebut akan di-bypass atau dilewati sepenuhnya (continue). Baris ini hanya akan menjadi pengisian saldo setoran PERTAMA murni jika nominal ledger masih Rp 0.
**Status:** FIXED
### BUG-110 (13 April 2026) - Import BRI Masuk ke Akun  Bank BRI - Giro (BRI-01) Bukan B-001
**File:** src/app/api/cash-bank/import/route.ts, src/app/(protected)/kas-bank/page.tsx
**Masalah:** Logika auto-mapping untuk kolom BRI menggunakan .includes(bri) yang mengembalikan akun pertama yang ditemukan, yaitu Bank BRI - Giro (BRI-01, ID=7), bukan akun utama Bank BRI (B-001, ID=9). Hal ini terjadi karena BRI-01 ditemukan lebih dahulu oleh Array.find() dibanding B-001 dalam urutan array database. Akibatnya, 13 transaksi BRI senilai Rp 2,28 Miliar mendarat di akun yang salah.
**Solusi:** Mengubah logika auto-mapping BRI menjadi prioritas bertingkat yang identik dengan JATIM: (1) exact match 
ame === bank bri, (2) code match code === B-001, (3) fallback includes(bri) tanpa purpose/unitType. Transaksi yang salah tempat dipindahkan dari ID=7 ke ID=9 dengan recalculate running balance kedua akun.
**Status:** FIXED
### BUG-111 (13 April 2026) - Transaksi Hilang Saat Kolom Debet dan Kredit Keduanya Terisi
**File:** src/app/api/cash-bank/import/route.ts, execute-import.js
**Masalah:** Saat panitia Koperasi menginput dua aktivitas sekaligus dalam satu baris (contoh: pelunasan SP lama di kolom Debet, dan pencairan SP baru di kolom Kredit), sistem hanya membaca kolom Debet saja dan membuang nominal Kredit. Hal ini menyebabkan 3 transaksi besar hilang (Senilai Rp 105 Juta pada Bank JATIM dan puluhan juta pada Kas Tunai) dan membuat Saldo Akhir tidak cocok dengan buku fisik.
**Solusi:** Memodifikasi parser Excel: apabila kedua kolom (Debet dan Kredit) terdeteksi terisi angka > 10, sistem kini akan otomatis menghasilkan DUA baris transaksi terpisah (1 baris IN dan 1 baris OUT). Khusus untuk baris  Sisa Bulan Lalu yang mengakumulasi debet & kredit usang, sistem menghitung NET (Debet - Kredit) agar tidak terjadi double-balance. Data telah di-reimport dan sekarang 100% cocok dengan laporan.
**Status:** FIXED

### BUG-112 (14 April 2026) - Import History Toko: StoreSale Tidak Tampil di Dashboard & Status Salah
**File:** src/app/api/member-portal/summary/route.ts, src/app/portal/dashboard/page.tsx
**Masalah:** Dashboard anggota hanya query tabel UnitTransaction untuk menampilkan riwayat transaksi terbaru. Padahal transaksi Toko (belanja barang) disimpan di tabel StoreSale yang berbeda. Akibatnya, history belanja toko TIDAK MUNCUL di dashboard anggota.
**Solusi:** Menambahkan query StoreSale di API summary, kemudian menggabungkan (merge + sort descending) dengan UnitTransaction menjadi satu daftar mergedRecent. StoreSale otomatis ditandai isPaid: true, status: completed karena sifatnya selalu lunas saat checkout.
**Status:** FIXED

### BUG-113 (14 April 2026) - Ringkasan Per Unit Hanya Menghitung UnitTransaction
**File:** src/app/api/member-portal/summary/route.ts
**Masalah:** Card  Ringkasan Per Unit di dashboard hanya menampilkan aggregate dari UnitTransaction, tidak termasuk StoreSale. Anggota yang dominan belanja Toko tidak melihat ringkasan unit Toko-nya.
**Solusi:** Menambahkan storeSale.groupBy dan menggabungkan stats kedua tabel ke dalam mergedStats menggunakan Map by unitType.
**Status:** FIXED

### BUG-114 (14 April 2026) - Rumus SHU Jasa Usaha Tidak Sesuai AD-ART (Cashback vs Pool)
**File:** src/app/api/member-portal/summary/route.ts, src/app/api/mobile/summary/route.ts
**Masalah:** Kalkulasi SHU Jasa Anggota (Usaha) menggunakan metode Cashback Langsung (25% x margin transaksi individu). Ini melanggar AD-ART Pasal 42 yang mengatur distribusi proporsional dari Pool. Jika semua anggota dijumlahkan, total bisa melebihi 25% Laba Bersih. Selain itu, label persentase menampilkan margin/totalIncome yang tidak bermakna.
**Solusi:** Mengganti ke Pool Method: Pool = 25% x Laba Bersih Koperasi, lalu didistribusikan proporsional berdasarkan volume transaksi anggota terhadap total transaksi seluruh anggota. Label diperbarui menjadi Porsi Anda dari Total Transaksi Anggota. Paritas Web + Mobile dijaga.
**Status:** FIXED

### BUG-115 (15 April 2026) - EROFS: Upload Bukti Struk Operasional Gagal di Production (Read-Only Filesystem)
**File:** src/app/api/unit/[slug]/operational-expense/route.ts, src/app/api/unit/[slug]/operational-expense/[id]/route.ts, src/app/api/upload-qris/route.ts
**Masalah:** Upload foto bukti struk pengeluaran operasional selalu gagal di production Vercel dengan error `EROFS: read-only file system, open '/var/task/public/uploads/expenses/cuci_mobil/...'`. File dengan ukuran berapapun (999 KB maupun 68 KB setelah kompresi) tetap gagal. Ini bukan masalah ukuran file, melainkan karena Vercel serverless functions memiliki filesystem **read-only** — `fs.writeFile()` ke path `/public/uploads/` tidak mungkin dilakukan di production.
**Akar Masalah:** Ketiga route upload menggunakan Node.js `writeFile` + `mkdir` untuk menyimpan file ke folder `public/uploads/` di filesystem lokal. Ini hanya berjalan di development (localhost), tetapi di Vercel deployment, filesystem bersifat immutable (read-only) kecuali `/tmp` yang bersifat ephemeral.
**Dampak:** 3 endpoint terdampak: (1) POST pengeluaran operasional, (2) PUT edit pengeluaran operasional, (3) POST upload QRIS unit.
**Solusi:** Migrasi dari filesystem lokal ke **NeonDB base64 storage**:
1. Buat model `UploadedFile` di schema Prisma untuk menyimpan file sebagai base64 `@db.Text` di NeonDB.
2. Semua `fs.writeFile()` diganti → `prisma.uploadedFile.create({ base64Data })`.
3. Buat API endpoint `/api/uploads/[id]` untuk serve gambar dari DB sebagai binary response dengan Content-Type yang benar.
4. Upload QRIS lama (`/api/upload-qris`) dimigrasi ke pola yang sama (`UnitSetting.qrisBase64`).
5. Frontend limit diperbarui dari 5MB → 2MB dengan pesan error yang jelas dan validasi tipe file (JPG/PNG/WebP only).
**Status:** ✅ FIXED

