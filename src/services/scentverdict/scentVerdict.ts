import { translateNote } from '../../data/noteTranslations';
import type { Concentration } from '../../types';
import { normalize } from '../../utils/text';
import { supabase } from '../supabase/client';

/**
 * ScentVerdict (scentverdict.com): gratuito, sem chave. As consultas passam
 * pela Edge Function `scentverdict` (o site não aceita chamadas diretas do
 * navegador). Respostas ficam 7 dias guardadas no aparelho.
 */
export const SCENTVERDICT_SITE = 'https://scentverdict.com';
export const SCENTVERDICT_AVAILABLE = supabase !== null;

export interface SvFragrance {
  slug: string;
  name: string;
  brand: string;
  concentration?: string | null;
  yearLaunched?: number | null;
  verdictBadge?: string | null;
  verdict?: string | null;
  keyNotes?: string[];
  imageUrl?: string | null;
  url: string;
}

export interface SvProfile {
  name: string;
  slug: string;
  phases: { phase: 'top' | 'heart' | 'base' | string; notes: { note: string; family?: string; substantivityHours: number }[] }[];
}

export type SvDirection = 'Similar' | 'Cheaper' | 'Fresher' | 'LongerLasting' | 'MoreIntense' | 'LessSweet';

export interface SvSimilar {
  fragrance: SvFragrance;
  similarityScore?: number;
  whySimilar?: string;
  keyDifference?: string;
  sharedNotes?: string[];
}

export class ScentVerdictError extends Error {}

const CACHE_KEY = 'parfumania.scentverdict.v1';
const TTL = 7 * 24 * 3600_000;
const MAX = 150;

type Cache = Record<string, { t: number; v: unknown }>;
const readCache = (): Cache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
};

/** Pedidos idênticos em andamento são compartilhados (evita consultas duplicadas). */
const inflight = new Map<string, Promise<unknown>>();

function call<T>(tool: string, args: Record<string, unknown>): Promise<T> {
  const key = `${tool}|${JSON.stringify(args)}`;
  const hit = readCache()[key];
  if (hit && Date.now() - hit.t < TTL) return Promise.resolve(hit.v as T);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fetchTool<T>(tool, args, key).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function fetchTool<T>(tool: string, args: Record<string, unknown>, key: string): Promise<T> {
  if (!supabase) throw new ScentVerdictError('O ScentVerdict precisa do login na nuvem.');
  const { data, error } = await supabase.functions.invoke<{ data?: T; error?: string }>('scentverdict', { body: { tool, args } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (ctx?.status === 404) throw new ScentVerdictError('A integração com o ScentVerdict ainda não foi ativada no servidor.');
    throw new ScentVerdictError(body?.error ?? 'Não foi possível consultar o ScentVerdict agora.');
  }
  if (!data || data.error || data.data === undefined) throw new ScentVerdictError(data?.error ?? 'Resposta inesperada do ScentVerdict.');
  try {
    const cache = readCache();
    cache[key] = { t: Date.now(), v: data.data };
    const kept = Object.entries(cache).sort((a, b) => b[1].t - a[1].t).slice(0, MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    /* sem espaço: segue sem cache */
  }
  return data.data;
}

export const scentVerdict = {
  search: (query: string) => call<SvFragrance[]>('search_fragrances', { query, limit: 10 }),
  fragrance: (slug: string) =>
    call<{ fragrance: SvFragrance | null; notFound?: unknown }>('get_fragrance', { slug }).then((r) => r.fragrance),
  profile: (slug: string) => call<SvProfile>('get_scent_profile', { slug }),
  similar: (slug: string, direction: SvDirection) =>
    call<{ results: SvSimilar[] }>('find_similar_fragrances', { anchorSlug: slug, direction, limit: 6 }).then((r) => r.results ?? []),
};

// ---------- Encontrar o perfume certo ----------

const compact = (s: string) => normalize(s).replace(/[^a-z0-9]/g, '');
const sameHouse = (a: string, b: string) => {
  const x = compact(a);
  const y = compact(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
const CONC: Partial<Record<Concentration, string>> = { edc: 'edc', edt: 'edt', edp: 'edp', parfum: 'parfum', extrait: 'extrait' };

export interface SvResolution {
  slug?: string;
  candidates: SvFragrance[];
}

/** Escolhe sozinho só quando nome, marca e (se informada) concentração batem sem ambiguidade. */
export async function resolveScentVerdict(name: string, brand: string, concentration?: Concentration): Promise<SvResolution> {
  const results = await scentVerdict.search(name);
  const sameBrand = results.filter((r) => sameHouse(r.brand, brand));
  const exact = sameBrand.filter((r) => compact(r.name) === compact(name));
  const wanted = concentration ? CONC[concentration] : undefined;
  const byConc = wanted ? exact.filter((r) => normalize(r.concentration ?? '') === wanted) : exact;
  const slug = byConc.length === 1 ? byConc[0].slug : !wanted && exact.length === 1 ? exact[0].slug : undefined;
  return { slug, candidates: (sameBrand.length ? sameBrand : results).slice(0, 8) };
}

// ---------- Tradução das frases (modelos fixos) ----------

const list = (s: string) => {
  const parts = s.split(/, | and /).map((x) => translateNote(x.trim()).toLowerCase()).filter(Boolean);
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
};

/** "Shares 7 of its 9 notes, including X" / "Adds X, drops Y" → português; outras frases ficam no original. */
export function translateSv(text?: string | null): { text: string; translated: boolean } {
  const t = (text ?? '').trim().replace(/\.$/, '');
  let m = /^Shares (\d+) of its (\d+) notes, including (.+)$/i.exec(t);
  if (m) return { text: `Tem ${m[1]} das ${m[2]} notas em comum, como ${list(m[3])}.`, translated: true };
  m = /^Every one of its (\d+) notes is in the original, including (.+)$/i.exec(t);
  if (m) return { text: `Todas as ${m[1]} notas dele estão no original, como ${list(m[2])}.`, translated: true };
  if (/^Very similar olfactory profile and scent character$/i.test(t))
    return { text: 'Perfil olfativo e caráter muito parecidos.', translated: true };
  if (/^Near-identical note list, differs in proportion$/i.test(t))
    return { text: 'Notas quase idênticas; muda a proporção entre elas.', translated: true };
  m = /^Without (.+)$/i.exec(t);
  if (m) return { text: `Sem ${list(m[1])}.`, translated: true };
  m = /^Adds (.+?), drops (.+)$/i.exec(t);
  if (m) return { text: `Acrescenta ${list(m[1])}; deixa de fora ${list(m[2])}.`, translated: true };
  m = /^Adds (.+)$/i.exec(t);
  if (m) return { text: `Acrescenta ${list(m[1])}.`, translated: true };
  m = /^Drops (.+)$/i.exec(t);
  if (m) return { text: `Deixa de fora ${list(m[1])}.`, translated: true };
  return { text: text ?? '', translated: false };
}

const BADGE: Record<string, string> = {
  favourite: 'Favorito',
  favorite: 'Favorito',
  'hidden gem': 'Joia escondida',
  'crowd pleaser': 'Agrada a todos',
  'cult classic': 'Clássico cult',
  classic: 'Clássico',
  'great value': 'Ótimo custo-benefício',
  'best value': 'Melhor custo-benefício',
  overrated: 'Superestimado',
  divisive: 'Divide opiniões',
};
export const svBadge = (b?: string | null) => (b ? BADGE[b.toLowerCase()] ?? b : undefined);
