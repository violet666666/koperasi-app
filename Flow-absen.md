# 📋 Fitur Absensi Kasir PRIMKOPPOL — Dokumen Lengkap

> **Tanggal:** 5 Juni 2026 | **Versi:** 1.0 | **Status:** Design Phase
> **Scope:** Semua unit (Toko, Resto, Cafe LSP, Barbershop, Fitness, dll)
> **Dokumen ini untuk presentasi ke atasan** — insight arsitektur + flow end-to-end

---

## ═══════════════════════════════════════════════════
## BAGIAN A: RINGKASAN & KEPUTUSAN DESAIN
## ═══════════════════════════════════════════════════

### Apa yang Akan Dibangun?

Fitur absensi digital untuk kasir semua unit koperasi, dengan **verifikasi ganda** (IP Whitelist + QR Code dinamis). Kasir wajib absen masuk sebelum bisa membuka shift. Data absensi terekam untuk rekap bulanan dan export Excel/PDF.

### Keputusan Desain

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| **Platform** | Web tablet + Mobile app HP | Kasir pakai tablet di kasir, HP untuk scan QR |
| **Metode Verifikasi** | IP Whitelist + QR Code dinamis (berganda) | Paling aman dari manipulasi |
| **Flow Absensi** | Check-in & Check-out terpisah | Durasi kerja akurat untuk rekap bulanan |
| **Hubungan dengan Shift** | Absen wajib sebelum bisa buka shift | Absen masuk → baru bisa open shift; close shift → auto check-out |
| **Rekap Bulanan** | Ya, rekap + export Excel/PDF | Untuk evaluasi kinerja dan payroll |

### Daftar Role yang Terlibat

| Role | Tanggung Jawab dalam Absensi |
|------|------------------------------|
| **Operator** | Setup awal (IP, WiFi, jam kerja), override manual, lihat rekap semua unit |
| **Admin Unit** | Tampilkan QR di monitor, lihat rekap unit sendiri, buka halaman absen |
| **Kasir** | Absen masuk/keluar, scan QR, buka/tutup shift |
| **Anggota** | Tidak terlibat (hanya kasir & staf yang absen) |

---

## ═══════════════════════════════════════════════════
## BAGIAN B: FLOW DIAGRAM END-TO-END
## ═══════════════════════════════════════════════════

### ═══ FLOW 1: SETUP AWAL OLEH OPERATOR (Sekali saja) ═══

```
┌─────────────────────────────────────────────────────────────┐
│  OPERATOR LOGIN → Menu "Absensi" → Tab "Pengaturan"         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Input IP Public Kantor                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  IP Whitelist:                                        │  │
│  │  [ + ] 202.152.xxx.xxx        ← IP router kantor      │  │
│  │  [ + ] 36.73.xxx.xxx          ← IP backup (jika ada)  │  │
│  │  [ + ] 192.168.1.0/24         ← IP range LAN kantor   │  │
│  │                                                       │  │
│  │  Cara cek IP: buka whatismyip.com dari kantor         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Input Nama WiFi Kantor (Opsional)                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  WiFi Whitelist:                                      │  │
│  │  [ + ] PRIMKOPPOL-KANTOR                               │  │
│  │  [ + ] PRIMKOPPOL-LOBI                                 │  │
│  │                                                       │  │
│  │  Jika diisi: kasir HARUS terhubung WiFi ini           │  │
│  │  Jika kosong: hanya cek IP (tanpa cek WiFi)           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Set Jam Kerja & Toleransi Keterlambatan            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Shift Pagi:  07:00 - 15:00    Toleransi: [15] menit  │  │
│  │  Shift Sore:  15:00 - 21:00    Toleransi: [15] menit  │  │
│  │  Shift Malam: 21:00 - 07:00    Toleransi: [15] menit  │  │
│  │                                                       │  │
│  │  ✓ Absen wajib sebelum buka shift                     │  │
│  │  ✓ Auto check-out saat close shift                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                     ✅ Setup Selesai
         (Data tersimpan, bisa diubah kapan saja)
```

---

