# Panduan Rilis Aplikasi Mobile ke Google Play Store

Dokumentasi langkah demi langkah untuk merilis aplikasi **PRIMKOPPOL RESOR LUMAJANG** (`com.primkoppol.mobile`) ke Google Play Store menggunakan EAS Build (Expo Application Services).

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Play App Signing (Tahap Awal)](#2-play-app-signing-tahap-awal)
3. [Konfigurasi Version Code](#3-konfigurasi-version-code)
4. [Build App Bundle (.aab)](#4-build-app-bundle-aab)
5. [Buat Rilis Pengujian Internal](#5-buat-rilis-pengujian-internal)
6. [Buat Rilis Pengujian Tertutup](#6-buat-rilis-pengujian-tertutup)
7. [Rilis Produksi](#7-rilis-produksi)
8. [Update Versi Berikutnya](#8-update-versi-berikutnya)
9. [Checklist Sebelum Rilis](#9-checklist-sebelum-rilis)
10. [Referensi](#10-referensi)

---

## 1. Prasyarat

### Yang sudah harus tersedia:

| Item | Status | Keterangan |
|------|--------|------------|
| Akun Google Play Developer | Wajib | Biaya pendaftaran $25 (sekali seumur hidup) |
| Aplikasi dibuat di Play Console | Wajib | Package name: `com.primkoppol.mobile` |
| Play App Signing | Wajib | Google mengelola app signing key |
| Upload Keystore | Wajib | File: `primkoppol-upload.keystore` |
| Upload Certificate (PEM) | Wajib | File: `upload_certificate.pem` |
| EAS CLI | Wajib | `npm install -g eas-cli` |
| EAS Project ID | Wajib | `3db40b2b-1d5f-4362-a61a-cacdaf712cd5` |

### Konfirmasi EAS login:
```bash
cd mobile
eas login
eas whoami
```

---

## 2. Play App Signing (Tahap Awal)

> **Catatan:** Jika sudah menyelesaikan tahap ini, lanjut ke [Bagian 3](#3-konfigurasi-version-code).

Play App Signing adalah **persyaratan wajib** untuk mempublish App Bundle ke Google Play. Google akan menyimpan app signing key di infrastruktur mereka yang aman dan menggunakannya untuk menandatangani APK yang didistribusikan ke pengguna.

### Konsep Kunci:

```
Upload Key (milik Anda)          App Signing Key (milik Google)
─────────────────────           ───────────────────────────────
Digunakan untuk menandatangani   Digunakan Google untuk menandatangani
AAB/APK sebelum upload ke        APK yang didistribusikan ke pengguna
Play Console                     melalui Play Store

File: primkoppol-upload.keystore  Disimpan di server Google
                                  (tidak pernah diekspos)
```

### Langkah Setup (sudah selesai):

1. Buka **Google Play Console** → pilih aplikasi
2. Menu samping: **Setup** → **App signing**
3. Pilih **Use existing upload key** atau **Let Google generate**
4. Jika menggunakan upload key sendiri → upload `upload_certificate.pem`
5. Google akan memverifikasi dan mengaktifkan Play App Signing

### Verifikasi:

```
Google Play Console → Setup → App signing
├── Upload key certificate: SHA-1, SHA-256 (dari keystore Anda)
└── App signing key certificate: SHA-1, SHA-256 (dari Google)
```

---

## 3. Konfigurasi Version Code

**Setiap kali upload rilis baru**, `versionCode` HARUS lebih tinggi dari versi sebelumnya. Google Play menolak AAB dengan versionCode yang sama atau lebih rendah.

### File: `app.json`

```json
{
  "expo": {
    "version": "1.0.0",       ← Version name (tampil ke pengguna, e.g. "1.0.1")
    "android": {
      "package": "com.primkoppol.mobile"
    }
  }
}
```

### Versioning Convention:

| Rilis | `expo.version` | `versionCode` (auto dari EAS) | Keterangan |
|-------|----------------|-------------------------------|------------|
| Awal | `"1.0.0"` | 1 | Rilis pertama |
| Hotfix | `"1.0.1"` | 2 | Perbaikan bug minor |
| Minor | `"1.1.0"` | 3 | Fitur baru |
| Major | `"2.0.0"` | 4+ | Perubahan besar |

> **EAS Build** akan secara otomatis mengatur `versionCode` secara incremental. Untuk override manual, tambahkan di `app.json`:
> ```json
> "android": {
>   "package": "com.primkoppol.mobile",
>   "versionCode": 2
> }
> ```

### Cara Update Versi:

```bash
# Edit app.json → ubah "version": "1.0.0" ke versi baru
# Kemudian build ulang
```

---

## 4. Build App Bundle (.aab)

### Perbedaan Format Build:

| Format | Profile EAS | Perintah | Kegunaan |
|--------|-------------|----------|----------|
| **APK** (.apk) | `preview` | `eas build --platform android --profile preview` | Testing langsung install ke device |
| **APK** (.apk) | `production` | `eas build --platform android --profile production` | Distribusi langsung (sideload) |
| **AAB** (.aab) | `store` | `eas build --platform android --profile store` | Upload ke Google Play Store |

### Langkah Build AAB:

```bash
cd mobile

# 1. Pastikan sudah login
eas whoami

# 2. Build App Bundle untuk Play Store
eas build --platform android --profile store
```

EAS Build akan:
1. Menjalankan build di cloud
2. Menandatangani AAB dengan upload keystore (`primkoppol-upload.keystore`)
3. Menghasilkan file `.aab` yang siap upload

### Monitor Build:

```bash
# Cek status build
eas build:list

# Atau pantau di browser
# https://expo.dev/accounts/violet666/projects/koperasi-primkoppol/builds
```

### Download AAB:

Setelah build selesai:
```bash
# Download langsung via CLI
eas build:download <BUILD_ID>

# Atau download dari dashboard Expo
```

File hasil download: `build-<timestamp>.aab` (ukuran ~20-50MB tergantung assets)

---

## 5. Buat Rilis Pengujian Internal

Pengujian Internal adalah tahap pertama distribusi. Hanya tester yang terdaftar (hingga 100 email) yang bisa mengakses aplikasi.

### Langkah di Google Play Console:

```
Google Play Console
├── Pilih aplikasi: PRIMKOPPOL RESOR LUMAJANG
│
├── Menu samping → Testing → Internal testing
│   ├── Klik "+ New release" (Buat rilis baru)
│   │
│   ├── ① Upload App Bundle
│   │   └── Klik "Upload" → pilih file .aab dari langkah sebelumnya
│   │   └── Tunggu hingga muncul detail versi
│   │
│   ├── ② Isi Release Notes (Catatan Rilis)
│   │   └── Contoh: "Versi 1.0.0 — Rilis awal untuk pengujian internal"
│   │
│   ├── ③ Klik "Next" → Review release
│   │
│   └── ④ Klik "Start rollout to Internal testing"
│
├── Tambahkan Tester
│   ├── Menu → Testing → Internal testing → Testers tab
│   ├── Buat Email List (contoh: "Tim Internal PRIMKOPPOL")
│   ├── Tambahkan email Google/Gmail masing-masing tester
│   └── Klik Save changes
│
└── Tester akan menerima link opt-in via email
    └── Link: https://play.google.com/apps/testing/com.primkoppol.mobile
```

### Tester Mengakses Aplikasi:

1. Tester buka link opt-in di browser (harus login dengan Gmail yang terdaftar)
2. Klik **"Become a tester"**
3. Buka **Google Play Store** di device Android
4. Cari **"PRIMKOPPOL RESOR LUMAJANG"**
5. Klik **Install**

### Cek Status Rilis:

```
Testing → Internal testing
├── Status: "Published" (hijau) = rilis aktif
├── Status: "In review" (kuning) = sedang direview Google (1-3 hari untuk rilis pertama)
└── Status: "Rejected" (merah) = ditolak, cek email untuk alasan
```

> **Penting:** Rilis pertama biasanya membutuhkan review **1-3 hari kerja** oleh Google. Rilis berikutnya biasanya lebih cepat (beberapa jam).

---

## 6. Buat Rilis Pengujian Tertutup

Setelah pengujian internal dirasa stabil, lanjut ke pengujian tertutup (Closed Testing) untuk cakupan tester yang lebih luas.

### Alur Distribusi Google Play:

```
Internal Testing (≤100 tester)
       │
       ▼  Stabil? Promote release
Closed Testing (alpha/beta, ≤2000 tester)
       │
       ▼  Stabil? Promote release
Open Testing (beta, publik via link)
       │
       ▼  Stabil? Promote release
Production (semua pengguna)
```

### Langkah Promote ke Closed Testing:

```
Google Play Console
├── Testing → Internal testing
│   └── Klik "Promote release" → pilih "Closed testing"
│       └── Pilih/create track (misal: "Alpha")
│       └── Review → Start rollout
│
├── Testing → Closed testing
│   └── Tab "Testers" → tambahkan Google Groups atau email list
│
└── Tester mengakses sama seperti internal testing
```

### Persyaratan Tambahan untuk Closed Testing:

Sebelum bisa promote ke Closed Testing, pastikan **Store Listing** sudah lengkap:

```
Google Play Console → Store presence → Store listing
├── App name: "PRIMKOPPOL RESOR LUMAJANG"
├── Short description: max 80 karakter
├── Full description: max 4000 karakter
├── App icon: 512x512 PNG
├── Feature graphic: 1024x500 PNG
├── Phone screenshots: min 2, max 8 (16:9 atau 9:16)
├── Category: "Business" atau "Finance"
├── Contact details: email, website
└── Privacy policy URL (wajib jika app mengumpulkan data)
```

---

## 7. Rilis Produksi

### Prasyarat Sebelum Production Release:

| # | Item | Keterangan |
|---|------|------------|
| 1 | Store Listing lengkap | Icon, screenshots, deskripsi |
| 2 | Content rating | Isi kuesioner IARC di **Store presence → Content rating** |
| 3 | Data safety form | **App content → Data safety** → deklarasi pengumpulan data |
| 4 | Target audience | **App content → Target audience** → pilih usia target |
| 5 | Privacy policy | URL kebijakan privasi (wajib) |
| 6 | Closed testing selesai | Minimal sudah diuji oleh beberapa tester |

### Langkah Rilis ke Production:

```
Google Play Console
├── Production (menu siding)
│   ├── Klik "Create new release"
│   │   └── Upload AAB versi terbaru
│   │       └── ATAU "Promote release" dari Closed/Internal testing
│   │
│   ├── Review release
│   │
│   └── Pilih rollout strategy:
│       ├── Full rollout (100% segera)
│       └── Staged rollout (10% → 25% → 50% → 100%)
│
└── Klik "Start rollout to Production"
```

### Staged Rollout (Rekomendasi):

Untuk rilis pertama, disarankan menggunakan staged rollout:

1. Mulai dengan **10%** pengguna
2. Monitor crash report di **Play Console → Quality → Android vitals**
3. Jika stabil setelah 24-48 jam → naikkan ke **25%**
4. Lanjut **50%** → **100%**

---

## 8. Update Versi Berikutnya

Untuk setiap update aplikasi:

### Langkah:

```bash
# 1. Update version di app.json
#    "version": "1.0.0" → "1.0.1" (atau versi baru)

# 2. Build AAB baru
cd mobile
eas build --platform android --profile store

# 3. Download AAB
eas build:download <BUILD_ID>

# 4. Upload ke Play Console
#    Production → Create new release → Upload .aab baru

# 5. Isi release notes
#    Contoh: "v1.0.1 — Perbaikan bug QRIS upload dan detail transaksi"

# 6. Review → Start rollout
```

### Version Name Convention:

```
Major.Minor.Patch
  │    │    │
  │    │    └── Bug fixes, hotfix
  │    └── Fitur baru (backward compatible)
  └── Breaking changes, redesign besar
```

---

## 9. Checklist Sebelum Rilis

### Pre-Release Checklist:

- [ ] Versi di `app.json` sudah diupdate (`version` dan `versionCode` jika manual)
- [ ] API endpoint production sudah benar (`https://www.primkoppol.online`)
- [ ] Tidak ada `console.log` atau debug code yang tersisa
- [ ] Icon app sudah benar (1024x1024 untuk Play Store)
- [ ] Splash screen tampil benar
- [ ] Login flow berfungsi
- [ ] Semua modul utama bisa diakses (dashboard, kasir, riwayat, profil)
- [ ] QRIS payment berfungsi
- [ ] Receipt/struk bisa dicetak dari mobile
- [ ] Push notifications berfungsi (jika ada)
- [ ] App tidak crash di device target (min SDK 24+ / Android 7+)
- [ ] Semua gambar/assets sudah di-bundle dengan benar
- [ ] `.easignore` mengecualikan file yang tidak perlu (docs, .env, dll)

### Store Listing Checklist:

- [ ] App name: "PRIMKOPPOL RESOR LUMAJANG"
- [ ] Short description (max 80 karakter)
- [ ] Full description (max 4000 karakter)
- [ ] App icon 512x512 PNG
- [ ] Feature graphic 1024x500 PNG
- [ ] Minimal 2 screenshot phone
- [ ] Category dipilih (Business/Finance)
- [ ] Content rating questionnaire selesai
- [ ] Data safety form diisi
- [ ] Target audience dipilih
- [ ] Privacy policy URL valid

---

## 10. Referensi

### Dokumentasi Resmi Google:

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Android App Bundle Overview](https://developer.android.com/guide/app-bundle)
- [Play App Signing](https://developer.android.com/google/play/integrity)
- [Create & set up your app](https://developer.android.com/studio/publish#setup)
- [Prepare & roll out releases](https://developer.android.com/studio/publish#publishing)
- [Testing tracks overview](https://support.google.com/googleplay/android-developer/answer/9844679)

### Dokumentasi Expo/EAS:

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Build for Play Store](https://docs.expo.dev/submit/android/)
- [App Signing with EAS](https://docs.expo.dev/app-signing/app-signing-with-eas/)

### File Terkait Proyek:

| File | Lokasi | Kegunaan |
|------|--------|----------|
| Upload Keystore | `mobile/primkoppol-upload.keystore` | Menandatangani AAB sebelum upload |
| Upload Certificate | `mobile/upload_certificate.pem` | Terdaftar di Play App Signing |
| EAS Config | `mobile/eas.json` | Profile build (preview/production/store) |
| App Config | `mobile/app.json` | Package name, version, plugins |
| ADI Plugin | `mobile/plugins/withAdiRegistration` | Bundle token file dalam APK |

---

*Dokumentasi ini dibuat berdasarkan panduan resmi Google Play Developer Documentation. Terakhir diperbarui: Mei 2026.*

---

## 11. Store Listing — Konten Siap Pakai

> Bagian ini berisi konten yang sudah disiapkan untuk diisi ke Google Play Console → Store presence → Store listing.

### Aset yang Sudah Dibuat

| File | Lokasi | Resolusi | Ukuran | Status |
|------|--------|----------|--------|--------|
| App Icon | `store-listing/icon-512x512.png` | 512x512 px | ~248 KB | Siap upload |
| Feature Graphic | `store-listing/feature-graphic-1024x500.png` | 1024x500 px | ~116 KB | Siap upload |

File berada di: `mobile/store-listing/`

> **Catatan:** Feature graphic dibuat secara otomatis dari logo yang ada. Jika ingin tampilan yang lebih profesional, bisa dibuat ulang menggunakan Canva/Figma dengan template Google Play Feature Graphic.

### Deskripsi Singkat (Short Description) — 79/80 karakter

```
Koperasi PRIMKOPPOL Polres Lumajang — layanan toko, simpanan & pinjaman anggota
```

Copy-paste langsung ke field **Short description** di Play Console.

### Deskripsi Lengkap (Full Description) — 2.130/4.000 karakter

```
PRIMKOPPOL RESOR LUMAJANG
Aplikasi Koperasi Digital Polres Lumajang

Aplikasi resmi Koperasi PRIMKOPPOL Polres Lumajang untuk layanan manajemen koperasi digital terpadu. Dirancang khusus untuk anggota koperasi dan pengelola unit usaha di lingkungan Polres Lumajang.

FITUR UTAMA:

KASIR & POINT OF SALE (POS)
Sistem POS lengkap untuk 10 jenis unit usaha: toko, cafe, laundry, barbershop, fitness, playstation, dan lainnya. Mendukung pembayaran tunai, QRIS, dan potong gaji. Cetak struk langsung ke printer thermal 58mm dan 80mm. Manajemen shift kasir dengan rekonsiliasi kas otomatis, riwayat transaksi lengkap dengan detail per item, serta manajemen stok produk dan resep/HPP untuk unit makanan dan minuman.

SIMPANAN ANGGOTA
Tiga jenis simpanan: Pokok, Wajib, dan Sukarela. Pencatatan transaksi real-time dengan sistem akuntansi double-entry. Buku simpanan digital yang bisa diakses kapan saja. Override saldo oleh admin untuk penyesuaian, serta impor data simpanan wajib (TAJIB) secara massal.

PINJAMAN
Pinjaman Reguler dan Khusus dengan perhitungan angsuran otomatis. Jadwal angsuran terstruktur dan transparan. Pelunasan dipercepat (early settlement) dengan perhitungan pro-rata. Laporan jasa pinjaman bulanan dan integrasi dengan kas/bank untuk pembayaran angsuran.

DASHBOARD & LAPORAN
Dashboard operasional unit dengan data real-time. Laporan keuangan dan LPJ (Laporan Pertanggungjawaban). Rekap piutang gabungan per anggota yang menggabungkan data toko, unit, dan simpanan pinjaman. Laporan hasil usaha unit dengan ekspor ke PDF dan Excel.

MANAJEMEN ANGGOTA
Database anggota lengkap dengan klasifikasi pangkat, golongan, dan kesatuan. Profil anggota terintegrasi dengan semua layanan koperasi. Pencarian anggota berdasarkan NRP/NIP atau nama.

KEAMANAN & AKSES
Sistem login dengan NRP/NIP. Kontrol akses berbasis peran (admin, kasir, pengelola unit). Validasi transaksi multi-layer untuk mencegah kesalahan. Operasi atomik untuk menjaga konsistensi data.

Aplikasi ini dikembangkan untuk meningkatkan efisiensi pengelolaan koperasi dan memberikan kemudahan akses layanan bagi seluruh anggota PRIMKOPPOL Polres Lumajang.
```

### Store Listing — Checklist Status

#### Yang SUDAH SIAP (bisa langsung diisi):

- [x] App icon 512x512 PNG → `store-listing/icon-512x512.png`
- [x] Feature graphic 1024x500 PNG → `store-listing/feature-graphic-1024x500.png`
- [x] App name: `PRIMKOPPOL RESOR LUMAJANG`
- [x] Short description (79 karakter)
- [x] Full description (2.130 karakter)
- [x] Category: `Business` atau `Finance`

#### Yang PERLU DILAKUKAN MANUAL:

- [ ] **Screenshot Ponsel (wajib, min 2, max 8)**
  - Format: PNG atau JPEG, max 8 MB per file
  - Rasio: 16:9 atau 9:16
  - Resolusi: 320 px – 3840 px per sisi
  - **Cara:** Jalankan app di device/emulator Android, lalu screenshot setiap screen utama:
    1. Login screen
    2. Dashboard utama
    3. Kasir/POS screen (dengan item di keranjang)
    4. Riwayat transaksi
    5. Simpanan (buku simpanan)
    6. Pinjaman (daftar pinjaman)
    7. Profil anggota
    8. Laporan/dashboard admin
  - Simpan ke `store-listing/screenshots-phone/`

- [ ] **Screenshot Tablet 7 inci (opsional, max 8)**
  - Format: PNG/JPEG, max 8 MB
  - Rasio: 16:9 atau 9:16
  - Resolusi: 320 px – 3840 px per sisi
  - **Cara:** Sama seperti phone screenshot, tapi ambil di tablet 7" atau emulator tablet 7"
  - Simpan ke `store-listing/screenshots-tablet-7/`

- [ ] **Screenshot Tablet 10 inci (opsional, max 8)**
  - Format: PNG/JPEG, max 8 MB
  - Rasio: 16:9 atau 9:16
  - Resolusi: 1080 px – 7680 px per sisi
  - **Cara:** Ambil di tablet 10" atau emulator tablet 10"
  - Simpan ke `store-listing/screenshots-tablet-10/`

- [ ] **Content Rating** — Isi kuesioner IARC di Play Console → Store presence → Content rating

- [ ] **Data Safety Form** — Play Console → App content → Data safety → Deklarasi pengumpulan data

- [ ] **Target Audience** — Play Console → App content → Target audience → Pilih rentang usia

- [ ] **Privacy Policy URL** — URL kebijakan privasi (wajib). Perlu disiapkan/dihosting terpisah

### Panduan Ambil Screenshot

Untuk mendapatkan screenshot berkualitas tinggi:

**Opsi 1: Emulator Android Studio**
```bash
# Buka Android Studio → Virtual Device Manager
# Buat device: Pixel 7 (phone), Nexus 7 (tablet 7"), Pixel Tablet (tablet 10")
# Jalankan app, lalu klik camera icon di toolbar emulator
```

**Opsi 2: Device Fisik**
```bash
# Di device Android: tekan Power + Volume Down secara bersamaan
# Screenshot tersimpan di gallery
# Transfer ke komputer
```

**Opsi 3: ADB Screenshot**
```bash
# Dari terminal, dengan device terhubung via USB debugging:
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png ./store-listing/screenshots-phone/
```

### Struktur Folder Store Listing

```
mobile/store-listing/
├── icon-512x512.png                          ← Siap
├── feature-graphic-1024x500.png              ← Siap
├── screenshots-phone/                        ← Manual (min 2, max 8)
│   ├── 01-login.png
│   ├── 02-dashboard.png
│   ├── 03-kasir.png
│   ├── 04-riwayat.png
│   ├── 05-simpanan.png
│   ├── 06-pinjaman.png
│   ├── 07-profil.png
│   └── 08-laporan.png
├── screenshots-tablet-7/                     ← Manual (opsional)
└── screenshots-tablet-10/                    ← Manual (opsional)
```
