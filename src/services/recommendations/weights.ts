import { DEFAULT_WEIGHTS } from '../../data/defaults';
import type { RecommendationWeights } from '../../types';

export type CriterionKey = keyof RecommendationWeights;

export const CRITERIA: { key: CriterionKey; label: string; description: string }[] = [
  {
    key: 'climate',
    label: 'Clima',
    description:
      'Sensação térmica, umidade e chuva comparadas aos climas marcados, ao perfil fresco/quente dos acordes e notas e à força do perfume.',
  },
  {
    key: 'occasion',
    label: 'Ocasião',
    description: 'Ocasiões marcadas (com crédito para ocasiões parecidas) e se a projeção combina com a ocasião.',
  },
  {
    key: 'environment',
    label: 'Ambiente',
    description: 'Projeção (ou intensidade) versus ambiente fechado, aberto ou ambos; ao ar livre, a fixação também conta.',
  },
  {
    key: 'period',
    label: 'Período',
    description: 'Períodos de uso marcados e o perfil olfativo (mais fresco de dia, mais envolvente à noite).',
  },
  {
    key: 'personal',
    label: 'Preferência pessoal',
    description:
      'Famílias favoritas ou evitadas, avaliação pessoal, avaliações após uso (inclusive em situações parecidas), intensidade desejada e favoritos.',
  },
];

/** Escala os pesos para que somem 100. Pesos inválidos voltam ao padrão. */
export function normalizeWeights(w: RecommendationWeights): RecommendationWeights {
  const entries = Object.entries(w) as [CriterionKey, number][];
  const clean = entries.map(([k, v]) => [k, Number.isFinite(v) && v > 0 ? v : 0] as const);
  const total = clean.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };
  return Object.fromEntries(clean.map(([k, v]) => [k, (v / total) * 100])) as unknown as RecommendationWeights;
}

export function sumWeights(w: RecommendationWeights): number {
  return Object.values(w).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}
