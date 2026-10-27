import type { SupabaseClient } from '@supabase/supabase-js';
import type { Perfume, PriceOffer, Settings, UsageLog } from '../../types';
import { StorageError } from '../storage/keyValueStore';
import { CURRENT_SCHEMA_VERSION, migrate } from '../storage/migrations';
import {
  normalizeList,
  normalizeOffer,
  normalizePerfume,
  normalizeSettings,
  normalizeUsage,
} from '../storage/normalize';
import type { DataSource, EntityRepository, ImageRepository, SettingsRepository } from '../storage/repositories';

/**
 * Fonte de dados na nuvem (Supabase). Implementa a mesma interface
 * `DataSource` da versão local, então a interface do app não muda.
 * Tabelas e regras de acesso: supabase/schema.sql.
 */

const BUCKET = 'perfume-images';
const CHUNK = 200;

interface PgError {
  message: string;
  code?: string;
}

/** Traduz erros do Supabase/Postgres para mensagens úteis. */
export function friendlyError(err: PgError | null | undefined, action: string): StorageError {
  const code = err?.code ?? '';
  const msg = err?.message ?? '';
  if (code === '42P01' || code === 'PGRST205' || /does not exist|could not find the table/i.test(msg)) {
    return new StorageError('As tabelas do banco ainda não existem. Execute o script supabase/schema.sql no Supabase.');
  }
  if (/failed to fetch|network/i.test(msg)) {
    return new StorageError(`Sem conexão com o servidor ao ${action}. Verifique sua internet e tente novamente.`);
  }
  if (code === '42501' || /row-level security|permission/i.test(msg)) {
    return new StorageError(`Permissão negada ao ${action}. Entre novamente na sua conta.`);
  }
  return new StorageError(`Não foi possível ${action}${msg ? `: ${msg}` : '.'}`);
}

function chunks<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Cliente mínimo usado pelos repositórios (facilita testes com um falso). */
type Db = Pick<SupabaseClient, 'from'>;

export function createRemoteEntityRepository<T extends { id: string }>(
  db: Db,
  table: string,
  userId: string,
  normalizeItem: (raw: unknown) => T | null,
): EntityRepository<T> {
  const now = () => new Date().toISOString();

  async function get(id: string): Promise<T | undefined> {
    const { data, error } = await db.from(table).select('data').eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw friendlyError(error, 'carregar o registro');
    return data ? normalizeItem((data as { data: unknown }).data) ?? undefined : undefined;
  }

  return {
    async list() {
      const all: unknown[] = [];
      // Paginação: o PostgREST limita o número de linhas por requisição.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from(table)
          .select('data')
          .eq('user_id', userId)
          .order('id')
          .range(from, from + 999);
        if (error) throw friendlyError(error, 'carregar seus dados');
        const rows = (data ?? []) as { data: unknown }[];
        all.push(...rows.map((r) => r.data));
        if (rows.length < 1000) break;
      }
      return normalizeList(all, normalizeItem);
    },
    get,
    async create(item) {
      const { error } = await db.from(table).insert({ user_id: userId, id: item.id, data: item, updated_at: now() });
      if (error) throw friendlyError(error, 'salvar');
      return item;
    },
    async update(id, patch) {
      const current = await get(id);
      if (!current) throw new StorageError('Registro não encontrado.');
      const updated = { ...current, ...patch, id } as T;
      const { error } = await db
        .from(table)
        .update({ data: updated, updated_at: now() })
        .eq('user_id', userId)
        .eq('id', id);
      if (error) throw friendlyError(error, 'salvar as alterações');
      return updated;
    },
    async remove(id) {
      const { error } = await db.from(table).delete().eq('user_id', userId).eq('id', id);
      if (error) throw friendlyError(error, 'excluir');
    },
    async removeMany(ids) {
      for (const part of chunks(ids, 100)) {
        const { error } = await db.from(table).delete().eq('user_id', userId).in('id', part);
        if (error) throw friendlyError(error, 'excluir');
      }
    },
    async replaceAll(items) {
      const { error } = await db.from(table).delete().eq('user_id', userId);
      if (error) throw friendlyError(error, 'substituir os dados');
      for (const part of chunks(items)) {
        const { error: insertError } = await db
          .from(table)
          .insert(part.map((item) => ({ user_id: userId, id: item.id, data: item, updated_at: now() })));
        if (insertError) throw friendlyError(insertError, 'enviar os dados');
      }
    },
  };
}

