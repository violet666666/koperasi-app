import { motion } from 'framer-motion';
import { Eye, Target, Check } from 'lucide-react';

interface VisiMisiProps {
  visi: string;
  misi: string[];
}

export default function VisiMisi({ visi, misi }: VisiMisiProps) {
  return (
    <section className="section section--warm">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Visi & Misi</p>
          <h2 className="section-title">Tujuan & Komitmen Kami</h2>
        </div>

        <div className="grid-2">
          <motion.div
            className="visi-misi-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="visi-misi-card__icon">
              <Eye size={28} />
            </div>
            <h3 className="visi-misi-card__title">Visi</h3>
            <p className="visi-misi-card__text">{visi}</p>
          </motion.div>

          <motion.div
            className="visi-misi-card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <div className="visi-misi-card__icon">
              <Target size={28} />
            </div>
            <h3 className="visi-misi-card__title">Misi</h3>
            <div className="visi-misi-card__list">
              {misi.map((item, i) => (
                <div key={i} className="visi-misi-card__list-item">
                  <div className="visi-misi-card__list-icon">
                    <Check size={14} />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
