import { useCallback, useState } from 'react';

/** Preferência de interface por navegador (ex.: modo de visualização). */
export function useLocalPref<T>(key: string, initial: T): [T, (v: T) => void] {
  const fullKey = `parfumania.ui.${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(fullKey, JSON.stringify(v));
      } catch {
        /* sem persistência: segue apenas em memória */
      }
    },
    [fullKey],
  );
  return [value, update];
}
