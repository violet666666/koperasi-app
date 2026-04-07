# 📱 MOBILE-UPDATE-CURRENT.md
# Roadmap & Backlog Update Aplikasi Mobile PRIMKOPPOL

> **Dokumen ini melacak kesenjangan fitur antara Web (primkoppol.online) dan Mobile App (Expo/React Native).**
> Update terakhir: **7 April 2026**
> Referensi Web: `UPDATE-FIX-CURRENT.md` (103 item)

---

## 🔴 KRITIS — Bug Mobile yang Harus Segera Diperbaiki

### M-BUG-001 — Paket Layanan Hardcode (Tidak Sinkron dengan Database)

**File:** `mobile/src/screens/kasir/KasirScreen.tsx` baris 26–39

**Masalah:**
Paket Cuci Mobil dan Barbershop di-hardcode di sisi mobile:
```ts
const CARWASH_PACKAGES = [
  { label: "Motor", price: 15000 },
  { label: "Mobil Kecil...", price: 35000 },
  ...
]
```
Padahal Web sudah menggunakan `UnitServicePackage` dari database (`/api/unit/[slug]/packages`). Jika Admin mengubah harga atau menambah paket baru lewat Web, Mobile **tidak akan berubah**.

**Fix:** Ganti hardcode dengan fetch ke `/api/mobile/unit-layanan/packages?unitType=cuci_mobil` (endpoint baru perlu dibuat).

---

### M-BUG-002 — Validasi Plafon Piutang Tidak Ada di Mobile

**File:** `mobile/src/screens/kasir/KasirScreen.tsx` — `performQuickCheckoutAPI()`

**Masalah:**
Web menerapkan validasi real-time plafon piutang sebelum transaksi Potong Gaji diproses (BUG-P02, BUG-P03). Mobile tidak ada validasi apapun — kasir bisa pilih anggota dan langsung proses meski limit habis. Error hanya muncul setelah request gagal di backend.

**Fix:**
1. Sebelum proses `salary_cut`, fetch `/api/mobile/transactions` atau endpoint validate untuk cek sisa limit anggota
2. Tampilkan info sisa limit di modal pemilihan anggota
3. Disable tombol "Setuju & Pilih" jika total > plafon sisa

---

### M-BUG-003 — Potong Gaji Tidak Mengirim `vehiclePlate` (Cuci Mobil)

**File:** `mobile/src/screens/kasir/KasirScreen.tsx`

**Masalah:**
Web menambahkan field "🚗 Plat Nomor Kendaraan" khusus saat `unitType === 'cuci_mobil'` (FEAT-4). Plat nomor disimpan dalam catatan dengan format `[PLAT:N 1234 ABC]` dan tampil di laporan. Mobile sama sekali tidak punya field input ini — data plat nomor tidak akan pernah tercatat dari transaksi mobile.

**Fix:** Tambahkan `TextInput` plat nomor kondisional di form kasir cepat cuci mobil, sertakan di payload `performQuickCheckoutAPI`.

---

### M-BUG-004 — Format No. Transaksi Lama (Random Base-36)

**Masalah:**
Mobile masih menggunakan versi API lama yang menghasilkan format `CUC-MNMZW0NQ`. Web sudah diupdate ke format `CM06042026xxxx` (BUG-LOGIC-002 — DDMMYYYY + nomor urut). Ini bukan bug mobile yang perlu difix di mobile, **tapi perlu diverifikasi** apakah API `/api/mobile/unit-layanan` sudah menggunakan format baru atau masih lama.

**Action:** Cek `src/app/api/mobile/unit-layanan/route.ts` — pastikan menggunakan `generateTransactionNo()` yang sama dengan Web.

---

### M-BUG-005 — ApprovalScreen Tidak Handle Tipe `void_store_sale`

**File:** `mobile/src/screens/operator/ApprovalScreen.tsx`

