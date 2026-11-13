// Parfumania — perfume do dia: notificações nos horários sorteados e dados do widget.
//
// Tarefas (?task=…):
// - reminders  (chave secreta; chamada pelo pg_cron a cada 10 min) — envia para quem chegou no horário;
// - test       (usuário logado) — envia agora uma notificação de teste para os aparelhos da pessoa;
// - widget     (chave pessoal do widget, ?token=…) — devolve o perfume do dia em JSON para o Scriptable.
//
// Segredos: VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY (base64url) e, opcionais, VAPID_SUBJECT e APP_URL.
// Envio com web-push-neo (criptografia aes128gcm, RFC 8291, aceita pelo Safari/iOS).
// Tabelas: supabase/daily.sql. O motor aqui é uma versão compacta do motor do app
// (src/services/recommendations): clima, período, preferência e rodízio.
import { withSupabase } from 'npm:@supabase/server@1.9.2';
import { sendNotification } from 'npm:web-push-neo@0.1.2';

// ---------- Tipos mínimos dos dados do app ----------

export interface Perfume {
  id: string;
  name: string;
  brand: string;
  status: string;
  favorite?: boolean;
  rating?: number;
  remainingMl?: number;
  accords?: string[];
  topNotes?: string[];
  heartNotes?: string[];
  baseNotes?: string[];
  climates?: string[];
  periods?: string[];
  occasions?: string[];
  imageId?: string;
  imageUrl?: string;
}
export interface UsageLog {
  perfumeId: string;
  usedAt: string;
  rating?: number;
}
export interface Weather {
  temperatureC?: number;
  apparentC?: number;
  humidity?: number;
  code?: number;
  isDay?: boolean;
  place?: string;
}
export type Period = 'morning' | 'afternoon' | 'evening';

// ---------- Perfil fresco ↔ quente (resumo do src/services/recommendations/profile.ts) ----------

const ACCORD_WARMTH: Record<string, number> = {
  citrico: -1, fresco: -0.9, aquatico: -1, marinho: -1, ozonico: -0.9, verde: -0.7, herbal: -0.5,
  'especiado fresco': -0.4, aromatico: -0.4, frutado: -0.3, lavanda: -0.2, floral: -0.1, iris: 0.2,
  atalcado: 0.2, almiscarado: 0.1, amadeirado: 0.3, chipre: 0.2, cremoso: 0.4, doce: 0.6, especiado: 0.5,
  'especiado quente': 0.9, canela: 0.8, resinoso: 0.8, balsamico: 0.8, ambar: 0.9, oriental: 0.9,
  baunilha: 0.9, gourmand: 0.9, caramelo: 1, mel: 0.8, cafe: 0.8, cacau: 0.9, tabaco: 0.9, couro: 0.8,
  defumado: 0.8, oud: 1,
};
const NOTE_WARMTH: [string, number][] = [
  ['bergamota', -0.9], ['limao', -1], ['toranja', -0.9], ['tangerina', -0.8], ['laranja', -0.7], ['neroli', -0.6],
  ['hortela', -1], ['pimenta', 0.3], ['menta', -1], ['marinh', -1], ['aquatic', -1], ['cha verde', -0.7],
  ['lavanda', -0.2], ['cedro', 0.2], ['sandalo', 0.4], ['patchouli', 0.5], ['fava tonka', 0.9], ['baunilha', 0.9],
  ['ambar', 0.9], ['benjoim', 0.9], ['incenso', 0.8], ['oud', 1], ['tabaco', 0.9], ['couro', 0.8], ['canela', 0.8],
];
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function warmthOf(p: Perfume): number | undefined {
  const items: [number, number][] = [];
  (p.accords ?? []).forEach((a, i) => {
    const v = ACCORD_WARMTH[fold(a)];
    if (v !== undefined) items.push([v, 2 / (1 + i * 0.3)]);
  });
  for (const n of [...(p.topNotes ?? []), ...(p.heartNotes ?? []), ...(p.baseNotes ?? [])]) {
    const k = fold(n);
    const hit = NOTE_WARMTH.find(([key]) => new RegExp(`(^|[\\s'(-])${key}`).test(k));
    if (hit) items.push([hit[1], 0.8]);
  }
  if (items.length < 2) return undefined;
  const total = items.reduce((s, [, w]) => s + w, 0);
  return items.reduce((s, [v, w]) => s + v * w, 0) / total;
}

