# Akun Demo Koperasi Digital

Dokumen ini berisi daftar lengkap akun demonstrasi (dummy) yang dibuat saat menjalankan perintah `npx prisma db seed`. Semua akun menggunakan password yang sama: **`password123`**

---

## 1. Akun Operator (Super Admin)
Akses penuh ke **seluruh fitur** dan **seluruh unit** koperasi.

| Peran | Nama | Email Login | Unit | Password |
|-------|------|-------------|------|----------|
| **Operator** | Operator (Super Admin) | `admin@koperasi.com` | Semua | `password123` |

---

## 2. Akun Admin (Per-Unit)
Dapat mengelola fitur operasional **sesuai unit yang ditugaskan**.

| Peran | Nama | Email Login | Unit | Password |
|-------|------|-------------|------|----------|
| **Admin** | Admin Simpan Pinjam | `admin.sp@koperasi.com` | Simpan Pinjam | `password123` |
| **Admin** | Admin Toko | `admin.toko@koperasi.com` | Toko | `password123` |

---

## 3. Akun Kasir (Per-Unit)
Hanya dapat **menginput transaksi** sesuai unit yang ditugaskan.

| Peran | Nama | Email Login | Unit | Password |
|-------|------|-------------|------|----------|
| **Kasir** | Kasir Simpan Pinjam | `kasir.sp@koperasi.com` | Simpan Pinjam | `password123` |
| **Kasir** | Kasir Toko | `kasir.toko@koperasi.com` | Toko | `password123` |

---

## 4. Akun Anggota (Portal Anggota)
Akses ke Portal Anggota untuk **monitoring transaksi** dan **pengajuan pinjaman**.

| NRP | Nama Lengkap | Cabang | Email Login | Password |
|-----|-------------|--------|-------------|----------|
| **78120001** | Agus Setiawan | HO (Surabaya) | `78120001@koperasi.local` | `password123` |
| **78120002** | Siti Rahayu | Jember | `78120002@koperasi.local` | `password123` |
| **78120003** | Bambang Widodo | Malang | `78120003@koperasi.local` | `password123` |
| **78120004** | Dewi Lestari | Lumajang | `78120004@koperasi.local` | `password123` |
| **78120005** | Eko Prasetyo | Kediri | `78120005@koperasi.local` | `password123` |
| **78120006** | Fitri Handayani | Banyuwangi | `78120006@koperasi.local` | `password123` |
| **78120007** | Gunawan Saputra | HO (Surabaya) | `78120007@koperasi.local` | `password123` |
| **78120008** | Heni Kusuma | Jember | `78120008@koperasi.local` | `password123` |
| **78120009** | Irfan Maulana | Malang | `78120009@koperasi.local` | `password123` |
| **78120010** | Julia Puspita | Kediri | `78120010@koperasi.local` | `password123` |

---

## Cara Demo Multi-Role
1. Buka browser normal → login sebagai **Operator** (`admin@koperasi.com`)
2. Buka Private/Incognito Window → login sebagai **Admin SP** (`admin.sp@koperasi.com`) → perhatikan menu yang tampil lebih sedikit
3. Buka browser lain / tab baru → login sebagai **Kasir Toko** (`kasir.toko@koperasi.com`) → perhatikan hanya menu kasir yang tampil
4. Buka di HP / resize ke mode mobile → login sebagai **Anggota** (`78120001@koperasi.local`) → masuk ke Portal Anggota