**Masalah:**
Web baru saja dipatch (hari ini) untuk mendukung `requestType === "void_store_sale"` di samping `"unit_void"`. Mobile hanya menampilkan tipe yang dikenal. Approval void transaksi toko dari mobile kemungkinan menampilkan data kosong atau tidak bisa diproses.

**Fix:** Salin logika dari `approval-dialog.tsx` web — tambahkan `void_store_sale` ke label map dan handler di ApprovalScreen mobile.

---

### M-BUG-006 — TransaksiScreen Member: Jam Transaksi Selalu 07:00

**File:** `mobile/src/screens/member/TransaksiScreen.tsx`

**Masalah:**
Sama dengan bug yang sudah di-fix di Web (BUG-076 — dashboard jam 07:00 hardcode). Field `transactionDate` bertipe `@db.Date` sehingga jam selalu 00:00 UTC = 07:00 WIB. Web sudah difix menggunakan `createdAt` untuk display waktu. Mobile belum.

**Fix:** Pastikan API `/api/mobile/transactions` mengembalikan `createdAt` dan gunakan itu untuk tampilan jam (bukan `transactionDate`).

---

## 🟡 FITUR BARU — Tertinggal dari Web

### M-FEAT-001 — Paket Layanan Dinamis dari Database

**Status Web:** ✅ Selesai (FEAT-012 UnitServicePackage CRUD)
**Status Mobile:** ❌ Belum ada

**Deskripsi:** Admin bisa tambah/edit/hapus paket layanan per unit dari web. Mobile harus fetch paket dari `/api/mobile/unit-packages?unitType=xxx` agar selalu sinkron.

**Estimasi:** 1–2 hari
**Dependencies:** Buat endpoint `/api/mobile/unit-packages` (atau gunakan `/api/unit/[slug]/packages` yang sudah ada)

---

### M-FEAT-002 — Tampilan Sisa Limit Potong Gaji Real-Time

**Status Web:** ✅ Selesai (FEAT-014 — notifikasi realtime sisa limit di dialog kasir)
**Status Mobile:** ❌ Belum ada

**Deskripsi:** Saat kasir memilih anggota + metode Potong Gaji di Web, muncul info bar:
- Total Plafon: Rp 5.000.000
- Sudah Terpakai: Rp 2.500.000  
- **Sisa Limit: Rp 2.500.000** (merah jika tidak cukup)

Mobile hanya tampilkan nama dan NRP anggota saja.

**Estimasi:** 1 hari
**API yang dibutuhkan:** `/api/mobile/transactions?memberId=xxx` untuk kalkulasi piutang berjalan, atau endpoint khusus `/api/mobile/members/[id]/piutang`

---

### M-FEAT-003 — Filter Status di Riwayat Transaksi

**Status Web:** ✅ Selesai (FEAT-013 — filter Belum Lunas, Pending Void, dll)
**Status Mobile:** ❌ Belum ada filter status

**Deskripsi:** Web memiliki dropdown filter di halaman Riwayat untuk memfilter berdasarkan:
- Semua Status
- Belum Lunas
- Pending Void
- Dibatalkan (Voided)
- Selesai

Mobile tidak ada filter — semua transaksi ditampilkan campur jadi satu.

**Estimasi:** 1 hari

---

### M-FEAT-004 — Edit NRP Transaksi yang Lupa NRP

**Status Web:** ✅ Selesai (FEAT-012 — tombol edit NRP di riwayat transaksi)
**Status Mobile:** ❌ Belum ada

**Deskripsi:** Via web, kasir bisa klik ikon pensil di riwayat transaksi yang belum terasosiasi anggota dan input NRP untuk mengkorelasikan transaksi ke anggota yang benar.

**Estimasi:** 2–3 hari

---

### M-FEAT-005 — Laporan Bagi Hasil 50/50 Cuci Mobil

**Status Web:** ✅ Selesai (UPDATE Sesi 6 — kalkulasi bagi hasil tampil di laporan cuci mobil)
**Status Mobile:** ❌ Belum ada (hanya lihat total transaksi)

