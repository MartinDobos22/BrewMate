-- P1: Hybrid coffee match engine + image DB split + feedback loop.
--
-- Adds three complementary tables for the coffee scan verdict pipeline:
--   1. coffee_match_cache         (persistent verdict cache, shared with P0 hotfix)
--   2. user_coffee_match_feedback (rating feedback → calibration input)
--   3. user_coffee_images         (base64 label images moved out of user_coffee
--                                   to keep the listing query cheap)
--
-- The image split includes a backfill from user_coffee.label_image_base64 so
-- existing rows remain functional; the original column is kept nullable for
-- backward compatibility and will be removed in a later cleanup migration.

-- -----------------------------------------------------------------------------
-- 1. Persistent match cache (mirrors the P0 hotfix so a clean environment that
--    pulls this migration alone still works).
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 2. Match feedback — user reports whether the scanned coffee actually matched
--    their taste. Fed into the calibration offset computed server-side.
-- -----------------------------------------------------------------------------

create table if not exists public.user_coffee_match_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  user_coffee_id uuid references public.user_coffee (id) on delete cascade,
  predicted_score integer not null check (predicted_score between 0 and 100),
  predicted_tier text,
  actual_rating integer not null check (actual_rating between 1 and 5),
  notes text,
  algorithm_version text,
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_match_feedback_user_idx
  on public.user_coffee_match_feedback (user_id, created_at desc);

create index if not exists user_coffee_match_feedback_coffee_idx
  on public.user_coffee_match_feedback (user_coffee_id);

alter table public.user_coffee_match_feedback enable row level security;

drop policy if exists "Users can read their match feedback" on public.user_coffee_match_feedback;
create policy "Users can read their match feedback"
  on public.user_coffee_match_feedback
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their match feedback" on public.user_coffee_match_feedback;
create policy "Users can insert their match feedback"
  on public.user_coffee_match_feedback
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can update their match feedback" on public.user_coffee_match_feedback;
create policy "Users can update their match feedback"
  on public.user_coffee_match_feedback
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their match feedback" on public.user_coffee_match_feedback;
create policy "Users can delete their match feedback"
  on public.user_coffee_match_feedback
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

-- -----------------------------------------------------------------------------
-- 3. Image split — keep base64 blobs out of the hot listing query.
--    A later migration will replace this with an object-storage URL.
-- -----------------------------------------------------------------------------

create table if not exists public.user_coffee_images (
  user_coffee_id uuid primary key
    references public.user_coffee (id) on delete cascade,
  user_id text not null references public.app_users (id) on delete cascade,
  image_base64 text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists user_coffee_images_user_idx
  on public.user_coffee_images (user_id);

-- Backfill existing rows so the new GET endpoint has data to serve.
insert into public.user_coffee_images (user_coffee_id, user_id, image_base64)
select id, user_id, label_image_base64
from public.user_coffee
where label_image_base64 is not null
  and length(label_image_base64) > 0
on conflict (user_coffee_id) do nothing;

alter table public.user_coffee_images enable row level security;

drop policy if exists "Users can read their coffee images" on public.user_coffee_images;
create policy "Users can read their coffee images"
  on public.user_coffee_images
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can insert their coffee images" on public.user_coffee_images;
create policy "Users can insert their coffee images"
  on public.user_coffee_images
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

drop policy if exists "Users can delete their coffee images" on public.user_coffee_images;
create policy "Users can delete their coffee images"
  on public.user_coffee_images
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
