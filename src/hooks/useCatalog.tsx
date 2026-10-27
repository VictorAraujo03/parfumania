import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEMO_CATALOG } from '../data/catalog';
import { indexCatalog, searchCatalog, type CatalogQuery, type IndexedEntry } from '../services/catalog/catalogService';
import { createImportedCatalogStore } from '../services/catalog/catalogStore';
import { importCatalogCsv } from '../services/catalog/csvImport';
import type { CatalogEntry, ImportedCatalogMeta } from '../types';
import { decodeText } from '../utils/csv';

/** Base pública que pode ser baixada com um clique, para uso pessoal. */
export const PARFUMO_PRESET = {
  url: 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/main/data/2024/2024-12-10/parfumo_data_clean.csv',
  label: 'Parfumo (via TidyTuesday, 2024)',
  sourceNote:
    'Dados coletados do Parfumo.com por Olga G. e publicados no projeto TidyTuesday (dez/2024). ' +
    'O conjunto não declara licença: use apenas para fins pessoais e não publique a base junto com o app.',
};

interface CatalogValue {
  /** Demonstração + base importada. */
  entries: CatalogEntry[];
  meta?: ImportedCatalogMeta;
  ready: boolean;
  busy: boolean;
  search(query: CatalogQuery, limit?: number): { results: CatalogEntry[]; total: number };
  getById(id: string | null | undefined): CatalogEntry | undefined;
  importFile(file: File): Promise<ImportedCatalogMeta>;
  importFromUrl(preset: typeof PARFUMO_PRESET): Promise<ImportedCatalogMeta>;
  clear(): Promise<void>;
}

const CatalogContext = createContext<CatalogValue | null>(null);

/** Converte o CSV em um Web Worker; sem suporte a workers, roda na thread principal. */
function parseInWorker(text: string, label: string): Promise<CatalogEntry[]> {
  if (typeof Worker === 'undefined') return Promise.resolve(importCatalogCsv(text, label).entries);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../services/catalog/import.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<{ ok: boolean; entries?: CatalogEntry[]; error?: string }>) => {
      worker.terminate();
      if (ev.data.ok && ev.data.entries) resolve(ev.data.entries);
      else reject(new Error(ev.data.error ?? 'Falha ao ler o arquivo.'));
    };
    worker.onerror = () => {
      worker.terminate();
      // Fallback: alguns ambientes bloqueiam workers.
      try {
        resolve(importCatalogCsv(text, label).entries);
      } catch (err) {
        reject(err);
      }
    };
    worker.postMessage({ text, label });
  });
}
const store = createImportedCatalogStore();
const MAX_FILE_BYTES = 80 * 1024 * 1024;

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [imported, setImported] = useState<CatalogEntry[]>([]);
  const [meta, setMeta] = useState<ImportedCatalogMeta>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    store
      .load()
      .then(({ entries, meta: m }) => {
        setImported(entries);
        setMeta(m);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const entries = useMemo(() => [...DEMO_CATALOG, ...imported], [imported]);
  const index: IndexedEntry[] = useMemo(() => indexCatalog(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const ingest = useCallback(async (text: string, label: string, sourceNote: string) => {
    const parsed = await parseInWorker(text, label);
    if (parsed.length === 0) throw new Error('Nenhum perfume válido encontrado no arquivo.');
    const m: ImportedCatalogMeta = {
      label,
      sourceNote,
      importedAt: new Date().toISOString(),
      count: parsed.length,
      withNotes: parsed.filter((e) => e.topNotes.length + e.heartNotes.length + e.baseNotes.length > 0).length,
    };
    await store.save(parsed, m);
    setImported(parsed);
    setMeta(m);
    return m;
  }, []);

  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo<CatalogValue>(
    () => ({
      entries,
      meta,
      ready,
      busy,
      search: (query, limit) => searchCatalog(index, query, limit),
      getById: (id) => (id ? byId.get(id) : undefined),
      importFile: (file) =>
        run(async () => {
          if (file.size > MAX_FILE_BYTES) throw new Error('Arquivo grande demais (máximo de 80 MB).');
          const text = decodeText(await file.arrayBuffer());
          return ingest(text, file.name, 'Arquivo importado por você. Verifique a licença da fonte antes de compartilhar.');
        }),
      importFromUrl: (preset) =>
        run(async () => {
          let res: Response;
          try {
            res = await fetch(preset.url);
          } catch {
            throw new Error('Não foi possível baixar a base. Verifique sua conexão.');
          }
          if (!res.ok) throw new Error(`O servidor respondeu com erro (${res.status}).`);
          return ingest(decodeText(await res.arrayBuffer()), preset.label, preset.sourceNote);
        }),
      clear: () =>
        run(async () => {
          await store.clear();
          setImported([]);
          setMeta(undefined);
        }),
    }),
    [entries, meta, ready, busy, index, byId, ingest, run],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog deve ser usado dentro de CatalogProvider.');
  return ctx;
}