**Deskripsi:** Operator Cuci Mobil perlu melihat:
- Pendapatan Kotor dari layanan cuci
- Bagian Karyawan (50%)
- Bagian Koperasi (50%)
- Laba Bersih Koperasi (setelah pengeluaran)

**Estimasi:** 1 hari

---

### M-FEAT-006 — Input Plat Nomor di POS Cuci Mobil

**Status Web:** ✅ Selesai (FEAT-4 — auto-uppercase, limit 12 karakter)
**Status Mobile:** ❌ Belum ada

**Deskripsi:** Field input plat nomor kendaraan wajib ditambahkan khusus untuk unit cuci mobil agar data plat tercatat di sistem dan tampil di laporan.

**Estimasi:** 0.5 hari

---

### M-FEAT-007 — Autocomplete Anggota by Nama (bukan hanya NRP)

**Status Web:** ✅ Selesai (FEAT-5 — debounce 350ms, search by nama ATAU NRP)
**Status Mobile:** Sebagian (sudah bisa search, tapi hanya di modal, belum debounce realtime)

**Deskripsi:** Mobile sudah punya modal pencarian anggota, tapi:
1. Tidak ada debounce otomatis — user harus ketik lalu tunggu
2. Tidak ada avatar inisial atau kategori (Polri/PNS) di hasil pencarian
3. Tidak ada info limit piutang di item hasil pencarian

**Estimasi:** 1 hari

---

### M-FEAT-008 — Pengeluaran Operasional Unit (dari Mobile)

**Status Web:** ✅ Selesai (FEAT-015 — CRUD pengeluaran operasional unit)
**Status Mobile:** ❌ Belum ada layar sama sekali

**Deskripsi:** Admin unit bisa catat pengeluaran operasional (beli sabun, dll.) langsung dari mobile tanpa harus buka laptop.

**Estimasi:** 2–3 hari
**API:** Endpoint `/api/unit/[slug]/operational-expense` sudah ada di Web — tinggal buat layarnya di mobile.

---

### M-FEAT-009 — Notifikasi Push: Approval Void Masuk/Selesai

**Status Web:** ✅ Sudah ada FCM token endpoint (`/api/mobile/push-token`)
**Status Mobile:** ❌ Token teregistrasi tapi notifikasi belum diuji untuk skenario approval

**Deskripsi:** Saat Kasir mengajukan void dan Admin menyetujui/menolak, notifikasi push seharusnya masuk ke HP kasir. Perlu diverifikasi apakah backend mengirim notifikasi pada saat `void-approve` selesai.

**Estimasi:** 1–2 hari

---

## 🟢 OPTIMASI TEKNIS — Library & Performa

### M-OPT-001 — Ganti Hardcode URL API dengan Dynamic Config

**File:** `mobile/src/lib/api.ts` baris 33

