# Fitur Absensi Kasir — Design Spec

> **Tanggal:** 5 Juni 2026 | **Status:** Draft Brainstorming
> **Branch:** `railway-migration` | **Scope:** Semua unit (toko, resto, cafe_lsp, dll)

---

## 1. Ringkasan

Fitur absensi digital untuk kasir semua unit koperasi, dengan **verifikasi ganda** (IP Whitelist + QR Code dinamis). Kasir wajib absen masuk sebelum bisa membuka shift. Data absensi terekam untuk rekap bulanan dan export.

---

## 2. Keputusan Desain (dari Brainstorming)

| Aspek | Keputusan | Alasan |
|-------|-----------|--------|
| **Platform** | Keduanya (Web tablet + Mobile app HP) | Kasir pakai tablet di kasir, HP untuk scan QR |
| **Metode Verifikasi** | IP Whitelist + QR Code dinamis (berganda) | Paling aman dari manipulasi |
| **Flow Absensi** | Check-in & Check-out terpisah | Durasi kerja akurat untuk rekap bulanan |
| **Hubungan dengan Shift** | Absen wajib sebelum bisa buka shift | Absen masuk → baru bisa open shift; close shift → auto check-out |
| **Rekap Bulanan** | Ya, rekap + export Excel/PDF | Untuk evaluasi kinerja dan payroll |

---

## 3. Arsitektur & Infrastruktur yang Sudah Ada

### 3.1 Bisa Di-reuse

| Komponen | File/Lokasi | Kegunaan |
|----------|-------------|----------|
| **CashierShift** model | `prisma/schema.prisma` (L1227-1256) | Shift open/close tracking, auto-link ke absensi |
| **Shift schedule** config | `src/lib/shift-schedule.ts` | Pagi/Sore/Malam per unit, `AppSetting` key-value |
| **Mobile auth (JWT)** | `mobile/src/lib/api.ts`, `src/lib/jwt.ts` | Token-based auth untuk mobile absensi |
| **IP capture** | `src/lib/audit-logger.ts` (`extractRequestInfo`) | Multi-header IP extraction (x-forwarded-for, x-real-ip, dll) |
| **Push notifications** | `expo-notifications`, `User.fcmToken` | Notifikasi absen berhasil/gagal |
| **AuditLog** | `src/lib/audit-logger.ts` | Tracking aksi absensi dengan IP + metadata |
| **Export utils** | `src/lib/export-utils.ts` | Universal export (Excel via SheetJS, PDF via browser print) |
| **Mobile API pattern** | `src/app/api/mobile/` (44+ endpoints) | JWT auth, role filtering, Prisma queries |
| **Role system** | Role + Permission models | RBAC: operator (full), admin (unit-scoped), kasir (own only) |

### 3.2 Perlu Dibuat Baru

| Komponen | Deskripsi |
|----------|-----------|
| **Attendance model** | Tabel baru di Prisma schema — check-in/out, status, IP, QR token |
| **QR Code generator** | API endpoint — generate dynamic QR yang berubah tiap 30 detik |
| **QR display page** | Halaman web untuk monitor/tablet lobi — menampilkan QR dinamis |
| **QR scanner (mobile)** | Camera-based QR scanner di Expo RN app |
| **WiFi SSID/BSSID capture** | Native module untuk deteksi jaringan WiFi di mobile |
| **IP Whitelist config** | Admin UI untuk manage IP yang di-whitelist |
| **Absensi rekap page** | Halaman rekap bulanan per kasir dengan export |
| **Absensi mobile screens** | Screen absensi di mobile app untuk kasir |

---

## 4. Model Data (Prisma)

### 4.1 Attendance (Tabel Baru)

