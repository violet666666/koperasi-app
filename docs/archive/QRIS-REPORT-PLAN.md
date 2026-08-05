# QRIS Report — Real-time Bank Jatim Integration Plan

> Status: **MENUNGGU INFO TEKNIS DARI BANK JATIM**
> Tanggal dibuat: 11 Mei 2026
> Last updated: 11 Mei 2026

---

## 1. Latar Belakang

Saat ini QRIS di PRIMKOPPOL Resor Lumajang hanya berupa **QRIS Static** — kasir memilih metode "QRIS", customer scan QR gambar statis, dan pembayaran dicatat manual sebagai lunas. Tidak ada:

- Konfirmasi otomatis bahwa pembayaran benar-benar masuk
- Reconciliation antara transaksi internal vs mutasi rekening Bank Jatim
- Report QRIS real-time (berapa yang masuk, kapan, dari siapa)

Pihak Bank Jatim menyatakan **"nanti kita integrasikan"** namun belum memberikan detail teknis.

---

## 2. Apa yang Mungkin Dimaksud Bank Jatim

| Kemungkinan | Penjelasan | Real-time? |
|---|---|---|
| **QRIS Dynamic + Webhook** | Setiap transaksi QRIS otomatis kirim callback ke server kita | Ya |
| **API Mutasi Rekening** | Kita polling API mutasi rekening Bank Jatim | Near real-time |
| **Payment Gateway** | Bank Jatim jadi gateway resmi, routing + settlement otomatis | Ya |
| **Snap/Billing API** | Generate billing virtual account / QR per transaksi | Ya |

**Paling mungkin:** QRIS Dynamic + Webhook atau API Mutasi.

---

## 3. Pertanyaan yang Harus Ditanyakan ke Bank Jatim

Sebelum implementasi, kita BUTUH jawaban dari pihak Bank Jatim:

### 3.1 Teknis
- [ ] QRIS yang kami pakai saat ini **static** atau bisa upgrade ke **dynamic**?
- [ ] Apakah ada **API** untuk cek mutasi rekening atau status transaksi QRIS?
- [ ] Apakah ada **webhook/callback** saat pembayaran QRIS masuk ke rekening?
- [ ] Format integrasinya seperti apa — **REST API, SOAP, atau lainnya**?
- [ ] Apakah ada **sandbox/environment testing** sebelum production?
- [ ] Berapa **rate limit** API-nya (request per menit/hari)?

### 3.2 Bisnis
- [ ] Apakah butuh **agreement/PKS khusus** untuk akses API?
- [ ] Apakah ada **biaya** untuk integrasi API QRIS?
- [ ] Berapa lama proses **onboarding** setelah agreement?
- [ ] Siapa **technical contact person** dari pihak Bank Jatim?
- [ ] Apakah **settlement** QRIS bisa dilihat per transaksi (traceability)?

### 3.3 Keamanan
- [ ] Autentikasi API pakai apa — **API Key, OAuth2, Client Certificate**?
- [ ] Apakah ada **IP Whitelisting**?
- [ ] Format **payload/response** contohnya seperti apa?

---

## 4. Arsitektur yang Direncanakan

### 4.1 Komponen Baru

```
┌─────────────────────────────────────────────────────┐
│                  PRIMKOPPOL SYSTEM                   │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  QRIS Report │    │  Webhook Receiver         │  │
│  │  Dashboard   │    │  /api/qris/callback       │  │
│  │              │    │                            │  │
│  │  - Real-time │◄───│  - Verifikasi signature   │  │
│  │  - Reconcile │    │  - Match ke transaksi     │  │
│  │  - Export    │    │  - Update status bayar    │  │
│  └──────────────┘    └───────────┬──────────────┘  │
│                                  │                  │
│                      ┌───────────▼──────────────┐  │
│                      │  QrisSettlement Table     │  │
│                      │  (Prisma Model Baru)      │  │
│                      │                            │  │
│                      │  - bankRefNo               │  │
│                      │  - amount                  │  │
│                      │  - paidAt                  │  │
│                      │  - matchedSaleId           │  │
│                      │  - status                  │  │
│                      └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         ▲
                         │ HTTPS Webhook / API Poll
                         │
┌─────────────────────────────────────────────────────┐
│                  BANK JATIM                          │
│                                                     │
│  - QRIS Dynamic Merchant                            │
│  - Settlement Processing                            │
│  - API Mutasi Rekening                              │
│  - Webhook Notification                             │
└─────────────────────────────────────────────────────┘
```

### 4.2 Database Schema (Draft)

```prisma
model QrisSettlement {
  id            Int       @id @default(autoincrement())
  bankRefNo     String?   @map("bank_ref_no")        // Reference dari Bank Jatim
  merchantId    String?   @map("merchant_id")         // Merchant ID QRIS
  terminalId    String?   @map("terminal_id")         // Terminal ID
  amount        Decimal  @map("amount") @db.Decimal(15, 2)
  fee           Decimal? @map("fee") @db.Decimal(15, 2)  // Fee QRIS (biasanya 0.7%)
  netAmount     Decimal? @map("net_amount") @db.Decimal(15, 2)
  paidAt        DateTime @map("paid_at")              // Waktu pembayaran dari bank
  settledAt     DateTime? @map("settled_at")          // Waktu settlement ke rekening
  sourceType    String?   @map("source_type")         // "webhook" / "api_poll" / "manual"
  rawPayload    Json?     @map("raw_payload")         // Response mentah dari Bank Jatim

  // Matching ke transaksi internal
  matchedSaleId      Int?    @map("matched_sale_id")       // StoreSale.id
  matchedTxId        Int?    @map("matched_tx_id")         // UnitTransaction.id
  matchConfidence    String? @map("match_confidence")      // "exact" / "approximate" / "manual"
  matchStatus        String  @default("unmatched") @map("match_status") // unmatched / matched / disputed

  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  sale         StoreSale?        @relation(fields: [matchedSaleId], references: [id])
  transaction  UnitTransaction?  @relation(fields: [matchedTxId], references: [id])

  @@index([bankRefNo])
  @@index([paidAt])
  @@index([matchStatus])
  @@map("qris_settlements")
}
```

