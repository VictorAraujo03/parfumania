import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS } from '../data/defaults';
import { buildDemoCollection } from '../data/demoCollection';
import { buildBackup, parseBackup, type BackupFile } from '../services/storage/backup';
import type { DataSource } from '../services/storage/repositories';
import type {
  Perfume,
  PerfumeInput,
  PriceOffer,
  PriceOfferInput,
  Settings,
  UsageLog,
  UsageLogInput,
} from '../types';
import { createId } from '../utils/id';
import { useToast } from './useToast';

/** Alteração de imagem ao salvar um perfume. */
export type ImageChange = { kind: 'keep' } | { kind: 'set'; dataUrl: string } | { kind: 'remove' };

interface AppDataValue {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  perfumes: Perfume[];
  usageLogs: UsageLog[];
  offers: PriceOffer[];
  settings: Settings;
  dataSource: DataSource;

  addPerfume(input: PerfumeInput, image?: ImageChange): Promise<Perfume>;
  updatePerfume(id: string, patch: Partial<PerfumeInput>, image?: ImageChange): Promise<Perfume>;
  deletePerfume(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;

  addUsage(input: UsageLogInput): Promise<UsageLog>;
  updateUsage(id: string, patch: Partial<UsageLogInput>): Promise<UsageLog>;
  deleteUsage(id: string): Promise<void>;

  addOffer(input: PriceOfferInput): Promise<PriceOffer>;
  updateOffer(id: string, patch: Partial<PriceOfferInput>): Promise<PriceOffer>;
  deleteOffer(id: string): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  exportData(): Promise<BackupFile>;
  importData(text: string): Promise<{ perfumes: number; usageLogs: number; offers: number }>;
  removeDemoData(): Promise<number>;
  loadDemoData(): Promise<number>;
  resetAll(): Promise<void>;
  /** Recarrega tudo da fonte de dados (útil com sincronização na nuvem). */
  refresh(): Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

const nowIso = () => new Date().toISOString();
const initialization = new WeakMap<DataSource, Promise<void>>();
/** Ao voltar para a aba após este tempo, os dados remotos são recarregados. */
const REMOTE_REFRESH_MS = 30_000;

export function AppDataProvider({ dataSource, children }: { dataSource: DataSource; children: ReactNode }) {
  const [status, setStatus] = useState<AppDataValue['status']>('loading');
  const [error, setError] = useState<string>();
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [offers, setOffers] = useState<PriceOffer[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const { notify } = useToast();

  const reload = useCallback(async () => {
    const [p, u, o, s] = await Promise.all([
      dataSource.perfumes.list(),
      dataSource.usage.list(),
      dataSource.offers.list(),
      dataSource.settings.get(),
    ]);
    setPerfumes(p);
    setUsageLogs(u);
    setOffers(o);
    setSettings(s);
  }, [dataSource]);

  const seedDemo = useCallback(async () => {
    const items = buildDemoCollection();
    for (const input of items) {
      const ts = nowIso();
      await dataSource.perfumes.create({ ...input, id: createId('pf'), createdAt: ts, updatedAt: ts });
    }
    return items.length;
  }, [dataSource]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Uma única inicialização por fonte de dados, mesmo com efeitos duplicados (StrictMode).
        let init = initialization.get(dataSource);
        if (!init) {
          init = dataSource.initialize().then(async ({ firstRun }) => {
            if (firstRun) await seedDemo();
          });
          initialization.set(dataSource, init);
        }
        await init;
        if (!cancelled) {
          await reload();
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erro ao carregar os dados locais.');
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataSource, reload, seedDemo]);

  // Sincronização simples entre aparelhos: recarrega ao voltar para a aba.
  useEffect(() => {
    if (!dataSource.remote || status !== 'ready') return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > REMOTE_REFRESH_MS) reload().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [dataSource, status, reload]);

  const applyImage = useCallback(
    async (current: string | undefined, change: ImageChange | undefined): Promise<string | undefined> => {
      if (!change || change.kind === 'keep') return current;
      if (current) await dataSource.images.remove(current);
      if (change.kind === 'remove') return undefined;
      const id = createId('img');
      await dataSource.images.put(id, change.dataUrl);
      return id;
    },
    [dataSource],
  );

  const value = useMemo<AppDataValue>(() => {
    const base: AppDataValue = {
      status,
      error,
      perfumes,
      usageLogs,
      offers,
      settings,
      dataSource,

      async addPerfume(input, image) {
        const ts = nowIso();
        const imageId = await applyImage(undefined, image);
        const created = await dataSource.perfumes.create({
          ...input,
          imageId,
          id: createId('pf'),
          createdAt: ts,
          updatedAt: ts,
        });
        setPerfumes((list) => [...list, created]);
        return created;
      },

      async updatePerfume(id, patch, image) {
        const existing = perfumes.find((p) => p.id === id);
        const imageId = await applyImage(existing?.imageId, image);
        const updated = await dataSource.perfumes.update(id, { ...patch, imageId, updatedAt: nowIso() });
        setPerfumes((list) => list.map((p) => (p.id === id ? updated : p)));
        return updated;
      },

      async deletePerfume(id) {
        const existing = perfumes.find((p) => p.id === id);
        const logIds = usageLogs.filter((l) => l.perfumeId === id).map((l) => l.id);
        await dataSource.usage.removeMany(logIds);
        await dataSource.perfumes.remove(id);
        if (existing?.imageId) await dataSource.images.remove(existing.imageId);
        setPerfumes((list) => list.filter((p) => p.id !== id));
        setUsageLogs((list) => list.filter((l) => l.perfumeId !== id));
      },

      async toggleFavorite(id) {
        const existing = perfumes.find((p) => p.id === id);
        if (!existing) return;
        const updated = await dataSource.perfumes.update(id, { favorite: !existing.favorite, updatedAt: nowIso() });
        setPerfumes((list) => list.map((p) => (p.id === id ? updated : p)));
      },

      async addUsage(input) {
        const ts = nowIso();
        const created = await dataSource.usage.create({ ...input, id: createId('use'), createdAt: ts, updatedAt: ts });
        setUsageLogs((list) => [...list, created]);
        return created;
      },

      async updateUsage(id, patch) {
        const updated = await dataSource.usage.update(id, { ...patch, updatedAt: nowIso() });
        setUsageLogs((list) => list.map((l) => (l.id === id ? updated : l)));
        return updated;
      },

      async deleteUsage(id) {
        await dataSource.usage.remove(id);
        setUsageLogs((list) => list.filter((l) => l.id !== id));
      },

      async addOffer(input) {
        const ts = nowIso();
        const created = await dataSource.offers.create({ ...input, id: createId('off'), createdAt: ts, updatedAt: ts });
        setOffers((list) => [...list, created]);
        return created;
      },

      async updateOffer(id, patch) {
        const updated = await dataSource.offers.update(id, { ...patch, updatedAt: nowIso() });
        setOffers((list) => list.map((o) => (o.id === id ? updated : o)));
        return updated;
      },

      async deleteOffer(id) {
        await dataSource.offers.remove(id);
        setOffers((list) => list.filter((o) => o.id !== id));
      },

      async updateSettings(patch) {
        const next = await dataSource.settings.save({ ...settings, ...patch });
        setSettings(next);
        return next;
      },

      async exportData() {
        const images = await dataSource.images.getAll();
        return buildBackup({ perfumes, usageLogs, offers, settings }, images);
      },

      async importData(text) {
        const parsed = parseBackup(text);
        await dataSource.images.clear();
        for (const [id, url] of Object.entries(parsed.images)) await dataSource.images.put(id, url);
        await dataSource.perfumes.replaceAll(parsed.perfumes);
        await dataSource.usage.replaceAll(parsed.usageLogs);
        await dataSource.offers.replaceAll(parsed.offers);
        await dataSource.settings.save(parsed.settings);
        await reload();
        return {
          perfumes: parsed.perfumes.length,
          usageLogs: parsed.usageLogs.length,
          offers: parsed.offers.length,
        };
      },

      async removeDemoData() {
        const demo = perfumes.filter((p) => p.isDemo);
        const ids = new Set(demo.map((p) => p.id));
        await dataSource.usage.removeMany(usageLogs.filter((l) => ids.has(l.perfumeId)).map((l) => l.id));
        await dataSource.perfumes.removeMany([...ids]);
        for (const p of demo) if (p.imageId) await dataSource.images.remove(p.imageId);
        await reload();
        return demo.length;
      },

      async loadDemoData() {
        const n = await seedDemo();
        await reload();
        return n;
      },

      async resetAll() {
        await dataSource.perfumes.replaceAll([]);
        await dataSource.usage.replaceAll([]);
        await dataSource.offers.replaceAll([]);
        await dataSource.images.clear();
        await dataSource.settings.save(DEFAULT_SETTINGS);
        await reload();
      },

      refresh: reload,
    };

    // Ações chamadas sem tratamento próprio de erro mostram um aviso (ex.: sem internet).
    const guard = <K extends keyof AppDataValue>(key: K) => {
      const fn = base[key] as unknown as (...args: unknown[]) => Promise<unknown>;
      (base as unknown as Record<string, unknown>)[key] = async (...args: unknown[]) => {
        try {
          return await fn(...args);
        } catch (err) {
          notify(err instanceof Error ? err.message : 'Não foi possível concluir a operação.', 'error');
          throw err;
        }
      };
    };
    (
      [
        'toggleFavorite',
        'deletePerfume',
        'deleteUsage',
        'addOffer',
        'updateOffer',
        'deleteOffer',
        'updateSettings',
        'exportData',
        'removeDemoData',
        'loadDemoData',
        'resetAll',
      ] as const
    ).forEach(guard);
    return base;
  }, [status, error, perfumes, usageLogs, offers, settings, dataSource, applyImage, reload, seedDemo, notify]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider.');
  return ctx;
}

export function usePerfume(id: string | undefined): Perfume | undefined {
  const { perfumes } = useAppData();
  return useMemo(() => perfumes.find((p) => p.id === id), [perfumes, id]);
}
