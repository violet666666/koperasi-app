# Koperasi Digital — Primkoppol Resor Lumajang

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-55-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.83-61DAFB?style=for-the-badge&logo=react&logoColor=white)

Sistem manajemen koperasi digital yang komprehensif untuk **Koperasi PRIMKOPPOL Polres Lumajang**. Dibangun dengan Next.js 16, TypeScript, dan Prisma untuk platform web, serta Expo/React Native untuk platform mobile (Android & iOS).

## 🌐 Live Demo

- **Web App**: [https://www.primkoppol.site](https://www.primkoppol.site)
- **Mobile APK**: Build via EAS (lihat [panduan mobile](#-mobile-app))

## ✨ Highlights

- 📊 **160+ halaman & 90+ API endpoint** — fitur koperasi paling lengkap
- 📱 **Mobile app native** (Android & iOS) dengan fitur paritas penuh
- 🏦 **Akuntansi double-entry** — Jurnal, Buku Besar, Neraca, Laba Rugi
- 💰 **SHU realtime** — Kalkulasi otomatis sesuai AD-ART Pasal 42
- 🛒 **POS Kasir** — Toko retail dengan skema kredit potong gaji
- 📄 **Import Excel** — Migrasi data anggota, pinjaman, Tunkin, Gaji
- 🔐 **5 role** — Operator, Admin Unit, Admin SP, Kasir, Anggota (portal)
- 📝 **Audit trail** — Logging aksi append-only dengan IP & User Agent

---

## 🚀 Fitur Utama

### 👥 Manajemen Anggota
- Siklus lengkap: pendaftaran, aktif, non-aktif, pensiun
- Profil detail dengan histori simpanan & pinjaman
- Import massal dari Excel/CSV (NAMA, NRP, TUNKIN, GAJI)
- Buku anggota & kartu anggota digital

### 💰 Simpanan
- 4 produk simpanan: Pokok, Wajib, Sukarela, Sejahtera
- Transaksi realtime: setoran & penarikan
- Running balance otomatis per rekening
- Rekap simpanan per produk & per anggota

### 💸 Pinjaman
- Bunga 0% + biaya administrasi 1% (Biaya Jasa Primkoppol)
- Flow: Pengajuan → Review → Approval → Pencairan → Angsuran
- Import migrasi data pinjaman SP lama dari Excel
- Jadwal angsuran otomatis, parser tanggal Bahasa Indonesia
- Auto-create akun anggota baru (NRP format `NO-NRP-XXXX`)

### 📊 Akuntansi & Keuangan
- Chart of Accounts (CoA) — Bagan Akun kustom
- Jurnal Umum, Buku Besar, Jurnal Penyesuaian
- Kas & Bank: transaksi, transfer, buku kas
- Kwitansi: cetak A4 (arsip) / Thermal 80mm (kasir)
- Aset koperasi dengan penyusutan otomatis

### 📈 Laporan
- Neraca (Laporan Posisi Keuangan)
- Laba Rugi
- Arus Kas
- Rekapitulasi Simpanan, Pinjaman, Anggota
- Simulasi SHU realtime sesuai AD-ART

### 🛒 Toko / Unit Usaha
- Kasir POS dengan barcode dan lookup NRP
- Pembayaran Tunai atau Kredit (Potong Gaji)
- Manajemen stok & persediaan
- Import produk massal
- 10 unit usaha: Toko, Resto & Cafe, Cafe LSP, Cuci Mobil, Barbershop, Fitness, Play Station, Fotocopy, Laundry, Haji & Umrah (lihat [Peta Fitur](#️-peta-fitur-unit--role))

### 📋 Tagihan Piutang (Billing Receivables)
- Siklus penagihan bulanan (16 - 15) atau custom date range
- Generate rekap piutang otomatis dari transaksi kredit
- Toggle per item/anggota sebelum settle
- Proses & settle: update status pembayaran massal (partial supported)
- Hapus draft & regenerate untuk periode yang sama
- Riwayat tagihan per periode
- Export PDF profesional (A4 kop surat) & Excel (3 sheets)
- Member portal: halaman Faktur untuk anggota lihat tagihan sendiri

### 📱 Mobile App (Expo / React Native)
- Fitur paritas 100% dengan web untuk setiap role
- Bottom navigation kontekstual per role (4 tab)
- Pull-to-refresh, splash screen, secure token storage
- Dashboard operator: ringkasan, aktivitas, collapsible menu
- Dashboard anggota: simpanan, pinjaman, tunkin, SHU, gaji
- Kasir POS, stok barang, approval pinjaman

### 🔐 Keamanan
- NextAuth.js v5 dengan session management
- Role-Based Access Control (4 level)
- Audit Log append-only (IP, User Agent, diff sebelum/sesudah)
- Konfirmasi "RESET-DATA" untuk operasi destruktif

---

## 🗺️ Peta Fitur: Unit × Role

Sumber kebenaran navigasi: [`src/lib/constants/navigation.ts`](src/lib/constants/navigation.ts) (RBAC v2 — role + unitType), daftar unit: [`src/lib/constants/units.ts`](src/lib/constants/units.ts).

### 1. Matriks Unit Usaha × Fitur (tampilan Admin unit)

| Unit | POS Kasir | Shift | Produk/Menu/Layanan | Stok & Persediaan | Promo | Modifier | KDS / Antrian | Denah Meja | Laporan Unit | Insight | Fitur Khusus |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|------|
| **Toko** (`toko`) | ✅ | ✅ | ✅ Produk + Harga | ✅ Persediaan + Stock Tracking + Batch | ✅ | — | — | — | ✅ | ✅ | Manajemen Kasir, Batch stok |
| **Resto & Cafe** (`resto`) | ✅ | ✅ | ✅ Menu | ✅ + Opname | ✅ | ✅ | ✅ KDS | ✅ | ✅ | ✅ | Opname Stok, Website Settings |
| **Cafe LSP** (`cafe_lsp`) | ✅ | ✅ | ✅ Menu | ✅ | ✅ | ✅ | ✅ KDS + Order Queue | — | ✅ | ✅ | Antrian order |
| **Cuci Mobil** (`cuci_mobil`) | ✅ | — | ✅ Layanan | — | — | — | — | — | ✅ | — | — |
| **Barbershop** (`barbershop`) | ✅ | — | ✅ Layanan | — | — | — | — | — | ✅ | — | — |
| **Fitness** (`fitness`) | ✅ | — | ✅ Layanan | — | — | — | — | — | ✅ | — | — |
| **Play Station** (`playstation`) | ✅ | ✅ | ✅ Produk & Jasa | — | — | — | — | — | ✅ | — | Pengaturan Console (timer rental) |
| **Fotocopy** (`fotocopy`) | ✅ | — | ✅ Layanan | — | — | — | — | — | ✅ | — | — |
| **Laundry** (`laundry`) | ✅ | — | ✅ Layanan | — | — | — | — | — | ✅ | — | — |
| **Haji & Umrah** (`haji_umrah`) | — | — | ✅ Produk tabungan | — | — | — | — | — | ✅ (laporan H&U) | — | Tabungan, Talangan, Bagi Hasil |

> Unit jasa (cuci mobil, barbershop, fitness, fotocopy, laundry) memakai navigasi generik `adminUnitNavigation` (POS + Kelola Layanan & Harga + Riwayat + Laporan + Approval). Halaman Laporan Unit (`/unit/[unitSlug]/laporan`) dibagi oleh SEMUA unit — perubahan berdampak ke semua unit.
> Admin dengan unitType `simpan_pinjam` / `investasi_modal_jp` jatuh ke navigasi pusat (`mainNavigation`) dengan filter role.

### 2. Matriks Role × Modul (Web)

| Modul | Operator | Admin Unit | Admin SP | Kasir |
|------|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Anggota (Daftar/Kartu/Buku) | ✅ | — | ✅ | — |
| Simpanan (Rekening/Transaksi/Rekap) | ✅ | — | ✅ | — |
| Pinjaman (Pengajuan/Daftar/Angsuran/Jadwal/Jasa) | ✅ | — | ✅ | — |
| Kas & Bank (Buku Kas/Kas/Bank/Transfer) | ✅ | —* | — | — |
| Non Simpan Pinjam (Penerimaan/Pengeluaran) | ✅ | —* | — | — |
| POS Unit (semua unit) | ✅ (via Transaksi Unit) | ✅ (unit sendiri) | — | ✅ (unit sendiri) |
| Produk/Menu/Layanan & Stok | ✅ | ✅ (unit sendiri) | — | lihat produk (toko) |
| Laporan Unit | ✅ | ✅ (unit sendiri) | — | — |
| Insight Penjualan | ✅ | ✅ (toko/resto/cafe-lsp) | — | — |
| Jurnal (Buku Besar/Umum/Penyesuaian) | ✅ | —* | ✅ | — |
| Laporan Keuangan (Neraca/Laba Rugi/Arus Kas/SHU/Rekap/Faktur Potongan/Piutang Gabungan) | ✅ | —* | ✅ | — |
| Gaji & Slip | ✅ | — | — | — |
| Aset & Penyusutan | ✅ | —* | — | — |
| Kwitansi | ✅ | ✅ | ✅ | — |
| Tagihan Piutang (Rekap/Riwayat) | ✅ | — | — | — |
| Tutup Buku & Alokasi SHU (Perhitungan/Distribusi) | ✅ | — | — | — |
| Manajemen Unit & Dashboard Unit | ✅ | — | — | — |
| Pengumuman | ✅ | — | ✅ | — |
| Inbox Approval | ✅ | ✅ | ✅ | — |
| Audit Log | ✅ | —* | — | — |
| Master Data (8 submenu) + User Management + Profil Koperasi | ✅ | — | — | — |
| Pengaturan / Profil Saya | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ | — / ✅ |

\* Hanya admin **pusat tanpa unitType** (fallback `mainNavigation`) — admin yang terikat unit tidak melihat modul ini.

**Portal Anggota** (`/portal`, tanpa login backoffice): dashboard simpanan/pinjaman/tunkin/SHU/gaji, pengajuan pinjaman, faktur/tagihan sendiri, kartu anggota.

### 3. Menu Kasir per Unit

| Unit kasir | Menu |
|------|------|
| Toko | POS, Shift, Daftar Produk, Riwayat Penjualan |
| Resto & Cafe | POS, Shift, Riwayat Penjualan |
| Cafe LSP | POS, Order Queue (antrian), Shift, Riwayat |
| Play Station | POS, Shift, Riwayat |
| Barbershop / Fitness / Fotocopy / Laundry | POS, Riwayat |
| Unit lain (cuci mobil, dll) | POS generik (`/unit/[unit]/kasir`), Riwayat |

Kasir tidak punya akses Pengaturan sistem, Approval, maupun laporan keuangan.

### 4. Mobile App per Role (68 screen, `mobile/src/screens/`)

| Role | Jumlah | Screen utama |
|------|:---:|------|
| Operator | 49 | Dashboard, anggota, simpanan, pinjaman (pengajuan/angsuran/edit), kas-bank (4), jurnal, neraca/laba-rugi/arus-kas, SHU, tagihan, gaji, aset (3), approval, audit log, master data, kwitansi, kompen, Haji & Umrah (6), laporan unit, import data |
| Kasir | 5 | POS, shift, stok, riwayat, edit NRP |
| Anggota | 6 | Dashboard, simpanan, pinjaman + pengajuan, transaksi, slip gaji, kartu anggota |
| Umum | 6 | Login, ganti password, profil, pengumuman (2), notifikasi, kwitansi viewer |

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Web Framework** | [Next.js 16](https://nextjs.org/) (App Router, Turbopack) |
| **Mobile Framework** | [Expo 55](https://expo.dev/) + [React Native 0.83](https://reactnative.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Database** | PostgreSQL + [Prisma ORM 6.19](https://www.prisma.io/) |
| **Auth** | [NextAuth.js v5](https://authjs.dev/) |
| **Styling (Web)** | [Tailwind CSS 4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Styling (Mobile)** | React Native StyleSheet |
| **State Management** | React Query + SWR |
| **Forms** | React Hook Form + Zod Validation |
| **Excel Parsing** | [xlsx (SheetJS)](https://sheetjs.com/) |
| **Mobile Build** | [EAS Build](https://docs.expo.dev/build/introduction/) |

---

## 📦 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL Database
- (Mobile) Expo CLI & EAS CLI

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/violet666666/koperasi-app.git
   cd koperasi-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the template and fill in real values:
   ```bash
   cp .env.example .env
   ```
   Required keys (see [`.env.example`](.env.example) for full reference):
   ```env
   # Database — pooled URL for runtime, direct URL for migrations
   DATABASE_URL="postgresql://user:password@host:5432/koperasi_db?sslmode=require"
   DIRECT_URL="postgresql://user:password@host:5432/koperasi_db?sslmode=require"

   # Auth (NextAuth v5) — generate with: openssl rand -base64 32
   AUTH_SECRET="your-super-secret-key"
   NEXTAUTH_SECRET="same-as-auth-secret"
   NEXTAUTH_URL="http://localhost:3000"

   # App
   NODE_ENV="development"
   NEXT_PUBLIC_API_URL=""
   ```
   Generate a strong `AUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```
   > Mobile env lives in [`mobile/.env.example`](mobile/.env.example).

4. **Database Setup**
   ```bash
   npx prisma db push
   npm run db:seed
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000)

---

## 📱 Mobile App

### Setup Mobile Development

```bash
cd mobile
npm install
```

### Run Development (Expo Go)

```bash
npx expo start
```

### Build APK (Android)

```bash
npx eas build --platform android --profile preview
```

### Build for App Store (iOS)

```bash
npx eas build --platform ios --profile production
```

---

## 📖 Documentation

Panduan lengkap penggunaan seluruh fitur tersedia di **[USER_GUIDE.md](USER_GUIDE.md)**, termasuk:
- Daftar akun login & role
- Panduan per role (Operator, Admin, Kasir, Anggota)
- Detail fitur per modul (40+ modul)
- Alur import & migrasi data
- Perhitungan SHU sesuai AD-ART Pasal 42
- Panduan mobile app

## 🧪 Build & Test

```bash
# Production build
npm run build

# Lint check
npm run lint

# Prisma Studio (Database GUI)
npx prisma studio
```

## 📊 Project Stats

| Metric | Count |
|--------|-------|
| Web Pages | 160+ |
| API Endpoints | 120+ |
| Mobile Screens | 65+ |
| Database Models | 45 |
| Total Routes | 250+ |
| Unit Usaha | 10 |

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for Koperasi PRIMKOPPOL Polres Lumajang**
