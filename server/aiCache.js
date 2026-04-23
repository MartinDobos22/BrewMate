import crypto from 'node:crypto';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const entries = new Map();
// Maps cache key → feature tag (first element passed to `hashKey`) so that
// cache hits/misses can be counted per feature without the caller having to
// pass the tag in again on `get`.
const featureByKey = new Map();

let totalHits = 0;
let totalMisses = 0;
const perFeatureHits = new Map();
const perFeatureMisses = new Map();

const bump = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
};

const cleanup = () => {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now > entry.expiresAt) {
      entries.delete(key);
      featureByKey.delete(key);
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
  if (oldestKey) {
    entries.delete(oldestKey);
    featureByKey.delete(oldestKey);
  }
};

const get = (key) => {
  const feature = featureByKey.get(key) || null;
  const entry = entries.get(key);
  if (!entry) {
    totalMisses += 1;
    bump(perFeatureMisses, feature);
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    entries.delete(key);
    featureByKey.delete(key);
    totalMisses += 1;
    bump(perFeatureMisses, feature);
    return null;
  }
  entry.hits += 1;
  totalHits += 1;
  bump(perFeatureHits, feature);
  return entry.data;
};

// `feature` is optional; pass the same tag used as the first element in
// `hashKey(...)` so later `get()` calls attribute hits/misses correctly.
const set = (key, data, ttlMs = DEFAULT_TTL_MS, feature = null) => {
  evictOldest();
  entries.set(key, {
    data,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    hits: 0,
  });
  if (feature) {
    featureByKey.set(key, feature);
  }
};

const mapToObject = (map) => {
  const out = {};
  for (const [k, v] of map) {
    out[k] = v;
  }
  return out;
};

const cacheStats = () => {
  const totalLookups = totalHits + totalMisses;
  return {
    size: entries.size,
    maxEntries: MAX_ENTRIES,
    totalHits,
    totalMisses,
    hitRate: totalLookups > 0 ? totalHits / totalLookups : 0,
    perFeatureHits: mapToObject(perFeatureHits),
    perFeatureMisses: mapToObject(perFeatureMisses),
  };
};

export { hashKey, get, set, cacheStats };
