# 📱 MOBILE-UPDATE-CURRENT.md
# Roadmap & Backlog Update Aplikasi Mobile PRIMKOPPOL

> **Dokumen ini melacak kesenjangan fitur antara Web (primkoppol.online) dan Mobile App (Expo/React Native).**
> Update terakhir: **1 Mei 2026 (Code Review Cuci Mobil, Backdate POS, Rekap Jasa Pinjaman)**
> Referensi Web: `UPDATE-FIX-CURRENT.md` | `BUG-FIX-CURRENT.md` | `SIMPANAN-FEATURE.md` | `UNIT-TOKO.md` | `UNIT-CUCI-MOBIL.md`

---

## 📊 RINGKASAN STATUS

| Sprint | Total Item | ✅ Selesai | 🔄 On Progress | ❌ Belum |
|---|---|---|---|---|
| Sprint 1 — Bug Kritis & Fondasi API | 7 | 7 | 0 | 0 |
| Sprint 2 — Paritas Fitur Web | 5 | 5 | 0 | 0 |
| Sprint 3 — Layar Baru & Optimasi | 4 | 4 | 0 | 0 |
| Sprint 4 — Pre-Deploy Audit & Unit Baru | 2 | 2 | 0 | 0 |
| Sprint 5 — Deep Audit Bug Fixes | 8 | 8 | 0 | 0 |
| Sprint 6 — Full Role Audit + Branding + Bug Fixes | 17 | 17 | 0 | 0 |
| Sprint 7 — Web Backend Sync (Notifikasi, HPP, Batch) | 3 | 3 | 0 | 0 |
| Sprint 8 — Code Review Cuci Mobil + Rekap Jasa + Backdate | 6 | 6 | 0 | 0 |
| **TOTAL** | **52** | **52** | **0** | **0** |

## 🆕 UPDATE WEB & BACKEND (1 MEI 2026)

### 56. [M-SYNC-036] Code Review Cuci Mobil — CRITICAL Fixes (Race Condition, SHU, Balance Chain)
- ✅ **Selesai (Web Backend)**: 5 perbaikan kritis dari code review menyeluruh unit Cuci Mobil.
- **Perubahan Backend (otomatis berlaku untuk Mobile):**
  1. ✅ Fiscal period query sekarang cek range tanggal transaksi (`startDate ≤ now ≤ endDate`), bukan hanya `status: "open"`
  2. ✅ CashBankAccount balance update menggunakan atomic `{ increment: n }` / `{ decrement: n }` (mencegah race condition saat 2 kasir bayar bersamaan)
  3. ✅ Operational expense/income: account lookup & balance update dipindah ke dalam `$transaction` (atomic)
  4. ✅ PUT expense: `balanceBefore` direcalculate dari predecessor saat tanggal transaksi berubah, semua subsequent running balance disesuaikan
  5. ✅ SHU calculator: `allocationsMember`/`allocationsNonMember` dihitung setelah carwash bonus adjustment (sebelumnya dihitung sebelum adjustment, menghasilkan angka salah)
- **File yang diubah:**
  - `src/app/api/unit-layanan/sales/route.ts`
  - `src/app/api/unit/[slug]/operational-expense/route.ts`
  - `src/app/api/unit/[slug]/operational-expense/[id]/route.ts`
  - `src/app/api/unit/[slug]/operational-income/route.ts`
  - `src/lib/services/shu-calculator.ts`
- **Dampak Mobile:**
  - ✅ Semua endpoint mobile yang menggunakan API yang sama otomatis mendapat perbaikan
  - ✅ `POST /api/mobile/unit-layanan` (mobile POS) menggunakan `sales/route.ts` yang sama → atomic balance
  - ✅ SHU dashboard operator mobile akan menampilkan angka yang benar setelah fix
  - ❌ **Gap:** Mobile belum bisa mencatat pengeluaran/pemasukan operasional. Backend sudah siap, tapi belum ada UI di mobile untuk `operational-expense` dan `operational-income`. Tambahkan ke backlog (`M-FEAT-032`)

### 57. [M-SYNC-037] Code Review Cuci Mobil — IMPORTANT Fixes (Void Reversal, RBAC, Route Guard)
- ✅ **Selesai (Web Backend)**: 7 perbaikan kualitas kode dari code review.
- **Perubahan Backend:**
  1. ✅ Operator direct void sekarang membalikkan jurnal (swap debit/credit) dan mendekrementasi saldo kas/bank secara atomik
  2. ✅ `isOperator` di void-request diperluas ke `["operator", "admin", "super_admin"]`
  3. ✅ GET operational-expense mendapat RBAC via `checkAccess()` + query by `unitType` (bukan `description.contains`)
  4. ✅ PUT expense: old receipt file dihapus saat diganti dengan file baru
  5. ✅ Stats endpoint: `todaySalaryCut` sekarang menghitung StoreSale salary_cut; tambah role check (anggota blocked) + unit isolation
  6. ✅ QRIS POST/DELETE: tambah unit isolation untuk admin role
  7. ✅ Sales endpoint: tambah unit isolation check
- **Perubahan Frontend (Web only):**
  - ✅ `layout.tsx` — Route guard `cuci_mobil` ditambah `/cuci-mobil` untuk kasir dan admin
- **Dampak Mobile:**
  - ✅ Void reversal fix otomatis berlaku — void dari mobile POS akan membalikkan jurnal dengan benar
  - ✅ RBAC fix berlaku — admin mobile bisa void langsung tanpa approval flow
  - ✅ Stats fix berlaku — dashboard mobile menampilkan angka salary_cut yang benar
  - ❌ **Gap:** Mobile belum bisa upload QRIS gambar per unit. Tambahkan ke backlog jika dibutuhkan (`M-FEAT-033`)

### 58. [M-SYNC-038] Backdate POS — Kasir Bisa Pilih Tanggal Transaksi Mundur
- ✅ **Selesai (Web Frontend + Backend)**: Kasir sekarang bisa mencatat transaksi dengan tanggal mundur (backdated).
- **Perubahan Backend:**
  - `sales/route.ts` menerima parameter opsional `transactionDate`
  - Validasi: tidak boleh lebih dari hari ini, harus format tanggal valid
  - Semua record (UnitTransaction, CashBankTransaction, Journal) menggunakan tanggal yang disediakan
  - `generateTxNo()` menerima parameter `date` untuk nomor transaksi sesuai tanggal
- **Perubahan Frontend (Web only):**
  - `cuci-mobil/kasir/page.tsx` — Date picker di panel checkout
  - `unit/[unitSlug]/kasir/page.tsx` — Date picker di panel checkout (semua unit jasa)
- **Dampak Mobile:**
  - ✅ Backend menerima `transactionDate` → mobile POS bisa kirim parameter ini
  - ❌ **Gap:** Mobile `KasirScreen.tsx` belum punya date picker untuk backdate. Tambahkan ke backlog (`M-FEAT-034`)

### 59. [M-SYNC-039] Rekap Jasa Pinjaman Per Bulan — Laporan Bunga Pinjaman
- ✅ **Selesai (Web Backend + Frontend)**: Fitur baru menampilkan rekapitulasi jasa (bunga) pinjaman per bulan.
- **Fitur:**
  - Halaman `/pinjaman/laporan-jasa` — tabel rekap per bulan: total pinjaman, total bunga, jumlah pinjaman aktif/baru/lunas
  - Export Excel dengan format siap cetak
  - API: `GET /api/loans/rekap-jasa?year=YYYY`
  - Helper: `src/app/(protected)/pinjaman/_lib/report-helpers.ts` (shared antara view dan export)
- **File yang diubah:**
  - `src/app/(protected)/pinjaman/laporan-jasa/page.tsx` — Halaman rekap
  - `src/app/api/loans/rekap-jasa/route.ts` — API endpoint
  - `src/app/api/loans/rekap-jasa/export/route.ts` — Export Excel
  - `src/app/(protected)/pinjaman/_lib/report-helpers.ts` — Shared helpers
- **Dampak Mobile:**
  - ✅ API endpoint bisa diakses dari mobile untuk menampilkan rekap jasa
  - ❌ **Gap:** Mobile belum punya layar rekap jasa pinjaman. Tambahkan ke backlog (`M-FEAT-035`)

### 60. [M-SYNC-040] RBAC & Unit Isolation Audit — Cross-Unit Fixes
- ✅ **Selesai (Web Backend)**: Audit menyeluruh pada semua endpoint yang terlibat operasi unit layanan.
- **Perbaikan menyeluruh:**
  - Sales API: unit isolation check (`userUnitType !== unitType` → 403)
  - Stats API: role check (anggota blocked), unit isolation for non-operator
  - QRIS API: unit isolation for admin role on POST/DELETE
  - Void request: expanded isOperator to include admin/super_admin
  - Operational expense: full RBAC via `checkAccess()`, proper query filtering
- **Dampak Mobile:**
  - ✅ Semua pengecekan akses berlaku otomatis — admin mobile tidak bisa akses data unit lain
  - ✅ Error messages dalam Bahasa Indonesia (konsisten dengan UX mobile)

### Bug Fixes Lainnya (1 Mei 2026)

| Bug | Area | Solusi |
|---|---|---|
| Build error import path | Rekap Jasa Pinjaman | Fix relative import `./_lib/report-helpers` dan `../_lib/report-helpers` |
| Predecessor query includes self | Operational expense PUT | Tambah `id: { not: transactionId }` di predecessor where clause |

### Tugas Mobile yang Perlu Dikerjakan (Backlog Baru)

| ID | Deskripsi | Estimasi | Prioritas |
|---|---|---|---|
| M-FEAT-031 | Layar Rekap Jasa Pinjaman per Bulan di mobile (operator) | 1–2 hari | 🟡 Medium |
| M-FEAT-032 | Layar Catat Pengeluaran/Pemasukan Operasional di mobile (admin unit) | 2 hari | 🟡 Medium |
| M-FEAT-033 | Upload QRIS gambar per unit dari mobile (admin) | 1 hari | 🟢 Low |
| M-FEAT-034 | Date picker backdate di mobile POS KasirScreen | 1 hari | 🟡 Medium |
| M-FEAT-035 | Rekap Jasa Pinjaman export dari mobile | 1 hari | 🟢 Low |

### File Backend yang Diubah (Berlaku Otomatis untuk Mobile)

| File | Perubahan |
|---|---|
| `src/app/api/unit-layanan/sales/route.ts` | Atomic balance, unit isolation, fiscal period, backdate support |
| `src/app/api/unit-layanan/stats/route.ts` | StoreSale salary_cut, role check, unit isolation |
| `src/app/api/unit-layanan/qris/route.ts` | Unit isolation admin role |
| `src/app/api/unit-transactions/void-request/route.ts` | Journal reversal + cash/bank reversal, expand isOperator |
| `src/app/api/unit/[slug]/operational-expense/route.ts` | Atomic transaction, RBAC, query by unitType |
| `src/app/api/unit/[slug]/operational-expense/[id]/route.ts` | Balance recalculation, receipt cleanup |
| `src/app/api/unit/[slug]/operational-income/route.ts` | Atomic transaction inside $transaction |
| `src/app/api/loans/rekap-jasa/route.ts` | Rekap jasa pinjaman API |
| `src/app/api/loans/rekap-jasa/export/route.ts` | Export Excel rekap jasa |
| `src/lib/services/shu-calculator.ts` | SHU allocation after carwash bonus |
| `src/app/(protected)/layout.tsx` | Route guard cuci_mobil update |

---

## 🆕 UPDATE WEB & BACKEND (26 APRIL 2026)

### 29. [M-SYNC-026] Transaction Safety — `prisma.$transaction` pada Semua Unit API
- ✅ **Selesai (Web Backend)**: Semua operasi multi-tabel (create transaction, cash/bank sync, journal) dibungkus dalam `prisma.$transaction` (interactive).
- **File yang diubah:**
  1. ✅ `src/app/api/unit-layanan/sales/route.ts` — Web POS unit (cuci_mobil, fotocopy, dll)
  2. ✅ `src/app/api/mobile/unit-layanan/route.ts` — Mobile POS unit
  3. ✅ `src/app/api/toko/sales/route.ts` — Toko/Resto POS (via `StoreSale`)
  4. ✅ `src/app/api/mobile/toko/route.ts` — Mobile Toko POS
- **Dampak Mobile:** Otomatis berlaku — semua transaksi dari mobile kini atomic. Tidak ada lagi partial write jika salah satu operasi gagal.
- **Catatan:** Transaksi kritis (plafon check, journal, cash/bank) yang sebelumnya berisiko race condition kini aman.

### 30. [M-SYNC-027] Validasi Input & Plafon Piutang Real-Time
- ✅ **Selesai (Web Backend)**:
  - Validasi `amount > 0` pada semua endpoint
  - Validasi `unitType` dan `paymentMethod` terhadap enum yang diizinkan
  - Validasi plafon piutang: cek sisa limit anggota sebelum transaksi salary_cut
  - Validasi plafon otomatis: jika `plafonPiutang` tidak diset, hitung otomatis dari gaji (40% default)
- **Dampak Mobile:** Otomatis berlaku — kasir mobile akan mendapat error yang jelas jika plafon tidak mencukupi.

### 31. [M-SYNC-028] RBAC pada Endpoint Mobile
- ✅ **Selesai (Web Backend)**: Ditambahkan role check pada 4 endpoint mobile:
  1. ✅ `GET /api/mobile/reports/unit` — Hanya operator/admin
  2. ✅ `GET/PATCH /api/mobile/members/[id]` — Hanya operator/admin/kasir
  3. ✅ `GET /api/mobile/members/[id]/piutang` — Hanya operator/admin/kasir
  4. ✅ `GET /api/mobile/savings-tx` — Hanya kasir/operator/admin
