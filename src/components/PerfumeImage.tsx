import { useState } from 'react';
import { FAMILY_HUES } from '../data/options';
import { useImageState } from '../hooks/useImage';
import type { OlfactoryFamily } from '../types';
import { hashString } from '../utils/text';

interface PerfumeImageProps {
  imageId?: string;
  /** Pré-visualização direta (formulário). */
  src?: string;
  /** Foto de loja escolhida pelo usuário (link externo), usada se não houver foto própria. */
  imageUrl?: string;
  name: string;
  brand?: string;
  family?: OlfactoryFamily;
  className?: string;
}

const SHAPES = ['round', 'tall', 'square'] as const;

/**
 * Foto do perfume (própria, de loja ou oficial) ou um placeholder elegante em SVG.
 * Enquanto a foto chega, mostra um brilho de carregamento; ao chegar, ela entra
 * com um esmaecer suave (sem o placeholder "pular" para a foto).
 */
export function PerfumeImage({ imageId, src, imageUrl, name, brand, family, className = '' }: PerfumeImageProps) {
  const { url: stored, loading } = useImageState(src ? undefined : imageId);
  const [broken, setBroken] = useState<string>();
  const [loaded, setLoaded] = useState<string>();
  const remote = imageUrl && imageUrl !== broken ? imageUrl : undefined;
  // Com foto própria ainda carregando, espera por ela em vez de mostrar a de loja primeiro.
  const url = src ?? stored ?? (loading ? undefined : remote);

  if (url) {
    const ready = loaded === url;
    return (
      <div
        className={`perfume-image ${remote && url === remote ? 'perfume-image--remote' : ''} ${ready ? 'is-loaded' : 'is-loading'} ${className}`}
        aria-busy={!ready}
      >
        <img
          src={url}
          alt={`Frasco de ${name}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(url)}
          onError={() => (url === remote ? setBroken(remote) : setLoaded(url))}
        />
      </div>
    );
  }
  if (loading) {
    return <div className={`perfume-image is-loading ${className}`} aria-busy="true" aria-label={`Carregando a foto de ${name}`} role="img" />;
  }
  return <BottlePlaceholder name={name} brand={brand} family={family} className={className} />;
}

function BottlePlaceholder({ name, brand, family, className }: Omit<PerfumeImageProps, 'imageId' | 'src' | 'imageUrl'>) {
  const h = hashString(`${brand ?? ''}${name}`);
  const hue = FAMILY_HUES[family ?? 'other'];
  const shape = SHAPES[h % SHAPES.length];
  const gid = `g${h}`;
  const body =
    shape === 'round' ? (
      <ellipse cx="60" cy="98" rx="34" ry="36" />
    ) : shape === 'tall' ? (
      <rect x="36" y="56" width="48" height="80" rx="8" />
    ) : (
      <rect x="28" y="64" width="64" height="68" rx="12" />
    );
  return (
    <div className={`perfume-image perfume-image--placeholder ${className}`} aria-label={`Sem imagem: ${name}`} role="img">
      <svg viewBox="0 0 120 150" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={hue} stopOpacity="0.55" />
            <stop offset="1" stopColor={hue} stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <rect x="52" y="22" width="16" height="14" rx="2" className="ph-cap" />
        <rect x="47" y="36" width="26" height="8" rx="2" className="ph-neck" />
        <g fill={`url(#${gid})`} className="ph-body">
          {body}
        </g>
        <path d="M44 118 q16 -8 32 0" className="ph-line" />
      </svg>
    </div>
  );
}
