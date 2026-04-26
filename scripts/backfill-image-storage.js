#!/usr/bin/env node
/* eslint-env node */
// Backfill legacy inline `image_base64` rows in user_coffee_images into
// Supabase Storage and null out the legacy column. Idempotent — re-runs skip
// already-migrated rows. Designed as a one-shot maintenance script: run once
// post-P6 deploy in dev/staging, then in prod after the bucket is verified.
//
// Usage:
//   node scripts/backfill-image-storage.js --dry-run
//   node scripts/backfill-image-storage.js --limit 500
//   node scripts/backfill-image-storage.js --limit 500 --batch-size 25
//
// Env required:
//   DATABASE_URL (or SUPABASE_DB_URL)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// Optional:
//   SUPABASE_STORAGE_BUCKET (default coffee-label-images)

import '../server/config.js';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

import { buildStoragePath, bucketName, storageEnabled } from '../server/storage.js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--dry-run') {
    args.set('dryRun', true);
  } else if (arg === '--limit' || arg === '--batch-size') {
    const value = Number.parseInt(process.argv[i + 1], 10);
    if (Number.isFinite(value) && value > 0) {
      args.set(arg.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value);
      i += 1;
    }
  }
}

const dryRun = Boolean(args.get('dryRun'));
const limit = args.get('limit') ?? 500;
const batchSize = args.get('batchSize') ?? 50;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, label) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === 2) throw err;
      const wait = 2 ** attempt * 1000;
      console.warn(`[backfill] ${label} failed (attempt ${attempt + 1}/3), retrying in ${wait}ms`, err?.message || err);
      await sleep(wait);
    }
  }
  return undefined;
}

async function main() {
  if (!storageEnabled()) {
    console.error('[backfill] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — abort.');
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('[backfill] DATABASE_URL/SUPABASE_DB_URL missing — abort.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = bucketName();

  console.log('[backfill] starting', { dryRun, limit, batchSize, bucket });

  const stats = { migrated: 0, failed: 0, skipped: 0, scanned: 0 };
  let cursor = 0;

  while (cursor < limit) {
    const remaining = limit - cursor;
    const take = Math.min(batchSize, remaining);

    const { rows } = await pool.query(
      `SELECT uci.id,
              uci.user_coffee_id,
              uci.image_base64,
              uci.content_type,
              uc.user_id
         FROM user_coffee_images uci
         JOIN user_coffee uc ON uc.id = uci.user_coffee_id
        WHERE uci.image_base64 IS NOT NULL
          AND uci.storage_path IS NULL
        ORDER BY uci.created_at ASC
        LIMIT $1`,
      [take],
    );

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      stats.scanned += 1;
      const contentType = row.content_type || 'image/jpeg';
      const path = buildStoragePath(row.user_id, row.user_coffee_id, contentType);

      if (dryRun) {
        console.log('[backfill][dry] would upload', { id: row.id, path, bytes: row.image_base64.length });
        stats.skipped += 1;
        continue;
      }

      let buffer;
      try {
        buffer = Buffer.from(row.image_base64, 'base64');
      } catch (err) {
        console.warn('[backfill] base64 decode failed', { id: row.id, err: err?.message });
        stats.failed += 1;
        continue;
      }

      try {
        await withRetry(async () => {
          const upload = await supabase.storage
            .from(bucket)
            .upload(path, buffer, { contentType, upsert: true });
          if (upload.error) throw upload.error;
        }, `upload ${path}`);
      } catch (err) {
        console.warn('[backfill] upload failed', { id: row.id, path, err: err?.message });
        stats.failed += 1;
        continue;
      }

      try {
        await withRetry(
          () =>
            pool.query(
              `UPDATE user_coffee_images
                  SET storage_path = $1,
                      content_type_v2 = COALESCE(content_type_v2, $2),
                      image_base64 = NULL
                WHERE id = $3 AND storage_path IS NULL`,
              [path, contentType, row.id],
            ),
          `db update ${row.id}`,
        );
        stats.migrated += 1;
      } catch (err) {
        console.warn('[backfill] DB update failed (storage already uploaded)', { id: row.id, err: err?.message });
        stats.failed += 1;
      }
    }

    cursor += rows.length;
    if (rows.length < take) break; // exhausted
  }

  console.log('[backfill] done', stats);
  await pool.end();
}

main().catch((err) => {
  console.error('[backfill] fatal', err);
  process.exit(1);
});
