# Design Spec: Rekap Jasa Pinjaman Per Bulan

**Date:** 30 April 2026
**Status:** Approved

## Problem

Atasan membutuhkan laporan yang menunjukkan **berapa total jasa (bunga) pinjaman yang berhasil terkumpul dari pembayaran angsuran tiap bulannya**. Data pokok dan jasa sudah tercatat terpisah di setiap `LoanPayment` (field `interestPortion` dan `principalPortion`), namun belum ada halaman yang merangkumnya per bulan.

## Scope

- Halaman baru `/pinjaman/laporan-jasa` di menu Pinjaman (operator only)
- API endpoint baru `GET /api/loans/reports/interest`
- Filter periode bulan, export Excel, cetak PDF
- Hanya membaca data yang sudah ada — tidak ada perubahan schema

## Data Source

Setiap pembayaran angsuran sudah menyimpan:
- `LoanPayment.interestPortion` — jasa/bunga yang terbayar
- `LoanPayment.principalPortion` — pokok yang terbayar
- `LoanPayment.paymentDate` — tanggal pembayaran
- `LoanPayment.paymentType` — `installment` atau `early_settlement`

CashBankTransaction juga sudah mencatat `category: "jasa_pinjaman"` dan `"angsuran_pokok"` secara terpisah.

## API Design

### Endpoint: `GET /api/loans/reports/interest`

**Auth:** Operator only.

**Query Parameters:**
| Param | Format | Default | Description |
|---|---|---|---|
| `monthFrom` | `YYYY-MM` | Bulan ini | Awal periode |
| `monthTo` | `YYYY-MM` | Bulan ini | Akhir periode |

**Response:**
```json
{
  "data": [
    {
      "month": "2026-01",
      "monthLabel": "Januari 2026",
      "totalJasa": 1200000,
      "totalPokok": 12000000,
      "totalTransactions": 30
    }
  ],
  "summary": {
    "grandTotalJasa": 4500000,
    "grandTotalPokok": 45000000,
    "grandTotalTransactions": 120
  }
}
```

**Implementation:**
- Query `LoanPayment` with `paymentDate` between first day of `monthFrom` and last day of `monthTo`
- Group by month using `DATE_TRUNC('month', paymentDate)` equivalent in Prisma (raw query or JS grouping)
- Include both `installment` and `early_settlement` payment types
- Return sorted ascending by month

### Endpoint: `GET /api/loans/reports/interest/export`

**Auth:** Operator only.

**Query Parameters:** Same as above.

**Response:** Excel file (.xlsx) download.

**Columns:**
| No | Bulan | Total Jasa (Rp) | Total Pokok (Rp) | Jumlah Transaksi |
|---|---|---|---|---|

Last row: Grand Total.

## UI Design

### Route: `/pinjaman/laporan-jasa`

**Layout:**
1. **Page header** — "Rekap Jasa Pinjaman Per Bulan"
2. **Filter bar** — 2 dropdown bulan (from/to) + tombol refresh
3. **3 Summary cards** — Total Jasa, Total Pokok, Jumlah Transaksi (grand total periode)
4. **Action buttons** — Export Excel + Cetak PDF
5. **Data table** — Bulan, Jasa Terbayar, Pokok Terbayar, Jumlah Transaksi + baris TOTAL footer
6. **Empty state** — "Belum ada pembayaran angsuran di periode ini"

### Navigation

Menu "Laporan Jasa" ditambahkan di `mainNavigation` (sidebar Operator) di bawah group Pinjaman, sebelum atau sesudah menu yang sudah ada.

### Role Access

Hanya `operator` yang bisa mengakses halaman ini. Redirect ke dashboard jika role lain mencoba akses.

### Export Excel

Menggunakan `xlsx` library yang sudah ada di project. Format sama dengan tabel UI. Nama file: `Rekap_Jasa_Pinjaman_YYYY-MM.xlsx`.

### Cetak PDF

Menggunakan browser print (`window.print()`) dengan layout yang sudah di-style untuk kertas A4. Header berisi judul laporan, periode, dan tanggal cetak.

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/app/api/loans/reports/interest/route.ts` | CREATE | API endpoint GET rekap jasa per bulan |
| `src/app/api/loans/reports/interest/export/route.ts` | CREATE | API endpoint GET export Excel |
| `src/app/(protected)/pinjaman/laporan-jasa/page.tsx` | CREATE | Halaman rekap jasa UI |
| `src/lib/constants/navigation.ts` | MODIFY | Tambah menu "Laporan Jasa" di mainNavigation |

## Out of Scope

- Detail per anggota (bisa ditambah nanti jika diminta)
- Grafik/chart (bisa ditambah nanti)
- Laporan tahunan (bisa ditambah nanti)
- SHU calculation (terpisah, sudah ada sistem sendiri)