### ═══ FLOW 2: ADMIN UNIT — TAMPILKAN QR CODE (Setiap Hari) ═══

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN UNIT LOGIN → Menu "Absensi" → "Tampilkan QR"         │
│                      ATAU                                    │
│  Akses langsung: primkoppol.site/absensi/qr-display         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              ┌───────────────────┐                  │   │
│   │              │    █▀▀▀▀▀▀▀▀█    │                  │   │
│   │              │    █ QR CODE  █    │                  │   │
│   │              │    █ (besar)  █    │                  │   │
│   │              │    █          █    │                  │   │
│   │              │    ▀▀▀▀▀▀▀▀▀▀    │                  │   │
│   │              └───────────────────┘                  │   │
│   │                                                     │   │
│   │         🏪 RESTO & CAFE — PRIMKOPPOL                │   │
│   │         🕐 QR berubah dalam: 23 detik               │   │
│   │         📅 Senin, 5 Juni 2026 • 07:15 WIB          │   │
│   │                                                     │   │
│   │   "Scan QR ini dari HP untuk absen masuk"           │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   → Tampil FULL SCREEN di monitor/tablet lobi               │
│   → QR otomatis berubah setiap 30 detik                     │
│   → Tidak perlu di-klik/dioperasikan — otomatis             │
└─────────────────────────────────────────────────────────────┘
```

**Catatan penting:**
- Monitor/tablet diletakkan di lobi atau area masuk kantor
- QR berubah otomatis — tidak bisa di-screenshot untuk dipakai nanti
- 1 QR = 1 kasir (single use) — setelah di-scan, QR expired
- Bisa ditampilkan di tablet yang sama dengan tablet kasir (split screen)

---

### ═══ FLOW 3: KASIR — ABSEN MASUK (Setiap Pagi) ═══

```
┌─────────────────────────────────────────────────────────────┐
│                   KASIR TIBA DI KANTOR                       │
│                   (Terhubung WiFi kantor)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Buka Aplikasi HP (Mobile App)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Login dengan NRP/Email + Password                    │  │
│  │  → JWT token tersimpan di SecureStore                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Dashboard menampilkan "Belum Absen Hari Ini"       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  📍 Status: Belum Absen                         │  │  │
│  │  │  Shift: Pagi (07:00 - 15:00)                    │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌─────────────────────────────────────────┐    │  │  │
│  │  │  │     [📷 ABSEN MASUK]                    │    │  │  │
│  │  │  │     Scan QR Code di Monitor Lobi        │    │  │  │
│  │  │  └─────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Tap "ABSEN MASUK" → Kamera HP terbuka             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           ┌──────────────────┐                  │  │  │
│  │  │           │  Arahkan kamera  │                  │  │  │
│  │  │           │  ke QR Code di   │                  │  │  │
│  │  │           │  monitor lobi    │                  │  │  │
│  │  │           └──────────────────┘                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Verifikasi Sistem (Otomatis, < 1 detik)            │
│                                                             │
│  ✅ Cek 1: WiFi SSID cocok dengan whitelist?               │
│     └─ WiFi: "PRIMKOPPOL-KANTOR" → COCOK ✅                │
│                                                             │
│  ✅ Cek 2: IP Address cocok dengan whitelist?               │
│     └─ IP: 202.152.xxx.xxx → COCOK ✅                      │
│                                                             │
│  ✅ Cek 3: QR Token valid & belum expired?                  │
│     └─ Token: "abc-123-def" → VALID ✅ (belum 30 detik)    │
│                                                             │
│  ✅ Cek 4: QR belum dipakai orang lain?                     │
│     └─ Status: unused → COCOK ✅                            │
│                                                             │
│  ✅ Cek 5: Kasir belum absen hari ini?                      │
│     └─ Belum ada record → COCOK ✅                          │
│                                                             │
│  ── SEMUA CEK LOLOS ──                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Absen Berhasil! ✅                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ✅ ABSEN MASUK BERHASIL                             │  │
│  │                                                       │  │
│  │  👤 Nama: SIWI          🏪 Unit: Toko                 │  │
│  │  🕐 Jam: 06:55 WIB     📋 Shift: Pagi                │  │
│  │  📶 WiFi: PRIMKOPPOL-KANTOR                           │  │
│  │  🌐 IP: 202.152.xxx.xxx                               │  │
│  │  Status: ✅ Tepat Waktu                               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Skenario Penolakan Absen:

