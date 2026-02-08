create table if not exists public.user_questionnaires (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (id) on delete cascade,
  answers jsonb not null,
  questionnaire_profile jsonb not null,
  taste_profile jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists user_questionnaires_user_id_idx
  on public.user_questionnaires (user_id);

alter table public.user_questionnaires enable row level security;

create policy "Users can read their questionnaires"
  on public.user_questionnaires
  for select
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can insert their questionnaires"
  on public.user_questionnaires
  for insert
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());

create policy "Users can update their questionnaires"
  on public.user_questionnaires
  for update
  using (auth.uid()::text = user_id and public.is_valid_firebase_jwt())
  with check (auth.uid()::text = user_id and public.is_valid_firebase_jwt());
