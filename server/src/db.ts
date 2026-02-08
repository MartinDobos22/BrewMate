import { Pool, PoolClient } from 'pg';

import { config } from './config';

const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  ssl: config.env === 'production' ? { rejectUnauthorized: false } : undefined,
});

export type DbClient = PoolClient;

export const withUserContext = async <T>(uid: string, fn: (client: DbClient) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.firebase_uid', uid]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