function createRemoteSettingsRepository(db: Db, userId: string): SettingsRepository {
  return {
    async get() {
      const { data, error } = await db.from('user_settings').select('data').eq('user_id', userId).maybeSingle();
      if (error) throw friendlyError(error, 'carregar as configurações');
      return normalizeSettings((data as { data?: unknown } | null)?.data);
    },
    async save(settings: Settings) {
      const { error } = await db
        .from('user_settings')
        .upsert({ user_id: userId, data: settings, schema_version: CURRENT_SCHEMA_VERSION, updated_at: new Date().toISOString() });
      if (error) throw friendlyError(error, 'salvar as configurações');
      return settings;
    },
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function createRemoteImageRepository(client: SupabaseClient, userId: string): ImageRepository {
  const bucket = () => client.storage.from(BUCKET);
  const path = (id: string) => `${userId}/${id}`;

  async function listIds(): Promise<string[]> {
    const { data, error } = await bucket().list(userId, { limit: 1000 });
    if (error) throw friendlyError(error, 'listar as imagens');
    return (data ?? []).map((f) => f.name);
  }

  return {
    async get(id) {
      const { data, error } = await bucket().download(path(id));
      if (error || !data) return undefined;
      return blobToDataUrl(data);
    },
    async put(id, dataUrl) {
      const blob = await (await fetch(dataUrl)).blob();
      const { error } = await bucket().upload(path(id), blob, { upsert: true, contentType: blob.type });
      if (error) throw friendlyError(error, 'enviar a imagem');
    },
    async remove(id) {
      await bucket().remove([path(id)]);
    },
    async getAll() {
      const out: Record<string, string> = {};
      for (const id of await listIds()) {
        const url = await this.get(id);
        if (url) out[id] = url;
      }
      return out;
    },
    async clear() {
      const ids = await listIds();
      for (const part of chunks(ids, 100)) await bucket().remove(part.map(path));
    },
  };
}

export function createSupabaseDataSource(client: SupabaseClient, userId: string): DataSource {
  const perfumes = createRemoteEntityRepository<Perfume>(client, 'perfumes', userId, normalizePerfume);
  const usage = createRemoteEntityRepository<UsageLog>(client, 'usage_logs', userId, normalizeUsage);
  const offers = createRemoteEntityRepository<PriceOffer>(client, 'offers', userId, normalizeOffer);
  const settings = createRemoteSettingsRepository(client, userId);

  return {
    remote: true,
    perfumes,
    usage,
    offers,
    settings,
    images: createRemoteImageRepository(client, userId),
    async initialize() {
      const { data, error } = await client
        .from('user_settings')
        .select('schema_version, data')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw friendlyError(error, 'carregar sua conta');
      const row = data as { schema_version: number; data: unknown } | null;

      if (!row) {
        // Conta nova: grava as configurações padrão e sinaliza primeiro acesso.
        await settings.save(normalizeSettings(undefined));
        const { count } = await client.from('perfumes').select('id', { count: 'exact', head: true }).eq('user_id', userId);
        return { firstRun: !count };
      }

      if (row.schema_version < CURRENT_SCHEMA_VERSION) {
        const migrated = migrate({
          schemaVersion: row.schema_version,
          perfumes: await perfumes.list(),
          usageLogs: await usage.list(),
          offers: await offers.list(),
          settings: row.data,
        });
        await perfumes.replaceAll(normalizeList(migrated.perfumes, normalizePerfume));
        await usage.replaceAll(normalizeList(migrated.usageLogs, normalizeUsage));
        await offers.replaceAll(normalizeList(migrated.offers, normalizeOffer));
        await settings.save(normalizeSettings(migrated.settings));
      }
      return { firstRun: false };
    },
  };
}