```
┌─ KASIR COBA ABSEN DARI RUMAH ──────────────────────────────┐
│  ❌ WiFi: "Home_WiFi" → TIDAK COCOK                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ❌ ABSEN DITOLAK                                     │  │
│  │  Anda tidak terhubung ke jaringan kantor.             │  │
│  │  Hubungkan ke WiFi "PRIMKOPPOL-KANTOR" untuk absen.   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─ KASIR COBA PAKAI SCREENSHOT QR LAMA ─────────────────────┐
│  ❌ Token expired (lebih dari 30 detik)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ❌ ABSEN DITOLAK                                     │  │
│  │  QR Code sudah expired. Silakan scan QR terbaru       │  │
│  │  di monitor lobi.                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─ KASIR COBA ABSEN 2x (PAKAI QR UNTUK TEMAN) ─────────────┐
│  ❌ Sudah ada record hari ini                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ℹ️ SUDAH ABSEN                                       │  │
│  │  Anda sudah absen masuk hari ini pukul 06:55 WIB.     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 4: KASIR — BUKA SHIFT (Setelah Absen Berhasil) ═══

```
┌─────────────────────────────────────────────────────────────┐
│  Setelah absen berhasil, kasir lanjut ke POS                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Kasir buka halaman Kasir POS                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  📋 Shift belum dibuka                                │  │
│  │  ✅ Absen masuk: 06:55 WIB (Tepat Waktu)             │  │
│  │  Shift: Pagi (07:00 - 15:00)                          │  │
│  │  Saldo Awal: Rp [_________]                            │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [▶ BUKA SHIFT]                      │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Tap "BUKA SHIFT"                                           │
│                                                             │
│  ✅ Sistem cek: Apakah kasir sudah absen hari ini?          │
│     └─ Sudah absen pukul 06:55 → BOLEH BUKA SHIFT ✅       │
│                                                             │
│  (Jika BELUM absen → tombol disabled:                      │
│   "Silakan absen masuk terlebih dahulu")                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ SHIFT PAGI AKTIF                                        │
│  Kasir: SIWI | Shift: Pagi                                  │
│  Absen: 06:55 | Shift mulai: 07:00                          │
│  → Kasir bisa mulai transaksi POS                           │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 5: KASIR — ABSEN PULANG & TUTUP SHIFT ═══

