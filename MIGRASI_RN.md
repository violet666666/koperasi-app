# Rencana Migrasi ke Mobile App (React Native)

Dokumen ini berisi *blueprint* atau rencana teknis untuk mengembangkan aplikasi Koperasi PRIMKOPPOL ke dalam platform mobile asli (Native) menggunakan React Native (Expo), dengan tetap mempertahankan kapabilitas Website (Next.js) yang sudah ada sebelumnya.

Pendekatan yang direkomendasikan adalah arsitektur **Monorepo**. Ini memungkinkan kita untuk meletakkan kode aplikasi secara terstruktur dalam satu *root* folder tanpa merusak ekosistem yang sudah stabil.

---

## 1. Arsitektur Folder (Monorepo Workspace)

Sesuai permintaan, sangat memungkinkan dan *sangat disarankan* untuk menggunakan satu root folder (`koperasi-app`).
Struktur folder baru (berbasis **Turborepo** atau **NPM Workspaces**) akan tampak seperti ini:

```text
koperasi-app/               <-- Root Folder
├── package.json            <-- Konfigurasi Workspace & Scripts global
├── turbo.json              <-- (Opsional) Konfigurasi pipeline Turborepo
│
├── apps/                   <-- Tempat aplikasi berjalan (Frontends)
│   ├── website/            <-- [CURRENT] Berisi Project Next.js Koperasi Bapak saat ini
│   └── mobile/             <-- [NEW] Berisi Project React Native (menggunakan Expo)
│
└── packages/               <-- Tempat kode/logika yang dishare lintas aplikasi
    ├── config/             <-- Konfigurasi ESLint, TypeScript, dll
    ├── ui/                 <-- (Opsional) Shared UI components (contoh: Tamagui/NativeWind)
    └── api-client/         <-- (Opsional) Shared Axios/Fetch functions untuk interaksi API
```

---

## 2. Fase Migrasi (Roadmap)

Migrasi dari Web ke ekosistem hibrida (Web + Mobile App) perlu dilakukan dalam 3 Fase agar operasi bisnis koperasi Bapak tidak terganggu.

### Fase 1: Restrukturisasi menjadi Monorepo (Minggu 1)
- Memindahkan semua file Next.js yang ada saat ini (`src/`, `public/`, `package.json`, dll) dari root `koperasi-app/` ke dalam sub-folder `koperasi-app/apps/website/`.
- Melakukan setup awal **Yarn Workspaces** atau **NPM Workspaces** di root level.
- Memastikan website Next.js masih bisa di-build dan berjalan normal.

### Fase 2: Inisialisasi React Native App (Minggu 2)
- Menjalankan perintah inisialisasi Expo di dalam folder `/apps`: 
  ```bash
  cd apps
  npx create-expo-app mobile --template blank-typescript
  ```
- Setup **React Navigation** untuk sistem routing *Bottom Tabs* (Beranda, Pinjaman, Simpanan, Profil).
- Setup **Zustand** atau **Redux** (untuk *state management*) dan konfigurasi Axios/Fetch agar mengarah ke endpoint API website Next.js.
  *(Next.js API route seperti `/api/members` atau `/api/loans` akan bertindak murni sebagai Backend bagi mobile app)*.

### Fase 3: Pengembangan Fitur Mobile Anggota (Minggu 3 & 4)
Untuk permulaan, aplikasi mobile hanya difokuskan untuk **Portal Anggota**, mengingat interaksi Admin/Operator lebih leluasa dilakukan via Desktop/Web.
Fitur yang akan dibangun khusus di React Native:
- **Halaman Login Anggota**: Autentikasi NRP.
- **Beranda (Dashboard)**: Tampilan kartu ringkasan saldo simpanan & pinjaman berjalan.
- **Histori Simpanan**: FlatList menampilkan mutasi simpanan.
- **Plafon & Pengajuan Kredit**: Form pengajuan dari HP anggota.
- **Notifikasi Push (Expo Push Notifications/FCM)**: *Notifikasi real-time jika pinjaman di-Approve, atau ada Tagihan Angsuran Baru.*

---

## 3. Kebutuhan Teknis Lanjutan

| Topik | Keterangan |
| - | - |
| **Backend / API Server** | Sistem Next.js saat ini (`apps/website`) sudah mumpuni untuk berfungsi ganda sebagai penyedia API RESTful untuk aplikasi mobile. Kita hanya perlu menyesuaikan agar API Route mendukung *Token/JWT based authentication* untuk aplikasi React Native (bukan skema session cookies browser). |
| **Styling Components** | Menyarankan menggunakan **NativeWind** (Tailwind CSS untuk React Native) agar style/desain UI sama persis dengan framework TailwindCSS yang dipakai di Web Next.js. |
| **Data Fetching** | **TanStack Query (React Query)** dapat di-share code-nya ke lingkungan React Native. Konsep invalidasinya sama persis seperti yang Web aplikasikan sekarang. |

---

## 4. Keuntungan Skema Ini:
1. **Single Source of Truth**: Database Schema Prisma hanya ada satu di root project.
2. **Perawatan Mudah**: Jika ada fitur/endpoint backend yang diperbaiki di Websitenya, otomatis aplikasi Mobile juga langsung merasakan efeknya karena backend-nya tunggal (Integrated).
3. **Efisiensi Developer**: Tidak perlu repot berpindah antar editor yang benar-benar terpisah.
