# Akun Testing Primkoppol

> **Testing di localhost lebih disarankan** daripada menunggu Railway build + deploy (±2–3 menit). Jalankan `npm run dev` lalu akses `http://localhost:3000`. Akun di bawah berlaku untuk production **dan** local (database sama via NeonDB).
>
> Gunakan Railway deploy hanya untuk final verification setelah local test lolos.

PASTIKAN ANDA MENGGUNAKAN AKUN TESTING YANG SESUAI !!

GUNAKAN AKUN OPERATOR UNTUK FITUR OPERATOR !

GUNAKAN AKUN ADMIN UNIT UNTUK FITUR ADMIN UNIT !

GUNAKAN AKUN KASIR UNTUK FITUR KASIR !

| Email | Password | Role | Unit | Keterangan |
|-------|----------|------|------|------------|
| **Testing Lokal (`npm run dev` → `localhost:3000`)** | | | | |
| <operator@koperasi.com> | password123 | operator | — | Akses penuh semua fitur (manage_all) |
| <admintoko@koperasi.com> | KHUSUADMIN | admin | toko | Admin unit toko |
| <admincafe@koperasi.com> | password123 | admin | resto_cafe | Admin unit Resto & Cafe (Latar) |
| <admincafelsp@koperasi.com> | password123 | admin | cafe_lsp | Admin unit Cafe LSP |
| <adminhajiumrah@koperasi.com> | password123 | admin | haji_umrah | Admin unit Haji & Umrah — tabungan, produk, laporan |

| **Production (`www.primkoppol.site`)** | | | | |

## Akun Kasir (dari data transaksi)

| Nama Display | User ID | Unit | Shift |
|-------------|---------|------|-------|
| SIWI | 731 | toko | Pagi |
| SI MALAM | 731 | toko | Sore/Malam |

> User ID 731 = "Kasir Toko" — kemungkinan akun yang sama dengan shift identity berbeda.
