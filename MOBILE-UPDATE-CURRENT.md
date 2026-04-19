# 📱 MOBILE-UPDATE-CURRENT.md
# Roadmap & Backlog Update Aplikasi Mobile PRIMKOPPOL

> **Dokumen ini melacak kesenjangan fitur antara Web (primkoppol.online) dan Mobile App (Expo/React Native).**
> Update terakhir: **16 April 2026 (Sesi 15 — Fix Ghost Balance + Auto-Create Rekening + Full CRUD Rekening)**
> Referensi Web: `UPDATE-FIX-CURRENT.md` | `BUG-FIX-CURRENT.md` | `SIMPANAN-FEATURE.md`

---

## 📊 RINGKASAN STATUS

| Sprint | Total Item | ✅ Selesai | 🔄 On Progress | ❌ Belum |
|---|---|---|---|---|
| Sprint 1 — Bug Kritis & Fondasi API | 7 | 7 | 0 | 0 |
| Sprint 2 — Paritas Fitur Web | 5 | 5 | 0 | 0 |
| Sprint 3 — Layar Baru & Optimasi | 4 | 4 | 0 | 0 |
| **TOTAL** | **16** | **16** | **0** | **0** |

## 🆕 UPDATE APLIKASI MOBILE (17 APRIL 2026)

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
| Pengajuan Pinjaman | `/api/mobile/loan-apply` | ✅ FIXED (Sesi 9) | UI perlu update → S2-01 |
| POS Toko | `/api/mobile/toko` | ✅ OK | — |
| POS Unit Layanan | `/api/mobile/unit-layanan` | ⚠️ Perlu cek | Format no. transaksi → S1-07 action |
| Member Search | `/api/mobile/members` | ✅ OK | — |
| Transaksi Anggota | `/api/mobile/transactions` | ⚠️ Perlu cek | Return `createdAt`? → S1-06 |
| Approval | `/api/mobile/approvals` | ⚠️ Perlu cek | `void_store_sale` ter-handle? → S1-05 |
| Pengumuman | `/api/mobile/pengumuman` | ✅ OK | — |
| Buku Kas | `/api/mobile/buku-kas` | ✅ OK | — |
| Kas & Bank | `/api/mobile/kas-bank` | ✅ OK | — |
| Laporan | `/api/mobile/reports` | ✅ OK | — |
| Audit Log | `/api/mobile/audit-logs` | ✅ OK | — |
| Push Token | `/api/mobile/push-token` | ✅ OK | Notifikasi belum diuji → backlog |
| **Paket Unit** | `/api/mobile/unit-packages` | ✅ SUDAH ADA | S1-03 |
| **Plafon Anggota** | `/api/mobile/members/[id]/piutang` | ✅ SUDAH ADA | S2-02 |

---

## 📦 STATUS LIBRARY

| Library | Versi | Status | Terkait Sprint |
|---|---|---|---|
| `axios` | `^1.13.6` | ✅ Ada — perlu tambah interceptor | S1-01 |
| `expo-secure-store` | `^55.0.9` | ✅ Ada | S2-05 |
| `expo-notifications` | `~55.0.14` | ✅ Ada | Backlog |
| `@tanstack/react-query` | `^5.x` | ❌ Belum install | S3-03 |
| `expo-image` | `~2.x` | ❌ Belum install | S3-04 |
| `react-native-toast-message` | `^2.x` | ❌ Belum install | Backlog |
| `react-native-mmkv` | `^3.x` | ❌ Belum install | Backlog |
| `@gorhom/bottom-sheet` | `^5.x` | ❌ Belum install | Backlog |
| `react-hook-form` | `^7.x` | ❌ Belum install | Backlog |

---

## 🗓️ SPRINT PLAN AKTUAL

### Sprint 1 — Bug Kritis & Fondasi API (1 minggu)
1. [ ] **S1-01** M-OPT-003: Global axios error interceptor — `api.ts`
2. [ ] **S1-02** M-OPT-001: Dynamic API port config — `.env` + `api.ts`
3. [ ] **S1-03** M-BUG-001: Endpoint `/api/mobile/unit-packages` (backend) + fetch paket (mobile)
4. [ ] **S1-04** M-BUG-003: Input plat nomor cuci mobil kondisional
5. [ ] **S1-05** M-BUG-005: ApprovalScreen handle `void_store_sale`
6. [ ] **S1-06** M-BUG-006: TransaksiScreen jam dari `createdAt`
7. [x] **S1-07** M-BUG-007: ~~Fix API loan-apply hardcode~~ ✅ DONE (backend)

