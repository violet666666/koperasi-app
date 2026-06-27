# Laporan: Beban Biaya yang Masuk Perhitungan SHU — PRIMKOPPOL 2026

> Disiapkan untuk presentasi ke pengurus/atasan
> Periode: **Tahun 2026** (Januari–Juni, YTD) · Sumber: database produksi (Neon)
> Dihitung dengan kalkulator SHU kanonik aplikasi (`/laporan/shu`) — angka 100% sama dengan layar

---

## 1. Inti jawaban: 5 kategori beban yang mengurangi SHU

Rumus SHU:

```
SHU BERSIH = TOTAL PENDAPATAN − TOTAL BEBAN
```

Beban dihitung dari semua pengeluaruan kas (**Kas Keluar**, `type = out`) yang **bukan** termasuk pengecualian. Berikut **5 kategori beban yang MASUK** perhitungan SHU:

| # | Kelompok | Kode Akun | Nama Beban | Asal Data |
|---|----------|-----------|-----------|-----------|
| 1 | Beban Operasional Umum | `CB-OP` | Biaya Operasional Umum | Kas Keluar kategori `biaya_operasional` |
| 2 | Beban Operasional Umum | `CB-OPS` | Biaya Operasional (Legacy) | Kas Keluar kategori `operational` |
| 3 | Beban Operasional Umum | `CW-SHU` | Beban SHU Cuci Mobil | Otomatis Rp 2.000 per transaksi cuci mobil |
| 4 | Beban Unit Usaha | `CB-UNIT` | Beban Operasional Unit Usaha | Kas Keluar kategori `beban_unit` |
| 5 | Beban Unit Usaha | `CB-HPP` | HPP / Pembelian Barang (Restocking) | Kas Keluar `hpp_toko` + HPP item toko |

### Yang TIDAK masuk SHU (dikecualikan)
`pencairan_pinjaman` · `transfer` · `savings` · `simpanan_pokok/wajib/sukarela` · `angsuran_pokok` · `void_penjualan_toko` · `void_unit_transaction` · `pendapatan_unit` · `jasa_pinjaman` · `dana_resiko` · `penalti_pelunasan` · `lainnya`

> Alasan: bukan beban riil (hanya gerak dana/pencairan pinjaman/pengembalian simpanan), atau justru merupakan *pendapatan*, atau berisiko dobel-hit. Kategori `lainnya` sengaja dikecualikan agar pendapatan/beban non-operasional tidak memperbesar/memperkecil SHU secara tidak wajar.

---

## 2. Ringkasan keuangan 2026 (YTD)

| Komponen | Nominal |
|----------|--------:|
| **Total Pendapatan** | **Rp 615.092.400** |
| **Total Beban** | **Rp 1.176.076.527** |
| **SHU Bersih (Net Surplus)** | **Rp 0** ⚠️ |
| Anggota Aktif | 828 |

> ⚠️ **SHU Bersih = Rp 0** karena beban (Rp 1,17 M) melebihi pendapatan (Rp 615 jt). **Namun setelah ditelusuri, sebagian besar beban ini adalah transaksi salah kategori — bukan kerugian riil.** Lihat **Bagian 5**.

---

## 3. Breakdown Total Beban Rp 1.176.076.527

### 3a. Per kategori (dengan jumlah transaksi)

| Kelompok | Kategori DB | Jumlah Tx | Nominal | % Beban |
|----------|-------------|----------:|--------:|--------:|
| Beban Op. Umum | `biaya_operasional` (CB-OP) | 105 | Rp 904.850.207 | **76,9%** |
| Beban Op. Umum | `operational` (CB-OPS) | 304 | Rp 207.507.020 | 17,6% |
| Beban Op. Umum | SHU Cuci Mobil (CW-SHU) | 253 | Rp 506.000 | 0,04% |
| Beban Unit Usaha | `beban_unit` (CB-UNIT) | 11 | Rp 61.263.300 | 5,2% |
| Beban Unit Usaha | `hpp_toko` (CB-HPP) | 1 | Rp 1.950.000 | 0,2% |

### 3b. Per bulan (tren)

| Bulan | Beban | Catatan |
|-------|------:|---------|
| April 2026 | Rp 738.072.165 | ⚠️ Memuat penarikan BRI Rp 500 jt (lihat Bagian 5) |
| Mei 2026 | Rp 357.887.286 | ⚠️ Memuat tarik tunai Rp 100 jt |
| Juni 2026 | Rp 79.611.076 | Beban operasional normal |

### 3c. Per unit (kemana beban dibebankan)

