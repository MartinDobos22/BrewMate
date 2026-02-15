-- Follow-up migration for saved coffee recipes.
-- Intentionally additive: does not modify previous migration files.

create table if not exists public.user_saved_coffee_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  analysis jsonb not null,
  recipe jsonb not null,
  selected_preparation text,
  strength_preference text,
  like_score integer not null,
  approved boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.user_saved_coffee_recipes
  add column if not exists analysis jsonb,
  add column if not exists recipe jsonb,
  add column if not exists selected_preparation text,
  add column if not exists strength_preference text,
  add column if not exists like_score integer,
  add column if not exists approved boolean,
  add column if not exists created_at timestamptz;

alter table public.user_saved_coffee_recipes
  alter column analysis set not null,
  alter column recipe set not null,
  alter column approved set default true,
  alter column approved set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

-- Ensure data quality check exists even if table was created differently.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_saved_coffee_recipes_like_score_check'
  ) then
    alter table public.user_saved_coffee_recipes
      add constraint user_saved_coffee_recipes_like_score_check
      check (like_score between 0 and 100);
  end if;
end
$$;

create index if not exists user_saved_coffee_recipes_user_id_idx
  on public.user_saved_coffee_recipes (user_id, created_at desc);

alter table public.user_saved_coffee_recipes enable row level security;

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
