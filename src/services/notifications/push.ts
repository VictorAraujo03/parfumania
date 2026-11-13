import { supabase } from '../supabase/client';

/**
 * Notificações do perfume do dia (Web Push). No iPhone funcionam no app
 * adicionado à tela de início (iOS 16.4+). A chave pública VAPID vem de
 * VITE_VAPID_PUBLIC_KEY; a privada fica só no servidor (função parfumania-daily).
 */
export type PushPeriod = 'morning' | 'afternoon' | 'evening';

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const SW_URL = `${import.meta.env.BASE_URL}sw.js`;

export type PushSupport =
  | 'ok'
  | 'no-cloud' // modo local: o servidor não tem como enviar
  | 'no-key' // VITE_VAPID_PUBLIC_KEY não configurada
  | 'ios-browser' // iPhone/iPad no Safari: precisa abrir pelo ícone da tela de início
  | 'unsupported';

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function pushSupport(): PushSupport {
  if (!supabase) return 'no-cloud';
  if (!VAPID_PUBLIC_KEY) return 'no-key';
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIOS() && !isStandalone()) return 'ios-browser';
  return capable ? 'ok' : 'unsupported';
}

/** Registra o service worker (só notificações). Chamado ao abrir o app. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL }).catch(() => undefined);
}

function keyToBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  return existing ?? navigator.serviceWorker.register(SW_URL, { scope: import.meta.env.BASE_URL });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  const reg = await registration();
  return reg.pushManager.getSubscription();
}

const deviceName = () => {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Navegador';
};

/** Pede permissão (precisa vir de um toque), inscreve o aparelho e salva na conta. */
export async function enablePush(periods: PushPeriod[]): Promise<void> {
  if (!supabase) throw new Error('As notificações precisam do login na nuvem.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'As notificações estão bloqueadas. No iPhone: Ajustes › Notificações › Parfumania. No computador: ícone de cadeado ao lado do endereço.'
        : 'Permissão não concedida.',
    );
  }
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY!) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Faça login para ativar as notificações.');
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      periods,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
      device: deviceName(),
      next_at: null, // o servidor sorteia o primeiro horário
    },
    { onConflict: 'endpoint' },
  );
  if (error) throw new Error('Não foi possível salvar a inscrição. As tabelas de notificação já foram criadas no Supabase?');
}

/** Atualiza os períodos deste aparelho (e sorteia um novo horário). */
export async function updatePeriods(periods: PushPeriod[]): Promise<void> {
  const sub = await currentSubscription();
  if (!sub || !supabase) return;
  const { error } = await supabase.from('push_subscriptions').update({ periods, next_at: null }).eq('endpoint', sub.endpoint);
  if (error) throw new Error('Não foi possível salvar os períodos.');
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<{ title: string; body: string } | undefined> {
  if (!supabase) throw new Error('As notificações precisam do login na nuvem.');
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; preview?: { title: string; body: string }; error?: string }>(
    'parfumania-daily?task=test',
    { body: {} },
  );
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
    if (ctx?.status === 404 && !body?.error) throw new Error('A função parfumania-daily ainda não foi publicada no Supabase.');
    throw new Error(body?.error ?? 'Não foi possível enviar o teste agora.');
  }
  return data?.preview;
}

export async function storedPeriods(): Promise<PushPeriod[] | undefined> {
  const sub = await currentSubscription();
  if (!sub || !supabase) return undefined;
  const { data } = await supabase.from('push_subscriptions').select('periods').eq('endpoint', sub.endpoint).maybeSingle();
  return (data?.periods as PushPeriod[] | undefined) ?? undefined;
}
