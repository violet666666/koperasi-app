import { useEffect } from 'react';
import { useContent } from '../hooks/useContent';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import Highlights from '../components/Highlights';
import FeaturedMenu from '../components/FeaturedMenu';
import Testimonials from '../components/Testimonials';
import CtaBanner from '../components/CtaBanner';
import Footer from '../components/Footer';

export default function LandingPage() {
  const { content } = useContent();

  useEffect(() => {
    document.title = 'Latar Cafe & Resto — Cita Rasa Autentik';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', content.heroSubheadline);
  }, [content.heroSubheadline]);

  return (
    <>
      <Navbar ctaLink={content.ctaReservasiLink} />
      <main>
        <HeroSection headline={content.heroHeadline} subheadline={content.heroSubheadline} />
        <Highlights />
        <FeaturedMenu />
        <Testimonials testimonials={content.testimonials} />
        <CtaBanner ctaLink={content.ctaReservasiLink} />
      </main>
      <Footer content={content} />
    </>
  );
}
