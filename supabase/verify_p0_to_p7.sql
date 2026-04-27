-- ============================================================================
-- BrewMate verification (deep) — P0 až P7 DB stav.
-- ============================================================================
-- Spustiť (psql alebo Supabase SQL Editor — copy/paste celý obsah):
--   psql "$DATABASE_URL" -f supabase/verify_p0_to_p7.sql
--
-- Read-only. Žiadne `\` meta-commandy, jeden SELECT s CTE, výstup tabuľka
-- so stĺpcami `ord, area, check_name, status, details` plus posledný riadok
-- (ord=9999) so súhrnom `TOTAL: PASS=N / FAIL=M / N+M`.
-- ============================================================================

with checks as (

-- =========================================================================
-- P0: coffee_match_cache
-- =========================================================================

select 101 as ord, 'P0' as area, 'coffee_match_cache: table exists' as check_name,
  case when to_regclass('public.coffee_match_cache') is not null then 'PASS' else 'FAIL' end as status,
  coalesce(to_regclass('public.coffee_match_cache')::text,'<missing>') as details

union all select 102, 'P0', 'coffee_match_cache: PK = (user_id, cache_key)',
  case when (select array_agg(a.attname::text order by a.attnum)
             from pg_index i
             join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
             where i.indrelid='public.coffee_match_cache'::regclass and i.indisprimary)
       = array['user_id','cache_key']::text[] then 'PASS' else 'FAIL' end,
  coalesce((select string_agg(a.attname::text, ',' order by a.attnum)
            from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
            where i.indrelid='public.coffee_match_cache'::regclass and i.indisprimary),'<no PK>')

union all select 103, 'P0', 'coffee_match_cache.user_id text NOT NULL',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='user_id')='text'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='user_id')='NO'
       then 'PASS' else 'FAIL' end, 'user_id'

union all select 104, 'P0', 'coffee_match_cache.match jsonb NOT NULL',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='match')='jsonb'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='match')='NO'
       then 'PASS' else 'FAIL' end, 'match'

union all select 105, 'P0', 'coffee_match_cache.created_at default now()',
  case when (select column_default from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='created_at') ilike '%now()%'
       then 'PASS' else 'FAIL' end,
  coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='created_at'),'<missing>')

union all select 106, 'P0', 'coffee_match_cache.updated_at default now()',
  case when (select column_default from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='updated_at') ilike '%now()%'
       then 'PASS' else 'FAIL' end,
  coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='coffee_match_cache' and column_name='updated_at'),'<missing>')

union all select 107, 'P0', 'coffee_match_cache.user_id FK app_users(id) CASCADE',
  case when exists (
    select 1 from pg_constraint con
    join pg_class cls on cls.oid=con.conrelid
    join pg_namespace n on n.oid=cls.relnamespace
    join pg_class cls2 on cls2.oid=con.confrelid
    where con.contype='f' and n.nspname='public'
      and cls.relname='coffee_match_cache'
      and cls2.relname='app_users'
      and con.confdeltype='c'
      and (select string_agg(a.attname::text, ',' order by ck.ord)
           from unnest(con.conkey) with ordinality ck(attnum, ord)
           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_id'
  ) then 'PASS' else 'FAIL' end, 'FK app_users on delete cascade'

union all select 108, 'P0', 'coffee_match_cache: index user_id/updated_at',
  case when exists (select 1 from pg_indexes where schemaname='public' and tablename='coffee_match_cache' and indexname='coffee_match_cache_user_idx')
       then 'PASS' else 'FAIL' end, 'coffee_match_cache_user_idx'

union all select 109, 'P0', 'coffee_match_cache: RLS enabled',
  case when (select c.relrowsecurity from pg_class c where c.oid='public.coffee_match_cache'::regclass)
       then 'PASS' else 'FAIL' end, 'rls'

union all select 110, 'P0', 'coffee_match_cache: policies S+I+U+D',
  case when (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='SELECT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='INSERT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='UPDATE')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='DELETE')>=1
       then 'PASS' else 'FAIL' end,
  'S=' || (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='SELECT')::text
  || ' I=' || (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='INSERT')::text
  || ' U=' || (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='UPDATE')::text
  || ' D=' || (select count(*) from pg_policies where schemaname='public' and tablename='coffee_match_cache' and cmd='DELETE')::text

-- =========================================================================
-- P1+P2+P5: user_coffee_match_feedback
-- =========================================================================

union all select 201, 'P1', 'feedback: table exists',
  case when to_regclass('public.user_coffee_match_feedback') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regclass('public.user_coffee_match_feedback')::text,'<missing>')

union all select 202, 'P1', 'feedback.id uuid PK default gen_random_uuid()',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='id')='uuid'
        and (select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='id') ilike '%gen_random_uuid%'
       then 'PASS' else 'FAIL' end,
  coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='id'),'<missing>')

union all select 203, 'P1', 'feedback.user_id text NOT NULL FK app_users(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_id')='text'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_id')='NO'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_match_feedback'
                      and cls2.relname='app_users' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_id')
       then 'PASS' else 'FAIL' end, 'user_id'

union all select 204, 'P2', 'feedback.user_coffee_id uuid NULLABLE FK user_coffee(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_id')='uuid'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_id')='YES'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_match_feedback'
                      and cls2.relname='user_coffee' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_coffee_id')
       then 'PASS' else 'FAIL' end,
  'null=' || coalesce((select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_id'),'-')

-- Note: PostgreSQL normalizes `BETWEEN x AND y` to `>= x AND <= y` in
-- pg_get_constraintdef output, so we use a permissive pattern that accepts
-- both forms by checking column name + both bound numbers as word-bounded.

union all select 205, 'P1', 'feedback.predicted_score integer NOT NULL CHECK 0..100',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='predicted_score')='integer'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='predicted_score')='NO'
        and exists (select 1 from pg_constraint
                     where conrelid='public.user_coffee_match_feedback'::regclass and contype='c'
                       and pg_get_constraintdef(oid) ~* 'predicted_score'
                       and pg_get_constraintdef(oid) ~* '\m0\M'
                       and pg_get_constraintdef(oid) ~* '\m100\M')
       then 'PASS' else 'FAIL' end,
  coalesce((select pg_get_constraintdef(oid) from pg_constraint
             where conrelid='public.user_coffee_match_feedback'::regclass and contype='c'
               and pg_get_constraintdef(oid) ~* 'predicted_score' limit 1),'<no constraint>')

union all select 206, 'P1', 'feedback.actual_rating integer NOT NULL CHECK 1..5',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='actual_rating')='integer'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='actual_rating')='NO'
        and exists (select 1 from pg_constraint
                     where conrelid='public.user_coffee_match_feedback'::regclass and contype='c'
                       and pg_get_constraintdef(oid) ~* 'actual_rating'
                       and pg_get_constraintdef(oid) ~* '\m1\M'
                       and pg_get_constraintdef(oid) ~* '\m5\M')
       then 'PASS' else 'FAIL' end,
  coalesce((select pg_get_constraintdef(oid) from pg_constraint
             where conrelid='public.user_coffee_match_feedback'::regclass and contype='c'
               and pg_get_constraintdef(oid) ~* 'actual_rating' limit 1),'<no constraint>')

union all select 207, 'P1', 'feedback.created_at timestamptz default now()',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='created_at') like 'timestamp%'
        and (select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='created_at') ilike '%now()%'
       then 'PASS' else 'FAIL' end, 'created_at'

union all select 208, 'P2', 'feedback.user_coffee_scan_id uuid FK user_coffee_scans(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_match_feedback' and column_name='user_coffee_scan_id')='uuid'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_match_feedback'
                      and cls2.relname='user_coffee_scans' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_coffee_scan_id')
       then 'PASS' else 'FAIL' end, 'scan FK'

union all select 209, 'P2', 'feedback: source CHECK constraint exists',
  case when exists (select 1 from pg_constraint where conname='user_coffee_match_feedback_source_check'
                     and conrelid='public.user_coffee_match_feedback'::regclass)
       then 'PASS' else 'FAIL' end, 'source check'

union all select 210, 'P1', 'feedback: user_idx + coffee_idx',
  case when (select count(*) from pg_indexes where schemaname='public'
              and tablename='user_coffee_match_feedback'
              and indexname in ('user_coffee_match_feedback_user_idx','user_coffee_match_feedback_coffee_idx'))=2
       then 'PASS' else 'FAIL' end, 'user+coffee idx'

union all select 211, 'P2', 'feedback: scan_idx',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_scan_idx')
       then 'PASS' else 'FAIL' end, 'scan_idx'

union all select 212, 'P5', 'feedback: scan_unique_idx (partial)',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_scan_unique_idx')
       then 'PASS' else 'FAIL' end, 'scan_unique_idx'

union all select 213, 'P5', 'feedback: coffee_unique_idx (partial)',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_match_feedback' and indexname='user_coffee_match_feedback_coffee_unique_idx')
       then 'PASS' else 'FAIL' end, 'coffee_unique_idx'

union all select 214, 'P5', 'feedback: zero scan duplicates',
  case when not exists (select 1 from public.user_coffee_match_feedback
                         where user_coffee_scan_id is not null
                         group by user_id, user_coffee_scan_id having count(*)>1)
       then 'PASS' else 'FAIL' end, 'no scan dups'

union all select 215, 'P5', 'feedback: zero coffee duplicates',
  case when not exists (select 1 from public.user_coffee_match_feedback
                         where user_coffee_id is not null
                         group by user_id, user_coffee_id having count(*)>1)
       then 'PASS' else 'FAIL' end, 'no coffee dups'

union all select 216, 'P1', 'feedback: RLS enabled',
  case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_match_feedback'::regclass)
       then 'PASS' else 'FAIL' end, 'rls'

union all select 217, 'P1', 'feedback: policies S+I+U+D',
  case when (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='SELECT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='INSERT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='UPDATE')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='DELETE')>=1
       then 'PASS' else 'FAIL' end,
  'S=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='SELECT')::text
  || ' I=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='INSERT')::text
  || ' U=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='UPDATE')::text
  || ' D=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_match_feedback' and cmd='DELETE')::text

-- =========================================================================
-- P1+P6: user_coffee_images
-- =========================================================================

union all select 301, 'P1', 'images: table exists',
  case when to_regclass('public.user_coffee_images') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regclass('public.user_coffee_images')::text,'<missing>')

union all select 302, 'P1', 'images: PK = user_coffee_id',
  case when (select array_agg(a.attname::text order by a.attnum)
             from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
             where i.indrelid='public.user_coffee_images'::regclass and i.indisprimary)
       = array['user_coffee_id']::text[] then 'PASS' else 'FAIL' end, 'PK'

union all select 303, 'P1', 'images.user_coffee_id uuid FK user_coffee(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='user_coffee_id')='uuid'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_images'
                      and cls2.relname='user_coffee' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_coffee_id')
       then 'PASS' else 'FAIL' end, 'user_coffee_id FK'

union all select 304, 'P1', 'images.user_id text NOT NULL FK app_users(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='user_id')='text'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='user_id')='NO'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_images'
                      and cls2.relname='app_users' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_id')
       then 'PASS' else 'FAIL' end, 'user_id FK'

union all select 305, 'P6', 'images.image_base64 NULLABLE',
  case when (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='image_base64')='YES'
       then 'PASS' else 'FAIL' end,
  'is_nullable=' || coalesce((select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='image_base64'),'-')

union all select 306, 'P1', 'images.created_at timestamptz default now()',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='created_at') like 'timestamp%'
        and (select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='created_at') ilike '%now()%'
       then 'PASS' else 'FAIL' end, 'created_at'

union all select 307, 'P6', 'images.storage_path text exists',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='storage_path')='text'
       then 'PASS' else 'FAIL' end,
  'type=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='storage_path'),'-')

union all select 308, 'P6', 'images.content_type_v2 text exists',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_images' and column_name='content_type_v2')='text'
       then 'PASS' else 'FAIL' end, 'content_type_v2'

union all select 309, 'P6', 'images: storage_check (image OR storage_path)',
  case when exists (select 1 from pg_constraint where conname='user_coffee_images_storage_check'
                     and conrelid='public.user_coffee_images'::regclass)
       then 'PASS' else 'FAIL' end, 'storage check'

union all select 310, 'P1', 'images: user_idx',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_images' and indexname='user_coffee_images_user_idx')
       then 'PASS' else 'FAIL' end, 'user_idx'

union all select 311, 'P6', 'images: storage_path partial idx',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_images' and indexname='user_coffee_images_storage_path_idx')
       then 'PASS' else 'FAIL' end, 'storage_path_idx'

union all select 312, 'P1', 'images: RLS enabled',
  case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_images'::regclass)
       then 'PASS' else 'FAIL' end, 'rls'

union all select 313, 'P1', 'images: policies S+I+D (no UPDATE)',
  case when (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='SELECT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='INSERT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='DELETE')>=1
       then 'PASS' else 'FAIL' end,
  'S=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='SELECT')::text
  || ' I=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='INSERT')::text
  || ' U=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='UPDATE')::text
  || ' D=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_images' and cmd='DELETE')::text

-- =========================================================================
-- P2: user_coffee_scans
-- =========================================================================

union all select 401, 'P2', 'scans: table exists',
  case when to_regclass('public.user_coffee_scans') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regclass('public.user_coffee_scans')::text,'<missing>')

union all select 402, 'P2', 'scans.id uuid PK default gen_random_uuid()',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='id')='uuid'
        and (select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='id') ilike '%gen_random_uuid%'
       then 'PASS' else 'FAIL' end,
  coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='id'),'<missing>')

union all select 403, 'P2', 'scans.user_id text NOT NULL FK app_users(id) CASCADE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='user_id')='text'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='user_id')='NO'
        and exists (select 1 from pg_constraint con
                    join pg_class cls on cls.oid=con.conrelid
                    join pg_namespace n on n.oid=cls.relnamespace
                    join pg_class cls2 on cls2.oid=con.confrelid
                    where con.contype='f' and n.nspname='public'
                      and cls.relname='user_coffee_scans'
                      and cls2.relname='app_users' and con.confdeltype='c'
                      and (select string_agg(a.attname::text,',' order by ck.ord)
                           from unnest(con.conkey) with ordinality ck(attnum, ord)
                           join pg_attribute a on a.attrelid=con.conrelid and a.attnum=ck.attnum)='user_id')
       then 'PASS' else 'FAIL' end, 'user_id FK'

union all select 404, 'P2', 'scans.coffee_profile jsonb NOT NULL',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='coffee_profile')='jsonb'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='coffee_profile')='NO'
       then 'PASS' else 'FAIL' end, 'coffee_profile'

union all select 405, 'P2', 'scans.ai_match_result jsonb NULLABLE',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='ai_match_result')='jsonb'
        and (select is_nullable from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='ai_match_result')='YES'
       then 'PASS' else 'FAIL' end, 'ai_match_result'

union all select 406, 'P2', 'scans.created_at timestamptz default now()',
  case when (select data_type from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='created_at') like 'timestamp%'
        and (select column_default from information_schema.columns where table_schema='public' and table_name='user_coffee_scans' and column_name='created_at') ilike '%now()%'
       then 'PASS' else 'FAIL' end, 'created_at'

union all select 407, 'P2', 'scans: user_idx',
  case when exists (select 1 from pg_indexes where schemaname='public'
                     and tablename='user_coffee_scans' and indexname='user_coffee_scans_user_idx')
       then 'PASS' else 'FAIL' end, 'user_idx'

union all select 408, 'P2', 'scans: RLS enabled',
  case when (select c.relrowsecurity from pg_class c where c.oid='public.user_coffee_scans'::regclass)
       then 'PASS' else 'FAIL' end, 'rls'

union all select 409, 'P2', 'scans: policies S+I+D',
  case when (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='SELECT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='INSERT')>=1
        and (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='DELETE')>=1
       then 'PASS' else 'FAIL' end,
  'S=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='SELECT')::text
  || ' I=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='INSERT')::text
  || ' D=' || (select count(*) from pg_policies where schemaname='public' and tablename='user_coffee_scans' and cmd='DELETE')::text

-- =========================================================================
-- P2: DROP user_coffee.label_image_base64
-- =========================================================================

union all select 501, 'P2', 'user_coffee.label_image_base64 column DROPPED',
  case when not exists (select 1 from information_schema.columns
                         where table_schema='public' and table_name='user_coffee' and column_name='label_image_base64')
       then 'PASS' else 'FAIL' end,
  case when exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='user_coffee' and column_name='label_image_base64')
       then '<column still present>' else 'dropped' end

-- =========================================================================
-- P6: cleanup_user_coffee_scans()
-- =========================================================================

union all select 601, 'P6', 'cleanup_user_coffee_scans() exists',
  case when exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid=p.pronamespace
                     where n.nspname='public' and p.proname='cleanup_user_coffee_scans')
       then 'PASS' else 'FAIL' end, 'function exists'

union all select 602, 'P6', 'cleanup_user_coffee_scans() returns integer',
  case when exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid=p.pronamespace
                     where n.nspname='public' and p.proname='cleanup_user_coffee_scans'
                       and pg_get_function_result(p.oid)='integer')
       then 'PASS' else 'FAIL' end, 'returns integer'

union all select 603, 'P6', 'cleanup_user_coffee_scans() body has 90-day cutoff',
  case when exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid=p.pronamespace
                     where n.nspname='public' and p.proname='cleanup_user_coffee_scans'
                       and pg_get_functiondef(p.oid) ilike '%90 days%')
       then 'PASS' else 'FAIL' end, 'has 90 days'

union all select 604, 'P6', 'cleanup_user_coffee_scans() body has 200/user cap',
  case when exists (select 1 from pg_proc p
                     join pg_namespace n on n.oid=p.pronamespace
                     where n.nspname='public' and p.proname='cleanup_user_coffee_scans'
                       and pg_get_functiondef(p.oid) ilike '%rn > 200%')
       then 'PASS' else 'FAIL' end, 'has 200 cap'

)
select ord, area, check_name, status, details from checks
union all
select 9999, 'SUM', 'TOTAL: PASS=' || (select count(*) from checks where status='PASS')::text
                  || ' / FAIL=' || (select count(*) from checks where status='FAIL')::text
                  || ' / ' || (select count(*) from checks)::text,
       case when (select count(*) from checks where status='FAIL')=0 then 'PASS' else 'FAIL' end,
       ''
order by ord;