// ---------- Escolha do perfume do dia ----------

export type Feel = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';
export const feelOf = (t: number, hotMin = 26, coldMax = 16): Feel =>
  t >= hotMin + 4 ? 'hot' : t >= hotMin ? 'warm' : t >= coldMax ? 'mild' : t >= coldMax - 6 ? 'cool' : 'cold';
export const isRainy = (code?: number) =>
  code !== undefined && ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95);

export interface Pick {
  perfume: Perfume;
  score: number;
  /** Dias desde o último uso (undefined = nunca usado). */
  daysSince?: number;
}

const DAY = 864e5;
const PERIOD_WARMTH: Record<Period, number> = { morning: -0.4, afternoon: -0.2, evening: 0.4 };

export function rankPerfumes(perfumes: Perfume[], logs: UsageLog[], weather: Weather, period: Period, now = new Date(), thresholds = { hotMinC: 26, coldMaxC: 16 }): Pick[] {
  const temp = weather.apparentC ?? weather.temperatureC;
  const ideal = temp === undefined ? undefined : Math.max(-1, Math.min(1, (22 - temp) / 12));
  const band = temp === undefined ? undefined : temp >= thresholds.hotMinC ? 'hot' : temp < thresholds.coldMaxC ? 'cold' : 'mild';
  return perfumes
    .filter((p) => (p.status === 'owned' || p.status === 'decant') && p.remainingMl !== 0)
    .map((p) => {
      const w = warmthOf(p);
      let score = 0.5;
      // Clima: marcações suas valem mais; o perfil dos acordes/notas completa.
      if (band && p.climates?.length) score += p.climates.includes(band) ? 0.35 : p.climates.includes('mild') || band === 'mild' ? 0.1 : -0.25;
      if (ideal !== undefined && w !== undefined) score += (0.5 - Math.abs(w - ideal)) * 0.5;
      if (isRainy(weather.code) && p.climates?.includes('rainy')) score += 0.15;
      // Período do dia.
      if (p.periods?.length) {
        const map: Record<Period, string[]> = { morning: ['morning'], afternoon: ['afternoon'], evening: ['evening', 'night'] };
        score += p.periods.some((x) => map[period].includes(x)) ? 0.15 : -0.05;
      } else if (w !== undefined) score += (0.5 - Math.abs(w - PERIOD_WARMTH[period])) * 0.15;
      // Preferência pessoal.
      if (p.favorite) score += 0.12;
      if (p.rating) score += (p.rating - 3) * 0.05;
      const own = logs.filter((l) => l.perfumeId === p.id);
      const rated = own.filter((l) => l.rating);
      if (rated.length) score += ((rated.reduce((s, l) => s + (l.rating ?? 0), 0) / rated.length) - 3) * 0.05;
      // Rodízio.
      const last = own.reduce<string | undefined>((m, l) => (!m || l.usedAt > m ? l.usedAt : m), undefined);
      const daysSince = last ? Math.floor((now.getTime() - Date.parse(last)) / DAY) : undefined;
      if (daysSince === 0) score -= 0.3;
      else if (daysSince === 1) score -= 0.15;
      else if (daysSince !== undefined && daysSince >= 21) score += 0.08;
      return { perfume: p, score, daysSince };
    })
    .sort((a, b) => b.score - a.score);
}

/** Sorteia entre os 3 melhores (60/25/15%) para variar ao longo do dia. */
export function choosePick(ranked: Pick[], rnd = Math.random): Pick | undefined {
  const top = ranked.slice(0, 3);
  if (top.length <= 1) return top[0];
  const weights = [0.6, 0.25, 0.15].slice(0, top.length);
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= weights[i];
    if (r <= 0) return top[i];
  }
  return top[0];
}

