import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Button } from '../../components/Button';
import { PerfumeImage } from '../../components/PerfumeImage';
import { useAppData } from '../../hooks/useAppData';
import { useLocalPref } from '../../hooks/useLocalPref';
import { useToast } from '../../hooks/useToast';
import { suggestFavorite } from './favoriteSuggestion';

/** "Você usou X com frequência nos últimos 7 dias — ele é um dos seus favoritos?" */
export function FavoriteSuggestionCard() {
  const { perfumes, usageLogs, toggleFavorite } = useAppData();
  const { notify } = useToast();
  const [dismissed, setDismissed] = useLocalPref<Record<string, string>>('favoriteSnoozed', {});
  const s = useMemo(() => suggestFavorite(perfumes, usageLogs, dismissed), [perfumes, usageLogs, dismissed]);
  if (!s) return null;

  const p = s.perfume;
  const times = s.count === 1 ? '1 vez' : `${s.count} vezes`;
  const extra = [
    s.top ? 'mais do que qualquer outro da coleção' : `${Math.round(s.share * 100)}% dos seus usos da semana`,
    s.avgRating !== undefined ? `com nota média ${s.avgRating.toFixed(1)}/5` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <section className="fav-suggest" aria-live="polite">
      <Link to={`/colecao/${p.id}`} className="fav-suggest__media">
        <PerfumeImage imageId={p.imageId} imageUrl={p.imageUrl} name={p.name} brand={p.brand} family={p.family} />
      </Link>
      <div className="fav-suggest__body">
        <p className="fav-suggest__text">
          Nos últimos 7 dias você usou o <strong>{p.name}</strong> {times} — {extra}. Ele é um dos seus favoritos?
        </p>
        <div className="fav-suggest__actions">
          <Button
            size="sm"
            variant="primary"
            icon={Heart}
            onClick={async () => {
              await toggleFavorite(p.id);
              notify(`${p.name} agora está nos seus favoritos.`);
            }}
          >
            Sim, favoritar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed({ ...dismissed, [p.id]: new Date().toISOString() })}>
            Agora não
          </Button>
        </div>
      </div>
    </section>
  );
}
