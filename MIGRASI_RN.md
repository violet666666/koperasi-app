# Master Plan Eksekutif: Migrasi Penuh Koperasi Digital ke React Native (Mobile App)

Dokumen ini adalah cetak biru (Blueprint) komprehensif untuk mereplika **100% fitur website Next.js Koperasi PRIMKOPPOL** ke dalam aplikasi **Mobile Native (Android & iOS)** menggunakan React Native.

Proses ini didesain dengan prinsip **Zero Downtime & Zero Impact**, artinya selama pengembangan, website *live* dan operasional koperasi tidak akan terganggu sama sekali.

---

## 🏗️ 1. Arsitektur Infrastruktur (Monorepo Turborepo)

Kita akan mengubah repository `koperasi-app` menjadi Monorepo. Semua kode untuk Web dan Mobile berada di satu tempat namun dieksekusi terpisah.

### Struktur Folder Ideal

```text
koperasi-app/
├── package.json               # Dependensi global (Turborepo)
├── turbo.json                 # Konfigurasi build system
├── apps/
│   ├── web/                   # 🌐 [CURRENT] Website Next.js (Admin & Kasir)
│   └── mobile/                # 📱 [NEW] Aplikasi React Native Expo (Android/iOS)
└── packages/
    ├── ui/                    # 🎨 Komponen UI bersama (Opsional)
    ├── config-tailwind/       # 💅 Konfigurasi warna biru koperasi & font statis
    └── koperasi-api-client/   # 🔗 Jembatan fetch Axios/Zod untuk hit ke Web Backend
```

**Kelebihan Skema Ini:**
Jika Bapak mengubah skema database Prisma di Web, kode *Mobile* otomatis bisa menyesuaikan tipe datanya karena berada di repository yang sama.

---

## 🛠️ 2. Core Technology Stack (Teknologi Pendukung)

Untuk memastikan performa sekelas aplikasi *Native* namun dengan rasa fleksibilitas Web, kita akan menggunakan:

| Kategori | Teknologi Pilihan | Alasan |
| - | - | - |
| **Framework Mobile** | **Expo (React Native)** | Memudahkan *build* ke APK/AAB Android & iOS IPA tanpa pusing konfigurasi Gradle/Xcode kompleks. |
| **Routing / Navigasi** | **Expo Router v3** | Menggunakan sistem navigasi *File-based* (mirip persis dengan `src/app` Next.js saat ini). |
| **Styling** | **NativeWind (Tailwind CSS)** | Developer dapat menggunakan `className="bg-primary text-white"` persis seperti di website Next.js Koperasi. |
| **Data Fetching** | **TanStack Query (v5)** | Untuk *caching* data real-time, handling *loading spinner*, dan mekanisme sinkronisasi di HP lambat. |
| **Form Management** | **React Hook Form + Zod** | Sama seperti web, divalidasi dengan sangat ketat agar data keuangan tidak tembus nilai minus/salah. |
| **Penyimpanan Lokal** | **Expo SecureStore** | Menyimpan Token Login dan Session secara aman teraplikasi enkripsi Native HP. |

---

## 🚀 3. Eksekusi Fase Migrasi

Pengembangan dilakukan secara iteratif (bertahap). Pada tiap tahap, Bapak bisa langsung mengetes fungsi dari *smartphone* Android menggunakan aplikasi bawaan **Expo Go**.

### FASE 1: Inisialisasi & Setup Autentikasi (Minggu 1)

Karena website menggunakan NextAuth (Cookies), Mobile App membutuhkan **API Token/JWT (JSON Web Token)**.

1.  **API Refactoring di Web (`apps/web/src/app/api`)**:
    - Membuka sedikit celah di API existing agar bisa menerima verifikasi lewat *Header Authorization Bearer Token*, bukan hanya membaca Cookies Session browser.
2.  **Setup Expo & NativeWind (`apps/mobile`)**.
3.  **Membangun Layar Login Mobile**:
    - Integrasi login NRP/Email dan Password.
    - Pengecekan *Role* dinamis pasca-login (mengarahkan Operator, Kasir, atau Anggota ke *Dashboard Bottom Tabs* yang berbeda).

### FASE 2: Modul Utama Anggota & Dashboard (Minggu 2)

1.  **Navigasi Bawah (Bottom Tab Bar)**: `Beranda`, `Mutasi`, `Pinjaman`, `Profil`.
2.  **Dashboard Real-time**:
    - Membaca `/api/dashboard-stats` dan menampilkannya dengan Chart / Grafik Native yang *smooth*.
3.  **Tracking Angsuran & Simpanan**:
    - Memindahkan tabel dari web ke **FlatList React Native** khusus dengan *Pull-to-Refresh* (tarik layar ke bawah untuk reload mutasi baru).
    - Card khusus "Sisa Tenor Pinjaman" Bapak dan "Estimasi Tagihan Bulan Ini".

### FASE 3: Modul Operasional (Kasir & Unit) (Minggu 3 & 4)

