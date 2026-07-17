# Mobile QA Strategy — PRIMKOPPOL (Audit Readiness, Production-Safe)

**Tanggal:** 2026-07-18
**Branch:** `railway-migration`
**Target produk:** `mobile/` (Expo 55 / RN 0.83 / v1.1.7 / versionCode 9) + `src/app/api/mobile/**` (72 route, 31 mutation)
**Sumber kontrol:** eksplorasi read-only `mobile/` + `src/app/api/mobile/` + memori `mobile-drift-audit-fase1-2026-07.md`, `hu-test-residue-cleanup.md`, `production-qa-data-safety.md`, `progress-update-mobile-app.md`, dan `git log --oneline -30`.

## 1. Tujuan

Menghasilkan rencana QA audit-readiness untuk aplikasi mobile PRIMKOPPOL: petakan risiko, susun coverage matrix, definisikan test case prioritas, automasi yang dibutuhkan, dan exit criteria rilis — **tanpa mengubah kode**. Strategi risiko-berbasis hibrida. Eksekusi mutasi berjalan terhadap **production**, sehingga seluruh pengujian harus production-amah dan setiap artefak harus dapat dibersihkan/dikembalikan.

## 2. Prinsip dan batas

### 2.1 Mobile = klien native khusus, bukan salinan penuh web

Mobile boleh punya subset fitur. Untuk fitur yang tersedia, parity wajib pada **aturan bisnis, hasil nominal/ledger, validasi, status transaksi, RBAC, dan audit trail** — bukan pixel parity. UI boleh berbeda sesuai pola mobile.

### 2.2 Role resmi

1. `operator` (top, manage_all)
2. `admin` + scope unit
3. `kasir` + scope unit/POS
4. `anggota`/member (data milik sendiri)

`admin_sp` **tidak sah secara bisnis operasional**. Per 2026-07-18 masih ada 100 referensi pada 64 file (mobile client/API/shared). Status audit:

- Dikeluarkan dari matrix QA normal.
- Sebelum penghapusan kode: inventaris akun/DB, verifikasi tidak ada akun produksi/UAT `admin_sp`, migrasi/blokir bila ditemukan.
- Selama masih ada di kode: **wajib negative security test** (token `admin_sp` ditolak pada semua route yang masih meng-grant).
- Penghapusan total menjadi remediasi terpisah di luar scope audit ini.

### 2.3 Produksi-amah

Semua pengujian berjalan terhadap production **primkoppol.site** + NeonDB production.

**Default: read-only.** Sebelum mutation:
- Persetujuan eksplisit pengguna untuk batch/skenario.
- Akun/data uji khusus bertanda (`QA-` / `test-` / NRP uji) — jangan sentuh data anggota nyata.
- Nominal minimum.
- Baseline snapshot agregat sebelum.
- Manifest artefak (record id) sebelum dan sesudah.
- Verifikasi konsistensi 4-titik: UI → API → DB/ledger → laporan web.
- **Bersihkan via void/reversal** sampai dampak bersih nol — bukan hard-delete — kecuali artefak non-ledger yang aman dan tercatat.
- Verifikasi baseline kembali (saldo, stok, piutang, billing, SHU, audit) setelah.
- Simpan audit trail untuk transparansi — jangan hapus jejak kecuali cleanup non-ledger.

**Tidak boleh di production:**
- Chaos/race/double-tap agresif, replay paksa.
- Bulk import asli, period close/tutup buku, settlement nyata.
- Transaksi nominal besar.
- Mutasi pada akun anggota nyata.

## 3. Model pengujian 4 lapisan

### Lapisan A — Statis (nol risiko data)

Audit tanpa menjalankan aplikasi:

- TypeScript mobile mandiri (repo root `tsconfig.json` saat ini `exclude: ["mobile"]` — ternilai terbuka, perlu `mobile/tsconfig.json` noEmit gate).
- ESLint mobile (saat ini tidak ada override `mobile/` di `eslint.config.mjs`).
- Secret/env exposure.
- Konsistensi route + navigasi `App.tsx` ↔ MainTabs ↔ Dashboard.
- Kontrak screen ↔ API (field, envelope, nullable, pagination).
- Role gate client (`MainTabs.tsx`, `useIdleLogout.ts`, screen guard) + server (middleware `getMobileUserWithScope`, per-route gate).
- Endpoint tanpa auth/scope.
- Mutation tanpa validasi/atomicity/idempotency.
- Versi aplikasi, `versionCode` (saat ini 9), profil EAS, konfigurasi EAS Update/submit.
- Rekonsiliasi `progress-update-mobile-app.md` (terakhir 2026-07-06) vs kode aktual (sudah lanjut ke Fase 9a.2/9a.3/9b/12b/13b/18a, v1.1.7/vc9).

### Lapisan B — Automasi business/API

