import { MapPin } from 'lucide-react';

interface CtaBannerProps {
  ctaLink?: string;
  brandName?: string;
}

export default function CtaBanner({ ctaLink = '#', brandName = 'Cafe & Resto LSP' }: CtaBannerProps) {
  return (
    <section className="cta-banner">
      <div className="container">
        <h2 className="cta-banner__title">
          Lapar? Atau sekadar ingin ngopi santai?
        </h2>
        <p className="cta-banner__text">
          {brandName} menanti kehadiran Anda. Datang langsung atau reservasi meja terlebih dahulu.
        </p>
        <a
          href={ctaLink}
          className="btn btn--outline btn--lg"
          target="_blank"
          rel="noopener noreferrer"
        >
          <MapPin size={18} />
          Kunjungi Kami Sekarang
        </a>
      </div>
    </section>
  );
}
