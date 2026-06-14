import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useMenu } from '../hooks/useMenu';
import { useContent } from '../hooks/useContent';
import { MenuCard, SkeletonCard } from '../components/FeaturedMenu';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function FullMenuPage() {
  const { items, loading } = useMenu();
  const { content } = useContent();
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    document.title = `Daftar Menu — ${content.brandName || 'Cafe & Resto LSP'}`;
    window.scrollTo(0, 0);
  }, [content.brandName]);

  const categories = useMemo(() => {
    const cats = new Set(items.map(item => item.category || 'Lainnya'));
    return ['All', ...Array.from(cats)];
  }, [items]);

  const displayedItems = useMemo(() => {
    if (activeCategory === 'All') return items;
    return items.filter(item => (item.category || 'Lainnya') === activeCategory);
  }, [items, activeCategory]);

  return (
    <>
      <Navbar ctaLink={content.ctaReservasiLink} brandName={content.brandName} logoUrl={content.logoUrl} />
      <main className="menu-page" style={{ paddingTop: '80px', minHeight: '80vh', backgroundColor: 'var(--latar-bg)' }}>
        <section className="section">
          <div className="container">
            <div className="section-header">
              <p className="section-label">Daftar Menu</p>
              <h1 className="section-title">Menu {content.brandName}</h1>
              <p className="section-subtitle">
                Jelajahi seluruh koleksi sajian kami, mulai dari makanan utama yang menggugah selera hingga minuman segar.
              </p>
            </div>

            {/* Category Filter */}
            {!loading && categories.length > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2rem' }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`btn ${activeCategory === cat ? 'btn--primary' : 'btn--outline'}`}
                    style={{ borderRadius: '20px', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                  >
                    {cat === 'All' ? 'Semua Menu' : cat}
                  </button>
                ))}
              </div>
            )}

            {/* Menu Grid */}
            <div className="grid-3">
              {loading
                ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
                : displayedItems.map((item) => <MenuCard key={item.id} item={item} />)
              }
            </div>

            {!loading && displayedItems.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--latar-text-muted)' }}>
                Tidak ada menu untuk kategori ini.
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer content={content} />
    </>
  );
}