Prioritas tertinggi. Default read-only; mutasi hanya persetujuan eksplisit.

**B1 Eksplorasi read-only:**
- Daftar anggota, riwayat, rekening, laporan, SHU, neraca, piutang gabungan, billing, tagihan, audit log.
- Cakupan RBAC: token role A meminta data unit B → expect 403.
- Parity response web vs mobile untuk endpoint yang sama.

**B2 Money integrity (mutasi, butuh persetujuan):**
1. Simpanan (setoran/tarik).
2. Angsuran + void.
3. Pencairan pinjaman (direct-disburse).
4. POS tunai/QRIS/potong gaji (toko + 7 unit).
5. Kas-bank create + transfer.
6. Payroll import (delete period).
7. Haji/Umrah setoran + buka rekening uji.
8. Billing/tagihan (draft → refresh → delete draft).

Setiap mutasi: manifest + baseline + verifikasi 4-titik + void/reversal cleanup + verifikasi baseline kembali.

**B3 Idempotency audit:**
- Identifikasi route tanpa `Idempotency-Key` / client requestId.
- Identifikasi route hanya andalkan flag UI (sudah ditemukan: savings-tx, loan-payment, toko POS, direct-disburse).
- Uji idempotency: POST dua kali dengan marker sama → expect 1x efek.
- **Di production: hanya 1x pasangan, marker unik, nominal minimum** bukan hammer.

**B4 RBAC:**
- Operator: akses lintas unit sesuai `manage_all`.
- Admin: unit sendiri saja (branch/unit exact match).
- Kasir: POS unit sendiri saja.
- Member: data milik sendiri saja.
- `admin_sp`: token ditolak selama cleanup belum selesai (negative test).

**B5 Contract:**
- Request field, response envelope, nullable, pagination, error status/message.
- Web vs mobile menghasilkan state final sama.

### Lapisan C — Android fisik (default read-only; mutasi butuh persetujuan)

Perangkat: 1 Android fisik. (Emulator rekomendasi lanjutan, bukan blocker.)

Critical journeys:
- Install/update build (APK terbaru sideload).
- Login/logout + idle timeout per role (`useIdleLogout.ts`: kasir nonaktif, operator/admin 30mnt, anggota 15mnt).
- Cold start/background/resume.
- Navigasi per role (bottom tab MainTabs + dashboard menu).
- Form keyboard, scroll, rotasi.
- Kamera/file picker (LoanApplication dokumen, payroll Excel).
- Push notification (butuh EAS dev client, bukan Expo Go).
- Cetak struk/share dokumen (kwitansi).
- Wi-Fi vs data seluler vs offline vs slow 2G (no NetInfo -> flag risiko offline).
- Low storage dan izin ditolak.
- Smoke test seluruh menu per role.
- Critical regression hanya workflow P0.

### Lapisan D — Reconciliasi 4-titik

```
UI confirmation → API response → DB/ledger state → web report
```

Transaksi dianggap lulus hanya jika keempat konsisten dan baseline kembali normal.

Jika tidak dapat dibersihkan aman → eskalasi pengguna, jangan tinggalkan dampak.

## 4. Risk register (prioritas)

| # | Risiko | Dampak | Layer | Catatan |
|---|--------|--------|-------|---------|
| R1 | Double-submit transaksi finansial (no Idempotency-Key, hanya flag UI) | saldo/jadwal/stok/CB ganda | A, B3, C | savings-tx, loan-payment, toko POS, direct-disburse; di prod hanya 1x pasangan marker unik |
| R2 | RBAC cross-branch/unit pada 31 route mutation; admin_sp legacy (64 file) | akses data unit lain | A, B4, C | gate audit + token uji + negative test admin_sp |
| R3 | Contract dikte UI vs response API (lesson Fase 6 T5) | data tidak tampil / crash | A, B5, C | mismatch audit + snapshot + smoke per layar |
| R4 | Void/reversal flow (angsuran, unit, store, billing) 9-step kompleks | reversal parsial → ledger rusak | B2, C | void lalu verifikasi baseline |
| R5 | Jaringan buruk/offline/timeout; tidak ada NetInfo/queue | transaksi hilang / submit ulang | A, C | audit NetInfo + flight mode |
| R6 | Parity backdate POS + operational expense (M-FEAT-032/034 web belum mobile) | divergensi data | A, B | route audit + bandingkan |
| R7 | EAS Update & submit production config kosong; OTA tidak teruji | rilis/OTA bermasalah | A | config audit |
| R8 | Audit log consistency (auditLog.create langsung vs logAuditFromRequest) | jejak tidak merata | A, B | verifikasi setiap mutation meninggalkan trail |

## 5. Coverage matrix

