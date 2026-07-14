import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — PRIMKOPPOL Resor Lumajang",
  description: "Kebijakan privasi aplikasi PRIMKOPPOL Resor Lumajang.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Kebijakan Privasi</h1>
        <p className="text-sm text-gray-500 mb-8">
          PRIMKOPPOL Resor Lumajang — Aplikasi Koperasi
        </p>

        <p className="mb-6 text-sm">
          Berlaku mulai: 14 Juli 2026. Kebijakan ini menjelaskan bagaimana
          Koperasi PRIMKOPPOL Resor Lumajang (&ldquo;Kami&rdquo;) mengumpulkan,
          menggunakan, dan melindungi data pribadi Anggota saat menggunakan
          aplikasi mobile PRIMKOPPOL.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Data yang Dikumpulkan</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li><strong>Identitas:</strong> Nama, NRP, NIK, pangkat, golongan, kesatuan, jenis kelamin, tanggal lahir.</li>
            <li><strong>Kontak:</strong> Nomor telepon, alamat email, alamat domisili.</li>
            <li><strong>Keuangan:</strong> Data simpanan (Pokok/Wajib/Sukarela/Haji-Umrah), pinjaman, angsuran, transaksi unit usaha, potongan gaji, dan riwayat pembayaran.</li>
            <li><strong>Perangkat:</strong> Token notifikasi push (untuk pengingat tagihan/status pinjaman), tidak termasuk lokasi atau kontak.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Tujuan Penggunaan Data</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Menyelenggarakan layanan koperasi: simpanan, pinjaman, pembayaran angsuran, tagihan bulanan.</li>
            <li>Operasional unit usaha (toko, resto, cafe, cuci mobil, fotocopy, fitness, playstation, laundry, barbershop, haji-umrah).</li>
            <li>Penghitungan dan pembagian Sisa Hasil Usaha (SHU) sesuai AD/ART.</li>
            <li>Notifikasi transaksi, jatuh tempo, dan status pengajuan.</li>
            <li>Pemenuhan kewajiban administratif dan pelaporan internal koperasi.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. Dasar Pemrosesan</h2>
          <p className="text-sm">
            Pemrosesan data didasarkan pada keanggotaan Anggota di Koperasi
            PRIMKOPPOL (persetujuan saat pendaftaran), kewajiban kontraktual
            sesuai AD/ART, serta kepentingan sah koperasi untuk menjalankan
            layanan keuangan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Berbagi Data dengan Pihak Ketiga</h2>
          <p className="text-sm">
            Kami <strong>tidak menjual</strong> data pribadi Anggota. Data dapat
            dibagikan secara terbatas kepada:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-sm mt-2">
            <li>Bank mitra (untuk transfer dana pinjaman, bagi hasil BSI, mass debet BRI) — sebatas data transaksi yang diperlukan.</li>
            <li>Penyedia infrastruktur (Neon database, Railway hosting, Expo push notification) — sebagai pemroses data atas nama Kami.</li>
            <li>Otoritas yang berwenang apabila diwajibkan oleh peraturan perundang-undangan.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Penyimpanan &amp; Keamanan</h2>
          <p className="text-sm">
            Data disimpan di server berveerifikasi (Neon PostgreSQL, di-host
            dengan enkripsi). Akses dibatasi berdasarkan peran (operator, admin
            unit, admin SP, kasir) dengan kontrol hak akses ketat. Sesi
            aplikasi dilindungi token JWT. Data keuangan disimpan selama
            Anggota masih terdaftar dan sesuai kewajiban retensi pembukuan
            koperasi.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Hak Anggota</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Mengakses dan memeriksa data pribadi melalui aplikasi (portal anggota).</li>
            <li>Meminta perbaikan data yang tidak akurat.</li>
            <li>Meminta penghapusan data setelah keanggotaan berakhir dan seluruh kewajiban keuangan diselesaikan (dengan pengecualian data yang wajib disimpan untuk pembukuan).</li>
            <li>Menarik persetujuan (berakibat berhentinya layanan koperasi).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Anak di Bawah Umur</h2>
          <p className="text-sm">
            Aplikasi ditujukan untuk anggota dewasa (anggota Polri/PNS/Masyarakat
            umum berusia 17+). Kami tidak sengaja mengumpulkan data anak di
            bawah umur.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Perubahan Kebijakan</h2>
          <p className="text-sm">
            Kami dapat memperbarui kebijakan ini sewaktu-waktu. Versi terbaru
            akan selalu ditampilkan di halaman ini dengan tanggal berlaku yang
            diperbarui.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Kontak</h2>
          <p className="text-sm">
            Untuk pertanyaan terkait privasi, akses, atau penghapusan data,
            hubungi Pengurus Koperasi PRIMKOPPOL Resor Lumajang:
          </p>
          <ul className="list-none pl-0 space-y-1 text-sm mt-2">
            <li>Alamat: Polres Lumajang, Jawa Timur</li>
            <li>Email: pengurus@primkoppol.site</li>
            <li>Telepon: melalui sekretariat koperasi</li>
          </ul>
        </section>

        <footer className="border-t pt-6 mt-12 text-xs text-gray-400">
          © 2026 Koperasi PRIMKOPPOL Resor Lumajang
        </footer>
      </div>
    </main>
  );
}
