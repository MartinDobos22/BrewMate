import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const entries = new Map();

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now > entry.expiresAt) {
      entries.delete(key);
    }
  }
};

setInterval(cleanup, 5 * 60_000).unref();

const hashKey = (parts) => {
  const hash = crypto.createHash('sha256');
  for (const part of parts) {
    hash.update(typeof part === 'string' ? part : JSON.stringify(part ?? ''));
  }
  return hash.digest('hex');
};

const evictOldest = () => {
  if (entries.size <= MAX_ENTRIES) return;
  let oldestKey = null;
  let oldestTime = Infinity;
  for (const [key, entry] of entries) {
    if (entry.createdAt < oldestTime) {
      oldestTime = entry.createdAt;
      oldestKey = key;
    }
  }
  if (oldestKey) entries.delete(oldestKey);
};

const get = (key) => {
  const entry = entries.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    entries.delete(key);
    return null;
  }
  entry.hits += 1;
  return entry.data;
};

const set = (key, data, ttlMs = DEFAULT_TTL_MS) => {
  evictOldest();
  entries.set(key, {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    hits: 0,
  });
};

const cacheStats = () => ({
  size: entries.size,
  maxEntries: MAX_ENTRIES,
});

export { hashKey, get, set, cacheStats };
