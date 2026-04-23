-- P2: Allow `user_coffee_match_feedback` to reference either an inventory row
-- (`user_coffee`) or a scan log row (`user_coffee_scans`).
--
-- The new rating UI on `OcrResultScreen` fires right after a scan verdict,
-- before the user decides whether to add the coffee to their inventory. We
-- still want that feedback to feed the calibration query, so we extend the
-- existing feedback table with an optional scan FK and a CHECK constraint that
-- guarantees exactly one of the two sources is populated per row.

alter table public.user_coffee_match_feedback
  add column if not exists user_coffee_scan_id uuid
    references public.user_coffee_scans (id) on delete cascade;

alter table public.user_coffee_match_feedback
  alter column user_coffee_id drop not null;

-- Exactly one source must be non-null.
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
