-- =====================================================================
-- Parfumania — notificações do dia e widget do iPhone
-- Rode no SQL Editor do Supabase (depois do schema.sql). Parte 1 cria as
-- tabelas; a Parte 2 agenda o envio (rode depois de publicar a função).
-- =====================================================================

-- ---------- Parte 1: tabelas ----------

-- Localização APROXIMADA (arredondada a ~10 km) para o clima das notificações e
-- do widget. Só é gravada quando o aparelho está em "Permitir sempre"; apagada
-- ao escolher "Perguntar sempre" ou "Não permitir".
create table if not exists public.user_locations (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  latitude   numeric(5, 1) not null,
  longitude  numeric(5, 1) not null,
  name       text,
  updated_at timestamptz not null default now()
);

-- Inscrições de notificação (uma por aparelho/navegador).
create table if not exists public.push_subscriptions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  periods      text[] not null default array['morning', 'afternoon', 'evening'],
  timezone     text not null default 'America/Sao_Paulo',
  device       text,
  next_at      timestamptz,
  last_sent_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists push_subscriptions_due on public.push_subscriptions (next_at);

-- Chave pessoal do widget: guardamos só o hash SHA-256 (a chave fica no script).
create table if not exists public.widget_tokens (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.user_locations enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.widget_tokens enable row level security;

-- Cada pessoa só vê e altera as próprias linhas.
do $$
declare t text;
begin
  foreach t in array array['user_locations', 'push_subscriptions', 'widget_tokens'] loop
    execute format('drop policy if exists "%1$s: dono lê" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: dono cria" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: dono altera" on public.%1$I', t);
    execute format('drop policy if exists "%1$s: dono apaga" on public.%1$I', t);
    execute format('create policy "%1$s: dono lê" on public.%1$I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: dono cria" on public.%1$I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: dono altera" on public.%1$I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s: dono apaga" on public.%1$I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

grant select, insert, update, delete on public.user_locations, public.push_subscriptions, public.widget_tokens to authenticated;
revoke all on public.user_locations, public.push_subscriptions, public.widget_tokens from anon;

-- ---------- Parte 2: agendamento (rode DEPOIS de publicar a função) ----------
-- 1. Em Database → Extensions, ligue "pg_cron" e "pg_net".
-- 2. Troque os dois valores abaixo e rode só este bloco:
--    - a URL do projeto (Settings → API);
--    - uma chave SECRETA (Settings → API Keys → Secret keys, "default").
--    Os valores ficam guardados no Vault do Supabase, não neste arquivo.
--
-- select vault.create_secret('https://SEU-PROJETO.supabase.co', 'parfumania_project_url');
-- select vault.create_secret('sb_secret_COLE_AQUI', 'parfumania_secret_key');
--
-- select cron.schedule(
--   'parfumania-lembretes',
--   '*/10 * * * *', -- a cada 10 minutos; a função só envia para quem está no horário sorteado
--   $$
--   select net.http_post(
--     url := (select decrypted_secret from vault.decrypted_secrets where name = 'parfumania_project_url')
--            || '/functions/v1/parfumania-daily?task=reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'parfumania_secret_key')
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
