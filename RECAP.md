# RECAP - Koperasi Digital Primkoppol

> Sistem Informasi Koperasi Digital dengan RBAC (Role-Based Access Control)

---

## Teknologi

| Stack | Detail |
|-------|--------|
| Framework | Next.js 16 (App Router) + React |
| Bahasa | TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Auth | NextAuth.js v5 |
| UI | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |

---

## Hierarki RBAC

```
Operator (Akses Penuh)
├── Admin Unit (Kelola Operasional Per-Unit)
│   └── Kasir Unit (Input Transaksi Per-Unit)
└── Anggota (Portal Monitoring + Pengajuan Pinjaman)
```

| Role | Akses | Jumlah Akun |
|------|-------|-------------|
| **Operator** | Semua fitur, semua unit, Audit Log | 1 |
| **Admin** | Fitur admin sesuai unit | 10 (1 per unit) |
| **Kasir** | Input transaksi saja, tidak bisa edit history | 10 (1 per unit) |
| **Anggota** | Portal monitoring + pengajuan pinjaman | 589 |

---

## 10 Unit Primkoppol

| # | Unit | Admin | Kasir |
|---|------|-------|-------|
| 1 | Simpan Pinjam | `adminsp@koperasi.com` | `kasirsp@koperasi.com` |
| 2 | Toko | `admintoko@koperasi.com` | `kasirtoko@koperasi.com` |
| 3 | Fitness | `adminfitness@koperasi.com` | `kasirfitness@koperasi.com` |
| 4 | Cuci Mobil & Motor | `admincucimobil@koperasi.com` | `kasircucimobil@koperasi.com` |
| 5 | Fotocopy | `adminfotocopy@koperasi.com` | `kasirfotocopy@koperasi.com` |
| 6 | Laundry | `adminlaundry@koperasi.com` | `kasirlaundry@koperasi.com` |
| 7 | Resto & Cafe | `admincafe@koperasi.com` | `kasircafe@koperasi.com` |
| 8 | Playstation | `adminps@koperasi.com` | `kasirps@koperasi.com` |
| 9 | Barbershop | `adminbarbershop@koperasi.com` | `kasirbarbershop@koperasi.com` |
| 10 | Aset (Tanah, dll) | `adminaset@koperasi.com` | `kasiraset@koperasi.com` |

---

## Akun Login Staff

> **Semua password: `password123`**

### Operator (Super Admin)
| Email | Password |
|-------|----------|
| `admin@koperasi.com` | `password123` |

### Admin Unit (10 Akun)
| Unit | Email | Password |
|------|-------|----------|
| Simpan Pinjam | `adminsp@koperasi.com` | `password123` |
| Toko | `admintoko@koperasi.com` | `password123` |
| Fitness | `adminfitness@koperasi.com` | `password123` |
| Cuci Mobil | `admincucimobil@koperasi.com` | `password123` |
| Fotocopy | `adminfotocopy@koperasi.com` | `password123` |
| Laundry | `adminlaundry@koperasi.com` | `password123` |
| Resto & Cafe | `admincafe@koperasi.com` | `password123` |
| Playstation | `adminps@koperasi.com` | `password123` |
| Barbershop | `adminbarbershop@koperasi.com` | `password123` |
| Aset | `adminaset@koperasi.com` | `password123` |

### Kasir Unit (10 Akun)
| Unit | Email | Password |
|------|-------|----------|
| Simpan Pinjam | `kasirsp@koperasi.com` | `password123` |
| Toko | `kasirtoko@koperasi.com` | `password123` |
| Fitness | `kasirfitness@koperasi.com` | `password123` |
| Cuci Mobil | `kasircucimobil@koperasi.com` | `password123` |
| Fotocopy | `kasirfotocopy@koperasi.com` | `password123` |
| Laundry | `kasirlaundry@koperasi.com` | `password123` |
| Resto & Cafe | `kasircafe@koperasi.com` | `password123` |
| Playstation | `kasirps@koperasi.com` | `password123` |
| Barbershop | `kasirbarbershop@koperasi.com` | `password123` |
| Aset | `kasiraset@koperasi.com` | `password123` |

### Anggota (589 Akun)
- Login: `<NIP>@koperasi.local` (contoh: `84041976@koperasi.local`)
- Password: `password123`
- Data diimport dari file `integrasi-akun-asli/daftar_nip_nmpeg_gaji.csv`

---

## Fitur Utama

### 1. Dashboard
- Statistik real-time: anggota, simpanan, pinjaman, SHU
- Grafik dan chart interaktif
- Ringkasan per cabang

### 2. Manajemen Anggota
- CRUD data anggota lengkap (NRP, nama, kategori, gaji, dll.)
- Cetak kartu anggota dan buku anggota
- Profil dengan foto dan KTP

### 3. Simpanan
- Simpanan Pokok, Wajib, Sukarela
- Transaksi setoran/penarikan
- Rekap saldo per anggota
- Jurnal akuntansi otomatis

### 4. Pinjaman (Simpan Pinjam)
- Pengajuan pinjaman → Approval workflow
- Jadwal angsuran otomatis
- Pembayaran angsuran + pencatatan
- Status pinjaman real-time

### 5. Transaksi Unit (10 Unit)
- Input transaksi per unit oleh Kasir
- Tracking member NIP/Nama real-time
- History transaksi per anggota
- Status: Lunas / Belum Lunas

### 6. Toko Retail
- Manajemen produk toko
- Sistem kasir (POS)
- Stok & persediaan

### 7. Kas & Bank
- Kas Besar + rekening bank
- Transaksi masuk/keluar
- Transfer antar akun
- Saldo real-time

### 8. Akuntansi (Double-Entry)
- Jurnal Umum + Penyesuaian + Penutup
- Buku Besar
- Chart of Accounts (CoA)
- Mapping jurnal otomatis

### 9. Laporan
- Neraca
- Laba Rugi
- Arus Kas
- Rekap Simpanan, Pinjaman, Anggota
- Perhitungan & Distribusi SHU

### 10. Portal Anggota (Mobile-Friendly)
- **Dashboard**: Gaji Bersih, Pinjaman Berlangsung, Pengajuan Pinjaman (warning), Tagihan Unit
- **Profil**: NRP/NIP, Nama, Kategori, Gaji Pokok
- **Pengajuan Pinjaman**: Form + tampilan gaji & tagihan belum lunas
- **Notifikasi**: Pemberitahuan jika pinjaman disetujui → "menghadap pihak berwenang"
- **History Transaksi**: Semua bill payment dari seluruh unit

### 11. RBAC & Keamanan
- 4-tier role system (Operator → Admin → Kasir → Anggota)
- Per-unit route guard
- Navigation filtering berdasarkan permission
- Audit trail (createdBy di setiap transaksi)

### 12. Master Data
- Cabang (6 cabang Jawa Timur)
- Produk Simpanan & Pinjaman
- Chart of Accounts
- Mapping Jurnal
- Parameter SHU
- Periode Fiskal
- User Management

### 13. Responsif Mobile
- Bottom Navigation Bar
- Sidebar scroll yang benar
- Portal anggota optimized untuk HP
- PWA-ready

---

## Deployment

### Push ke Vercel
```bash
git add . && git commit -m "feat: complete RBAC system" && git push
```

### Setup Database (Pertama Kali)
```bash
npx prisma db push           # Sync schema ke database
npx prisma db seed            # Seed data demo
npx tsx prisma/import-members.ts    # Import 589 anggota asli
npx tsx prisma/add-unit-staff.ts    # Setup RBAC roles + 20 staff accounts
```
