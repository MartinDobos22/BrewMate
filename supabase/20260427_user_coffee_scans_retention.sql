-- P6: Retention helper for `user_coffee_scans`.
--
-- The append-only scan log can grow without bound. This migration provides
-- a single SQL function that combines two policies:
--   1. Age-based: delete rows older than 90 days.
--   2. Per-user count cap: keep the most recent 200 rows per user.
--
-- Trigger via `POST /api/admin/cleanup-old-scans` (server-side admin token)
-- or via Supabase pg_cron — see `supabase/MIGRATIONS.md` for receipts.

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
