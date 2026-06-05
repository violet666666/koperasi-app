# Flow Diagram — Fitur Absensi Kasir PRIMKOPPOL

> **Dokumen ini untuk presentasi ke atasan** — menjelaskan flow end-to-end dari setup hingga rekap bulanan.
> Versi: 5 Juni 2026 | Status: Design Phase

---

## Daftar Role yang Terlibat

| Role | Tanggung Jawab dalam Absensi |
|------|------------------------------|
| **Operator** | Setup awal sistem (IP whitelist, WiFi), override manual, lihat rekap semua unit |
| **Admin Unit** | Tampilkan QR di monitor, lihat rekap unit sendiri, buka halaman absen |
| **Kasir** | Absen masuk/keluar, scan QR, buka/tutup shift |
| **Anggota** | Tidak terlibat (hanya kasir & staf yang absen) |

---

## ═══════════════════════════════════════════
## FLOW 1: SETUP AWAL OLEH OPERATOR (Sekali saja)
## ═══════════════════════════════════════════

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
│  STEP 3: Set Jam Kerja & Toleransi                          │
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

## ═══════════════════════════════════════════
## FLOW 2: ADMIN UNIT — TAMPILKAN QR CODE (Setiap Hari)
## ═══════════════════════════════════════════

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
│   │                                                     │   │
│   │              ┌───────────────────┐                  │   │
│   │              │                   │                  │   │
│   │              │    █▀▀▀▀▀▀▀▀█    │                  │   │
│   │              │    █ QR CODE  █    │                  │   │
│   │              │    █ (besar)  █    │                  │   │
│   │              │    █          █    │                  │   │
│   │              │    ▀▀▀▀▀▀▀▀▀▀    │                  │   │
│   │              │                   │                  │   │
│   │              └───────────────────┘                  │   │
│   │                                                     │   │
│   │         🏪 RESTO & CAFE — PRIMKOPPOL                │   │
│   │         🕐 QR berubah dalam: 23 detik               │   │
│   │         📅 Senin, 5 Juni 2026 • 07:15 WIB          │   │
│   │                                                     │   │
│   │   "Scan QR ini dari HP untuk absen masuk"           │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   → Tampil FULL SCREEN di monitor/tablet lobi               │
│   → QR otomatis berubah setiap 30 detik                     │
│   → Tidak perlu di-klik/dioperasikan — otomatis             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Catatan untuk atasan:**
- Monitor/tablet diletakkan di lobi atau area masuk kantor
- QR berubah otomatis — tidak bisa di-screenshot untuk dipakai nanti
- 1 QR = 1 kasir (single use) — setelah di-scan, QR expired
- Bisa ditampilkan di tablet yang sama dengan tablet kasir (split screen)

---

## ═══════════════════════════════════════════
## FLOW 3: KASIR — ABSEN MASUK (Setiap Pagi)
## ═══════════════════════════════════════════

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
│  │  │                                                 │  │  │
│  │  │           ┌──────────────────┐                  │  │  │
│  │  │           │  Arahkan kamera  │                  │  │  │
│  │  │           │  ke QR Code di   │                  │  │  │
│  │  │           │  monitor lobi    │                  │  │  │
│  │  │           └──────────────────┘                  │  │  │
│  │  │                                                 │  │  │
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
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  ✅ ABSEN MASUK BERHASIL                        │  │  │
│  │  │                                                 │  │  │
│  │  │  👤 Nama: SIWI                                  │  │  │
│  │  │  🏪 Unit: Toko                                  │  │  │
│  │  │  🕐 Jam: 06:55 WIB                              │  │  │
│  │  │  📋 Shift: Pagi                                 │  │  │
│  │  │  📶 WiFi: PRIMKOPPOL-KANTOR                     │  │  │
│  │  │  🌐 IP: 202.152.xxx.xxx                         │  │  │
│  │  │                                                 │  │  │
│  │  │  Status: ✅ Tepat Waktu                         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Skenario Penolakan Absen:

