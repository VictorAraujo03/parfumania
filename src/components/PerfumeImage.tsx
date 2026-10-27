import { FAMILY_HUES } from '../data/options';
import { useImage } from '../hooks/useImage';
import type { OlfactoryFamily } from '../types';
import { hashString } from '../utils/text';

interface PerfumeImageProps {
  imageId?: string;
  /** Pré-visualização direta (formulário). */
  src?: string;
  name: string;
  brand?: string;
  family?: OlfactoryFamily;
  className?: string;
}

const SHAPES = ['round', 'tall', 'square'] as const;

/** Imagem local do perfume ou um placeholder elegante gerado em SVG. */
export function PerfumeImage({ imageId, src, name, brand, family, className = '' }: PerfumeImageProps) {
  const stored = useImage(src ? undefined : imageId);
  const url = src ?? stored;

  if (url) {
    return (
      <div className={`perfume-image ${className}`}>
        <img src={url} alt={`Frasco de ${name}`} loading="lazy" />
      </div>
    );
  }
  return <BottlePlaceholder name={name} brand={brand} family={family} className={className} />;
}

function BottlePlaceholder({ name, brand, family, className }: Omit<PerfumeImageProps, 'imageId' | 'src'>) {
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
