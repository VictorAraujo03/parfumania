import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PerfumeImage } from '../../components/PerfumeImage';
import { RatingDisplay } from '../../components/ScaleInput';
import { Badge, DemoBadge } from '../../components/ui';
import { CONCENTRATION_SHORT, FAMILIES, STATUSES, labelOf } from '../../data/options';
import { useAppData } from '../../hooks/useAppData';
import type { Perfume } from '../../types';

function FavoriteButton({ perfume }: { perfume: Perfume }) {
  const { toggleFavorite } = useAppData();
  return (
    <button
      type="button"
      className={`fav-btn ${perfume.favorite ? 'is-on' : ''}`}
      aria-pressed={perfume.favorite}
      aria-label={perfume.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleFavorite(perfume.id);
      }}
    >
      <Heart size={17} aria-hidden />
    </button>
  );
}

function meta(p: Perfume): string {
  return [p.concentration ? CONCENTRATION_SHORT[p.concentration] : null, labelOf(FAMILIES, p.family) || null]
    .filter(Boolean)
    .join(' · ');
}

export function PerfumeCard({ perfume }: { perfume: Perfume }) {
  return (
    <Link to={`/colecao/${perfume.id}`} className="perfume-card">
      <div className="perfume-card__media">
        <PerfumeImage imageId={perfume.imageId} name={perfume.name} brand={perfume.brand} family={perfume.family} />
        <FavoriteButton perfume={perfume} />
        <div className="perfume-card__badges">
          {perfume.isDemo && <DemoBadge />}
          {perfume.status !== 'owned' && <Badge>{labelOf(STATUSES, perfume.status)}</Badge>}
        </div>
      </div>
      <div className="perfume-card__body">
        <p className="perfume-card__brand">{perfume.brand || 'Marca não informada'}</p>
        <h3 className="perfume-card__name">{perfume.name}</h3>
        <div className="perfume-card__meta">
          <span>{meta(perfume) || 'Sem detalhes'}</span>
          <RatingDisplay value={perfume.rating} size={12} />
        </div>
      </div>
    </Link>
  );
}

export function PerfumeRow({ perfume }: { perfume: Perfume }) {
  return (
    <Link to={`/colecao/${perfume.id}`} className="perfume-row">
      <PerfumeImage
        imageId={perfume.imageId}
        name={perfume.name}
        brand={perfume.brand}
        family={perfume.family}
        className="perfume-row__thumb"
      />
      <div className="perfume-row__main">
        <span className="perfume-row__name">{perfume.name}</span>
        <span className="perfume-row__brand">{perfume.brand}</span>
      </div>
      <span className="perfume-row__meta hide-mobile">{meta(perfume)}</span>
      <span className="perfume-row__meta hide-mobile">
        {perfume.remainingMl !== undefined && perfume.volumeMl
          ? `${perfume.remainingMl}/${perfume.volumeMl} ml`
          : perfume.volumeMl
            ? `${perfume.volumeMl} ml`
            : ''}
      </span>
      <span className="perfume-row__badges">
        {perfume.isDemo && <DemoBadge />}
        {perfume.status !== 'owned' && <Badge>{labelOf(STATUSES, perfume.status)}</Badge>}
      </span>
      <FavoriteButton perfume={perfume} />
    </Link>
  );
}