### 4.3 API Routes yang Perlu Dibuat

| Route | Method | Fungsi |
|---|---|---|
| `/api/qris/callback` | POST | Webhook receiver dari Bank Jatim |
| `/api/qris/settlements` | GET | List semua settlement QRIS |
| `/api/qris/reconcile` | POST | Manual match settlement ke transaksi |
| `/api/qris/reconcile/auto` | POST | Auto-match berdasarkan amount + timestamp |
| `/api/qris/report` | GET | Report QRIS (summary per periode) |
| `/api/qris/poll` | GET/Cron | Polling API mutasi Bank Jatim (fallback) |

### 4.4 Frontend Pages

| Page | Lokasi | Fungsi |
|---|---|---|
| QRIS Dashboard | `/qris/dashboard` | Overview real-time, today's QRIS transactions |
| QRIS Reconciliation | `/qris/reconcile` | Match manual settlement ke transaksi internal |
| QRIS Report | `/qris/report` | Laporan per periode, export Excel/PDF |

---

## 5. Alur Kerja (Workflow)

### 5.1 Real-time (Webhook) — Ideal

```
Customer scan QRIS
    → Bank Jatim proses pembayaran
    → Bank Jatim kirim webhook ke /api/qris/callback
    → Verifikasi signature (hmac/secret key)
    → Simpan ke QrisSettlement
    → Auto-match ke StoreSale (by amount + timestamp ±5 menit)
    → Jika match → update StoreSale status, tampilkan di dashboard
    → Jika tidak match → masuk ke queue reconciliation manual
```

### 5.2 Polling (API Mutasi) — Fallback

```
Cron job setiap 5 menit
    → Hit API mutasi Bank Jatim (since last poll)
    → Parse response
    → Simpan ke QrisSettlement
    → Auto-match ke StoreSale
    → Update dashboard
```

### 5.3 Manual Import — Fallback Terakhir

```
Admin download mutasi rekening (Excel/PDF dari Internet Banking)
    → Upload ke /api/qris/import
    → Parse dan simpan ke QrisSettlement
    → Auto-match + manual reconciliation
```

---

## 6. Matching Logic (Reconciliation)

Strategi auto-match settlement ke transaksi internal:

1. **Exact match**: amount sama persis + timestamp dalam ±5 menit + unitType sesuai
2. **Amount match**: amount sama + tanggal sama (jika beberapa transaksi di hari yang sama)
3. **Manual match**: admin pilih manual dari UI reconciliation

Contoh query matching:

```sql
SELECT ss.*
FROM store_sales ss
WHERE ss.payment_method = 'qris'
  AND ABS(ss.total_amount - :settlementAmount) < 100  -- toleransi Rp 100
  AND ss.created_at BETWEEN :paidAt - INTERVAL '10 minutes' AND :paidAt + INTERVAL '10 minutes'
  AND ss.id NOT IN (SELECT matched_sale_id FROM qris_settlements WHERE matched_sale_id IS NOT NULL)
ORDER BY ABS(EXTRACT(EPOCH FROM (ss.created_at - :paidAt))) ASC
LIMIT 5;
```

---

## 7. Keamanan

- Webhook endpoint harus verifikasi **signature/HMAC** dari Bank Jatim
- API key disimpan di **environment variable** ( Railway vars )
- IP whitelisting jika Bank Jatim mendukung
- Rate limiting di webhook endpoint
- Logging semua payload mentah untuk audit trail

---

## 8. Timeline Estimasi

| Fase | Durasi | Dependency |
|---|---|---|
| **Informasi gathering** dari Bank Jatim | 1-2 minggu | Jawaban Bank Jatim |
| **Setup Merchant + API access** | 1-2 minggu | Agreement/PKS |
| **Implementasi backend** (schema + API + webhook) | 3-5 hari | Info teknis dari Bank |
| **Implementasi frontend** (dashboard + reconcile) | 3-5 hari | Backend selesai |
| **Testing dengan sandbox** | 2-3 hari | Sandbox dari Bank |
| **Go-live** | 1 hari | Semua OK |

**Total estimasi: 3-5 minggu** (tergantung kecepatan response Bank Jatim)

---

## 9. Catatan Penting

- Fitur ini **TIDAK BISA dimulai** tanpa info teknis dari Bank Jatim (API format, auth method, webhook URL, dll)
- Kita bisa prepare **schema + UI mockup** terlebih dahulu
- Saat ini QRIS tetap berfungsi normal sebagai payment method, hanya tidak ada auto-confirmation
- Alternatif sementara: admin bisa **manual reconcile** dengan cek mutasi Internet Banking

---

## 10. Referensi Internal

- QRIS payment method: `src/app/api/toko/sales/route.ts`, `src/app/api/unit-layanan/sales/route.ts`
- QRIS image management: `src/app/api/unit-layanan/qris/route.ts`
- QRIS stats di shift: `src/app/api/toko/shifts/[id]/close/route.ts`
- Cash/Bank account seed (Bank Jatim): `prisma/seed-kas-bank-jatim.ts`
- Unit laporan QRIS breakdown: `src/app/(protected)/unit/[unitSlug]/laporan/page.tsx`
