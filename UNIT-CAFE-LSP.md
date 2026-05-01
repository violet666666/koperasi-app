# Dokumentasi Unit Cafe LSP

> **Status:** PHASE 1 SELESAI ✅  
> **Tanggal:** 1 Mei 2026  
> **unitType:** `cafe_lsp`  
> **Referensi Terkait:** `UNIT-CAFE-RESTO.md`, `UNIT-TOKO.md`

---

## 1. Ringkasan

Unit **Cafe LSP** adalah unit F&B counter-based (tanpa meja dine-in). Pelanggan order di counter, menerima nomor antrian, dan mengambil pesanan saat dipanggil.

### Jalur Sistem
- **Jalur 2: Retail/F&B (StoreSale)** — sama dengan Toko dan Resto
- DB: `StoreSale` + `StoreSaleItem` + `StoreProduct`
- API: `/api/toko/sales` dengan `unitType=cafe_lsp`

---

## 2. Fitur POS

| Fitur | File | Status |
|---|---|---|
| POS Counter-based (grid visual) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Filter kategori + search | `cafe-lsp/kasir/page.tsx` | ✅ |
| Tampilan foto menu (imageUrl) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Quick Keys (★ tab best sellers) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Notes per item (max 60 char) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Nomor Antrian Otomatis (A001-A999) | `cafe-lsp/kasir/page.tsx` | ✅ |
| 3 Metode bayar (Tunai/QRIS/Potong Gaji) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Validasi plafon piutang | `cafe-lsp/kasir/page.tsx` | ✅ |
| Validasi stok sebelum checkout | `cafe-lsp/kasir/page.tsx` | ✅ |
| Shift validation + lock checkout | `cafe-lsp/kasir/page.tsx` | ✅ |
| shiftId auto-attach | `cafe-lsp/kasir/page.tsx` | ✅ |
| Order Queue Panel (di POS) | `cafe-lsp/kasir/page.tsx` | ✅ |
| Order Queue Board (full page) | `cafe-lsp/antrian/page.tsx` | ✅ |
| Struk Receipt 80mm | `receipt-primkopol.tsx` | ✅ |
| Zustand state (persist localStorage) | `cafe-lsp/kasir/page.tsx` | ✅ |

---

## 3. Role & Akses

### Kasir

| Fitur | Link |
|---|---|
| POS Cafe LSP | `/cafe-lsp/kasir` |
| Order Queue | `/cafe-lsp/antrian` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |

### Admin

| Fitur | Link |
|---|---|
| POS Cafe LSP | `/cafe-lsp/kasir` |
| Order Queue | `/cafe-lsp/antrian` |
| Manajemen Menu | `/cafe-lsp/produk` |
| Promo & Diskon | `/cafe-lsp/marketing` |
| Persediaan & Stok | `/cafe-lsp/persediaan` |
| Shift Kasir | `/cafe-lsp/shift` |
| Riwayat Penjualan | `/transaksi-unit/riwayat?unitType=cafe_lsp` |
| Laporan Penjualan | `/unit/cafe-lsp/laporan` |
| Inbox Approval | `/approval` |

---

## 4. Akun

| Role | Email | Password |
|---|---|---|
| Admin | `admincafelsp@koperasi.com` | `password123` |
| Kasir | `kasircafelsp@koperasi.com` | `password123` |

---

## 5. Arsitektur: Wrapper Pages

```
/cafe-lsp/kasir/page.tsx     → DEDICATED POS (counter-based)
/cafe-lsp/antrian/page.tsx   → DEDICATED Order Queue Board
/cafe-lsp/produk/page.tsx    → Wrapper → TokoProdukPage
/cafe-lsp/shift/page.tsx     → Wrapper → TokoShiftPage
/cafe-lsp/marketing/page.tsx  → Wrapper → TokoMarketingPage
/cafe-lsp/persediaan/page.tsx → Wrapper → TokoPersediaanPage
```

---

## 6. Perbedaan dengan Resto Latar

| Aspek | Resto Latar | Cafe LSP |
|---|---|---|
| **Tipe** | Dine-in + Takeaway | Counter-based |
| **Denah Meja** | ✅ 12 meja + takeaway | ❌ Tidak ada |
| **Nomor Antrian** | ❌ | ✅ A001-A999 |
| **Quick Keys** | ❌ | ✅ Tab ★ Quick |
| **Order Queue** | ❌ | ✅ Panel + Board |
| **Shift Lock** | ⚠️ Warning saja | ✅ Lock checkout |
| **shiftId** | ⚠️ Tidak terkirim | ✅ Auto-attach |
| **API** | `/api/toko/sales` | `/api/toko/sales` (shared) |

---

## 7. File-File Terkait

| File | Fungsi |
|---|---|
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | POS Dedicated counter-based |
| `src/app/(protected)/cafe-lsp/antrian/page.tsx` | Order Queue Board |
| `src/app/(protected)/cafe-lsp/produk/page.tsx` | Wrapper → TokoProdukPage |
| `src/app/(protected)/cafe-lsp/shift/page.tsx` | Wrapper → TokoShiftPage |
| `src/app/(protected)/cafe-lsp/marketing/page.tsx` | Wrapper → TokoMarketingPage |
| `src/app/(protected)/cafe-lsp/persediaan/page.tsx` | Wrapper → TokoPersediaanPage |
| `src/lib/constants/navigation.ts` | `kasirCafeLspNavigation` + `adminCafeLspNavigation` |
| `src/app/(protected)/layout.tsx` | Route guard `cafe_lsp` |
| `src/components/patterns/kasir-dashboard.tsx` | Dashboard POS route |
| `src/app/api/toko/sales/route.ts` | API checkout (shared) |
| `src/app/api/toko/products/route.ts` | API produk (filter by unitType) |
| `prisma/seed-cafe-lsp.ts` | Seed script khusus Cafe LSP |

---

## 8. Roadmap Selanjutnya

### Phase 2: Fitur Lanjutan 🟡
- Kitchen Display System (KDS) real hardware
- Split bill (1 order → 2+ metode bayar)
- Laporan per menu terlaris per periode
- Manajemen menu dinamis (admin set Quick Keys berdasarkan data penjualan)

### Phase 3: Mobile 🟢
- Mobile POS khusus Cafe LSP (counter-based dari HP)
- Notifikasi antrian ke pelanggan (opsional)

---

*Dokumen ini adalah referensi utama untuk Unit Cafe LSP. Untuk Cafe & Resto Latar, lihat `UNIT-CAFE-RESTO.md`. Untuk Toko, lihat `UNIT-TOKO.md`.*

---

### Changelog — 1 Mei 2026
- **[INIT]** Unit Cafe LSP dibuat — dedicated counter-based POS
- **[POS]** Grid visual menu + filter kategori + search + foto
- **[POS]** Quick Keys tab (★) untuk best sellers
- **[POS]** Nomor antrian otomatis (A001-A999) per hari
- **[POS]** Order Queue Panel di bawah POS + Queue Board page terpisah
- **[POS]** Notes per item (max 60 char)
- **[POS]** 3 metode bayar: Tunai, QRIS, Potong Gaji
- **[POS]** Shift validation dengan `unitType=cafe_lsp` + lock checkout
- **[POS]** shiftId auto-attach ke transaksi
- **[NAV]** `kasirCafeLspNavigation` + `adminCafeLspNavigation`
- **[ROUTE]** Route guard kasir + admin untuk `cafe_lsp`
- **[SEED]** Akun `admincafelsp@koperasi.com` + `kasircafelsp@koperasi.com`
- **[WRAPPER]** produk, shift, marketing, persediaan reuse komponen Toko