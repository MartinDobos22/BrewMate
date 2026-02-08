# Security notes

## Never expose in React Native
- Supabase service role key.
- Supabase anon key (if you want **zero** direct DB access from clients).
- Database credentials (app_api / admin).
- `INTERNAL_SHARED_SECRET` (internal-only).
- Firebase Admin credentials or any server secrets.

## Secret rotation
- Rotate `INTERNAL_SHARED_SECRET` regularly. Update both backend and Cloud Functions in a single release.
- Use `app_api` credentials for runtime traffic only; rotate them via Supabase dashboard or SQL.
- Keep Firebase Admin credentials in secure secret stores (e.g., Render/Heroku/Secrets Manager) and rotate when necessary.
- Audit logs for unexpected `/internal` endpoint calls.
