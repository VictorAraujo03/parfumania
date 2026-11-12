import type { Perfume, UsageLog } from '../../types';
import { addDays, startOfDay } from '../../utils/date';

export interface FavoriteSuggestion {
  perfume: Perfume;
  /** Usos nos últimos 7 dias. */
  count: number;
  /** Fração dos usos da semana que foram deste perfume (0–1). */
  share: number;
  /** Média das avaliações após o uso nesses 7 dias, se houver. */
  avgRating?: number;
  /** true quando nenhum outro perfume foi tão usado na semana. */
  top: boolean;
}

const WINDOW_DAYS = 7;
/** Depois de "Agora não", o perfume só volta a ser sugerido após este período. */
export const FAVORITE_SNOOZE_DAYS = 30;

/**
 * Sugere marcar como favorito um perfume que você usou com frequência nos
 * últimos 7 dias (3+ usos, ou 2+ usos se for metade da semana) e que ainda
 * não é favorito. Calculado só a partir dos seus registros.
 */
export function suggestFavorite(
  perfumes: Perfume[],
  logs: UsageLog[],
  dismissed: Record<string, string>,
  now = new Date(),
): FavoriteSuggestion | undefined {
  const start = startOfDay(addDays(now, -(WINDOW_DAYS - 1))).getTime();
  const recent = logs.filter((l) => {
    const t = Date.parse(l.usedAt);
    return t >= start && t <= now.getTime();
  });
  if (recent.length < 2) return undefined;

  const byPerfume = new Map<string, UsageLog[]>();
  for (const l of recent) byPerfume.set(l.perfumeId, [...(byPerfume.get(l.perfumeId) ?? []), l]);
  const maxCount = Math.max(...[...byPerfume.values()].map((v) => v.length));

  const snoozeLimit = addDays(now, -FAVORITE_SNOOZE_DAYS).getTime();
  const candidates = [...byPerfume.entries()]
    .map(([id, own]) => ({ perfume: perfumes.find((p) => p.id === id), own }))
    .filter((c): c is { perfume: Perfume; own: UsageLog[] } => {
      const p = c.perfume;
      if (!p || p.favorite || (p.status !== 'owned' && p.status !== 'decant')) return false;
      const snoozed = dismissed[p.id];
      if (snoozed && Date.parse(snoozed) > snoozeLimit) return false;
      const share = c.own.length / recent.length;
      return c.own.length >= 3 || (c.own.length >= 2 && share >= 0.5);
    })
    .sort((a, b) => b.own.length - a.own.length);

  const best = candidates[0];
  if (!best) return undefined;
  const rated = best.own.filter((l) => l.rating);
  return {
    perfume: best.perfume,
    count: best.own.length,
    share: best.own.length / recent.length,
    avgRating: rated.length ? rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length : undefined,
    top: best.own.length === maxCount,
  };
}
