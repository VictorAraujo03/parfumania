// Parfumania — busca de preços nas lojas via Google Shopping (SerpApi).
//
// - Só usuários logados (auth: 'user'; verify_jwt fica ligado).
// - A chave da SerpApi fica no segredo SERPAPI_KEY do Supabase, nunca no app.
// - Cache compartilhado de 24 h por busca e limite diário de buscas novas por usuário.
// - Tabelas em supabase/prices.sql (acesso só pela chave secreta).
import { withSupabase } from 'npm:@supabase/server@1.9.2';

const CACHE_HOURS = 24;
const DAILY_LIMIT = 25;
const MAX_OFFERS = 40;

interface ShoppingResult {
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  link?: string;
  product_link?: string;
  thumbnail?: string;
  rating?: number;
  reviews?: number;
  delivery?: string;
  second_hand_condition?: string;
}

export interface Offer {
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

const json = (body: unknown, status = 200) => Response.json(body, { status });

function normalizeQuery(q: unknown): string | undefined {
  if (typeof q !== 'string') return undefined;
  const clean = q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  return clean.length >= 3 ? clean : undefined;
}

function toOffers(results: ShoppingResult[] = []): Offer[] {
  return results
    .filter((r) => typeof r.extracted_price === 'number' && r.extracted_price > 0 && r.title && r.source)
    .slice(0, MAX_OFFERS)
    .map((r) => ({
      title: r.title!,
      store: r.source!,
      price: r.extracted_price!,
      priceText: r.price,
      oldPrice: r.extracted_old_price,
      url: r.link ?? r.product_link,
      image: r.thumbnail,
      rating: r.rating,
      reviews: r.reviews,
      delivery: r.delivery,
      secondHand: r.second_hand_condition,
    }));
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const userId = ctx.userClaims?.id;
    if (!userId) return json({ error: 'Faça login para buscar preços.' }, 401);

    const body = await req.json().catch(() => ({}));
    const query = normalizeQuery((body as { q?: unknown }).q);
    if (!query) return json({ error: 'Informe o nome do perfume (3 a 120 caracteres).' }, 400);

    const admin = ctx.supabaseAdmin;

    // 1. Cache compartilhado (dados públicos das lojas).
    const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
    const { data: cached } = await admin
      .from('price_search_cache')
      .select('results, fetched_at')
      .eq('query', query)
      .gte('fetched_at', since)
      .maybeSingle();
    if (cached) return json({ query, fetchedAt: cached.fetched_at, cached: true, offers: cached.results });

    // 2. Limite diário de buscas novas por usuário (filtrado pelo id de quem chamou).
    const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count } = await admin
      .from('price_search_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('searched_at', dayAgo);
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: `Limite de ${DAILY_LIMIT} buscas novas por dia atingido. Buscas repetidas continuam funcionando.` }, 429);
    }

    // 3. SerpApi — Google Shopping Brasil.
    const key = Deno.env.get('SERPAPI_KEY');
    if (!key) return json({ error: 'A busca de preços ainda não foi configurada no servidor (segredo SERPAPI_KEY).' }, 503);
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: query,
      gl: 'br',
      hl: 'pt-br',
      google_domain: 'google.com.br',
      api_key: key,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok && !data.shopping_results) {
      console.error('SerpApi', res.status, data.error);
      const quota = /run out|plan|limit/i.test(String(data.error ?? ''));
      return json(
        { error: quota ? 'A cota mensal da busca de preços acabou. Tente no próximo mês.' : 'A busca de preços está indisponível agora.' },
        quota ? 503 : 502,
      );
    }
    const offers = toOffers(data.shopping_results);
    const fetchedAt = new Date().toISOString();

    await admin.from('price_search_usage').insert({ user_id: userId });
    await admin.from('price_search_cache').upsert({ query, results: offers, fetched_at: fetchedAt });
    // Limpeza leve: registros de uso com mais de 2 dias não servem mais.
    await admin.from('price_search_usage').delete().lt('searched_at', new Date(Date.now() - 48 * 3600_000).toISOString());

    return json({ query, fetchedAt, cached: false, offers });
  }),
};
