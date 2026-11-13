import { supabase } from './client';

/**
 * Localização APROXIMADA na conta (arredondada a ~10 km), usada pelo clima das
 * notificações e do widget, que rodam no servidor. Só é gravada no modo
 * "Permitir sempre" e é apagada nos outros modos.
 */
const LAST_SYNC_KEY = 'parfumania.locationSyncedAt';
const MIN_INTERVAL = 60 * 60 * 1000;

export async function syncAccountLocation(coords: { latitude: number; longitude: number }, name?: string) {
  if (!supabase) return;
  try {
    const last = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0);
    if (Date.now() - last < MIN_INTERVAL) return;
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { error } = await supabase.from('user_locations').upsert({
      user_id: userId,
      latitude: Math.round(coords.latitude * 10) / 10,
      longitude: Math.round(coords.longitude * 10) / 10,
      name: name && name !== 'Sua localização atual' ? name : null,
      updated_at: new Date().toISOString(),
    });
    if (!error) localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  } catch {
    /* tabela ainda não criada ou sem conexão: tenta na próxima vez */
  }
}

export async function clearAccountLocation() {
  if (!supabase) return;
  try {
    localStorage.removeItem(LAST_SYNC_KEY);
    await supabase.from('user_locations').delete().not('user_id', 'is', null);
  } catch {
    /* sem conexão: nada a fazer */
  }
}
