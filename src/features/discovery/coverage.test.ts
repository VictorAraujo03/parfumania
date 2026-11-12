import { describe, expect, it } from 'vitest';
import { DEFAULT_CLIMATE_THRESHOLDS } from '../../data/defaults';
import type { CatalogEntry, Perfume } from '../../types';
import { analyzeCoverage } from './coverage';

const perfume = (id: string, patch: Partial<Perfume>): Perfume => ({
  id,
  name: `Perfume ${id}`,
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
  createdAt: '',
  updatedAt: '',
  ...patch,
});

const entry = (id: string, accords: string[], popularity = 100, brand = `Marca ${id}`): CatalogEntry => ({
  id,
  name: `Catálogo ${id}`,
  brand,
  topNotes: [],
  heartNotes: [],
  baseNotes: [],
  suggestedOccasions: [],
  accords,
  popularity,
  source: { kind: 'import', label: 'teste' },
  verification: 'unverified',
});

const settings = { favoriteFamilies: [], dislikedFamilies: [], frequentOccasions: [] };
const warm = ['Baunilha', 'Âmbar', 'Doce'];

describe('o que falta na coleção', () => {
  it('aponta a falta de um perfume para o calor quando a coleção é toda quente e está calor', () => {
    const perfumes = [perfume('a', { accords: warm }), perfume('b', { accords: warm }), perfume('c', { accords: ['Oud', 'Couro', 'Âmbar'] })];
    const catalog = [entry('fresh1', ['Cítrico', 'Aquático', 'Fresco'], 5000), entry('fresh2', ['Cítrico', 'Verde', 'Fresco'], 300), entry('sweet', warm, 9000)];
    const r = analyzeCoverage({ perfumes, logs: [], catalog, settings, thresholds: DEFAULT_CLIMATE_THRESHOLDS, weather: { temperatureC: 33, locationName: 'Rio' } });
    expect(r.gaps[0].id).toBe('heat');
    expect(r.gaps[0].why).toContain('33°C em Rio');
    expect(r.gaps[0].picks.map((p) => p.entry.id)).toEqual(['fresh1', 'fresh2']);
    expect(r.strengths.map((s) => s.id)).toContain('cold');
    expect(r.headline).toMatch(/^Analisamos seus 3 perfumes\./);
  });

  it('respeita as marcações do usuário e não sugere o que já está cadastrado', () => {
    const perfumes = [
      perfume('a', { climates: ['hot'] }),
      perfume('b', { climates: ['hot'] }),
      perfume('d', { name: 'Catálogo fresh1', brand: 'Marca fresh1', status: 'wishlist' }),
    ];
    const catalog = [entry('fresh1', ['Cítrico', 'Aquático', 'Fresco'], 5000)];
    const r = analyzeCoverage({ perfumes, logs: [], catalog, settings, thresholds: DEFAULT_CLIMATE_THRESHOLDS });
    expect(r.gaps.find((g) => g.id === 'heat')).toBeUndefined();
    expect(r.gaps.flatMap((g) => g.picks).some((p) => p.entry.id === 'fresh1')).toBe(false);
  });

  it('dá mais peso ao momento que você mais registra', () => {
    const perfumes = [perfume('a', { occasions: ['date'] })];
    const logs = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      perfumeId: 'a',
      usedAt: '2026-11-01T08:00:00',
      occasion: 'work' as const,
      createdAt: '',
      updatedAt: '',
    }));
    const r = analyzeCoverage({ perfumes, logs, catalog: [], settings, thresholds: DEFAULT_CLIMATE_THRESHOLDS, suggest: false });
    expect(r.gaps[0].id).toBe('work');
    expect(r.gaps[0].why).toContain('100% dos seus usos');
  });
});
