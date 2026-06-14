import { motion } from 'framer-motion';

interface BrandStoryProps {
  story: string;
  brandName?: string;
  imageUrl?: string;
}

export default function BrandStory({ 
  story, 
  brandName = 'Cafe & Resto LSP',
  imageUrl = '/images/brand-story.webp' 
}: BrandStoryProps) {
  const paragraphs = story.split('\n').filter(p => p.trim());

  return (
    <section className="section section--secondary">
      <div className="container">
        <div className="split">
          <motion.div
            className="brand-story__text"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <p className="section-label">Cerita Kami</p>
            <h2>Berawal dari Rasa, Berkembang Bersama Koperasi.</h2>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </motion.div>

          <motion.div
            className="brand-story__image"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <img src={imageUrl} alt={`Perjalanan ${brandName}`} loading="lazy" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
