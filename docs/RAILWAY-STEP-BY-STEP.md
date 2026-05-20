# Railway Migration — Step-by-Step Guide

> **Tanggal:** 8 Mei 2026
> **Branch:** `railway-migration` (JANGAN merge ke master dulu)
> **Prinsip:** Vercel tetap hidup sampai Railway confirmed working

---

## STRATEGI

```
Vercel (master)        Railway (railway-migration branch)
    LIVE ───────┐           ┌──── TEST DULU
                │           │
                │     DNS switch setelah verified
                └───────────┘
```

- Master branch → Vercel tetap deploy seperti biasa (TIDAK DIUBAH)
- `railway-migration` branch → Railway deploy dari sini
- Setelah Railway verified working → baru switch DNS
- Setelah stabil → merge branch ke master

---

## LANGKAH 1: Push Branch ke GitHub (2 menit)

```bash
git push -u origin railway-migration
```

Ini push branch `railway-migration` ke GitHub. **Master tidak berubah**, Vercel tetap aman.

---

## LANGKAH 2: Setup Railway Project (5 menit)

1. Buka https://railway.app → Login dengan GitHub
2. Klik **"New Project"**
3. Pilih **"Deploy from GitHub repo"**
4. Pilih repo **`koperasi-app`**
5. Di bagian **"Branch"** → pilih **`railway-migration`** (BUKAN master)
6. Klik **Deploy**

Railway akan mulai build otomatis. Tunggu 3-5 menit.

---

## LANGKAH 3: Set Environment Variables (3 menit)

Di Railway Dashboard → Settings → Environment Variables, tambahkan:

```
DATABASE_URL=postgresql://neondb_owner:...@ep-xxx.us-east-2.aws.neon.tech/koperasi_db?sslmode=require
DIRECT_URL=postgresql://neondb_owner:...@ep-xxx.us-east-2.aws.neon.tech/koperasi_db?sslmode=require
NEXTAUTH_SECRET=<copy dari Vercel>
NEXTAUTH_URL=https://primkoppol.online
NODE_ENV=production
```

**Cara copy dari Vercel:**
1. Buka https://vercel.com/dashboard
2. Pilih project koperasi-app
3. Settings → Environment Variables
4. Copy satu-per-satu nilainya

Setelah tambahkan semua, Railway akan auto-redeploy.

---

## LANGKAH 4: Tunggu Build Selesai (3-5 menit)

Di Railway Dashboard → Deployments → lihat status build.

Jika SUKSES: lanjut ke Langkah 5.
Jika GAGAL: cek log, perbaiki, dan saya bantu troubleshoot.

---

## LANGKAH 5: Test Railway URL (5 menit)

Railway memberikan URL sementara seperti `koperasi-app-production-abc.up.railway.app`.

1. Buka URL tersebut di browser → harus load halaman login
2. Login sebagai operator → cek dashboard
3. Test satu transaksi kecil
4. Cek Railway logs → pastikan tidak ada error

**JIKA SEMUA OK → lanjut Langkah 6.**
**JIKA ADA ERROR → hentikan, jangan switch DNS, troubleshoot dulu.**

---

## LANGKAH 6: Setup Custom Domain di Railway (5 menit)

1. Railway Dashboard → Settings → Networking → **Generate Domain**
   - Ini akan buat domain seperti `koperasi-app-production.up.railway.app`
2. Klik **"Add Custom Domain"**
3. Masukkan: `primkoppol.online`
4. Railway akan menampilkan CNAME target (misal: `xxx.up.railway.app`)
5. Juga tambahkan: `www.primkoppol.online`

---

## LANGKAH 7: Switch DNS di Hostinger (5 menit — ADA DOWNTIME SINGKAT)

1. Login ke **Hostinger** → DNS Management
2. **CATAT DULU** DNS saat ini (screenshot untuk rollback):
   - `@` → CNAME → `cname.vercel-dns.com`
   - `www` → CNAME → `cname.vercel-dns.com`
3. **UBAH** DNS records:
   - `@` → **CNAME** → `[Railway CNAME target dari Langkah 6]`
   - `www` → **CNAME** → `[Railway CNAME target dari Langkah 6]`
4. Save

DNS propagation: **1-5 menit** (biasanya cepat untuk CNAME)

---

## LANGKAH 8: Verifikasi Final (5 menit)

1. Buka https://primkoppol.online → harus load
2. Login operator → cek semua fitur:
   - [ ] Dashboard
   - [ ] Transaksi Toko
   - [ ] Simpanan (setoran & penarikan)
   - [ ] Pinjaman
   - [ ] Kas/Bank
   - [ ] Laporan
3. Test mobile app → login → cek halaman utama
4. Cek Railway logs → pastikan clean

---

## LANGKAH 9: Stabilkan (1-7 hari)

- Monitor Railway CPU/RAM di dashboard
- Jika semua stabil selama 1 hari → merge `railway-migration` ke master:
  ```bash
  git checkout master
  git merge railway-migration
  git push origin master
  ```
- Disable Vercel project (jangan delete dulu)
- Setelah 1 minggu → hapus Vercel project jika sudah yakin

---

## ROLLBACK PLAN (Jika Gagal)

**Jika Railway bermasalah dalam 1 jam pertama:**

1. Hostinger DNS → kembalikan CNAME ke `cname.vercel-dns.com`
2. Vercel otomatis aktif lagi (master branch tidak berubah)
3. Downtime hanya 1-5 menit saat DNS propagation

---

## FILE YANG DIUBAH DI BRANCH

| File | Perubahan |
|------|-----------|
| `next.config.ts` | Tambah `output: "standalone"` |
| `nixpacks.toml` | BARU — konfigurasi build Railway |

**Master branch TIDAK berubah.** Vercel tetap deploy dari master.

---

*Dibuat: 8 Mei 2026*
