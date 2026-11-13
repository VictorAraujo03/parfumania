import { createHash, webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fn from './index';

// Banco falso com o mínimo de encadeamento usado pela função.
type Row = Record<string, unknown>;
function fakeAdmin(tables: Record<string, Row[]>) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let op = 'select';
    let payload: unknown;
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => ((rows = rows.filter((r) => r[col] === val)), q),
      gte: () => q,
      lt: () => q,
      or: () => q,
      limit: () => q,
      update: (p: unknown) => ((op = 'update'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      insert: (p: unknown) => ((op = 'insert'), (payload = p), q),
      maybeSingle: async () => (calls.push({ table, op, payload }), { data: rows[0] ?? null }),
      then: (resolve: (v: unknown) => void) => (calls.push({ table, op, payload }), resolve({ data: rows })),
    };
    return q;
  };
  return { admin: { from, storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://signed/img' } }) }) } }, calls };
}

const handler = fn.fetch as unknown as (req: Request, ctx: unknown) => Promise<Response>;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';

const tables = () => ({
  widget_tokens: [{ user_id: 'u1', token_hash: sha(TOKEN) }],
  perfumes: [
    { user_id: 'u1', data: { id: 'p1', name: 'Acqua di Giò', brand: 'Armani', status: 'owned', accords: ['Cítrico', 'Aquático', 'Fresco'], imageUrl: 'https://img/acqua' } },
    { user_id: 'u1', data: { id: 'p2', name: 'Tobacco Vanille', brand: 'Tom Ford', status: 'owned', accords: ['Baunilha', 'Tabaco', 'Doce'], imageId: 'img9' } },
  ],
  usage_logs: [],
  user_settings: [{ user_id: 'u1', data: { city: { latitude: -22.9, longitude: -43.2, name: 'Rio de Janeiro' } } }],
  user_locations: [],
  push_subscriptions: [] as Row[],
});

// O Node 16 dos testes não tem Request/Response/crypto globais (o Deno tem): versões mínimas.
class FakeRequest {
  constructor(public url: string, private init: { method?: string; body?: string } = {}) {}
  get method() {
    return this.init.method ?? 'GET';
  }
  async json() {
    return JSON.parse(this.init.body ?? '{}');
  }
}
const FakeResponse = { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, json: async () => body }) };
const Request = FakeRequest as unknown as typeof globalThis.Request;

beforeEach(() => {
  vi.stubGlobal('Deno', { env: { get: () => undefined } });
  vi.stubGlobal('Response', FakeResponse);
  if (!globalThis.crypto) vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 33, apparent_temperature: 35, relative_humidity_2m: 40, weather_code: 0, is_day: 1 } }) })));
});
afterEach(() => vi.unstubAllGlobals());

describe('função parfumania-daily', () => {
  it('widget: devolve o perfume do dia com clima, motivo e foto', async () => {
    const { admin } = fakeAdmin(tables());
    const res = await handler(new Request(`https://x/functions/v1/parfumania-daily?task=widget&token=${TOKEN}`), { authMode: 'none', supabaseAdmin: admin });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.pick.name).toBe('Acqua di Giò');
    expect(body.pick.reason).toBe('Fresco para encarar 35°C');
    expect(body.pick.image).toBe('https://img/acqua');
    expect(body.alternatives[0].image).toBe('https://signed/img'); // foto própria vira link temporário
    expect(body.weather).toMatchObject({ temperatureC: 33, place: 'Rio de Janeiro', description: 'Céu limpo' });
  });

  it('widget: recusa chave errada', async () => {
    const { admin } = fakeAdmin(tables());
    const res = await handler(new Request('https://x/?task=widget&token=errada-errada-errada-errada'), { authMode: 'none', supabaseAdmin: admin });
    expect(res.status).toBe(401);
  });

  it('agendamento: só com a chave secreta; inscrição nova é apenas agendada', async () => {
    const t = tables();
    t.push_subscriptions = [{ id: 1, user_id: 'u1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a', periods: ['morning'], timezone: 'America/Sao_Paulo', next_at: null }];
    const { admin, calls } = fakeAdmin(t);
    const denied = await handler(new Request('https://x/?task=reminders', { method: 'POST' }), { authMode: 'none', supabaseAdmin: admin });
    expect(denied.status).toBe(401);
    const res = await handler(new Request('https://x/?task=reminders', { method: 'POST' }), { authMode: 'secret', supabaseAdmin: admin });
    expect(await res.json()).toMatchObject({ ok: true, checked: 1, sent: 0 });
    const upd = calls.find((c) => c.table === 'push_subscriptions' && c.op === 'update');
    expect((upd?.payload as { next_at: string }).next_at).toMatch(/^\d{4}-/);
  });

  it('teste de notificação exige login', async () => {
    const { admin } = fakeAdmin(tables());
    const res = await handler(new Request('https://x/?task=test', { method: 'POST' }), { authMode: 'none', supabaseAdmin: admin });
    expect(res.status).toBe(401);
  });
});
