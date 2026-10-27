import type { Concentration, DayPeriod, Occasion, OlfactoryFamily, Perfume, PerfumeStatus } from '../../types';
import { normalize } from '../../utils/text';

export interface CollectionFilters {
  text: string;
  brand: string;
  family: OlfactoryFamily | '';
  concentration: Concentration | '';
  occasion: Occasion | '';
  period: DayPeriod | '';
  status: PerfumeStatus | '';
  favoritesOnly: boolean;
}

export const EMPTY_FILTERS: CollectionFilters = {
  text: '',
  brand: '',
  family: '',
  concentration: '',
  occasion: '',
  period: '',
  status: '',
  favoritesOnly: false,
};

export type CollectionSort = 'name-asc' | 'name-desc' | 'acquired-desc' | 'acquired-asc' | 'created-desc';

export const SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'name-asc', label: 'Nome (A–Z)' },
  { value: 'name-desc', label: 'Nome (Z–A)' },
  { value: 'acquired-desc', label: 'Aquisição mais recente' },
  { value: 'acquired-asc', label: 'Aquisição mais antiga' },
  { value: 'created-desc', label: 'Cadastrados recentemente' },
];

export function countActiveFilters(f: CollectionFilters): number {
  return [f.brand, f.family, f.concentration, f.occasion, f.period, f.status].filter(Boolean).length + (f.favoritesOnly ? 1 : 0);
}

export function applyFilters(perfumes: Perfume[], f: CollectionFilters): Perfume[] {
  const text = normalize(f.text);
  return perfumes.filter((p) => {
    if (text && !normalize(`${p.name} ${p.brand}`).includes(text)) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.family && p.family !== f.family) return false;
    if (f.concentration && p.concentration !== f.concentration) return false;
    if (f.occasion && !p.occasions.includes(f.occasion)) return false;
    if (f.period && !p.periods.includes(f.period)) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.favoritesOnly && !p.favorite) return false;
    return true;
  });
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

export function sortPerfumes(list: Perfume[], sort: CollectionSort): Perfume[] {
  const byName = (a: Perfume, b: Perfume) => collator.compare(a.name, b.name) || collator.compare(a.brand, b.brand);
  // Perfumes sem data de aquisição vão para o final em ambas as ordens.
  const byAcquired = (dir: 1 | -1) => (a: Perfume, b: Perfume) => {
    if (!a.acquiredAt && !b.acquiredAt) return byName(a, b);
    if (!a.acquiredAt) return 1;
    if (!b.acquiredAt) return -1;
    return dir * a.acquiredAt.localeCompare(b.acquiredAt) || byName(a, b);
  };
  const sorted = [...list];
  switch (sort) {
    case 'name-asc':
      return sorted.sort(byName);
    case 'name-desc':
      return sorted.sort((a, b) => byName(b, a));
    case 'acquired-desc':
      return sorted.sort(byAcquired(-1));
    case 'acquired-asc':
      return sorted.sort(byAcquired(1));
    case 'created-desc':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function uniqueBrands(perfumes: Perfume[]): string[] {
  return [...new Set(perfumes.map((p) => p.brand).filter(Boolean))].sort(collator.compare);
}