| Unit | Jumlah Tx | Beban |
|------|----------:|------:|
| Umum (belum dialokasi) | 110 | Rp 931.245.032 |
| Toko | 152 | Rp 191.922.720 |
| Simpan Pinjam | 3 | Rp 32.000.000 |
| Cuci Mobil | 90 | Rp 11.813.000 |
| Cafe LSP | 58 | Rp 3.071.300 |
| Resto | 5 | Rp 1.543.000 |

---

## 4. Top 10 transaksi beban terbesar (contoh konkret)

| # | Tanggal | Nominal | Kategori | Keterangan |
|---|---------|--------:|----------|-----------|
| 1 | 29-Apr | Rp 500.000.000 | biaya_operasional | 🚨 "ambil kas bri" |
| 2 | 18-Mei | Rp 100.000.000 | biaya_operasional | 🚨 "ambil tunai" |
| 3 | 02-Mei | Rp 24.840.000 | biaya_operasional | pembayaran honor pengurus & pegawai |
| 4 | 04-Mei | Rp 21.500.000 | biaya_operasional | pembelian alat PS4 |
| 5 | 23-Apr | Rp 21.000.000 | beban_unit | pembelian 5 unit TV untuk PS |
| 6 | 08-Apr | Rp 20.762.000 | biaya_operasional | setoran uang barang toko (potong gaji) |
| 7 | 29-Apr | Rp 20.000.000 | biaya_operasional | 🚨 "pinjam SP ZULFAN WASIS" |
| 8 | 02-Apr | Rp 19.300.000 | biaya_operasional | gaji pengurus & pengawas |
| 9 | 30-Apr | Rp 18.750.000 | biaya_operasional | inventaris elektronik RESTO |
| 10 | 24-Apr | Rp 17.992.000 | biaya_operasional | pemasangan CCTV unit toko |

---

## 5. ⚠️ TEMUAN KRITIS: Beban menggelembung karena salah kategori

Tiga transaksi terbesar di atas (ditandai 🚨) **bukan beban riil**, namun karena dikategori-kan sebagai `biaya_operasional`, ikut terhitung mengurangi SHU:

| Tanggal | Nominal | Tercatat Sebagai | Seharusnya |
|---------|--------:|------------------|-----------|
| 29-Apr | **Rp 500.000.000** | biaya_operasional ("ambil kas bri") | **Transfer** (tarik BRI → kas) — bukan expense |
| 18-Mei | **Rp 100.000.000** | biaya_operasional ("ambil tunai") | **Transfer** — bukan expense |
| 29-Apr | **Rp 20.000.000** | biaya_operasional ("pinjam SP ZULFAN") | **Pencairan Pinjaman** — bukan expense |
| | **Rp 620.000.000** | | Total salah kategori |

### Dampak jika direklasifikasi (koreksi)

| Skenario | Pendapatan | Beban | **SHU Bersih** |
|----------|----------:|------:|---------------:|
| Saat ini (tercatat) | Rp 615.092.400 | Rp 1.176.076.527 | **Rp 0** |
| Setelah koreksi 3 transaksi | Rp 615.092.400 | ± Rp 556.076.527 | **± Rp 59.015.873** ✅ |

> **Kesimpulan:** Koperasi **tidak rugi** — bahkan surplus ±Rp 59 juta. SHU nol di layar **utamanya akibat kesalahan input kategori** pada Kas Keluar (penarikan tunai & pencairan pinjaman dicatat sebagai biaya operasional).

---

## 6. Contoh 10 Anggota Aktif (penerima SHU terbesar, 2026)

