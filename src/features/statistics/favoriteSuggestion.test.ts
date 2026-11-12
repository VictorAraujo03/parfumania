import { describe, expect, it } from 'vitest';
import type { Perfume, UsageLog } from '../../types';
import { suggestFavorite } from './favoriteSuggestion';

const perfume = (id: string, favorite = false): Perfume => ({
  id,
  name: `Perfume ${id}`,
  brand: 'Marca',
  topNotes: [],
  heartNotes: [],
  baseNotes: [],
  occasions: [],
  climates: [],
  periods: [],
  favorite,
  status: 'owned',
  dataSource: 'manual',
  createdAt: '',
  updatedAt: '',
});

const log = (perfumeId: string, usedAt: string, rating?: 1 | 2 | 3 | 4 | 5): UsageLog => ({
  id: perfumeId + usedAt,
  perfumeId,
  usedAt,
  rating,
  createdAt: usedAt,
  updatedAt: usedAt,
});

const now = new Date('2026-11-12T20:00:00');

describe('sugestão de favorito', () => {
  it('sugere o perfume usado 3+ vezes nos últimos 7 dias', () => {
    const logs = [log('a', '2026-11-07T08:00:00', 5), log('a', '2026-11-09T08:00:00', 4), log('a', '2026-11-11T08:00:00'), log('b', '2026-11-10T08:00:00')];
    const s = suggestFavorite([perfume('a'), perfume('b')], logs, {}, now);
    expect(s?.perfume.id).toBe('a');
    expect(s?.count).toBe(3);
    expect(s?.top).toBe(true);
    expect(s?.avgRating).toBe(4.5);
  });

  it('ignora favoritos, usos antigos e perfumes adiados com "Agora não"', () => {
    const logs = [log('a', '2026-11-08T08:00:00'), log('a', '2026-11-09T08:00:00'), log('a', '2026-11-10T08:00:00')];
    expect(suggestFavorite([perfume('a', true)], logs, {}, now)).toBeUndefined();
    expect(suggestFavorite([perfume('a')], logs, { a: '2026-11-01T00:00:00.000Z' }, now)).toBeUndefined();
    const old = [log('a', '2026-10-01T08:00:00'), log('a', '2026-10-02T08:00:00'), log('a', '2026-10-03T08:00:00')];
    expect(suggestFavorite([perfume('a')], old, {}, now)).toBeUndefined();
  });
});
