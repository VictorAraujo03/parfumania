import { DEFAULT_SETTINGS, DEFAULT_WEIGHTS, DEFAULT_CLIMATE_THRESHOLDS } from '../../data/defaults';
import type { Perfume, PriceOffer, Settings, UsageLog } from '../../types';

/**
 * Normalizadores defensivos: garantem que dados antigos, importados ou
 * parcialmente corrompidos tenham a forma esperada pela aplicação.
 */
type Raw = Record<string, unknown>;

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

export function normalizePerfume(raw: unknown): Perfume | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const id = str(r.id);
  const name = str(r.name);
  if (!id || !name) return null;
  const now = new Date().toISOString();
  return {
    ...(r as unknown as Perfume),
    id,
    name,
    brand: str(r.brand) ?? '',
    topNotes: arr<string>(r.topNotes),
    heartNotes: arr<string>(r.heartNotes),
    baseNotes: arr<string>(r.baseNotes),
    occasions: arr(r.occasions),
    climates: arr(r.climates),
    periods: arr(r.periods),
    volumeMl: num(r.volumeMl),
    remainingMl: num(r.remainingMl),
    pricePaid: num(r.pricePaid),
    favorite: r.favorite === true,
    status: (str(r.status) as Perfume['status']) ?? 'owned',
    dataSource: (str(r.dataSource) as Perfume['dataSource']) ?? 'manual',
    createdAt: str(r.createdAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

export function normalizeUsage(raw: unknown): UsageLog | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const id = str(r.id);
  const perfumeId = str(r.perfumeId);
  const usedAt = str(r.usedAt);
  if (!id || !perfumeId || !usedAt || Number.isNaN(Date.parse(usedAt))) return null;
  const now = new Date().toISOString();
  return {
    ...(r as unknown as UsageLog),
    id,
    perfumeId,
    usedAt,
    createdAt: str(r.createdAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

export function normalizeOffer(raw: unknown): PriceOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const id = str(r.id);
  const price = num(r.price);
  if (!id || price === undefined) return null;
  const now = new Date().toISOString();
  return {
    ...(r as unknown as PriceOffer),
    id,
    price,
    perfumeName: str(r.perfumeName) ?? '',
    brand: str(r.brand) ?? '',
    store: str(r.store) ?? '',
    condition: (str(r.condition) as PriceOffer['condition']) ?? 'new',
    source: str(r.source) ?? 'manual',
    checkedAt: str(r.checkedAt) ?? now,
    createdAt: str(r.createdAt) ?? now,
    updatedAt: str(r.updatedAt) ?? now,
  };
}

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    weights: { ...DEFAULT_WEIGHTS, ...(r.weights ?? {}) },
    climateThresholds: { ...DEFAULT_CLIMATE_THRESHOLDS, ...(r.climateThresholds ?? {}) },
    favoriteFamilies: arr(r.favoriteFamilies),
    dislikedFamilies: arr(r.dislikedFamilies),
    frequentOccasions: arr(r.frequentOccasions),
  };
}

export function normalizeList<T>(items: unknown, fn: (raw: unknown) => T | null): T[] {
  return arr<unknown>(items)
    .map(fn)
    .filter((x): x is T => x !== null);
}
