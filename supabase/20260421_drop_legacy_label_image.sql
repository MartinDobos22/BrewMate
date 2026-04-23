-- P2: Drop the legacy inline base64 column on `user_coffee`.
--
-- P1 (migration `20260419_coffee_match_hybrid.sql`) introduced
-- `public.user_coffee_images` and back-filled it from
-- `user_coffee.label_image_base64`. Run this migration only AFTER the P1
-- backfill is known to be complete in the target environment, otherwise
-- existing inventory rows will lose their label photos.

alter table public.user_coffee
  drop column if exists label_image_base64;
