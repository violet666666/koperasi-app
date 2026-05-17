# Koperasi Digital — Primkoppol Resor Lumajang

![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-55-000020?style=for-the-badge&logo=expo&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.83-61DAFB?style=for-the-badge&logo=react&logoColor=white)

Sistem manajemen koperasi digital yang komprehensif untuk **Koperasi PRIMKOPPOL Polres Lumajang**. Dibangun dengan Next.js 16, TypeScript, dan Prisma untuk platform web, serta Expo/React Native untuk platform mobile (Android & iOS).

## 🌐 Live Demo

- **Web App**: [https://www.primkoppol.online](https://www.primkoppol.online)
- **Mobile APK**: Build via EAS (lihat [panduan mobile](#-mobile-app))

## ✨ Highlights

- 📊 **160+ halaman & 90+ API endpoint** — fitur koperasi paling lengkap
- 📱 **Mobile app native** (Android & iOS) dengan fitur paritas penuh
- 🏦 **Akuntansi double-entry** — Jurnal, Buku Besar, Neraca, Laba Rugi
- 💰 **SHU realtime** — Kalkulasi otomatis sesuai AD-ART Pasal 42
- 🛒 **POS Kasir** — Toko retail dengan skema kredit potong gaji
- 📄 **Import Excel** — Migrasi data anggota, pinjaman, Tunkin, Gaji
- 🔐 **4 level role** — Operator, Admin, Kasir, Anggota
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
- 8+ jenis unit: Toko, Resto, Cafe, Laundry, Fitness, Playstation, Cuci Mobil, Cafe LSP

### 📋 Tagihan Piutang (Billing Receivables)
- Siklus penagihan bulanan (16 - 15)
- Generate rekap piutang otomatis dari transaksi kredit
- Toggle per item/anggota sebelum settle
- Proses & settle: update status pembayaran massal
- Hapus draft & regenerate untuk periode yang sama
- Riwayat tagihan per periode

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
   Create a `.env` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/koperasi_db"

   # Auth
   AUTH_SECRET="your-super-secret-key"
   NEXTAUTH_URL="http://localhost:3000"

   # App
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

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
| Mobile Screens | 40+ |
| Database Models | 25+ |
| Total Routes | 250+ |
| Unit Usaha | 8+ |

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
