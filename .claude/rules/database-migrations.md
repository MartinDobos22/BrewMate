---
description: DB migration rules — naming, destructive migrations, down files, setup.sql sync, rollback procedure
globs: supabase/**
alwaysApply: false
---

- Forward migrations are `.sql` files in `supabase/` prefixed `YYYYMMDD_name.sql`, applied **in lexical order**.
- **Destructive forward migrations** (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... SET NOT NULL`, `DELETE`) **must** ship a `<same_name>.down.sql`. Some forward migrations refuse to run if a prerequisite backfill is incomplete (e.g. `20260421_drop_legacy_label_image.sql` checks the `user_coffee_images` backfill — see `supabase/MIGRATIONS.md`).
- `supabase/setup.sql` is the consolidated clean-environment schema. **Update it in the same PR as any forward migration** so a fresh bootstrap matches.
- Rolling back: run `.down.sql` files in **reverse order** of original application, then `git checkout` the prior `setup.sql`.
- `scripts/backfill-image-storage.js` (legacy `image_base64` → Supabase Storage) is idempotent; safe to re-run, requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
