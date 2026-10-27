import type { Perfume, PriceOffer, Settings, UsageLog } from '../../types';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import {
  normalizeList,
  normalizeOffer,
  normalizePerfume,
  normalizeSettings,
  normalizeUsage,
} from './normalize';

export interface BackupFile {
  app: 'parfumania';
  schemaVersion: number;
  exportedAt: string;
  data: {
    perfumes: Perfume[];
    usageLogs: UsageLog[];
    offers: PriceOffer[];
    settings: Settings;
  };
  /** Imagens em data URL, indexadas pelo imageId. */
  images: Record<string, string>;
}

export interface ParsedBackup {
  perfumes: Perfume[];
  usageLogs: UsageLog[];
  offers: PriceOffer[];
  settings: Settings;
  images: Record<string, string>;
}

export class BackupError extends Error {}

export function buildBackup(data: BackupFile['data'], images: Record<string, string>): BackupFile {
  const usedImages = new Set(data.perfumes.map((p) => p.imageId).filter(Boolean));
  return {
    app: 'parfumania',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
    images: Object.fromEntries(Object.entries(images).filter(([id]) => usedImages.has(id))),
  };
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('O arquivo não é um JSON válido.');
  }
  const file = json as Partial<BackupFile>;
  if (!file || file.app !== 'parfumania' || typeof file.schemaVersion !== 'number' || !file.data) {
    throw new BackupError('Este arquivo não parece ser um backup do Parfumania.');
  }
  const migrated = migrate({
    schemaVersion: file.schemaVersion,
    perfumes: (file.data.perfumes as unknown[]) ?? [],
    usageLogs: (file.data.usageLogs as unknown[]) ?? [],
    offers: (file.data.offers as unknown[]) ?? [],
    settings: file.data.settings,
  });
  const images: Record<string, string> = {};
  for (const [id, url] of Object.entries(file.images ?? {})) {
    if (typeof url === 'string' && url.startsWith('data:image/')) images[id] = url;
  }
  return {
    perfumes: normalizeList(migrated.perfumes, normalizePerfume),
    usageLogs: normalizeList(migrated.usageLogs, normalizeUsage),
    offers: normalizeList(migrated.offers, normalizeOffer),
    settings: normalizeSettings(migrated.settings),
    images,
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
