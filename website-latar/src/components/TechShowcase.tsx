import { motion } from 'framer-motion';
import { Monitor, LayoutGrid, Split, SlidersHorizontal } from 'lucide-react';

const FEATURES = [
  {
    icon: Monitor,
    title: 'Kitchen Display System',
    desc: 'Pesanan langsung masuk ke layar dapur secara real-time. Tidak ada kertas hilang, tidak ada salah masak.',
  },
  {
    icon: LayoutGrid,
    title: 'Dynamic Floor Plan',
    desc: 'Denah meja interaktif yang memudahkan staf mengatur penempatan tamu dan melihat status meja langsung.',
  },
  {
    icon: Split,
    title: 'Split Bill & QRIS',
    desc: 'Pelanggan bisa membagi tagihan dan bayar langsung via QRIS. Praktis untuk group dining dan rapat kantor.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Custom Modifiers',
    desc: 'Tingkat kepedasan, extra topping, less sugar? Semua bisa dikustomisasi langsung saat memesan di kasir.',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function TechShowcase() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Teknologi Kami</p>
          <h2 className="section-title">Pelayanan Cepat, Tepat, dan Modern</h2>
          <p className="section-subtitle">
            Didukung infrastruktur POS termutakhir yang memastikan pengalaman pelanggan berjalan lancar.
          </p>
        </div>

        <motion.div
          className="grid-2"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} className="tech-card" variants={itemVariants}>
              <div className="tech-card__icon">
                <f.icon size={24} />
              </div>
              <h3 className="tech-card__title">{f.title}</h3>
              <p className="tech-card__desc">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