```
┌─────────────────────────────────────────────────────────────┐
│  Akhir shift — Kasir selesai bekerja                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Kasir buka halaman Shift → Tap "TUTUP SHIFT"              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Shift Pagi — SIWI                                    │  │
│  │  Mulai: 07:00 | Total Transaksi: 15                   │  │
│  │  Total Tunai: Rp 1.250.000 | QRIS: Rp 850.000        │  │
│  │  Saldo Akhir Fisik: Rp [_________]                    │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [⏹ TUTUP SHIFT]                     │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ✅ SHIFT DITUTUP → Absen pulang OTOMATIS                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Ringkasan Hari Ini:                                  │  │
│  │  Absen Masuk:   06:55 WIB  (Tepat Waktu)              │  │
│  │  Shift Mulai:   07:00 WIB                             │  │
│  │  Shift Selesai: 15:02 WIB                             │  │
│  │  Absen Pulang:  15:02 WIB  (Auto - Shift Close)       │  │
│  │  Durasi Kerja:  8 jam 7 menit                         │  │
│  │  Total Transaksi: 15 | Total: Rp 2.100.000            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 6: ALTERNATIF — ABSEN DARI TABLET WEB ═══

```
┌─────────────────────────────────────────────────────────────┐
│  Kasir tidak punya HP / HP mati / lupa bawa HP              │
│  → Bisa absen dari tablet di meja kasir (web browser)       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TABLET KASIR (Browser)                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Login: kasirresto@koperasi.com / password123          │  │
│  │  → Otomatis cek IP tablet                             │  │
│  │  → IP tablet = IP jaringan kantor ✅                  │  │
│  │  → Karena dari tablet kantor, tidak perlu scan QR     │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [✅ ABSEN MASUK]                     │          │  │
│  │  │     (Verifikasi via IP kantor)           │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
│  Catatan: Web tablet hanya butuh IP check                   │
│  (tidak perlu QR karena tablet sudah fisik di kantor)       │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 7: ADMIN UNIT — MONITOR ABSENSI HARIAN ═══

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN UNIT LOGIN → Menu "Absensi" → "Hari Ini"             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  📅 Senin, 5 Juni 2026 | Unit: Toko | Shift Pagi            │
│  ┌────┬────────┬────────┬─────────┬────────┬───────┐       │
│  │ No │ Kasir  │ Absen  │ Shift   │ Durasi │Status │       │
│  ├────┼────────┼────────┼─────────┼────────┼───────┤       │
│  │ 1  │ SIWI   │ 06:55  │ 07:00   │ Aktif  │ ✅    │       │
│  │ 2  │ BUDI   │ 07:12  │ 07:12   │ Aktif  │ ⚠️    │       │
│  │ 3  │ SARI   │ —      │ —       │ —      │ ❌    │       │
│  └────┴────────┴────────┴─────────┴────────┴───────┘       │
│                                                             │
│  ✅ Tepat Waktu (1)  ⚠️ Terlambat (1)  ❌ Belum (1)        │
│                                                             │
│  🔔 Notifikasi: "SARI belum absen (shift dimulai            │
│     30 menit yang lalu)"                                    │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 8: OPERATOR — OVERRIDE ABSEN MANUAL ═══

