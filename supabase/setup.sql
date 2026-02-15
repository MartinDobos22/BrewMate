-- Supabase schema for BrewMate Firebase-synced users.
-- Replace <FIREBASE_PROJECT_ID> with your Firebase project id.
-- This script uses Firebase UID as the primary identifier for profiles.

create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id text primary key,
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_statistics (
  user_id text primary key references public.app_users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_coffee (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  raw_text text,
  corrected_text text,
  coffee_profile jsonb not null,
  ai_match_result jsonb,
  label_image_base64 text,
  loved boolean not null default false,
  status text not null default 'active' check (status in ('active', 'empty', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_user_id_idx on public.user_coffee (user_id);
create index if not exists user_coffee_user_id_status_idx on public.user_coffee (user_id, status);

create table if not exists public.user_questionnaires (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  answers jsonb not null,
  questionnaire_profile jsonb not null,
  taste_profile jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists user_questionnaires_user_id_idx
  on public.user_questionnaires (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.ensure_user_statistics()
returns trigger
language plpgsql
as $$
begin
  insert into public.user_statistics (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create trigger app_users_create_stats
after insert on public.app_users
for each row execute function public.ensure_user_statistics();

-- Guard against cross-project Firebase tokens (optional but recommended for self-hosting).
create or replace function public.is_valid_firebase_jwt()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/<FIREBASE_PROJECT_ID>'
    and (auth.jwt() ->> 'aud') = '<FIREBASE_PROJECT_ID>',
    false
  );
$$;

alter table public.app_users enable row level security;
alter table public.user_statistics enable row level security;
alter table public.user_coffee enable row level security;
alter table public.user_questionnaires enable row level security;

create policy "Users can insert their own profile"
  on public.app_users
  for insert
  with check (auth.uid()::text = id and public.is_valid_firebase_jwt());

create policy "Users can read their own profile"
  on public.app_users
  for select
  using (auth.uid()::text = id and public.is_valid_firebase_jwt());

create policy "Users can update their own profile"
  on public.app_users
  for update
  using (auth.uid()::text = id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = id and public.is_valid_firebase_jwt());

create policy "Users can read their statistics"
  on public.user_statistics
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can insert their statistics"
  on public.user_statistics
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can read their coffee entries"
  on public.user_coffee
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can insert their coffee entries"
  on public.user_coffee
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can update their coffee entries"
  on public.user_coffee
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can delete their coffee entries"
  on public.user_coffee
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can read their questionnaires"
  on public.user_questionnaires
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can insert their questionnaires"
  on public.user_questionnaires
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can update their questionnaires"
  on public.user_questionnaires
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
