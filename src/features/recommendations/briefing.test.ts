import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIMATE_THRESHOLDS, DEFAULT_WEIGHTS } from '../../data/defaults';
import { scorePerfume } from '../../services/recommendations/engine';
import type { Perfume } from '../../types';
import { buildBriefing } from './briefing';

const perfume: Perfume = {
  id: 'p1',
  name: 'Teste',
  brand: 'Marca',
  accords: ['Baunilha', 'Âmbar', 'Tabaco'],
  topNotes: [],
  heartNotes: [],
  baseNotes: ['Fava tonka'],
  occasions: ['date'],
  climates: ['cold'],
  periods: ['evening'],
  projection: 4,
  favorite: false,
  status: 'owned',
  dataSource: 'manual',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const options = {
  weights: DEFAULT_WEIGHTS,
  thresholds: DEFAULT_CLIMATE_THRESHOLDS,
  favoriteFamilies: [],
  dislikedFamilies: [],
  usageLogs: [],
};

describe('resumo da recomendação do momento', () => {
  it('descreve o momento, o perfil, a aplicação e o que você vai sentir', () => {
    const rec = scorePerfume(perfume, { weather: { temperatureC: 12 }, period: 'evening', occasion: 'date' }, options);
    const b = buildBriefing(rec, {
      period: 'evening',
      temperatureC: 12,
      scene: { kind: 'clear', night: true, feel: 'cool', dry: false, humid: true },
      occasion: 'date',
      logs: [
        { id: 'l1', perfumeId: 'p1', usedAt: '2026-03-01T20:00:00', rating: 5, createdAt: '', updatedAt: '' },
      ],
      now: new Date('2026-03-10T20:00:00'),
      formatTemperature: (c) => `${c}°C`,
    });
    expect(b.moment).toBe('Noite fresca e úmida · 12°C · Encontro');
    expect(b.summary).toMatch(/^Perfil quente/);
    expect(b.details.some((d) => d.includes('última foi há 9 dias'))).toBe(true);
    expect(b.tip).toMatch(/borrifada/);
    expect(b.notes).toEqual(['Baunilha', 'Âmbar', 'Tabaco']);
  });

  it('avisa quando o perfume é encorpado demais para o calor', () => {
    const rec = scorePerfume(perfume, { weather: { temperatureC: 33 }, period: 'afternoon' }, options);
    const b = buildBriefing(rec, {
      period: 'afternoon',
      temperatureC: 33,
      scene: { kind: 'clear', night: false, feel: 'hot', dry: true, humid: false },
      logs: [],
      formatTemperature: (c) => `${c}°C`,
    });
    expect(b.summary).toMatch(/mais encorpado/);
    expect(b.cautions.length).toBeGreaterThan(0);
    expect(b.tip).toMatch(/^1 borrifada|^1–2 borrifadas/);
  });
});
