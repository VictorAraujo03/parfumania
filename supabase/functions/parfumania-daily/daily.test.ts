import { describe, expect, it } from 'vitest';
import { choosePick, composeMessage, localParts, nextSlot, periodAt, rankPerfumes, shortReason, type Perfume } from './index';

const P = (id: string, patch: Partial<Perfume> = {}): Perfume => ({ id, name: `Perfume ${id}`, brand: 'Marca', status: 'owned', ...patch });
const fresh = P('fresh', { name: 'Acqua di Giò', accords: ['Cítrico', 'Aquático', 'Fresco'] });
const warm = P('warm', { name: 'Tobacco Vanille', accords: ['Baunilha', 'Tabaco', 'Doce'] });
const TZ = 'America/Sao_Paulo';

describe('perfume do dia (servidor)', () => {
  it('escolhe o fresco no calor e o quente no frio', () => {
    expect(rankPerfumes([warm, fresh], [], { temperatureC: 33 }, 'afternoon')[0].perfume.id).toBe('fresh');
    expect(rankPerfumes([fresh, warm], [], { temperatureC: 8 }, 'evening')[0].perfume.id).toBe('warm');
  });

  it('aplica o rodízio: o usado hoje cai no ranking', () => {
    const now = new Date('2026-11-12T15:00:00Z');
    const logs = [{ perfumeId: 'fresh', usedAt: '2026-11-12T11:00:00Z' }];
    expect(rankPerfumes([fresh, warm], logs, { temperatureC: 24 }, 'afternoon', now)[0].perfume.id).toBe('warm');
  });

  it('ignora desejados, vendidos e frascos vazios', () => {
    const r = rankPerfumes([P('a', { status: 'wishlist' }), P('b', { remainingMl: 0 }), P('c')], [], {}, 'morning');
    expect(r.map((x) => x.perfume.id)).toEqual(['c']);
  });

  it('sorteia entre os 3 melhores', () => {
    const ranked = rankPerfumes([fresh, warm, P('x')], [], { temperatureC: 30 }, 'morning');
    expect(choosePick(ranked, () => 0)?.perfume.id).toBe(ranked[0].perfume.id);
    expect(choosePick(ranked, () => 0.99)?.perfume.id).toBe(ranked[2].perfume.id);
  });

  it('monta frases com o nome do perfume e o clima', () => {
    const pick = { perfume: fresh, score: 1 };
    const hot = composeMessage(pick, { temperatureC: 34, place: 'Rio de Janeiro' }, 'afternoon', undefined, () => 0.3);
    expect(hot.body).toContain('Acqua di Giò');
    expect(hot.body).toMatch(/34°C|calor|quente/i);
    const rain = composeMessage(pick, { temperatureC: 20, code: 63 }, 'morning', undefined, () => 0.3);
    expect(rain.body).toMatch(/chuva/i);
    const forgotten = composeMessage({ perfume: fresh, score: 1, daysSince: 30 }, { temperatureC: 22 }, 'morning', undefined, () => 0.2);
    expect(forgotten.body).toContain('30 dias');
    expect(shortReason(pick, { temperatureC: 33 })).toBe('Fresco para encarar 33°C');
  });

  it('sorteia o próximo horário dentro das janelas, no fuso da pessoa', () => {
    const from = new Date('2026-11-12T13:00:00Z'); // 10h em São Paulo
    const mid = nextSlot(['morning', 'afternoon', 'evening'], TZ, from, () => 0.5)!;
    const local = localParts(mid, TZ);
    expect(local.d).toBe(12);
    expect(local.hour).toBeGreaterThanOrEqual(10);
    expect(local.hour).toBeLessThanOrEqual(10.5); // ainda dentro da manhã (até 10h30)
    const onlyEvening = nextSlot(['evening'], TZ, from, () => 0)!;
    expect(localParts(onlyEvening, TZ).hour).toBeCloseTo(18.5, 1);
    const late = nextSlot(['morning'], TZ, new Date('2026-11-12T23:00:00Z'), () => 0)!; // 20h → amanhã cedo
    expect(localParts(late, TZ).d).toBe(13);
    expect(localParts(late, TZ).hour).toBeCloseTo(7.5, 1);
    expect(nextSlot([], TZ, from)).toBeUndefined();
    expect(periodAt(new Date('2026-11-12T21:30:00Z'), TZ)).toBe('evening');
  });
});
