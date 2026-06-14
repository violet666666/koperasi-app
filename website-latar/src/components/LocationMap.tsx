import { MapPin, Clock, Phone, Mail, Navigation } from 'lucide-react';
import type { WebsiteContent } from '../api/content';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useState } from 'react';

interface LocationMapProps {
  content: WebsiteContent;
}

// Exact coordinates for Primadana Car Wash & Resto, Jl. Minak Koncar No.52, Lumajang
const POSITION = {
  latitude: -8.1340333,
  longitude: 113.2220033,
};

const GOOGLE_MAPS_LINK = 'https://maps.app.goo.gl/NwcGC5E5igHb72ZY9?g_st=aw';

export default function LocationMap({ content }: LocationMapProps) {
  const [showPopup, setShowPopup] = useState(true);

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

            {/* Google Maps Direction Button */}
            <a
              href={GOOGLE_MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary"
              style={{ marginTop: '1rem' }}
            >
              <Navigation size={16} />
              Buka di Google Maps
            </a>
          </div>

          <div className="location-map__embed" style={{ position: 'relative', zIndex: 1 }}>
            <Map
              initialViewState={{
                longitude: POSITION.longitude,
                latitude: POSITION.latitude,
                zoom: 15,
                pitch: 45,
              }}
              style={{ width: '100%', height: '100%', minHeight: '400px' }}
              mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
              scrollZoom={false}
              dragRotate={true}
            >
              <NavigationControl position="top-right" />

              <Marker
                longitude={POSITION.longitude}
                latitude={POSITION.latitude}
                anchor="bottom"
                onClick={() => setShowPopup(true)}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50% 50% 50% 0',
                  background: 'linear-gradient(135deg, #C0582A, #D4763E)',
                  transform: 'rotate(-45deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(192, 88, 42, 0.4)',
                  cursor: 'pointer',
                  border: '3px solid white',
                }}>
                  <MapPin size={18} color="white" style={{ transform: 'rotate(45deg)' }} />
                </div>
              </Marker>

              {showPopup && (
                <Popup
                  longitude={POSITION.longitude}
                  latitude={POSITION.latitude}
                  anchor="bottom"
                  offset={[0, -45]}
                  onClose={() => setShowPopup(false)}
                  closeOnClick={false}
                >
                  <div style={{ padding: '4px 8px', fontFamily: 'Inter, sans-serif' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#1E5128' }}>
                      {content.brandName}
                    </strong>
                    <p style={{ fontSize: '0.8rem', color: '#7A7267', margin: '4px 0 0' }}>
                      Jl. Minak Koncar No.52, Lumajang
                    </p>
                  </div>
                </Popup>
              )}
            </Map>
          </div>
        </div>
      </div>
    </section>
  );
}