// ---------- Frases ----------

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const pickOne = <T,>(xs: T[], rnd = Math.random) => xs[Math.floor(rnd() * xs.length)];

const TITLES: Record<Period, string[]> = {
  morning: ['Bom dia ☀️', 'Bom dia!', 'Hora de se perfumar', 'Seu perfume de hoje'],
  afternoon: ['Boa tarde', 'Pausa para o perfume', 'Retoque da tarde?'],
  evening: ['Boa noite 🌙', 'Vai sair hoje?', 'Perfume para a noite'],
};

const LINES: Record<string, string[]> = {
  hot: [
    'Nossa, que calorzão! {temp}{place}. Que tal usar o {p} hoje?',
    'Dia quente pede frescor: o {p} é a escolha certa.',
    'Com {temp}, o {p} vai te deixar leve o dia todo.',
    'Calor de verdade lá fora ({temp}). Bora de {p}?',
  ],
  warm: [
    'Clima quentinho hoje ({temp}). O {p} combina demais.',
    'Tarde ensolarada? O {p} é perfeito para {temp}.',
    'Tempo quente e gostoso: hoje é dia de {p}.',
  ],
  mild: [
    'Hoje o clima está agradável pra você usar o {p}.',
    'Dia ameno, {temp}{place}: perfeito para o {p}.',
    'Clima equilibrado hoje. Que tal variar com o {p}?',
  ],
  cool: [
    'Tempo fresquinho ({temp}). Que tal o {p}?',
    'Friozinho leve lá fora… o {p} cai muito bem.',
  ],
  cold: [
    'Friozinho de {temp}! Hora do {p} te aquecer.',
    'Dia frio pede algo envolvente: {p}.',
    'Com esse frio, o {p} vai durar o dia todo na pele.',
  ],
  rain: [
    'Dia de chuva… o {p} deixa tudo mais aconchegante.',
    'Chuva lá fora, perfume bom aqui dentro: {p}.',
  ],
  generic: [
    'Já escolheu seu perfume para hoje? Sugestão: {p}.',
    'Seu perfume de hoje pode ser o {p}. Bora?',
    'Que tal o {p} hoje? Combina com o seu dia.',
  ],
  evening: [
    'Saindo hoje à noite? O {p} é uma ótima pedida.',
    'Noite chegando… o {p} fica incrível agora.',
    'Encontro ou jantar hoje? Vai de {p}.',
  ],
  forgotten: [
    'Faz {days} dias que você não usa o {p}. Hoje é um bom dia pra ele!',
    'Saudade do {p}? Faz {days} dias. O clima de hoje ajuda.',
  ],
  favorite: ['Seu favorito, o {p}, combina com hoje.', 'Dia de usar um favorito: {p}.'],
};

export function composeMessage(pick: Pick, weather: Weather, period: Period, thresholds = { hotMinC: 26, coldMaxC: 16 }, rnd = Math.random) {
  const temp = weather.apparentC ?? weather.temperatureC;
  const v = {
    p: pick.perfume.name,
    temp: temp === undefined ? '' : `${Math.round(temp)}°C`,
    place: weather.place ? ` em ${weather.place}` : '',
    days: String(pick.daysSince ?? ''),
  };
  let pool: string[];
  if (pick.daysSince !== undefined && pick.daysSince >= 21 && rnd() < 0.5) pool = LINES.forgotten;
  else if (isRainy(weather.code)) pool = LINES.rain;
  else if (period === 'evening' && rnd() < 0.5) pool = LINES.evening;
  else if (temp !== undefined) pool = LINES[feelOf(temp, thresholds.hotMinC, thresholds.coldMaxC)];
  else pool = pick.perfume.favorite ? LINES.favorite : LINES.generic;
  if (rnd() < 0.15) pool = LINES.generic; // de vez em quando, a pergunta direta
  return { title: pickOne(TITLES[period], rnd), body: fill(pickOne(pool, rnd), v).replace(/\s+/g, ' ').trim() };
}