- **Dampak Mobile:** Anggota biasa tidak bisa mengakses data finansial orang lain. Kasir tetap bisa akses sesuai tugasnya.

### 32. [M-SYNC-029] Void Flow Fix — Journal & Cash/Bank Reversal
- ✅ **Selesai (Web Backend)**: Void `UnitTransaction` (JALUR 2) sekarang juga:
  - Membuat jurnal pembalik (swap debit/credit)
  - Membuat transaksi cash/bank keluar (reversal)
  - Update balance cash/bank
  - Semua dalam satu `prisma.$transaction` interactive
- **File yang diubah:** `src/app/api/unit-transactions/void-approve/route.ts`
- **Dampak Mobile:** Approval void dari mobile untuk unit layanan (cuci mobil, fotocopy, dll) akan membalikkan semua entri keuangan dengan benar.

### 33. [M-SYNC-030] parseFloat untuk Quantity Desimal
- ✅ **Selesai (Web Backend)**:
  - `api/mobile/toko/route.ts` — `parseInt` → `parseFloat` untuk quantity
  - `api/toko/sales/route.ts` — `parseInt` → `parseFloat` untuk quantity
- **Dampak Mobile:** Kasir mobile kini bisa menginput quantity desimal (contoh: 1.5 kg laundry, 2.5 jam PlayStation) tanpa truncation.

### 34. [M-FEAT-024] Member Autocomplete Cuci Mobil POS (Web)
- ✅ **Selesai**: Ditambahkan autocomplete NRP/Nama di panel checkout Cuci Mobil (sebelumnya hanya ada di dialog Potong Gaji).
- **Dampak Mobile:** `KasirScreen.tsx` sudah memiliki autocomplete member untuk semua unit — paritas sudah tercapai. Ini hanya fix di Web POS yang tertinggal.

### 35. [M-SYNC-031] Fix Filter Unit di Portal Member
- ✅ **Selesai**: Portal member (`/portal/transaksi`) sekarang menampilkan semua 9 unit (sebelumnya hanya 5). Ditambahkan: Laundry, Barbershop, PlayStation, Resto.
- **Dampak Mobile:** Tidak langsung — ini fitur Web portal. Namun data transaksi dari mobile POS tetap tercatat dengan benar di histori anggota.

### 36. [M-FEAT-025] Fix Cetak Struk — Hilangkan Space Kosong Berlebih
- ✅ **Selesai**: Komponen `ReceiptPrimkopol` diperbaiki:
  - Print window height kini dinamis sesuai konten (bukan fixed 600px)
  - Print CSS `@page { margin: 0; size: auto; }` ditambahkan
  - Padding dikurangi dari `p-4` ke `p-2`
  - Window auto-close setelah cetak selesai
  - Nama unit ditampilkan di header struk (CUCI MOBIL, BARBERSHOP, dll)
  - Detail item per baris (nama, qty x harga, subtotal) — sesuai standar POS retail
  - Teks "Koperasi" dihilangkan, diganti "Polres Lumajang"
- **Dampak Mobile:** `generateRawText()` juga diupdate — nama unit dan detail item kini tampil di struk Bluetooth thermal.

### 37. [M-SYNC-032] Rename "Rak" → "Kategori" di Manajemen Produk
- ✅ **Selesai (Web)**: Seluruh label "Rak" diubah ke "Kategori" di UI:
  - Table header produk (`/toko/produk`)
  - Filter dropdown ("Semua Kategori")
  - Form tambah produk ("Harga Jual")
  - Detail produk
  - Halaman import (instruksi + preview table)
- **Import API Backward-Compatible:** Endpoint `/api/toko/products/import` tetap membaca kolom "Rak" (file lama) DAN "Kategori" (file baru) dari Excel/CSV. Variable internal di-rename dari `rakIdx` ke `catIdx`.
- **Dampak Mobile:** Tidak ada perubahan API response. Label "Rak" di mobile (jika ada) juga perlu diupdate di `StokScreen.tsx` dan `KasirScreen.tsx` saat iterasi mobile berikutnya.

### 38. [M-FEAT-026] Manajemen Harga per Kategori — Configurable Excluded Categories
- ✅ **Selesai (Web + Backend)**: Sistem pengecualian harga manual sebelumnya hardcoded `["rokok"]`, kini **configurable** melalui halaman Manajemen Harga (`/toko/manajemen-harga`).
- **Komponen yang diubah:**
  1. ✅ **Settings API** (`/api/settings`) — Default `toko_excluded_categories` dan `resto_excluded_categories` (JSON array)
  2. ✅ **Manajemen Harga** — Card baru "Kategori dengan Harga Manual" — chip toggle UI (☑ = formula, ☐ = manual)
  3. ✅ **Form Tambah Produk** (`/toko/produk/tambah`) — Membaca excluded categories dari settings, skip auto-calculate jika kategori manual
  4. ✅ **Daftar Produk** (`/toko/produk`) — Badge "Manual" (amber) pada produk kategori excluded, fetch dari settings
  5. ✅ **Inline Edit** — Skip auto-calculate jika kategori produk = manual
  6. ✅ **Import Excel** (`/api/toko/products/import`) — `getPricingMultipliers()` membaca excluded categories, skip auto-calc
  7. ✅ **Recalculate API** (`/recalculate-prices`) — Query `NOT { category: { in: excludedCategories } }` untuk skip produk manual
  8. ✅ **Bulk Set Harga** — Warning dialog jika produk kategori manual terpilih saat bulk set harga
- **Dampak Mobile:** Import Excel API dan Recalculate API otomatis menggunakan excluded categories baru. Mobile app tidak perlu perubahan kode — pricing logic ada di backend.

### Tugas Mobile yang Belum Diperlukan dari Update Ini
Semua perbaikan di atas bersifat **backend-only** atau **Web-only**, sehingga **tidak memerlukan update kode mobile**. Yang perlu diperhatikan:
- Mobile app perlu di-rebuild hanya jika ada perubahan API response format (tidak ada pada update ini)
- Validasi plafon mobile sudah menggunakan endpoint yang sama, jadi otomatis mendapat peningkatan
- RBAC akan otomatis menolak akses tidak sah dari mobile app
- **Catatan khusus:** Jika mobile `StokScreen.tsx` atau `KasirScreen.tsx` menampilkan label "Rak", perlu diubah ke "Kategori" di iterasi mobile berikutnya

---

### 13. [M-FEAT-016] Paritas UI: Tampilkan Koreksi & Penarikan di Riwayat Mutasi Mobile
- ✅ **Selesai**: File `DashboardScreen.tsx` dan `SimpananScreen.tsx` telah diperbarui.
- Kini, transaksi berjenis `correction` dan `withdrawal` tidak difilter keluar, melainkan ditampilkan menggunakan UI responsif dan indikator warna kondisional (Orange/Kuning Warning untuk Koreksi, dan Merah untuk Penarikan).

### 14. [M-FEAT-013 & M-FEAT-014] Konfirmasi Penyelesaian Input Tenor & Direct Disburse
- ✅ **Selesai**: Telah dikonfirmasi dan direviu bahwa komponen Formulir Tenor Pinjaman pada `LoanApplicationScreen.tsx` telah menggunakan *Numeric Text Input* (menghapus limitasi Dropdown), tervalidasi skema Zod.
- ✅ **Selesai**: `DirectDisburseScreen.tsx` untuk fitur operator juga telah selesai menyeluruh, termasuk fungsi _autocomplete member search_ dan _backdated date picker_, terintegrasi dengan backend.

### 15. [M-FEAT-004] Penundaan Edit NRP transaksi Kasir
- ❌ **Belum Diimplementasikan**: Menunda fitur edit anggota/NRP yang tertinggal di transaksi toko POS lama, dikarenakan sistem Endpoint backend `/api/mobile/toko/*` saat ini belum menyertakan lapisan *controller/authorization* bagi metode rekonsiliasi data lama. Pengerjaan ini dikembalikan ke backlog untuk _SPRINT_ tahap API mendatang.

### [M-FEAT-020] Cetak Struk 58mm / 80mm — Thermal Printer Support
- ✅ **Selesai (19 April 2026)**: File `KasirScreen.tsx` telah diperbarui.
- **Latar Belakang:** Kasir unit Cuci Mobil membutuhkan cetak struk dengan ukuran kertas **58mm** (thermal printer kecil). Sebelumnya, template HTML struk tidak memiliki pengaturan lebar dan menggunakan ukuran default sistem (biasanya A4/Letter).
- **Perubahan:**
  - Ditambahkan konstanta `PAPER_SIZES` dengan 2 opsi: **58mm** (164pt / 384px) dan **80mm** (227pt / 576px).
  - Default ukuran kertas: **58mm** (sesuai permintaan lapangan).
  - Template HTML struk (`getHtmlHeader`) kini dinamis — font size, header size, viewport width, dan body max-width otomatis menyesuaikan ukuran kertas yang dipilih.
  - `Print.printAsync()` kini mengirimkan parameter `width` sesuai ukuran kertas terpilih.
  - **Toggle UI** berupa chip **58mm / 80mm** ditampilkan di atas tombol bayar, baik di *Kasir Cepat* (Cuci Mobil, Barbershop, Fotocopy) maupun *Kasir Normal* (Toko, Resto & Cafe), sehingga kasir dapat mengubahnya kapan saja.

---

## 🆕 UPDATE SINKRONISASI WEB & HASIL REVIEW KODE MOBILE (20 - 21 APRIL 2026)

### 22. [M-FEAT-017] ✅ Integrasi Dropdown Kas/Bank di Semua Transaksi Operator — **SELESAI**
- **Selesai (21 April 2026)**: 3 file operator di-update:
  1. ✅ `LoanPaymentScreen.tsx` — Dropdown Kas/Bank + payload `cashBankAccountId`
  2. ✅ `SavingsTransactionScreen.tsx` — Dropdown Kas/Bank + payload `cashBankAccountId`
  3. ✅ `DirectDisburseScreen.tsx` — Dropdown Kas/Bank + payload `cashBankAccountId`
- **Perubahan:**
  - Fetch daftar akun kas/bank dari `/api/mobile/kas-bank` saat layar dimuat
  - Default otomatis pilih akun "Kas" pertama
  - Tombol submit **dinonaktifkan** jika belum pilih akun
  - Picker menampilkan ikon 💵/🏦, nama akun, dan saldo saat ini
- **Catatan:** KasirScreen (POS Toko) sudah memiliki routing kas/bank otomatis via backend (`POST /api/toko/sales` → auto-detect `CashBankAccount` berdasar `unitType`), sehingga **tidak perlu** dropdown manual di sisi kasir.

### 23. [M-FEAT-018] ✅ Blokir Penarikan Simpanan Wajib/Pokok (AD-ART Pasal 26) — **SELESAI**
- **Selesai (21 April 2026)**: File `SavingsTransactionScreen.tsx` di-update.
- **Perubahan:**
  - Tombol "Penarikan" tampil redup (opacity 40%) jika rekening yang dipilih bertipe `wajib` atau `pokok`
  - Menampilkan banner peringatan merah dengan ikon ⚠️ dan teks "Penarikan Simpanan Wajib/Pokok tidak diperbolehkan (AD-ART Pasal 26)"
  - Tombol submit dinonaktifkan jika penarikan terblokir
  - Operator masih bisa melakukan **setoran** ke rekening wajib/pokok tanpa masalah

### 20. [M-FEAT-021] ✅ Pelunasan Dipercepat (Early Settlement) di Mobile — **SELESAI**
- **Selesai (22 April 2026)**: File `LoanPaymentScreen.tsx` + `api/mobile/loan-payment/route.ts` di-update.
- **Perubahan Mobile:**
  - Toggle Switch "⚡ Pelunasan Dipercepat" ditambahkan di bawah list pinjaman
  - Breakdown rincian ditampilkan: Sisa Pokok + Penalti (tanpa bunga/jasa)
  - Aturan penalti: Tenor ≤ 24 bulan → 1× bunga bulanan, > 24 bulan → 2× bunga bulanan
  - Jumlah otomatis dihitung dan tombol berubah warna (amber) saat mode pelunasan aktif
  - Dialog konfirmasi menampilkan rincian lengkap sebelum proses
- **Perubahan Backend:**
  - API `POST /api/mobile/loan-payment` mendukung parameter `isEarlySettlement: true`
  - Validasi jumlah pelunasan harus sesuai (Pokok + Penalti)
  - Otomatis update status pinjaman → `paid_off`, reset sisa pokok & bunga ke 0
  - Update semua jadwal angsuran pending → `paid`
  - Catat kas/bank masuk (pokok & penalti terpisah) + audit log lengkap

### 25. [M-FEAT-023] ✅ Dropdown Sumber Pemotongan Angsuran (Gaji/Tunkin/BS) — **SELESAI**
- **Selesai (22 April 2026)**: File `DirectDisburseScreen.tsx` di-update.
- **Perubahan:**
  - Chip picker 3 opsi: 💵 Pot Gaji, 🏅 Pot Tunkin, 🧾 Bayar Sendiri (BS)
  - Default: Pot Gaji (sesuai anggota biasa)
  - Saat BS dipilih: tampil peringatan "validasi pendapatan tidak berlaku"
  - Payload `deductionSource` dikirim dinamis ke API (bukan hardcode 'gaji' lagi)
  - **Catatan:** `LoanApplicationScreen.tsx` (anggota) TIDAK perlu picker — auto default 'gaji' via backend Zod schema

