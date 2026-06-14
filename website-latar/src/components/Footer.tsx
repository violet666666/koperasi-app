import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import type { WebsiteContent } from '../api/content';

interface FooterProps {
  content: WebsiteContent;
}

export default function Footer({ content }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer" id="kontak">
      <div className="container">
        <div className="footer__grid">
          {/* Column 1: Brand */}
          <div>
            <div className="footer__logo">
              <img src={content.logoUrl || "/LogoPrimkoppol.png"} alt="Logo" className="footer__logo-img" />
              <span className="footer__logo-text">{content.brandName}</span>
            </div>
            <p className="footer__desc">
              Dikelola oleh Koperasi PRIMKOPPOL Resor Lumajang.<br />
              Menyajikan cita rasa autentik dan cerita di setiap sajian.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="footer__heading">Tautan</h4>
            <Link to="/" className="footer__link">Beranda</Link>
            <Link to="/tentang-kami" className="footer__link">Tentang Kami</Link>
            <a href="/#menu" className="footer__link">Menu</a>
          </div>

          {/* Column 3: Kontak */}
          <div>
            <h4 className="footer__heading">Kontak</h4>
            {content.address && (
              <p className="footer__link" style={{ cursor: 'default' }}>
                {content.address}
              </p>
            )}
            {content.email && (
              <a href={`mailto:${content.email}`} className="footer__link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} /> {content.email}
              </a>
            )}
            {content.phone && (
              <a href={`tel:${content.phone}`} className="footer__link" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={14} /> {content.phone}
              </a>
            )}
          </div>

          {/* Column 4: Social */}
          <div>
            <h4 className="footer__heading">Ikuti Kami</h4>
            <div className="footer__social">
              {content.socialInstagram && (
                <a href={content.socialInstagram} className="footer__social-icon" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>
              )}
              {content.socialTiktok && (
                <a href={content.socialTiktok} className="footer__social-icon" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
                </a>
              )}
              {content.socialFacebook && (
                <a href={content.socialFacebook} className="footer__social-icon" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
              )}
            </div>
            {!content.socialInstagram && !content.socialTiktok && !content.socialFacebook && (
              <p className="footer__desc" style={{ fontSize: '0.85rem' }}>Segera hadir di social media!</p>
            )}
          </div>
        </div>

        <div className="footer__bottom">
          © {currentYear} {content.brandName} — PRIMKOPPOL Resor Lumajang. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
