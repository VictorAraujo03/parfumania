import type { Perfume, PriceOffer, Settings, UsageLog } from '../../types';

/**
 * Contratos de persistência. A interface é assíncrona de propósito: a
 * implementação local (localStorage + IndexedDB) pode ser trocada por uma
 * baseada em API/banco remoto sem alterar a camada de interface.
 */
export interface EntityRepository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  replaceAll(items: T[]): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  save(settings: Settings): Promise<Settings>;
}

/** Imagens guardadas como data URL, referenciadas por id. */
export interface ImageRepository {
  get(id: string): Promise<string | undefined>;
  put(id: string, dataUrl: string): Promise<void>;
  remove(id: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
  clear(): Promise<void>;
}

export interface DataSource {
  /** true quando os dados vivem em um servidor (sincronizados entre aparelhos). */
  remote?: boolean;
  perfumes: EntityRepository<Perfume>;
  usage: EntityRepository<UsageLog>;
  offers: EntityRepository<PriceOffer>;
  settings: SettingsRepository;
  images: ImageRepository;
  /** Executa migrações pendentes. firstRun indica que não havia dados. */
  initialize(): Promise<{ firstRun: boolean }>;
}
