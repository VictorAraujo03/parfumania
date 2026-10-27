/** Armazenamento chave-valor síncrono (abstração sobre o localStorage). */
export interface KeyValueStore {
  read<T>(key: string): T | undefined;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

export class StorageError extends Error {}

export function createLocalStorageStore(namespace: string): KeyValueStore {
  const k = (key: string) => `${namespace}.${key}`;
  return {
    read<T>(key: string): T | undefined {
      try {
        const raw = window.localStorage.getItem(k(key));
        return raw === null ? undefined : (JSON.parse(raw) as T);
      } catch {
        return undefined;
      }
    },
    write<T>(key: string, value: T): void {
      try {
        window.localStorage.setItem(k(key), JSON.stringify(value));
      } catch (err) {
        const quota = err instanceof DOMException && /quota/i.test(err.name);
        throw new StorageError(
          quota
            ? 'O armazenamento local do navegador está cheio. Exporte um backup e remova dados antigos.'
            : 'Não foi possível salvar os dados no navegador.',
        );
      }
    },
    remove(key: string): void {
      try {
        window.localStorage.removeItem(k(key));
      } catch {
        /* ignorado: nada a remover */
      }
    },
  };
}

/** Implementação em memória, útil para testes ou navegadores sem localStorage. */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    read: <T,>(key: string) => {
      const raw = map.get(key);
      return raw === undefined ? undefined : (JSON.parse(raw) as T);
    },
    write: (key, value) => void map.set(key, JSON.stringify(value)),
    remove: (key) => void map.delete(key),
  };
}