Untuk menjamin Kasir (Toko, Barbershop, Cuci Mobil) dapat beroperasi *hanya modal HP Tablet*, kita replikasi sistem POS:

1.  **Toko / POS Kasir**:
    - Tampilan *kasir touchscreen* (Scanner Barcode memanfaatkan Kamera HP OS-Level).
    - Fitur "Potong Gaji/Kredit Anggota" lengkap dengan form pencarian NRP.
2.  **Persetujuan (Approval) Pinjaman**:
    - Layar khusus Operator/Admin di Mobile untuk *Swipe to Approve* atau Tolak pengajuan dari anggota.
3.  **Audit Log Mobile (Operator Only)**: List histori aktivitas *real-time* yang dapat dipantau dari manapun.

### FASE 4: Polishing & Device Integrations (Minggu 5)

1.  **Integrasi Printer Thermal Bluetooth**:
    - Jika kasir menekan "Bayar", Print Struk (*receipt*) langsung dikirim lewat koneksi Bluetooth ke printer kasir format 58mm/80mm tanpa driver tambahan.
2.  **Push Notifications (Expo Push / Firebase)**:
    - Apabila pinjaman masuk/disetujui, HP anggota akan bergetar dan memunculkan notifikasi mirip WhatsApp.
3.  **Splash Screen & App Icon**: Branding Logo Primkoppol yang elegan saat aplikasi di-*tap*.

---

## 🔒 4. Keamanan & Pengamanan Server

1.  **Environment Variables**: Mobile APP dilarang menyimpan URL rahasia, semua rahasia tetap berada di sisi `apps/web/.env`.
2.  **CORS & Rate Limiting**: Next.js Server akan dikonfigurasi untuk menerima request API yang asalnya *hanya* dari App React Native *signature* kita, meminimalisir bot eksternal.
3.  **Offline Caching Terbatas**: Data nominal sensitif tidak boleh di *cache* terlalu lama; kita mengandalkan TanStack Query untuk secara agresif membersihkan sisa cache agar angka selalu cocok.

---

## 📱 5. Proses Build & Deployment Akhir

Berbeda dengan Vercel yang me-*hosting* website, mobile app di-distribusikan secara *binary* (`.apk` atau `.aab`).

**Proses Distribusi Internal Koperasi:**

- Menggunakan **EAS (Expo Application Services) Build**.
- Server cloud Expo akan melakukan proses *compiling* kode JavaScript kita menjadi Bahasa C++/Java secara remote.
- Hasil *output* akan berupa sebuah link download atau file **`KoperasiPrimkoppol_v1.0.apk`**.
- File tersebut bisa langsung disebarkan lewat **Grup WhatsApp Anggota** untuk langsung di-*install* (Sideload), tanpa harus menunggu proses verifikasi berhari-hari dari Google PlayStore.

*(Kedepannya Bapak tetap memiliki hak opsional jika ingin secara resmi dirilis di Google Play Store Koperasi Polri)*.

### 📝 Cara Build APK untuk Uji Coba

Untuk menghasilkan file `.apk` yang bisa di-install di HP lain:

1.  **Install EAS CLI**: `npm install -g eas-cli`
2.  **Login ke Expo**: `eas login`
3.  **Konfigurasi Project**: `eas build:configure` (Pilih Android)
4.  **Edit `eas.json`**: Pastikan ada profil `preview` dengan `buildType: "apk"`.

    ```json
    {
      "build": {
        "preview": {
          "android": {
            "buildType": "apk"
          }
        }
      }
    }
    ```

5.  **Jalankan Build**: `eas build -p android --profile preview`
6.  Tunggu proses selesai di cloud, lalu download file `.apk` melalui link yang diberikan.

---

## 📋 6. Daftar Fitur Lengkap Sistem (Website to Mobile)

Berikut adalah rekapitulasi 100% fitur yang saat ini sudah beroperasi penuh di Website Next.js, beserta target skope ketersediaannya di aplikasi Mobile nantinya:

| Kategori Fitur | Deskripsi (Fungsi Saat Ini di Web) | Target Integrasi di Mobile App |
| - | - | - |
| **Autentikasi & Role** | Login multi-role (Operator, Admin, Kasir, Anggota). | ✅ *Full Support* (Support Login NRP). |
| **Dashboard Utama** | Ringkasan statistik (Total Kas, Anggota, Pencairan, Transaksi). | ✅ *Full Support* (UI disesuaikan per Role). |
| **Anggota** | Pendaftaran otomatis (via Import Tunkin/Gaji), Kartu/Buku Anggota. | ✅ *Partial* (Anggota melihat kartu & histori mandiri). |
| **Simpanan** | Transaksi Pokok, Wajib, Sukarela. Cetak Kwitansi thermal/A4. | ✅ *Partial* (Anggota melihat mutasi, Kasir khusus input). |
| **Pinjaman & Approval** | Pengajuan, simulasi angsuran AD-ART, Inbox Approval Admin. | ✅ *Full Support* (Termasuk push notification approval). |
| **Kas & Bank** | Transfer antar akun, pengeluaran non-simpan-pinjam. | ❌ *Web Only* (Fungsi ini lebih optimal di layar Desktop/Web). |
| **Akuntansi & Jurnal** | Buku Besar, Jurnal Penyesuaian, Otomatisasi Jurnal (*Double-entry*). | ❌ *Web Only* (Fungsi ini ditugaskan khusus Operator web). |
| **Aset** | Inventarisasi aset dan perhitungan Penyusutan (Depresiasi). | ❌ *Web Only*. |
| **Laporan & SHU** | Arus Kas, Neraca, Laba Rugi, Kalkulasi Alokasi SHU realtime. | ❌ *Web Only*. |
| **Toko POS & Inventory** | Produk toko, Kasir Touchscreen dengan opsi pembayaran *Kredit/Potong Gaji*. | ✅ *Full Support* (Digunakan Kasir Toko via Tablet/HP). |
| **Audit Log** | Pencatatan rekam jejak permanen (`CREATE`, `UPDATE`, `LOGIN`). | ✅ *Partial* (View logs ringan untuk Operator dari HP). |

