/**
 * Nota da comunidade (0–10) ponderada pelos votos — média bayesiana:
 * um 9,5 com 3 votos não passa à frente de um 8,2 com 5 mil. Com poucos
 * votos, a nota se aproxima da média geral (PRIOR_MEAN).
 */
export const PRIOR_MEAN = 7.2;
const PRIOR_VOTES = 150;

export function weightedRating(rating?: number, votes?: number): number | undefined {
  if (rating === undefined) return undefined;
  const v = Math.max(0, votes ?? 0);
  return (rating * v + PRIOR_MEAN * PRIOR_VOTES) / (v + PRIOR_VOTES);
}

const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('pt-BR');

/** "7,9/10 em 2.300 votos" (ou só "7,9/10" sem votos). */
export function formatCommunityRating(rating: number, votes?: number): string {
  const r = `${nf1.format(rating)}/10`;
  return votes ? `${r} em ${nf0.format(votes)} ${votes === 1 ? 'voto' : 'votos'}` : r;
}
