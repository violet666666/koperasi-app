# Dokumen Perencanaan Infrastruktur & Skalabilitas Koperasi Digital System

Dokumen ini berisi rekapitulasi fitur aplikasi Koperasi saat ini, rencana infrastruktur server & database yang direkomendasikan untuk menampung skala 5.000 anggota terdaftar, integrasi merchant, serta peta jalan (roadmap) pengembangan web app menuju mobile app native untuk penyusunan anggaran (budgeting).

## 1. Rekapitulasi Fitur Saat Ini (Base System)
Aplikasi Koperasi Digital System telah memiliki fondasi sebagai *Core Banking System* mini dengan standar akuntansi ganda.
- **Manajemen Pengguna & Hak Akses (RBAC):** Super Admin, Admin Cabang, dan Anggota.
- **Master Data Anggota:** Validasi NRP (Nomor Registrasi Pokok), NIK, dan manajemen status keanggotaan.
- **Simpan Pinjam Terpadu:**
  - *Simpanan*: Pencatatan mutasi untuk Simpanan Pokok, Wajib, dan Sukarela.
  - *Pinjaman*: Alur persetujuan, pencairan, dan pembayaran angsuran dengan kalkulasi bunga otomatis (Flat/Efektif).
- **Transaksi Multi-Unit Bisnis:** Integrasi tagihan dari Toko, Fotocopy, Cuci Mobil, Fitness Center, dsb agar bisa dilunasi oleh anggota.
- **Portal Anggota (Mobile-Friendly):** Dashboard mandiri untuk memantau sisa pinjaman, riwayat mutasi, dan tagihan unit.
- **Sistem Akuntansi Ganda (Double-Entry):** Penjurnalan otomatis, Buku Besar, Neraca Saldo, Laba Rugi.
- **PWA (Progressive Web App):** Dapat diinstall langsung dari browser HP tanpa melalui PlayStore.

## 2. Perencanaan Server, Database, & Perkiraan Anggaran (Fase Awal / Trial)

Sistem menggunakan arsitektur modern berbasis Next.js (App Router), Prisma ORM, dan PostgreSQL. Arsitektur ini bersifat *Serverless*, yang berarti aplikasi merespons *request* secara instan sesuai kebutuhan (on-demand). 

Saat ini, Anda ingin melakukan pendekatan **Lean / Hemat Biaya**, yaitu membeli *Domain .com* secara terpisah dan hanya menyewa Database (DB) secara bulanan. **Ini SANGAT MEMUNGKINKAN dan justru merupakan *best practice* (praktik terbaik) yang disarankan.**

### A. Pembelian Domain (.com)
**Q: Apakah langganan Vercel langsung mendapat domain .com gratis?**
**A:** *Tidak otomatis gratis.* Vercel memang menjual domain, tetapi Anda **boleh (dan sangat disarankan)** untuk membeli domain dari penyedia lokal (seperti Niagahoster, IDCloudHost, Hostinger, dsb) secara terpisah. 
Setelah domain `.com` tersebut dibeli seharga ~Rp 220.000/tahun, Anda cukup mengubah pengaturannya (mengubah *Nameserver* / *DNS Records*) agar mengarah ke layanan gratis Vercel. Prosesnya sangat mudah, instan, dan bebas biaya tambahan.

### B. Hosting Web Application (Vercel)
Untuk fase awal peluncuran (belum mencapai 5.000 transaksi mutasi berat per detik):
- Anda **BOLEH** memakai Vercel paket **Hobby (Gratis / Rp 0)**.
- Domain `.com` yang baru Anda beli bisa langsung dihubungkan ke akun gratis Vercel tersebut. SSL/Gembok hijau akan dipasang otomatis oleh Vercel (Gratis seumur hidup).
- Jika ke depannya anggota sudah sangat ramai dan sistem mulai "Timeout" saat generate buku besar akhir bulan, Anda baru perlu meningkatkan (upgrade) akun ke Vercel Pro ($20/bulan). Jika tidak, tetap di versi gratis.

### C. Database (Neon PostgreSQL)
Karena Neon adalah *Serverless Database*, Anda bebas berlangganan **per bulan (Monthly)**. Ini sangat baik agar *cashflow* anggaran Koperasi tidak terlalu terbebani di awal peluncuran.
- **Paket Launch (Bayar Bulanan):** ~$19 / bulan (~Rp 300.000 / bulan).
- Pilihan ini memberi Anda fitur pelindung agar database tidak *down* saat banyak panggota / perwira membuka portal simpanan di hari gajian secara serentak.

### D. Ringkasan Anggaran Sangat Optimal (Fase MVP / Peluncuran Awal)
Berikut rincian biaya aktual di awal jalan berkat metode *Beli Domain Terpisah & Langganan DB Bulanan*:

- **Domain .com (Niagahoster/Setara):** ~Rp 220.000 / tahun *(bayar di muka)*
- **Vercel Hosting Web App:** Rp 0 / bulan *(Gratis)*
- **Neon Database (Launch):** ~Rp 300.000 / bulan *(bayar bulanan)*

