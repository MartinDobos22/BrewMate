alter table if exists public.user_coffee
  add column if not exists status text;

update public.user_coffee
set status = 'active'
where status is null;

alter table public.user_coffee
  alter column status set default 'active',
  alter column status set not null;

alter table public.user_coffee
  drop constraint if exists user_coffee_status_check;

alter table public.user_coffee
  add constraint user_coffee_status_check
  check (status in ('active', 'empty', 'archived'));

create index if not exists user_coffee_user_id_status_idx
  on public.user_coffee (user_id, status);