```ts
// Saat ini development nembak ke port 3000 (web production port!)
return `http://${ip}:3000`;
```

Jika menjalankan UAT di port 3001, mobile development akan tetap menembak port 3000. Perlu tambahkan konfig agar bisa override ke port yang benar.

**Fix:** Tambahkan variabel `APP_ENV` atau gunakan `.env` file di expo.

---

### M-OPT-002 — Tambahkan React Query untuk Caching & Background Refresh

**Library:** `@tanstack/react-query` (sudah ada di web, belum ada di mobile)

**Masalah Saat Ini:**
- Setiap screen fetch ulang dari awal saat dibuka
- Tidak ada caching data anggota, produk, dll.
- Data stale langsung hilang saat navigasi

**Manfaat:**
- Stale-while-revalidate: tampilkan data lama sementara fetching
- Background refresh otomatis
- Optimistic updates untuk checkout lebih responsif
- Deduplication request simultan

**Estimasi instalasi + refactor screen utama:** 3–5 hari

---

### M-OPT-003 — Tambahkan Axios Interceptor untuk Error Handling Global

**File:** `mobile/src/lib/api.ts`

**Masalah Saat Ini:**
Setiap screen handle error sendiri dengan `Alert.alert('Gagal', ...)`. Tidak ada penanganan terpusat untuk:
- 401 Unauthorized → auto logout
- 503 Service Unavailable → toast "Server sedang tidak tersedia"
- Network timeout → retry otomatis

**Fix:** Tambahkan `api.interceptors.response.use()` di `api.ts`:

```ts
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('userToken');
      // navigate to login
    }
    return Promise.reject(error);
  }
);
```

**Estimasi:** 0.5 hari

---

### M-OPT-004 — Tambahkan `expo-image` untuk Gambar Lebih Efisien

**Library:** `expo-image` (pengganti `Image` dari react-native)

**Masalah Saat Ini:** QRIS image di KasirScreen menggunakan `<Image>` biasa tanpa caching. Setiap kali modal QRIS dibuka, gambar di-fetch ulang (ada `?t=${Date.now()}` sebagai cache buster).

**Manfaat `expo-image`:**
- Disk + memory cache otomatis
- Blurhash placeholder
- Progressive loading
- Format WebP/AVIF support

**Estimasi:** 0.5 hari

---

### M-OPT-005 — Tambahkan `react-native-mmkv` untuk Storage Lebih Cepat

**Library:** `react-native-mmkv`

**Masalah Saat Ini:** `expo-secure-store` dipakai untuk menyimpan token dan `userData`. Ini aman tapi lambat (sinkron ke Keychain/Keystore). Untuk data non-sensitif seperti preferensi unit, history search, dll. sebaiknya gunakan MMKV yang 30x lebih cepat dari AsyncStorage.

**Skema:**
- Tetap gunakan `expo-secure-store` untuk token JWT (sensitif)
- Gunakan MMKV untuk cache produk, preferensi UI, last-used unit type

**Estimasi:** 1 hari

---

## 📋 PLAN LAYAR BARU YANG DIBUTUHKAN

| Layar | Prioritas | Estimasi | Keterangan |
|---|---|---|---|
| `PengeluaranOperasionalScreen` | 🔴 Tinggi | 2 hari | Catat pengeluaran unit dari mobile |
| `LaporanCuciMobilScreen` | 🟡 Sedang | 1 hari | Tampilkan bagi hasil 50/50 |
| `PlafondInfoBottomSheet` | 🔴 Tinggi | 1 hari | Info sisa limit anggota saat potong gaji |
| `TransaksiFilterSheet` | 🟡 Sedang | 1 hari | Filter status riwayat transaksi |

---

## 📦 LIBRARY YANG DIREKOMENDASIKAN

| Library | Versi | Kegunaan | Prioritas |
|---|---|---|---|
| `@tanstack/react-query` | `^5.x` | Server state management + caching | 🔴 Tinggi |
| `expo-image` | `~2.x` | Image caching efisien (ganti Image biasa) | 🟡 Sedang |
| `react-native-mmkv` | `^3.x` | Fast local storage (non-sensitif) | 🟡 Sedang |
| `react-native-toast-message` | `^2.x` | Toast notification global (ganti Alert) | 🟡 Sedang |
| `@gorhom/bottom-sheet` | `^5.x` | Bottom sheet yang smooth (modal member, filter) | 🟢 Rendah |
| `react-hook-form` | `^7.x` | Form validation (kasir form, loan form) | 🟡 Sedang |

---

## 🗓️ SPRINT PLAN (REKOMENDASI URUTAN)

### Sprint 1 — Sinkronisasi Data Kritis (1 minggu)
1. ✅ M-BUG-001: Ganti hardcode paket dengan fetch dari API
2. ✅ M-BUG-002: Validasi plafon sebelum proses potong gaji
3. ✅ M-BUG-003: Tambah input plat nomor cuci mobil
4. ✅ M-BUG-005: Fix ApprovalScreen untuk `void_store_sale`
5. ✅ M-OPT-003: Global error interceptor Axios

### Sprint 2 — Fitur Paritas Web (1 minggu)
1. ✅ M-FEAT-003: Filter status di riwayat transaksi
2. ✅ M-FEAT-006: Input plat nomor di POS
3. ✅ M-FEAT-007: Perbaikan autocomplete anggota + tampilkan plafon
4. ✅ M-OPT-001: Dynamic API URL config

### Sprint 3 — Fitur Finance & Optimasi (2 minggu)
1. ✅ M-FEAT-008: Layar Pengeluaran Operasional
2. ✅ M-FEAT-005: Laporan bagi hasil cuci mobil
3. ✅ M-FEAT-002: Real-time sisa limit di modal anggota
4. ✅ M-OPT-002: Integrasi React Query

---

## 📝 AUDIT API MOBILE — Status Endpoint

| API Mobile | Endpoint | Status | Catatan |
|---|---|---|---|
| Login | `/api/mobile/login` | ✅ OK | - |
| Summary Anggota | `/api/mobile/summary` | ✅ OK | - |
| Simpanan | `/api/mobile/savings-accounts` | ✅ OK | - |
| Simpanan TX | `/api/mobile/savings-tx` | ✅ OK | - |
| Pinjaman | `/api/mobile/loans` | ✅ OK | - |
| Bayar Angsuran | `/api/mobile/loan-payment` | ✅ OK | - |
| Pengajuan Pinjaman | `/api/mobile/loan-apply` | ✅ OK | - |
| POS Toko | `/api/mobile/toko` | ✅ OK | - |
| POS Unit Layanan | `/api/mobile/unit-layanan` | ⚠️ Perlu cek | Format no. transaksi sudah baru? |
| Member Search | `/api/mobile/members` | ✅ OK | - |
| Transaksi Anggota | `/api/mobile/transactions` | ✅ OK | Jam transaksi perlu cek |
| Approval | `/api/mobile/approvals` | ⚠️ Perlu cek | `void_store_sale` tipe ter-handle? |
| Pengumuman | `/api/mobile/pengumuman` | ✅ OK | - |
| Buku Kas | `/api/mobile/buku-kas` | ✅ OK | - |
| Kas & Bank | `/api/mobile/kas-bank` | ✅ OK | - |
| Laporan | `/api/mobile/reports` | ✅ OK | - |
| Audit Log | `/api/mobile/audit-logs` | ✅ OK | - |
| Push Token | `/api/mobile/push-token` | ✅ OK | Notifikasi belum fully tested |
| **Paket Unit** | `/api/mobile/unit-packages` | ❌ BELUM ADA | Perlu dibuat — M-BUG-001 |
| **Plafon Anggota** | `/api/mobile/members/[id]/piutang` | ❌ BELUM ADA | Perlu dibuat — M-FEAT-002 |
| **Pengeluaran Unit** | (gunakan Web API) | ⚠️ Auth perlu disesuaikan | M-FEAT-008 |

---

## ✅ CHECKLIST SEBELUM RELEASE MOBILE BERIKUTNYA

- [ ] M-BUG-001: Paket layanan fetch dari DB, tidak hardcode
- [ ] M-BUG-002: Validasi plafon sebelum potong gaji
- [ ] M-BUG-003: Input plat nomor cuci mobil
- [ ] M-BUG-005: `void_store_sale` di ApprovalScreen
- [ ] M-BUG-006: Jam transaksi gunakan `createdAt`
- [ ] M-OPT-001: Dynamic API URL (bukan hardcode port 3000)
- [ ] M-OPT-003: Global axios error interceptor (auto logout 401)
- [ ] Uji notifikasi push pada skenario: void approved dan rejected

---

*Dokumen ini perlu diperbarui setiap kali ada fitur baru di Web yang relevan untuk Mobile.*
*Referensi: `UPDATE-FIX-CURRENT.md` (103 item) | Tanggal: 7 April 2026*
