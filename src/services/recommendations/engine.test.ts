import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIMATE_THRESHOLDS, DEFAULT_WEIGHTS } from '../../data/defaults';
import type { Perfume } from '../../types';
import { recommend, scorePerfume, type RecommendationOptions } from './engine';
import { normalizeWeights } from './weights';

const base: Perfume = {
  id: 'p1',
  name: 'Teste',
  brand: 'Marca',
  topNotes: [],
  heartNotes: [],
  baseNotes: [],
  occasions: [],
  climates: [],
  periods: [],
  favorite: false,
  status: 'owned',
  dataSource: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const options: RecommendationOptions = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_CLIMATE_THRESHOLDS,
  favoriteFamilies: [],
  dislikedFamilies: [],
  usageLogs: [],
};

describe('motor de recomendação', () => {
  it('pontua 100 com confiança total quando todos os critérios combinam', () => {
    const p: Perfume = {
      ...base,
      climates: ['hot'],
      occasions: ['work'],
      periods: ['morning'],
      projection: 2,
      rating: 5,
    };
    const r = scorePerfume(
      p,
      { weather: { temperatureC: 30 }, occasion: 'work', environment: 'indoor', period: 'morning' },
      options,
    );
    expect(r.score).toBe(100);
    expect(r.confidence).toBe(1);
    expect(r.confidenceLevel).toBe('high');
  });

  it('reduz a confiança em vez de inventar dados ausentes', () => {
    const r = scorePerfume(base, { weather: { temperatureC: 30 }, occasion: 'work', environment: 'indoor', period: 'morning' }, options);
    expect(r.confidence).toBe(0);
    expect(r.criteria.every((c) => c.status === 'unknown')).toBe(true);
  });

  it('ignora critérios sem contexto (não aplicáveis)', () => {
    const p: Perfume = { ...base, occasions: ['work'] };
    const r = scorePerfume(p, { occasion: 'work' }, options);
    const climate = r.criteria.find((c) => c.key === 'climate');
    expect(climate?.status).toBe('not_applicable');
    expect(r.score).toBe(100);
  });

  it('não usa a família olfativa para julgar o clima', () => {
    const p: Perfume = { ...base, family: 'citrus' };
    const r = scorePerfume(p, { weather: { temperatureC: 32 } }, options);
    expect(r.criteria.find((c) => c.key === 'climate')?.status).toBe('unknown');
  });

  it('exclui perfumes que não estão na coleção e sinaliza dados insuficientes', () => {
    const res = recommend([{ ...base, status: 'wishlist' }, { ...base, id: 'p2' }], {}, options);
    expect(res.excluded).toHaveLength(1);
    expect(res.recommendations).toHaveLength(1);
    expect(res.insufficientData).toBe(true);
  });

  it('normaliza pesos para somar 100', () => {
    const w = normalizeWeights({ climate: 1, occasion: 1, environment: 1, period: 1, personal: 0 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(w.personal).toBe(0);
  });
});
