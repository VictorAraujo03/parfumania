import { useEffect, useState } from 'react';
import { useAppData } from './useAppData';

const cache = new Map<string, string>();

/** Carrega uma imagem do repositório local, com cache em memória. */
export function useImage(imageId: string | undefined): string | undefined {
  const { dataSource } = useAppData();
  const [url, setUrl] = useState<string | undefined>(() => (imageId ? cache.get(imageId) : undefined));

  useEffect(() => {
    if (!imageId) {
      setUrl(undefined);
      return;
    }
    const hit = cache.get(imageId);
    if (hit) {
      setUrl(hit);
      return;
    }
    let cancelled = false;
    dataSource.images
      .get(imageId)
      .then((u) => {
        if (u) cache.set(imageId, u);
        if (!cancelled) setUrl(u);
      })
      .catch(() => !cancelled && setUrl(undefined));
    return () => {
      cancelled = true;
    };
  }, [imageId, dataSource]);

  return url;
}
