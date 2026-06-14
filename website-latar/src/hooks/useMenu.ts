import { useState, useEffect, useMemo } from 'react';
import { fetchMenuItems, type MenuItem } from '../api/menu';

export function useMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenuItems()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    for (const item of items) {
      const cat = item.category ?? 'Lainnya';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    }
    return grouped;
  }, [items]);

  return { items, categories, loading };
}