```
┌─────────────────────────────────────────────────────────────┐
│  Kasir lupa absen / HP rusak / Sistem error                 │
│  → Operator bisa input absen manual                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  OPERATOR → Menu "Absensi" → "Manual Override"              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Pilih Kasir: [SARI          ▼]                       │  │
│  │  Tanggal:     [5 Juni 2026]                           │  │
│  │  Jam Masuk:   [07:05]                                 │  │
│  │  Jam Keluar:  [15:00]                                 │  │
│  │  Alasan:      [HP rusak, absen via tablet tapi error] │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [💾 SIMPAN ABSEN MANUAL]             │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  │  ⚠️ Override akan tercatat di Audit Log               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

### ═══ FLOW 9: REKAP BULANAN — EXPORT LAPORAN ═══

```
┌─────────────────────────────────────────────────────────────┐
│  OPERATOR / ADMIN → Menu "Absensi" → "Rekap Bulanan"        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Filter: [Juni 2026 ▼]  Unit: [Semua ▼]  [Cari]            │
│                                                             │
│  ┌────┬────────┬──────┬────────┬────────┬────────┬──────┐   │
│  │ No │ Kasir  │ Unit │ Hadir  │ Terlam │ Tidak  │ Jam  │   │
│  │    │        │      │ (hari) │ bat    │ Hadir  │ Rata │   │
│  ├────┼────────┼──────┼────────┼────────┼────────┼──────┤   │
│  │ 1  │ SIWI   │ Toko │ 22     │ 1      │ 0      │ 8.1h │   │
│  │ 2  │ BUDI   │ Toko │ 20     │ 5      │ 2      │ 7.8h │   │
│  │ 3  │ SARI   │ Resto│ 21     │ 3      │ 1      │ 8.0h │   │
│  │ 4  │ AGUS   │ Resto│ 23     │ 0      │ 0      │ 8.2h │   │
│  └────┴────────┴──────┴────────┴────────┴────────┴──────┘   │
│                                                             │
│  Total Kasir: 4 | Total Hari Kerja: 22                     │
│                                                             │
│  [📊 Export Excel]  [📄 Export PDF]  [🖨️ Print Laporan]    │
└─────────────────────────────────────────────────────────────┘
```

**Export Excel berisi kolom detail per hari:**

| Kolom | Contoh |
|-------|--------|
| Nama Kasir | SIWI |
| Unit | Toko |
| Tanggal | 1 Jun 2026 |
| Shift | Pagi |
| Jam Absen Masuk | 06:55 |
| Jam Buka Shift | 07:00 |
| Jam Tutup Shift | 15:02 |
| Jam Absen Pulang | 15:02 |
| Durasi Kerja | 8 jam 7 menit |
| Status | ✅ Tepat Waktu / ⚠️ Terlambat / ❌ Tidak Hadir |
| Metode Absen | QR Code / IP / Manual |
| Total Transaksi | 15 |
| Total Penjualan | Rp 2.100.000 |

---

## ═══════════════════════════════════════════════════
## BAGIAN C: RINGKASAN FLOW PER ROLE
## ═══════════════════════════════════════════════════

### Operator (Super Admin)
```
1. Setup awal (sekali) → Input IP whitelist + WiFi + jam kerja + toleransi
2. Setiap hari → Monitor dashboard absensi semua unit
3. Jika perlu → Override manual untuk kasir yang bermasalah (tercatat di Audit Log)
4. Akhir bulan → Export rekap absensi untuk payroll / evaluasi kinerja
```

### Admin Unit (Per Unit)
```
1. Setiap pagi → Buka halaman QR Display di monitor/tablet lobi
2. Siang hari → Monitor status absensi kasir di unit (cek siapa terlambat/belum absen)
3. Jika ada masalah → Hubungi operator untuk override
4. Akhir bulan → Lihat rekap absensi unit sendiri
```

### Kasir (Setiap Hari)
```
1. Pagi → Datang ke kantor (pastikan terhubung WiFi kantor)
2. Buka HP → Login → Tap "Absen Masuk"
3. Scan QR Code dari monitor lobi → Verifikasi otomatis (< 1 detik)
4. Absen berhasil → Buka tablet kasir → Buka Shift → Mulai transaksi
5. Sore → Tutup shift di tablet → Absen pulang otomatis
6. Alternatif: Jika HP mati → Absen dari tablet web (verifikasi via IP kantor)
```

---

## ═══════════════════════════════════════════════════
## BAGIAN D: KEAMANAN — RINGKASAN UNTUK ATASAN
## ═══════════════════════════════════════════════════

| Manipulasi | Dicegah oleh | Penjelasan |
|------------|-------------|------------|
| Absen dari rumah | **IP Whitelist** | Hanya IP public kantor yang diterima |
| Absen dari rumah (VPN) | **WiFi SSID Check** | Harus terhubung fisik ke WiFi kantor |
| Kirim screenshot QR ke teman | **QR 30 detik** | QR expired sebelum sampai ke teman |
| Absen 2x untuk teman | **Single-use QR** | 1 QR token = 1 kasir saja |
| Jam absen dipalsukan | **Server timestamp** | Jam dicatat server, bukan dari HP kasir |
| Override sembarangan | **Audit Log** | Semua override dicatat si operator + alasan |
| Kasir buka shift tanpa absen | **Guard system** | Tombol shift disabled jika belum absen masuk |

**Verifikasi 3 Lapis:**
1. 🔒 **WiFi SSID** — Kasir harus terhubung ke jaringan fisik kantor
2. 🌐 **IP Public** — Request harus datang dari IP router kantor
3. 📱 **QR Code dinamis** — Harus scan QR dari monitor lobi yang berubah tiap 30 detik

---

## ═══════════════════════════════════════════════════
## BAGIAN E: ARSITEKTUR TEKNIS (UNTUK REFERENSI DEV)
## ═══════════════════════════════════════════════════

### Infrastruktur yang Sudah Ada (Di-reuse)

| Komponen | Kegunaan |
|----------|----------|
| **CashierShift** model (Prisma) | Shift open/close — akan di-link ke Attendance |
| **Shift schedule** (`shift-schedule.ts`) | Pagi/Sore/Malam per unit |
| **Mobile JWT auth** (44+ endpoints) | Pattern untuk mobile absensi API |
| **IP capture** (`extractRequestInfo()`) | Multi-header IP extraction |
| **Push notifications** (expo-notifications) | Notifikasi absen berhasil/gagal |
| **AuditLog** | Tracking semua aksi absensi |
| **Export utils** (`export-utils.ts`) | Excel (SheetJS) + PDF (browser print) |
| **Role system** (RBAC) | operator/admin/kasir permissions |

### Model Data Baru (Prisma)

**Attendance** — Catatan kehadiran per hari per kasir:
- `userId`, `unitType`, `cashierShiftId` (link opsional ke shift)
- `checkInAt`, `checkInMethod` (qr/ip/manual), `checkInIp`, `checkInQrToken`
- `checkOutAt`, `checkOutMethod`, `checkOutIp`
- `status` (checked_in / checked_out / auto_checkout)
- `metadata` (JSON — device info, WiFi SSID, user agent)

**AttendanceQrToken** — QR Code dinamis:
- `token` (UUID random), `unitType`, `expiresAt` (30 detik)
- `usedByUserId`, `usedAt` — single use tracking
- `isActive` — flag untuk invalidate

**Konfigurasi** — via `AppSetting` (sudah ada):
- `attendance_ip_whitelist` — JSON array IP yang diizinkan
- `attendance_wifi_whitelist` — JSON array WiFi SSID yang diizinkan

### API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/absensi/qr-display` | Generate QR token untuk monitor lobi |
| POST | `/api/mobile/absensi/check-in` | Check-in dari mobile (IP + QR) |
| POST | `/api/mobile/absensi/check-out` | Check-out manual dari mobile |
| POST | `/api/absensi/check-in` | Check-in dari tablet web (IP only) |
| POST | `/api/absensi/check-out` | Check-out dari tablet web |
| GET | `/api/absensi/today` | Status absensi hari ini per unit |
| GET | `/api/absensi/my-status` | Status absensi user yang login |
| GET | `/api/absensi/rekap` | Rekap bulanan (filter by unit, bulan) |
| GET/PUT | `/api/absensi/settings` | Manage IP & WiFi whitelist |
| POST | `/api/absensi/override` | Manual override (operator only) |

