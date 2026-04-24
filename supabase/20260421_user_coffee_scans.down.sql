-- Rollback for 20260421_user_coffee_scans.sql.
--
-- Safe to run if the table is untouched by later migrations. Feedback rows
-- that reference `user_coffee_scans(id)` via
-- `user_coffee_match_feedback.user_coffee_scan_id` will cascade-delete, so
-- run 20260421_match_feedback_scan_ref.down.sql FIRST if you want to keep
-- inventory-sourced feedback rows.

drop policy if exists "Users can read their coffee scans" on public.user_coffee_scans;
drop policy if exists "Users can insert their coffee scans" on public.user_coffee_scans;
drop policy if exists "Users can delete their coffee scans" on public.user_coffee_scans;

drop index if exists public.user_coffee_scans_user_idx;

drop table if exists public.user_coffee_scans;
