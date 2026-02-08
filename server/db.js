import './config.js';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.warn('⚠️  Missing DATABASE_URL/SUPABASE_DB_URL environment variable.');
}

const db = new Pool({
  connectionString,
});

/**
 * Ensures that the shadow records required by FK constraints exist before any
 * endpoint writes into dependent tables. By selecting first and only
 * inserting missing rows we avoid transient FK violations when multiple
 * inserts run in the same transaction.
 *
 * @param {string} userId - Authenticated Firebase UID.
 * @param {string | null | undefined} email - User email, stored for auditing.
 * @param {{ name?: string | null, client?: Pool | import('pg').PoolClient }} options
 *   Optional display name and DB client; defaults to the global pool to work
 *   outside transactions.
 */
const ensureAppUserExists = async (userId, email, options = {}) => {
  const client = options.client || db;
  const name = options.name || (email ? email.split('@')[0] : null);

  console.info('[DB] Upserting app user records', {
    userId,
    email: email || null,
    name,
  });

  await client.query(
    `INSERT INTO app_users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id)
     DO UPDATE SET email = EXCLUDED.email,
                   name = EXCLUDED.name,
                   updated_at = NOW()`,
    [userId, email || null, name]
  );

  await client.query(
    `INSERT INTO user_statistics (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  console.info('[DB] App user records ensured', { userId });
};

// Wrap default query method to log all interactions with Supabase
const originalQuery = db.query.bind(db);
db.query = async (text, params) => {
  console.log('📤 [Supabase] Query:', {
    text,
    paramCount: Array.isArray(params) ? params.length : 0,
  });
  const start = Date.now();
  const res = await originalQuery(text, params);
  console.log('📥 [Supabase] Response:', {
    rows: res.rowCount,
    duration: Date.now() - start,
  });
  return res;
};

export { db, ensureAppUserExists };
