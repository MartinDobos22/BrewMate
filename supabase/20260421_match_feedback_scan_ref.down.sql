-- Rollback for 20260421_match_feedback_scan_ref.sql.
--
-- Re-applies the original NOT NULL constraint on user_coffee_id. Any rows
-- created via `POST /api/coffee-scans/:id/match-feedback` (scan-sourced)
-- would violate the restored NOT NULL, so this script deletes them first
-- with a clear audit log. Adjust before running if you want to preserve
-- scan-sourced feedback by back-porting it into an inventory entry.

do $$
declare
  scan_feedback integer;
begin
  select count(*)
    into scan_feedback
    from public.user_coffee_match_feedback
    where user_coffee_scan_id is not null;

  if scan_feedback > 0 then
    raise notice
      'Rollback deleting % scan-sourced feedback rows (user_coffee_id is null).',
      scan_feedback;
    delete from public.user_coffee_match_feedback
    where user_coffee_scan_id is not null;
  end if;
end $$;

alter table public.user_coffee_match_feedback
  drop constraint if exists user_coffee_match_feedback_source_check;

drop index if exists public.user_coffee_match_feedback_scan_idx;

alter table public.user_coffee_match_feedback
  drop column if exists user_coffee_scan_id;

alter table public.user_coffee_match_feedback
  alter column user_coffee_id set not null;