```
┌─ KASIR COBA ABSEN DARI RUMAH ──────────────────────────────┐
│                                                             │
│  ❌ Cek 1: WiFi SSID                                       │
│     └─ WiFi: "Home_WiFi" → TIDAK COCOK ❌                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ❌ ABSEN DITOLAK                                     │  │
│  │                                                       │  │
│  │  Anda tidak terhubung ke jaringan kantor.             │  │
│  │  Hubungkan ke WiFi "PRIMKOPPOL-KANTOR" untuk absen.   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─ KASIR COBA PAKAI SCREENSHOT QR LAMA ─────────────────────┐
│                                                             │
│  ❌ Cek 3: QR Token                                        │
│     └─ Token: "abc-123-def" → EXPIRED ❌ (lebih 30 detik)  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ❌ ABSEN DITOLAK                                     │  │
│  │                                                       │  │
│  │  QR Code sudah expired. Silakan scan QR terbaru       │  │
│  │  di monitor lobi.                                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

┌─ KASIR COBA ABEN 2x (PAKAI QR YANG SAMA) ─────────────────┐
│                                                             │
│  ❌ Cek 5: Sudah absen?                                    │
│     └─ Sudah ada record hari ini → SUDAH ABSEN ❌          │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ℹ️ SUDAH ABSEN                                       │  │
│  │                                                       │  │
│  │  Anda sudah absen masuk hari ini pukul 06:55 WIB.     │  │
│  │  Shift: Pagi                                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 4: KASIR — BUKA SHIFT (Setelah Absen)
## ═══════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────┐
│  Setelah absen berhasil, kasir lanjut ke POS                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Kasir buka halaman Kasir POS                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  📋 Shift belum dibuka                          │  │  │
│  │  │                                                 │  │  │
│  │  │  ✅ Absen masuk: 06:55 WIB (Tepat Waktu)       │  │  │
│  │  │                                                 │  │  │
│  │  │  Shift: Pagi (07:00 - 15:00)                    │  │  │
│  │  │  Saldo Awal: Rp [_________]                     │  │  │
│  │  │                                                 │  │  │
│  │  │  ┌─────────────────────────────────────────┐    │  │  │
│  │  │  │     [▶ BUKA SHIFT]                      │    │  │  │
│  │  │  └─────────────────────────────────────────┘    │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
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
│  (Jika BELUM absen → tombol disabled dengan pesan:          │
│   "Silakan absen masuk terlebih dahulu")                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  CashierShift dibuat → terlink ke Attendance record         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ✅ SHIFT PAGI AKTIF                                 │  │
│  │  Kasir: SIWI | Shift: Pagi                           │  │
│  │  Absen: 06:55 | Shift mulai: 07:00                   │  │
│  │                                                       │  │
│  │  → Kasir bisa mulai transaksi POS                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 5: KASIR — ABSEN PULANG & TUTUP SHIFT
## ═══════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────┐
│  Akhir shift — Kasir selesai bekerja                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Kasir buka halaman Shift → Tap "TUTUP SHIFT"      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Shift Pagi — SIWI                                    │  │
│  │  Mulai: 07:00 | Total Transaksi: 15                   │  │
│  │  Total Tunai: Rp 1.250.000 | QRIS: Rp 850.000        │  │
│  │                                                       │  │
│  │  Saldo Akhir Fisik: Rp [_________]                    │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [⏹ TUTUP SHIFT]                     │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Shift ditutup → Absen pulang OTOMATIS              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ✅ SHIFT DITUTUP                                    │  │
│  │                                                       │  │
│  │  Ringkasan Hari Ini:                                  │  │
│  │  ┌──────────────────────────────────────────────┐    │  │
│  │  │  Absen Masuk:   06:55 WIB  (Tepat Waktu)     │    │  │
│  │  │  Shift Mulai:   07:00 WIB                    │    │  │
│  │  │  Shift Selesai: 15:02 WIB                    │    │  │
│  │  │  Absen Pulang:  15:02 WIB  (Auto - Shift)    │    │  │
│  │  │  Durasi Kerja:  8 jam 7 menit                │    │  │
│  │  │  Total Transaksi: 15                           │    │  │
│  │  │  Total Penjualan: Rp 2.100.000                │    │  │
│  │  └──────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 6: ALTERNATIF — ABSEN DARI TABLET WEB
## ═══════════════════════════════════════════

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
│  │                                                       │  │
│  │  → Otomatis cek IP tablet                             │  │
│  │  → IP tablet = IP jaringan kantor ✅                  │  │
│  │  → Karena dari tablet kantor, tidak perlu scan QR     │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [✅ ABSEN MASUK]                     │          │  │
│  │  │     (Verifikasi via IP kantor)           │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Catatan: Web tablet hanya butuh IP check                   │
│  (tidak perlu QR karena tablet sudah di kantor)             │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 7: ADMIN UNIT — MONITOR ABSENSI HARIAN
## ═══════════════════════════════════════════

```
┌─────────────────────────────────────────────────────────────┐
│  ADMIN UNIT LOGIN → Menu "Absensi" → "Hari Ini"             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Halaman Status Absensi Hari Ini — Unit: Toko               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  📅 Senin, 5 Juni 2026 | Shift Pagi                   │  │
│  │                                                       │  │
│  │  ┌────┬────────┬────────┬─────────┬────────┬───────┐  │  │
│  │  │ No │ Kasir  │ Absen  │ Shift   │ Durasi │Status │  │  │
│  │  ├────┼────────┼────────┼─────────┼────────┼───────┤  │  │
│  │  │ 1  │ SIWI   │ 06:55  │ 07:00   │ Aktif  │ ✅    │  │  │
│  │  │ 2  │ BUDI   │ 07:12  │ 07:12   │ Aktif  │ ⚠️    │  │  │
│  │  │ 3  │ SARI   │ —      │ —       │ —      │ ❌    │  │  │
│  │  └────┴────────┴────────┴─────────┴────────┴───────┘  │  │
│  │                                                       │  │
│  │  ✅ Tepat Waktu (1)  ⚠️ Terlambat (1)  ❌ Belum (1)   │  │
│  │                                                       │  │
│  │  🔔 Notifikasi: "SARI belum absen (shift dimulai      │  │
│  │     30 menit yang lalu)"                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 8: OPERATOR — OVERRIDE ABSEN MANUAL
## ═══════════════════════════════════════════

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
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────┐          │  │
│  │  │     [💾 SIMPAN ABSEN MANUAL]             │          │  │
│  │  └─────────────────────────────────────────┘          │  │
│  │                                                       │  │
│  │  ⚠️ Override akan tercatat di Audit Log               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ═══════════════════════════════════════════
## FLOW 9: REKAP BULANAN — EXPORT LAPORAN
## ═══════════════════════════════════════════

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
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ [📊 Export   │  │ [📄 Export   │  │ [🖨️ Print   │      │
│  │  Excel]      │  │  PDF]        │  │  Laporan]    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Export Excel berisi kolom detail:**

