# Spec: Sistem Stok Lanjutan, HPP Moving Average & Notifikasi

**Tanggal:** 30 April 2026
**Status:** Draft
**Scope:** Modul Toko (extensible ke semua unit)

---

## 1. Overview

Sistem ini menambahkan 3 kapabilitas besar pada modul Unit Toko:

1. **Sistem Notifikasi** — In-app notification model + push notification sebagai fondasi untuk semua alert di seluruh unit
2. **HPP Moving Average & Audit Trail** — Auto-calculate HPP saat stok masuk, audit trail untuk stok keluar non-penjualan
3. **Batch & Expiry Tracking** — Full batch tracking dengan nomor batch, expiry date, dan notifikasi expired

### Implementasi Bertahap

| Tahap | Fokus | Dependency |
|---|---|---|
| **Tahap 1** | Sistem Notifikasi (Notification model + API + UI + Push) | Tidak ada |
| **Tahap 2** | HPP Moving Average + Audit Trail Stok Keluar | Tahap 1 (untuk alert) |
| **Tahap 3** | Batch & Expiry Full Tracking | Tahap 1 + 2 |

---

## 2. Tahap 1 — Sistem Notifikasi

### 2.1 Data Model

**Model Baru: `Notification`**

```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  userId    Int      @map("user_id")
  type      String   // "low_stock" | "expiring_soon" | "batch_expired" | "stock_in" | "void_request" | "info"
  title     String
  message   String
  data      Json?    // payload: { productId, batchId, unitType, dll }
  isRead    Boolean  @default(false) @map("is_read")
  readAt    DateTime? @map("read_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}
```

**Relasi:** Tambah `notifications Notification[]` di model `User`.

### 2.2 API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/notifications` | List notification user (pagination, filter unread) |
| `PUT` | `/api/notifications/read` | Mark all as read |
| `PUT` | `/api/notifications/[id]/read` | Mark single as read |
| `DELETE` | `/api/notifications/[id]` | Hapus notification |

### 2.3 Helper Function

`src/lib/notifications.ts`:

```typescript
export async function createNotification(params: {
  userId: number | number[];     // single atau multiple recipients
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  push?: boolean;                // kirim push notification juga (default true)
})
```

Logic:
1. Insert ke tabel `notifications` (bisa batch insert untuk multiple users)
2. Jika `push = true` dan user punya `fcmToken`, kirim via `sendPushNotification()` dari `expo-push.ts`
3. Digunakan dari mana saja: sale API, stock API, batch API, dll

### 2.4 UI Components

**Bell Icon di Navbar** (`src/components/patterns/notification-bell.tsx`):
- Badge merah dengan jumlah unread
- Dropdown: list 10 notifikasi terbaru (scrollable)
- Setiap item: icon berdasarkan type, title, message, timestamp, klik → mark as read
- Link "Lihat Semua" → halaman `/notifikasi`

**Halaman Notifikasi** (`src/app/(protected)/notifikasi/page.tsx`):
- List semua notifikasi dengan filter type
- Bulk "Tandai Semua Dibaca"
- Pagination

### 2.5 Event Triggers (Initial)

| Event | Kapan | Notification Type |
|---|---|---|
| Low stock (stokToko ≤ minStock) | Setelah sale atau stock adjustment | `low_stock` |
| Stok masuk (batch baru) | Saat admin input stok masuk | `stock_in` (info ke admin) |
| Void request | Saat kasir ajukan void | `void_request` (ke admin/operator) |

---

## 3. Tahap 2 — HPP Moving Average & Audit Trail

### 3.1 Data Model

**Model Baru: `StockBatch`**

```prisma
model StockBatch {
  id               Int      @id @default(autoincrement())
  productId        Int      @map("product_id")
  batchNo          String?  @map("batch_no")          // optional, bisa auto-generate
  purchasePrice    Decimal  @map("purchase_price") @db.Decimal(15, 2)  // harga beli supplier
  quantity         Int                                 // sisa stok batch ini
  originalQuantity Int      @map("original_quantity")  // jumlah awal masuk
  expiryDate       DateTime? @map("expiry_date")
  supplierName     String?  @map("supplier_name")
  receivedAt       DateTime @default(now()) @map("received_at")
  location         String   @default("gudang")         // "gudang" | "toko"
  isActive         Boolean  @default(true) @map("is_active")
  notes            String?
  unitType         String   @default("toko") @map("unit_type")
  createdAt        DateTime @default(now()) @map("created_at")

  product StoreProduct @relation(fields: [productId], references: [id])

  @@index([productId, isActive, receivedAt])  // FIFO query optimization
  @@map("stock_batches")
}
```

