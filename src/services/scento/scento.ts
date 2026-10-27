import { normalize } from '../../utils/text';

/**
 * Cliente da Scento Perfume API (https://www.scento.com/developers):
 * gratuita, sem chave e com CORS liberado — pode ser chamada direto do navegador.
 *
 * Boas práticas exigidas pelos termos (seção 22): somente leitura, sem
 * sobrecarregar o serviço e sem copiar o catálogo. Por isso só consultamos
 * quando o usuário abre algo, guardamos as respostas por 7 dias no aparelho e
 * sempre creditamos e linkamos a página da Scento.
 */

const BASE = 'https://www.scento.com/api/perfume/v1';
const CACHE_KEY = 'parfumania.scento.v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 150;
const TIMEOUT_MS = 9000;

export const SCENTO_SITE = 'https://www.scento.com';
export const SCENTO_CREDIT = 'Scento Perfume API, scento.com';

export interface ScentoLink {
  label: string;
  url: string;
}

export interface Folio<T> {
  folio: string;
  lede: string;
  detail: T;
  scento_page: ScentoLink;
  cite: string;
  continuation: string | null;
}

export interface ScentoMatch {
  kind: 'perfume' | 'house' | 'material';
  name: string;
  house?: string;
  family?: string;
  page: string;
}

export interface ScentoPortrait {
  name: string;
  house: string;
  year: number | null;
  perfumer: string | null;
  concentration: string | null;
  family: string | null;
  subfamily: string | null;
  pyramid: { top: string[]; heart: string[]; base: string[] } | null;
  notes: string[] | null;
  character: string | null;
  character_words: string[];
  wears: { seasons: string[]; hours: string[] } | null;
  signature_materials: string[];
}

export interface ScentoNeighbour {
  name: string;
  house: string;
  page: string;
  family: string;
  shared: string[];
  difference: string;
}

export interface ScentoPick {
  name: string;
  house: string;
  page: string;
  family?: string;
  why: string;
  /** Só no guarda-roupa: daytime, evening, warm weather… */
  role?: string;
}

export type ScentoOccasion =
  | 'office'
  | 'everyday'
  | 'weekend'
  | 'date-night'
  | 'night-out'
  | 'wedding'
  | 'first-impressions'
  | 'summer-days'
  | 'cold-weather'
  | 'workout'
  | 'long-lasting'
  | 'under-the-radar';

export type ScentoLean = 'feminine' | 'masculine' | 'shared';

export class ScentoError extends Error {}

// ---------- Cache (localStorage, por URL) ----------

type CacheMap = Record<string, { t: number; v: unknown }>;

function readCache(): CacheMap {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as CacheMap;
  } catch {
    return {};
  }
}

function writeCache(map: CacheMap) {
  const entries = Object.entries(map).sort((a, b) => b[1].t - a[1].t).slice(0, CACHE_MAX);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* sem espaço: segue sem cache */
  }
}

const inflight = new Map<string, Promise<unknown>>();

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<Folio<T>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const query = qs.toString();
  const url = `${BASE}${path}${query ? `?${query}` : ''}`;

  const cached = readCache()[url];
  if (cached && Date.now() - cached.t < CACHE_TTL_MS) return cached.v as Folio<T>;
  const pending = inflight.get(url);
  if (pending) return pending as Promise<Folio<T>>;

  const request = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
      const body = (await res.json().catch(() => null)) as (Folio<T> & { error?: { message: string } }) | null;
      if (!res.ok || !body || body.error) {
        throw new ScentoError(body?.error?.message ? `Scento: ${body.error.message}` : `A Scento respondeu com erro (${res.status}).`);
      }
      const map = readCache();
      map[url] = { t: Date.now(), v: body };
      writeCache(map);
      return body;
    } catch (err) {
      if (err instanceof ScentoError) throw err;
      throw new ScentoError(
        (err as Error)?.name === 'AbortError'
          ? 'A Scento demorou para responder. Tente de novo em instantes.'
          : 'Não foi possível conectar à Scento. Verifique sua internet.',
      );
    } finally {
      clearTimeout(timer);
      inflight.delete(url);
    }
  })();
  inflight.set(url, request);
  return request;
}