| Kolom | Contoh |
|-------|--------|
| No | 1 |
| Nama Kasir | SIWI |
| Unit | Toko |
| Tanggal | 1 Jun 2026 |
| Shift | Pagi |
| Jam Absen Masuk | 06:55 |
| Jam Buka Shift | 07:00 |
| Jam Tutup Shift | 15:02 |
| Jam Absen Pulang | 15:02 |
| Durasi Kerja | 8 jam 7 menit |
| Status Absen | ✅ Tepat Waktu |
| Metode Absen | QR Code |
| IP Address | 202.152.xxx.xxx |
| Total Transaksi | 15 |
| Total Penjualan | Rp 2.100.000 |

---

## ═══════════════════════════════════════════
## RINGKASAN FLOW PER ROLE
## ═══════════════════════════════════════════

### Operator (Super Admin)
```
1. Setup awal (sekali) → Input IP whitelist + WiFi + jam kerja
2. Setiap hari → Monitor dashboard absensi
3. Jika perlu → Override manual untuk kasir yang bermasalah
4. Akhir bulan → Export rekap absensi untuk payroll
```

### Admin Unit (Per Unit)
```
1. Setiap pagi → Buka halaman QR Display di monitor lobi
2. Siang hari → Monitor status absensi kasir di unit
3. Jika ada masalah → Hubungi operator untuk override
```

### Kasir (Setiap Hari)
```
1. Pagi → Datang ke kantor (connect WiFi kantor)
2. Buka HP → Login → Tap "Absen Masuk"
3. Scan QR Code dari monitor lobi
4. Absen berhasil → Buka tablet kasir → Buka Shift
5. Kerja normal (transaksi POS)
6. Sore → Tutup shift di tablet → Absen pulang otomatis
```

---

## ═══════════════════════════════════════════
## KEAMANAN — RINGKASAN UNTUK ATASAN
## ═══════════════════════════════════════════

| Manipulasi | Dicegah oleh | Penjelasan |
|------------|-------------|------------|
| Absen dari rumah | **IP Whitelist** | Hanya IP kantor yang diterima |
| Absen dari rumah (VPN) | **WiFi SSID Check** | Harus terhubung fisik ke WiFi kantor |
| Kirim screenshot QR ke teman | **QR 30 detik** | QR expired sebelum sampai |
| Absen 2x untuk teman | **Single-use QR** | 1 QR = 1 kasir saja |
| Jam absen dipalsukan | **Server timestamp** | Jam dicatat server, bukan HP |
| Override sembarangan | **Audit Log** | Semua override dicatat si operator |
| Kasir buka shift tanpa absen | **Guard system** | Tombol shift disabled jika belum absen |

---

*Dokumen ini bisa langsung digunakan untuk presentasi ke atasan. Jika ada pertanyaan atau revisi, silakan sampaikan.*
