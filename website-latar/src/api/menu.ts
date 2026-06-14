import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL;

export interface MenuItem {
  id: number;
  name: string;
  category: string | null;
  sellPrice: number;
  imageUrl: string | null;
}

const resolveUrl = (url: string | null) => {
  if (!url) return null;
  if (url.startsWith('/api/uploads')) {
    return `https://www.primkoppol.site${url}`;
  }
  return url;
};

export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (!DATABASE_URL) {
    console.warn('VITE_DATABASE_URL not set, using fallback menu data');
    return getFallbackMenu();
  }
  try {
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT id, name, category, sell_price, image_url
      FROM store_products
      WHERE unit_type IN ('resto', 'resto_cafe', 'coffe_latar')
        AND is_active = true
        AND deleted_at IS NULL
        AND product_type = 'finished'
      ORDER BY category, name
    `;
    if (rows.length === 0) return getFallbackMenu();
    return rows.map(row => ({
      id: row.id as number,
      name: row.name as string,
      category: row.category as string | null,
      sellPrice: Number(row.sell_price),
      imageUrl: resolveUrl(row.image_url as string | null),
    }));
  } catch (err) {
    console.error('Failed to fetch menu from DB:', err);
    return getFallbackMenu();
  }
}

function getFallbackMenu(): MenuItem[] {
  return [
    { id: 1, name: 'Ayam Bakar Bumbu Rujak', category: 'Makanan', sellPrice: 25000, imageUrl: '/images/menu/ayam-bakar.webp' },
    { id: 2, name: 'Ayam Katsu', category: 'Makanan', sellPrice: 22000, imageUrl: '/images/menu/ayam-katsu.webp' },
    { id: 3, name: 'Nasi Goreng Rempah', category: 'Makanan', sellPrice: 20000, imageUrl: '/images/menu/nasi-goreng.webp' },
    { id: 4, name: 'Ice Americano', category: 'Minuman', sellPrice: 15000, imageUrl: '/images/menu/ice-americano.webp' },
    { id: 5, name: 'Caffè Latte', category: 'Minuman', sellPrice: 18000, imageUrl: '/images/menu/coffee-latte.webp' },
    { id: 6, name: 'Air Mineral', category: 'Minuman', sellPrice: 5000, imageUrl: null },
  ];
}
