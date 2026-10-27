import type { Perfume, PriceOffer, Settings, UsageLog } from '../../types';
import { createIndexedDbImageRepository } from './imageStore';
import { createLocalStorageStore, type KeyValueStore } from './keyValueStore';
import { CURRENT_SCHEMA_VERSION, migrate } from './migrations';
import {
  normalizeList,
  normalizeOffer,
  normalizePerfume,
  normalizeSettings,
  normalizeUsage,
} from './normalize';
import type { DataSource, EntityRepository, ImageRepository, SettingsRepository } from './repositories';

export const STORAGE_KEYS = {
  meta: 'meta',
  perfumes: 'perfumes',
  usage: 'usage',
  offers: 'offers',
  settings: 'settings',
} as const;

interface Meta {
  schemaVersion: number;
}

function createEntityRepository<T extends { id: string }>(
  store: KeyValueStore,
  key: string,
  normalizeItem: (raw: unknown) => T | null,
): EntityRepository<T> {
  const load = (): T[] => normalizeList(store.read<unknown[]>(key), normalizeItem);
  const save = (items: T[]) => store.write(key, items);

  return {
    async list() {
      return load();
    },
    async get(id) {
      return load().find((i) => i.id === id);
    },
    async create(item) {
      const items = load();
      if (items.some((i) => i.id === item.id)) throw new Error('Identificador duplicado.');
      save([...items, item]);
      return item;
    },
    async update(id, patch) {
      const items = load();
      const idx = items.findIndex((i) => i.id === id);
      if (idx < 0) throw new Error('Registro não encontrado.');
      const updated = { ...items[idx], ...patch, id };
      items[idx] = updated;
      save(items);
      return updated;
    },
    async remove(id) {
      save(load().filter((i) => i.id !== id));
    },
    async removeMany(ids) {
      const set = new Set(ids);
      save(load().filter((i) => !set.has(i.id)));
    },
    async replaceAll(items) {
      save(items);
    },
  };
}

function createSettingsRepository(store: KeyValueStore): SettingsRepository {
  return {
    async get() {
      return normalizeSettings(store.read(STORAGE_KEYS.settings));
    },
    async save(settings: Settings) {
      store.write(STORAGE_KEYS.settings, settings);
      return settings;
    },
  };
}

/** Fonte de dados local: localStorage para registros e IndexedDB para imagens. */
export function createLocalDataSource(
  store: KeyValueStore = createLocalStorageStore('parfumania'),
  images: ImageRepository = createIndexedDbImageRepository(),
): DataSource {
  return {
    perfumes: createEntityRepository<Perfume>(store, STORAGE_KEYS.perfumes, normalizePerfume),
    usage: createEntityRepository<UsageLog>(store, STORAGE_KEYS.usage, normalizeUsage),
    offers: createEntityRepository<PriceOffer>(store, STORAGE_KEYS.offers, normalizeOffer),
    settings: createSettingsRepository(store),
    images,
    async initialize() {
      const meta = store.read<Meta>(STORAGE_KEYS.meta);
      if (!meta) {
        const hasData = store.read(STORAGE_KEYS.perfumes) !== undefined;
        store.write<Meta>(STORAGE_KEYS.meta, { schemaVersion: CURRENT_SCHEMA_VERSION });
        return { firstRun: !hasData };
      }
      if (meta.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const migrated = migrate({
          schemaVersion: meta.schemaVersion,
          perfumes: store.read<unknown[]>(STORAGE_KEYS.perfumes) ?? [],
          usageLogs: store.read<unknown[]>(STORAGE_KEYS.usage) ?? [],
          offers: store.read<unknown[]>(STORAGE_KEYS.offers) ?? [],
          settings: store.read(STORAGE_KEYS.settings),
        });
        store.write(STORAGE_KEYS.perfumes, migrated.perfumes);
        store.write(STORAGE_KEYS.usage, migrated.usageLogs);
        store.write(STORAGE_KEYS.offers, migrated.offers);
        store.write(STORAGE_KEYS.settings, migrated.settings);
        store.write<Meta>(STORAGE_KEYS.meta, { schemaVersion: CURRENT_SCHEMA_VERSION });
      }
      return { firstRun: false };
    },
  };
}