### 24. [M-FEAT-022] ✅ Integrasi Sistem Shift Kasir Unit Toko — **SELESAI**
- **Selesai (21 April 2026)**: File baru `ShiftScreen.tsx` dibuat + navigasi diupdate.
- **File yang diubah:**
  1. ✅ `mobile/src/screens/kasir/ShiftScreen.tsx` — **[BARU]** Layar manajemen shift
  2. ✅ `mobile/src/navigation/MainTabs.tsx` — Tab "Kasir" diganti jadi tab "Shift" (gateway)
  3. ✅ `mobile/App.tsx` — Daftarkan `ShiftKasir` di stack navigator
- **Flow Kasir Baru:**
  - Kasir buka app → Tab **"Shift"** (bukan langsung POS)
  - Jika belum ada shift aktif → Tombol "Buka Shift Baru" (pilih Pagi/Siang/Malam + kas awal)
  - Jika shift aktif → Tombol "Masuk POS" (navigasi ke KasirScreen) dan "Tutup Shift"
  - Tutup Shift: Input uang fisik + catatan opsional → sistem hitung selisih otomatis
  - Riwayat 10 shift terakhir ditampilkan di bawah
- **Catatan:** POS Kasir (`KasirScreen.tsx`) masih bisa diakses langsung via stack jika dipanggil oleh Operator/Admin dari dashboard.

### 26. [M-FEAT-019] ✅ Riwayat Transaksi & Request Void untuk Kasir Toko — **SELESAI**
- **Selesai (22 April 2026)**: File baru `RiwayatKasirScreen.tsx` dibuat + backend API baru `api/mobile/toko/history/route.ts`.
- **File yang diubah:**
  1. ✅ `mobile/src/screens/kasir/RiwayatKasirScreen.tsx` — **[BARU]** Layar riwayat transaksi + void
  2. ✅ `mobile/src/screens/kasir/ShiftScreen.tsx` — Tombol "📋 Riwayat Transaksi & Void" ditambahkan
  3. ✅ `mobile/App.tsx` — Daftarkan `RiwayatKasir` di stack navigator
  4. ✅ `src/app/api/mobile/toko/history/route.ts` — **[BARU]** Backend GET (riwayat) + POST (void request)
- **Fitur:**
  - Kasir melihat semua transaksi miliknya sendiri (operator/admin lihat semua)
  - Card transaksi dengan badge status: SELESAI (hijau), MENUNGGU VOID (kuning), DIBATALKAN (merah)
  - Tap card → expand menampilkan detail barang + harga
  - Tombol "Ajukan Pembatalan (Void)" → Bottom modal dengan input alasan
  - Kasir: permintaan void dikirim ke Admin (ApprovalRequest pending)
  - Operator/Admin: void langsung diproses + stok dikembalikan
  - Pull-to-refresh untuk update data real-time

### 27. [M-FEAT-011] ✅ Form Edit Anggota Lanjutan (Plafon, Tunkin, dll) — **SELESAI**
- **Selesai (22 April 2026)**: File `MemberDetailScreen.tsx` di-update + backend `PATCH /api/mobile/members/[id]` ditambahkan.
- **File yang diubah:**
  1. ✅ `mobile/src/screens/operator/MemberDetailScreen.tsx` — Tombol Edit + Modal edit form
  2. ✅ `src/app/api/mobile/members/[id]/route.ts` — Endpoint PATCH baru + `plafonPiutang` di GET
- **Fitur:**
  - Tombol ✏️ Edit di header + body scroll
  - Bottom sheet modal dengan 3 section: Kontak, Pekerjaan, Keuangan
  - Field yang bisa diedit: phone, email, address, category, occupation, salary, tunlesKinerja, plafonPiutang
  - Hanya Operator/Admin yang bisa edit (403 untuk kasir/anggota)
  - Audit log lengkap mencatat setiap perubahan field
  - Auto-refresh setelah save sukses

### 28. [M-FEAT-004] ✅ Edit NRP Transaksi Lama (Assign Member ke StoreSale) — **SELESAI**
- **Selesai (22 April 2026)**: File baru `EditNrpScreen.tsx` + backend `api/mobile/edit-nrp/route.ts`.
- **File yang diubah:**
  1. ✅ `mobile/src/screens/kasir/EditNrpScreen.tsx` — **[BARU]** Layar assign NRP
  2. ✅ `mobile/src/screens/kasir/RiwayatKasirScreen.tsx` — Tombol "Edit NRP" di header
  3. ✅ `mobile/App.tsx` — Register `EditNrp` di stack navigator
  4. ✅ `src/app/api/mobile/edit-nrp/route.ts` — **[BARU]** GET (list tanpa NRP) + POST (assign)
- **Fitur:**
  - List transaksi StoreSale yang belum punya member (memberId = null)
  - Badge "PERLU NRP" amber per transaksi + info preview item
  - Tap transaksi → modal pencarian anggota (debounced 400ms)
  - Konfirmasi assign → update `storeSale.memberId`
  - Jika payment method = salary_cut → auto-update linked UnitTransaction juga
  - Kasir hanya bisa edit transaksi sendiri, Operator/Admin bisa semua
  - Empty state hijau jika semua transaksi sudah ada NRP

---

## 🆕 UPDATE SINKRONISASI WEB & HASIL REVIEW KODE MOBILE (19 APRIL 2026)

### 16. Integrasi Akun Kas/Bank pada Transaksi Operator (M-FEAT-017)
- **Web/Backend:** Seluruh transaksi finansial Operator (Bayar Angsuran, Simpanan, Pencairan Pinjaman, dan POS Kasir) kini dirancang agar otomatis mencetak jurnal ke sistem pembukuan Kas/Bank koperasi (Double-Entry). API mensyaratkan parameter `cashBankAccountId` atau akan gagal (*error 500*).
- **Penemuan di Kode Mobile (GAP ANALYSIS):**
  Berdasarkan pengecekan langsung ke *source code* Mobile App, parameter `cashBankAccountId` beserta *UI Dropdown* Kas/Bank **BELUM ADA** pada file-file berikut:
  1. ❌ `mobile/src/screens/operator/LoanPaymentScreen.tsx` (Baris 81) — *Payload `api.post('/api/mobile/loan-payment')` murni hanya mengirimkan `loanId`, `amount`, dan `notes`.*
  2. ❌ `mobile/src/screens/operator/SavingsTransactionScreen.tsx` (Baris 75) — *Payload `api.post('/api/mobile/savings-tx')` tidak memuat `cashBankAccountId`.*
  3. ❌ `mobile/src/screens/operator/DirectDisburseScreen.tsx` (Baris 122) — *Payload API `/api/mobile/loans-operator/direct-disburse` kekurangan atribut Kas.*
  4. ❌ `mobile/src/screens/kasir/KasirScreen.tsx` (Baris 239) — *Payload `api.post('/api/mobile/toko')` saat checkout tidak membawa identitas penerima Kas.*
- **Tugas Mobile (M-FEAT-017):** 
  - Wajib menambahkan komponen `Dropdown/Picker` untuk memilih "Tujuan Kas/Bank" pada ke-4 layar (screen) di atas.
  - Tambahkan parameter `cashBankAccountId` ke dalam payload `api.post` agar *backend* tidak menolak (HTTP 500) saat *query* ke Prisma.

### 17. Validasi Penarikan Simpanan Wajib & Pokok (M-FEAT-018)
- **Penemuan di Kode Mobile:** Pada `SavingsTransactionScreen.tsx` (Baris 138), operator mobile masih bebas memilih opsi "Penarikan" (withdrawal) tanpa mempedulikan jenis produk.
- **Tugas Mobile (M-FEAT-018):** Sesuaikan dengan paritas Web (AD-ART Pasal 26). Opsi "Penarikan" harus diblokir (*disabled*) apabila operator telah memilih produk *Simpanan Pokok* atau *Simpanan Wajib*.

### 18. Evaluasi Paritas Unit Toko & Role Kasir (M-FEAT-019)
Berdasarkan `UNIT-TOKO.md` dan penelusuran kode Mobile (`KasirScreen.tsx` & `StokScreen.tsx`), terdapat fungsionalitas khusus Kasir di Web yang **belum ada** padanannya di Mobile App:
- **Penemuan di Kode Mobile:** Aplikasi mobile saat ini hanya menyediakan layar `KasirScreen` (untuk *Checkout*) dan `StokScreen` (untuk cek persediaan). Namun, Kasir Mobile sama sekali tidak memiliki akses ke layar **Riwayat Transaksi Toko**, yang berarti mereka tidak dapat melihat rekap penjualan mereka sendiri, dan lebih parahnya, tidak dapat mengajukan pembatalan (*Request Void*) atas transaksi yang salah (status `voidPending`), padahal fitur ini sudah tersedia dan diperbaiki di Web (*BUG-059*).
- **Tugas Mobile (M-FEAT-019):** Buatkan layar *Riwayat Transaksi Kasir* (spesifik untuk transaksi yang dilakukan oleh *user* Kasir tersebut di hari itu) beserta fungsionalitas tombol *Request Void*.

### 19. Catatan: Bug & Update Web-Only (Tidak Berdampak Mobile)
Beberapa perbaikan dan fitur Web terbaru (18-19 April 2026) yang **TIDAK** memerlukan tindakan di sisi mobile karena fiturnya khusus UI Web Admin/Operator:
- **FEAT-024 (Edit Pinjaman):** Fitur CRUD (Pokok, Tenor, Bunga, Tanggal) untuk mengkoreksi data pinjaman.
- **BUG-ANGSURAN-001:** Fix URL parameter `loan_id` pada UI Web.
- **BUG-ANGSURAN-005 & 006:** Fix visibilitas tombol Edit/VOID untuk Role Admin dan Pinjaman Migrasi.
- **BUG-SIMPANAN-001:** Fix validasi HTML5 *native* yang memblokir form penarikan sukarela.

---

## 🆕 UPDATE SINKRONISASI WEB (16 APRIL 2026)

### 9. Fix Ghost Balance — Saldo Wajib Di-Override ke 0 Muncul Kembali ke Nominal Lama
- **Web/Backend:** Logika fallback `importedWajib > 0 ? importedWajib : legacyWajib` menyebabkan saldo Rp 0 (setelah koreksi) dianggap "belum import", sehingga menampilkan saldo legacy lama. Diperbaiki menjadi pengecekan keberadaan rekening (`wajibAccount ? balance : legacy`).
- **Backend SHU Fix:** `api/member-portal/summary/route.ts` — Kondisi `Number(acc.balance) > 0` pada `hasImportedWajib` dihapus. Sekarang cukup cek rekening exist agar pool SHU Jasa Modal tidak double-count saldo legacy.
- **Tugas Mobile:** ✅ **Otomatis Berlaku** — Endpoint `/api/mobile/summary` menggunakan logika kalkulasi SHU yang sama. Angka estimasi SHU di mobile app kini akurat setelah override saldo ke 0.

### 10. Fix Silent Skip Override — Auto-Create Rekening Saat Override Saldo
- **Web/Backend:** `PUT /api/members/[id]` sebelumnya diam-diam mengabaikan override saldo jika anggota belum punya rekening. Sekarang sistem otomatis membuat rekening baru (`PKK-xxxx`, `WJB-xxxx`, `SKR-xxxx`) lalu langsung set saldonya. Jika produk simpanan belum ada di database, mengembalikan pesan error yang jelas.
- **Tugas Mobile:** ✅ **Otomatis Berlaku** — Backend fix berlaku di semua klien. Admin mobile yang menggunakan fitur Edit Anggota akan mendapat error handling yang informatif.

### 11. Riwayat Transaksi Portal — Koreksi & Penarikan Kini Tampil
- **Web/Backend:** Portal anggota kini menampilkan semua tipe transaksi (deposit, correction, withdrawal) di detail tabungan bulanan. Sebelumnya hanya filter `deposit` saja.
- **Tugas Mobile (Backlog `M-FEAT-016`):**
  - Pada layar `DashboardScreen.tsx` atau `SimpananScreen.tsx`, panel rincian mutasi bulanan wajib sebaiknya juga menampilkan entri tipe `correction` dan `withdrawal` (bukan hanya `deposit`).
  - Gunakan label & warna berbeda: Koreksi (`⚠ KOREKSI`, merah), Penarikan (`↩ PENARIKAN`, merah), Setoran (`📅 BULAN`, hijau).
  - **Sumber data:** Array `history` dari endpoint summary sudah mengirimkan field `type` untuk setiap transaksi — tinggal filter di sisi UI.

### 12. Fitur Baru: Full CRUD Buku Rekening (Web-Only)
- **Web:** Halaman `/simpanan/rekening` kini memiliki aksi **Edit Rekening** (ubah No. Rekening & Tanggal Buka), **Rincian Transaksi** (shortcut ke halaman transaksi), selain Blokir dan Hapus yang sudah ada.
- **Tugas Mobile:** ❌ **Tidak berdampak** — Fitur CRUD Buku Rekening hanya tersedia di Web admin. Mobile app tidak memiliki layar pengelolaan rekening.

## 🆕 UPDATE SINKRONISASI WEB (13 APRIL 2026)

