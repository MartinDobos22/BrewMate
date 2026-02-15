alter table if exists public.user_coffee
  add column if not exists package_size_g integer,
  add column if not exists remaining_g integer,
  add column if not exists opened_at timestamptz,
  add column if not exists status text not null default 'active',
  add column if not exists tracking_mode text not null default 'manual',
  add column if not exists preferred_dose_g integer,
  add column if not exists brew_method_default text,
  add column if not exists last_consumed_at timestamptz;

alter table if exists public.user_coffee
  drop constraint if exists user_coffee_remaining_non_negative,
  add constraint user_coffee_remaining_non_negative check (remaining_g is null or remaining_g >= 0),
  drop constraint if exists user_coffee_package_positive,
  add constraint user_coffee_package_positive check (package_size_g is null or package_size_g > 0),
  drop constraint if exists user_coffee_status_valid,
  add constraint user_coffee_status_valid check (status in ('active', 'empty', 'archived')),
  drop constraint if exists user_coffee_tracking_mode_valid,
  add constraint user_coffee_tracking_mode_valid check (tracking_mode in ('manual', 'estimated')),
  drop constraint if exists user_coffee_brew_method_valid,
  add constraint user_coffee_brew_method_valid check (brew_method_default is null or brew_method_default in ('espresso', 'filter', 'other'));

update public.user_coffee
set status = 'active'
where status is null;

update public.user_coffee
set tracking_mode = case
  when package_size_g is null then 'estimated'
  else 'manual'
end
where tracking_mode is null;

create table if not exists public.user_coffee_consumption_events (
  id uuid primary key default gen_random_uuid(),
  user_coffee_id uuid not null references public.user_coffee (id) on delete cascade,
  user_id text not null references public.app_users (id) on delete cascade,
  consumed_g integer not null check (consumed_g > 0),
  brew_method text check (brew_method is null or brew_method in ('espresso', 'filter', 'other')),
  source text not null default 'custom' check (source in ('quick_action', 'custom', 'slider', 'recipe_log', 'adjustment')),
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_consumption_events_user_coffee_id_idx
  on public.user_coffee_consumption_events (user_coffee_id);

create index if not exists user_coffee_consumption_events_user_id_idx
  on public.user_coffee_consumption_events (user_id);

alter table if exists public.user_coffee_consumption_events enable row level security;

drop policy if exists "Users can read their consumption events" on public.user_coffee_consumption_events;
create policy "Users can read their consumption events"
  on public.user_coffee_consumption_events
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their consumption events" on public.user_coffee_consumption_events;
create policy "Users can insert their consumption events"
  on public.user_coffee_consumption_events
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their consumption events" on public.user_coffee_consumption_events;
create policy "Users can update their consumption events"
  on public.user_coffee_consumption_events
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