---

## 🕒 7. Progress Tracker (Catatan Handover Developer / AI)

Bagian ini difungsikan khusus sebagai log atau penanda histori agar pengembang atau asisten AI selanjutnya (yang berbeda *session*) dapat dengan mudah melanjutkan pekerjaan dari persis titik terakhir yang ditinggalkan.

**🟩 Tahap 1: Stabilitas Core System Website (SELESAI ✅)**

- [x] Perbaikan perhitungan statistik di Dashboard (menghilangkan hardcode jumlah transaksi Hari Ini).
- [x] Modul **import Tunkin & Gaji massal** terintegrasi, dengan validasi pembuatan akun auto-NRP.
- [x] Perbaikan keranjang dan proses pembayaran **POS Kasir** agar mendukung potong saldo gaji (Kredit Unit Toko/Jasa).
- [x] Audit Log tersistem di belakang layar (middleware-level tracking) dan menu Audit Log dikunci eksklusif `operator`.
- [x] Sistem Website *fully live*, tersinkron dengan PostgreSQL (Prisma), dan mendukung layout *PWA (Progressive Web Application)*.

**🟩 Tahap 2: Setup Mobile App Monorepo (SELESAI ✅)**

- [x] Implementasi struktur bersebelahan (Side-by-side) `src/` web dan `mobile/` app.
- [x] Konfigurasi React Navigation untuk aplikasi React Native blank project.
- [x] Pembuatan sisi `src/app/api/mobile/login` agar validasi login dan distribusi spesifikasi token JWT.

**🟨 Tahap 3: Pengembangan UI Mobile (SEDANG BERJALAN ⏳)**

