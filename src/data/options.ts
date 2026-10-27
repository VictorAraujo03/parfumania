import type {
  Climate,
  Concentration,
  DayPeriod,
  Environment,
  IntensityPreference,
  Occasion,
  OfferCondition,
  OlfactoryFamily,
  PerfumeStatus,
} from '../types';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const CONCENTRATIONS: Option<Concentration>[] = [
  { value: 'edc', label: 'Eau de Cologne' },
  { value: 'edt', label: 'Eau de Toilette' },
  { value: 'edp', label: 'Eau de Parfum' },
  { value: 'parfum', label: 'Parfum' },
  { value: 'extrait', label: 'Extrait de Parfum' },
  { value: 'other', label: 'Outra' },
];

export const CONCENTRATION_SHORT: Record<Concentration, string> = {
  edc: 'EDC',
  edt: 'EDT',
  edp: 'EDP',
  parfum: 'Parfum',
  extrait: 'Extrait',
  other: 'Outra',
};

export const FAMILIES: Option<OlfactoryFamily>[] = [
  { value: 'woody', label: 'Amadeirado' },
  { value: 'aromatic', label: 'Aromático' },
  { value: 'fougere', label: 'Fougère' },
  { value: 'citrus', label: 'Cítrico' },
  { value: 'floral', label: 'Floral' },
  { value: 'fruity', label: 'Frutado' },
  { value: 'amber', label: 'Âmbar / Oriental' },
  { value: 'spicy', label: 'Especiado' },
  { value: 'gourmand', label: 'Gourmand' },
  { value: 'chypre', label: 'Chipre' },
  { value: 'aquatic', label: 'Aquático' },
  { value: 'green', label: 'Verde' },
  { value: 'leather', label: 'Couro' },
  { value: 'musky', label: 'Almiscarado' },
  { value: 'powdery', label: 'Atalcado' },
  { value: 'other', label: 'Outra' },
];

/** Tons usados apenas no placeholder visual de cada família. */
export const FAMILY_HUES: Record<OlfactoryFamily, string> = {
  woody: '#8a6b4c',
  aromatic: '#6f8466',
  fougere: '#5f7a6e',
  citrus: '#c5a243',
  floral: '#b07786',
  fruity: '#b96a5a',
  amber: '#b07a3c',
  spicy: '#a3553d',
  gourmand: '#9a6a4a',
  chypre: '#6b6e4e',
  aquatic: '#4f7d93',
  green: '#5f8a58',
  leather: '#6a4b3a',
  musky: '#9a8e86',
  powdery: '#a88f9f',
  other: '#8b8378',
};

export const OCCASIONS: Option<Occasion>[] = [
  { value: 'work', label: 'Trabalho' },
  { value: 'daily', label: 'Dia a dia' },
  { value: 'casual', label: 'Passeio / casual' },
  { value: 'date', label: 'Encontro' },
  { value: 'party', label: 'Festa / noite' },
  { value: 'formal', label: 'Evento formal' },
  { value: 'sport', label: 'Esporte / academia' },
  { value: 'travel', label: 'Viagem' },
  { value: 'home', label: 'Em casa' },
];

export const CLIMATES: Option<Climate>[] = [
  { value: 'hot', label: 'Calor' },
  { value: 'mild', label: 'Ameno' },
  { value: 'cold', label: 'Frio' },
  { value: 'humid', label: 'Úmido' },
  { value: 'dry', label: 'Seco' },
  { value: 'rainy', label: 'Chuvoso' },
];

export const PERIODS: Option<DayPeriod>[] = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'evening', label: 'Noite' },
  { value: 'night', label: 'Madrugada' },
];

export const ENVIRONMENTS: Option<Environment>[] = [
  { value: 'indoor', label: 'Ambiente fechado' },
  { value: 'outdoor', label: 'Ambiente aberto' },
  { value: 'both', label: 'Ambos' },
];

export const INTENSITY_PREFERENCES: Option<IntensityPreference>[] = [
  { value: 'discreet', label: 'Discreta' },
  { value: 'moderate', label: 'Moderada' },
  { value: 'strong', label: 'Marcante' },
];

export const STATUSES: Option<PerfumeStatus>[] = [
  { value: 'owned', label: 'Na coleção' },
  { value: 'decant', label: 'Amostra / decant' },
  { value: 'wishlist', label: 'Desejado' },
  { value: 'finished', label: 'Acabou' },
  { value: 'gone', label: 'Vendido / doado' },
];

export const OFFER_CONDITIONS: Option<OfferCondition>[] = [
  { value: 'new', label: 'Novo / lacrado' },
  { value: 'tester', label: 'Tester' },
  { value: 'used', label: 'Usado' },
  { value: 'decant', label: 'Decant' },
  { value: 'other', label: 'Outra' },
];

export const SCALE_LABELS = {
  intensity: ['Muito suave', 'Suave', 'Moderada', 'Forte', 'Muito forte'],
  projection: ['Íntima', 'Próxima', 'Moderada', 'Ampla', 'Enorme'],
  longevity: ['Muito curta', 'Curta', 'Moderada', 'Longa', 'Muito longa'],
  rating: ['Não gostei', 'Regular', 'Bom', 'Muito bom', 'Excelente'],
} as const;

/** Busca o rótulo de um valor em uma lista de opções. */
export function labelOf<T extends string>(options: Option<T>[], value: T | undefined): string {
  if (!value) return '';
  return options.find((o) => o.value === value)?.label ?? value;
}