| Modul | A | B-Read | B-Write | C | D Reconcile |
|-------|---|-------|---------|---|-------------|
| Login/Auth | ✓ | ✓ | login uji → logout | ✓ | ✓ |
| Simpanan | ✓ | ✓ | setoran → tarik → balik/void | ✓ | 4-titik |
| Pinjaman | ✓ | ✓ | pengajuan → disburse → angsuran → void | ✓ | 4-titik |
| POS Toko | ✓ | ✓ | sale tunai/QRIS/potonggaji → void | ✓ | 4-titik |
| Unit POS (RC/CF/CL/PS/RS) | ✓ | ✓ | unit sale → void | ✓ | 4-titik |
| Kas/Bank | ✓ | ✓ | tx + transfer → balik | ✓ | 4-titik |
| Payroll | ✓ | ✓ | import uji → delete period | ✓ | 4-titik |
| Haji/Umrah | ✓ | ✓ | buka rekening uji → setoran → cleanup | ✓ | 4-titik |
| Billing/Tagihan | ✓ | ✓ | draft → refresh → delete draft | ✓ | 4-titik |
| Approval | ✓ | ✓ | approve/reject uji | ✓ | 4-titik |
| Laporan | ✓ | ✓ | read-only parity web | ✓ | bandingkan nilai |
| Aset | ✓ | ✓ | create uji → dispose → delete | ✓ | 4-titik |
| Member | ✓ | ✓ | edit uji field → revert | ✓ | 4-titik |

B-Write selalu: manifest + baseline + void/reversal cleanup + verifikasi baseline kembali.

## 6. Strategi cleanup hasil uji production

Default: jalankan script cleanup reusable (mengikuti pola `scripts/cleanup-hu-test-residue.ts`: dry-run/apply, guards, single transaction, CSV backup) setelah setiap sesi mutation.

Per modul:
- **SaleToko/UnitTransaction** mutation: void via API, bukan hard-delete.
- **Angsuran**: void via API `loan-payment-void`.
- **Simpanan tarik**: transaksi balik via API.
- **Kas/Bank**: pasangan transaksi balancing, atau hapus record uji jika non-ledger aman.
- **Billing/Tagihan**: delete draft, atau void item.
- **Produk/Anggota uji murni** (non-ledger): hard-delete jika aman + CSV backup.
- Catat ke cleanup log; simpan CSV backup sebelum hapus.

**Verifikasi akhir** (metrik agregat tetap sama sebelum sesi / setelah cleanup = bersih):
- Total Simpanan Pokok/Wajib/Sukarela.
- Saldo kas BRI + kas-bank akun.
- Total piutang pinjaman.
- Total stok barang per unit.
- Jumlah ledger/neraca aset & kewajiban.
- Total SHU / pendapatan / beban periode berjalan.
- Count transaksi voided uji (expect 0 setelah cleanup, atau konsisten baseline).
- Audit log show that void/reversal happened (transparency, not erased).

## 7. Exit criteria rilis

Rilis layak bila semua berikut terpenuhi:

1. **Layer A**: 0 Critical, 0 High terbuka. Medium didokumentasi dengan owner.
2. **RBAC matrix** 4 role (operator/admin/kasir/anggota) 100% sesuai scope; negative test `admin_sp` lolos (ditolak).
3. **Contract audit**: 0 mismatch UI–API.
4. **P0 mutation via API**: lulus idempotency + reconciliation + cleanup baseline kembali.
5. **Android fisik**: smoke semua menu per role terlewati; lifecycle + jaringan stabil; no crash; no hang.
6. **Produksi-amah**: setelah sesi, semua manifest tercatat; metrik agregat kembali ke baseline; cleanup log terisi; audit trail tersisa (void terlihat).
7. **Dokumen reconcile**: `progress-update-mobile-app.md` direkonsiliasi dengan kode; perbedaan tercatat (Fase 9a.2/9a.3/9b/12b/13b/18a + v1.1.7/vc9).

## 8. Prasyarat eksekusi

Sebelum sesi mutation pertama:

1. Seed akun uji terpisah per role (operator, admin unit, kasir unit, anggota) bertanda `QA-` jika belum ada di production (jangan pakai akun nyata).
2. Snapshot baseline DB (metrik agregat §6).
3. Siapkan script cleanup reusable (dry-run + apply) dengan guard + CSV backup, mengikuti pattern `scripts/cleanup-hu-test-residue.ts`.
4. Daftar manifest template (table: time, role, route, record id, marker, baseline, expected cleanup).
5. Konfirmasi pengguna eksplisit untuk setiap batch mutation.
6. Inventaris akun `admin_sp` di DB (sebelum negative test + sebelum remediasi penghapusan).

## 9. Out of scope

- Pixel parity web–mobile.
- Mewajibkan semua fitur web ada di mobile.
- iOS.
- Perubahan kode (audit readiness; remediasi terpisah).
- Transaksi production nominal besar/nyata.
- Chaos/race/bulk/period-close/settlement test di production.
- Penghapusan kode role `admin_sp` (remediasi terpisah).
