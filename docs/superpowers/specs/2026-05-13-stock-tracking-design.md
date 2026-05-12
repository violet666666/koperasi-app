# Stock Tracking (Deteksi Selisih Stok) — Design Spec

**Date:** 2026-05-13
**Unit:** Toko (Store)
**Status:** Approved

---

## 1. Latar Belakang

Admin toko mendapati perbedaan antara stok fisik (barang di etalase/gudang) dengan stok di sistem. Root cause yang teridentifikasi: kasir yang tidak jujur tidak menginput transaksi pembelian pelanggan, sehingga uang masuk ke kantong pribadi kasir sementara barang keluar tanpa tercatat di sistem.

Fitur ini dibuat sebagai **tool deteksi selisih stok** yang simpel untuk admin toko, bukan sistem stock opname formal yang kompleks.

## 2. Tujuan

- Memberikan tool bagi admin toko untuk membandingkan stok fisik vs sistem secara cepat
- Mendeteksi produk yang **stok fisik < stok sistem** (barang hilang tanpa jejak)
- Flag produk **mencurigakan** — selisih tidak bisa dijelaskan oleh transaksi penjualan yang tercatat
- Memudahkan investigasi kecurangan kasir

## 3. Scope Pengecekan (Fleksibel)

Admin bisa memilih:
- **Semua Produk** — cek seluruh inventaris
- **Per Kategori** — multi-select chip kategori
- **Produk Spesifik** — search + pilih produk satu per satu dari dropdown

## 4. UI Flow

### Step 1 — Setup Pengecekan

Halaman `/toko/stock-tracking` menampilkan card setup:
- Pilih scope (Semua / Kategori / Spesifik)
- Jika Kategori: multi-select chip dari daftar kategori yang ada
- Jika Spesifik: combobox search produk, pilih satu per satu, tampil sebagai chip yang bisa dihapus
- Pilih lokasi: Gudang / Toko (stok mana yang dibandingkan)
- Tombol "Mulai Pengecekan"

### Step 2 — Input Stok Fisik

Tabel DataTable dengan kolom:

| Kolom | Tipe | Keterangan |
|---|---|---|
| No | Auto | Nomor urut |
| Nama Produk | Read-only | Nama + SKU |
| Kategori | Read-only | Badge kategori |
| Stok Sistem | Read-only | Angka dari DB sesuai lokasi |
| Stok Fisik | Input number | Admin isi hasil hitung fisik |
| Satuan | Read-only | Satuan produk (pcs, kg, ltr, dll) |
| Selisih | Auto-calc | `Fisik - Sistem` (negatif = kurang) |
| Status | Badge | Sesuai (hijau) / Kurang (merah) / Lebih (biru) |

Fitur tabel:
- Search bar untuk filter produk
- Baris yang belum diisi stok fisik: highlight kuning
- Baris yang sudah diisi: selisih dan status auto-update real-time
- Bisa skip produk (tidak wajib isi semua)
- Summary card: Total produk, Sudah dicek, Belum dicek, Ada selisih

### Step 3 — Hasil & Deteksi

Setelah admin selesai input:
- Tombol "Analisis Hasil"
- Frontend kirim data ke API → backend hitung flag mencurigakan
- Tabel hasil dengan filter: Semua / Hanya Selisih / Hanya Mencurigakan
- Summary: Total dicek, Sesuai, Ada selisih, Total unit hilang, Estimasi kerugian (Rp)
- Tombol "Export Excel"

### Kolom Deteksi Mencurigakan

Untuk setiap produk yang `stok fisik < stok sistem`:
- Backend query `StoreSaleItem` untuk menghitung total qty terjual (non-voided) dalam **rentang waktu pilihan admin** (default: 7 hari terakhir, configurable)
- Logika: `selisihStok = stokSistem - stokFisik`. Jika `selisihStok > totalTerjual` → artinya selisih tidak bisa dijelaskan oleh penjualan yang tercatat → flag **Mencurigakan**
- Info per produk: "Selisih: -5 unit, Terjual (7 hari): 2 unit, Potensi hilang tanpa transaksi: 3 unit"

## 5. Arsitektur Teknis

### URL & Navigasi

- **Halaman**: `/toko/stock-tracking`
- **Sidebar**: Menu "Stock Tracking" di `adminTokoNavigation` dan `mainNavigation > Toko`
- **Akses**: Admin toko & Operator only (role check di layout + API)
- **Kasir**: Tidak bisa akses (hidden di sidebar, blocked di route guard)

### API Endpoints

#### `GET /api/toko/stock-tracking/products`

Fetch produk berdasarkan scope + stok sistem per lokasi.

