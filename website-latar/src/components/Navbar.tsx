import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Beranda', href: '/' },
  { label: 'Tentang Kami', href: '/tentang-kami' },
  { label: 'Menu', href: '/#menu' },
  { label: 'Kontak', href: '/#kontak' },
];

interface NavbarProps {
  ctaLink?: string;
}

export default function Navbar({ ctaLink = '#' }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith('/#')) {
      const id = href.slice(2);
      if (location.pathname === '/') {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar--scrolled' : 'navbar--transparent'}`}>
        <div className="navbar__inner">
          <Link to="/" className="navbar__logo">
            <img src="/LogoPrimkoppol.png" alt="Latar" className="navbar__logo-img" />
            <span className="navbar__logo-text">Latar</span>
          </Link>

          <div className="navbar__links">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`navbar__link ${location.pathname === link.href ? 'navbar__link--active' : ''}`}
                onClick={() => handleNavClick(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <a href={ctaLink} className="navbar__cta" target="_blank" rel="noopener noreferrer">
            Reservasi Meja
          </a>

          <button
            className="navbar__hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="mobile-menu__overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="mobile-menu"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <button className="mobile-menu__close" onClick={() => setMobileOpen(false)}>
                <X size={20} />
              </button>

              <div style={{ marginTop: '2rem' }}>
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="mobile-menu__link"
                    onClick={() => handleNavClick(link.href)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <a href={ctaLink} className="btn btn--primary" style={{ marginTop: 'auto' }} target="_blank" rel="noopener noreferrer">
                Reservasi Meja
              </a>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
