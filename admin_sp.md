# Admin SP (Simpan Pinjam) — Dokumen Fitur & Audit

> Role: `admin_sp` | Display: "Admin Simpan Pinjam" | Unit: `simpan_pinjam`
> Audit date: 07 Mei 2026

---

## Fitur Utama (sesuai permintaan atasan)

### 1. Simpanan
**Status: FULL ACCESS**

| Sub-fitur | Route | API Access | Nav Menu |
|-----------|-------|------------|----------|
| Rekening Anggota | `/simpanan/rekening` | PASS | PASS |
| Transaksi Simpanan | `/simpanan/transaksi` | PASS | PASS |
| Rekap Simpanan | `/simpanan/rekap` | PASS | PASS |

**Kemampuan admin_sp:**
- Lihat semua rekening simpanan anggota (Pokok, Wajib, Sukarela)
- Buat/setor/tarik simpanan
- Override saldo simpanan
- Import TAJIB dari Excel
- Lihat rekap simpanan per periode

### 2. Pinjaman
**Status: FULL ACCESS**

| Sub-fitur | Route | API Access | Nav Menu |
|-----------|-------|------------|----------|
| Pengajuan Pinjaman | `/pinjaman/pengajuan` | PASS | PASS |
| Daftar Pinjaman | `/pinjaman` | PASS | PASS |
| Angsuran | `/pinjaman/angsuran` | PASS | PASS |
| Jadwal Angsuran | `/pinjaman/jadwal` | PASS | PASS |
| Laporan Jasa | `/pinjaman/laporan-jasa` | PASS | PASS |

**Kemampuan admin_sp:**
- Buat pengajuan pinjaman baru (Reguler/Khusus)
- Approve/reject pengajuan
- Pencairan pinjaman (disburse)
- Catat pembayaran angsuran
- Void pinjaman
- Kompen pencairan
- Lihat jadwal angsuran
- Laporan bunga/jasa per bulan + export

**Tidak tersedia (intentional — operator only):**
- Direct disburse (backdating) — butuh permission `manage_all`
- Import migrasi pinjaman — tool satu kali
- Purge/penghapusan massal — tool destruktif

### 3. Kwitansi
**Status: FULL ACCESS**

| Sub-fitur | Route | API Access | Nav Menu |
|-----------|-------|------------|----------|
| Daftar Kwitansi | `/kwitansi` | PASS | PASS |
| Buat Kwitansi | `/kwitansi/tambah` | PASS | PASS |
| Edit Kwitansi | `/kwitansi/[id]/edit` | PASS | PASS |
| Cetak Kwitansi | `/kwitansi/[id]/cetak` | PASS | PASS |

**Kemampuan admin_sp:**
- CRUD kwitansi penerimaan/pengeluaran
- Cetak kwitansi (thermal + A4)
- Lihat riwayat kwitansi

---

## Fitur Tambahan (tersedia di navigasi)

### Kas & Bank
| Sub-fitur | Route |
|-----------|-------|
| Buku Kas | `/kas-bank/buku-kas` |
| Transaksi Kas | `/kas-bank/transaksi-kas` |
| Transaksi Bank | `/kas-bank/transaksi-bank` |
| Transfer | `/kas-bank/transfer` |
| Non SP (Penerimaan) | `/non-sp/penerimaan` |
| Non SP (Pengeluaran) | `/non-sp/pengeluaran` |

### Akuntansi
| Sub-fitur | Route |
|-----------|-------|
| Buku Besar | `/jurnal/buku-besar` |
| Jurnal Umum | `/jurnal/jurnal-umum` |
| Jurnal Penyesuaian | `/jurnal/jurnal-penyesuaian` |
| Neraca | `/laporan/neraca` |
| Laba Rugi | `/laporan/laba-rugi` |
| Arus Kas | `/laporan/arus-kas` |
| SHU | `/laporan/shu` |
| Rekap Simpanan | `/laporan/rekap-simpanan` |
| Rekap Pinjaman | `/laporan/rekap-pinjaman` |
| Faktur Potongan | `/laporan/faktur-potongan` |
| Piutang Gabungan | `/laporan/piutang-gabungan` |

### Anggota
| Sub-fitur | Route |
|-----------|-------|
| Daftar Anggota | `/anggota` |
| Kartu Anggota | `/anggota/kartu` |
| Buku Anggota | `/anggota/buku` |

### Approval
| Sub-fitur | Route |
|-----------|-------|
| Inbox Approval | `/approval` |

### Komunikasi
| Sub-fitur | Route |
|-----------|-------|
| Pengumuman | `/pengumuman` |

---

## Yang TIDAK Tersedia (blocked by design)

| Area | Alasan |
|------|--------|
| `/master/*` (Import Data, User Management) | Operator only |
| `/gaji` (Payroll) | Operator only |
| `/toko`, `/cuci-mobil`, dsb. (POS Unit) | Unit isolation |
| `/audit-log` | Sebelumnya operator only — **sudah ditambahkan** (commit `cd95122`) |
| `/periode` (Periode/SHU) | Operator only |

---

## Konfigurasi Teknis

### Seed Permissions
```
view_dashboard, manage_anggota, view_anggota,
manage_simpanan, view_simpanan,
manage_pinjaman, view_pinjaman, approve_pinjaman,
manage_kas_bank, view_jurnal, view_laporan,
approve_transactions, manage_unit_transactions,
manage_pengumuman
```

### Route Guard
- **Server-side** (`src/proxy.ts`): admin_sp di-exempt dari unit isolation block
- **Client-side** (`layout.tsx`): `ADMIN_SP_ALLOWED_ROUTES` whitelist aktif

### Akun Default
- Email: `adminsp@koperasi.com`
- Unit: `simpan_pinjam`
- Script buat: `scripts/create-admin-sp.ts`

---

## Audit Hasil Review Kode

| Aspek | Status | Catatan |
|-------|--------|---------|
| Simpanan API | PASS | Semua endpoint terbuka untuk admin_sp |
| Pinjaman API | PASS | `["operator", "admin_sp"]` eksklusif |
| Kwitansi API | PASS | Dalam ALLOWED_ROLES |
| Kas-Bank API | PASS | Dalam ALLOWED_ROLES |
| Jurnal API | PASS | Dalam ALLOWED_ROLES |
| Laporan API | PASS | Neraca, Laba Rugi, Arus Kas — semua termasuk admin_sp |
| Member API | PASS | CRUD anggota tersedia |
| Approval API | PASS | admin_sp = operator-level |
| Audit Log API | PASS | Baru ditambahkan Mei 2026 |
| Mobile API | PASS | 26+ endpoint mobile menyertakan admin_sp |
| Navigation/Sidebar | PASS | Menu lengkap untuk semua fitur SP |
| Route Guards | PASS | Server + client side OK |
| Auto-logout (web) | 1 jam | Default — konsisten dengan admin biasa |
| Auto-logout (mobile) | 30 menit | Sama seperti operator |
| Dashboard | PASS | Menampilkan dashboard operator-style dengan stats SP |

### Temuan: Tidak ada blocker
Semua 3 fitur utama (Simpanan, Pinjaman, Kwitansi) berfungsi penuh untuk role admin_sp.
Tidak ditemukan bug, gap akses, atau kode yang rusak terkait admin_sp.