```prisma
model Attendance {
  id              Int       @id @default(autoincrement())
  userId          Int       @map("user_id")
  user            User      @relation(fields: [userId], references: [id])
  unitType        String    @map("unit_type")         // toko, resto, cafe_lsp, dll
  cashierShiftId  Int?      @map("cashier_shift_id")  // link ke CashierShift jika ada

  // Check-in
  checkInAt       DateTime  @map("check_in_at")       @db.Timestamp
  checkInMethod   String    @map("check_in_method")   // "qr" | "ip" | "manual" (operator override)
  checkInIp       String?   @map("check_in_ip")       // IP address saat check-in
  checkInQrToken  String?   @map("check_in_qr_token") // QR token yang di-scan
  checkInWifiSsid String?   @map("check_in_wifi_ssid")// WiFi SSID (jika dari mobile)

  // Check-out
  checkOutAt      DateTime? @map("check_out_at")      @db.Timestamp
  checkOutMethod  String?   @map("check_out_method")  // "qr" | "ip" | "auto_shift_close" | "manual"
  checkOutIp      String?   @map("check_out_ip")

  // Status & metadata
  status          String    @default("checked_in")     // "checked_in" | "checked_out" | "auto_checkout"
  notes           String?                              // Catatan (terlambat, dll)
  metadata        Json?                                 // Extra data (user agent, device info, dll)

  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamp
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamp

  @@map("attendances")
}
```

### 4.2 QR Session Token (Tabel Baru)

```prisma
model AttendanceQrToken {
  id          Int       @id @default(autoincrement())
  token       String    @unique                      // Random token (UUID)
  unitType    String    @map("unit_type")             // Untuk unit mana QR ini
  generatedAt DateTime  @default(now()) @map("generated_at") @db.Timestamp
  expiresAt   DateTime  @map("expires_at") @db.Timestamp  // 30 detik dari generatedAt
  usedByUserId Int?     @map("used_by_user_id")       // Kasir yang sudah pakai
  usedAt      DateTime? @map("used_at") @db.Timestamp
  isActive    Boolean   @default(true) @map("is_active")

  @@map("attendance_qr_tokens")
}
```

### 4.3 IP Whitelist Config (via AppSetting yang sudah ada)

Menggunakan `AppSetting` model yang sudah ada:
```
key: "attendance_ip_whitelist"
value: JSON array of allowed IPs: ["202.152.x.x", "36.73.x.x"]
```

```
key: "attendance_wifi_whitelist"
value: JSON array of allowed WiFi SSIDs: ["PRIMKOPPOL-KANTOR", "PRIMKOPPOL-LOBI"]
```

---

## 5. API Endpoints

### 5.1 QR Code Display (Web — Monitor Lobi)

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/absensi/qr-display?unitType=resto` | NextAuth (admin/operator) | Generate QR token baru, return QR image |
| GET | `/absensi/qr-display` | Page | Halaman full-screen untuk monitor lobi |

### 5.2 Absensi Actions (Mobile + Web)

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| POST | `/api/mobile/absensi/check-in` | JWT (mobile) | Check-in: validasi IP + QR token |
| POST | `/api/mobile/absensi/check-out` | JWT (mobile) | Check-out manual |
| POST | `/api/absensi/check-in` | NextAuth (web) | Check-in dari tablet web |
| POST | `/api/absensi/check-out` | NextAuth (web) | Check-out dari tablet web |

### 5.3 Management & Rekap

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| GET | `/api/absensi/rekap?month=6&year=2026&unitType=resto` | NextAuth (admin/operator) | Rekap bulanan per unit |
| GET | `/api/absensi/today?unitType=resto` | NextAuth (admin/operator) | Status absensi hari ini |
| GET | `/api/absensi/my-status` | NextAuth/JWT | Status absensi user yang login |
| PUT | `/api/absensi/settings` | NextAuth (operator) | Update IP whitelist, WiFi whitelist |
| GET | `/api/absensi/settings` | NextAuth (admin/operator) | Get whitelist settings |
| POST | `/api/absensi/override` | NextAuth (operator) | Manual override (absen manual untuk kasir) |

---

## 6. Flow Verifikasi Ganda

### 6.1 Check-in Flow (Mobile)

```
Kasir buka mobile app → Tap "Absen Masuk"
  ├─ Step 1: System cek WiFi SSID perangkat
  │   ├─ SSID cocok dengan whitelist → LANJUT
  │   └─ SSID tidak cocok → TOLAK: "Hubungkan ke WiFi kantor"
  ├─ Step 2: System cek IP address request
  │   ├─ IP cocok whitelist → LANJUT
  │   └─ IP tidak cocok → TOLAK: "Anda tidak di jaringan kantor"
  ├─ Step 3: Scan QR Code dari monitor lobi
  │   ├─ QR valid & belum expired (30 detik) → LANJUT
  │   ├─ QR expired → TOLAK: "QR sudah expired, scan ulang"
  │   └─ QR sudah dipakai → TOLAK: "QR sudah digunakan"
  ├─ Step 4: Validasi shift
  │   ├─ Sudah absen hari ini? → TOLAK: "Sudah absen masuk"
  │   └─ Belum absen → BUAT Attendance record
  └─ Step 5: Buka shift otomatis
      └─ Jika unit punya shift system → auto open CashierShift