| # | Nama | No. Anggota | Simpanan Pokok+Wajib | Kontribusi Usaha | Jasa Modal | Jasa Usaha | Cuci Mobil | **Total SHU** |
|---|------|-------------|---------------------:|-----------------:|-----------:|-----------:|-----------:|--------------:|
| 1 | ACHMAD CHAIRUL ANWAR | 83010315 | Rp 21.170.000 | Rp 3.006.900 | Rp 0 | Rp 0 | 11 × 2rb | **Rp 22.000** |
| 2 | AGUNG SANTOSO | 75040479 | Rp 21.770.000 | Rp 3.833.900 | Rp 0 | Rp 0 | 9 × 2rb | **Rp 18.000** |
| 3 | IRWAN LUKITO HADI | 81110966 | Rp 21.020.000 | Rp 397.000 | Rp 0 | Rp 0 | 9 × 2rb | **Rp 18.000** |
| 4 | IRDANI ISMA | 84050713 | Rp 20.885.000 | Rp 3.230.500 | Rp 0 | Rp 0 | 7 × 2rb | **Rp 14.000** |
| 5 | ZULFAN WASISTAN.T | 84121427 | Rp 20.660.000 | Rp 480.000 | Rp 0 | Rp 0 | 7 × 2rb | **Rp 14.000** |
| 6 | MOH FACHRI MAULANA | 86080883 | Rp 20.445.000 | Rp 494.200 | Rp 0 | Rp 0 | 6 × 2rb | **Rp 12.000** |
| 7 | DENDY CUCU ANDRIANA | 83040159 | Rp 21.160.000 | Rp 2.202.400 | Rp 0 | Rp 0 | 6 × 2rb | **Rp 12.000** |
| 8 | AULIA DHETA ASTARIKA | 87070275 | Rp 0 | Rp 471.600 | Rp 0 | Rp 0 | 6 × 2rb | **Rp 12.000** |
| 9 | BAGAS WIDYA ERLANGGA | 97080411 | Rp 11.100.000 | Rp 201.000 | Rp 0 | Rp 0 | 5 × 2rb | **Rp 10.000** |
| 10 | SAJITO, SH | 71060079 | Rp 14.300.000 | Rp 233.000 | Rp 0 | Rp 0 | 5 × 2rb | **Rp 10.000** |

> **Catatan:** Semua anggota dapat **Jasa Modal = Rp 0** dan **Jasa Usaha = Rp 0** karena pool SHU Bersih = Rp 0 (akibat temuan Bagian 5). Mereka **hanya** menerima SHU Cuci Mobil. Bila beban dikoreksi dan SHU Bersih menjadi ±Rp 59 jt, porsi Jasa Modal & Jasa Usaha akan kembali dibagikan proporsional.

---

## 7. Cara kerja: bagaimana beban mempengaruhi SHU per-anggota

Beban biaya bersifat **kolektif** (di tingkat koperasi), sehingga **tidak ada baris "beban" pada tabel per-anggota**:

```
1. Beban (5 kategori, Bagian 1) mengurangi pendapatan koperasi
   SHU Bersih = Pendapatan − Beban

2. SHU Bersih dibagi per komposisi omzet: Anggota (40,4%) : Non-Anggota (59,6%)
   → "Bagian Anggota"

3. Bagian Anggota dipecah ke 3 pool sesuai AD/ART:
   • Pool Jasa Simpanan (Modal) → dibagi PROPORSIONAL terhadap SIMPANAN anggota
   • Pool Jasa Anggota (Usaha)  → dibagi PROPORSIONAL terhadap KONTRIBUSI USAHA
   • SHU Cuci Mobil             → LANGSUNG Rp 2.000 per transaksi (di luar pool)

4. SHU per anggota = (porsi Jasa Modal) + (porsi Jasa Usaha) + (Cuci Mobil)
```

Konfigurasi AD/ART bawaan (dapat diubah di menu **Master → Parameter SHU**):

| Aloasi Anggota | % | Aloasi Non-Anggota | % |
|----------------|--:|--------------------|--:|
| Jasa Anggota (Usaha) | 25% | Dana Cadangan | 60% |
| Jasa Simpanan (Modal) | 20% | Dana Pendidikan (1) | 10% |
| Dana Cadangan | 30% | Kesejahteraan Pegawai | 10% |
| Dana Pengurus | 10% | Dana Pendidikan (2) | 10% |
| Dana Pegawai | 5% | Dana Sosial | 10% |
| Dana Pendidikan | 5% | | |
| Dana Sosial | 5% | | |

---

## 8. Rekomendasi tindak lanjut

1. **Reklasifikasi 3 transaksi** di Bagian 5 (Rp 500 jt + Rp 100 jt + Rp 20 jt) agar bukan expense — setelah ini SHU Bersih akan positif.
2. **Disiplin input Kas Keluar:** penarikan tunai/transfer antar kas & pencairan pinjaman jangan dikategori `biaya_operasional`. Gunakan kategori yang benar (`transfer` / `pencairan_pinjaman`).
3. **Audit beban `biaya_operasional` (CB-OP)** yang Rp 904 jt — inilah penyumbang terbesar; perlu diurai lebih lanjut antara expense riil (gaji, honor, inventaris, CCTV) vs gerak dana.
4. Pertimbangkan **tambah validasi** di form Kas Keluar atau perkuat *blacklist* kalkulator SHU agar transaksi berdeskripsi "ambil/transfer/pinjam" tidak keliru dihitung sebagai beban.

---

*Dihasilkan oleh `scripts/diagnose-shu-beban-detail.ts` (memanggil `calculateSystemSHU()` kanonik).*
*Untuk memperbarui: `NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-shu-beban-detail.ts 2026 10`*