**Perubahan `StoreStockMovement`:**

Tambah field (additive migration):
```prisma
// Field baru yang ditambahkan ke model StoreStockMovement yang sudah ada:
reason     String?  // "sale" | "damaged" | "expired" | "internal_use" | "other" | "adjustment" | "transfer"
reasonNote String?  @map("reason_note")  // detail untuk "other" atau catatan
batchId    Int?     @map("batch_id")     // relasi ke StockBatch (nullable)
costAtTime Decimal? @map("cost_at_time") @db.Decimal(15, 2)  // snapshot HPP saat mutasi

// Relasi baru:
batch     StockBatch?  @relation(fields: [batchId], references: [id])
```

**Perubahan `StoreSaleItem`:**

Tambah field (untuk profit calculation):
```prisma
// Field baru di StoreSaleItem:
costPrice Decimal? @map("cost_price") @db.Decimal(15, 2)  // snapshot HPP saat penjualan
```

### 3.2 HPP Moving Average Logic

**Saat stok masuk (stock-in):**

```
Input: productId, quantity, purchasePrice, location, batchNo?, expiryDate?, supplierName?

1. Buat StockBatch baru:
   - quantity = originalQuantity = input quantity
   - purchasePrice = input harga beli

2. Jika produk BUKAN excluded category:
   costPrice_baru = (stok_lama × costPrice_lama + quantity × purchasePrice) / (stok_lama + quantity)
   → Update StoreProduct.costPrice = costPrice_baru
   → Update StoreProduct.sellPrice = auto-calculate dari costPrice_baru (markup + PPN)

3. Jika produk excluded category (misal rokok):
   → costPrice TIDAK diupdate otomatis (tetap manual)
   → Hanya tambah stok

4. Update StoreProduct stock counters (stock, stockGdg, stockToko)
5. Buat StoreStockMovement (type: "in", costAtTime: costPrice sebelum update)
```

**Saat penjualan:**
- `costAtTime` di-snapshot di `StoreSaleItem` (tambah field `costPrice` di SaleItem untuk profit calculation)
- Kurangi `StockBatch.quantity` dari batch tertua yang aktif (FIFO untuk konsumsi batch)
- CostPrice StoreProduct TIDAK berubah saat penjualan

### 3.3 Stok Keluar Non-Penjualan (Audit Trail)

**UI: Dialog "Stok Keluar" di halaman Persediaan (`/toko/persediaan`)**

Form fields:
- Produk (dropdown, dengan info stok saat ini)
- Jumlah
- Lokasi (Gudang / Toko)
- **Alasan** (wajib pilih):
  - `damaged` — Rusak / Hilang
  - `expired` — Kadaluarsa
  - `internal_use` — Pemakaian Internal
  - `other` — Lainnya (wajib isi catatan)
- **Catatan** (opsional, wajib untuk "other")

**API:** `POST /api/toko/products/[id]/stock` dengan `type: "out_writeoff"`

Logic:
1. Validasi stok cukup
2. Kurangi stok di lokasi terkait
3. Buat `StoreStockMovement` dengan `reason`, `reasonNote`, `costAtTime`
4. Kirim notifikasi ke admin: "Stok keluar: [produk] × [qty] — [alasan]"

### 3.4 Profit per Unit di Laporan

**Formula:**
```
Profit Bersih Unit = Total Penjualan - Total HPP Terjual - Total Beban Stok Keluar

di mana:
- Total HPP Terjual = SUM(StoreSaleItem.quantity × StoreSaleItem.costPrice)
- Total Beban Stok Keluar = SUM(StoreStockMovement WHERE reason != "sale" AND reason != "adjustment" AND reason IS NOT NULL) × costAtTime
```

**Implementasi:** Tambahkan field di response API `/api/unit/[slug]/laporan`:
- `totalHPP` — total HPP dari barang yang terjual
- `totalWriteOff` — total nilai stok keluar non-penjualan
- `netProfit` — profit bersih

---

## 4. Tahap 3 — Batch & Expiry Full Tracking

### 4.1 Batch Number Format

Auto-generate: `BATCH-YYYYMMDD-XXXX` (contoh: `BATCH-20260430-0001`)
- Admin juga bisa input manual batch number

