import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useContent } from '../hooks/useContent';
import Navbar from '../components/Navbar';
import BrandStory from '../components/BrandStory';
import VisiMisi from '../components/VisiMisi';
import TechShowcase from '../components/TechShowcase';
import Gallery from '../components/Gallery';
import LocationMap from '../components/LocationMap';
import Footer from '../components/Footer';

export default function CompanyProfile() {
  const { content } = useContent();

  useEffect(() => {
    document.title = `Tentang Kami — ${content.brandName || 'Cafe & Resto LSP'} | PRIMKOPPOL Resor Lumajang`;
    window.scrollTo(0, 0);
  }, [content.brandName]);

  return (
    <>
      <Navbar ctaLink={content.ctaReservasiLink} brandName={content.brandName} logoUrl={content.logoUrl} />
      <main>
        {/* Hero Banner */}
        <section className="hero-banner">
          <div className="hero-banner__bg">
            <img src="/images/fasad.webp" alt="Fasad Latar Cafe & Resto" loading="eager" />
          </div>
          <div className="hero-banner__overlay" />
          <motion.div
            className="hero-banner__content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <h1 className="hero-banner__title">Tentang Kami</h1>
            <div className="hero-banner__breadcrumb">
              <Link to="/">Beranda</Link>
              <span>›</span>
              Tentang Kami
            </div>
          </motion.div>
        </section>

        <BrandStory story={content.aboutStory} brandName={content.brandName} imageUrl={content.aboutImageUrl} />
        <VisiMisi visi={content.visi} misi={content.misi} />
        <TechShowcase />
        <Gallery items={content.gallery} />
        <LocationMap content={content} />
      </main>
      <Footer content={content} />
    </>
  );
}
