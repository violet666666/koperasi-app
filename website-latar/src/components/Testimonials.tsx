import { useState, useEffect, useRef, useCallback } from 'react';
import { Star } from 'lucide-react';
import type { Testimonial } from '../api/content';

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const totalSlides = testimonials.length;

  const scrollToIndex = useCallback((index: number) => {
    if (!trackRef.current) return;
    const card = trackRef.current.children[index] as HTMLElement;
    if (card) {
      trackRef.current.scrollTo({ left: card.offsetLeft - 16, behavior: 'smooth' });
    }
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    if (isPaused || totalSlides <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % totalSlides;
        scrollToIndex(next);
        return next;
      });
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPaused, totalSlides, scrollToIndex]);

  return (
    <section className="section section--warm">
      <div className="container">
        <div className="section-header">
          <p className="section-label">Testimoni</p>
          <h2 className="section-title">Apa Kata Pelanggan Kami</h2>
          <p className="section-subtitle">
            Cerita nyata dari mereka yang telah merasakan pengalaman di Latar.
          </p>
        </div>

        <div
          className="testimonials-track"
          ref={trackRef}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {testimonials.map((t, i) => (
            <div className="testimonial-card" key={i}>
              <span className="testimonial-card__quote">"</span>
              <div className="testimonial-card__stars">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    size={16}
                    fill={si < t.rating ? '#F59E0B' : 'none'}
                    className={si < t.rating ? 'testimonial-card__star' : 'testimonial-card__star--empty'}
                  />
                ))}
              </div>
              <p className="testimonial-card__text">{t.text}</p>
              <div className="testimonial-card__author">
                <div className="testimonial-card__avatar">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="testimonial-card__name">{t.name}</div>
                  {t.role && <div className="testimonial-card__role">{t.role}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="testimonials-dots">
          {testimonials.map((_, i) => (
            <button
              key={i}
              className={`testimonials-dot ${i === activeIndex ? 'testimonials-dot--active' : ''}`}
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
