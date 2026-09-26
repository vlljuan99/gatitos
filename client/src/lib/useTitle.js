import { useEffect } from 'react';

export function useTitle(title) {
  useEffect(() => {
    if (!title) return;
    document.title = title.startsWith('Bigotes') ? title : `${title} · Bigotes`;
  }, [title]);
}
