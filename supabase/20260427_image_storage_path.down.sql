-- Rollback for 20260427_image_storage_path.sql.
--
-- Re-imposes NOT NULL on image_base64 — any rows created via the signed-URL
-- flow that have NULL `image_base64` would block the constraint, so we
-- delete them first with a clear notice. (They cannot be rehydrated; the
-- bytes live in object storage which the rollback does not back-fetch.)

do $$
declare
  storage_only integer;
begin
  select count(*) into storage_only
  from public.user_coffee_images
  where image_base64 is null;

  if storage_only > 0 then
    raise notice
      'Rollback dropping % rows that lived only in object storage.',
      storage_only;
    delete from public.user_coffee_images where image_base64 is null;
  end if;
end $$;

alter table public.user_coffee_images
  drop constraint if exists user_coffee_images_storage_check;

drop index if exists public.user_coffee_images_storage_path_idx;

alter table public.user_coffee_images
  drop column if exists storage_path,
  drop column if exists content_type_v2;

alter table public.user_coffee_images
  alter column image_base64 set not null;
