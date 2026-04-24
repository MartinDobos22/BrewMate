-- Best-effort rollback for 20260421_drop_legacy_label_image.sql.
--
-- DROP COLUMN is lossy: any rows inserted into user_coffee AFTER the drop
-- have no label_image_base64 value anywhere. This script re-adds the column
-- and rehydrates it from `user_coffee_images`, which covers the rows whose
-- image was persisted via P1's split pattern. Rows inserted during the
-- drop-gap get NULL (and will need a fresh scan to recover).

alter table public.user_coffee
  add column if not exists label_image_base64 text;

update public.user_coffee uc
set label_image_base64 = uci.image_base64
from public.user_coffee_images uci
where uci.user_coffee_id = uc.id
  and (uc.label_image_base64 is null or length(uc.label_image_base64) = 0);