Jika ditotal untuk pengeluaran *cash* **Bulan Pertama** hanya dibutuhkan dana sekitar **~Rp 520.000** (sudah dapat Domain .com setahun dan Database Pro 1 bulan). 
Untuk bulan kedua dan seterusnya, pengeluaran hanya **Rp 300.000/bulan** murni untuk bayar Database saja. *Sangat-sangat murah dan efisien dibanding merekrut SysAdmin dan bayar Server utuh bulanan.*

---

## 3. Rencana Integrasi & Ekspansi (Merger Toko/Indomaret)

Untuk merger dengan Indomaret atau toko komersial lainnya:
1. **Pembuatan RESTful Endpoints (API Integrasi):** Tim IT akan membuat "Pintu Khusus" (API Gateway) dilengkapi dengan token keamanan JWT (*JSON Web Token*) yang hanya bisa ditembak oleh sistem Kasir Indomaret.
2. **Alur Transaksi (Barcode PWA):** Anggota Koperasi berbelanja di Indomaret dan menunjukkan **Barcode/QR Keanggotaan** dari *Portal Anggota* (PWA/HP).
3. **Proses Real-time:** Mesin kasir Indomaret men-*scan* barcode $\rightarrow$ Sistem ngecek saldo *Simpanan Sukarela Anggota* secara otomatis $\rightarrow$ Saldo dipotong (Debet) atau dicatat sebagai 'Tagihan Payroll/Piutang' langsung ke sistem akuntansi Koperasi.
4. **Rekonsiliasi Otomatis:** Settlement keuangan perputaran dana antara Rekening Koperasi dan Rekening Perusahaan Indomaret dilakukan berkala (mingguan/bulanan) berdasarkan pencocokan (rekonsiliasi) data di `UnitTransaction`.

---

## 4. Peta Jalan (Roadmap) Transisi: Web App (PWA) ke Native App (Mobile App)

Bagaimana transisi dari aplikasi Web App yang ada sekarang menuju Aplikasi Android/iOS di masa depan? Berikut *Planning* (Peta Jalan) agar *source code* saat ini tidak terbuang sia-sia:

### Fase 1: Pematangan Web App PWA (Bulan 1 - 3)
Fokus awal adalah mengasimilasi dan menampung *traffic* 5.000 anggota menggunakan **PWA Koperasi** (Web App saat ini).
- Anggota cukup meng- *Install / Add to Home Screen* dari browser Google Chrome (Android) atau Safari (iOS). 
- **Tujuan PWA:** Uji coba kelancaran sistem akuntansi dan kecepatan database saat 5.000 mutasi/angsuran berjalan per bulan tanpa repot memikirkan *review* dari Google PlayStore yang ketat. Mengumpulkan *feedback* UX.

### Fase 2: Isolasi API Backend & Pengembangan *Headless* (Bulan 4 - 6)
Karena aplikasi web saat ini menggunakan **Next.js**, kita akan memisahkan fungsi Tampilan Web dengan *Logika Database* (API).
- **Backend Refactor:** Mengubah *Session Based Authentication* (Cookies) di Next.js API menjadi **Standar OAuth2/JWT**, yang merupakan protokol komunikasi seluler mandiri yang sangat efisien.
- **Native Development:** Mulai memprogram "cangkang" antarmuka aplikasi Android/iOS dengan teknologi **React Native (Expo)**. Keuntungannya bahasa React Native nyaris sama persis dengan React/Next.js saat ini, hemat budget developer.

### Fase 3: Injeksi Fitur Eksklusif Mobile "Native" (Bulan 7 - 9)
Ketika cangkang Native terhubung dengan API Next.js Koperasi, kita merakit fitur-fitur berkelas korporat (*Corporate Grade*) yang tidak bisa dijangkau oleh Web biasa:
- **Login Biometrik:** *Fingerprint* (Sidik Jari) atau Face ID langsung terintegrasi dengan akun NRP anggota.
- **Push Notifications System:** Notifikasi *pop-up* di *lock-screen* HP (layaknya BCA Mobile) untuk konfirmasi angsuran sukses, atau pencairan dana.
- **Smart Barcode Offline:** Pembuatan fitur "Kartu Digital Dinamis / OTP" (berubah tiap 30 detik untuk *checkout* di Indomaret secara lebih aman tanpa butuh internet bagi si anggota).

### Fase 4: Deployment & Rilis Resmi di App Stores (Bulan 10+)
- **Uji Coba Beta Test:** Aplikasi versi `.apk` ditest oleh internal pengurus Koperasi.
- **Rilis Publik - Google Play Store (Android):** Mendaftar lisensi *Google Developer Console*. Biaya satu kali seumur hidup: **$25 (~Rp 400.000)**.
- **Rilis Publik - Apple App Store (iOS - Opsional):** Jika sebagian besar pemegang/panggota menggunakan iPhone. Biaya langganan Developer iOS: **$99 / tahun (~Rp 1.500.000 / tahun)**.