Query params:
- `scope`: "all" | "category" | "specific"
- `categories[]`: array kategori (jika scope=category)
- `productIds[]`: array product ID (jika scope=specific)
- `location`: "gudang" | "toko"

Response:
```json
{
  "products": [
    {
      "id": "...",
      "name": "...",
      "sku": "...",
      "category": "...",
      "unit": "...",
      "stockSystem": 25,
      "costPrice": 15000,
      "sellPrice": 20000
    }
  ]
}
```

#### `POST /api/toko/stock-tracking/compare`

Analisis selisih + flag mencurigakan.

Body:
```json
{
  "items": [
    { "productId": "...", "physicalStock": 20 }
  ],
  "location": "toko",
  "dateFrom": "2026-05-06",
  "dateTo": "2026-05-13"
}
```

Response:
```json
{
  "results": [
    {
      "productId": "...",
      "name": "...",
      "category": "...",
      "stockSystem": 25,
      "stockPhysical": 20,
      "difference": -5,
      "costPrice": 15000,
      "estimatedLoss": 75000,
      "status": "kurang",
      "suspicious": true,
      "totalSold": 2,
      "unaccounted": 3,
      "suspiciousNote": "Selisih: -5 unit, Terjual (7 hari): 2 unit, Potensi hilang tanpa transaksi: 3 unit"
    }
  ],
  "summary": {
    "totalChecked": 10,
    "totalMatch": 6,
    "totalDiscrepancy": 4,
    "totalUnitsMissing": 15,
    "totalUnitsExtra": 2,
    "estimatedLoss": 225000,
    "suspiciousCount": 3
  }
}
```

### Data Flow

```
Admin pilih scope + lokasi + date range
        |
GET /api/toko/stock-tracking/products
  -> query StoreProduct (filter scope, location, unitType=toko)
  -> return produk + stok sistem
        |
Admin input stok fisik per baris (frontend real-time calc)
        |
Admin klik "Analisis Hasil" atau "Export Excel"
        |
POST /api/toko/stock-tracking/compare
  -> terima items + dateRange
  -> untuk tiap produk selisih negatif:
       query StoreSaleItem SUM(quantity) WHERE
         non-voided AND productId AND createdAt dalam dateRange
       jika selisih > totalTerjual -> flag suspicious
  -> return results + summary
        |
Tampilkan tabel hasil + summary cards
        |
Jika export -> generate Excel file via xlsx/exceljs
```

### Tidak Perlu Prisma Schema Baru

Semua data sudah ada:
- `StoreProduct` → stok sistem (`stockGdg`, `stockToko`)
- `StoreSaleItem` → qty terjual (untuk perbandingan)
- `StoreStockMovement` → mutasi stok (referensi tambahan jika perlu)
- Opname bersifat **on-the-fly** — tidak disimpan ke DB

### Export Excel

Format: `STOCK-CHECK-[lokasi]-[YYYY-MM-DD].xlsx`

Kolom: No | Produk | SKU | Kategori | Stok Sistem | Stok Fisik | Selisih | Estimasi Kerugian (Rp) | Status | Mencurigakan | Total Terjual (period) | Detail

Menggunakan library `xlsx` yang sudah ada di project.

## 6. Hak Akses

| Role | Akses |
|---|---|
| Admin Toko | Full access |
| Operator | Full access |
| Kasir | Tidak bisa akses (hidden + blocked) |
| Anggota | Tidak bisa akses |

## 7. File yang Perlu Dibuat/Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `src/app/(protected)/toko/stock-tracking/page.tsx` | NEW | Halaman stock tracking UI |
| `src/app/api/toko/stock-tracking/products/route.ts` | NEW | API fetch produk per scope |
| `src/app/api/toko/stock-tracking/compare/route.ts` | NEW | API analisis selisih + export |
| `src/lib/constants/navigation.ts` | MODIFY | Tambah menu "Stock Tracking" di sidebar |
| `src/app/(protected)/toko/layout.tsx` | MODIFY | Tambah route guard untuk stock-tracking |

## 8. Catatan Teknis

- Deteksi mencurigakan bersifat **indikator**, bukan bukti definitif kecurangan
- Rentang waktu default 7 hari, admin bisa ubah sesuai kebutuhan
- Produk dengan `isService: true` dikecualikan (tidak punya stok fisik)
- Semua query di-scope per `unitType: "toko"` untuk data isolation
- Export Excel menggunakan stream response untuk performa pada dataset besar
- Selisih "Lebih" (fisik > sistem) juga ditampilkan meskipun bukan indikasi kecurangan — bisa jadi barang belum diinput ke sistem atau stok masuk yang belum tercatat
