import { FAMILIES, OCCASIONS, labelOf } from '../../data/options';
import type { Occasion, Perfume, UsageLog } from '../../types';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  daysBetween,
  formatShortDate,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
} from '../../utils/date';

/** Todas as estatísticas são derivadas exclusivamente dos registros de uso. */

export type StatsRangeKey = '7d' | '30d' | '90d' | '365d' | 'all';

export const RANGE_OPTIONS: { value: StatsRangeKey; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: '365d', label: '12 meses' },
  { value: 'all', label: 'Tudo' },
];

export interface DateRange {
  start?: Date;
  end: Date;
}

export function rangeFor(key: StatsRangeKey, now = new Date()): DateRange {
  const end = now;
  const days: Record<Exclude<StatsRangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
  if (key === 'all') return { end };
  return { start: startOfDay(addDays(now, -(days[key] - 1))), end };
}

export function filterLogs(logs: UsageLog[], range: { start?: Date; end?: Date }): UsageLog[] {
  const s = range.start?.getTime() ?? -Infinity;
  const e = range.end?.getTime() ?? Infinity;
  return logs.filter((l) => {
    const t = Date.parse(l.usedAt);
    return t >= s && t <= e;
  });
}

export type PerfumeIndex = Map<string, Perfume>;
export const indexPerfumes = (perfumes: Perfume[]): PerfumeIndex => new Map(perfumes.map((p) => [p.id, p]));

export interface PerfumeCount {
  perfumeId: string;
  perfume?: Perfume;
  name: string;
  count: number;
  lastUsed?: string;
}

export function perfumeLabel(p: Perfume | undefined): string {
  return p ? (p.brand ? `${p.name} · ${p.brand}` : p.name) : 'Perfume removido';
}

export function countByPerfume(logs: UsageLog[], index: PerfumeIndex): PerfumeCount[] {
  const map = new Map<string, PerfumeCount>();
  for (const l of logs) {
    const cur = map.get(l.perfumeId) ?? {
      perfumeId: l.perfumeId,
      perfume: index.get(l.perfumeId),
      name: perfumeLabel(index.get(l.perfumeId)),
      count: 0,
    };
    cur.count += 1;
    if (!cur.lastUsed || l.usedAt > cur.lastUsed) cur.lastUsed = l.usedAt;
    map.set(l.perfumeId, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || (b.lastUsed ?? '').localeCompare(a.lastUsed ?? ''),
  );
}

export function topBetween(logs: UsageLog[], index: PerfumeIndex, start: Date, end: Date, n = 3) {
  return countByPerfume(filterLogs(logs, { start, end }), index).slice(0, n);
}

export interface OccasionTop {
  occasion: Occasion;
  label: string;
  total: number;
  top: PerfumeCount;
}

export function topByOccasion(logs: UsageLog[], index: PerfumeIndex): OccasionTop[] {
  return OCCASIONS.flatMap(({ value, label }) => {
    const subset = logs.filter((l) => l.occasion === value);
    if (subset.length === 0) return [];
    return [{ occasion: value, label, total: subset.length, top: countByPerfume(subset, index)[0] }];
  }).sort((a, b) => b.total - a.total);
}

export interface Slice {
  name: string;
  value: number;
}

function distribution(logs: UsageLog[], keyOf: (l: UsageLog) => string): Slice[] {
  const map = new Map<string, number>();
  for (const l of logs) map.set(keyOf(l), (map.get(keyOf(l)) ?? 0) + 1);
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export const byBrand = (logs: UsageLog[], index: PerfumeIndex) =>
  distribution(logs, (l) => index.get(l.perfumeId)?.brand || 'Marca não informada');

export const byFamily = (logs: UsageLog[], index: PerfumeIndex) =>
  distribution(logs, (l) => labelOf(FAMILIES, index.get(l.perfumeId)?.family) || 'Família não informada');

export function byWeekday(logs: UsageLog[]): Slice[] {
  const counts = new Array(7).fill(0) as number[];
  for (const l of logs) counts[(new Date(l.usedAt).getDay() + 6) % 7] += 1;
  return WEEKDAY_LABELS.map((name, i) => ({ name, value: counts[i] }));
}

/** Série temporal: diária até 120 dias, semanal acima disso. */
export function timeline(logs: UsageLog[], range: DateRange): Slice[] {
  if (logs.length === 0 && !range.start) return [];
  const first = range.start ?? startOfDay(new Date(Math.min(...logs.map((l) => Date.parse(l.usedAt)))));
  const span = daysBetween(first, range.end) + 1;
  const weekly = span > 120;
  const counts = new Map<string, number>();
  for (const l of logs) {
    const d = new Date(l.usedAt);
    const key = toDateKey(weekly ? startOfWeek(d) : d);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const out: Slice[] = [];
  let cursor = weekly ? startOfWeek(first) : startOfDay(first);
  while (cursor <= range.end) {
    out.push({ name: formatShortDate(cursor), value: counts.get(toDateKey(cursor)) ?? 0 });
    cursor = addDays(cursor, weekly ? 7 : 1);
  }
  return out;
}

export function weeklyComparison(logs: UsageLog[], now = new Date(), weeks = 8): Slice[] {
  const current = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(current, -7 * (weeks - 1 - i));
    const end = new Date(addDays(start, 7).getTime() - 1);
    return {
      name: i === weeks - 1 ? 'Esta' : formatShortDate(start),
      value: filterLogs(logs, { start, end }).length,
    };
  });
}

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'short' });

