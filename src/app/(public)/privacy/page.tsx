import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Kebijakan Privasi Aplikasi PRIMKOPPOL Resor Lumajang",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border p-8 md:p-12">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Kebijakan Privasi
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Terakhir diperbarui: 5 Mei 2026
        </p>

        <p className="text-gray-700 mb-6">
          Aplikasi <strong>PRIMKOPPOL Resor Lumajang</strong> (&quot;Aplikasi&quot;) berkomitmen untuk melindungi privasi
          anggota Koperasi Primkopol Resor Lumajang. Kebijakan Privasi ini menjelaskan bagaimana kami mengumpulkan,
          menggunakan, dan melindungi informasi pribadi Anda.
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Informasi yang Dikumpulkan</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Data identitas:</strong> Nama, NRP, pangkat, kesatuan, dan nomor rekening yang diperlukan untuk keanggotaan koperasi.</li>
            <li><strong>Data keuangan:</strong> Informasi simpanan, pinjaman, pembayaran angsuran, dan riwayat transaksi koperasi.</li>
            <li><strong>Data perangkat:</strong> Informasi perangkat dan versi aplikasi untuk keperluan teknis dan keamanan.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Penggunaan Informasi</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Memproses dan mengelola keanggotaan koperasi.</li>
            <li>Menampilkan informasi simpanan, pinjaman, dan slip gaji.</li>
            <li>Memproses transaksi toko dan unit layanan koperasi.</li>
            <li>Mengirimkan notifikasi terkait aktivitas koperasi.</li>
            <li>Menyediakan laporan keuangan dan bukti transaksi.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Izin Aplikasi</h2>
          <p className="text-gray-700 mb-3">Aplikasi meminta izin berikut pada perangkat Anda:</p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Kamera:</strong> Digunakan untuk memindai QR code pada kartu anggota dalam proses verifikasi identitas di toko/layanan koperasi.</li>
            <li><strong>Penyimpanan:</strong> Digunakan untuk menyimpan file dokumen seperti slip gaji (PDF) dan bukti transaksi yang diunduh oleh pengguna.</li>
            <li><strong>Notifikasi:</strong> Digunakan untuk mengirimkan pemberitahuan terkait aktivitas koperasi, jatuh tempo pinjaman, dan pengumuman.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Penyimpanan dan Keamanan Data</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Semua data disimpan secara aman di server yang dilindungi dengan enkripsi.</li>
            <li>Komunikasi antara aplikasi dan server menggunakan protokol HTTPS/TLS.</li>
            <li>Akses ke data dibatasi berdasarkan peran pengguna (operator, kasir, anggota) dengan sistem autentikasi JWT.</li>
            <li>Data sensitif keuangan tidak disimpan secara lokal di perangkat.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Pembagian Data kepada Pihak Ketiga</h2>
          <p className="text-gray-700">
            Kami tidak menjual, memperdagangkan, atau memindahkan informasi pribadi Anda kepada pihak ketiga.
            Data hanya dibagikan kepada pihak yang berwenang sesuai ketentuan hukum yang berlaku dan kebutuhan
            operasional koperasi (sepingga pihak bank untuk pemrosesan gaji/transfer).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Hak Pengguna</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Mengakses dan memeriksa data pribadi yang tersimpan.</li>
            <li>Meminta perbaikan data yang tidak akurat.</li>
            <li>Menonaktifkan izin kamera dan notifikasi melalui pengaturan perangkat.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Kontak</h2>
          <p className="text-gray-700">
            Untuk pertanyaan atau kekhawatiran mengenai Kebijakan Privasi ini, silakan hubungi:
          </p>
          <div className="mt-3 p-4 bg-gray-50 rounded-lg text-gray-700">
            <p><strong>PRIMKOPPOL Resor Lumajang</strong></p>
            <p>Jl. Raya Persimpangan No. 1, Lumajang, Jawa Timur</p>
            <p>Email: primkoppol.lumajang@gmail.com</p>
          </div>
        </section>

        <p className="text-xs text-gray-400 mt-8 text-center">
          Kebijakan Privasi ini berlaku untuk aplikasi mobile PRIMKOPPOL Resor Lumajang versi 1.1.0 dan seterusnya.
        </p>
      </div>
    </main>
  );
}