```

### 6.2 Check-out Flow

```
Kasir tap "Absen Pulang" / Close shift
  ├─ Dari close shift → auto check-out Attendance
  │   └─ method = "auto_shift_close"
  ├─ Manual check-out dari mobile → validasi IP
  │   └─ method = "ip" atau "qr"
  └─ Operator override → manual check-out
      └─ method = "manual"
```

---

## 7. QR Code Dinamis

### 7.1 Karakteristik

- **Rotasi**: QR berubah setiap **30 detik** (via polling dari display page)
- **Format**: `ATTENDANCE:{token}:{unitType}:{timestamp}`
- **Single-use**: Satu token hanya bisa dipakai 1 kasir
- **Auto-expire**: Token expired 30 detik setelah generate

### 7.2 Display Page

- URL: `/absensi/qr-display?unitType=resto` (full-screen, tanpa sidebar)
- Menampilkan QR Code besar di tengah monitor
- Auto-refresh setiap 25 detik (mengambil token baru)
- Menampilkan nama unit + jam + countdown timer

### 7.3 Mobile Scanner

- Library: `expo-camera` + `expo-barcode-scanner` (sudah available di Expo)
- Setelah scan → langsung POST ke `/api/mobile/absensi/check-in`

---

## 8. IP Whitelist System

### 8.1 Konfigurasi

- Disimpan di `AppSetting` key `attendance_ip_whitelist`
- Format: `["202.152.1.1", "36.73.5.5"]` (array of IP strings)
- Hanya operator yang bisa mengubah whitelist
- Support IP range: `["192.168.1.0/24"]` (CIDR notation)

### 8.2 Deteksi IP

- Reuse `extractRequestInfo()` dari `src/lib/audit-logger.ts`
- Check header chain: `x-forwarded-for` → `x-real-ip` → `cf-connecting-ip` → `x-client-ip`
- Untuk mobile: IP dari request header (IP public kantor vs IP lain)

### 8.3 WiFi SSID (Mobile)

- Gunakan `expo-network` atau custom native module untuk baca SSID
- `expo-network` hanya tersedia di bare workflow, perlu tambahan config
- Alternatif: hanya verifikasi IP (lebih reliable, tidak perlu native module)

---

## 9. Rekap Bulanan

### 9.1 Metrik per Kasir per Bulan

| Metrik | Deskripsi |
|--------|-----------|
| Total Hari Kerja | Jumlah hari check-in dalam bulan |
| Hari Hadir | Jumlah hari check-in tepat waktu |
| Terlambat | Check-in setelah jam shift mulai + toleransi (misal 15 menit) |
| Tidak Hadir | Hari kerja tanpa check-in |
| Total Jam Kerja | Sum(check_out_at - check_in_at) |
| Rata-rata Jam Masuk | Avg(check_in_at time) |

### 9.2 Export

- Excel: via SheetJS (sudah ada pattern di `src/lib/export-utils.ts`)
- PDF: via browser print (sudah ada pattern)
- Kolom: No, Nama, Unit, Shift, Jam Masuk, Jam Keluar, Durasi, Status (Hadir/Terlambat/Tidak Hadir)

---

## 10. Hubungan dengan CashierShift (Existing)

```
┌──────────────┐     1:1 (optional)    ┌──────────────────┐
│  Attendance  │ ◄──────────────────► │  CashierShift     │
│  (BARU)      │                      │  (SUDAH ADA)      │
├──────────────┤                      ├──────────────────┤
│ checkInAt    │                      │ startedAt        │
│ checkOutAt   │                      │ endedAt          │
│ status       │                      │ status           │
│ IP / QR data │                      │ sales totals     │
└──────────────┘                      └──────────────────┘

