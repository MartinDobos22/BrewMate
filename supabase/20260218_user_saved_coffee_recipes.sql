create table if not exists public.user_saved_coffee_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  analysis jsonb not null,
  recipe jsonb not null,
  selected_preparation text,
  strength_preference text,
  like_score integer not null check (like_score between 0 and 100),
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists user_saved_coffee_recipes_user_id_idx
  on public.user_saved_coffee_recipes (user_id, created_at desc);

alter table if exists public.user_saved_coffee_recipes enable row level security;

drop policy if exists "Users can read their saved recipes" on public.user_saved_coffee_recipes;
create policy "Users can read their saved recipes"
  on public.user_saved_coffee_recipes
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their saved recipes" on public.user_saved_coffee_recipes;
create policy "Users can insert their saved recipes"
  on public.user_saved_coffee_recipes
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their saved recipes" on public.user_saved_coffee_recipes;
create policy "Users can update their saved recipes"
  on public.user_saved_coffee_recipes
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their saved recipes" on public.user_saved_coffee_recipes;
create policy "Users can delete their saved recipes"
  on public.user_saved_coffee_recipes
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
