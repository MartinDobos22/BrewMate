-- P2: Log-like history of every coffee scan.
--
-- `user_coffee` represents inventory items the user actually owns (with
-- remaining grams, opened_at, status, ...). Auto-saving every scan into that
-- table would pollute the inventory with one-off scans the user never adds to
-- stock. This migration adds a separate append-only log so the scan history
-- and inventory stay clean.

create table if not exists public.user_coffee_scans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  raw_text text,
  corrected_text text,
  coffee_profile jsonb not null,
  ai_match_result jsonb,
  algorithm_version text,
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_scans_user_idx
  on public.user_coffee_scans (user_id, created_at desc);

alter table public.user_coffee_scans enable row level security;

drop policy if exists "Users can read their coffee scans" on public.user_coffee_scans;
create policy "Users can read their coffee scans"
  on public.user_coffee_scans
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their coffee scans" on public.user_coffee_scans;
create policy "Users can insert their coffee scans"
  on public.user_coffee_scans
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their coffee scans" on public.user_coffee_scans;
create policy "Users can delete their coffee scans"
  on public.user_coffee_scans
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
