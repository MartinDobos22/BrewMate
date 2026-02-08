# DB SQL

## 1) Migration script (extensions → table → indexes → trigger → roles → grants → RLS)

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table
CREATE TABLE IF NOT EXISTS public.profiles (
  firebase_uid TEXT PRIMARY KEY,
  user_id UUID DEFAULT gen_random_uuid() UNIQUE,
  email TEXT NULL,
  phone TEXT NULL,
  display_name TEXT NULL,
  photo_url TEXT NULL,
  provider TEXT NULL,
  raw_claims JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sign_in_at TIMESTAMPTZ NULL,
  deleted_at TIMESTAMPTZ NULL
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_updated_at_idx ON public.profiles (updated_at);
CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx ON public.profiles (deleted_at);
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at();

-- Roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    CREATE ROLE app_api LOGIN NOINHERIT;
  END IF;
END $$;

-- Grants (RLS enforced)
GRANT CONNECT ON DATABASE postgres TO app_api;
GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO app_api;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (firebase_uid = current_setting('app.firebase_uid', true));

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own
  ON public.profiles
  FOR INSERT
  WITH CHECK (firebase_uid = current_setting('app.firebase_uid', true));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING (firebase_uid = current_setting('app.firebase_uid', true))
  WITH CHECK (firebase_uid = current_setting('app.firebase_uid', true));
```

## 2) Example queries (SELECT / INSERT / UPSERT / UPDATE)

```sql
-- Set request context (backend does this once per transaction)
SELECT set_config('app.firebase_uid', 'firebase_uid_here', true);

-- SELECT
SELECT * FROM public.profiles WHERE firebase_uid = 'firebase_uid_here';

-- INSERT (initial sync)
INSERT INTO public.profiles (firebase_uid, email, display_name)
VALUES ('firebase_uid_here', 'user@example.com', 'User');

-- UPSERT (keep existing values when incoming values are NULL)
INSERT INTO public.profiles (firebase_uid, email, display_name, photo_url, raw_claims)
VALUES ('firebase_uid_here', 'user@example.com', 'User', NULL, '{"email_verified":true}')
ON CONFLICT (firebase_uid) DO UPDATE
SET email = COALESCE(EXCLUDED.email, public.profiles.email),
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    photo_url = COALESCE(EXCLUDED.photo_url, public.profiles.photo_url),
    raw_claims = COALESCE(EXCLUDED.raw_claims, public.profiles.raw_claims),
    updated_at = now();

-- UPDATE (whitelisted fields)
UPDATE public.profiles
SET display_name = 'New Name', photo_url = 'https://...'
WHERE firebase_uid = 'firebase_uid_here';
```

## 3) How to apply in Supabase

- **SQL editor**: open the Supabase dashboard → SQL editor → paste the migration script section (above) → run.
- **Supabase CLI**: save the migration script as a `.sql` migration in `supabase/migrations/`, then run `supabase db push`.

### Admin vs app_api
- **app_api** is used by the backend at runtime (RLS enforced, minimal privileges).
- **admin** access (e.g., migrations) should use `postgres` or Supabase `service_role` outside of user requests.
