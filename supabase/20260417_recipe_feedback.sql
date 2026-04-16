-- Feedback loop for like prediction calibration (point 6).
-- Adds per-user feedback table + prediction metadata column on saved recipes.

alter table public.user_saved_coffee_recipes
  add column if not exists prediction_metadata jsonb;

create table if not exists public.user_recipe_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  recipe_id uuid not null references public.user_saved_coffee_recipes (id) on delete cascade,
  predicted_score integer not null check (predicted_score between 0 and 100),
  actual_rating integer not null check (actual_rating between 1 and 5),
  notes text,
  algorithm_version text,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists user_recipe_feedback_user_id_idx
  on public.user_recipe_feedback (user_id, created_at desc);

alter table public.user_recipe_feedback enable row level security;

drop policy if exists "Users can read their recipe feedback" on public.user_recipe_feedback;
create policy "Users can read their recipe feedback"
  on public.user_recipe_feedback
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their recipe feedback" on public.user_recipe_feedback;
create policy "Users can insert their recipe feedback"
  on public.user_recipe_feedback
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their recipe feedback" on public.user_recipe_feedback;
create policy "Users can update their recipe feedback"
  on public.user_recipe_feedback
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their recipe feedback" on public.user_recipe_feedback;
create policy "Users can delete their recipe feedback"
  on public.user_recipe_feedback
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
