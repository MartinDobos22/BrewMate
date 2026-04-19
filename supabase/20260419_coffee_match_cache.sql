-- Persistent cache for /api/coffee-match results (point 2 — P0).
-- Avoids re-calling OpenAI for the same (user, questionnaire, coffee profile)
-- tuple and guarantees a stable verdict across sessions / backend restarts.

create table if not exists public.coffee_match_cache (
  user_id text not null references public.app_users (id) on delete cascade,
  cache_key text not null,
  match jsonb not null,
  algorithm_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

create index if not exists coffee_match_cache_user_idx
  on public.coffee_match_cache (user_id, updated_at desc);

alter table public.coffee_match_cache enable row level security;

drop policy if exists "Users can read their match cache" on public.coffee_match_cache;
create policy "Users can read their match cache"
  on public.coffee_match_cache
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their match cache" on public.coffee_match_cache;
create policy "Users can insert their match cache"
  on public.coffee_match_cache
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their match cache" on public.coffee_match_cache;
create policy "Users can update their match cache"
  on public.coffee_match_cache
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their match cache" on public.coffee_match_cache;
create policy "Users can delete their match cache"
  on public.coffee_match_cache
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
