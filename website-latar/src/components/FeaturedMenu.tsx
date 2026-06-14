import { motion } from 'framer-motion';
import { useMenu } from '../hooks/useMenu';
import type { MenuItem } from '../api/menu';

const FALLBACK_IMG = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%23F7F0E6" width="400" height="300"/><text fill="%23D4A574" font-family="serif" font-size="48" x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">🍽️</text></svg>';

const BEST_SELLERS = ['Ayam Bakar', 'Ice Americano', 'Caffè Latte', 'Nasi Goreng'];

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

function isBestSeller(name: string): boolean {
  return BEST_SELLERS.some(bs => name.toLowerCase().includes(bs.toLowerCase()));
}

export function SkeletonCard() {
  return (
    <div className="menu-card">
      <div className="skeleton skeleton--image" />
      <div className="card__body">
        <div className="skeleton skeleton--text" style={{ width: '70%' }} />
        <div className="skeleton skeleton--text" style={{ width: '90%' }} />
        <div className="skeleton skeleton--text" style={{ width: '40%', marginTop: '0.75rem' }} />
      </div>
    </div>
  );
}

export function MenuCard({ item }: { item: MenuItem }) {
  return (
    <motion.div
      className="menu-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="menu-card__image-wrapper">
        <img
          className="menu-card__image"
          src={item.imageUrl || FALLBACK_IMG}
          alt={item.name}
          loading="lazy"
        />
        <div className="menu-card__overlay" />
        {isBestSeller(item.name) && (
          <span className="card__badge card__badge--bestseller">Best Seller</span>
        )}
      </div>
      <div className="menu-card__body">
        <h3 className="menu-card__name">{item.name}</h3>
        <div className="menu-card__footer">
          <span className="menu-card__price">{formatRupiah(item.sellPrice)}</span>
          {item.category && <span className="menu-card__category">{item.category}</span>}
        </div>
      </div>
    </motion.div>
  );
}

import { Link } from 'react-router-dom';

export default function FeaturedMenu() {
  const { items, loading } = useMenu();

  // Show max 6 items on landing page
  const displayItems = items.slice(0, 6);

  return (
    <section className="section" id="menu">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Menu Favorit</p>
          <h2 className="section-title">Sajian Terbaik Kami</h2>
          <p className="section-subtitle">
            Pilihan menu andalan yang selalu dinantikan. Dari hidangan utama hingga kopi racikan barista.
          </p>
        </div>

        <div className="grid-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : displayItems.map((item) => <MenuCard key={item.id} item={item} />)
          }
        </div>

        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <Link to="/menu" className="btn btn--outline-dark btn--lg">
            Lihat Detail Menu
          </Link>
        </div>
      </div>
    </section>
  );
}
