-- Rollback for 20260424_match_feedback_unique_indexes.sql.
-- Safe to re-run; duplicates cannot return because the forward migration
-- deleted them before the indexes went up.

drop index if exists public.user_coffee_match_feedback_scan_unique_idx;
drop index if exists public.user_coffee_match_feedback_coffee_unique_idx;
