# Modul SIMPANAN — Fitur & Bug Fix Log

> Branch: `railway-migration` | Updated: 2 Juni 2026

---

## 1. Fitur Utama

### Operator

| Fitur | Route | Deskripsi |
|-------|-------|-----------|
| Setoran & Penarikan | `/simpanan/transaksi/tambah` | Form dengan live autocomplete (NRP/Nama, debounce 350ms), auto-show saldo, kas/bank dropdown |
| Double-Entry Accounting | Backend | Setoran → `SavingsAccount` + `CashBankTransaction(in)`. Penarikan → kurangi saldo + `CashBankTransaction(out)`. Atomic via `prisma.$transaction` |
| Override Saldo | `/anggota/[id]/edit` | Edit saldo Pokok/Wajib/Sukarela real-time → auto-create "Nota Koreksi" di SavingsTransaction |
| Edit & Delete Mutasi | `/api/savings/transactions/[id]` | PUT/DELETE dengan anti-negative balance guard. Nama & produk read-only saat edit |
| Import TAJIB (Excel) | Backend | Auto-detect kolom saldo terakhir, setoran per bulan, generate rekening unik (PKK/WJB/SKR-xxx) |
| Cetak Laporan | `/laporan/rekap-simpanan` | PDF/Excel rekap simpanan dengan Grand Total utuh |
| Full CRUD Rekening | `/simpanan/rekening` | Edit nomor rekening + tanggal buka. Shortcut ke rincian transaksi per anggota |
| Akun Kas Terpisah | Schema | `KAS-JATIM-SIM` (tunai) + `BNK-JATIM-SIM` (bank) — pemisahan operasional toko vs simpan pinjam |

### Anggota (Portal & Mobile)

| Fitur | Deskripsi |
|-------|-----------|
| Rincian Tabungan Bulanan | Accordion per produk (Wajib/Sukarela): setoran per bulan + saldo awal akumulasi |
| Single Source of Truth | Saldo 100% dari `SavingsAccount.balance`, bukan legacy `Member.tabunganWajib` |
| Voided Filtering | Transaksi voided disaring di backend, tampil blok abu-abu di portal |

---

## 2. Bug Fixes (All Resolved)

| ID | Severity | Bug | Fix |
|---|----------|-----|-----|
| GHOST-001 | HIGH | Ghost balance saat saldo Wajib di-override ke 0 — fallback ke legacy data | Hapus guard `&& Number(acc.balance) > 0`, cek `wajibAccount` exist (truthy) |
| GHOST-002 | MEDIUM | Portal tidak tampilkan transaksi "Koreksi" & "Tarikan" | Hapus filter eksklusif `deposit` — semua tipe (kecuali Saldo Awal) ditampilkan. Label: `⚠ KOREKSI`, `↩ PENARIKAN` |
| GHOST-003 | HIGH | Override saldo gagal diam-diam jika rekening belum ada | Auto-create rekening baru (PKK/WJB/SKR-xxx) saat belum ada |
| SIMPANAN-001 | HIGH | Tombol "Simpan" tidak merespon saat penarikan Sukarela | Hapus `required` pada Radix Select (silent HTML5 validation) → ganti manual validation dengan toast error |

### Kebijakan AD-ART (Pasal 26)
- Simpanan **Pokok** & **Wajib**: opsi Penarikan di-lock (disabled) di form. Backend juga memblokir.
- Simpanan **Sukarela**: bebas setor/tarik.

---

## 3. Key Source Files

| File | Fungsi |
|------|--------|
| `src/app/api/savings/transactions/route.ts` | POST setoran/penarikan — atomic CB integration |
| `src/app/api/savings/transactions/[id]/route.ts` | PUT/DELETE mutasi — anti-negative balance |
| `src/app/api/savings/accounts/[id]/route.ts` | PUT rekening (accountNo, openedDate, status) |
| `src/app/api/members/[id]/route.ts` | Override saldo — auto-create rekening jika belum ada |
| `src/app/api/member-portal/summary/route.ts` | Portal summary — single source of truth |
| `src/app/(protected)/simpanan/transaksi/tambah/page.tsx` | Form setoran/penarikan |
| `src/app/(protected)/simpanan/rekening/page.tsx` | CRUD rekening |
| `src/app/portal/simpanan/page.tsx` | Portal rincian tabungan bulanan |

*Diperbarui: 2 Juni 2026*
