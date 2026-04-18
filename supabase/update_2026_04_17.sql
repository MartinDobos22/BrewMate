-- =============================================================================
-- BrewMate DB update skript — 2026-04-17
-- =============================================================================
-- Konsolidovaný update pre už nasadenú produkčnú DB.
-- Obsahuje migrácie pridané počas implementácie 13 code review bodov:
--   1. 20260417_recipe_feedback.sql   — prediction_metadata + user_recipe_feedback
--   2. 20260417_brew_preferences.sql  — brew_preferences stĺpec
--   3. 20260417_idempotency_key.sql   — idempotency_key + unique index
--
-- Všetko je idempotentné (IF NOT EXISTS / DROP POLICY IF EXISTS) — bezpečne
-- sa dá spustiť opakovane aj na DB kde už niektorá zmena je.
--
-- PR #119 a PR #120 nepridali žiadnu DB zmenu (boli len Node/TS refactory).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) prediction_metadata + user_recipe_feedback (feedback loop pre kalibráciu)
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- 2) brew_preferences stĺpec (single source of truth pre normalizované brew)
-- ---------------------------------------------------------------------------

alter table public.user_saved_coffee_recipes
  add column if not exists brew_preferences jsonb;


-- ---------------------------------------------------------------------------
-- 3) idempotency_key + unique partial index (prevencia duplicate recipe saves)
-- ---------------------------------------------------------------------------

alter table public.user_saved_coffee_recipes
  add column if not exists idempotency_key text;

create unique index if not exists user_saved_coffee_recipes_idempotency_idx
  on public.user_saved_coffee_recipes (user_id, idempotency_key)
  where idempotency_key is not null;


-- =============================================================================
-- Verifikácia (spusti tieto queries po update skripte):
-- =============================================================================
--
--   -- 3 nové stĺpce existujú:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'user_saved_coffee_recipes'
--     AND column_name IN ('prediction_metadata', 'brew_preferences', 'idempotency_key');
--
--   -- Tabuľka user_recipe_feedback existuje:
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'user_recipe_feedback';
--
--   -- Unique index na idempotency_key:
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'user_saved_coffee_recipes'
--     AND indexname = 'user_saved_coffee_recipes_idempotency_idx';
--
--   -- 4 RLS policies na user_recipe_feedback:
--   SELECT policyname FROM pg_policies WHERE tablename = 'user_recipe_feedback';
-- =============================================================================