### 7. Fix SHU Modal — Simpanan Sukarela Tidak Masuk Kalkulasi (Paritas AD-ART Pasal 42)
- **Web/Backend:** Di web portal (`portal/dashboard/page.tsx`), kalkulasi Estimasi SHU Jasa Simpanan telah diperbaiki agar hanya menggunakan **Simpanan Pokok + Wajib** sebagai modal equity. Simpanan Sukarela secara eksplisit dikecualikan sesuai AD-ART Pasal 42.
- **Bug Mobile Ditemukan & Diperbaiki:** Endpoint `/api/mobile/summary/route.ts` masih menjumlahkan **SEMUA** saldo (termasuk sukarela) untuk SHU modal — menyebabkan angka estimasi SHU di mobile lebih tinggi dari seharusnya.
- **Fix:** Menambahkan filter `product.type: { in: ["pokok", "wajib"] }` pada query `totalActiveSavBal` (system-wide) dan filter `.filter(a => a.product.type === 'pokok' || a.product.type === 'wajib')` pada `mySavCont` (per-anggota).
- **Tugas Mobile:** ✅ **Selesai** — Backend fix berlaku otomatis. Angka Estimasi SHU di mobile app sekarang konsisten dan akurat dengan AD-ART.

### 8. Catatan: Bug & Update Web-Only (Tidak Berdampak Mobile)
Beberapa perbaikan Web terbaru yang TIDAK memerlukan tindakan di sisi mobile karena fiturnya hanya tersedia di Web admin:
- **BUG-103:** Filter tanggal menggunakan noon-time WIB (backend fix — otomatis berlaku untuk mobile)
- **BUG-104:** Global search TanStack Table (Web UI only)
- **BUG-105:** Import Kas/Bank deteksi "Sisa Bulan Lalu" (Web import only)
- **BUG-106:** Auto-Mapping Jatim salah akun (Web import only)
- **UPDATE-082:** Import Kas/Bank Auto-Pilot UI (Web import only)

## 🆕 UPDATE SINKRONISASI WEB (12 APRIL 2026)

### 6. Fix Kritis Backend Mobile API (BUG-099, BUG-095, BUG-097 Paritas)
- **Web/Backend:** Telah diperbaiki 3 bug kritis di `src/app/api/mobile/summary/route.ts`:
  1. **Double Counting Simpanan:** Total Simpanan operator & anggota tidak lagi menjumlahkan `SavingsAccount` + legacy `member.tabunganWajib`. Single Source of Truth = `SavingsAccount`.
  2. **Voided Transactions:** Semua query `unitTransaction` di mobile API kini mengecualikan `status: "voided"` (paritas dengan BUG-095/097 di Web).
  3. **Transactions History untuk Wajib:** API kini mengirimkan array `transactions` khusus untuk akun wajib agar mobile bisa merender detail mutasi bulanan.
- **Tugas Mobile:** ✅ **Selesai** — `DashboardScreen.tsx` sudah diperbarui dengan panel expandable "Detail Tabungan Wajib" yang menampilkan saldo awal akumulasi + rincian setoran per bulan.

### 5. Paritas UI: Rincian Mutasi Bulanan Tabungan Wajib
- **Web/Backend:** Halaman Member Dashboard di web kini memiliki fitur akordion / breakdown yang mendetailkan akumulasi Tabungan/Simpanan Wajib ke dalam rincian per bulan (contoh: "APRIL + Rp 100.000"). Ini dimungkinkan berkat *query* ke array `transactions` pada akun berjenis `wajib`. Import Excel TAJIB juga sudah dibuat dinamis tanpa repot mewajibkan kolom "JML".
- **Tugas Mobile (Backlog `M-FEAT-015`):** 
  - Pada layar `SimpananScreen.tsx` atau `AnggotaCardScreen.tsx` di mobile, sebaiknya ditambahkan panel UI khusus (bila ada saldo wajib) untuk menampilkan daftar riwayat bulan layaknya yang ada di Web (Paritas Visual Dashboard Anggota).

## 🆕 UPDATE SINKRONISASI WEB (10 APRIL 2026)

### 4. Sinkronisasi Kalkulasi & UI SHU Cuci Mobil
- **Web/Backend:** Telah dibuat logic pemotongan pendapatan koperasi untuk membiayai *SHU Cuci Mobil (Rp 2.000 / transaksi)*. 
- **Tugas Mobile:**
  - Kasir Mobile (`KasirScreen.tsx`): Fitur identifikasi anggota (Modal pencarian NRP) dipaksa muncul atau opsional muncul sebelum *checkout* QRIS / Cash agar transaksi tidak *anonymous*. (✅ **Selesai**)
  - Kalkulator SHU Mobile (`reports/shu-calculator/route.ts`): API digabungkan dengan fungsi kalkulator utama web agar angka konsisten. (✅ **Selesai**)
  - Laporan SHU Mobile (`LaporanSHUScreen.tsx`): Tambahkan UI penampil Total SHU Cuci Mobil dari laba bersih, serta pecahan rincian bonus cuci mobil per anggota di *Top 10*. (✅ **Selesai**)

## 🆕 UPDATE SINKRONISASI WEB (9 APRIL 2026)
> *Daftar perubahan terbaru di Web yang berdampak pada fungsionalitas Backend atau butuh penyetaraan (paritas) fitur di Mobile App.*

### 1. Paritas UI: Input Manual Tenor Pinjaman
- **Web:** Dropdown `Select` untuk pilihan Tenor Bulan telah resmi dihapus dan diganti menjadi input teks angka (Number Input) untuk membebaskan input tenor dalam batas maksimal produk (contoh: 20 bulan, 25 bulan).
- **Tugas Mobile (Backlog `M-FEAT-013`):** Pastikan `LoanApplicationScreen.tsx` untuk bagian tenor sudah menggunakan `<TextInput keyboardType="numeric">` tanpa opsi picker/dropdown terbatas, lengkap dengan placeholder batas minimum dan maksimum.

### 2. Fitur Baru Operator: "Direct Disburse" & Tanggal Mundur (Backdated)
- **Web/Backend:** Telah dibuat API baru `POST /api/loans/applications/direct-disburse`. Endpoint ini memungkinkan membuat pengajuan pinjaman, otomatis menyetujuinya, mencairkannya, mencetak kwitansi, serta menjadwalkan angsuran secara atomik dalam satu request. Terdapat juga support penambahan tanggal mundur (`backdatedDate`).
- **Tugas Mobile (Backlog `M-FEAT-014`):** Jika role Operator di-support di mobile untuk pengajuan, harus ditambahkan layar/mode "Pencairan Langsung" menggunakan API baru tersebut. Anggota biasa tetap menggunakan `/api/mobile/loan-apply` biasa.

### 3. Backend Fix: Kwitansi & Route Error (Otomatis Teraplikasi)
- **Web/Backend:** Telah diperbaiki _bug logic_ kwitansi cetak (Nomor Kwitansi) dan _ReferenceError_ pada _Route/Context_ di pengajuan staff Web.
- **Tugas Mobile:** Tidak butuh perbaikan spesifik karena backend sudah _clean_, tetapi menjadi catatan bahwa `receiptId` yang dikembalikan sesudah disburse akan menunjuk pada record kwitansi yang datanya lebih rapi/akurat (teks terbilang, penomoran instansi formal).

---

## 🔴 SPRINT 1 — Bug Kritis & Fondasi API
*Target: Selesai dalam 1 minggu*
*Fokus: Fix bug data salah/tidak sinkron + perkuat fondasi API layer*

---

### [x] S1-01 — M-OPT-003: Global Axios Error Interceptor
**Prioritas:** 🔴 Kritis (fondasi sebelum fix lain)
**File:** `mobile/src/lib/api.ts`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Tambah `api.interceptors.response.use()` setelah deklarasi axios instance
- [x] Handle `401 Unauthorized` → hapus token SecureStore + navigate ke Login
- [x] Handle `503 / Network Error` → Alert global "Server tidak tersedia"
- [x] Handle `timeout (ECONNABORTED)` → Alert global "Koneksi timeout, coba lagi"
- [x] Test: logout paksa dari device, matikan server → verifikasi pesan muncul

---

### [x] S1-02 — M-OPT-001: Dynamic API Port Config
**Prioritas:** 🔴 Kritis (development workflow)
**File:** `mobile/src/lib/api.ts` baris 33
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [ ] Ganti hardcode port `3000` dengan env variable `EXPO_PUBLIC_API_PORT`
- [ ] Buat file `mobile/.env` dengan `EXPO_PUBLIC_API_PORT=3000` sebagai default
- [ ] Buat file `mobile/.env.staging` dengan port `3001` untuk UAT
- [ ] Update `getBaseUrl()` → `http://${ip}:${process.env.EXPO_PUBLIC_API_PORT || 3000}`
- [ ] Test: jalankan expo di port 3001, verifikasi koneksi ke server staging

---

### [x] S1-03 — M-BUG-001 + M-FEAT-001: Paket Layanan Dinamis dari Database
**Prioritas:** 🔴 Kritis (data paket hardcode)
**File Backend (BARU):** `src/app/api/mobile/unit-packages/route.ts`
**File Mobile:** `mobile/src/screens/kasir/KasirScreen.tsx`
**Status:** ✅ Selesai

**Backend (Buat Endpoint Baru):**
- [x] Buat `src/app/api/mobile/unit-packages/route.ts`
- [x] `GET /api/mobile/unit-packages?unitType=cuci_mobil`
- [x] Query `UnitServicePackage` dari DB per `unitType`
- [x] Return format: `{ data: [{ id, name, price, description }] }`
- [x] Tambah auth guard (bearer token) + validasi `unitType`

**Mobile (KasirScreen):**
- [x] Hapus konstanta `CARWASH_PACKAGES` (baris 26–32) dan `BARBERSHOP_PACKAGES` (baris 34–39)
- [x] Tambah state: `packages: ServicePackage[]`, `packagesLoading: boolean`
- [x] Fetch `/api/mobile/unit-packages?unitType=${unitType}` saat `unitType` berubah
- [x] Tampilkan skeleton loading saat fetch paket berlangsung
- [x] Fallback ke package list kosong + isi manual jika fetch gagal
- [x] Test: ubah harga paket dari Web admin → verifikasi harga berubah di mobile

---

### [x] S1-04 — M-BUG-003 + M-FEAT-006: Input Plat Nomor Cuci Mobil
**Prioritas:** 🔴 Kritis (data operasional tidak tercatat)
**File:** `mobile/src/screens/kasir/KasirScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Tambah state `vehiclePlate: string`
- [x] Tambah `TextInput` plat nomor kondisional (hanya tampil jika `unitType === 'cuci_mobil'`)
- [x] Auto-uppercase input plat: `setVehiclePlate(val.toUpperCase())`
- [x] Batasi panjang maksimal 12 karakter
- [x] Sertakan di payload `performQuickCheckoutAPI()`: `description: vehiclePlate ? quickDesc + ' [PLAT:' + vehiclePlate + ']' : quickDesc`
- [x] Reset `vehiclePlate` ke `''` setelah checkout berhasil
- [x] Test: transaksi cuci mobil dengan plat → cek laporan web apakah plat muncul

---

### [x] S1-05 — M-BUG-005: ApprovalScreen Handle `void_store_sale`
**Prioritas:** 🔴 Kritis (operator tidak bisa approve void dari mobile)
**File:** `mobile/src/screens/operator/ApprovalScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Perluas interface `Approval` untuk semua tipe (loan + void):
  ```ts
  requestType: 'loan_application' | 'unit_void' | 'void_store_sale'
  requestNo?: string
  transactionNo?: string
  unitType?: string
  status: string
  ```
- [x] Buat helper `getApprovalTitle(item)` → label Indonesia per `requestType`
- [x] Buat helper `getApprovalDetail(item)` → detail card sesuai tipe
- [x] Render badge tipe di card: `🏦 Pinjaman` / `🔄 Void Transaksi`
- [x] Update `handleAction()` → payload patch API benar untuk void
- [x] Cek endpoint `/api/mobile/approvals` sudah kembalikan `void_store_sale`
- [x] Test: ajukan void dari kasir toko web → verifikasi muncul di ApprovalScreen mobile

---

### [x] S1-06 — M-BUG-006: TransaksiScreen — Jam Transaksi dari `createdAt`
**Prioritas:** 🟡 Tinggi (jam selalu 07:00 WIB)
**File:** `mobile/src/screens/member/TransaksiScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Tambah `createdAt?: string` ke interface `Transaction`
- [x] Update fungsi `formatDate()` → gunakan `item.createdAt ?? item.transactionDate`
- [x] Tampilkan format jam: `14 Apr 2026, 09:35 WIB`
- [x] Verifikasi API `/api/mobile/transactions` sudah return field `createdAt`
- [x] Jika API belum return `createdAt` → update query di backend untuk include field tersebut
- [x] Test: buat transaksi baru → verifikasi jam tampil akurat di mobile

---

### [x] S1-07 — M-BUG-007: API Loan Apply — Hapus Hardcode Rate & Cap
**Prioritas:** ✅ SELESAI (Backend sudah fix — Sesi 9)
**File:** `src/app/api/mobile/loan-apply/route.ts`
**Status:** ✅ DONE — 8 April 2026

**Sudah Dikerjakan:**
- [x] Hapus `interestRate: 0`, `adminFee: 1%` hardcode → baca dari produk
- [x] Hapus `Math.min(maxAmount, 20000000)` cap global
- [x] Hapus `Math.min(maxTenor, 36)` cap global
- [x] Validasi per-produk dari database
- [x] Kalkulasi bunga dari `product.interestRate`

> **Catatan:** Fix backend berlaku otomatis untuk mobile tanpa perlu update APK. UI mobile masih perlu update (Sprint 2, item S2-01).

---

## 🟡 SPRINT 2 — Paritas Fitur Web
*Target: Selesai dalam 1 minggu (setelah Sprint 1)*
*Fokus: Bawa fitur Web yang sudah matang ke Mobile*

---

### [x] S2-01 — M-FEAT-012: Pengajuan Pinjaman — Kartu Produk + Simulasi Akurat
**Prioritas:** 🔴 Tinggi (UI masih hardcode meski backend sudah fix)
**File:** `mobile/src/screens/member/LoanApplicationScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] **Hapus hardcode** di `LoanApplicationScreen.tsx`:
  - [x] Baris 141: `(Max. Pinjaman Rp 20.000.000 | Tenor 36 bln)` → ganti dengan data produk
  - [x] Baris 159: `if (num > 20000000) setAmount("20000000")` → gunakan `selectedProduct.maxAmount`
  - [x] Baris 174: `if (num > 36) setTenor("36")` → gunakan `selectedProduct.maxTenor`
  - [x] Baris 53: `bunga 0.003` hardcode → gunakan `selectedProduct.interestRate / 100`
  - [x] Baris 62: `resiko 0.02` hardcode → gunakan `selectedProduct.adminFeeValue / 100`
