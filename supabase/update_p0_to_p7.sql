-- ============================================================================
-- BrewMate setup update — kumulatívne DB zmeny z P0–P7.
-- ============================================================================
-- Aplikuje sa na DB, ktorá má pôvodnú `setup.sql` (pred P0).
-- Všetky kroky sú idempotentné (`if not exists`, `drop ... if exists`,
-- guard checks). Spustenie viackrát neurobí škodu.
--
-- Spustenie:
--   psql "$DATABASE_URL" -f supabase/update_p0_to_p7.sql
--
-- Obsah, v poradí v akom je nutné spúšťať:
--   1. P0  — coffee_match_cache (persistent verdict cache)
--   2. P1a — user_coffee_match_feedback (rating → calibration)
--   3. P1b — user_coffee_images (image split z user_coffee)
--   4. P1c — backfill base64 obrázkov do user_coffee_images
--   5. P2a — user_coffee_scans (append-only scan log)
--   6. P2b — match_feedback ↔ scans FK + CHECK
--   7. P2c — drop legacy user_coffee.label_image_base64 (s guardom)
--   8. P5  — partial unique indexes pre upsert match feedback
--   9. P6a — user_coffee_images.storage_path / content_type_v2
--  10. P6b — cleanup_user_coffee_scans() retention funkcia
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. P0 (PR #122) — coffee_match_cache
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 2. P1 (PR #123) — user_coffee_match_feedback
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 3. P1 (PR #123) — user_coffee_images
-- ----------------------------------------------------------------------------

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

-- Backfill — bezpečne preskočí ak stĺpec label_image_base64 už neexistuje
-- (napr. drop už prebehol). `on conflict do nothing` zabezpečí idempotenciu.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_coffee'
      and column_name = 'label_image_base64'
  ) then
    execute $sql$
      insert into public.user_coffee_images (user_coffee_id, user_id, image_base64)
      select id, user_id, label_image_base64
      from public.user_coffee
      where label_image_base64 is not null
        and length(label_image_base64) > 0
      on conflict (user_coffee_id) do nothing
    $sql$;
  end if;
end $$;

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


-- ----------------------------------------------------------------------------
-- 4. P2 (PR #125) — user_coffee_scans (append-only scan log)
-- ----------------------------------------------------------------------------

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


-- ----------------------------------------------------------------------------
-- 5. P2 (PR #125) — match_feedback ↔ scans FK + CHECK
-- ----------------------------------------------------------------------------

alter table public.user_coffee_match_feedback
  add column if not exists user_coffee_scan_id uuid
    references public.user_coffee_scans (id) on delete cascade;

alter table public.user_coffee_match_feedback
  alter column user_coffee_id drop not null;

alter table public.user_coffee_match_feedback
  drop constraint if exists user_coffee_match_feedback_source_check;

alter table public.user_coffee_match_feedback
  add constraint user_coffee_match_feedback_source_check
    check (
      (user_coffee_id is not null and user_coffee_scan_id is null)
      or (user_coffee_id is null and user_coffee_scan_id is not null)
    );

create index if not exists user_coffee_match_feedback_scan_idx
  on public.user_coffee_match_feedback (user_coffee_scan_id);


-- ----------------------------------------------------------------------------
-- 6. P2 (PR #125) — DROP user_coffee.label_image_base64 (destruktívne, s guardom)
-- ----------------------------------------------------------------------------
-- Guard: ak existuje aspoň jeden riadok s legacy base64 ale bez záznamu
-- v user_coffee_images, raise exception. Backfill v kroku 3 by mal pokryť
-- všetky riadky; ak nie, treba ručný zásah pred drop-om.

do $$
declare
  legacy_only integer;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_coffee'
      and column_name = 'label_image_base64'
  ) then
    execute $sql$
      select count(*)
      from public.user_coffee uc
      where uc.label_image_base64 is not null
        and length(uc.label_image_base64) > 0
        and not exists (
          select 1
          from public.user_coffee_images uci
          where uci.user_coffee_id = uc.id
        )
    $sql$ into legacy_only;

    if legacy_only > 0 then
      raise exception
        'Backfill incomplete: % rows still have label_image_base64 but no entry in user_coffee_images. Re-run backfill in step 3 or backfill manually before dropping.',
        legacy_only;
    end if;
  end if;
end $$;

alter table public.user_coffee
  drop column if exists label_image_base64;


-- ----------------------------------------------------------------------------
-- 7. P5 (PR #128) — partial unique indexes pre upsert rating
-- ----------------------------------------------------------------------------
-- Najprv de-duplikuje existujúce duplikáty (najnovší riadok ostane).

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, user_coffee_scan_id
      order by created_at desc, id desc
    ) as rn
  from public.user_coffee_match_feedback
  where user_coffee_scan_id is not null
)
delete from public.user_coffee_match_feedback f
using ranked r
where f.id = r.id
  and r.rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, user_coffee_id
      order by created_at desc, id desc
    ) as rn
  from public.user_coffee_match_feedback
  where user_coffee_id is not null
)
delete from public.user_coffee_match_feedback f
using ranked r
where f.id = r.id
  and r.rn > 1;

create unique index if not exists user_coffee_match_feedback_scan_unique_idx
  on public.user_coffee_match_feedback (user_id, user_coffee_scan_id)
  where user_coffee_scan_id is not null;

create unique index if not exists user_coffee_match_feedback_coffee_unique_idx
  on public.user_coffee_match_feedback (user_id, user_coffee_id)
  where user_coffee_id is not null;


-- ----------------------------------------------------------------------------
-- 8. P6 (PR #129) — storage_path + content_type_v2 + sanity CHECK
-- ----------------------------------------------------------------------------

alter table public.user_coffee_images
  add column if not exists storage_path text,
  add column if not exists content_type_v2 text;

alter table public.user_coffee_images
  alter column image_base64 drop not null;

alter table public.user_coffee_images
  drop constraint if exists user_coffee_images_storage_check;

alter table public.user_coffee_images
  add constraint user_coffee_images_storage_check
    check (image_base64 is not null or storage_path is not null);

create index if not exists user_coffee_images_storage_path_idx
  on public.user_coffee_images (storage_path)
  where storage_path is not null;


-- ----------------------------------------------------------------------------
-- 9. P6 (PR #129) — cleanup_user_coffee_scans() retention funkcia
-- ----------------------------------------------------------------------------
-- Volaj cez `POST /api/admin/cleanup-old-scans` (admin-token chránené)
-- alebo cez Supabase pg_cron `select cron.schedule(...)`.

create or replace function public.cleanup_user_coffee_scans()
returns integer
language plpgsql
as $$
declare
  age_deleted integer := 0;
  cap_deleted integer := 0;
begin
  delete from public.user_coffee_scans
  where created_at < now() - interval '90 days';
  get diagnostics age_deleted = row_count;

  with ranked as (
    select id,
      row_number() over (
        partition by user_id
        order by created_at desc, id desc
      ) as rn
    from public.user_coffee_scans
  )
  delete from public.user_coffee_scans s
  using ranked r
  where s.id = r.id and r.rn > 200;
  get diagnostics cap_deleted = row_count;

  return age_deleted + cap_deleted;
end;
$$;


-- ============================================================================
-- Hotovo. P3, P4 a P7 nemenili schemu.
-- ============================================================================
