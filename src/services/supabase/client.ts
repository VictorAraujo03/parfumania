import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase, criado apenas quando as variáveis estão configuradas.
 * A chave usada é a PÚBLICA (anon/publishable): a proteção dos dados vem das
 * regras de Row Level Security definidas em supabase/schema.sql.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'parfumania.auth' },
      })
    : null;

export const isCloudConfigured = supabase !== null;

/** Endereço para onde os links de e-mail (confirmação, nova senha) devem voltar. */
export function appRedirectUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}
