-- ============================================================================
-- BrewMate verification — P0 až P7 DB stav.
-- ============================================================================
-- Spustiť:
--   psql "$DATABASE_URL" -f supabase/verify_p0_to_p7.sql
--
-- Skript vypíše tabuľku so stĺpcami `check_name`, `status` (PASS/FAIL),
-- `details`. Každý FAIL znamená, že daná zmena nie je v DB aplikovaná.
-- Skript nič nemení — pure SELECTs.
-- ============================================================================

\echo '== P0–P7 verification =='
\pset format aligned
\pset border 2

with checks as (

  -- ==========================================================================
  -- P0 — coffee_match_cache
  -- ==========================================================================

  select
    1 as ord,
    'P0: coffee_match_cache table exists' as check_name,
    case when to_regclass('public.coffee_match_cache') is not null
         then 'PASS' else 'FAIL' end as status,
    coalesce(to_regclass('public.coffee_match_cache')::text, '<missing>') as details

  union all
  select
    2,
    'P0: coffee_match_cache PK = (user_id, cache_key)',
    case when (
      select array_agg(a.attname order by a.attnum)
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = 'public.coffee_match_cache'::regclass and i.indisprimary
    ) = array['user_id', 'cache_key']::text[]
    then 'PASS' else 'FAIL' end,
    coalesce((
      select string_agg(a.attname, ',' order by a.attnum)
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = 'public.coffee_match_cache'::regclass and i.indisprimary
    ), '<no PK>')

  union all
  select
    3,
    'P0: coffee_match_cache index user/updated_at',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'coffee_match_cache'
        and indexname = 'coffee_match_cache_user_idx'
    ) then 'PASS' else 'FAIL' end,
    'coffee_match_cache_user_idx'

  union all
  select
    4,
    'P0: coffee_match_cache RLS enabled + 4 policies',
    case when (
      select c.relrowsecurity
      from pg_class c
      where c.oid = 'public.coffee_match_cache'::regclass
    ) and (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'coffee_match_cache'
    ) = 4
    then 'PASS' else 'FAIL' end,
    (select 'rls=' || c.relrowsecurity::text || ', policies=' || (
      select count(*)::text from pg_policies
      where schemaname = 'public' and tablename = 'coffee_match_cache'
    )
    from pg_class c where c.oid = 'public.coffee_match_cache'::regclass)

  -- ==========================================================================
  -- P1 — user_coffee_match_feedback
  -- ==========================================================================

  union all
  select
    10,
    'P1: user_coffee_match_feedback table exists',
    case when to_regclass('public.user_coffee_match_feedback') is not null
         then 'PASS' else 'FAIL' end,
    coalesce(to_regclass('public.user_coffee_match_feedback')::text, '<missing>')

  union all
  select
    11,
    'P1: user_coffee_match_feedback predicted_score CHECK (0-100)',
    case when exists (
      select 1 from pg_constraint
      where conrelid = 'public.user_coffee_match_feedback'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%predicted_score%between 0 and 100%'
    ) then 'PASS' else 'FAIL' end,
    'predicted_score range check'

  union all
  select
    12,
    'P1: user_coffee_match_feedback actual_rating CHECK (1-5)',
    case when exists (
      select 1 from pg_constraint
      where conrelid = 'public.user_coffee_match_feedback'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%actual_rating%between 1 and 5%'
    ) then 'PASS' else 'FAIL' end,
    'actual_rating range check'

  union all
  select
    13,
    'P1: user_coffee_match_feedback indexes (user, coffee)',
    case when (
      select count(*) from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_match_feedback'
        and indexname in (
          'user_coffee_match_feedback_user_idx',
          'user_coffee_match_feedback_coffee_idx'
        )
    ) = 2 then 'PASS' else 'FAIL' end,
    'user_idx + coffee_idx'

  union all
  select
    14,
    'P1: user_coffee_match_feedback RLS + 4 policies',
    case when (
      select c.relrowsecurity
      from pg_class c where c.oid = 'public.user_coffee_match_feedback'::regclass
    ) and (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'user_coffee_match_feedback'
    ) = 4
    then 'PASS' else 'FAIL' end,
    'rls + policies'

  -- ==========================================================================
  -- P1 — user_coffee_images (base table)
  -- ==========================================================================

  union all
  select
    20,
    'P1: user_coffee_images table exists',
    case when to_regclass('public.user_coffee_images') is not null
         then 'PASS' else 'FAIL' end,
    coalesce(to_regclass('public.user_coffee_images')::text, '<missing>')

  union all
  select
    21,
    'P1: user_coffee_images PK = user_coffee_id',
    case when (
      select array_agg(a.attname order by a.attnum)
      from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
      where i.indrelid = 'public.user_coffee_images'::regclass and i.indisprimary
    ) = array['user_coffee_id']::text[]
    then 'PASS' else 'FAIL' end,
    'PK = user_coffee_id'

  union all
  select
    22,
    'P1: user_coffee_images user_idx',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_images'
        and indexname = 'user_coffee_images_user_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_images_user_idx'

  union all
  select
    23,
    'P1: user_coffee_images RLS + 3 policies',
    case when (
      select c.relrowsecurity
      from pg_class c where c.oid = 'public.user_coffee_images'::regclass
    ) and (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'user_coffee_images'
    ) = 3
    then 'PASS' else 'FAIL' end,
    'rls + 3 policies (read/insert/delete)'

  -- ==========================================================================
  -- P2 — user_coffee_scans
  -- ==========================================================================

  union all
  select
    30,
    'P2: user_coffee_scans table exists',
    case when to_regclass('public.user_coffee_scans') is not null
         then 'PASS' else 'FAIL' end,
    coalesce(to_regclass('public.user_coffee_scans')::text, '<missing>')

  union all
  select
    31,
    'P2: user_coffee_scans user_idx (created_at desc)',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_scans'
        and indexname = 'user_coffee_scans_user_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_scans_user_idx'

  union all
  select
    32,
    'P2: user_coffee_scans RLS + 3 policies',
    case when (
      select c.relrowsecurity
      from pg_class c where c.oid = 'public.user_coffee_scans'::regclass
    ) and (
      select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'user_coffee_scans'
    ) = 3
    then 'PASS' else 'FAIL' end,
    'rls + 3 policies'

  -- ==========================================================================
  -- P2 — match_feedback ↔ scans FK + CHECK
  -- ==========================================================================

  union all
  select
    40,
    'P2: feedback.user_coffee_scan_id column exists',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_match_feedback'
        and column_name = 'user_coffee_scan_id'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_scan_id uuid FK'

  union all
  select
    41,
    'P2: feedback.user_coffee_id is NULLABLE',
    case when (
      select is_nullable from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_match_feedback'
        and column_name = 'user_coffee_id'
    ) = 'YES' then 'PASS' else 'FAIL' end,
    coalesce((
      select 'is_nullable=' || is_nullable from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_match_feedback'
        and column_name = 'user_coffee_id'
    ), '<column missing>')

  union all
  select
    42,
    'P2: feedback source CHECK constraint exists',
    case when exists (
      select 1 from pg_constraint
      where conname = 'user_coffee_match_feedback_source_check'
        and conrelid = 'public.user_coffee_match_feedback'::regclass
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_match_feedback_source_check'

  union all
  select
    43,
    'P2: feedback scan_idx exists',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_match_feedback'
        and indexname = 'user_coffee_match_feedback_scan_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_match_feedback_scan_idx'

  -- ==========================================================================
  -- P2 — DROP user_coffee.label_image_base64
  -- ==========================================================================

  union all
  select
    50,
    'P2: user_coffee.label_image_base64 column DROPPED',
    case when not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee'
        and column_name = 'label_image_base64'
    ) then 'PASS' else 'FAIL' end,
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee'
        and column_name = 'label_image_base64'
    ) then '<column still present>' else 'dropped' end

  -- ==========================================================================
  -- P5 — partial unique indexes
  -- ==========================================================================

  union all
  select
    60,
    'P5: feedback scan unique partial index',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_match_feedback'
        and indexname = 'user_coffee_match_feedback_scan_unique_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_match_feedback_scan_unique_idx'

  union all
  select
    61,
    'P5: feedback coffee unique partial index',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_match_feedback'
        and indexname = 'user_coffee_match_feedback_coffee_unique_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_match_feedback_coffee_unique_idx'

  union all
  select
    62,
    'P5: feedback duplicates removed (per scan)',
    case when not exists (
      select 1 from public.user_coffee_match_feedback
      where user_coffee_scan_id is not null
      group by user_id, user_coffee_scan_id
      having count(*) > 1
    ) then 'PASS' else 'FAIL' end,
    coalesce((
      select 'duplicates=' || count(*)::text from (
        select 1 from public.user_coffee_match_feedback
        where user_coffee_scan_id is not null
        group by user_id, user_coffee_scan_id
        having count(*) > 1
      ) d
    ), '0')

  -- ==========================================================================
  -- P6 — user_coffee_images.storage_path / content_type_v2 / CHECK
  -- ==========================================================================

  union all
  select
    70,
    'P6: user_coffee_images.storage_path column exists',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_images'
        and column_name = 'storage_path'
    ) then 'PASS' else 'FAIL' end,
    'storage_path text'

  union all
  select
    71,
    'P6: user_coffee_images.content_type_v2 column exists',
    case when exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_images'
        and column_name = 'content_type_v2'
    ) then 'PASS' else 'FAIL' end,
    'content_type_v2 text'

  union all
  select
    72,
    'P6: user_coffee_images.image_base64 NULLABLE',
    case when (
      select is_nullable from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_images'
        and column_name = 'image_base64'
    ) = 'YES' then 'PASS' else 'FAIL' end,
    coalesce((
      select 'is_nullable=' || is_nullable from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_coffee_images'
        and column_name = 'image_base64'
    ), '<column missing>')

  union all
  select
    73,
    'P6: user_coffee_images_storage_check (image OR storage_path)',
    case when exists (
      select 1 from pg_constraint
      where conname = 'user_coffee_images_storage_check'
        and conrelid = 'public.user_coffee_images'::regclass
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_images_storage_check'

  union all
  select
    74,
    'P6: user_coffee_images storage_path partial index',
    case when exists (
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'user_coffee_images'
        and indexname = 'user_coffee_images_storage_path_idx'
    ) then 'PASS' else 'FAIL' end,
    'user_coffee_images_storage_path_idx'

  -- ==========================================================================
  -- P6 — cleanup_user_coffee_scans() function
  -- ==========================================================================

  union all
  select
    80,
    'P6: cleanup_user_coffee_scans() function exists',
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'cleanup_user_coffee_scans'
    ) then 'PASS' else 'FAIL' end,
    'public.cleanup_user_coffee_scans()'

  union all
  select
    81,
    'P6: cleanup_user_coffee_scans() returns integer',
    case when exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'cleanup_user_coffee_scans'
        and pg_get_function_result(p.oid) = 'integer'
    ) then 'PASS' else 'FAIL' end,
    'returns integer'
)
select check_name,
       status,
       details
