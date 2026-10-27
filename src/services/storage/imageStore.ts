import type { ImageRepository } from './repositories';

const DB_NAME = 'parfumania-images';
const STORE = 'images';

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

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** Imagens ficam no IndexedDB, que suporta volumes muito maiores que o localStorage. */
export function createIndexedDbImageRepository(): ImageRepository {
  if (typeof indexedDB === 'undefined') return createMemoryImageRepository();
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDb());

  return {
    async get(id) {
      return run<string | undefined>(await db(), 'readonly', (s) => s.get(id));
    },
    async put(id, dataUrl) {
      await run(await db(), 'readwrite', (s) => s.put(dataUrl, id));
    },
    async remove(id) {
      await run(await db(), 'readwrite', (s) => s.delete(id));
    },
    async getAll() {
      const d = await db();
      const [keys, values] = await Promise.all([
        run<IDBValidKey[]>(d, 'readonly', (s) => s.getAllKeys()),
        run<string[]>(d, 'readonly', (s) => s.getAll()),
      ]);
      return Object.fromEntries(keys.map((k, i) => [String(k), values[i]]));
    },
    async clear() {
      await run(await db(), 'readwrite', (s) => s.clear());
    },
  };
}

export function createMemoryImageRepository(): ImageRepository {
  const map = new Map<string, string>();
  return {
    get: async (id) => map.get(id),
    put: async (id, url) => void map.set(id, url),
    remove: async (id) => void map.delete(id),
    getAll: async () => Object.fromEntries(map),
    clear: async () => map.clear(),
  };
}
