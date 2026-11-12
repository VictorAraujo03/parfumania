-- =====================================================================
-- Parfumania — busca de preços nas lojas (Edge Function `price-search`)
-- Rode este arquivo UMA vez no SQL Editor do Supabase (depois do schema.sql).
--
-- As duas tabelas são internas: só a função (chave secreta / service role)
-- lê e grava. RLS ligado e SEM políticas = o app (anon/authenticated) não
-- tem acesso nenhum a elas.
-- =====================================================================

-- Cache compartilhado: a mesma busca (ex.: "dior sauvage 100ml") é reaproveitada
-- por 24 h, para economizar a cota da SerpApi. São dados públicos de lojas.
create table if not exists public.price_search_cache (
  query      text primary key,
  results    jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Registro de buscas novas por usuário, para o limite diário (evita gastar a cota).
create table if not exists public.price_search_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  searched_at timestamptz not null default now()
);

create index if not exists price_search_usage_user_time
  on public.price_search_usage (user_id, searched_at desc);

alter table public.price_search_cache enable row level security;
alter table public.price_search_usage enable row level security;

revoke all on public.price_search_cache from anon, authenticated;
revoke all on public.price_search_usage from anon, authenticated;
grant select, insert, update, delete on public.price_search_cache to service_role;
grant select, insert, delete on public.price_search_usage to service_role;