// ---------- Rotas ----------

export const scento = {
  search: (q: string) => get<{ total: number; matches: ScentoMatch[] }>('/search', { q, kind: 'perfume' }),
  portrait: (slug: string) => get<ScentoPortrait>(`/perfumes/${encodeURIComponent(slug)}`),
  neighbours: (slug: string) =>
    get<{ total: number; neighbours: ScentoNeighbour[] }>(`/perfumes/${encodeURIComponent(slug)}/neighbours`),
  edit: (occasion: ScentoOccasion, lean?: ScentoLean) =>
    get<{ occasion: string; edit: ScentoPick[] }>(`/edits/${occasion}`, { gender_lean: lean }),
  wardrobe: (loves: string[], size: number) =>
    get<{ loves: string[]; unknown: string[]; wardrobe: ScentoPick[] }>('/wardrobe', {
      loves: loves.slice(0, 6).join(','),
      size: Math.max(3, Math.min(5, size)),
    }),
};

/** Slug da página de um perfume (".../perfumes/sauvage-dior" → "sauvage-dior"). */
export function slugFromPage(url: string): string | undefined {
  const m = /\/perfumes\/([^/?#]+)/.exec(url);
  return m?.[1];
}

/** Algumas respostas apontam para a página da marca em vez da do perfume. */
export function isPerfumePage(url: string): boolean {
  return slugFromPage(url) !== undefined;
}

// ---------- Encontrar o perfume certo na Scento ----------

const compact = (s: string) => normalize(s).replace(/[^a-z0-9]/g, '');

export function sameHouse(a: string, b: string): boolean {
  const x = compact(a);
  const y = compact(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

function nameScore(candidate: string, wanted: string): number {
  const c = compact(candidate);
  const w = compact(wanted);
  if (!c || !w) return 0;
  if (c === w) return 3;
  if (c.startsWith(w) || w.startsWith(c)) return 2;
  const ct = new Set(normalize(candidate).split(/\W+/).filter(Boolean));
  const wt = normalize(wanted).split(/\W+/).filter(Boolean);
  const overlap = wt.filter((t) => ct.has(t)).length;
  return overlap / Math.max(wt.length, ct.size) >= 0.5 ? 1 : 0;
}

export interface ScentoResolution {
  /** Slug escolhido automaticamente quando há uma correspondência segura. */
  slug?: string;
  /** Candidatos para o usuário escolher (mesma marca primeiro). */
  candidates: ScentoMatch[];
}

/** Procura o perfume pelo nome; só escolhe sozinho quando nome E marca batem. */
export async function resolveScento(name: string, brand: string): Promise<ScentoResolution> {
  let matches = (await scento.search(name)).detail.matches.filter((m) => m.kind === 'perfume');
  if (!matches.some((m) => m.house && sameHouse(m.house, brand)) && brand) {
    const withBrand = (await scento.search(`${brand} ${name}`)).detail.matches.filter((m) => m.kind === 'perfume');
    matches = [...withBrand, ...matches];
  }
  const ranked = matches
    .filter((m, i, all) => all.findIndex((x) => x.page === m.page) === i)
    .map((m) => ({ m, house: !!m.house && sameHouse(m.house, brand), score: nameScore(m.name, name) }))
    .sort((a, b) => Number(b.house) - Number(a.house) || b.score - a.score);
  const best = ranked[0];
  const confident = best && best.house && best.score === 3 && ranked.filter((r) => r.house && r.score === 3).length === 1;
  return {
    slug: confident ? slugFromPage(best.m.page) : undefined,
    candidates: ranked.filter((r) => r.house || r.score >= 2).map((r) => r.m).slice(0, 8),
  };
}