### Hubungan Attendance ↔ CashierShift

```
┌──────────────┐     1:1 (optional)    ┌──────────────────┐
│  Attendance  │ ◄──────────────────► │  CashierShift     │
│  (BARU)      │                      │  (SUDAH ADA)      │
├──────────────┤                      ├──────────────────┤
│ checkInAt    │                      │ startedAt        │
│ checkOutAt   │                      │ endedAt          │
│ IP / QR data │                      │ sales totals     │
└──────────────┘                      └──────────────────┘

Guard: Buka Shift → cek Attendance aktif → Jika tidak ada → TOLAK
```

### Prioritas Implementasi

| Fase | Fitur | Estimasi |
|------|-------|----------|
| **Phase 1** | Attendance model + API dasar (check-in/out tanpa verifikasi) | 1-2 hari |
| **Phase 2** | QR Code dinamis (generate + display + scanner mobile) | 2-3 hari |
| **Phase 3** | IP Whitelist + WiFi SSID verifikasi | 1 hari |
| **Phase 4** | Link ke CashierShift (absen wajib sebelum shift) | 1 hari |
| **Phase 5** | Rekap bulanan + export Excel/PDF | 1-2 hari |
| **Phase 6** | UI polish + testing + deploy | 1 hari |

**Total estimasi: 7-10 hari kerja**

---

## ═══════════════════════════════════════════════════
## BAGIAN F: PERTANYAAN UNTUK ATASAN
## ═══════════════════════════════════════════════════

Sebelum implementasi dimulai, perlu konfirmasi:

| # | Pertanyaan | Keterangan |
|---|-----------|------------|
| 1 | **IP public kantor berapa?** | Buka whatismyip.com dari WiFi kantor |
| 2 | **Semua unit pakai WiFi yang sama?** | Jika beda, perlu config per unit |
| 3 | **Toleransi keterlambatan berapa menit?** | Default 15 menit — bisa diubah |
| 4 | **Admin unit juga perlu absen?** | Saat ini hanya untuk kasir |
| 5 | **Hari libur nasional exclude dari rekap?** | Perlu daftar hari libur |

---

*Dokumen ini siap dipresentasikan. Untuk pertanyaan atau revisi, silakan sampaikan.*
