create table if not exists public.user_coffee_brew_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  user_coffee_id uuid references public.user_coffee (id) on delete set null,
  brew_method text not null check (brew_method in ('espresso', 'v60', 'aeropress', 'french_press', 'moka', 'cold_brew', 'other')),
  dose_g integer not null check (dose_g > 0),
  brew_time_seconds integer not null check (brew_time_seconds > 0),
  taste_rating integer not null check (taste_rating between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_brew_logs_user_id_idx
  on public.user_coffee_brew_logs (user_id, created_at desc);

create index if not exists user_coffee_brew_logs_user_coffee_id_idx
  on public.user_coffee_brew_logs (user_coffee_id);

alter table if exists public.user_coffee_brew_logs enable row level security;

drop policy if exists "Users can read their brew logs" on public.user_coffee_brew_logs;
create policy "Users can read their brew logs"
  on public.user_coffee_brew_logs
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their brew logs" on public.user_coffee_brew_logs;
create policy "Users can insert their brew logs"
  on public.user_coffee_brew_logs
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their brew logs" on public.user_coffee_brew_logs;
create policy "Users can update their brew logs"
  on public.user_coffee_brew_logs
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their brew logs" on public.user_coffee_brew_logs;
create policy "Users can delete their brew logs"
  on public.user_coffee_brew_logs
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
