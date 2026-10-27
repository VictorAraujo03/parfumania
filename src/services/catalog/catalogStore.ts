import type { CatalogEntry, ImportedCatalogMeta } from '../../types';

/**
 * Base de perfumes importada pelo usuário, guardada no IndexedDB deste
 * navegador. Não faz parte do backup JSON (pode ter dezenas de MB e é
 * reimportável) e nunca é enviada a lugar nenhum.
 */
export interface ImportedCatalogStore {
  load(): Promise<{ entries: CatalogEntry[]; meta?: ImportedCatalogMeta }>;
  save(entries: CatalogEntry[], meta: ImportedCatalogMeta): Promise<void>;
  clear(): Promise<void>;
}

const DB_NAME = 'parfumania-catalog';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve((req ? req.result : undefined) as T);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transação cancelada (espaço insuficiente?).'));
  });
}

export function createImportedCatalogStore(): ImportedCatalogStore {
  if (typeof indexedDB === 'undefined') {
    let mem: { entries: CatalogEntry[]; meta?: ImportedCatalogMeta } = { entries: [] };
    return {
      load: async () => mem,
      save: async (entries, meta) => void (mem = { entries, meta }),
      clear: async () => void (mem = { entries: [] }),
    };
  }
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDb());
  return {
    async load() {
      const d = await db();
      const [entries, meta] = await Promise.all([
        tx<CatalogEntry[] | undefined>(d, 'readonly', (s) => s.get('entries')),
        tx<ImportedCatalogMeta | undefined>(d, 'readonly', (s) => s.get('meta')),
      ]);
      return { entries: entries ?? [], meta };
    },
    async save(entries, meta) {
      await tx(await db(), 'readwrite', (s) => {
        s.put(entries, 'entries');
        s.put(meta, 'meta');
      });
    },
    async clear() {
      await tx(await db(), 'readwrite', (s) => s.clear());
    },
  };
}
