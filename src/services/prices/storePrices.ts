import { supabase } from '../supabase/client';
import { normalize } from '../../utils/text';

/**
 * Busca de preços nas lojas (Google Shopping, via a Edge Function
 * `price-search` do Supabase — a chave da SerpApi fica no servidor).
 * Os preços são os exibidos pelas lojas no momento da busca: nada é estimado.
 */
export interface StoreOffer {
  title: string;
  store: string;
  price: number;
  priceText?: string;
  oldPrice?: number;
  url?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  secondHand?: string;
}

export interface StoreSearchResult {
  query: string;
  fetchedAt: string;
  cached: boolean;
  offers: StoreOffer[];
}

export const STORE_PRICES_AVAILABLE = supabase !== null;

export class StorePriceError extends Error {}

/** Lojas reconhecidas, preferidas no desempate e destacadas na lista. */
const RENOWNED = [
  'sephora',
  'beleza na web',
  'epoca cosmeticos',
  'epoca',
  'beauty outlet',
  'mercado livre',
  'amazon',
  'magazine luiza',
  'magalu',
  'o boticario',
  'natura',
  'drogasil',
  'droga raia',
  'americanas',
  'casas bahia',
  'the beauty box',
  'boticario',
];

export function isRenowned(store: string): boolean {
  const s = normalize(store);
  return RENOWNED.some((r) => s.includes(r));
}

export function buildPriceQuery(name: string, brand?: string, volumeMl?: number): string {
  return [brand, name, volumeMl ? `${volumeMl}ml` : null].filter(Boolean).join(' ');
}

export async function searchStorePrices(query: string): Promise<StoreSearchResult> {
  if (!supabase) throw new StorePriceError('A busca de preços precisa do login na nuvem (Supabase).');
  const { data, error } = await supabase.functions.invoke<StoreSearchResult & { error?: string }>('price-search', {
    body: { q: query },
  });
  if (error) {
    // Erros da função vêm com uma mensagem em português no corpo.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (body?.error) throw new StorePriceError(body.error);
    if (ctx?.status === 404) throw new StorePriceError('A busca de preços ainda não foi ativada no servidor.');
    throw new StorePriceError('Não foi possível buscar preços agora. Tente de novo em instantes.');
  }
  if (!data || data.error) throw new StorePriceError(data?.error ?? 'Resposta inesperada da busca de preços.');
  return data;
}

const tokens = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter((t) => t.length > 1);

/**
 * A oferta é deste perfume? Exige o nome (e a marca, quando houver) no título
 * e descarta kits, amostras e miniaturas; se o volume for conhecido, ele precisa bater.
 */
export function matchesPerfume(o: StoreOffer, name: string, brand?: string, volumeMl?: number): boolean {
  const title = normalize(o.title);
  const titleTokens = new Set(tokens(o.title));
  const nameTokens = tokens(name);
  if (nameTokens.length && nameTokens.filter((t) => titleTokens.has(t)).length < Math.ceil(nameTokens.length * 0.75)) return false;
  if (brand) {
    const brandTokens = tokens(brand);
    if (brandTokens.length && !brandTokens.some((t) => titleTokens.has(t))) return false;
  }
  if (/\b(kit|amostra|miniatura|decant|refil|sabonete|desodorante|body|gel|locao|loção|creme|shampoo)\b/.test(title)) return false;
  if (volumeMl) {
    const ml = /(\d{2,3})\s?ml/.exec(title);
    if (ml && Number(ml[1]) !== volumeMl) return false;
  }
  return true;
}

/**
 * As 3 melhores para comparar: as mais baratas que correspondem ao perfume,
 * uma por loja, com lojas reconhecidas na frente em caso de preço parecido (±3%).
 */
export function pickBestOffers(offers: StoreOffer[], name: string, brand?: string, volumeMl?: number, count = 3): StoreOffer[] {
  const relevant = offers.filter((o) => !o.secondHand && matchesPerfume(o, name, brand, volumeMl));
  const sorted = [...relevant].sort((a, b) => {
    const close = Math.abs(a.price - b.price) <= Math.min(a.price, b.price) * 0.03;
    if (close && isRenowned(a.store) !== isRenowned(b.store)) return isRenowned(a.store) ? -1 : 1;
    return a.price - b.price;
  });
  const seen = new Set<string>();
  const out: StoreOffer[] = [];
  for (const o of sorted) {
    const store = normalize(o.store);
    if (seen.has(store)) continue;
    seen.add(store);
    out.push(o);
    if (out.length >= count) break;
  }
  return out;
}
