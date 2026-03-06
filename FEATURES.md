# Daftar Fitur Koperasi Digital System

Aplikasi Koperasi Digital System ini dirancang untuk memudahkan pengelolaan operasional koperasi dengan berbagai unit bisnis, serta memberikan transparansi penuh kepada seluruh anggota. Berikut adalah rekapitulasi fitur yang tersedia dalam aplikasi ini:

## 1. Autentikasi & Otorisasi
- **Multi-Role System**: Mendukung berbagai tingkatan akses pengguna:
  - **Super Admin**: Akses penuh ke seluruh sistem dan pengaturan utama.
  - **Admin Cabang**: Akses pengelolaan data spesifik untuk cabang tertentu.
  - **Anggota**: Akses terbatas ke *Portal Anggota* untuk memonitor data probadi.
- **Role-Based Access Control (RBAC)**: Pembatasan rute dan akses menu/halaman secara dinamis berdasarkan izin (permissions) yang dimiliki oleh role pengguna.
- **Keamanan**: Diperkuat dengan NextAuth.js v5 untuk manajemen sesi dan enkripsi kata sandi menggunakan bcrypt.

## 2. Manajemen Anggota (Master Data)
- **Pendaftaran Terpusat**: Form registrasi anggota lengkap dengan penyimpanan data pribadi pendukung seperti Nama, NIK, dan **NRP (Nomor Registrasi Pokok)** khusus anggota/polisi.
- **Validasi NRP**: Pencarian dan integrasi data anggota berbasis NRP untuk kemudahan pelacakan identitas.
- **Manajemen Status**: Tracking status keanggotaan (Aktif / Non-Aktif).

## 3. Sistem Simpanan (Tabungan)
- **Kategorisasi Simpanan**: Mendukung berbagai jenis simpanan (Simpanan Pokok, Simpanan Wajib, Simpanan Sukarela).
- **Mutasi Simpanan**: Pencatatan riwayat setor tunai maupun tarik tunai simpanan tiap anggota dengan rekap otomatis saldo berjalan.
- **Monitoring Simpanan**: Admin dapat melacak secara akurat riwayat perubahan saldo tiap rekening di setiap cabang.

## 4. Sistem Pinjaman (Kredit)
- **Siklus Pinjaman Lengkap**:
  - **Pengajuan**: Modul form pengajuan rencana peminjaman dana oleh anggota.
  - **Approval**: Persetujuan bertingkat oleh pihak berwenang (Approval Pinjaman).
  - **Pencairan**: Proses dokumentasi ketika dana telah sepenuhnya diberikan (Disbursement).
- **Manajemen Angsuran**: Kalkulasi otomatis sisa Pokok dan sisa Bunga/Jasa Pinjaman setiap kali member melakukan pembayaran tagihan angsuran bulanan.
- **Tracking Status**: Pelacakan status fasilitas peminjaman (*Active* atau *Completed/Lunas*).

## 5. Transaksi Multi-Unit Bisnis
Koperasi tidak hanya melayani simpan pinjam, tetapi juga memfasilitasi integrasi pembelian barang dan layanan dari berbagai Unit Usaha:
- **Toko / Retail**: Pembelian komoditas/barang.
- **Simpan Pinjam**: Pembayaran biaya admin terkait operasional SP.
- **Fotocopy & ATK**: Layanan pencetakan dan alat tulis.
- **Cuci Mobil**: Jasa layanan cuci kendaraan bermotor.
- **Fitness Center**: Pembayaran/Membership pusat kebugaran.
- **Input Fleksibel**: Admin dapat memasukkan tagihan / riwayat transaksi dari masing-masing unit menggunakan NRP secara cepat dengan status "Lunas" atau "Belum Lunas".

## 6. Portal Khusus Anggota (`/portal`)
Antarmuka layanan mandiri (Self-Service) khusus untuk Role Anggota dan didesain secara adaptif/mobile-friendly (berbeda dengan tampilan dashboard admin):
- **Dashboard Summary**: Ringkasan Total Saldo Simpanan, Total Sisa Pinjaman Aktif, dan Total Tagihan Mutasi Unit yang belum diselesaikan.
- **Portofolio Simpanan**: Monitoring seluruh tipe produk simpanan yang dimiliki lengkap dengan histori mutasi.
- **Status Pinjaman**: Memantau progress pergerakan pelunasan fasilitas pinjaman, sisa target pokok bulanan, dan jadwal bunga.
- **Riwayat Transaksi Unit**: Rekaman seluruh catatan transaksi harian dari berbagai unit Koperasi, memastikan transparansi penuh kepada user.
- **Profil Identitas**: Laman pengecekan biodata diri (No. Anggota, Cabang, Tanggal Bergabung, dsb.).

## 7. Keuangan Umum (Finance) & Catatan Arus Kas
- **Kas & Bank**: Master data pengelolaan brankas internal koperasi dan rekening bank.
- **Mutasi Kas**: Pemantauan histori arus kas masuk (Cash In) dan arus kas keluar (Cash Out) secara keseluruhan entitas koperasi.
- **Laporan (Reporting)**: Layar Rekap dan generasi Laporan Anggota dan transaksi komprehensif (Masih dalam tahap perluasan fitur).

## 8. Modul Akuntansi Penuh (Double-Entry)
Sistem ini menggunakan standar akuntansi ganda (*double-entry bookkeeping*):
- **Chart of Accounts (Bagan Akun)**: Hierarki akun mulai dari Aset (Kas/Bank, Piutang), Kewajiban (Simpanan), Ekuitas, Pendapatan, hingga Beban.
- **Jurnal Umum Otomatis**: Setiap transaksi operasional (setoran, angsuran pinjaman, transaksi toko) langsung menciptakan dua jurnal (debit & kredit) secara otomatis di belakang layar.
- **Input Jurnal Manual**: Kasir/Admin dapat membuat penyesuaian catatan keuangan (Jurnal Penyesuaian) dan transaksi non-operasional lainnya.
- **Reporting Transparan**:
  - Buku Besar (General Ledger).
  - Neraca Saldo (Trial Balance).
  - Neraca Keuangan (Balance Sheet).
  - Laporan Laba Rugi (Income Statement).

## 9. Mobile Responsive & PWA (Progressive Web App)
- **Desain Mobile-First**: Semua layar tabel, portal anggota, dan antarmuka admin dioptimalkan untuk perangkat ponsel pintar, dengan dukungan penyesuaian *Safe Area Inset* (iPhone Notch) dan *Dynamic Viewport* (`100dvh`).
- **Instalasi PWA**: Sistem dapat diunduh/digunakan langsung selayaknya aplikasi *native* dari Chrome Android atau Safari iOS, menampilkan App Icon Koperasi di *Home Screen*, dan mendukung mode *Offline Fallback*.

## 10. Alat Pra-Demonstrasi
- **Seed Generator**: Skrip untuk me-reset ulang *database* dan meng-generate 10 akun anggota dengan masing-masing Nomor Registrasi Pokok (NRP), puluhan riwayat mutasi tabungan/pinjaman, lengkap dengan jurnal akuntansinya, siap pakai untuk keperluan *demo live*.

---
*Dokumen ini diperbarui secara bertahap untuk merekam penambahan kapabilitas sistem Koperasi Digital.*
