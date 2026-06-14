import { motion } from 'framer-motion';
import { UtensilsCrossed, Package, CreditCard } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: UtensilsCrossed,
    title: 'Dine-in Nyaman & Dinamis',
    desc: 'Denah meja yang luas dan fleksibel untuk gathering, rapat, atau sekadar bersantai bersama orang tercinta.',
  },
  {
    icon: Package,
    title: 'Takeaway Praktis',
    desc: 'Layanan bungkus cepat dengan sistem modern. Pesan, bayar, dan langsung bawa pulang tanpa antri lama.',
  },
  {
    icon: CreditCard,
    title: 'Transaksi Mudah',
    desc: 'Mendukung QRIS, Tunai, dan Split Bill. Nongkrong bareng teman? Pembayaran bisa dipisah dengan mudah.',
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const } },
};

export default function Highlights({ brandName = 'Cafe & Resto LSP' }: { brandName?: string }) {
  return (
    <section className="section section--warm">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Keunggulan Kami</p>
          <h2 className="section-title">Mengapa Memilih {brandName}?</h2>
          <p className="section-subtitle">
            Kami menghadirkan pengalaman kuliner yang lengkap — dari suasana hingga kemudahan transaksi.
          </p>
        </div>

        <motion.div
          className="grid-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {HIGHLIGHTS.map((item) => (
            <motion.div key={item.title} className="highlight-card" variants={itemVariants}>
              <div className="highlight-card__icon">
                <item.icon size={28} />
              </div>
              <h3 className="highlight-card__title">{item.title}</h3>
              <p className="highlight-card__desc">{item.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
