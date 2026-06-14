import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL;

export interface WebsiteContent {
  brandName: string;
  logoUrl: string;
  heroBgUrl: string;
  aboutImageUrl: string;
  heroHeadline: string;
  heroSubheadline: string;
  ctaReservasiLink: string;
  aboutStory: string;
  visi: string;
  misi: string[];
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  hours: string;
  mapsEmbed: string;
  socialInstagram: string;
  socialTiktok: string;
  socialFacebook: string;
  testimonials: Testimonial[];
  gallery: GalleryItem[];
}

export interface Testimonial {
  name: string;
  rating: number;
  text: string;
  role?: string;
}

export interface GalleryItem {
  url: string;
  caption: string;
}

const DEFAULT_CONTENT: WebsiteContent = {
  brandName: 'Cafe & Resto LSP',
  logoUrl: '/LogoPrimkoppol.png',
  heroBgUrl: '/images/hero-bg.webp',
  aboutImageUrl: '/images/brand-story.webp',
  heroHeadline: 'Cita Rasa Autentik di Setiap Sudut Latar.',
  heroSubheadline: 'Nikmati sajian istimewa mulai dari Nasi Goreng rempah hingga Ice Americano segar, dengan suasana yang membuat Anda betah berlama-lama.',
  ctaReservasiLink: '#',
  aboutStory: 'Cafe Latar adalah unit bisnis unggulan Koperasi PRIMKOPPOL Resor Lumajang yang menyajikan kuliner nusantara dan aneka kopi pilihan. Didirikan dengan semangat melayani anggota koperasi dan masyarakat umum, kami mengedepankan kualitas bahan, cita rasa otentik, dan pelayanan berstandar modern.\n\nDengan dukungan sistem Point of Sales termutakhir, setiap pengalaman makan di Latar dirancang untuk memberikan kenyamanan dan kepuasan maksimal bagi setiap pengunjung.',
  visi: 'Menjadi destinasi kuliner dan kopi nomor satu yang mengedepankan kualitas dan pemberdayaan ekonomi koperasi.',
  misi: [
    'Menyajikan hidangan dari bahan-bahan segar berkualitas tinggi',
    'Berinovasi dalam menu untuk memberikan pengalaman kuliner yang unik',
    'Memberikan pelayanan berstandar modern dengan teknologi terkini',
    'Memberdayakan ekonomi anggota koperasi melalui unit usaha yang berkelanjutan',
  ],
  address: 'Jl. Minak Koncar No.52, Ditotrunan, Citrodiwangsan, Kec. Lumajang, Kabupaten Lumajang, Jawa Timur 67312',
  phone: '',
  whatsapp: '',
  email: 'kasirresto@koperasi.com',
  hours: 'Senin - Minggu 08.00 - 22.00',
  mapsEmbed: '',
  socialInstagram: '',
  socialTiktok: '',
  socialFacebook: '',
  testimonials: [
    { name: 'Budi Santoso', rating: 5, text: 'Ayam bakar bumbu rujak khas Latar benar-benar bikin ketagihan! Tempatnya juga nyaman untuk kumpul keluarga.', role: 'Pelanggan Setia' },
    { name: 'Sari Dewi', rating: 5, text: 'Ice Americano-nya juara! Suasana cafe-nya juga sangat estetik, cocok buat kerja remote sambil ngopi.', role: 'Coffee Lover' },
    { name: 'Ahmad Fauzi', rating: 4, text: 'Pelayanannya cepat dan modern, bisa bayar pakai QRIS. Nasi goreng rempahnya porsinya besar dan enaaak!', role: 'Mahasiswa' },
    { name: 'Ratna Ningrum', rating: 5, text: 'Tempat favorit untuk makan siang. Split bill-nya memudahkan banget kalau nongkrong bareng teman-teman kantor.', role: 'Karyawan Swasta' },
    { name: 'Dimas Prasetyo', rating: 5, text: 'Baru pertama kali mampir tapi langsung jatuh cinta. Menu dan suasana cafe ini premium banget.', role: 'Foodie' },
  ],
  gallery: [
    { url: '/images/gallery/indoor-1.webp', caption: 'Area Indoor yang Nyaman' },
    { url: '/images/gallery/indoor-2.webp', caption: 'Suasana Dine-In' },
    { url: '/images/gallery/outdoor-1.webp', caption: 'Area Outdoor Asri' },
    { url: '/images/gallery/barista.webp', caption: 'Barista Meracik Kopi' },
    { url: '/images/gallery/food-detail.webp', caption: 'Sajian Lezat Latar' },
    { url: '/images/gallery/kasir.webp', caption: 'Sistem POS Modern' },
  ],
};

const resolveUrl = (url: string | undefined, fallback: string) => {
  if (!url) return fallback;
  if (url.startsWith('/api/uploads')) {
    return `https://www.primkoppol.site${url}`;
  }
  return url;
};

export async function fetchContent(): Promise<WebsiteContent> {
  if (!DATABASE_URL) return DEFAULT_CONTENT;

  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT key, value FROM app_settings WHERE key LIKE 'latar_%'
    `;

    if (rows.length === 0) return DEFAULT_CONTENT;

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key as string] = row.value as string;
    }

    return {
      brandName: settings['latar_brand_name'] || DEFAULT_CONTENT.brandName,
      logoUrl: resolveUrl(settings['latar_logo_url'], DEFAULT_CONTENT.logoUrl),
      heroBgUrl: resolveUrl(settings['latar_hero_bg_url'], DEFAULT_CONTENT.heroBgUrl),
      aboutImageUrl: resolveUrl(settings['latar_about_image_url'], DEFAULT_CONTENT.aboutImageUrl),
      heroHeadline: settings['latar_hero_headline'] || DEFAULT_CONTENT.heroHeadline,
      heroSubheadline: settings['latar_hero_subheadline'] || DEFAULT_CONTENT.heroSubheadline,
      ctaReservasiLink: settings['latar_cta_reservasi_link'] || DEFAULT_CONTENT.ctaReservasiLink,
      aboutStory: settings['latar_about_story'] || DEFAULT_CONTENT.aboutStory,
      visi: settings['latar_visi'] || DEFAULT_CONTENT.visi,
      misi: safeParseJSON(settings['latar_misi'], DEFAULT_CONTENT.misi),
      address: settings['latar_address'] || DEFAULT_CONTENT.address,
      phone: settings['latar_phone'] || DEFAULT_CONTENT.phone,
      whatsapp: settings['latar_whatsapp'] || DEFAULT_CONTENT.whatsapp,
      email: settings['latar_email'] || DEFAULT_CONTENT.email,
      hours: settings['latar_hours'] || DEFAULT_CONTENT.hours,
      mapsEmbed: settings['latar_maps_embed'] || DEFAULT_CONTENT.mapsEmbed,
      socialInstagram: settings['latar_social_instagram'] || DEFAULT_CONTENT.socialInstagram,
      socialTiktok: settings['latar_social_tiktok'] || DEFAULT_CONTENT.socialTiktok,
      socialFacebook: settings['latar_social_facebook'] || DEFAULT_CONTENT.socialFacebook,
      testimonials: safeParseJSON(settings['latar_testimonials'], DEFAULT_CONTENT.testimonials),
      gallery: safeParseJSON(settings['latar_gallery'], DEFAULT_CONTENT.gallery).map((g: GalleryItem) => ({
        ...g,
        url: resolveUrl(g.url, g.url)
      })),
    };
  } catch (err) {
    console.error('Failed to fetch website content:', err);
    return DEFAULT_CONTENT;
  }
}

function safeParseJSON<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export { DEFAULT_CONTENT };
