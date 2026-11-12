// Parfumania — ponte para o ScentVerdict (https://scentverdict.com/mcp).
//
// O ScentVerdict é gratuito e somente leitura, mas não aceita chamadas diretas
// do navegador (sem CORS). Esta função repassa APENAS as consultas usadas pelo
// app (busca, ficha, perfil das notas e parecidos), para usuários logados.
// Não há chave nem segredo envolvidos.
import { withSupabase } from 'npm:@supabase/server@1.9.2';

const MCP = 'https://scentverdict.com/mcp';
const TOOLS = new Set(['search_fragrances', 'get_fragrance', 'get_scent_profile', 'find_similar_fragrances']);
const DIRECTIONS = new Set(['Similar', 'Cheaper', 'Fresher', 'LongerLasting', 'MoreIntense', 'LessSweet']);
const SLUG = /^[a-z0-9][a-z0-9-]{1,150}$/;

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Sessão MCP reaproveitada enquanto a instância da função estiver ativa. */
let session: string | undefined;

async function rpc(body: unknown, sid?: string) {
  const res = await fetch(MCP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(sid ? { 'Mcp-Session-Id': sid } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // A resposta pode vir como JSON puro ou como evento SSE ("data: {...}").
  const line = text
    .split('\n')
    .map((l) => l.replace(/^data:\s?/, ''))
    .find((l) => l.trim().startsWith('{'));
  return { res, msg: line ? JSON.parse(line) : undefined };
}

async function openSession(): Promise<string | undefined> {
  const { res } = await rpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'parfumania', version: '1.0' } },
  });
  const sid = res.headers.get('mcp-session-id') ?? undefined;
  await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
  return sid;
}

async function callTool(name: string, args: Record<string, unknown>, retry = true): Promise<unknown> {
  session ??= await openSession();
  const { res, msg } = await rpc({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }, session);
  if (retry && (res.status === 400 || res.status === 404 || !msg)) {
    // Sessão expirada: abre outra e tenta uma vez.
    session = undefined;
    return callTool(name, args, false);
  }
  if (!msg) throw new Error(`Resposta vazia (${res.status}).`);
  if (msg.error) throw new Error(msg.error.message ?? 'Erro no ScentVerdict.');
  const text = (msg.result?.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
  if (msg.result?.isError) throw new Error(text || 'Erro no ScentVerdict.');
  return JSON.parse(text);
}

/** Valida e limita os argumentos de cada consulta. */
function sanitize(tool: string, a: Record<string, unknown>): Record<string, unknown> | undefined {
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim().length >= 2 ? v.trim().slice(0, max) : undefined);
  const lim = (v: unknown, max: number) => Math.max(1, Math.min(max, Number(v) || 5));
  if (tool === 'search_fragrances') {
    const query = str(a.query, 80);
    return query ? { query, limit: lim(a.limit, 10) } : undefined;
  }
  const slug = typeof (a.slug ?? a.anchorSlug) === 'string' ? String(a.slug ?? a.anchorSlug) : '';
  if (!SLUG.test(slug)) return undefined;
  if (tool === 'find_similar_fragrances') {
    const direction = typeof a.direction === 'string' && DIRECTIONS.has(a.direction) ? a.direction : 'Similar';
    return { anchorSlug: slug, direction, limit: lim(a.limit, 8) };
  }
  return { slug };
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req) => {
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
    const body = (await req.json().catch(() => ({}))) as { tool?: string; args?: Record<string, unknown> };
    if (!body.tool || !TOOLS.has(body.tool)) return json({ error: 'Consulta não permitida.' }, 400);
    const args = sanitize(body.tool, body.args ?? {});
    if (!args) return json({ error: 'Parâmetros inválidos.' }, 400);
    try {
      return json({ data: await callTool(body.tool, args) });
    } catch (err) {
      console.error('ScentVerdict', body.tool, err);
      return json({ error: 'O ScentVerdict não respondeu agora. Tente de novo em instantes.' }, 502);
    }
  }),
};
