import type {
  CatalogEntry,
  Climate,
  Concentration,
  DayPeriod,
  Occasion,
  OlfactoryFamily,
  Perfume,
  PerfumeInput,
  PerfumeStatus,
  Scale,
} from '../../types';
import { toDateKey } from '../../utils/date';
import { splitList } from '../../utils/text';

/** Estado do formulário: números como texto para permitir campos vazios. */
export interface PerfumeFormState {
  name: string;
  brand: string;
  concentration: Concentration | '';
  concentrationOther: string;
  volumeMl: string;
  remainingMl: string;
  family: OlfactoryFamily | '';
  year: string;
  perfumers: string;
  accords: string;
  topNotes: string;
  heartNotes: string;
  baseNotes: string;
  occasions: Occasion[];
  climates: Climate[];
  periods: DayPeriod[];
  intensity?: Scale;
  projection?: Scale;
  longevity?: Scale;
  acquiredAt: string;
  pricePaid: string;
  rating?: Scale;
  notes: string;
  status: PerfumeStatus;
  favorite: boolean;
  /** Entrada do catálogo usada para preencher o formulário, se houver. */
  catalogId?: string;
}

export type FormErrors = Partial<Record<keyof PerfumeFormState | 'image', string>>;

export const EMPTY_FORM: PerfumeFormState = {
  name: '',
  brand: '',
  concentration: '',
  concentrationOther: '',
  volumeMl: '',
  remainingMl: '',
  family: '',
  year: '',
  perfumers: '',
  accords: '',
  topNotes: '',
  heartNotes: '',
  baseNotes: '',
  occasions: [],
  climates: [],
  periods: [],
  acquiredAt: '',
  pricePaid: '',
  notes: '',
  status: 'owned',
  favorite: false,
};

const numText = (n: number | undefined) => (n === undefined ? '' : String(n));

export function formFromPerfume(p: Perfume): PerfumeFormState {
  return {
    name: p.name,
    brand: p.brand,
    concentration: p.concentration ?? '',
    concentrationOther: p.concentrationOther ?? '',
    volumeMl: numText(p.volumeMl),
    remainingMl: numText(p.remainingMl),
    family: p.family ?? '',
    year: numText(p.year),
    perfumers: (p.perfumers ?? []).join(', '),
    accords: (p.accords ?? []).join(', '),
    topNotes: p.topNotes.join(', '),
    heartNotes: p.heartNotes.join(', '),
    baseNotes: p.baseNotes.join(', '),
    occasions: p.occasions,
    climates: p.climates,
    periods: p.periods,
    intensity: p.intensity,
    projection: p.projection,
    longevity: p.longevity,
    acquiredAt: p.acquiredAt ?? '',
    pricePaid: numText(p.pricePaid),
    rating: p.rating,
    notes: p.notes ?? '',
    status: p.status,
    favorite: p.favorite,
    catalogId: p.catalogId,
  };
}

/**
 * Aplica dados do catálogo sobre o formulário: apenas o que existe na fonte.
 * Preferências pessoais (ocasiões, climas, percepções, compra) são mantidas.
 */
export function applyCatalogEntry(s: PerfumeFormState, e: CatalogEntry): PerfumeFormState {
  return {
    ...s,
    name: e.name,
    brand: e.brand,
    concentration: e.concentration ?? '',
    concentrationOther: e.concentration === 'other' ? e.concentrationLabel ?? '' : '',
    family: e.family ?? '',
    year: numText(e.year),
    perfumers: (e.perfumers ?? []).join(', '),
    accords: (e.accords ?? []).join(', '),
    topNotes: e.topNotes.join(', '),
    heartNotes: e.heartNotes.join(', '),
    baseNotes: e.baseNotes.join(', '),
    catalogId: e.id,
  };
}

export function formFromCatalog(e: CatalogEntry, status: PerfumeStatus = 'owned'): PerfumeFormState {
  return applyCatalogEntry({ ...EMPTY_FORM, status }, e);
}

const parseNum = (s: string): number | undefined => {
  const t = s.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function validatePerfumeForm(s: PerfumeFormState): FormErrors {
  const e: FormErrors = {};
  if (!s.name.trim()) e.name = 'Informe o nome do perfume.';
  else if (s.name.length > 120) e.name = 'Use no máximo 120 caracteres.';
  if (!s.brand.trim()) e.brand = 'Informe a marca.';
  else if (s.brand.length > 80) e.brand = 'Use no máximo 80 caracteres.';

  const vol = parseNum(s.volumeMl);
  const rem = parseNum(s.remainingMl);
  const price = parseNum(s.pricePaid);
  const year = parseNum(s.year);
  if (year !== undefined && (Number.isNaN(year) || !Number.isInteger(year) || year < 1700 || year > new Date().getFullYear() + 1))
    e.year = 'Informe um ano válido.';
  if (vol !== undefined && (Number.isNaN(vol) || vol <= 0 || vol > 5000)) e.volumeMl = 'Informe um volume entre 0 e 5000 ml.';
  if (rem !== undefined && (Number.isNaN(rem) || rem < 0)) e.remainingMl = 'O volume restante não pode ser negativo.';
  else if (rem !== undefined && vol !== undefined && !Number.isNaN(vol) && rem > vol)
    e.remainingMl = 'O volume restante não pode ser maior que o volume original.';
  if (price !== undefined && (Number.isNaN(price) || price < 0 || price > 1_000_000)) e.pricePaid = 'Informe um valor válido.';
  if (s.acquiredAt && s.acquiredAt > toDateKey(new Date())) e.acquiredAt = 'A data de aquisição não pode estar no futuro.';
  if (s.notes.length > 2000) e.notes = 'Use no máximo 2000 caracteres.';
  if (s.concentration === 'other' && s.concentrationOther.length > 40) e.concentrationOther = 'Use no máximo 40 caracteres.';
  return e;
}

const listOrUndefined = (text: string) => {
  const list = splitList(text);
  return list.length ? list : undefined;
};

export function formToInput(s: PerfumeFormState, base?: Perfume): PerfumeInput {
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    name: s.name.trim(),
    brand: s.brand.trim(),
    concentration: s.concentration || undefined,
    concentrationOther: s.concentration === 'other' ? opt(s.concentrationOther) : undefined,
    volumeMl: parseNum(s.volumeMl),
    remainingMl: parseNum(s.remainingMl),
    family: s.family || undefined,
    year: parseNum(s.year),
    perfumers: listOrUndefined(s.perfumers),
    accords: listOrUndefined(s.accords),
    topNotes: splitList(s.topNotes),
    heartNotes: splitList(s.heartNotes),
    baseNotes: splitList(s.baseNotes),
    occasions: s.occasions,
    climates: s.climates,
    periods: s.periods,
    intensity: s.intensity,
    projection: s.projection,
    longevity: s.longevity,
    acquiredAt: opt(s.acquiredAt),
    pricePaid: parseNum(s.pricePaid),
    rating: s.rating,
    notes: opt(s.notes),
    status: s.status,
    favorite: s.favorite,
    imageId: base?.imageId,
    // Ao editar, o perfume deixa de ser apenas "demonstração" e passa a ser do usuário.
    isDemo: false,
    catalogId: s.catalogId ?? base?.catalogId,
    dataSource: s.catalogId && s.catalogId !== base?.catalogId ? 'catalog' : base?.dataSource ?? 'manual',
  };
}