### 4.2 Batch Selector saat Penjualan

- **Default: FIFO** — sistem otomatis kurangi batch tertua dulu
- Backend logic di sales API: saat deducting stock, ambil batch `WHERE isActive = true ORDER BY receivedAt ASC`, kurangi `quantity` secara berurutan
- Tidak perlu UI selector di kasir — kasir tidak perlu tahu batch mana

### 4.3 Laporan Batch

**Halaman baru: `/toko/batch`** (atau section di Persediaan)

| View | Filter | Keterangan |
|---|---|---|
| Batch Aktif | `isActive = true` | Semua batch yang masih punya stok |
| Batch Expired | `expiryDate < now()` | Batch yang sudah melewati expiry |
| Expiring Soon | `expiryDate < now() + 90 days` | Peringatan 3 bulan ke depan |
| Batch History | Semua | Riwayat semua batch |

### 4.4 Expiry Notifications

**Trigger:** Background check (saat halaman batch diakses, atau saat stock-in/create batch)

| Condition | Notification |
|---|---|
| Batch expiry dalam 90 hari | `expiring_soon` ke admin unit |
| Batch sudah expired | `batch_expired` ke admin unit, batch `isActive = false` otomatis |

---

## 5. Excluded Categories Integration

Produk dengan kategori yang di-exclude (configurable via `/toko/manajemen-harga`):
- **HPP Moving Average**: SKIP — costPrice tetap manual, tidak auto-calc
- **Sell Price auto-calc**: SKIP — sellPrice tetap manual
- **Stok masuk**: Tetap berjalan normal (tambah stok, buat batch), tapi tidak update costPrice
- **Batch tracking**: Tetap berjalan normal — semua produk punya batch terlepas dari kategori

---

## 6. File yang Perlu Diubah/Dibuat

### Tahap 1 — Notifikasi
| File | Aksi |
|---|---|
| `prisma/schema.prisma` | Tambah model `Notification` + relasi di User |
| `src/lib/notifications.ts` | **NEW** — helper `createNotification()` |
| `src/app/api/notifications/route.ts` | **NEW** — GET list |
| `src/app/api/notifications/read/route.ts` | **NEW** — PUT mark all read |
| `src/app/api/notifications/[id]/route.ts` | **NEW** — PUT read, DELETE |
| `src/components/patterns/notification-bell.tsx` | **NEW** — bell icon + dropdown |
| `src/app/(protected)/notifikasi/page.tsx` | **NEW** — halaman list notifikasi |
| Navbar/layout yang ada | Tambah `<NotificationBell />` |

### Tahap 2 — HPP + Audit Trail
| File | Aksi |
|---|---|
| `prisma/schema.prisma` | Tambah model `StockBatch`, tambah field di `StoreStockMovement` |
| `src/app/api/toko/products/[id]/stock/route.ts` | Modifikasi: stok masuk → buat batch + calc Moving Average |
| `src/app/api/toko/sales/route.ts` | Tambah `costPrice` snapshot di `StoreSaleItem` |
| `src/app/api/toko/products/[id]/stock/route.ts` | Tambah handler `type: "out_writeoff"` |
| `src/app/(protected)/toko/persediaan/page.tsx` | Tambah dialog stok keluar dengan alasan |
| `src/app/api/unit/[unitSlug]/laporan/route.ts` | Tambah field profit calculation |

### Tahap 3 — Batch & Expiry
| File | Aksi |
|---|---|
| `src/app/(protected)/toko/batch/page.tsx` | **NEW** — halaman manajemen batch |
| `src/app/api/toko/batches/route.ts` | **NEW** — list/filter batch |
| Stock deduction logic (sales) | Modifikasi: deduct dari batch tertua (FIFO) |
| Expiry check logic | Tambah di batch API atau background check |

---

## 7. Success Criteria

1. **Tahap 1**: Admin menerima notifikasi in-app + push saat stok rendah, bisa melihat history notifikasi
2. **Tahap 2**: HPP otomatis terupdate saat stok masuk (Moving Average), stok keluar non-sale ter-audit dengan alasan, laporan menampilkan profit bersih per unit
3. **Tahap 3**: Setiap stok masuk tercatat sebagai batch terpisah, expiry date bisa diinput, sistem memberi alert jika ada batch expiring/expired
4. **Umum**: Produk excluded (rokok) tidak terpengaruh Moving Average — tetap harga manual