### Sprint 2 — Paritas Fitur Web (1 minggu)
1. [ ] **S2-01** M-FEAT-012: LoanApplicationScreen kartu produk + simulasi akurat
2. [ ] **S2-02** M-FEAT-002: Endpoint piutang (backend) + info limit di modal member (mobile)
3. [ ] **S2-03** M-FEAT-003: Filter status riwayat transaksi
4. [ ] **S2-04** M-FEAT-007: Debounce autocomplete + avatar + info limit
5. [ ] **S2-05** M-FEAT-010: Auto-logout idle 5 menit

### Sprint 3 — Layar Baru & Optimasi (2 minggu)
1. [ ] **S3-01** M-FEAT-008: Layar Pengeluaran Operasional Unit (baru)
2. [ ] **S3-02** M-FEAT-005: Layar Laporan Bagi Hasil Cuci Mobil (baru)
3. [ ] **S3-03** M-OPT-002: Integrasi `@tanstack/react-query`
4. [ ] **S3-04** M-OPT-004: Ganti `<Image>` dengan `expo-image`

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
| M-FEAT-011 | Form edit anggota lanjutan (plafon, tunkin) untuk Admin Mobile | 1–2 hari | 🟡 |
| ~~M-OPT-005~~ | ~~Install `react-native-mmkv` untuk cache non-sensitif~~ | **✅ DONE** | 🟢 |
| ~~M-ARCH-001~~ | ~~Install `react-native-toast-message` ganti semua `Alert.alert`~~ | **✅ DONE** | 🟡 |
| ~~M-ARCH-002~~ | ~~Install `@gorhom/bottom-sheet` untuk modal member & filter~~ | **✅ DONE** | 🟢 |
| ~~M-ARCH-003~~ | ~~Install `nativewind` v4 untuk styling konsisten~~ | **✅ DONE (hybrid)** | 🟢 |
| ~~M-ARCH-004~~ | ~~Install `react-hook-form + zod` untuk validasi form~~ | **✅ DONE** | 🟡 |
| M-FEAT-017 | Integrasi Dropdown Kas/Bank di Semua Transaksi Operator | 1-2 hari | 🔴 |
| M-FEAT-018 | Blokir Penarikan Simpanan Wajib/Pokok (AD-ART) | 1/2 hari | 🟡 |
| M-FEAT-019 | Layar Riwayat Transaksi & Request Void untuk Kasir Toko | 2 hari | 🟡 |

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

## 🔴 BUG REFERENCE (dari dokumen asli, untuk tracking)

| ID | Judul | Status | Sprint |
|---|---|---|---|
| M-BUG-001 | Paket Layanan Hardcode | ❌ OPEN | S1-03 |
| M-BUG-002 | Validasi Plafon Piutang Tidak Ada | ❌ OPEN | S2-02 |
| M-BUG-003 | Plat Nomor Tidak Terkirim | ❌ OPEN | S1-04 |
| M-BUG-004 | Format No. Transaksi Lama | ⚠️ Perlu Verifikasi Backend | S1-07 action |
| M-BUG-005 | ApprovalScreen Tidak Handle `void_store_sale` | ❌ OPEN | S1-05 |
| M-BUG-006 | Jam Transaksi Selalu 07:00 | ❌ OPEN | S1-06 |
| M-BUG-007 | API loan-apply Hardcode Rate & Cap | ✅ FIXED (backend) | S1-07 |
| M-BUG-008 | Kasir Cash/QRIS tidak kirim memberId | ✅ FIXED | 10 Apr |
| M-BUG-009 | Kalkulator SHU Mobile tidak sinkron | ✅ FIXED | 10 Apr |
| M-BUG-010 | Laporan SHU Mobile hilang kolom Carwash | ✅ FIXED | 10 Apr |

---

*Dokumen ini diperbarui setiap sesi kerja. Tandai item dengan `[x]` saat selesai.*
*Referensi: `BUG-FIX-CURRENT.md` | `UPDATE-FIX-CURRENT.md` (112 item) | Tanggal: 8 April 2026 — Sesi 9*
