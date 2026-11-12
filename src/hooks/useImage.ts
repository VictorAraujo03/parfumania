import { useEffect, useState } from 'react';
import { useAppData } from './useAppData';

const cache = new Map<string, string>();

/**
 * Carrega uma imagem do repositório (local ou nuvem), com cache em memória.
 * `loading` é true enquanto a imagem ainda está chegando.
 */
export function useImageState(imageId: string | undefined): { url?: string; loading: boolean } {
  const { dataSource } = useAppData();
  const [state, setState] = useState<{ id?: string; url?: string; loading: boolean }>(() => {
    const hit = imageId ? cache.get(imageId) : undefined;
    return { id: imageId, url: hit, loading: !!imageId && !hit };
  });

  useEffect(() => {
    if (!imageId) {
      setState({ id: undefined, url: undefined, loading: false });
      return;
    }
    const hit = cache.get(imageId);
    if (hit) {
      setState({ id: imageId, url: hit, loading: false });
      return;
    }
    let cancelled = false;
    setState({ id: imageId, url: undefined, loading: true });
    dataSource.images
      .get(imageId)
      .then((u) => {
        if (u) cache.set(imageId, u);
        if (!cancelled) setState({ id: imageId, url: u, loading: false });
      })
      .catch(() => !cancelled && setState({ id: imageId, url: undefined, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [imageId, dataSource]);

  // Enquanto o efeito não rodou para um id novo, já trata como carregando.
  if (state.id !== imageId) return { url: imageId ? cache.get(imageId) : undefined, loading: !!imageId && !cache.has(imageId) };
  return { url: state.url, loading: state.loading };
}

/** Atalho: só a URL. */
export function useImage(imageId: string | undefined): string | undefined {
  return useImageState(imageId).url;
}
