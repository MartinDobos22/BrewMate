-- Add idempotency_key column to prevent duplicate recipe saves on retry
alter table public.user_saved_coffee_recipes
  add column if not exists idempotency_key text;

create unique index if not exists user_saved_coffee_recipes_idempotency_idx
  on public.user_saved_coffee_recipes (user_id, idempotency_key)
  where idempotency_key is not null;
