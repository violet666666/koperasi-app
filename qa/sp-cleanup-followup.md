# SP Import — Cleanup & Import Juli 2026 (Followup Notes)

> Sesi: 2026-07-29. Branch: `railway-migration`. Tindakan production sudah dijalankan; item di bawah butuh keputusan/follow-up manual.

## Sudah dikerjakan (production)
1. **Cleanup 149 duplikat SP-MGR** — hapus loan+schedule+application (phantom import-migrasi 25 Jul). Backup: `qa/sp-mgr-cleanup-backup.csv`. Active 439→290, multi-active 154→10.
2. **Guard import-migrasi** (`api/loans/import-migrasi/route.ts`) — tolak re-run jika `SP-MGR/` sudah ada.
3. **Import GAJI Juli** (`scripts/import-sp-juli.ts`) — 152 loan update sisa, 143 pembayaran Juli (Rp 138.299.000), 4 paid_off, 0 duplikat.

## ⚠️ Butuh keputusan manual

### 1. RUDI HARTONO — refinance (di-skip, BELUM disentuh)
- NRP `79031257` | member id `910` | loan `SP-IMP/0046/PRIM/V/2026`
- DB saat ini: pokok 50jt, **sisa 6.236.000**, status active, tgl 2023-01-09
- File Juli (GAJI): pokok 50jt, **sisa 47.916.000**, TOTJUN=42 → TOTJUL=2 (reset), JUMLAH 2.084.000
- Interpretasi: pinjaman lama hampir lunas, lalu ada pinjaman baru 50jt (baru 2 blm).
- **Pilihan:**
  - (a) Tandai `SP-IMP/0046` = paid_off + buat pinjaman baru 50jt sisa 47.916.000 → jika benar refinance.
  - (b) Biarkan sisa 6.236.000 → jika data file Juli salah untuk RUDI.
- Script untuk (a) bisa dibuat saat dikonfirmasi.

### 2. UI "Import VS SP" rusak untuk file format baru (P0, bug terpisah)
- File 2026 baru menambah kolom `N(13)=TOTAL JULI` → `SISA SALDO` geser dari O(14) ke **P(15)**.
- Helper `src/lib/import-vs-sp-helpers.ts` COL masih `JUMLAH_SD:13, SISA_SALDO:14` (format lama).
- Akibat: route `api/loans/import-vs-sp` membaca **jumlah kumulatif dibayar (col O) sebagai sisa** → corrupt `principalOutstanding` jika dipakai lewat UI.
- Import Juli lewat UI = bahaya; sudah ditangani via `scripts/import-sp-juli.ts` dgn COL override lokal.
- **Fix yang direkomendasikan:** deteksi kolom SISA/JUMLAH dinamis dari header (scan "SISA SALDO" di row header), fallback ke COL lama. Tambah regression test. Belum diimplementasi di helper shared — menunggu fix terdedikasi.

### 3. 10 member masih multi-active loan (issue terpisah)
- Setelah cleanup SP-MGR, masih 10 member punya >1 active loan di prefix `PJM-2026-*` / `SP-IMP-*` (bukan SP-MGR).
- Kemungkinan duplikat antar-import atau pinjaman ganda legit.
- **Aksi:** jalankan `scripts/diagnose-sp-double.ts` ulang untuk list 10 member, review manual apakah duplikat atau legit.

## Artifacts
- `scripts/cleanup-sp-mgr-duplicates.ts` — cleanup reusable (self-guarding)
- `scripts/diagnose-sp-double.ts` — deteksi loan ganda (read-only)
- `scripts/diagnose-sp-cleanup-scope.ts` — scope cleanup (read-only + CSV backup)
- `scripts/import-sp-juli.ts` — import GAJI via vs_sp logic (preview/commit, anomaly guard)
- `qa/sp-mgr-cleanup-backup.csv` — audit trail 149 loan
- `qa/sp-juli-preview.json` — preview import Juli