Flow:
1. Kasir absen masuk → Attendance created (status: checked_in)
2. Kasir buka shift → CashierShift created, linked to Attendance
3. Kasir close shift → CashierShift closed, Attendance auto check-out
```

**Guard:** Buka shift → cek apakah ada Attendance aktif hari ini. Jika tidak ada → tolak dengan pesan "Silakan absen masuk dulu".

---

## 11. UI/UX — Screens yang Dibutuhkan

### 11.1 Web (Next.js)

| Screen | Route | Role | Deskripsi |
|--------|-------|------|-----------|
| QR Display | `/absensi/qr-display` | Admin/Operator | Full-screen QR untuk monitor lobi |
| Rekap Absensi | `/absensi/rekap` | Admin/Operator | Tabel rekap bulanan + export |
| Settings | `/absensi/settings` | Operator | Manage IP & WiFi whitelist |
| Status Hari Ini | `/absensi` | Kasir | Status absensi hari ini + tombol check-in/out |

### 11.2 Mobile (Expo RN)

| Screen | Tab/Nav | Deskripsi |
|--------|---------|-----------|
| Absen Masuk/Keluar | Tab baru atau di Dashboard | Tombol check-in dengan QR scanner |
| QR Scanner | Modal overlay | Camera scan QR code |
| Riwayat Absensi | Sub-screen | List absensi bulan ini |

### 11.3 Sidebar Navigation

- Tambah menu "Absensi" di sidebar admin (icon: `Clock` atau `UserCheck`)
- Tambah menu "QR Display" (icon: `QrCode`)
- Kasir: tambah di dashboard atau tab baru

---

## 12. Pertimbangan Teknis

### 12.1 Expo Bare Workflow vs Managed

- `expo-barcode-scanner` tersedia di managed workflow ✅
- WiFi SSID detection butuh `expo-network` (bare workflow) atau custom dev client
- **Rekomendasi**: Build custom dev client (`npx expo run:android`) untuk akses native APIs

### 12.2 IP Whitelist di Railway/Neon

- Aplikasi di-deploy di Railway (cloud) — semua request lewat Railway proxy
- IP yang terlihat = IP public kantor, BUKAN internal IP
- Jadi yang di-whitelist = IP public router kantor (bisa cek via whatismyip.com dari jaringan kantor)
- Ini sebenarnya LEBIH AMAN karena kasir HARUS di kantor (IP public hanya 1)

### 12.3 Offline Consideration

- Jika WiFi down → QR display tidak bisa generate token baru
- Fallback: Operator bisa manual override absensi
- QR token bisa di-cache sedikit (toleransi 30 detik sudah ada)

### 12.4 Keamanan QR Code

- Token random UUID — tidak bisa ditebak
- Single use — 1 token = 1 kasir
- Expired 30 detik — screenshot QR tidak bisa dipakai setelah 30 detik
- Rate limit — maks 3 scan gagal per menit per user

---

## 13. Prioritas Implementasi (Saran)

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

## 14. Open Questions

- [ ] IP public kantor berapa? (perlu di-whitelist)
- [ ] Apakah semua unit punya WiFi yang sama atau beda per unit?
- [ ] Berapa toleransi keterlambatan? (15 menit? 30 menit?)
- [ ] Apakah admin juga perlu absensi, atau hanya kasir?
- [ ] Apakah ada hari libur yang perlu di-exclude dari rekap?