/** Motivo curto para o widget. */
export function shortReason(pick: Pick, weather: Weather, thresholds = { hotMinC: 26, coldMaxC: 16 }): string {
  const temp = weather.apparentC ?? weather.temperatureC;
  if (pick.daysSince !== undefined && pick.daysSince >= 21) return `Faz ${pick.daysSince} dias que você não usa`;
  if (isRainy(weather.code)) return 'Aconchegante para um dia de chuva';
  if (temp === undefined) return pick.perfume.favorite ? 'Um dos seus favoritos' : 'Combina com o seu dia';
  const f = feelOf(temp, thresholds.hotMinC, thresholds.coldMaxC);
  const t = `${Math.round(temp)}°C`;
  return { hot: `Fresco para encarar ${t}`, warm: `Leve para ${t}`, mild: `Na medida para ${t}`, cool: `Confortável para ${t}`, cold: `Envolvente para ${t}` }[f];
}

// ---------- Horários sorteados ----------

/** Janelas locais (hora decimal) de cada período. */
export const WINDOWS: Record<Period, [number, number]> = { morning: [7.5, 10.5], afternoon: [12, 15], evening: [18.5, 21.5] };

/** Diferença (min) entre o fuso e UTC naquele instante. */
function tzOffset(date: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - date.getTime()) / 60000;
}

/** Instante UTC de "dia local + hora decimal" no fuso. */
function localToUtc(y: number, m: number, d: number, hour: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m, d, Math.floor(hour), Math.round((hour % 1) * 60)));
  return new Date(guess.getTime() - tzOffset(guess, tz) * 60000);
}

export function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month - 1, d: +p.day, hour: +p.hour + +p.minute / 60 };
}