export function monthlyComparison(logs: UsageLog[], now = new Date(), months = 6): Slice[] {
  const current = startOfMonth(now);
  return Array.from({ length: months }, (_, i) => {
    const start = addMonths(current, -(months - 1 - i));
    const end = new Date(addMonths(start, 1).getTime() - 1);
    return {
      name: monthFmt.format(start).replace('.', ''),
      value: filterLogs(logs, { start, end }).length,
    };
  });
}

export interface UnderusedItem {
  perfume: Perfume;
  count: number;
  lastUsed?: string;
  daysSince?: number;
}

/** Perfumes disponíveis com menos uso no período, priorizando os nunca usados. */
export function underused(perfumes: Perfume[], logs: UsageLog[], now = new Date(), limit = 6): UnderusedItem[] {
  const counts = new Map<string, { count: number; last?: string }>();
  for (const l of logs) {
    const c = counts.get(l.perfumeId) ?? { count: 0 };
    c.count += 1;
    if (!c.last || l.usedAt > c.last) c.last = l.usedAt;
    counts.set(l.perfumeId, c);
  }
  return perfumes
    .filter((p) => p.status === 'owned' || p.status === 'decant')
    .map((p) => {
      const c = counts.get(p.id);
      return {
        perfume: p,
        count: c?.count ?? 0,
        lastUsed: c?.last,
        daysSince: c?.last ? daysBetween(new Date(c.last), now) : undefined,
      };
    })
    .sort((a, b) => a.count - b.count || (b.daysSince ?? Infinity) - (a.daysSince ?? Infinity))
    .slice(0, limit);
}

export interface WeeklyRecap {
  start: Date;
  end: Date;
  total: number;
  distinctPerfumes: number;
  activeDays: number;
  top: PerfumeCount[];
  topOccasion?: { label: string; count: number };
  topFamily?: Slice;
  previousTotal: number;
  bestRated?: { name: string; rating: number };
}

export function weeklyRecap(logs: UsageLog[], index: PerfumeIndex, weekStart: Date): WeeklyRecap {
  const start = startOfWeek(weekStart);
  const end = new Date(addDays(start, 7).getTime() - 1);
  const week = filterLogs(logs, { start, end });
  const prev = filterLogs(logs, { start: addDays(start, -7), end: new Date(start.getTime() - 1) });
  const occ = distribution(
    week.filter((l) => l.occasion),
    (l) => labelOf(OCCASIONS, l.occasion),
  )[0];
  const fam = byFamily(week, index).filter((s) => s.name !== 'Família não informada')[0];
  const rated = week.filter((l) => l.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
  return {
    start,
    end,
    total: week.length,
    distinctPerfumes: new Set(week.map((l) => l.perfumeId)).size,
    activeDays: new Set(week.map((l) => toDateKey(new Date(l.usedAt)))).size,
    top: countByPerfume(week, index).slice(0, 3),
    topOccasion: occ ? { label: occ.name, count: occ.value } : undefined,
    topFamily: fam,
    previousTotal: prev.length,
    bestRated: rated ? { name: perfumeLabel(index.get(rated.perfumeId)), rating: rated.rating ?? 0 } : undefined,
  };
}
