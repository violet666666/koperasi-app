import { MapPin, Clock, Phone, Mail } from 'lucide-react';
import type { WebsiteContent } from '../api/content';

interface LocationMapProps {
  content: WebsiteContent;
}

export default function LocationMap({ content }: LocationMapProps) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Lokasi</p>
          <h2 className="section-title">Temukan Kami</h2>
        </div>

        <div className="split">
          <div className="location-map__info">
            {content.address && (
              <div className="location-map__item">
                <div className="location-map__icon">
                  <MapPin size={20} />
                </div>
                <div>
                  <div className="location-map__label">Alamat</div>
                  <div className="location-map__value">{content.address}</div>
                </div>
              </div>
            )}
            {content.hours && (
              <div className="location-map__item">
                <div className="location-map__icon">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="location-map__label">Jam Buka</div>
                  <div className="location-map__value">{content.hours}</div>
                </div>
              </div>
            )}
            {content.phone && (
              <div className="location-map__item">
                <div className="location-map__icon">
                  <Phone size={20} />
                </div>
                <div>
                  <div className="location-map__label">Telepon</div>
                  <div className="location-map__value">{content.phone}</div>
                </div>
              </div>
            )}
            {content.email && (
              <div className="location-map__item">
                <div className="location-map__icon">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="location-map__label">Email</div>
                  <div className="location-map__value">{content.email}</div>
                </div>
              </div>
            )}
          </div>

          <div className="location-map__embed">
            {content.mapsEmbed ? (
              <iframe
                src={content.mapsEmbed}
                title="Lokasi Latar Cafe & Resto"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--latar-bg-warm)',
                color: 'var(--latar-text-muted)',
                fontSize: '0.9rem',
                flexDirection: 'column',
                gap: '0.5rem',
              }}>
                <MapPin size={40} style={{ opacity: 0.3 }} />
                <span>Peta segera hadir</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