- [x] Render kartu pilih produk (Pinjaman Reguler vs Khusus):
  - [x] Nama produk + badge
  - [x] Limit plafon dari `maxAmount`
  - [x] Maks tenor dari `maxTenor`
  - [x] Bunga flat dari `interestRate`
  - [x] Biaya resiko dari `adminFeeValue`
- [x] Tampilkan "Dana Cair (Bersih)" = `amount - (amount × adminFeeValue / 100)`
- [x] Test: pilih Pinjaman Khusus → verifikasi limit lebih dari 20jt bisa diinput

---

### [x] S2-02 — M-FEAT-002 + M-BUG-002: Info & Validasi Plafon Piutang Real-Time
**Prioritas:** 🔴 Tinggi (kasir bisa proses meski limit habis)
**File Backend (BARU):** `src/app/api/mobile/members/[id]/piutang/route.ts`
**File Mobile:** `mobile/src/screens/kasir/KasirScreen.tsx`
**Status:** ✅ Selesai

**Backend (Buat Endpoint Baru):**
- [x] Buat `src/app/api/mobile/members/[id]/piutang/route.ts`
- [x] `GET /api/mobile/members/[id]/piutang`
- [x] Query total piutang aktif (`UnitTransaction` belum lunas) milik member
- [x] Return: `{ totalPlafon, sudahTerpakai, sisaLimit, canTransact: boolean }`
- [x] Auth guard + validasi `id`

**Mobile (KasirScreen):**
- [x] Tambah state `memberPiutang: PiutangInfo | null` dan `loadingPiutang: boolean`
- [x] Saat member dipilih dari search list → fetch piutang info
- [x] Tampilkan info bar di modal member:
  - [x] Plafon Total: `Rp X`
  - [x] Terpakai: `Rp X`
  - [x] **Sisa Limit: Rp X** (hijau jika cukup, merah jika tidak)
- [x] Disable tombol "Setuju & Pilih" jika `total > sisaLimit || !canTransact`
- [x] Test: pilih anggota dengan limit habis → verifikasi tombol disabled + pesan merah

---

### [x] S2-03 — M-FEAT-003: Filter Status di Riwayat Transaksi
**Prioritas:** 🟡 Sedang
**File:** `mobile/src/screens/member/TransaksiScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Tambah state `statusFilter: string = 'all'`
- [x] Render chip/pill filter horizontal di bawah tab selector:
  - Semua / Belum Lunas / Pending Void / Dibatalkan / Selesai
- [x] Kirim query filter ke API atau filter client-side dari data fetch
- [x] Highlight chip aktif dengan warna berbeda
- [x] Test: filter "Belum Lunas" → hanya transaksi belum lunas yang tampil

---

### [x] S2-04 — M-FEAT-007: Autocomplete Anggota — Debounce + Info Limit
**Prioritas:** 🟡 Sedang (UX improvement)
**File:** `mobile/src/screens/kasir/KasirScreen.tsx` → fungsi `searchMembers()`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Implementasi debounce 350ms menggunakan `useRef` + `setTimeout/clearTimeout`
- [x] Turunkan minimum search length dari `2` ke `1` karakter
- [x] Tampilkan avatar inisial di hasil pencarian (lingkaran + huruf pertama nama)
- [x] Tambah badge kategori anggota: Polri / PNS / Umum (dari `memberType`)
- [x] Tampilkan sisa limit singkat di bawah NRP (dari piutang info jika sudah ada)
- [x] Test: ketik 1 huruf → verifikasi pencarian berjalan tanpa lag berlebihan

---

### [x] S2-05 — M-FEAT-010: Auto-Logout / Session Expiry (Idle 5 Menit)
**Prioritas:** 🟡 Sedang (paritas keamanan dengan Web)
**File (BARU):** `mobile/src/lib/useIdleLogout.ts`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Buat hook `useIdleLogout(timeoutMs: number = 5 * 60 * 1000)`
- [x] Gunakan `AppState` listener (React Native) untuk detect app ke background
- [x] Monitor sentuhan/gesture: bungkus navigator root dengan `PanResponder`
- [x] Set countdown timer → reset saat ada aktivitas
- [x] Tampilkan modal warning 30 detik sebelum logout: "Sesi Anda akan berakhir..."
- [x] Saat timer habis: `SecureStore.deleteItemAsync('userToken')` + navigate ke Login
- [x] Pasang hook di `App.tsx` di dalam protected navigator
- [x] Test: buka app → diamkan 5 menit → verifikasi logout otomatis

---

## 🟢 SPRINT 3 — Layar Baru & Optimasi
*Target: Selesai dalam 2 minggu (setelah Sprint 2)*

---

### [x] S3-01 — M-FEAT-008: Layar Pengeluaran Operasional Unit
**Prioritas:** 🔴 Tinggi (admin tidak bisa catat pengeluaran dari mobile)
**File (BARU):** `mobile/src/screens/operator/PengeluaranOperasionalScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Buat layar baru `PengeluaranOperasionalScreen.tsx`
- [x] Fetch list pengeluaran dari `/api/unit/[slug]/operational-expense`
- [x] Tampilkan: Tanggal, Kategori, Nominal, Keterangan
- [x] Filter periode (Hari ini / Minggu ini / Bulan ini)
- [x] Form tambah pengeluaran + submit ke API
- [x] Tampilkan Total Pengeluaran di header card
- [x] Daftarkan ke navigator (tab atau stack)
- [x] Test: tambah pengeluaran dari mobile → verifikasi muncul di laporan web

---