from checks
order by ord;

\echo ''
\echo '-- Summary --'

with checks as (
  -- Recompute summary by counting; reuse same logic with a UNION trick.
  select status from (
    select case when to_regclass('public.coffee_match_cache') is not null then 'PASS' else 'FAIL' end as status union all
    select case when (select array_agg(a.attname order by a.attnum) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = 'public.coffee_match_cache'::regclass and i.indisprimary) = array['user_id','cache_key']::text[] then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='coffee_match_cache' and indexname='coffee_match_cache_user_idx') then 'PASS' else 'FAIL' end union all
    select case when (select c.relrowsecurity from pg_class c where c.oid='public.coffee_match_cache'::regclass) and (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache')=4 then 'PASS' else 'FAIL' end union all

    select case when to_regclass('public.user_coffee_match_feedback') is not null then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_constraint where conrelid='public.user_coffee_match_feedback'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%predicted_score%between 0 and 100%') then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_constraint where conrelid='public.user_coffee_match_feedback'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%actual_rating%between 1 and 5%') then 'PASS' else 'FAIL' end union all
    select case when (select count(*) from pg_indexes where schemaname='public' and tablename='user_coffee_match_feedback' and indexname in ('user_coffee_match_feedback_user_idx','user_coffee_match_feedback_coffee_idx'))=2 then 'PASS' else 'FAIL' end union all
    select case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_match_feedback'::regclass) and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback')=4 then 'PASS' else 'FAIL' end union all

    select case when to_regclass('public.user_coffee_images') is not null then 'PASS' else 'FAIL' end union all
    select case when (select array_agg(a.attname order by a.attnum) from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid='public.user_coffee_images'::regclass and i.indisprimary)=array['user_coffee_id']::text[] then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_images' and indexname='user_coffee_images_user_idx') then 'PASS' else 'FAIL' end union all
    select case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_images'::regclass) and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images')=3 then 'PASS' else 'FAIL' end union all

    select case when to_regclass('public.user_coffee_scans') is not null then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_scans' and indexname='user_coffee_scans_user_idx') then 'PASS' else 'FAIL' end union all
    select case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_scans'::regclass) and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans')=3 then 'PASS' else 'FAIL' end union all

    select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_scan_id') then 'PASS' else 'FAIL' end union all
    select case when (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_id')='YES' then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_constraint where conname='user_coffee_match_feedback_source_check' and conrelid='public.user_coffee_match_feedback'::regclass) then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_scan_idx') then 'PASS' else 'FAIL' end union all

    select case when not exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_coffee' and column_name='label_image_base64') then 'PASS' else 'FAIL' end union all

    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_scan_unique_idx') then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_coffee_unique_idx') then 'PASS' else 'FAIL' end union all
    select case when not exists (select 1 from public.user_coffee_match_feedback where user_coffee_scan_id is not null group by user_id, user_coffee_scan_id having count(*)>1) then 'PASS' else 'FAIL' end union all

    select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='storage_path') then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='content_type_v2') then 'PASS' else 'FAIL' end union all
    select case when (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='image_base64')='YES' then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_constraint where conname='user_coffee_images_storage_check' and conrelid='public.user_coffee_images'::regclass) then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_indexes where schemaname='public' and tablename='user_coffee_images' and indexname='user_coffee_images_storage_path_idx') then 'PASS' else 'FAIL' end union all

    select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cleanup_user_coffee_scans') then 'PASS' else 'FAIL' end union all
    select case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cleanup_user_coffee_scans' and pg_get_function_result(p.oid)='integer') then 'PASS' else 'FAIL' end
  ) s
)
select
  count(*) filter (where status = 'PASS') as pass_count,
  count(*) filter (where status = 'FAIL') as fail_count,
  count(*) as total
from checks;
