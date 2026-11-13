import { supabase } from '../supabase/client';
import scriptTemplate from '../../../scriptable/Parfumania.js?raw';

/**
 * Widget do iPhone (app Scriptable). O widget busca o perfume do dia na função
 * parfumania-daily usando uma CHAVE PESSOAL: geramos aqui, mostramos uma única
 * vez dentro do script e guardamos na conta só o hash (SHA-256). Gerar outra
 * chave revoga a anterior.
 */
export const WIDGET_AVAILABLE = supabase !== null;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hasWidgetToken(): Promise<{ active: boolean; lastUsedAt?: string }> {
  if (!supabase) return { active: false };
  const { data } = await supabase.from('widget_tokens').select('last_used_at').maybeSingle();
  return { active: !!data, lastUsedAt: data?.last_used_at ?? undefined };
}

/** Cria (ou troca) a chave e devolve o script pronto para colar no Scriptable. */
export async function createWidgetScript(): Promise<string> {
  if (!supabase) throw new Error('O widget precisa do login na nuvem.');
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error('Faça login para criar o widget.');
  const token = randomToken();
  const { error } = await supabase
    .from('widget_tokens')
    .upsert({ user_id: userId, token_hash: await sha256Hex(token), created_at: new Date().toISOString(), last_used_at: null }, { onConflict: 'user_id' });
  if (error) throw new Error('Não foi possível criar a chave. As tabelas do widget já foram criadas no Supabase?');
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parfumania-daily`;
  return scriptTemplate.replace('__ENDPOINT__', endpoint).replace('__TOKEN__', token);
}

export async function revokeWidgetToken(): Promise<void> {
  if (!supabase) return;
  await supabase.from('widget_tokens').delete().not('user_id', 'is', null);
}