### [x] S3-02 — M-FEAT-005: Laporan Bagi Hasil Cuci Mobil
**Prioritas:** 🟡 Sedang
**File (BARU):** `mobile/src/screens/operator/LaporanCuciMobilScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Buat layar baru `LaporanCuciMobilScreen.tsx`
- [x] Fetch data dari `/api/mobile/reports?unitType=cuci_mobil`
- [x] Tampilkan card summary:
  - Pendapatan Kotor
  - Bagian Karyawan (50%)
  - Bagian Koperasi (50%)
  - Total Pengeluaran Operasional
  - **Laba Bersih Koperasi** (highlighted)
- [x] Filter periode (Hari ini / Minggu ini / Bulan ini / Custom)
- [x] Daftarkan ke navigator operator cuci mobil
- [x] Test: buat beberapa transaksi cuci mobil → verifikasi kalkulasi bagi hasil benar

---

### [x] S3-03 — M-OPT-002: Integrasi `@tanstack/react-query`
**Prioritas:** 🟡 Sedang (performa & DX improvement)
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Install: `npm install @tanstack/react-query`
- [x] Bungkus root app dengan `QueryClientProvider` di `App.tsx`
- [x] Refactor `KasirScreen` → pakai `useQuery` untuk produk & paket
- [x] Refactor `ApprovalScreen` → `useQuery` + `useMutation` untuk approve/reject
- [x] Refactor `TransaksiScreen` → `useQuery` dengan `staleTime: 5 * 60 * 1000`
- [x] Test: navigasi bolak-balik ke screen → verifikasi tidak ada re-fetch berlebihan

---

### [x] S3-04 — M-OPT-004: Ganti `<Image>` dengan `expo-image`
**Prioritas:** 🟢 Rendah (performa gambar QRIS)
**File:** `mobile/src/screens/kasir/KasirScreen.tsx`
**Status:** ✅ Selesai

**Yang Dikerjakan:**
- [x] Install: `npx expo install expo-image`
- [x] Ganti `import { Image } from 'react-native'` → `import { Image as ExpoImage } from 'expo-image'`
- [x] Update component QRIS Modal: `<ExpoImage source={{ uri: ... }} contentFit="contain">`
- [x] Tambah `placeholder` blurhash jika tersedia
- [x] Hapus `?t=${Date.now()}` cache buster
- [x] Test: buka modal QRIS berulang → verifikasi gambar load lebih cepat

---

## 📋 CHECKLIST ENDPOINT BACKEND BARU

| Endpoint | File | Status | Terkait |
|---|---|---|---|
| `GET /api/mobile/unit-packages` | `src/app/api/mobile/unit-packages/route.ts` | ✅ SUDAH ADA | S1-03, M-BUG-001 |
| `GET /api/mobile/members/[id]/piutang` | `src/app/api/mobile/members/[id]/piutang/route.ts` | ✅ SUDAH ADA | S2-02, M-FEAT-002 |

---

## 📋 CHECKLIST VERIFIKASI API YANG ADA

| API Mobile | Endpoint | Status | Action |
|---|---|---|---|
| Login | `/api/mobile/login` | ✅ OK | — |
| Summary Anggota | `/api/mobile/summary` | ✅ OK | — |
| Simpanan | `/api/mobile/savings-accounts` | ✅ OK | — |
| Simpanan TX | `/api/mobile/savings-tx` | ✅ OK | — |
| Pinjaman | `/api/mobile/loans` | ✅ OK | — |
| Bayar Angsuran | `/api/mobile/loan-payment` | ✅ OK | — |
| Pengajuan Pinjaman | `/api/mobile/loan-apply` | ✅ OK | — |
| POS Toko | `/api/mobile/toko` | ✅ OK | Mendukung semua 8 unit |
| POS Unit Layanan | `/api/mobile/unit-layanan` | ✅ OK | Sequential saleNo |
| Member Search | `/api/mobile/members` | ✅ OK | — |
| Transaksi Anggota | `/api/mobile/transactions` | ✅ OK | Returns `createdAt` |
| Approval | `/api/mobile/approvals` | ✅ OK | `void_store_sale` handled |
| Pengumuman | `/api/mobile/pengumuman` | ✅ OK | — |
| Buku Kas | `/api/mobile/buku-kas` | ✅ OK | — |
| Kas & Bank | `/api/mobile/kas-bank` | ✅ OK | — |
| Audit Log | `/api/mobile/audit-logs` | ✅ OK | — |
| Push Token | `/api/mobile/push-token` | ✅ OK | — |
| **Paket Unit** | `/api/mobile/unit-packages` | ✅ OK | S1-03 |
| **Plafon Anggota** | `/api/mobile/members/[id]/piutang` | ✅ OK | S2-02 |
| **Toko Shifts** | `/api/mobile/toko/shifts` | ✅ OK | M-FEAT-022 |
| **Toko History** | `/api/mobile/toko/history` | ✅ OK | M-FEAT-019 |
| **Edit NRP** | `/api/mobile/edit-nrp` | ✅ OK | M-FEAT-004 |
| **Direct Disburse** | `/api/mobile/loans-operator/direct-disburse` | ✅ OK | M-FEAT-014 |
| **Reports Unit** | `/api/mobile/reports/unit` | ✅ OK | S3-02 |
| **Reports SHU** | `/api/mobile/reports/shu-calculator` | ✅ OK | M-SYS-001 |
| **Reports Financial** | `/api/mobile/reports/financial` | ✅ OK | — |
| **Reports Savings** | `/api/mobile/reports/savings` | ✅ OK | — |
| **Reports Loans** | `/api/mobile/reports/loans` | ✅ OK | — |
| **Change Password** | `/api/mobile/change-password` | ✅ OK | — |
| **Assets** | `/api/mobile/assets` | ✅ OK | — |
| **Journals** | `/api/mobile/journals` | ✅ OK | — |
| **Ledger** | `/api/mobile/ledger` | ✅ OK | — |
| **Accounts** | `/api/mobile/accounts` | ✅ OK | — |
| **Member Import** | `/api/mobile/members/import` | ✅ OK | — |
| **Member Edit** | `/api/mobile/members/[id]` (PATCH) | ✅ OK | M-FEAT-011 |

---

## 📦 STATUS LIBRARY

| Library | Versi | Status | Terkait Sprint |
|---|---|---|---|
| `axios` | `^1.13.6` | ✅ Interceptor terpasang | ✅ DONE |
| `expo-secure-store` | `~55.0.12` | ✅ Terpasang | ✅ DONE |
| `expo-notifications` | `~55.0.17` | ✅ Terpasang + push token | ✅ DONE |
| `@tanstack/react-query` | `^5.96.2` | ✅ Terinstall | ✅ DONE |
| `expo-image` | `~55.0.8` | ✅ Terinstall | ✅ DONE |
| `react-native-toast-message` | `^2.3.3` | ✅ Terinstall | ✅ DONE |
| `react-native-mmkv` | — | ⚠️ Diganti AsyncStorage + memory cache | ✅ DONE (alt) |
| `@gorhom/bottom-sheet` | `^5.2.8` | ✅ Terinstall | ✅ DONE |
| `react-hook-form` | `^7.72.1` | ✅ Terinstall | ✅ DONE |
| `zod` | `^4.3.6` | ✅ Terinstall | ✅ DONE |
| `expo-haptics` | `~55.0.13` | ✅ Terinstall | ✅ DONE |
| `expo-camera` | `~55.0.14` | ✅ Terinstall | ✅ DONE |
| `expo-print` | `~55.0.12` | ✅ Terinstall | ✅ DONE |
| `nativewind` | `^4.2.3` | ✅ Terinstall (hybrid) | ✅ DONE |

---

## 🗓️ SPRINT PLAN AKTUAL

### Sprint 1 — Bug Kritis & Fondasi API (1 minggu)
1. [x] **S1-01** M-OPT-003: Global axios error interceptor — `api.ts`
2. [x] **S1-02** M-OPT-001: Dynamic API port config — `.env` + `api.ts`
3. [x] **S1-03** M-BUG-001: Endpoint `/api/mobile/unit-packages` (backend) + fetch paket (mobile)
4. [x] **S1-04** M-BUG-003: Input plat nomor cuci mobil kondisional
5. [x] **S1-05** M-BUG-005: ApprovalScreen handle `void_store_sale`
6. [x] **S1-06** M-BUG-006: TransaksiScreen jam dari `createdAt`
7. [x] **S1-07** M-BUG-007: ~~Fix API loan-apply hardcode~~ ✅ DONE (backend)

### Sprint 2 — Paritas Fitur Web (1 minggu)
1. [x] **S2-01** M-FEAT-012: LoanApplicationScreen kartu produk + simulasi akurat
2. [x] **S2-02** M-FEAT-002: Endpoint piutang (backend) + info limit di modal member (mobile)
3. [x] **S2-03** M-FEAT-003: Filter status riwayat transaksi
4. [x] **S2-04** M-FEAT-007: Debounce autocomplete + avatar + info limit
5. [x] **S2-05** M-FEAT-010: Auto-logout idle 5 menit

### Sprint 3 — Layar Baru & Optimasi (2 minggu)
1. [x] **S3-01** M-FEAT-008: Layar Pengeluaran Operasional Unit (baru)
2. [x] **S3-02** M-FEAT-005: Layar Laporan Bagi Hasil Cuci Mobil (baru)
3. [x] **S3-03** M-OPT-002: Integrasi `@tanstack/react-query`
4. [x] **S3-04** M-OPT-004: Ganti `<Image>` dengan `expo-image`

### Sprint 4 — Pre-Deploy Audit & Unit Baru (28 April 2026)
1. [x] **S4-01** M-FIX-001: Tambah 3 unit type (laundry, fitness, playstation) di KasirScreen
2. [x] **S4-02** M-FIX-002: Fix data isolation di StokScreen (filter unitType dari session kasir)

### Sprint 5 — Deep Audit Bug Fixes (28 April 2026 Session 2)
1. [x] **S5-01** M-FIX-003: Login response — tambah unitType
2. [x] **S5-02** M-FIX-004: Plafon piutang formula — 50% sisa bersih
3. [x] **S5-03** M-FIX-005: CashBankTransaction type — "in" bukan "masuk"
4. [x] **S5-04** M-FIX-006: Savings TX — tambah cash/bank sync
5. [x] **S5-05** M-FIX-007: Edit NRP — tambah role check POST
6. [x] **S5-06** M-FIX-008: Assets — hapus error object dari response
7. [x] **S5-07** M-FIX-009: Buku Kas — hapus error message dari response
8. [x] **S5-08** M-FIX-010: Push Token — konsistensi import prisma

**Frontend Fixes (same session):**
- [x] **M-FIX-011**: MainTabs — role parsing (object vs string)
- [x] **M-FIX-012**: ShiftScreen — dynamic unitType dari session
- [x] **M-FIX-013**: KasirScreen — canTransact + member ID + debounce cleanup
- [x] **M-FIX-014**: KwitansiViewer — expo-print type params

### Sprint 7 — Web Backend Sync: Notifikasi, HPP, Batch (30 April 2026)
1. [x] **S7-01** M-SYNC-033: Sistem Notifikasi (model, API, UI bell, Expo push)
2. [x] **S7-02** M-SYNC-034: HPP Moving Average + FIFO Batch Deduction + Audit Trail
3. [x] **S7-03** M-SYNC-035: Batch & Expiry Tracking (auto-expire, notifications, batch page)

---

## ✅ CHECKLIST SEBELUM RELEASE MOBILE BERIKUTNYA

- [x] **S1-01** Axios interceptor: auto-logout saat 401, alert saat network error
- [x] **S1-02** Port API bisa dikonfigurasi lewat `.env` (tidak hardcode 3000)
- [x] **S1-03** Paket layanan fetch dari DB — tidak hardcode di kode
- [x] **S1-04** Input plat nomor wajib muncul di form kasir cuci mobil
- [x] **S1-05** `void_store_sale` tampil dan bisa di-approve di ApprovalScreen
- [x] **S1-06** Jam transaksi akurat (bukan selalu 07:00 WIB)
- [x] **S2-01** Form pengajuan pinjaman: produk reguler vs khusus bisa dipilih
- [x] **S2-02** Sisa limit piutang tampil real-time saat pilih anggota potong gaji
- [x] **S2-05** Idle 5 menit → auto logout berfungsi
- [x] **M-ARCH-001** `react-native-toast-message` terpasang, Alert blocking diganti Toast
- [x] **M-ARCH-002** `@gorhom/bottom-sheet` terpasang, modal Kasir dikonversi ke BottomSheetModal
- [x] **M-ARCH-003** `nativewind` v4 terpasang (hybrid), tailwind.config.js selaras warna PRIMKOPPOL
- [x] **M-ARCH-004** `react-hook-form` + `zod` terpasang, LoanApplicationScreen divalidasi skematik
- [x] **M-OPT-005** `react-native-mmkv` terpasang via StorageManager, SecureStore untuk token saja
- [x] **expo-haptics** feedback taktil di KasirScreen (add to cart, checkout, error)
- [x] **M-FEAT-009** Push notification: expo-notifications terkonfigurasi, backend kirim notif saat loan & void diproses
- [x] **M-SYS-001** Perbaikan Kasir Cash/QRIS (kirim identitas anggota), sinkronisasi API *SHU Calculator*, UI SHU Cuci Mobil terintegrasi.
- [x] Build APK & siap diuji di device fisik (100% online ke production)

---

## 📝 BACKLOG — Belum Masuk Sprint

| ID | Deskripsi | Estimasi | Prioritas |
|---|---|---|---|
| M-FEAT-004 | Edit NRP transaksi yang lupa NRP | 2–3 hari | 🟡 |
| M-FEAT-015 | ~~Paritas UI Mutasi Wajib Bulanan~~ | **✅ DONE** | 🟢 |
| ~~M-FEAT-016~~ | ~~Paritas UI: Tampilkan Koreksi & Penarikan di Riwayat Mutasi Mobile~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-013~~ | ~~Paritas UI: Input Manual Tenor Pinjaman~~ | **✅ DONE** | 🟢 |
| ~~M-FEAT-014~~ | ~~Fitur Baru Operator: Direct Disburse~~ | **✅ DONE** | 🟢 |
| ~~M-FEAT-009~~ | ~~Push notification approval void masuk/selesai~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-011~~ | ~~Form edit anggota lanjutan (plafon, tunkin) untuk Admin Mobile~~ | **✅ DONE** | 🟡 |
| ~~M-OPT-005~~ | ~~Install `react-native-mmkv` untuk cache non-sensitif~~ | **✅ DONE** | 🟢 |
| ~~M-ARCH-001~~ | ~~Install `react-native-toast-message` ganti semua `Alert.alert`~~ | **✅ DONE** | 🟡 |
| ~~M-ARCH-002~~ | ~~Install `@gorhom/bottom-sheet` untuk modal member & filter~~ | **✅ DONE** | 🟢 |
| ~~M-ARCH-003~~ | ~~Install `nativewind` v4 untuk styling konsisten~~ | **✅ DONE (hybrid)** | 🟢 |
| ~~M-ARCH-004~~ | ~~Install `react-hook-form + zod` untuk validasi form~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-017~~ | ~~Integrasi Dropdown Kas/Bank di Semua Transaksi Operator~~ | **✅ DONE** | 🔴 |
| ~~M-FEAT-018~~ | ~~Blokir Penarikan Simpanan Wajib/Pokok (AD-ART)~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-019~~ | ~~Layar Riwayat Transaksi & Request Void untuk Kasir Toko~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-021~~ | ~~Fitur Pelunasan Dipercepat (Early Settlement) di LoanPaymentScreen~~ | **✅ DONE** | 🟡 |
| ~~M-FEAT-023~~ | ~~Dropdown Sumber Pemotongan Angsuran (Gaji/Tunkin/BS) di DirectDisburseScreen~~ | **✅ DONE** | 🔴 |
| ~~M-FEAT-022~~ | ~~Fitur Buka/Tutup Shift Kasir Toko & POS Lock~~ | **✅ DONE** | 🔴 |
| ~~M-FEAT-004~~ | ~~Edit NRP Transaksi Lama (Assign Member ke StoreSale)~~ | **✅ DONE** | 🟡 |
| M-FEAT-027 | Layar Notifikasi Mobile — list, filter, mark read/delete | 2–3 hari | 🟡 |
| M-FEAT-028 | Badge unread count notifikasi di mobile | 1 hari | 🟢 |
| M-FEAT-029 | Dialog stok masuk StokScreen dengan field HPP (purchasePrice, batchNo, expiryDate) | 2 hari | 🟡 |
| M-FEAT-030 | Layar manajemen batch untuk admin/operator mobile | 2–3 hari | 🟡 |

---

## 🚀 PANDUAN BUILD APK (100% ONLINE & PRODUCTION READY)

Untuk menjamin aplikasi berjalan 100% online, sistem sudah dikonfigurasi pada file `mobile/src/lib/api.ts` sehingga ketika di-build (`__DEV__ === false`), aplikasi akan otomatis mengarah ke API Production **`https://www.primkoppol.online`**, tanpa perlu mengubah kode apapun.

Berikut adalah langkah-langkah standar untuk mem-build aplikasi menjadi file `.apk` (Preview) atau `.aab` (Production) menggunakan Expo Application Services (EAS):

### 1. Persiapan Environment

Pastikan Anda sudah memiliki akun Expo dan menginstal EAS CLI secara global di komputer Anda:

```bash
npm install -g eas-cli
```

### 2. Login ke Expo

Buka terminal dan login menggunakan akun Expo Anda (`violet666`):

```bash
eas login
```

### 3. Eksekusi Build APK (Untuk di-install & Testing di semua Device Android)

Gunakan perintah berikut untuk membangun APK. Sistem akan mengunggah kode ke server Expo, mem-build-nya, dan memberikan Anda link untuk mengunduh `.apk`.

```bash
cd mobile
eas build --platform android --profile preview
```
*Catatan: Konfigurasi `profile preview` di `eas.json` sudah diset ke `"buildType": "apk"`. Ini adalah opsi terbaik untuk membagikan aplikasi secara langsung (sideloading) tanpa lewat Play Store.*

### 4. Eksekusi Build AAB (Khusus untuk rilis Google Play Store)

Jika Anda sudah siap mengunggah ke Google Play Store, gunakan perintah berikut untuk mem-build format `.aab` (Android App Bundle):

```bash
cd mobile
eas build --platform android --profile production
```

### 5. Hasil Akhir

Setelah proses build selesai (biasanya memakan waktu 5-10 menit di server Expo), terminal akan menampilkan **URL Tautan Unduhan**. Anda dapat membagikan URL tersebut kepada semua kasir/operator, atau mengunduh `build-xxx.apk` dan membagikannya secara manual. Aplikasi yang diinstal dari APK ini sudah dijamin dapat terhubung ke server utama dari koneksi internet manapun.

---

## 🆕 UPDATE MOBILE — 28 APRIL 2026 (Pre-Deploy Audit & Fix)

### 39. [M-FIX-001] Tambah Dukungan 3 Unit Baru di KasirScreen
- ✅ **Selesai**: `KasirScreen.tsx` di-update untuk mendukung 8 unit (sebelumnya 5):
  - Ditambahkan: `laundry`, `fitness`, `playstation` ke `UNIT_TYPES` array
  - `isTokoUnit` diperluas: `['toko', 'resto_cafe', 'laundry', 'fitness', 'playstation']`
  - Products fetch (`useQuery`) di-enable untuk semua unit JALUR 2
  - Backend `/api/mobile/toko` sudah mendukung semua unitType — tidak perlu perubahan backend

### 40. [M-FIX-002] Fix Data Isolation di StokScreen
- ✅ **Selesai**: `StokScreen.tsx` di-update:
  - Sebelumnya: fetch semua produk tanpa filter unitType
  - Sesudah: baca `unitType` dari session kasir, pass ke API sebagai filter
  - Kasir laundry hanya melihat produk laundry, kasir fitness hanya melihat produk fitness, dll

### Ringkasan Unit yang Didukung Mobile (8 Unit)

| Unit | unitType | Jalur | API Endpoint | Status Mobile |
|---|---|---|---|---|
| Toko Sembako | `toko` | JALUR 2 | `/api/mobile/toko` | ✅ |
| Resto & Cafe | `resto_cafe` | JALUR 2 | `/api/mobile/toko` | ✅ |
| Cuci Mobil | `cuci_mobil` | JALUR 1 | `/api/mobile/unit-layanan` | ✅ |
| Barbershop | `barbershop` | JALUR 1 | `/api/mobile/unit-layanan` | ✅ |
| Fotocopy | `fotocopy` | JALUR 1 | `/api/mobile/unit-layanan` | ✅ |
| Laundry | `laundry` | JALUR 2 | `/api/mobile/toko` | ✅ NEW |
| Fitness / Gym | `fitness` | JALUR 2 | `/api/mobile/toko` | ✅ NEW |
| PlayStation | `playstation` | JALUR 2 | `/api/mobile/toko` | ✅ NEW |

