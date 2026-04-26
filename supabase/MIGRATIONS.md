# Supabase migrations

## Conventions

- Every forward migration is a `.sql` file prefixed with a date
  (`YYYYMMDD_description.sql`). These must be applied in lexical order.
- Destructive forward migrations — `DROP TABLE`, `DROP COLUMN`, `ALTER
  COLUMN ... SET NOT NULL`, `DELETE` — must ship with a companion
  `<same_name>.down.sql` that documents the reverse operation.
- `setup.sql` is the consolidated schema for a clean environment and is kept
  in sync with forward migrations after each merge.

## Rollback policy

- `DROP COLUMN` and `DROP TABLE` are fundamentally lossy; their `.down.sql`
  companions are **best-effort**. They re-create the schema shape and
  rehydrate from companion tables where possible but cannot recover rows
  inserted after the destructive forward migration ran.
- Before running any destructive forward migration in production:
  1. Take a logical backup of the affected tables (`pg_dump -t`).
  2. Verify prerequisites (e.g. the backfill migration is fully applied —
     `20260421_drop_legacy_label_image.sql` raises an exception if the
     `user_coffee_images` backfill is incomplete).
  3. Put the matching `.down.sql` somewhere accessible in case the deploy
     needs to be rolled back.

## Running a rollback

```bash
# Apply rollback for a specific migration
psql "$DATABASE_URL" -f supabase/20260421_drop_legacy_label_image.down.sql

# Multiple migrations: run in REVERSE order of their original application
for f in 20260421_drop_legacy_label_image 20260421_match_feedback_scan_ref 20260421_user_coffee_scans; do
  psql "$DATABASE_URL" -f "supabase/${f}.down.sql"
done
```

After a rollback, also revert `supabase/setup.sql` (checkout the previous
commit of that file) so a clean environment bootstrap matches the rolled-back
state.

## Migration pairs with rollback support

| Forward | Rollback | Notes |
|---------|----------|-------|
| `20260421_user_coffee_scans.sql` | `20260421_user_coffee_scans.down.sql` | `DROP TABLE`; run feedback rollback first to keep cascade-delete losses to a minimum. |
| `20260421_match_feedback_scan_ref.sql` | `20260421_match_feedback_scan_ref.down.sql` | Deletes scan-sourced feedback rows to satisfy the restored NOT NULL. |
| `20260421_drop_legacy_label_image.sql` | `20260421_drop_legacy_label_image.down.sql` | Best-effort — `DROP COLUMN` is lossy for rows inserted after the drop. |
| `20260419_coffee_match_hybrid.sql` | — | Additive (CREATE TABLE / CREATE INDEX); reverse by dropping the new tables. No explicit down script because it does not destroy existing data. |

For older additive-only migrations (pre-P2) we have not authored `.down.sql`
companions; revert them by dropping the objects they create.

## Maintenance jobs

### Storage backfill (one-shot)

`scripts/backfill-image-storage.js` migrates legacy inline `image_base64` rows
in `user_coffee_images` into Supabase Storage and nulls out the legacy column.
It is **idempotent** — re-runs skip rows that already have `storage_path` set.

Run order after deploying P6+ to a new environment:

```bash
# Dry run first — prints rows it would migrate without touching storage or DB.
node scripts/backfill-image-storage.js --dry-run --limit 100

# Real run — bounded so you can checkpoint progress between batches.
node scripts/backfill-image-storage.js --limit 500 --batch-size 25
```

Required env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_STORAGE_BUCKET` (optional, defaults to `coffee-label-images`).

The script logs a per-row line and a final summary `{ migrated, failed,
skipped, scanned }`. Failures are non-fatal — the row stays on the legacy
fallback path and a future run will retry it.

Once `select count(*) from user_coffee_images where image_base64 is not null
and storage_path is null` returns 0 across all environments, a follow-up PR
can drop the `image_base64` column and remove the legacy fallback in
`server/inventory.js`'s `GET /api/user-coffee/:id/image`.
