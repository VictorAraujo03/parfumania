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
  it('pontua perto de 100 com confiança total quando todos os critérios combinam', () => {
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
    expect(r.score).toBeGreaterThanOrEqual(95);
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

  it('diferencia perfumes específicos de perfumes marcados para tudo', () => {
    const ctx = { weather: { temperatureC: 30 }, occasion: 'work' as const, environment: 'indoor' as const, period: 'morning' as const };
    const specific: Perfume = { ...base, climates: ['hot'], occasions: ['work'], periods: ['morning'], projection: 2, rating: 4 };
    const generic: Perfume = {
      ...base,
      id: 'p2',
      climates: ['hot', 'mild', 'cold'],
      occasions: ['work', 'daily', 'casual', 'date', 'party', 'formal', 'sport', 'travel', 'home'],
      periods: ['morning', 'afternoon', 'evening', 'night'],
      projection: 4,
      rating: 4,
    };
    const a = scorePerfume(specific, ctx, options);
    const b = scorePerfume(generic, ctx, options);
    expect(a.score).toBeGreaterThan(b.score + 10);
    expect(b.score).toBeLessThan(90);
  });

  it('usa acordes e notas cadastrados para o clima, com confiança reduzida', () => {
    const fresh: Perfume = { ...base, accords: ['Cítrico', 'Aquático', 'Fresco'], topNotes: ['Bergamota', 'Limão'] };
    const warm: Perfume = { ...base, id: 'p2', accords: ['Baunilha', 'Âmbar', 'Doce'], baseNotes: ['Fava tonka', 'Benjoim'] };
    const hot = { weather: { temperatureC: 33 } };
    const f = scorePerfume(fresh, hot, options);
    const w = scorePerfume(warm, hot, options);
    expect(f.score).toBeGreaterThan(w.score + 30);
    expect(f.confidence).toBeLessThan(1);
    const cold = { weather: { temperatureC: 8 } };
    expect(scorePerfume(warm, cold, options).score).toBeGreaterThan(scorePerfume(fresh, cold, options).score);
  });

  it('dá crédito parcial para ocasiões parecidas', () => {
    const p: Perfume = { ...base, occasions: ['party'] };
    const r = scorePerfume(p, { occasion: 'date' }, options);
    const occ = r.criteria.find((c) => c.key === 'occasion');
    expect(occ?.status).toBe('partial');
  });

  it('aplica rodízio: perde pontos se usado hoje e ganha se esquecido', () => {
    const now = new Date('2026-03-10T12:00:00');
    const p: Perfume = { ...base, occasions: ['work'] };
    const log = (usedAt: string, id = 'p1') => ({
      id: usedAt + id,
      perfumeId: id,
      usedAt,
      createdAt: usedAt,
      updatedAt: usedAt,
    });
    const today = scorePerfume(p, { occasion: 'work' }, { ...options, now, usageLogs: [log('2026-03-10T08:00:00')] });
    expect(today.adjustments[0]?.points).toBeLessThan(0);
    expect(today.score).toBeLessThan(today.baseScore);
    const old = scorePerfume(p, { occasion: 'work' }, { ...options, now, usageLogs: [log('2026-02-01T08:00:00')] });
    expect(old.adjustments[0]?.points).toBeGreaterThan(0);
    const off = scorePerfume(p, { occasion: 'work' }, { ...options, now, variety: false, usageLogs: [log('2026-03-10T08:00:00')] });
    expect(off.adjustments).toHaveLength(0);
  });

  it('aprende com avaliações feitas em situação parecida', () => {
    const p: Perfume = { ...base, occasions: ['date'] };
    const mk = (rating: 1 | 5, occasion: 'date' | 'work') => ({
      id: String(Math.random()),
      perfumeId: 'p1',
      usedAt: '2026-01-01T20:00:00',
      occasion,
      rating,
      createdAt: '2026-01-01T20:00:00',
      updatedAt: '2026-01-01T20:00:00',
    });
    const loved = scorePerfume(p, { occasion: 'date' }, { ...options, variety: false, usageLogs: [mk(5, 'date'), mk(5, 'date'), mk(1, 'work')] });
    const hated = scorePerfume(p, { occasion: 'date' }, { ...options, variety: false, usageLogs: [mk(1, 'date'), mk(1, 'date'), mk(5, 'work')] });
    expect(loved.score).toBeGreaterThan(hated.score);
  });

  it('normaliza pesos para somar 100', () => {
    const w = normalizeWeights({ climate: 1, occasion: 1, environment: 1, period: 1, personal: 0 });
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    expect(w.personal).toBe(0);
  });
});