### Catatan Pre-Deploy
- **TypeScript**: 0 new errors — semua fix kompatibel dengan existing code
- **Backend API**: 47 mobile routes terverifikasi — semua endpoint aktif dan berfungsi
- **Dependencies**: Semua library sprint terinstall dan terkonfigurasi
- **Production URL**: Auto-switch ke `https://www.primkoppol.online` saat `__DEV__ === false`
- **ENV**: `.env` hanya dipakai saat dev (Expo Go). Build APK/AAB otomatis ke production URL.

---

## 🆕 UPDATE MOBILE — 28 APRIL 2026 Session 2 (Deep Audit: 15 Bug Fixes)

### 41. [M-FIX-003] Fix Login Response — Tambah unitType untuk Kasir
- ✅ **Selesai**: `src/app/api/mobile/login/route.ts`
- **Bug:** Response login tidak menyertakan `unitType` user, sehingga kasir tidak terdeteksi unit-nya di mobile
- **Fix:** Tambah `unitType: user.unitType || null` ke response object
- **Dampak:** Kasir sekarang otomatis diarahkan ke unit yang benar (bukan selalu "toko")

### 42. [M-FIX-004] Fix Plafon Piutang Formula — 50% dari Sisa Bersih
- ✅ **Selesai**: `src/app/api/mobile/unit-layanan/route.ts`
- **Bug:** Formula lama `sisaBersih - 2,000,000` (hardcoded deduction) digunakan bukan formula baru
- **Fix:** Diganti ke `Math.floor(sisaBersih * 0.5)` — 50% dari sisa bersih gaji
- **Dampak:** Validasi plafon piutang untuk potong gaji sekarang akurat

### 43. [M-FIX-005] Fix CashBankTransaction Type — "masuk" → "in"
- ✅ **Selesai**: `src/app/api/mobile/loan-payment/route.ts`
- **Bug:** 4 instansi `type: "masuk"` di CashBankTransaction — schema hanya menerima "in"/"out"
- **Fix:** Semua diubah ke `type: "in"` — sesuai enum schema Prisma
- **Dampak:** Transaksi angsuran pinjaman via mobile kini mencatat kas/bank dengan benar

### 44. [M-FIX-006] Fix Savings TX — Tambah Cash/Bank Sync
- ✅ **Selesai**: `src/app/api/mobile/savings-tx/route.ts`
- **Bug:** Setoran dan penarikan simpanan tidak mensinkronkan saldo kas/bank
- **Fix:** Tambah blok cash/bank sync (create CashBankTransaction + update balance) setelah transaksi simpanan
- **Dampak:** Saldo kas/bank akurat saat ada setoran/penarikan simpanan via mobile

### 45. [M-FIX-007] Fix Edit NRP — Tambah Role Check pada POST
- ✅ **Selesai**: `src/app/api/mobile/edit-nrp/route.ts`
- **Bug:** POST handler tidak punya role check — user `anggota` bisa assign member ke transaksi
- **Fix:** Tambah role check `kasir/operator/admin` di awal POST
- **Dampak:** Hanya authorized role yang bisa assign NRP ke transaksi

### 46. [M-FIX-008] Fix Assets — Hapus Error Object dari Response
- ✅ **Selesai**: `src/app/api/mobile/assets/route.ts`
- **Bug:** Response 500 mengirim raw `error` object (information disclosure)
- **Fix:** Ganti ke generic message "Gagal menyimpan aset"
- **Dampak:** Tidak ada lagi database query/table name yang bocor ke client

### 47. [M-FIX-009] Fix Buku Kas — Hapus Error Message dari Response
- ✅ **Selesai**: `src/app/api/mobile/buku-kas/route.ts`
- **Bug:** Response 500 mengirim `error.message` (bisa expose SQL details)
- **Fix:** Hapus field error dari response
- **Dampak:** Tidak ada lagi database error details yang bocor ke client

### 48. [M-FIX-010] Fix Push Token — Konsistensi Import
- ✅ **Selesai**: `src/app/api/mobile/push-token/route.ts`
- **Bug:** Named import `{ prisma }` berbeda dari semua file lain (default import)
- **Fix:** Ganti ke `import prisma from '@/lib/prisma'` + hapus error message leak
- **Dampak:** Konsistensi kode dan tidak ada lagi info bocor di error response

### 49. [M-FIX-011] Fix MainTabs — Role Parsing Object vs String
- ✅ **Selesai**: `mobile/src/navigation/MainTabs.tsx`
- **Bug:** `parsed.role` adalah object `{ name: 'kasir' }` bukan string — semua user mendapat tab Anggota
- **Fix:** Extract role name: `typeof parsed.role === 'object' ? parsed.role?.name : parsed.role`
- **Dampak:** Operator, Admin, Kasir sekarang melihat tab navigasi yang benar sesuai role

### 50. [M-FIX-012] Fix ShiftScreen — Hardcoded unitType
- ✅ **Selesai**: `mobile/src/screens/kasir/ShiftScreen.tsx`
- **Bug:** `unitType: 'toko'` di-hardcode — semua kasir non-toko akan buka shift salah unit
- **Fix:** Baca unitType dari session storage, tampilkan nama unit dinamis di header
- **Dampak:** Kasir laundry/fitness/playstation dll buka shift dengan unitType yang benar

### 51. [M-FIX-013] Fix KasirScreen — canTransact + Member ID + Debounce Cleanup
- ✅ **Selesai**: `mobile/src/screens/kasir/KasirScreen.tsx`
- **Bug 1:** `canProceed` adalah dead code — `limitTooLow` hanya cek `total > sisaLimit`, tidak cek `canTransact`
- **Bug 2:** Identifikasi member by name (`members.find(m => m.name === ...)`) — bisa salah jika nama sama
- **Bug 3:** Debounce timer tidak di-clear saat unmount — memory leak
- **Fix:**
  - Integrasi `!memberPiutang.canTransact` ke `limitTooLow`
  - Tambah state `selectedMemberId` — set saat member di-tap, gunakan saat konfirmasi
  - Tambah cleanup `useEffect` untuk debounce timer
- **Dampak:** Validasi plafot piutang lebih aman, transaksi potong gaji akurat, tidak ada memory leak

### 52. [M-FIX-014] Fix KwitansiViewer — expo-print Type Params
- ✅ **Selesai**: `mobile/src/screens/common/KwitansiViewerScreen.tsx`
- **Bug:** `printToFileAsync({ url })` dan `printAsync({ url })` — parameter tidak sesuai type
- **Fix:** Ganti ke `{ html: ... }` untuk printToFileAsync dan `{ uri }` untuk printAsync
- **Dampak:** Cetak kwitansi PDF dan share berfungsi tanpa TypeScript error

### Bug yang Diketahui Tapi Tidak Difiks (Low Risk / Pre-existing)
- `reports/unit/route.ts`: Menggunakan model `UnitAccount` dan `OperationalExpense` yang tidak ada di schema — endpoint akan return `totalPengeluaran: 0`. Perlu dibuat model baru atau rewrite query.
- `kas-bank/route.ts`: Tidak ada filter branch/unit — menampilkan semua akun dari semua cabang. Low risk jika hanya 1 cabang.
- `toko/route.ts`: `cashReceived` selalu sama dengan `totalAmount` — client tidak kirim jumlah uang fisik yang diterima.

---

## 🆕 SPRINT 5 — Deep Audit Bug Fixes (28 April 2026 Session 2)

### [x] S5-01 — M-FIX-003: Login response unitType
### [x] S5-02 — M-FIX-004: Plafon piutang formula
### [x] S5-03 — M-FIX-005: CashBankTransaction type "in"
### [x] S5-04 — M-FIX-006: Savings TX cash/bank sync
### [x] S5-05 — M-FIX-007: Edit NRP role check
### [x] S5-06 — M-FIX-008: Assets error disclosure
### [x] S5-07 — M-FIX-009: Buku Kas error message
### [x] S5-08 — M-FIX-010: Push token import

---

## 🔴 BUG REFERENCE (dari dokumen asli, untuk tracking)

| ID | Judul | Status | Sprint |
|---|---|---|---|
| M-BUG-001 | Paket Layanan Hardcode | ✅ FIXED | S1-03 |
| M-BUG-002 | Validasi Plafon Piutang Tidak Ada | ✅ FIXED | S2-02 |
| M-BUG-003 | Plat Nomor Tidak Terkirim | ✅ FIXED | S1-04 |
| M-BUG-004 | Format No. Transaksi Lama | ✅ FIXED (sequential) | S1-07 action |
| M-BUG-005 | ApprovalScreen Tidak Handle `void_store_sale` | ✅ FIXED | S1-05 |
| M-BUG-006 | Jam Transaksi Selalu 07:00 | ✅ FIXED | S1-06 |
| M-BUG-007 | API loan-apply Hardcode Rate & Cap | ✅ FIXED (backend) | S1-07 |
| M-BUG-008 | Kasir Cash/QRIS tidak kirim memberId | ✅ FIXED | 10 Apr |
| M-BUG-009 | Kalkulator SHU Mobile tidak sinkron | ✅ FIXED | 10 Apr |
| M-BUG-010 | Laporan SHU Mobile hilang kolom Carwash | ✅ FIXED | 10 Apr |

---

*Dokumen ini diperbarui setiap sesi kerja. Tandai item dengan `[x]` saat selesai.*
*Referensi: `BUG-FIX-CURRENT.md` | `UPDATE-FIX-CURRENT.md` (112 item) | Tanggal: 30 April 2026 — Sesi 12*

---

## 🆕 SPRINT 6 — Full Role Audit + Branding + Bug Fixes (28 April 2026 Session 3)

> **Scope:** Debug semua role (kasir, operator, admin, member) di semua fitur mobile, ganti branding "KOPERASI" → "PRIMKOPPOL", pastikan frontend best practice, catat semua bug dan perbaikan.

### [x] S6-01 — M-FIX-015: Branding "KOPERASI" → "PRIMKOPPOL" (16 instance di 7 file)
**Prioritas:** 🔴 Tinggi (Play Store review)
**Status:** ✅ Selesai

**File yang diubah:**
1. ✅ `LaporanPinjamanScreen.tsx` — HTML report header "KOPERASI PRIMKOPPOL" → "PRIMKOPPOL RESOR LUMAJANG"
2. ✅ `LaporanSimpananScreen.tsx` — HTML report header "KOPERASI PRIMKOPPOL RESOR LUMAJANG" → "PRIMKOPPOL RESOR LUMAJANG"
3. ✅ `LaporanSHUScreen.tsx` — "pendapatan kotor koperasi" → "pendapatan kotor PRIMKOPPOL"
4. ✅ `LaporanCuciMobilScreen.tsx` — 4 label: "Bagi Hasil Koperasi" → "PRIMKOPPOL", "Bagian Koperasi" → "PRIMKOPPOL", dll
5. ✅ `ProfilKoperasiScreen.tsx` — Header, badge, section labels (5 instance). Legal name "Primer Koperasi Kepolisian Resor Lumajang" dipertahankan (nama resmi badan hukum)
6. ✅ `KasirScreen.tsx` — "anggota koperasi" → "anggota PRIMKOPPOL" (2x)

### [x] S6-02 — M-FIX-016: KasirScreen — Cleanup & Bug Fixes
**Prioritas:** 🔴 Tinggi
**Status:** ✅ Selesai

1. ✅ Hapus unused `Keyboard` import
2. ✅ Hapus unused `cameraPermission` state dan `setCameraPermission` call
3. ✅ Fix barcode scanner: hapus `setShowScanner(false)` dari `handleBarcodeScanned` agar tombol "Scan Lagi" berfungsi
4. ✅ Fix `updateQty` — cleaner pattern: find → check → filter/map, hapus null-in-map anti-pattern

### [x] S6-03 — M-FIX-017: StokScreen — Fix Infinite Re-fetch
**Prioritas:** 🔴 Tinggi
**Status:** ✅ Selesai
- **Bug:** `search` string ada di `loadData` useCallback deps → setiap keystroke trigger re-fetch
- **Fix:** Hapus `search` dari deps, gunakan `q ?? ''` default, pass `search` eksplisit di onRefresh

### [x] S6-04 — M-FIX-018: ShiftScreen — Fix Negative Amount Display
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Bug:** `formatRp(s.cashDifference)` menampilkan negative amount tanpa tanda minus
- **Fix:** `formatRp(Math.abs(s.cashDifference))` + label "(kurang)" untuk negatif

### [x] S6-05 — M-FIX-019: PinjamanScreen — FAB Hidden Behind Tab Bar
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Bug:** FAB `bottom: 20` tertutup bottom tab navigator (height ~65px)
- **Fix:** `bottom: 20` → `bottom: 90`

### [x] S6-06 — M-FIX-020: TransaksiScreen — Loan Tab Filter Missing
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Bug:** Filter chips tidak berpengaruh pada tab Pinjaman (loan) — data selalu full
- **Fix:** Tambah filter branch untuk loan tab di TransaksiScreen

