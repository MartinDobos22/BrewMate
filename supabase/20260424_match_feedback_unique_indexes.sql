-- P5: Allow a user to overwrite their scan / inventory rating instead of
-- insert-appending a new row each tap. Two partial unique indexes guarantee
-- at most one feedback row per (user, scan) and per (user, inventory item),
-- which backs the `INSERT ... ON CONFLICT DO UPDATE` semantics in
-- `server/inventory.js`.
--
-- Before creating the indexes we de-duplicate any rows the old insert-append
-- logic already persisted, keeping the most recent row per target (highest
-- `created_at`, tie-broken by id). Older rows are discarded; they represented
-- stale guesses that were overwritten by the user anyway.

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
