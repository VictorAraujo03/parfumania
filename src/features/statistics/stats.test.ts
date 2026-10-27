import { describe, expect, it } from 'vitest';
import type { Perfume, UsageLog } from '../../types';
import { countByPerfume, filterLogs, indexPerfumes, topByOccasion, underused, weeklyRecap } from './stats';

const perfume = (id: string, name: string): Perfume => ({
  id,
  name,
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
});

const log = (id: string, perfumeId: string, usedAt: string, extra: Partial<UsageLog> = {}): UsageLog => ({
  id,
  perfumeId,
  usedAt,
  createdAt: usedAt,
  updatedAt: usedAt,
  ...extra,
});

const perfumes = [perfume('a', 'Alfa'), perfume('b', 'Beta'), perfume('c', 'Gama')];
const index = indexPerfumes(perfumes);
const logs = [
  log('1', 'a', '2026-10-19T09:00:00', { occasion: 'work', rating: 4 }),
  log('2', 'a', '2026-10-20T09:00:00', { occasion: 'work' }),
  log('3', 'b', '2026-10-21T20:00:00', { occasion: 'date', rating: 5 }),
  log('4', 'a', '2026-10-13T09:00:00'),
];

describe('estatísticas', () => {
  it('conta utilizações por perfume', () => {
    const counts = countByPerfume(logs, index);
    expect(counts[0].perfumeId).toBe('a');
    expect(counts[0].count).toBe(3);
  });

  it('filtra por intervalo', () => {
    expect(filterLogs(logs, { start: new Date('2026-10-19T00:00:00'), end: new Date('2026-10-25T23:59:59') })).toHaveLength(3);
  });

  it('calcula o perfume mais usado por ocasião', () => {
    const occ = topByOccasion(logs, index);
    expect(occ[0].occasion).toBe('work');
    expect(occ[0].top.perfumeId).toBe('a');
  });

  it('gera a retrospectiva semanal a partir dos registros', () => {
    const recap = weeklyRecap(logs, index, new Date('2026-10-22T12:00:00'));
    expect(recap.total).toBe(3);
    expect(recap.previousTotal).toBe(1);
    expect(recap.top[0].perfumeId).toBe('a');
    expect(recap.bestRated?.rating).toBe(5);
  });

  it('lista primeiro os perfumes nunca usados', () => {
    const list = underused(perfumes, logs, new Date('2026-10-26T12:00:00'));
    expect(list[0].perfume.id).toBe('c');
    expect(list[0].count).toBe(0);
  });
});
