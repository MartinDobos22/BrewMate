-- P2: Drop the legacy inline base64 column on `user_coffee`.
--
-- P1 (migration `20260419_coffee_match_hybrid.sql`) introduced
-- `public.user_coffee_images` and back-filled it from
-- `user_coffee.label_image_base64`. This migration:
--   1. verifies the backfill is complete before dropping anything, and
--   2. drops the column only if every legacy row has a matching image row.
--
-- Paired with `20260421_drop_legacy_label_image.down.sql`, which re-adds the
-- column and rehydrates it from `user_coffee_images` (best-effort — any
-- inserts done after the drop will have no backup).

do $$
declare
  legacy_only integer;
begin
  -- Only count rows where the column still exists. Skip the check if the
  -- column is already gone (idempotent re-run).
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
        'Backfill incomplete: % rows still have label_image_base64 but no entry in user_coffee_images. Re-run 20260419_coffee_match_hybrid.sql or backfill manually before dropping.',
        legacy_only;
    end if;
  end if;
end $$;

alter table public.user_coffee
  drop column if exists label_image_base64;
