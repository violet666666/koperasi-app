import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface HeroSectionProps {
  headline: string;
  subheadline: string;
}

export default function HeroSection({ headline, subheadline }: HeroSectionProps) {
  return (
    <section className="hero">
      <div className="hero__bg">
        <img src="/images/hero-bg.webp" alt="Suasana Latar Cafe & Resto" loading="eager" />
      </div>
      <div className="hero__overlay" />

      <motion.div
        className="hero__content"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <motion.h1
          className="hero__title"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {headline}
        </motion.h1>

        <motion.p
          className="hero__subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          {subheadline}
        </motion.p>

        <motion.div
          className="hero__buttons"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <a href="#menu" className="btn btn--primary btn--lg">
            Lihat Menu Kami
          </a>
          <Link to="/tentang-kami" className="btn btn--outline btn--lg">
            Kenali Kami Lebih Dekat
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
