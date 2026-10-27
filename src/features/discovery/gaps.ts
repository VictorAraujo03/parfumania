import { FAMILIES, OCCASIONS, labelOf } from '../../data/options';
import type {
  CatalogEntry,
  Occasion,
  OlfactoryFamily,
  Perfume,
  PriceOffer,
  Settings,
  UsageLog,
} from '../../types';
import { formatCurrency } from '../../utils/format';
import { perfumeKey } from '../../utils/text';
import { offerTotal } from '../prices/offers';

/**
 * Análise de lacunas baseada em regras explícitas. As associações entre
 * famílias e clima usadas nas SUGESTÕES são convenções comuns de perfumaria,
 * apresentadas como tal — nunca como regra.
 */

export interface Suggestion {
  entry: CatalogEntry;
  reasons: string[];
  score: number;
  overBudget?: boolean;
}

export interface Gap {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestions: Suggestion[];
  /** Explica por que não há sugestões, quando for o caso. */
  noSuggestionReason?: string;
}

export interface GapInput {
  perfumes: Perfume[];
  catalog: CatalogEntry[];
  settings: Settings;
  logs: UsageLog[];
  offers: PriceOffer[];
}

const famLabel = (f: OlfactoryFamily) => labelOf(FAMILIES, f).toLowerCase();
const occLabel = (o: Occasion) => labelOf(OCCASIONS, o).toLowerCase();

// Famílias deduzidas de acordes contam como "família" apenas para sugestão, nunca como fato.
const WARM_ASSOCIATED: OlfactoryFamily[] = ['citrus', 'aquatic', 'green', 'aromatic'];
const COLD_ASSOCIATED: OlfactoryFamily[] = ['amber', 'woody', 'gourmand', 'spicy'];
const CORE_FAMILIES: OlfactoryFamily[] = ['woody', 'citrus', 'floral', 'amber', 'aromatic', 'aquatic', 'gourmand', 'chypre'];