export function periodAt(date: Date, tz: string): Period {
  const h = localParts(date, tz).hour;
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/** Próximo horário sorteado dentro das janelas escolhidas (a partir de `from`). */
export function nextSlot(periods: string[], tz: string, from = new Date(), rnd = Math.random): Date | undefined {
  const order: Period[] = ['morning', 'afternoon', 'evening'];
  const chosen = order.filter((p) => periods.includes(p));
  if (!chosen.length) return undefined;
  const base = localParts(from, tz);
  for (let day = 0; day < 3; day++) {
    for (const p of chosen) {
      const [a, b] = WINDOWS[p];
      const startUtc = localToUtc(base.y, base.m, base.d + day, a, tz).getTime();
      const endUtc = localToUtc(base.y, base.m, base.d + day, b, tz).getTime();
      const earliest = Math.max(startUtc, from.getTime() + 5 * 60000);
      if (earliest < endUtc) return new Date(earliest + rnd() * (endUtc - earliest));
    }
  }
  return undefined;
}

// ---------- Infraestrutura (servidor) ----------

const json = (body: unknown, status = 200) => Response.json(body, { status });

const WEATHER_PT: [number, string][] = [
  [0, 'Céu limpo'], [1, 'Poucas nuvens'], [2, 'Parcialmente nublado'], [3, 'Nublado'], [48, 'Neblina'],
  [57, 'Garoa'], [67, 'Chuva'], [77, 'Neve'], [82, 'Pancadas de chuva'], [86, 'Neve'], [99, 'Trovoadas'],
];
const describe = (code?: number) => (code === undefined ? undefined : WEATHER_PT.find(([c]) => code <= c)?.[1]);

// deno-lint-ignore no-explicit-any
type Admin = any;

async function loadUser(admin: Admin, userId: string) {
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  const [perf, logs, settings, loc] = await Promise.all([
    admin.from('perfumes').select('data').eq('user_id', userId),
    admin.from('usage_logs').select('data').eq('user_id', userId).gte('updated_at', since),
    admin.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
    admin.from('user_locations').select('latitude, longitude, name, updated_at').eq('user_id', userId).maybeSingle(),
  ]);
  const s = (settings.data?.data ?? {}) as { city?: { latitude: number; longitude: number; name: string }; climateThresholds?: { hotMinC: number; coldMaxC: number } };
  // Localização aproximada da conta se for recente (7 dias); senão, a cidade salva.
  const recent = loc.data && Date.now() - Date.parse(loc.data.updated_at) < 7 * DAY;
  const where = recent
    ? { lat: Number(loc.data.latitude), lon: Number(loc.data.longitude), name: loc.data.name ?? undefined }
    : s.city
      ? { lat: s.city.latitude, lon: s.city.longitude, name: s.city.name }
      : undefined;
  return {
    perfumes: ((perf.data ?? []) as { data: Perfume }[]).map((r) => r.data),
    logs: ((logs.data ?? []) as { data: UsageLog }[]).map((r) => r.data),
    thresholds: s.climateThresholds ?? { hotMinC: 26, coldMaxC: 16 },
    where,
  };
}

const weatherCache = new Map<string, { at: number; w: Weather }>();
async function weatherAt(where?: { lat: number; lon: number; name?: string }): Promise<Weather> {
  if (!where) return {};
  const key = `${where.lat.toFixed(1)},${where.lon.toFixed(1)}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < 20 * 60000) return { ...hit.w, place: where.name };
  try {
    const params = new URLSearchParams({
      latitude: where.lat.toFixed(2),
      longitude: where.lon.toFixed(2),
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day',
      timezone: 'auto',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const c = (await res.json()).current ?? {};
    const w: Weather = { temperatureC: c.temperature_2m, apparentC: c.apparent_temperature, humidity: c.relative_humidity_2m, code: c.weather_code, isDay: c.is_day === 1 };
    weatherCache.set(key, { at: Date.now(), w });
    return { ...w, place: where.name };
  } catch {
    return { place: where.name };
  }
}

interface Sub {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  periods: string[];
  timezone: string;
}

/** Envia uma notificação; devolve false se a inscrição não existe mais (para apagar). */
async function sendPush(sub: Sub, payload: Record<string, unknown>): Promise<boolean> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey) throw new Error('Segredos VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configurados.');
  try {
    await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: { subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:parfumania@example.com', publicKey, privateKey },
      TTL: 3 * 3600,
      urgency: 'normal',
      topic: 'perfume-do-dia',
      signal: AbortSignal.timeout(10000),
    });
    return true;
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    // 404/410: o aparelho cancelou a inscrição (app removido, permissão revogada…).
    if (status === 404 || status === 410) return false;
    console.error('push', status, (err as { body?: string }).body ?? err);
    return true;
  }
}

async function messageFor(admin: Admin, userId: string, period: Period, test = false) {
  const data = await loadUser(admin, userId);
  const weather = await weatherAt(data.where);
  const pick = choosePick(rankPerfumes(data.perfumes, data.logs, weather, period, new Date(), data.thresholds));
  if (!pick) return undefined;
  const msg = composeMessage(pick, weather, period, data.thresholds);
  return { title: test ? `${msg.title} (teste)` : msg.title, body: msg.body, url: `#/colecao/${pick.perfume.id}`, tag: `parfumania-${period}` };
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function imageFor(admin: Admin, userId: string, p: Perfume): Promise<string | undefined> {
  if (p.imageId) {
    const { data } = await admin.storage.from('perfume-images').createSignedUrl(`${userId}/${p.imageId}`, 24 * 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return p.imageUrl;
}

export default {
  fetch: withSupabase({ auth: ['user', 'secret', 'none'] }, async (req, ctx) => {
    const url = new URL(req.url);
    const task = url.searchParams.get('task');
    const admin = ctx.supabaseAdmin;

    // --- Agendamento: envia para quem chegou no horário sorteado ---
    if (task === 'reminders') {
      if (ctx.authMode !== 'secret') return json({ error: 'Só o agendamento pode chamar esta tarefa.' }, 401);
      const now = new Date();
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('id, user_id, endpoint, p256dh, auth, periods, timezone, next_at')
        .or(`next_at.is.null,next_at.lte.${now.toISOString()}`)
        .limit(300);
      let sent = 0;
      const cache = new Map<string, Awaited<ReturnType<typeof messageFor>>>();
      for (const sub of (subs ?? []) as (Sub & { next_at: string | null })[]) {
        const next = nextSlot(sub.periods, sub.timezone, now);
        // Inscrição nova só agenda o primeiro horário. Horário perdido (ex.: agendamento
        // parado) fora das janelas não dispara de madrugada: só reagenda.
        const hour = localParts(now, sub.timezone).hour;
        const inWindow = Object.values(WINDOWS).some(([a, b]) => hour >= a && hour <= b + 0.5);
        if (sub.next_at && inWindow) {
          const period = periodAt(now, sub.timezone);
          const key = `${sub.user_id}|${period}`;
          if (!cache.has(key)) cache.set(key, await messageFor(admin, sub.user_id, period));
          const msg = cache.get(key);
          if (msg) {
            const alive = await sendPush(sub, msg).catch((e) => (console.error(e), true));
            if (!alive) {
              await admin.from('push_subscriptions').delete().eq('id', sub.id);
              continue;
            }
            sent++;
          }
        }
        await admin
          .from('push_subscriptions')
          .update({ next_at: next?.toISOString() ?? null, ...(sub.next_at ? { last_sent_at: now.toISOString() } : {}) })
          .eq('id', sub.id);
      }
      return json({ ok: true, checked: subs?.length ?? 0, sent });
    }

    // --- Teste pelo app ---
    if (task === 'test') {
      if (ctx.authMode !== 'user' || !ctx.userClaims?.id) return json({ error: 'Faça login.' }, 401);
      const userId = ctx.userClaims.id;
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', userId);
      if (!subs?.length) return json({ error: 'Nenhum aparelho com notificações ativadas.' }, 404);
      const msg = await messageFor(admin, userId, periodAt(new Date(), subs[0].timezone), true);
      if (!msg) return json({ error: 'Cadastre perfumes na coleção para receber sugestões.' }, 400);
      let sent = 0;
      for (const sub of subs as Sub[]) {
        const alive = await sendPush(sub, msg);
        if (!alive) await admin.from('push_subscriptions').delete().eq('id', sub.id);
        else sent++;
      }
      return json({ ok: true, sent, preview: msg });
    }

    // --- Widget (Scriptable) ---
    if (task === 'widget') {
      const token = url.searchParams.get('token') ?? '';
      if (token.length < 20) return json({ error: 'Chave do widget ausente.' }, 401);
      const { data: row } = await admin.from('widget_tokens').select('user_id').eq('token_hash', await sha256Hex(token)).maybeSingle();
      if (!row) return json({ error: 'Chave do widget inválida ou revogada.' }, 401);
      const userId = row.user_id as string;
      await admin.from('widget_tokens').update({ last_used_at: new Date().toISOString() }).eq('user_id', userId);
      const data = await loadUser(admin, userId);
      const weather = await weatherAt(data.where);
      const tz = url.searchParams.get('tz') ?? 'America/Sao_Paulo';
      const period = periodAt(new Date(), tz);
      const ranked = rankPerfumes(data.perfumes, data.logs, weather, period, new Date(), data.thresholds);
      if (!ranked.length) return json({ error: 'Cadastre perfumes na coleção.' }, 404);
      const top = await Promise.all(
        ranked.slice(0, 3).map(async (r) => ({
          id: r.perfume.id,
          name: r.perfume.name,
          brand: r.perfume.brand,
          image: await imageFor(admin, userId, r.perfume),
          reason: shortReason(r, weather, data.thresholds),
        })),
      );
      const weekUses = data.logs.filter((l) => Date.now() - Date.parse(l.usedAt) < 7 * DAY).length;
      return json({
        generatedAt: new Date().toISOString(),
        appUrl: Deno.env.get('APP_URL') ?? 'https://victoraraujo03.github.io/parfumania/',
        period,
        weather: { temperatureC: weather.temperatureC, apparentC: weather.apparentC, code: weather.code, isDay: weather.isDay, description: describe(weather.code), place: weather.place },
        pick: top[0],
        alternatives: top.slice(1),
        weekUses,
      });
    }

    return json({ error: 'Tarefa desconhecida.' }, 400);
  }),
};
