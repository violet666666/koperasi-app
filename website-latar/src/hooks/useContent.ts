import { useState, useEffect } from 'react';
import { fetchContent, DEFAULT_CONTENT, type WebsiteContent } from '../api/content';

export function useContent() {
  const [content, setContent] = useState<WebsiteContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent()
      .then(setContent)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { content, loading };
}
