# Rencana Migrasi: Vercel → Railway

> **Tanggal rencana eksekusi:** Minggu, 10 Mei 2026
> **Status:** DRAFT — jangan eksekusi sebelum hari Minggu
> **Dibuat:** 7 Mei 2026

---

## 1. Latar Belakang

### Masalah Saat Ini
- Vercel charge CPU time per serverless function invocation
- App ini punya **50+ API routes** → masing-masing adalah function terpisah
- Setiap cold start: spawn Node.js + Prisma TCP connection ke NeonDB (2-5 detik)
- Neon HTTP adapter (`prismaRead`) sering gagal → fallback ke TCP → double CPU time
- Tagihan Vercel meledak karena akumulasi ms × CPU dari ratusan function calls per hari

### Kenapa Railway Lebih Cocok
| Aspek | Vercel (Sekarang) | Railway (Target) |
|-------|-------------------|------------------|
| Model | Serverless (per function) | Persistent server (1 proses) |
| Cold start | Ya, setiap route | Tidak ada |
| Prisma connection | TCP per cold start | Connection pool persisten |
| CPU billing | Per invocation ms | Flat $5/bulan |
| Cocok untuk | Static sites, edge | Full-stack API-heavy apps |

---

## 2. Arsitektur Target

```
                    ┌─────────────────────────────┐
                    │   Hostinger DNS              │
                    │   primkoppol.online          │
                    │   www.primkoppol.online      │
                    └──────────┬──────────────────┘
                               │ CNAME
                               ▼
                    ┌─────────────────────────────┐
                    │   Railway App                │
                    │   Next.js standalone         │
                    │   Port 3000                  │
                    │   (1 vCPU, 512MB RAM)        │
                    │                              │
                    │   ┌────────────────────┐     │
                    │   │  Next.js Server    │     │
                    │   │  - SSR pages       │     │
                    │   │  - 50+ API routes  │     │
                    │   │  - Prisma client   │     │
                    │   └────────┬───────────┘     │
                    └───────────┼──────────────────┘
                                │ TCP
                                ▼
                    ┌─────────────────────────────┐
                    │   NeonDB (TETAP DIPAKAI)     │
                    │   postgresql://...neon.tech  │
                    │   Tidak perlu migrasi data   │
                    └─────────────────────────────┘
```

---

## 3. Estimasi Biaya

| Item | Biaya/bulan |
|------|-------------|
| Railway Developer Plan | **$5** (500GB RAM, 1 vCPU) |
| NeonDB Free Tier | **$0** (0.5GB storage) |
| Hostinger Domain | **sudah dibayar** |
| **Total** | **~Rp 80.000/bulan** |

> Catatan: Jika traffic tinggi, Railway bisa auto-scale ke $10-20/bulan. Masih jauh lebih murah dari Vercel Pro ($20 + usage).

---

## 4. File yang Perlu Dibuat/Dimodifikasi

### 4.1 BARU: `next.config.ts` (modifikasi)
Tambahkan `output: "standalone"` agar Next.js build sebagai standalone server.

```
// Sebelum:
const nextConfig = {
  reactCompiler: true,
  ...
};

// Sesudah:
const nextConfig = {
  output: "standalone",  // ← TAMBAH INI
  reactCompiler: true,
  ...
};
```

### 4.2 BARU: `nixpacks.toml`
Konfigurasi build untuk Railway (Nixpacks auto-detect Next.js).

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.build]
cmds = ["npx prisma generate", "npm run build"]

