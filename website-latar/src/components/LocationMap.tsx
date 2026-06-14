import { MapPin, Clock, Phone, Mail } from 'lucide-react';
import type { WebsiteContent } from '../api/content';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in leaflet with bundlers
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationMapProps {
  content: WebsiteContent;
}

export default function LocationMap({ content }: LocationMapProps) {
  // Approximate coordinates for Jl. Minak Koncar, Ditotrunan, Lumajang
  const position: [number, number] = [-8.131113, 113.224167];

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

          <div className="location-map__embed" style={{ position: 'relative', zIndex: 1 }}>
            <MapContainer 
              center={position} 
              zoom={16} 
              scrollWheelZoom={false}
              style={{ width: '100%', height: '100%', minHeight: '400px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={position}>
                <Popup>
                  <strong>{content.brandName}</strong><br />
                  Menanti kunjungan Anda.
                </Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
