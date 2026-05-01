# Pagination Implementation Tracker

> **Dokumen ini melacak progress implementasi server-side pagination di seluruh aplikasi.**
> Dimulai: 1 Mei 2026
> Prinsip: Paginasi untuk tabel display, export/print tetap mengakses semua data.

---

## Arsitektur Pagination

### Pattern yang Digunakan
- **Tabel Display**: API dengan `skip/take/count` → response `{ data, pagination: { page, perPage, total, totalPages } }`
- **Export/Print**: Endpoint terpisah (pattern: `/api/.../export`) atau fetch all data saat tombol export diklik
- **Komponen**: DataTable sudah support client-side pagination — cukup kirim data per-page

### Reference Pattern (Best Practice)
- API: `src/app/api/loans/route.ts` — skip/take/count dengan `paginationSchema`
- Export: `src/app/api/loans/reports/interest/export/route.ts` — dedicated server-side export
- Schema: `src/lib/validations/index.ts` — `paginationSchema` dengan default perPage=15

---

## Fase 1: Buku Kas + Jurnal Umum

| # | Halaman | API Route | Frontend | Export Risk | Status |
|---|---------|-----------|----------|-------------|--------|
| 1.1 | Buku Kas | `api/cash-bank/book/route.ts` | `kas-bank/buku-kas/page.tsx` | HIGH (Excel + Print) | ✅ Done |
| 1.2 | Jurnal Umum | `api/journals/route.ts` | `jurnal/umum/page.tsx` | LOW (no export) | ✅ Done |

**Catatan Buku Kas**: Application-level pagination (running balance computed cumulatively). Export via `?export=true`.
**Catatan Jurnal Umum**: Opt-in pagination (backward compatible). Frontend redesigned as list + dialog form.

---

## Fase 2: Riwayat Transaksi Unit

| # | Halaman | API Route | Frontend | Export Risk | Status |
|---|---------|-----------|----------|-------------|--------|
| 2.1 | Riwayat Transaksi | `api/unit-transactions/route.ts` | `transaksi-unit/riwayat/page.tsx` | HIGH (Excel + PDF + Print) | ✅ Done |
| 2.2 | Laporan Unit | `api/unit/[slug]/laporan/route.ts` | `unit/[unitSlug]/laporan/page.tsx` | HIGH (Excel + Print) | ✅ Done |

**Catatan 2.1**: Merge pagination — fetch limit per tabel, merge+slice. Export via `?export=true`. DataTable `manualPagination`.
**Catatan 2.2**: Transaction list paginated (default 50). Summary/expenses tetap lengkap. Export fetch all via `?export=true`.

---

## Fase 3: Toko Sales + Products

| # | Halaman | API Route | Frontend | Export Risk | Status |
|---|---------|-----------|----------|-------------|--------|
| 3.1 | Toko Sales History | `api/toko/sales/route.ts` | `toko/riwayat/page.tsx` | MEDIUM (reprint receipt) | ✅ Done |
| 3.2 | Toko Products | `api/toko/products/route.ts` | `toko/produk/page.tsx` | LOW (no export) | ✅ Done |
| 3.3 | Toko Movements | `api/toko/movements/route.ts` | `toko/persediaan/page.tsx` | LOW (no export) | ✅ Done |

**Catatan 3.1**: Server-side search + filters. Stats from separate endpoint. Debounced search.
**Catatan 3.2**: Backward-compatible opt-in pagination. 13+ kasir consumers unaffected.
**Catatan 3.3**: Server-side type filter. All refresh ops preserve pagination state.

---

## Fase 4: Laporan & Approval

| # | Halaman | API Route | Frontend | Export Risk | Status |
|---|---------|-----------|----------|-------------|--------|
| 4.1 | Laporan SHU | `api/reports/shu/route.ts` | `laporan/shu/page.tsx` | HIGH (Excel + PDF + Print) | ✅ Done |
| 4.2 | Rekap Anggota | `api/reports/members-recap/route.ts` | `laporan/rekap-anggota/page.tsx` | HIGH (Excel + PDF) | ✅ Done |
| 4.3 | Faktur Potongan | `api/reports/faktur-potongan/route.ts` | `laporan/faktur-potongan/page.tsx` | MEDIUM (Print) | ✅ Done |
| 4.4 | Approvals | `api/approvals/route.ts` | `approval/page.tsx` | LOW (no export) | ✅ Done |

**Catatan 4.1**: Memory-level pagination (SHU calculator must compute all at once). Print/Excel/PDF fetch via `?export=true`.
**Catatan 4.2**: Database-level pagination (Prisma skip/take). Export fetch all via `?export=true`.
**Catatan 4.3**: Application-level pagination (cross-references built first, then sliced). Print fetch all via `?export=true`.
**Catatan 4.4**: Two-source merge (loan approvals + void requests), sorted then sliced. Per-tab pagination state. Summary counts from separate DB count queries.

---

## Changelog

| Tanggal | Fase | Perubahan |
|---|---|---|
| 2026-05-01 | 1 | Fase 1 selesai: Buku Kas + Jurnal Umum pagination (commit `4f1196f`) |
| 2026-05-01 | 2 | Fase 2 selesai: Riwayat Transaksi + Laporan Unit pagination (commit `c39c2ac`) |
| 2026-05-01 | 3 | Fase 3 selesai: Toko Sales + Products + Movements pagination (commit `16b5d6a`) |
| 2026-05-01 | 4 | Fase 4 selesai: Laporan SHU + Rekap Anggota + Faktur Potongan + Approvals pagination |
