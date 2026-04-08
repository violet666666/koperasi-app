# 📱 MOBILE-UPDATE-CURRENT.md
# Roadmap & Backlog Update Aplikasi Mobile PRIMKOPPOL

> **Dokumen ini melacak kesenjangan fitur antara Web (primkoppol.online) dan Mobile App (Expo/React Native).**
> Update terakhir: **8 April 2026 (Sesi 9 — Restrukturisasi Checklist)**
> Referensi Web: `UPDATE-FIX-CURRENT.md` (Update Sesi 9)

---

## 📊 RINGKASAN STATUS

| Sprint | Total Item | ✅ Selesai | 🔄 On Progress | ❌ Belum |
|---|---|---|---|---|
| Sprint 1 — Bug Kritis & Fondasi API | 7 | 7 | 0 | 0 |
| Sprint 2 — Paritas Fitur Web | 5 | 5 | 0 | 0 |
| Sprint 3 — Layar Baru & Optimasi | 4 | 4 | 0 | 0 |
| **TOTAL** | **16** | **16** | **0** | **0** |

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
| `GET /api/mobile/unit-packages` | `src/app/api/mobile/unit-packages/route.ts` | ❌ BELUM ADA | S1-03, M-BUG-001 |
| `GET /api/mobile/members/[id]/piutang` | `src/app/api/mobile/members/[id]/piutang/route.ts` | ❌ BELUM ADA | S2-02, M-FEAT-002 |

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
| **Paket Unit** | `/api/mobile/unit-packages` | ❌ BELUM ADA | Buat di Sprint 1 → S1-03 |
| **Plafon Anggota** | `/api/mobile/members/[id]/piutang` | ❌ BELUM ADA | Buat di Sprint 2 → S2-02 |

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
- [ ] Push notification: uji skenario void approved & rejected (backlog)

---

## 📝 BACKLOG — Belum Masuk Sprint

| ID | Deskripsi | Estimasi | Prioritas |
|---|---|---|---|
| M-FEAT-004 | Edit NRP transaksi yang lupa NRP | 2–3 hari | 🟡 |
| M-FEAT-009 | Push notification approval void masuk/selesai | 1–2 hari | 🟡 |
| M-FEAT-011 | Form edit anggota lanjutan (plafon, tunkin) untuk Admin Mobile | 1–2 hari | 🟡 |
| M-OPT-005 | Install `react-native-mmkv` untuk cache non-sensitif | 1 hari | 🟢 |
| M-ARCH-001 | Install `react-native-toast-message` ganti semua `Alert.alert` | 1 hari | 🟡 |
| M-ARCH-002 | Install `@gorhom/bottom-sheet` untuk modal member & filter | 2 hari | 🟢 |
| M-ARCH-003 | Install `nativewind` v4 untuk styling konsisten | 3 hari | 🟢 |
| M-ARCH-004 | Install `react-hook-form + zod` untuk validasi form | 2 hari | 🟡 |

---

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

---

*Dokumen ini diperbarui setiap sesi kerja. Tandai item dengan `[x]` saat selesai.*
*Referensi: `BUG-FIX-CURRENT.md` | `UPDATE-FIX-CURRENT.md` (112 item) | Tanggal: 8 April 2026 — Sesi 9*