export function analyzeGaps({ perfumes, catalog, settings, logs, offers }: GapInput): Gap[] {
  const owned = perfumes.filter((p) => p.status === 'owned' || p.status === 'decant');
  const registeredKeys = new Set(perfumes.map((p) => perfumeKey(p.brand, p.name)));
  const registeredCatalogIds = new Set(perfumes.map((p) => p.catalogId).filter(Boolean));
  const disliked = new Set(settings.dislikedFamilies);
  const favorites = new Set(settings.favoriteFamilies);

  // Candidatos: entradas do catálogo que NÃO estão cadastradas (em qualquer status).
  const candidates = catalog.filter(
    (e) => !registeredCatalogIds.has(e.id) && !registeredKeys.has(perfumeKey(e.brand, e.name)),
  );

  const budgetInfo = (e: CatalogEntry): { reason: string; overBudget?: boolean } => {
    const key = perfumeKey(e.brand, e.name);
    const related = offers.filter((o) => perfumeKey(o.brand, o.perfumeName) === key);
    if (related.length === 0) {
      return { reason: settings.budget ? 'Sem preço registrado para comparar com seu orçamento.' : '' };
    }
    const best = related.reduce((a, b) => ((offerTotal(a) ?? a.price) <= (offerTotal(b) ?? b.price) ? a : b));
    const total = offerTotal(best) ?? best.price;
    const text = `Menor oferta registrada: ${formatCurrency(total)} em ${best.store}`;
    if (!settings.budget) return { reason: `${text}.` };
    return total <= settings.budget
      ? { reason: `${text} — dentro do orçamento de ${formatCurrency(settings.budget)}.` }
      : { reason: `${text} — acima do orçamento de ${formatCurrency(settings.budget)}.`, overBudget: true };
  };

  const suggest = (match: (e: CatalogEntry) => string | null, limit = 3): Suggestion[] =>
    candidates
      .filter((e) => !e.family || !disliked.has(e.family))
      .flatMap((e) => {
        const why = match(e);
        if (!why) return [];
        const reasons = [why];
        let score = 1;
        if (e.family && favorites.has(e.family)) {
          reasons.push(`${labelOf(FAMILIES, e.family)} está entre suas famílias favoritas.`);
          score += 1;
        }
        const occMatch = e.suggestedOccasions.filter((o) => settings.frequentOccasions.includes(o));
        if (occMatch.length) {
          reasons.push(`Sugestão editorial para ${occMatch.map(occLabel).join(', ')}, ocasiões que você usa com frequência.`);
          score += 0.5;
        }
        if (e.topNotes.length + e.heartNotes.length + e.baseNotes.length > 0) score += 0.3;
        score += Math.log10((e.popularity ?? 0) + 1) * 0.15;
        const b = budgetInfo(e);
        if (b.reason) reasons.push(b.reason);
        if (b.overBudget) score -= 1;
        return [{ entry: e, reasons, score, overBudget: b.overBudget }];
      })
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
      .slice(0, limit);

  const gaps: Gap[] = [];
  if (owned.length === 0) return gaps;

  // 1. Dados de clima incompletos (sem eles não é possível analisar climas).
  const withClimate = owned.filter((p) => p.climates.length > 0);
  if (withClimate.length < owned.length / 2) {
    gaps.push({
      id: 'climate-data',
      title: 'Climas preferenciais pouco preenchidos',
      description: `Só ${withClimate.length} de ${owned.length} perfumes têm climas indicados. Completar esses dados melhora as recomendações e esta análise.`,
      severity: 'medium',
      suggestions: [],
      noSuggestionReason: 'Edite seus perfumes e indique os climas em que você gosta de usá-los.',
    });
  }

  // 2. Dias quentes / frios (com base nos climas que VOCÊ marcou).
  const climateGap = (climate: 'hot' | 'cold', families: OlfactoryFamily[]) => {
    const count = owned.filter((p) => p.climates.includes(climate)).length;
    if (withClimate.length === 0 || count >= 2) return;
    const word = climate === 'hot' ? 'quentes' : 'frios';
    gaps.push({
      id: `climate-${climate}`,
      title: `Poucas opções para dias ${word}`,
      description: `Você marcou ${count} perfume${count === 1 ? '' : 's'} para dias ${word}.`,
      severity: count === 0 ? 'high' : 'medium',
      suggestions: suggest((e) =>
        e.family && families.includes(e.family)
          ? `Família ${famLabel(e.family)}, frequentemente associada a dias ${word} (associação comum, não regra).`
          : null,
      ),
    });
  };
  climateGap('hot', WARM_ASSOCIATED);
  climateGap('cold', COLD_ASSOCIATED);

  // 3. Ocasiões frequentes (configuradas + mais registradas).
  const logCounts = new Map<Occasion, number>();
  for (const l of logs) if (l.occasion) logCounts.set(l.occasion, (logCounts.get(l.occasion) ?? 0) + 1);
  const topLogged = [...logCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o]) => o);
  const frequent = [...new Set([...settings.frequentOccasions, ...topLogged])];
  for (const occ of frequent) {
    const count = owned.filter((p) => p.occasions.includes(occ)).length;
    if (count >= 2) continue;
    gaps.push({
      id: `occasion-${occ}`,
      title: `Poucas fragrâncias para ${occLabel(occ)}`,
      description: `É uma ocasião frequente para você, mas apenas ${count} perfume${count === 1 ? ' está marcado' : 's estão marcados'} para ela.`,
      severity: count === 0 ? 'high' : 'medium',
      suggestions: suggest((e) =>
        e.suggestedOccasions.includes(occ) ? `Sugestão editorial (não verificada) para ${occLabel(occ)}.` : null,
      ),
    });
  }

  // 4. Opções discretas para ambientes fechados.
  const withProjection = owned.filter((p) => p.projection !== undefined);
  const discreet = withProjection.filter((p) => (p.projection ?? 5) <= 2).length;
  if (withProjection.length > 0 && discreet < 2) {
    gaps.push({
      id: 'discreet-indoor',
      title: 'Poucas opções discretas para ambientes fechados',
      description: `${discreet} perfume${discreet === 1 ? ' tem' : 's têm'} projeção íntima ou próxima, segundo suas avaliações.`,
      severity: 'medium',
      suggestions: [],
      noSuggestionReason:
        'O catálogo de demonstração não tem dados de projeção, então não é possível sugerir fragrâncias discretas sem inventar características.',
    });
  }

  // 5. Famílias favoritas pouco representadas.
  for (const fam of settings.favoriteFamilies) {
    const count = owned.filter((p) => p.family === fam).length;
    if (count > 1) continue;
    gaps.push({
      id: `favorite-${fam}`,
      title: `Pouco de ${famLabel(fam)}, uma das suas favoritas`,
      description: `Você tem ${count} perfume${count === 1 ? '' : 's'} dessa família.`,
      severity: 'medium',
      suggestions: suggest((e) => (e.family === fam ? `Da família ${famLabel(fam)}.` : null)),
    });
  }

  // 6. Famílias ainda não exploradas (exceto as que você evita).
  const missing = CORE_FAMILIES.filter(
    (f) => !disliked.has(f) && !favorites.has(f) && !owned.some((p) => p.family === f),
  );
  if (missing.length > 0) {
    gaps.push({
      id: 'unexplored',
      title: 'Categorias ainda não exploradas',
      description: `Nenhum perfume da coleção é ${missing.map(famLabel).join(', ')}.`,
      severity: 'low',
      suggestions: suggest(
        (e) => (e.family && missing.includes(e.family) ? `Família ${famLabel(e.family)}, ainda ausente na coleção.` : null),
        4,
      ),
    });
  }

  return gaps;
}
