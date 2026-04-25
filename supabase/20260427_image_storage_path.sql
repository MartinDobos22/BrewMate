-- P6: Make `user_coffee_images` ready for object-storage migration.
--
-- New columns:
--   `storage_path`     — bucket-relative key in Supabase Storage / S3.
--   `content_type_v2`  — alongside legacy `content_type`, lets us keep the
--                        type that the upload signed URL was issued for
--                        without rewriting old rows.
--
-- `image_base64` becomes nullable so newly inserted rows that go via the
-- signed-upload flow can record only the storage key. Rows pre-dating this
-- migration keep their inline base64 until a backfill script ports them.

alter table public.user_coffee_images
  add column if not exists storage_path text,
  add column if not exists content_type_v2 text;

alter table public.user_coffee_images
  alter column image_base64 drop not null;

-- Sanity guard: at least one of the two storage modes must be present.
alter table public.user_coffee_images
  drop constraint if exists user_coffee_images_storage_check;

alter table public.user_coffee_images
  add constraint user_coffee_images_storage_check
    check (image_base64 is not null or storage_path is not null);

create index if not exists user_coffee_images_storage_path_idx
  on public.user_coffee_images (storage_path)
  where storage_path is not null;