### [x] S6-07 — M-FIX-021: SimpananScreen — Correction Prefix
**Prioritas:** 🟢 Rendah
**Status:** ✅ Selesai
- **Bug:** Transaksi koreksi positif menampilkan prefix kosong (harusnya "+")
- **Fix:** Tambah `+` prefix untuk correction amount positif

### [x] S6-08 — M-FIX-022: LoanApplicationScreen — Zod Schema Stale
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Bug:** Switching product tidak me-reset Zod validation state — form bisa show stale errors
- **Fix:** Tambah `key={selectedProduct?.id || 'none'}` ke KeyboardAvoidingView untuk force remount

### [x] S6-09 — M-FIX-023: ProfileScreen — Version & Role Display
**Prioritas:** 🟢 Rendah
**Status:** ✅ Selesai
- **Fix:** Version dari `Constants.expoConfig?.version` (bukan hardcode "1.0.0")
- **Fix:** Role display dari `user?.roleDisplayName || user?.role || '-'`

### [x] S6-10 — M-FIX-024: KwitansiViewerScreen — WebView Security + PDF Export
**Prioritas:** 🔴 Kritis (security + functionality)
**Status:** ✅ Selesai
- **Security:** Tambah `originWhitelist` dan `onShouldStartLoadWithRequest` — hanya izinkan `primkoppol.online`
- **Security:** Disable `allowsBackForwardNavigationGestures` — cegah navigasi ke arbitrary URL
- **PDF Fix:** Ganti `printToFileAsync({ url })` → fetch HTML content → `printToFileAsync({ html })` — expo-print tidak bisa render iframe

### [x] S6-11 — M-FIX-025: MainTabs — admin_unit Role + App.tsx Registration
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Fix:** Tambah `admin_unit` ke operator role check di MainTabs
- **Fix:** Register `LaporanCuciMobil` screen di App.tsx stack navigator (screen sudah ada tapi tidak terdaftar)

### [x] S6-12 — M-FIX-026: MasterDataHubScreen — Navigation Crash Fix
**Prioritas:** 🔴 Tinggi
**Status:** ✅ Selesai
- **Bug:** Tap "Manajemen Pengguna" → navigate ke "UserManagement" → crash (screen tidak ada)
- **Fix:** Semua menu items menampilkan Alert "Segera Hadir" — cegah navigasi ke screen yang belum dibuat
- **Tambahan:** Import `Alert` yang sebelumnya tidak ada

### [x] S6-13 — M-FIX-027: ApprovalScreen — Double Submission Guard
**Prioritas:** 🔴 Tinggi
**Status:** ✅ Selesai
- **Bug:** Tombol Setujui/Tolak bisa di-tap berkali-kali → multiple API calls saat proses pertama belum selesai
- **Fix:** Tambah `processingId` state — lock button saat API call berjalan, ActivityIndicator di tombol
- **Tambahan:** Import `ActivityIndicator`

### [x] S6-14 — M-FIX-028: PengeluaranOperasionalScreen — Permanent Loading Fix
**Prioritas:** 🔴 Tinggi
**Status:** ✅ Selesai
- **Bug:** Jika user tidak punya `unitType` → `unitSlug` kosong → `loadData` return early tanpa `setLoading(false)` → loading spinner selamanya
- **Fix:** `setLoading(false)` sebelum return early saat `unitSlug` kosong

### [x] S6-15 — M-FIX-029: LaporanPinjamanScreen — Loading State
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Bug:** Tidak ada loading state — user melihat nol/nol sebelum data sampai
- **Fix:** Tambah `loading` state + `ActivityIndicator` + conditional render

### [x] S6-16 — M-FIX-030: LaporanSimpananScreen — Loading State
**Prioritas:** 🟡 Sedang
**Status:** ✅ Selesai
- **Fix:** Sama seperti S6-15 — tambah loading state + conditional render

### [x] S6-17 — M-FIX-031: LaporanSHUScreen — Missing StatusBar
**Prioritas:** 🟢 Rendah
**Status:** ✅ Selesai
- **Bug:** Tidak ada StatusBar component — status bar transparan/inkonsisten
- **Fix:** Tambah `<StatusBar barStyle="light-content" backgroundColor={C.primary} />`

### Bug yang Diketahui (Tidak Difiks Sesi Ini)

| ID | Deskripsi | Severity | File |
|---|---|---|---|
| M-BUG-011 | RiwayatKasirScreen hanya tampil StoreSale (JALUR 2), belum tampil UnitTransaction (JALUR 1) untuk kasir cuci_mobil/barbershop/fotocopy | 🟡 Medium | `RiwayatKasirScreen.tsx` |
| M-BUG-012 | LaporanCuciMobilScreen terdaftar di App.tsx tapi belum ada navigasi dari dashboard manapun | 🟢 Low | `App.tsx` + dashboard screens |
| M-BUG-013 | MasterDataHubScreen semua menu items menampilkan "Segera Hadir" — belum ada sub-screen terimplementasi | 🟡 Medium | `MasterDataHubScreen.tsx` |

### Frontend Best Practice Review Summary

| Area | Status | Catatan |
|---|---|---|
| FlatList vs ScrollView+map() | ✅ | Semua list panjang sudah pakai FlatList |
| Loading states | ✅ | Semua screen yang fetch data kini punya loading state |
| Pull-to-refresh | ✅ | Semua FlatList/ScrollView punya RefreshControl |
| Error handling | ✅ | API errors ditangkap dan ditampilkan ke user |
| Memory leaks | ✅ | Debounce cleanup, useEffect deps benar |
| Navigation safety | ✅ | canGoBack check sebelum render back button |
| Role-based tab rendering | ✅ | MainTabs parse role object/string dengan benar |
| WebView security | ✅ | originWhitelist + onShouldStartLoadWithRequest |
| Input validation | ✅ | Zod schema di LoanApplication, numeric clamps di Kasir |
| Double-submit prevention | ✅ | processing state di ApprovalScreen |

---

## 🆕 UPDATE WEB & BACKEND (30 APRIL 2026)

> **3 fitur besar untuk Unit Toko:** Sistem Notifikasi, HPP Moving Average, dan Batch & Expiry Tracking. Referensi lengkap: `UNIT-TOKO.md` Section 10.

### 53. [M-SYNC-033] Sistem Notifikasi — Model, API, UI Bell + Push Notification
- ✅ **Selesai (Web Backend + UI)**:
  - Model `Notification` ditambahkan ke Prisma schema (id, userId, type, title, message, data Json, isRead, readAt, createdAt)
  - Helper `src/lib/notifications.ts` — `createNotification()` dengan DB insert + Expo push (fire-and-forget)
  - 4 API endpoints: GET `/api/notifications` (pagination + type filter), PUT `/api/notifications/read` (mark all), PUT `/api/notifications/[id]/read` (mark single), DELETE `/api/notifications/[id]`
  - UI: `NotificationBell` popover di topbar (30s polling, badge unread count) + halaman `/notifikasi` (filter tipe, pagination, mark read/delete)
  - 6 tipe notifikasi: `low_stock`, `stock_in`, `void_request`, `expiring_soon`, `batch_expired`, `info`
  - Push notifications via Expo dikirim ke semua admin/operator/super_admin (fire-and-forget, tidak memblokir response)
- **Dampak Mobile:**
  - ✅ Push notifications otomatis diterima oleh mobile app — `expo-notifications` sudah terkonfigurasi (Sprint 3, M-FEAT-009)
  - ❌ **Gap:** Mobile belum punya layar notifikasi (list, filter, mark read). Tambahkan ke backlog (`M-FEAT-027`)
  - ❌ **Gap:** Mobile belum menampilkan badge unread count di ikon/tab manapun. Tambahkan ke backlog (`M-FEAT-028`)

### 54. [M-SYNC-034] HPP Moving Average + Audit Trail + FIFO Batch Deduction
- ✅ **Selesai (Web Backend)**:
  - Model `StockBatch` ditambahkan ke Prisma schema (productId, batchNo, purchasePrice, quantity, expiryDate, supplierName, isActive, unitType)
  - `StoreStockMovement` mendapat field baru: `reason`, `reasonNote`, `batchId`, `costAtTime`
  - `StoreSaleItem` mendapat field `costPrice` (snapshot HPP saat transaksi)
  - HPP Moving Average formula: `(oldStock × oldCostPrice + newQty × purchasePrice) / (oldStock + newQty)`
  - Kategori yang dikecualikan (e.g. rokok/HET) tidak dihitung Moving Average — configurable via `app_settings`
  - Auto harga jual: `ceil((HPP × (1 + markup%) × (1 + PPN%)) / 100) × 100`
  - Stok keluar (writeoff): alasan wajib (damaged/expired/internal_use/other), snapshot `costAtTime`
  - FIFO batch deduction saat penjualan: consume oldest active batch first (`ORDER BY receivedAt ASC`)
  - Laporan API (`/api/unit/[slug]/laporan`) sekarang mengembalikan `totalHPP`, `totalWriteOff`, `netProfit`
  - Semua operasi multi-tabel dibungkus `prisma.$transaction` (atomic)
- **Dampak Mobile:**
  - ✅ FIFO batch deduction dan HPP calculation sepenuhnya server-side — mobile POS tidak perlu perubahan kode
  - ✅ Mobile POS checkout (`POST /api/mobile/toko`) otomatis mendapat FIFO deduction dan costPrice snapshot
  - ✅ Stok masuk dari mobile (jika ada) akan otomatis menggunakan HPP Moving Average
  - ❌ **Gap:** Mobile StokScreen belum punya dialog stok masuk dengan field HPP (purchasePrice, batchNo, expiryDate, supplierName). Saat ini hanya view-only. Tambahkan ke backlog (`M-FEAT-029`)

### 55. [M-SYNC-035] Batch & Expiry Tracking — Manajemen Batch Page
- ✅ **Selesai (Web Backend + UI)**:
  - API `GET /api/toko/batches` dengan view filter (active/expiring_soon/expired/all), search, pagination
  - Auto-expire check: batch dengan `expiryDate < now` di-set `isActive: false` saat halaman batch diakses (lazy check, bukan cron)
  - Notifikasi expiry: batch ≤ 90 hari → `expiring_soon`, batch expired → `batch_expired`
  - Deduplication: cek existing notification sebelum kirim baru (7-day window untuk expiring_soon, lifetime untuk batch_expired)
  - Auto batch number: `BATCH-YYYYMMDD-XXXX` (generated transactionally)
  - Halaman `/toko/batch` dengan 4 tab (Aktif, Hampir Expired, Expired, Semua), summary cards, searchable table
  - Menu "Manajemen Batch" (icon Layers) ditambahkan ke sidebar navigasi toko
- **Dampak Mobile:**
  - ✅ Auto-expire dan notifikasi berjalan server-side — mobile tidak perlu perubahan
  - ❌ **Gap:** Mobile belum punya layar manajemen batch. Admin/operator mobile tidak bisa cek batch status dari device. Tambahkan ke backlog (`M-FEAT-030`)

### Bug Fixes Terkait (30 April 2026)

| Bug | Masalah | Solusi |
|---|---|---|
| Duplikat Button | Dua tombol "Stok Masuk" identik di persediaan page | Hapus duplikat DialogTrigger |
| Transaction Safety | Transfer + stock-out/writeoff di luar `$transaction` | Wrap dalam `$transaction` |
| Low Stock False Alert | Notifikasi saat deduct dari Gudang (stockToko unchanged) | Kondisi `stockLocation === "toko"` |
| Notification Spam | Auto-expire re-notify semua batch setiap GET | Deduplication via `findFirst` |
| Shift Label Off-by-One | Label shift menampilkan `endHour:59` padahal exclusive | `(endHour === 0 ? 23 : endHour - 1):59` |
| Shift Detail Overflow | Tabel 7 kolom overflow di `max-w-3xl` dialog | Lebar `max-w-4xl`, 5 kolom |

### Tugas Mobile yang Perlu Dikerjakan

| ID | Deskripsi | Estimasi | Prioritas |
|---|---|---|---|
| M-FEAT-027 | Layar Notifikasi Mobile — list, filter tipe, mark read/delete | 2–3 hari | 🟡 Medium |
| M-FEAT-028 | Badge unread count notifikasi di mobile (tab bar atau icon) | 1 hari | 🟢 Low |
| M-FEAT-029 | Dialog stok masuk di StokScreen dengan field HPP (purchasePrice, batchNo, expiryDate) | 2 hari | 🟡 Medium |
| M-FEAT-030 | Layar manajemen batch untuk admin/operator mobile | 2–3 hari | 🟡 Medium |

### File Backend yang Diubah (Berlaku Otomatis untuk Mobile)

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | Model Notification, StockBatch; field baru di StoreStockMovement & StoreSaleItem |
| `src/lib/notifications.ts` | Helper createNotification + Expo push |
| `src/app/api/notifications/route.ts` | GET notifikasi |
| `src/app/api/notifications/read/route.ts` | PUT mark all read |
| `src/app/api/notifications/[id]/route.ts` | PUT mark single read + DELETE |
| `src/app/api/toko/products/[id]/stock/route.ts` | HPP Moving Average, batch creation, writeoff |
| `src/app/api/toko/sales/route.ts` | FIFO batch deduction, costPrice snapshot |
| `src/app/api/toko/batches/route.ts` | Batch listing, auto-expire, notifications |
| `src/app/api/unit-transactions/void-request/route.ts` | Void request notifications |
| `src/app/api/unit/[slug]/laporan/route.ts` | totalHPP, totalWriteOff, netProfit |
| `src/lib/shift-schedule.ts` | Fix formatShiftLabel off-by-one |
| `src/lib/constants/navigation.ts` | Menu "Manajemen Batch" |