[start]
cmd = "node .next/standalone/server.js"
```

### 4.3 BARU: `public` symlink fix (jika diperlukan)
Standalone build tidak include `public/` folder. Perlu copy ke `.next/standalone/public/`.

### 4.4 MODIFIKASI: `src/lib/prisma.ts`
Hapus `prismaRead` (Neon HTTP adapter) karena tidak lagi diperlukan di Railway.
Di persistent server, TCP connection pool sudah efisien — tidak perlu HTTP adapter.

### 4.5 MODIFIKASI: Semua file yang import `prismaRead`
Hapus fallback pattern `try prismaRead → catch prisma` karena tinggal gunakan `prisma` saja.

---

## 5. Checklist Eksekusi (Hari Minggu)

### Fase 1: Persiapan (30 menit, SEBELUM downtime)

- [ ] **1.1** Login ke [railway.app](https://railway.app) dengan GitHub
- [ ] **1.2** Buat New Project → "Deploy from GitHub repo" → pilih `koperasi-app`
- [ ] **1.3** Set Environment Variables di Railway:
  ```
  DATABASE_URL=postgresql://neondb_owner:...@ep-xxx.us-east-2.aws.neon.tech/koperasi_db?sslmode=require
  DIRECT_URL=postgresql://neondb_owner:...@ep-xxx.us-east-2.aws.neon.tech/koperasi_db?sslmode=require
  NEXTAUTH_SECRET=<copy dari Vercel>
  NEXTAUTH_URL=https://primkoppol.online
  NODE_ENV=production
  ```
  > Copy nilai dari Vercel Dashboard → Settings → Environment Variables

- [ ] **1.4** Buat branch `railway-migration` di repo lokal
- [ ] **1.5** Commit perubahan file (output: standalone, nixpacks.toml, prisma.ts cleanup)
- [ ] **1.6** Push branch ke GitHub → merge ke master
- [ ] **1.7** Railway auto-deploy dari master → tunggu build selesai (3-5 menit)
- [ ] **1.8** Test Railway URL (xxx.up.railway.app) — pastikan app berjalan

### Fase 2: DNS Switch (10 menit, ADA downtime singkat)

- [ ] **2.1** Login ke Hostinger DNS management
- [ ] **2.2** Catat DNS settings saat ini (screenshot):
  - `@` → CNAME → `cname.vercel-dns.com`
  - `www` → CNAME → `cname.vercel-dns.com`

- [ ] **2.3** Ubah DNS records:
  - `@` → **CNAME** → `xxx.up.railway.app` ( Railway domain)
  - `www` → **CNAME** → `xxx.up.railway.app`

  > ATAU jika Railway mendukung A record, gunakan IP yang disediakan Railway.

- [ ] **2.4** Di Railway Dashboard → Settings → Networking → Add Custom Domain:
  - `primkoppol.online`
  - `www.primkoppol.online`

### Fase 3: Verifikasi (15 menit)

- [ ] **3.1** Buka https://primkoppol.online → harus load
- [ ] **3.2** Login sebagai operator → cek dashboard
- [ ] **3.3** Test transaksi Toko (buat 1 transaksi kecil)
- [ ] **3.4** Test laporan Toko → harus muncul data
- [ ] **3.5** Test audit log → filter Toko → harus ada data
- [ ] **3.6** Test mobile app → login → cek halaman utama
- [ ] **3.7** Cek Railway logs → pastikan tidak ada error

### Fase 4: Cleanup (10 menit)

- [ ] **4.1** Jika semua berjalan 30 menit tanpa error → disable Vercel project (jangan delete dulu)
- [ ] **4.2** Monitor Railway CPU/RAM usage selama 24 jam pertama
- [ ] **4.3** Hapus Vercel project setelah 1 minggu stabil

---

## 6. Rollback Plan (Jika Gagal)

Jika Railway bermasalah dalam 1 jam pertama:

1. **Hostinger DNS** → kembalikan CNAME ke `cname.vercel-dns.com`
2. **Vercel** → re-deploy master branch (Vercel masih punya project)
3. **Git** → revert commit perubahan (output: standalone, prisma.ts)

> DNS propagation: 1-5 menit untuk CNAME changes. Downtime minimal.

---

## 7. Catatan Teknis

### Kenapa Hapus prismaRead?
- `prismaRead` (Neon HTTP adapter) diciptakan untuk mengatasi cold start di Vercel serverless
- Di Railway, server persisten → TCP connection pool sudah efisien
- Menghapus `prismaRead` menyederhanakan kode dan menghilangkan fallback complexity
- Semua 7+ file yang punya pattern `try prismaRead → catch prisma` akan disederhanakan

### Kenapa `output: "standalone"`?
- Railway butuh Node.js server yang berjalan terus, bukan serverless function
- Standalone mode menghasilkan `.next/standalone/` folder yang bisa dijalankan dengan `node server.js`
- Ukuran bundle lebih kecil, startup lebih cepat

### Mobile App
- Mobile app (Expo) mengakses API via `https://primkoppol.online/api/*`
- Setelah DNS switch, mobile app otomatis mengarah ke Railway
- Tidak perlu update APK/IPA — domain tetap sama

### SSL/HTTPS
- Railway otomatis menyediakan SSL certificate untuk custom domain
- Tidak perlu konfigurasi manual seperti Let's Encrypt

---

## 8. Timeline Eksekusi (Hari Minggu, 10 Mei 2026)

| Waktu | Aktivitas | Durasi |
|-------|-----------|--------|
| 08:00 | Buat branch, commit perubahan kode | 15 menit |
| 08:15 | Setup Railway project + env vars | 10 menit |
| 08:25 | Push ke GitHub, tunggu build | 5-10 menit |
| 08:35 | Test Railway URL (sebelum DNS switch) | 10 menit |
| 08:45 | Switch DNS di Hostinger | 5 menit |
| 08:50 | Verifikasi semua fitur | 15 menit |
| 09:05 | **DONE** — monitor selama 30 menit | - |
| 09:35 | Jika stabil → disable Vercel | 5 menit |

**Total estimasi downtime:** 5-10 menit (saat DNS propagation)

---

## 9. Hal yang TIDAK Perlu Diubah

- NeonDB tetap dipakai — tidak perlu migrasi database
- Hostinger domain tetap — hanya ganti DNS target
- GitHub repo tetap — Railway auto-deploy dari situ
- Mobile app domain tetap — `primkoppol.online` tidak berubah
- Semua data tetap ada di NeonDB

---

*Dokumen ini akan diupdate setelah eksekusi berhasil pada hari Minggu.*
