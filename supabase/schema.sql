-- =============================================================
-- Parfumania — esquema do banco (Supabase / Postgres)
-- Cole este script inteiro em: Supabase → SQL Editor → New query → Run.
-- Pode ser executado novamente sem perder dados (idempotente).
--
-- Cada registro guarda o documento da aplicação em `data` (jsonb), no
-- mesmo formato dos tipos TypeScript. Isso permite evoluir o app com
-- migrações em código (src/services/storage/migrations.ts) sem alterar
-- tabelas a cada novo campo.
--
-- Segurança: Row Level Security em todas as tabelas — cada usuário só
-- lê e escreve as próprias linhas. Por isso a chave pública (anon /
-- publishable) pode ficar no frontend. NUNCA use a chave service_role no app.
-- =============================================================

-- ---------- Tabelas de documentos ----------
create table if not exists public.perfumes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.usage_logs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.offers (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  schema_version integer not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------
alter table public.perfumes enable row level security;
alter table public.usage_logs enable row level security;
alter table public.offers enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "perfumes: dono" on public.perfumes;
create policy "perfumes: dono" on public.perfumes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "usage_logs: dono" on public.usage_logs;
create policy "usage_logs: dono" on public.usage_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "offers: dono" on public.offers;
create policy "offers: dono" on public.offers
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "user_settings: dono" on public.user_settings;
create policy "user_settings: dono" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Imagens (Storage) ----------
-- Bucket privado; cada usuário só acessa a pasta com o próprio id: <user_id>/<imagem>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perfume-images', 'perfume-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "imagens: dono lê" on storage.objects;
create policy "imagens: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'perfume-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "imagens: dono envia" on storage.objects;
create policy "imagens: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'perfume-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "imagens: dono atualiza" on storage.objects;
create policy "imagens: dono atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'perfume-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "imagens: dono apaga" on storage.objects;
create policy "imagens: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'perfume-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
