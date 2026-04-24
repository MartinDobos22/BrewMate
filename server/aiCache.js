// AI response cache facade. Backend resolved by env:
// - Redis (REDIS_URL set): shared across workers, survives restarts
// - In-memory (default): per-process Map with LRU-ish eviction (dev / single-dyno)
//
// Public API (hashKey, get, set, cacheStats) is stable — callers in ocr.js
// don't care which backend is active.

import crypto from 'node:crypto';

import { getRedis, isRedisEnabled } from './redis.js';
import { log } from './logger.js';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const REDIS_STATS_KEY = 'ai:cache:stats';
const REDIS_ENTRY_PREFIX = 'ai:cache:entry:';

let totalHits = 0;
let totalMisses = 0;
const perFeatureHits = new Map();
const perFeatureMisses = new Map();

const bump = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
};

// ---- In-memory backend ---------------------------------------------------

const entries = new Map();
const featureByKey = new Map();

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

const memoryGet = (key) => {
  const entry = entries.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    entries.delete(key);
    featureByKey.delete(key);
    return null;
  }
  entry.hits += 1;
  return entry.data;
};

const memorySet = (key, data, ttlMs, feature) => {
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

// ---- Redis backend -------------------------------------------------------

const redisGet = async (key) => {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(`${REDIS_ENTRY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    log.warn('aiCache Redis get failed, falling back to memory', { error: err?.message });
    return memoryGet(key);
  }
};

const redisSet = async (key, data, ttlMs) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(`${REDIS_ENTRY_PREFIX}${key}`, JSON.stringify(data), 'PX', ttlMs);
  } catch (err) {
    log.warn('aiCache Redis set failed, using memory only', { error: err?.message });
  }
};

const redisBumpStats = async (field) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.hincrby(REDIS_STATS_KEY, field, 1);
  } catch (err) {
    log.debug('aiCache Redis stats bump failed', { error: err?.message });
  }
};

// ---- Public API ----------------------------------------------------------

export const hashKey = (parts) => {
  const hash = crypto.createHash('sha256');
  for (const part of parts) {
    hash.update(typeof part === 'string' ? part : JSON.stringify(part ?? ''));
  }
  return hash.digest('hex');
};

export const get = async (key) => {
  const feature = featureByKey.get(key) || null;

  if (isRedisEnabled()) {
    const value = await redisGet(key);
    if (value !== null && value !== undefined) {
      totalHits += 1;
      bump(perFeatureHits, feature);
      redisBumpStats('hits');
      if (feature) redisBumpStats(`feature:${feature}:hits`);
      return value;
    }
    totalMisses += 1;
    bump(perFeatureMisses, feature);
    redisBumpStats('misses');
    if (feature) redisBumpStats(`feature:${feature}:misses`);
    return null;
  }

  const value = memoryGet(key);
  if (value !== null && value !== undefined) {
    totalHits += 1;
    bump(perFeatureHits, feature);
    return value;
  }
  totalMisses += 1;
  bump(perFeatureMisses, feature);
  return null;
};

export const set = async (key, data, ttlMs = DEFAULT_TTL_MS, feature = null) => {
  memorySet(key, data, ttlMs, feature);
  if (feature) {
    featureByKey.set(key, feature);
  }
  if (isRedisEnabled()) {
    await redisSet(key, data, ttlMs);
  }
};

const mapToObject = (map) => {
  const out = {};
  for (const [k, v] of map) out[k] = v;
  return out;
};

export const cacheStats = async () => {
  const backend = isRedisEnabled() ? 'redis' : 'memory';
  const base = {
    backend,
    size: entries.size,
    maxEntries: MAX_ENTRIES,
    totalHits,
    totalMisses,
    hitRate: totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
    perFeatureHits: mapToObject(perFeatureHits),
    perFeatureMisses: mapToObject(perFeatureMisses),
  };

  if (backend !== 'redis') return base;

  try {
    const redis = getRedis();
    const raw = await redis.hgetall(REDIS_STATS_KEY);
    const redisHits = Number(raw?.hits || 0);
    const redisMisses = Number(raw?.misses || 0);
    const perFeature = {};
    for (const [k, v] of Object.entries(raw || {})) {
      const match = k.match(/^feature:(.+):(hits|misses)$/);
      if (match) {
        const [, feature, kind] = match;
        perFeature[feature] = perFeature[feature] || { hits: 0, misses: 0 };
        perFeature[feature][kind] = Number(v);
      }
    }
    return {
      ...base,
      redis: {
        totalHits: redisHits,
        totalMisses: redisMisses,
        hitRate:
          redisHits + redisMisses > 0 ? redisHits / (redisHits + redisMisses) : 0,
        perFeature,
      },
    };
  } catch (err) {
    log.warn('aiCache stats from Redis failed', { error: err?.message });
    return base;
  }
};
