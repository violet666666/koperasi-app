# Akun Demo Koperasi Digital (Primkoppol)

Semua akun menggunakan password: **`password123`**

---

## 1. Operator (Super Admin)
| Email | Unit | Password |
|-------|------|----------|
| `admin@koperasi.com` | Semua Unit | `password123` |

## 2. Admin (Per-Unit)
| Email | Unit | Password |
|-------|------|----------|
| `admin.sp@koperasi.com` | Simpan Pinjam | `password123` |
| `admin.toko@koperasi.com` | Toko | `password123` |
| `admin.fitness@koperasi.com` | Fitness | `password123` |

## 3. Kasir (Per-Unit)
| Email | Unit | Password |
|-------|------|----------|
| `kasir.sp@koperasi.com` | Simpan Pinjam | `password123` |
| `kasir.toko@koperasi.com` | Toko | `password123` |
| `kasir.fitness@koperasi.com` | Fitness | `password123` |

## 4. Anggota (Portal)
| NRP | Nama | Email Login |
|-----|------|-------------|
| 78120001 | Agus Setiawan | `78120001@koperasi.local` |
| 78120002 | Siti Rahayu | `78120002@koperasi.local` |
| 78120003 | Bambang Widodo | `78120003@koperasi.local` |
| 78120004 | Dewi Lestari | `78120004@koperasi.local` |
| 78120005 | Eko Prasetyo | `78120005@koperasi.local` |
| 78120006 | Fitri Handayani | `78120006@koperasi.local` |
| 78120007 | Gunawan Saputra | `78120007@koperasi.local` |
| 78120008 | Heni Kusuma | `78120008@koperasi.local` |
| 78120009 | Irfan Maulana | `78120009@koperasi.local` |
| 78120010 | Julia Puspita | `78120010@koperasi.local` |

---

## 10 Unit Primkoppol
| # | Unit | unitType |
|---|------|----------|
| 1 | Simpan Pinjam | `simpan_pinjam` |
| 2 | Toko | `toko` |
| 3 | Fitness | `fitness` |
| 4 | Cuci Mobil & Motor | `cuci_mobil` |
| 5 | Fotocopy | `fotocopy` |
| 6 | Laundry | `laundry` |
| 7 | Resto & Cafe | `resto_cafe` |
| 8 | Playstation | `playstation` |
| 9 | Barbershop | `barbershop` |
| 10 | Aset (tanah, dll) | `aset` |

## Hierarki RBAC
```
Kasir → Admin → Operator
```
- **Kasir**: Input transaksi saja, tidak bisa edit/hapus riwayat
- **Admin**: Kelola operasional unit, approve transaksi
- **Operator**: Akses penuh + Audit Log seluruh unit
