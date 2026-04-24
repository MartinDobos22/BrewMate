// Optional Redis client. Present only when `REDIS_URL` is set (prod / staging).
// Dev keeps running without Redis: callers that check `isRedisEnabled()` fall
// back to in-memory stores so a missing env var never breaks the server.

import Redis from 'ioredis';

let client = null;
let connectPromise = null;

const createClient = () => {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }
  const instance = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  instance.on('error', (err) => {
    console.error('[Redis] client error', err?.message || err);
  });
  instance.on('reconnecting', (delay) => {
    console.warn('[Redis] reconnecting', { delayMs: delay });
  });
  return instance;
};

export const getRedis = () => {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!client) {
    client = createClient();
    if (client) {
      connectPromise = client.connect().catch((err) => {
        console.error('[Redis] initial connect failed', err?.message || err);
      });
    }
  }
  return client;
};

export const isRedisEnabled = () => Boolean(process.env.REDIS_URL);

export const redisReady = async () => {
  const c = getRedis();
  if (!c) return false;
  if (connectPromise) {
    await connectPromise;
  }
  return c.status === 'ready' || c.status === 'connect';
};
