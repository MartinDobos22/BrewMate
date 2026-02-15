alter table if exists public.user_coffee
  add column if not exists ai_match_result jsonb,
  add column if not exists label_image_base64 text,
  add column if not exists loved boolean not null default false;

drop policy if exists "Users can delete their coffee entries" on public.user_coffee;

create policy "Users can delete their coffee entries"
  on public.user_coffee
  for delete
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
