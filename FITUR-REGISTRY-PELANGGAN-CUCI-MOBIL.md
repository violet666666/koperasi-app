# Fitur Baru: Registry Pelanggan Cuci Mobil (Nopol ↔ No. WA)

**Unit:** Cuci Mobil & Motor · **Rilis:** 4–5 Okt 2026 · **Commit:** `46c72a8a`, `30c1bac1`

---

## 1. Masalah yang Dijawab

| Sebelum | Sesudah |
|---|---|
| Data pelanggan umum (non-anggota) tidak pernah tersimpan — tiap kedatangan dianggap orang baru | Cukup satu transaksi tercatat (plat + HP), pelanggan dikenali otomatis di kunjungan berikutnya |
| Nomor plat tersebar di teks keterangan, tidak bisa dicari | Ketik plat ATAU no. HP → seluruh riwayat pelanggan muncul, dua arah |
| HP anggota hanya bisa diisi operator lewat halaman Anggota | Kasir bisa melengkapi HP anggota langsung dari POS (aman, tidak menimpa) |
| Transaksi dari mobile tidak masuk riwayat pelanggan | Web dan mobile kini menulis ke satu registry yang sama, termasuk histori lama |

---

## 2. Konsep Inti

> **Satu registry, semua sistem terhubung.**

Setiap transaksi cuci mobil menyimpan identitas pelanggan dalam bentuk tag pada catatan transaksi:

```
[PLAT:B 1234 ABC] [HP:081234567890] [NAMA:Budi]
```

- Tanpa tabel/database baru — registry terbangun otomatis dari transaksi
- Kompatibel dengan histori lama: transaksi mobile zaman dulu (plat di keterangan) ikut bisa dicari
- Transaksi yang di-void tidak dihitung

---

## 3. Alur Kasir Web

Berlaku di **dua halaman** (fitur sama): `/unit/cuci-mobil/kasir` (POS generik — dipakai harian) dan `/cuci-mobil/kasir` (POS katalog).

```
┌────────────────────────────────────────────────────────────┐
│ 1. KETIK PLAT NOMOR (wajib)                                │
│    └─ otomatis → sistem cari riwayat pelanggan             │
│       └─ ditemukan? muncul kartu:                          │
│          • Nama pelanggan                                  │
│          • HP/WA pemilik + tanggal kunjungan terakhir      │
│          • "N× pernah cuci di sini"                        │
│          • Semua plat milik no. HP itu (klik = ganti plat) │
│          └─ HP pemilik ikut tersimpan otomatis             │
├────────────────────────────────────────────────────────────┤
│ 2. ATAU KETIK NO. HP / PLAT di field "No. HP / WA          │
│    Pelanggan" (tersimpan + cari otomatis)                  │
│    └─ pencarian dua arah, jalan sambil mengetik            │
│       • HP ≥ 8 digit → semua plat + statistik kunjungan    │
│       • Plat → nama + HP pemilik                           │
│       • Pelanggan baru → HP & nama terisi, otomatis        │
│         tersimpan di riwayat saat transaksi                │
├────────────────────────────────────────────────────────────┤
│ 3. PELANGGAN = ANGGOTA? Pilih anggotanya                   │
│    └─ HP terdaftar anggota otomatis terisi ke field HP     │
│       → masuk registry tanpa mengetik ulang                │
├────────────────────────────────────────────────────────────┤
│ 4. PILIH LAYANAN → KERANJANG → BAYAR                       │
│    Tunai / QRIS / Potong Gaji (cek plafon otomatis)        │
├────────────────────────────────────────────────────────────┤
│ 5. STRUK THERMAL 58mm + data tersimpan:                    │
│    riwayat unit · SHU per-unit · registry pelanggan        │
│    · profil anggota (bila HP-nya masih kosong)             │
│    Konfirmasi muncul: "HP tersimpan" / peringatan bila     │
│    pelanggan umum diproses tanpa no. HP                    │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Alur Kasir Mobile (APK baru)

```
1. Pilih paket layanan (nominal boleh disesuaikan)
2. Ketik PLAT NOMOR (wajib — tombol bayar terkunci jika kosong)
   └─ otomatis → kartu pelanggan lama muncul:
      nama · HP/WA · "N× pernah cuci" · chips plat lain
   └─ kolom HP KOSONG? terisi otomatis dari riwayat
3. Kolom "No. HP Pelanggan" (opsional, tersimpan di riwayat)
4. Bayar: Tunai / QRIS / Potong Gaji
   └─ struk 58mm/80mm tercetak dengan plat
```

---

## 5. Sinkronisasi ke Profil Anggota (fill-if-empty)

Kebijakan aman: **mengisi yang kosong, tidak pernah menimpa.**

```
Transaksi dengan anggota terpilih + no. HP diisi (8–15 digit)
        │
        ├── Profil anggota BELUM punya HP
        │        └─ ✅ Member.phone terisi + toast konfirmasi kasir
        │
        └── Profil anggota SUDAH punya HP
                 └─ ⛔ Tidak diubah (typo kasir tidak merusak data pusat)
```

Hasil akhirnya satu sumber data HP (`Member.phone`) yang terpakai di:
profil anggota web · portal anggota · aplikasi mobile · registry cuci mobil.

---

## 6. Ringkasan Perubahan Teknis

| Perubahan | Lokasi |
|---|---|
| Tag `[PLAT:]/[HP:]/[NAMA:]` di notes (web + mobile) | `api/unit-layanan/sales`, `api/mobile/unit-layanan` |
| Pencarian pelanggan dua arah + fallback histori lama | `api/unit-layanan/customer-lookup` (dual-auth web+mobile) |
| Sync HP ke profil anggota (fill-if-empty, atomik) | kedua route sales di atas |
| Lookup otomatis dari field plat | kasir web + kasir mobile |
| Prefill HP terdaftar saat pilih anggota | kasir web + kasir mobile |
| Unit test | `shouldUpdateMemberPhone` — 11/11 pass |

---

## 7. Batasan & Catatan

- **Nomor HP yang dulu tertinggal di field Nama tetap dikenali** — 117 transaksi lama (Sep–Okt 2026) mengetik HP ke field "Nama Pelanggan" → tersimpan `[NAMA:08xxx]`; pencarian HP & kartu pelanggan ikut membacanya (tanpa ubah data)
- HP kurang dari 8 digit diabaikan (dianggap bukan nomor valid)
- Registry khusus unit cuci mobil; unit lain menyusul bila diperlukan dengan pola yang sama
- Nomor HP tidak ditampilkan ke sesama pelanggan — hanya untuk kasir/admin dalam sistem
- Fitur ini bukan sistem antrian order (status "sedang dicuci → selesai" tidak ada) — dapat dibuat terpisah bila dibutuhkan
