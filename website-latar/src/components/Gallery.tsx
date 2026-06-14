import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn } from 'lucide-react';
import type { GalleryItem } from '../api/content';

interface GalleryProps {
  items: GalleryItem[];
  brandName?: string;
}

export default function Gallery({ items, brandName = 'Cafe & Resto LSP' }: GalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section className="section section--warm">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Galeri</p>
          <h2 className="section-title">Suasana di {brandName}</h2>
          <p className="section-subtitle">
            Jelajahi setiap sudut {brandName} yang dirancang untuk kenyamanan dan kebahagiaan Anda.
          </p>
        </div>

        <div className="gallery-grid">
          {items.map((item, i) => (
            <motion.div
              key={i}
              className="gallery-item"
              onClick={() => setLightboxIndex(i)}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <img src={item.url} alt={item.caption} loading="lazy" />
              <div className="gallery-item__overlay">
                <ZoomIn />
              </div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence>
          {lightboxIndex !== null && (
            <motion.div
              className="lightbox"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxIndex(null)}
            >
              <button className="lightbox__close" onClick={() => setLightboxIndex(null)}>
                <X size={24} />
              </button>
              <motion.img
                key={lightboxIndex}
                src={items[lightboxIndex].url}
                alt={items[lightboxIndex].caption}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
