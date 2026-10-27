import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Droplet } from 'lucide-react';
import { Button } from '../../components/Button';
import { PerfumeImage } from '../../components/PerfumeImage';
import { Badge, DemoBadge, ScoreRing } from '../../components/ui';
import { CONCENTRATION_SHORT } from '../../data/options';
import type { Recommendation } from '../../services/recommendations/engine';
import { CONFIDENCE_LABEL, ScoreBreakdown } from './ScoreBreakdown';

interface RecommendationCardProps {
  rec: Recommendation;
  rank?: number;
  featured?: boolean;
  onRegister(rec: Recommendation): void;
}

export function RecommendationCard({ rec, rank, featured, onRegister }: RecommendationCardProps) {
  const [open, setOpen] = useState(false);
  const p = rec.perfume;
  const tone = rec.confidenceLevel === 'high' ? 'success' : rec.confidenceLevel === 'medium' ? 'gold' : 'warning';

  return (
    <article className={`rec-card ${featured ? 'rec-card--featured' : ''}`}>
      <div className="rec-card__top">
        <Link to={`/colecao/${p.id}`} className="rec-card__media">
          <PerfumeImage imageId={p.imageId} name={p.name} brand={p.brand} family={p.family} />
        </Link>
        <div className="rec-card__info">
          {rank !== undefined && <span className="rec-card__rank">#{rank}</span>}
          <p className="eyebrow">{p.brand}</p>
          <h3 className="rec-card__name">
            <Link to={`/colecao/${p.id}`}>{p.name}</Link>
          </h3>
          <div className="rec-card__badges">
            {p.concentration && <Badge>{CONCENTRATION_SHORT[p.concentration]}</Badge>}
            <Badge tone={tone}>{CONFIDENCE_LABEL[rec.confidenceLevel]}</Badge>
            {p.status === 'decant' && <Badge>Decant</Badge>}
            {p.isDemo && <DemoBadge />}
          </div>
          {rec.highlights.length > 0 ? (
            <ul className="rec-card__reasons">
              {rec.highlights.slice(0, featured ? 3 : 2).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Nenhum critério combinou plenamente. Veja a justificativa.</p>
          )}
        </div>
        <ScoreRing score={rec.score} size={featured ? 76 : 60} muted={rec.confidenceLevel === 'low'} />
      </div>
      <div className="rec-card__actions">
        <Button variant={featured ? 'primary' : 'secondary'} size="sm" icon={Droplet} onClick={() => onRegister(rec)}>
          Registrar uso
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Ocultar justificativa' : 'Por que este perfume?'}
          <ChevronDown size={15} className={`chevron ${open ? 'is-open' : ''}`} aria-hidden />
        </Button>
      </div>
      {open && <ScoreBreakdown rec={rec} />}
    </article>
  );
}