- [x] Form Login Native & Secure JWT Persistence (Terhubung ke Web API).
- [x] Bottom Tab Navigation (Beranda, Simpanan, Pinjaman, Profil) dengan Ionicons.
- [x] Dashboard Real-time Role-aware (Operator: statistik koperasi global; Anggota: saldo & pinjaman pribadi).
- [x] Simpanan History FlatList dari `/api/mobile/transactions`.
- [x] Pinjaman List dengan Badge Status + riwayat 3 angsuran terakhir dari `/api/mobile/loans`.
- [x] Profile Screen dengan Logout & NRP Display.
- [x] Centralized API Client (`src/lib/api.ts`) dengan JWT Bearer Interceptor.
- [x] JWT Middleware Backend (`api/mobile/middleware.ts`) untuk validasi token di semua endpoint mobile.
- [x] Mobile API: `/api/mobile/summary` (role-aware dashboard data).
- [x] Mobile API: `/api/mobile/transactions` (savings, unit credit, loan payments paginated).
- [x] Mobile API: `/api/mobile/loans` (daftar pinjaman + recent payments).
- [x] Mobile API: `/api/mobile/pengumuman` (pengumuman terbaru tampil di dashboard).
- [x] Auto-logout jika token expired (status 401).
- [x] Pengumuman Full Tab (5th tab: Info) dengan category icons, pinned indicator, dan detail modal.
- [x] Ganti Password via HP (`/api/mobile/change-password`) + bcrypt + Audit Log.
- [x] Pengajuan Pinjaman via HP (`/api/mobile/loan-apply`) — GET produk + POST apply dengan validasi plafon/tenor/max 3 aktif.
- [x] LoanApplicationScreen (pilih produk, kalkulator angsuran, konfirmasi submission).
- [x] ProfileScreen diperluas (menu: Ganti Password, Ajukan Pinjaman, Logout).
- [x] Stack Navigator diperluas (ChangePassword & LoanApplication sub-screens).
- [x] TransaksiScreen (3 tab filter: Simpanan/Kredit Unit/Angsuran) — menggantikan tab Simpanan.
- [x] FAB "Ajukan Pinjaman" dipindah dari Profil ke tab Pinjaman (sesuai flow web).
- [x] Web-Mobile Feature Parity Analysis & Navigation Restructure.
- [x] Tab Info dihapus → Pengumuman di-embed ke Beranda.
- [x] Dashboard Operator diperluas: 6 Stat Cards + Aktivitas Hari Ini (Simpanan/Pencairan/Angsuran) + Aksi Cepat.
- [x] `/api/mobile/summary` diperluas dengan today-activity stats (deposits/withdrawals/payments) + Tunkin + Tunggakan.
- [x] `colors.ts` — Centralized color palette sinkron dari web `globals.css` (Navy #1A2A44, Gold #D4AF37, Burgundy #5D2E3A).
- [x] Semua 9 screen mobile di-update dengan theme terpusat (Login, Dashboard, Transaksi, Pinjaman, Profil, ChangePassword, LoanApplication, Pengumuman, MainTabs).

### Fase 4a — Multi-Role Features

- [x] **Backend API**: `/api/mobile/approvals` (GET list pending + PATCH approve/reject + audit log)
- [x] **Backend API**: `/api/mobile/members` (GET search anggota by nama/NRP)
- [x] **Backend API**: `/api/mobile/savings-tx` (GET rekening + POST setoran/penarikan atomic)
- [x] **Backend API**: `/api/mobile/loan-payment` (GET pinjaman aktif + POST angsuran + auto-lunas)
- [x] **Backend API**: `/api/mobile/toko` (GET produk + POST checkout cash/kredit + stok deduction)
- [x] **Screen**: `ApprovalScreen` — List pengajuan pending + tombol Setujui/Tolak
- [x] **Screen**: `MemberListScreen` — Cari anggota + navigasi fitur transaksi
- [x] **Screen**: `SavingsTransactionScreen` — Input setoran/penarikan simpanan anggota
- [x] **Screen**: `LoanPaymentScreen` — Pilih pinjaman aktif & bayar angsuran
- [x] **Screen**: `KasirScreen` — Full POS: cari produk, keranjang, checkout tunai/kredit
- [x] **Screen**: `StokScreen` — Lihat persediaan barang khusus Kasir
- [x] **Navigation**: `MainTabs` & Stack Registration — tab berubah berdasar role (Anggota/Operator/Kasir)
- [x] **Dashboard**: Multi-role summary statistics (Operator global, Kasir sales, Anggota personal)

### Fase 4b — Mobile Reports & Device Peripherals

- [x] **Backend API**: `/api/mobile/reports/savings` (Rekapitulasi total produk simpanan, setoran & tarikan per-periode)
- [x] **Backend API**: `/api/mobile/reports/loans` (Rekapitulasi total dicairkan, status bayar, outstanding, kolektibilitas per-periode)
- [x] **Screen Operator**: `LaporanSimpananScreen` (Menampilkan indikator finansial koperasi & tabel rekap produk simpanan)
- [x] **Backend API**: `/api/mobile/push-token` (Menyimpan Expo Push Token anggota ke tabel database user untuk notifikasi).
- [x] **Export PDF/Excel (Mobile)**: Membuat fitur "Share as PDF" untuk laporan Simpanan & Laporan Pinjaman (Menggunakan `expo-print` & `expo-sharing`).
- [x] **Typing Refactor**: Update interface `MobileJWTPayload` di backend supaya TypeScript mengenali properti `branchId` dan `isOperator` agar tidak ada linter bypass.
- [-] **UI Refactor (NativeWind)**: Migrasi bertahap dari `StyleSheet.create` ke NativeWind (Tailwind CSS). *(Ditunda, UI StyleSheet difinalisasi).*
- [-] **Biometric Login**: Fitur opsional penyematan verifikasi Fingerprint/FaceID. *(Diskip sesuai permintaan).*

### Fase 4c — Audit Hardcode & Quality Assurance

- [x] **LoginScreen**: Refactor — hapus `import axios` + hardcode IP → gunakan centralized `api.ts`.
- [x] **api.ts**: IP hardcode → auto-detect IP dari Expo debugger (`Constants.expoConfig.hostUri`) + fallback production `primkoppol.online`.
- [x] **SimpananScreen**: Rewrote — semua warna inline `#0B2A4A` → `C.primary`, `#94A3B8` → `C.mutedForeground`, dll.
- [x] **ProfileScreen**: StatusBar hardcode `#0B2A4A` → `C.primary`.
- [x] **TransaksiScreen**: Warna hardcode `#0B2A4A` + `#0EA5E9` → `C.primary` + `C.accent`.
- [x] **PinjamanScreen**: Warna hardcode `#0B2A4A` + `#0EA5E9` → `C.primary` + `C.accent`.
- [x] **LoanApplicationScreen**: Warna hardcode `#0B2A4A` + `#0EA5E9` → `C.primary` + `C.accent`.
- [x] **PengumumanScreen**: Warna hardcode `#0B2A4A` + `#0EA5E9` → `C.primary` + `C.accent`.
- [x] **ChangePasswordScreen**: Warna hardcode `#0B2A4A` → `C.primary`.
- [x] **Full Audit**: Tidak ditemukan data dummy/mock/lorem pada seluruh screen source.

### Fase 4d — Stability & TypeScript Fixes

- [x] **Backend API**: Fixed 500 error in `/api/mobile/summary` (ditangani dengan `null-guard` jika akun user belum terkait `memberId`).
- [x] **Backend API**: Memperbaiki salah path import middleware di `/api/mobile/reports/savings` dan `/api/mobile/reports/loans` (`../../middleware`).
- [x] **Backend API**: Memperbaiki derivation status `isOperator` agar berdasarkan `role` dari JWT payload.
- [x] **Backend API**: Fixed TypeScript errors di `/api/mobile/loan-apply` (menggunakan `maxTenorMonths`, `productId`, dan menghapus field yang tidak ada pada `LoanApplication`).
- [x] **Backend API**: Fixed TypeScript errors di `/api/mobile/loans` (mengubah `tenor` menjadi `tenorMonths` sesuai Schema Prisma).
- [x] **Backend API**: Fixed tipe audit logger module dari `"AuthMobile"` menjadi `"Auth"` pada login dan change-password.
- [x] **Frontend Mobile**: Restrukturisasi try-catch bertingkat di `DashboardScreen.tsx` agar setiap request ditangani terpisah log-nya.
- [x] **Frontend Mobile**: Menghapus duplikasi import `C` di `PengumumanScreen.tsx` hasil dari script sebelumnya.
### Fase 4e — Overhaul UX & Kelengkapan Fitur Mobile

- [x] **LoginScreen**: Tambah Show/Hide Password toggle (icon mata), redesign UI dengan branding PRIMKOPPOL dan input icon.
- [x] **Splash Screen**: Implementasi splash screen native saat buka aplikasi (logo PRIMKOPPOL + animasi loading).
- [x] **app.json**: Update nama aplikasi "Koperasi Primkoppol", splash background navy `#1A2A44`, package identifier.
- [x] **Back Button**: Tambah tombol kembali (arrow-back) ke **semua screen** yang sebelumnya tidak memilikinya:
  - ApprovalScreen, MemberListScreen, KasirScreen, StokScreen
  - LaporanSimpananScreen, LaporanPinjamanScreen
  - PengumumanScreen (conditional, hanya muncul saat diakses dari Stack, tidak di Tab)
- [x] **DashboardScreen**: Overhaul total — grid menu navigasi lengkap untuk setiap role:
  - **Anggota**: Mutasi Transaksi, Pinjaman Saya, Ajukan Pinjaman, Kartu Anggota, Pengumuman, Ganti Password
  - **Operator**: Approval, Anggota, Transaksi Simpanan, Input Angsuran, Laporan Pinjaman/Simpanan, Pengumuman, Ganti Password
  - **Kasir**: Kasir/POS, Stok Barang, Pengumuman, Ganti Password
- [x] **Fix Navigasi Broken**: Error `NAVIGATE 'Member'` dihilangkan, diganti route yang benar ke `MemberListFull`.
- [x] **Notification Bell**: Tombol notifikasi (lonceng) di header Dashboard mengarah ke halaman Pengumuman.
- [x] **Pengumuman Clickable**: Setiap pengumuman di Dashboard bisa di-tap untuk melihat detail lengkap.
- [x] **PengumumanDetailScreen** [NEW]: Halaman full-page untuk baca pengumuman (kategori badge, penulis, tanggal, isi lengkap).
- [x] **MemberDetailScreen** [NEW]: Detail profil anggota lengkap (NRP, email, telepon, satker, kategori, gaji, tunkin, simpanan, pinjaman).
- [x] **AnggotaCardScreen** [NEW]: Kartu anggota digital premium (info NRP, nama, role, simpanan, pinjaman aktif).
- [x] **MemberListScreen**: Tambah tombol "Detail" per-anggota untuk navigasi ke MemberDetailScreen.
- [x] **Backend API**: Endpoint baru `GET /api/mobile/members/[id]` untuk detail anggota.
- [x] **App.tsx**: Registrasi seluruh screen baru ke Stack Navigator (PengumumanDetail, MemberDetail, AnggotaCard, dll).

### Fase 4f — Splash Screen Overhaul, Login UX & Ekspansi Fitur Operator

- [x] **Splash Screen**: Ganti ikon `Ionicons shield` → gambar logo `LogoPrimkoppol.png` asli berukuran 300×300 tanpa container putih, tampil langsung di atas background navy `#1A2A44`.
- [x] **LoginScreen**: Perbesar logo dari 100×100 → 300×300 (3× lipat), tambah `textAlign: 'center'` eksplisit pada teks "PRIMKOPPOL LUMAJANG", wrap konten ke `ScrollView` agar tidak overflow di layar kecil.
- [x] **LoginScreen — Remember Me**: Tambah checkbox "Ingat NRP / Email saya". Jika dicentang, `identifier` disimpan ke `SecureStore` dengan key `rememberedIdentifier` dan di-restore otomatis saat aplikasi dibuka kembali.
- [x] **Backend API**: `GET /api/mobile/loans-operator` — daftar semua pinjaman (semua anggota) untuk operator, support filter `status` (all/active/overdue/paid), pencarian `search` (nama/NRP/No. Anggota), pagination, dan ringkasan summary per-status. Tipe-safe dengan `Prisma.LoanWhereInput`.
- [x] **Backend API**: `GET /api/mobile/savings-accounts` — daftar semua rekening simpanan aktif (semua anggota) untuk operator, support pencarian, pagination, agregat total saldo, dan ringkasan per-produk simpanan. Tipe-safe dengan `Prisma.SavingsAccountWhereInput`.
- [x] **Screen Operator**: `DaftarPinjamanScreen` [NEW] — Daftar semua pinjaman dengan tab filter (Semua/Aktif/Menunggak/Lunas), search bar, progress bar pelunasan, info cicilan/bulan, dan tombol "Input Angsuran" langsung dari list.
- [x] **Screen Operator**: `RekeningListScreen` [NEW] — Daftar seluruh rekening simpanan anggota, summary card total saldo + rekap per-produk, search, pagination load-more, tombol "Setor / Tarik" per rekening yang navigasi ke `SavingsTransactionScreen`.
- [x] **Screen Operator**: `ProfilKoperasiScreen` [NEW] — Halaman informasi koperasi: hero card dengan logo, stats (anggota/simpanan/usia), seksi identitas (No. BH, NPWP, tanggal berdiri), alamat, kontak (telepon/email/website dapat di-tap untuk Linking), dan deskripsi koperasi. Data realtime dari `/api/mobile/summary`.
- [x] **DashboardScreen Operator**: Menu utama diperluas dan dibagi dua seksi — "Transaksi & Anggota" (Approval, Anggota, Rekening Simpanan, Input Angsuran, Daftar Pinjaman, Profil Koperasi) dan "Laporan & Pengaturan" (Laporan Pinjaman, Laporan Simpanan, Pengumuman, Ganti Password). Total menu operator naik dari 8 → 10 item.
- [x] **App.tsx**: Registrasi tiga screen baru ke Stack Navigator: `DaftarPinjaman`, `RekeningList`, `ProfilKoperasi`.

### Fase 4g — Arsitektur Single-Entity & Integrasi Tabungan Wajib (NEW UPDATE)

- [ ] **Backend API Sync**: Memastikan seluruh Endpoint API Mobile tidak lagi memanggil/menampilkan field `branchId` atau `branchName` karena sistem telah dirombak menjadi **Single-Entity (100% PRIMKOPPOL LUMAJANG)**.
- [ ] **Backend API Sync**: Sinkronisasi `/api/mobile/summary` dan API terkait agar agregasi **Total Simpanan** menggabungkan data `SavingsAccount.balance` dengan raw data `Member.tabunganWajib` (hasil import), memastikan Dashboard Mobile sinkron dengan Web (Total Simpanan muncul valid walau belum ada transaksi setoran manual).
- [ ] **Frontend Mobile Layout**: Menghapus seluruh dropdown cabang dan label Cabang dari Profil Screen, Member Detail Screen, dan Operator Dashboard (jika ada).
- [ ] **SHU Mobile Adaption**: Menyiapkan logic endpoint `/api/mobile/reports/shu` agar menghitung Jasa Simpanan (Modal) dengan rule *minimum floor 6%* sesuai yang sudah diimplementasikan stabil di versi Web.

### Fase 5: 100% Web Feature Parity — Modul Akuntansi, Master Data & Audit di Mobile

> Semua fitur yang sebelumnya hanya tersedia di Web kini dijadwalkan masuk ke Mobile App.
> Strategi UI: tabel data lebar menggunakan **Horizontal ScrollView** + form wizard bertingkat untuk input yang kompleks.

#### Fase 5a — Kas & Bank + Audit Log

- `[x]` **Backend API**: `GET/POST /api/mobile/kas-bank` — Daftar akun kas/bank, saldo, transfer antar akun, pencatatan pengeluaran/penerimaan operasional.
- `[x]` **Backend API**: `GET /api/mobile/audit-logs` — Riwayat aktivitas user (CREATE, UPDATE, LOGIN, DELETE dsb.) dengan pagination & filter.
- `[x]` **Screen Operator**: `KasBankScreen` — Daftar rekening kas/bank + saldo + form transfer cepat + mutasi terakhir.
- `[x]` **Screen Operator**: `AuditLogScreen` — FlatList riwayat aktivitas (icon action, user, modul, deskripsi, waktu).
- `[x]` **Navigasi**: Registrasi menu baru di DashboardScreen Operator & App.tsx.

#### Fase 5b — Jurnal & Buku Besar (Akuntansi Double-Entry)

- [x] **Backend API**: `GET/POST /api/mobile/journals` — Daftar jurnal umum + pembuatan jurnal penyesuaian dengan validasi Debit == Kredit.
- [x] **Backend API**: `GET /api/mobile/accounts` — Bagan Akun (Chart of Accounts) untuk pilihan dropdown di form jurnal.
- [x] **Screen Operator**: `JurnalDaftarScreen` — Daftar jurnal (FlatList + search + filter periode) dengan Horizontal ScrollView untuk baris Debit/Kredit.
- [x] **Screen Operator**: `JurnalInputScreen` — Form input jurnal baru: wizard bertingkat dengan dynamic add-row untuk baris akun Debit/Kredit. Indikator Balance merah/hijau. Konfirmasi 2 tahap sebelum simpan.
- [x] **Screen Operator**: `BukuBesarScreen` — Filter per akun + rentang tanggal. Tampilkan mutasi Debit/Kredit beserta saldo berjalan (running balance) dengan Horizontal ScrollView.

#### Fase 5c — Laporan Keuangan Komprehensif (Neraca, Laba Rugi, SHU)

- [x] **Backend API**: `GET /api/mobile/reports/financial` — Aggregator data Neraca (aset/kewajiban/ekuitas) dan Laba Rugi (pendapatan/beban) per periode.
- [x] **Backend API**: `GET /api/mobile/reports/shu-calculator` — Kalkulasi Alokasi SHU per anggota (Jasa Anggota 25%, Jasa Simpanan 20%, Cadangan 30%, dsb.) sesuai AD-ART.
- [x] **Screen Operator**: `LabaRugiScreen` — Card pendapatan vs beban + laba bersih. Tabel detail dalam ScrollView.
- [x] **Screen Operator**: `NeracaScreen` — Aset = Kewajiban + Ekuitas. Card total + tabel breakdown per akun.
- [x] **Screen Operator**: `LaporanSHUScreen` — Ringkasan distribusi SHU koperasi + daftar top anggota penerima SHU.
- [ ] **Export**: Share as PDF via `expo-print` + `expo-sharing` untuk semua laporan.

#### Fase 5d — Manajemen Aset & Inventaris

- [ ] **Backend API**: `GET/POST /api/mobile/assets` — Daftar aset koperasi, detail per aset (nilai buku, akumulasi penyusutan, umur ekonomis), tambah aset baru.
- [ ] **Screen Operator**: `AsetListScreen` — Daftar aset (FlatList), card per aset: nama, kategori, nilai perolehan vs nilai buku, progress bar penyusutan, status (active/disposed).
- [ ] **Screen Operator**: `AsetDetailScreen` — Detail aset lengkap + kalkulasi depresiasi berjalan.

#### Fase 5e — Master Data, User Management & Import Data

- [ ] **Backend API**: `GET/POST /api/mobile/master-data` — CRUD Produk Simpanan, Produk Pinjaman, dan Bagan Akun (COA).
- [ ] **Backend API**: `GET/POST /api/mobile/users` — Daftar user + role, tambah/edit user baru, reset password.
- [ ] **Backend API**: `POST /api/mobile/members/import` — Upload CSV/Excel file data anggota & Tunkin dari smartphone (multipart form data).
- [ ] **Screen Operator**: `MasterDataHubScreen` — Menu pusat: Produk Simpanan, Produk Pinjaman, COA. Masing-masing masuk ke sub-screen list + create/edit.
- [ ] **Screen Operator**: `UserManagementScreen` — Daftar user sistem + role badge + form tambah/edit.
- [ ] **Screen Operator**: `ImportDataScreen` — Pilih file CSV/Excel dari HP via `expo-document-picker`, preview data, konfirmasi upload. Tampilkan hasil (berhasil/gagal/skip).
- [ ] **Screen Operator**: `PengumumanCRUDScreen` — Buat, edit, dan hapus pengumuman langsung dari HP (tidak lagi hanya read-only).

#### Fase 5f — Rombak Dashboard Operator & Final QA

- [ ] **DashboardScreen Operator**: Overhaul total menjadi layout **Collapsible Sections** (Kategori Lipat):
  - 📊 **Pusat Kasir & Toko** (Kasir POS, Stok Barang)
  - 👥 **Anggota & Simpan-Pinjam** (Anggota, Rekening, Approval, Input Angsuran, Daftar Pinjaman, Ajukan Pinjaman)
  - 💰 **Akuntansi & Keuangan** (Kas & Bank, Jurnal, Buku Besar, Aset, Laporan Laba Rugi, Neraca, SHU)
  - ⚙️ **Administrasi Sistem** (Master Data, User Management, Import Data, Pengumuman, Audit Log, Profil Koperasi, Ganti Password)
- [ ] **End-to-End Testing**: Verifikasi navigasi semua screen + otorisasi JWT per role.
- [ ] **Performance Review**: Monitor API latency untuk query aggregate (jurnal, buku besar, laporan).

---

## 🚀 FASE 6: APK Production Build & Deployment Publik

### 6.1 — Pra-Syarat Sebelum Build

- [x] **Domain HTTPS Aktif**: `https://www.primkoppol.online` sudah live.
- [x] **API Mobile Aktif**: Semua endpoint `/api/mobile/*` ter-deploy.
- [x] **`api.ts` Production URL**: Fallback diubah dari IP lokal ke `https://www.primkoppol.online`.
- [x] **`app.json` usesCleartextTraffic**: Ditambahkan untuk kompatibilitas Android 9+.
- [x] **`expo-secure-store` Plugin**: Ditambahkan agar token JWT aman di standalone build.

### 6.2 — Langkah Build APK

```bash
cd mobile
npm install
npx eas login
npx eas build -p android --profile preview
# Tunggu ~15-25 menit, download APK dari link yang diberikan
```

### 6.3 — Troubleshooting Login Gagal

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| Login Gagal / Network Error | APK konek ke localhost | Pastikan fallback = primkoppol.online |
| ERR_CLEARTEXT | Android blokir HTTP | usesCleartextTraffic + domain HTTPS |
| Auto logout | JWT expired 24h | Login ulang (by design) |
| Fetch error | API belum deploy | Deploy ulang web terlebih dahulu |

### 6.4 — Distribusi APK & Akses Publik

File `.apk` atau `.aab` yang telah di-build bisa didistribusikan agar dapat diakses oleh anggota dan publik dengan 2 metode:

**Opsi 1: Sideload Direct Download (Rekomendasi Internal Koperasi)**
Paling cepat dan tanpa *review* dari pihak ketiga.
1. Download file `.apk` dari link Expo EAS Build.
2. *Rename* file menjadi nama yang mudah dikenali, contoh: `KoperasiPrimkoppol_v1.0.apk`.
3. Upload file tersebut ke hosting web koperasi (misal buatkan link: `https://www.primkoppol.online/download/app.apk`) atau simpan di Google Drive.
4. Bagikan link website/Drive tersebut via broadcast WhatsApp grup anggota koperasi. 
5. Anggota mendownload dan mengizinkan "Install from Unknown Sources" di HP masing-masing.
6. Install → Login NRP & Password → Selesai.

**Opsi 2: Publikasi ke Google Play Store (Publik & Akses Resmi)**
Agar aplikasi aman (Verified by Play Protect) dan bisa di-search oleh umum:
1. Ubah format build menjadi Android App Bundle (`.aab`). Pada `eas.json`, tambah/ubah profil production menjadi `"buildType": "app-bundle"`.
2. Build ulang paket: `eas build -p android --profile production` (atau nama profil rilis Anda).
3. Daftarkan institusi koperasi ke **Google Play Console Developer** (Registrasi resmi dikenakan biaya $25 seumur hidup dari Google).
4. Buat *App Project* baru di console, isi kelengkapannya: Nama App (saran: PRIMKOPPOL Lumajang), Deskripsi, Kuesioner Rating Umur, Grafis/Screenshot UI, dan Link Kebijakan Privasi (WAJIB di-hosting di web koperasi).
5. Pada menu Release -> Production, uduh/upload file `.aab` terbaru.
6. *Submit for Review*. Tim Google Play akan mereview kelayakan aplikasi selama 2-7 hari kerja.
7. Setelah "Approved", aplikasi akan *Live* di Play Store. Anggota cukup mencari nama aplikasi di PlayStore dan otomatis ter-update bila Bapak meng-upload versi `.aab` terbaru di masa depan.

### 6.5 — Paritas Fitur Mobile vs Web (Target 100%)

| Fitur | Web | Mobile | Status |
| --- | --- | --- | --- |
| Login multi-role | ✅ | ✅ | ✅ Selesai |
| Dashboard (semua role) | ✅ | ✅ | ✅ Selesai |
| Simpanan & Mutasi | ✅ | ✅ | ✅ Selesai |
| Pinjaman & Angsuran | ✅ | ✅ | ✅ Selesai |
| Pengajuan & Approval | ✅ | ✅ | ✅ Selesai |
| POS Kasir | ✅ | ✅ | ✅ Selesai |
| Stok, Pengumuman, Profil | ✅ | ✅ | ✅ Selesai |
| Kartu Anggota Digital | ✅ | ✅ | ✅ Selesai |
| Laporan (Simpanan/Pinjaman) | ✅ | ✅ | ✅ Selesai |
| Tunjangan, Tajib, Gaji, SHU | ✅ | ✅ | ✅ Selesai |
| Kas & Bank | ✅ | ✅ | ✅ Selesai |
| Audit Log | ✅ | ✅ | ✅ Selesai |
| Jurnal & Buku Besar | ✅ | ✅ | ✅ Fase 5b Selesai |
| Laporan Keuangan (Neraca/L-R/SHU) | ✅ | ✅ | ✅ Fase 5c Selesai |
| Manajemen Aset | ✅ | 🔲 | ⏳ Fase 5d |
| Master Data & User Management | ✅ | 🔲 | ⏳ Fase 5e |
| Import Data Anggota & Tunkin | ✅ | 🔲 | ⏳ Fase 5e |
| Pengumuman CRUD (Create/Edit/Delete) | ✅ | 🔲 | ⏳ Fase 5e |

---

*Dokumen Master Plan & Tracking ini terakhir diperbarui pada **30 Maret 2026**.*
