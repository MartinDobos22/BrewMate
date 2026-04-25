// Per-user daily AI token budget. Backed by Redis when REDIS_URL is set
// (durable across workers and restarts), in-memory Map otherwise (dev only).
//
// Used to cap individual users so a runaway scripted client doesn't drain
// the project-wide OpenAI quota. The token log added in P3 (`aiFetch.js`
// `[AI] tokens=...`) is the input; this module accumulates per uid per day
// and asserts the limit before each AI call.

import { getRedis, isRedisEnabled } from './redis.js';
import { log } from './logger.js';

const DEFAULT_LIMIT = 100_000;
const TTL_SECONDS = 90_000; // 25 h, ensures the key outlives the day boundary.

const limit = () => {
  const raw = Number(process.env.USER_DAILY_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LIMIT;
};

const today = () => new Date().toISOString().slice(0, 10);

// Local fallback store: Map<`<uid>:<date>`, total>
const memoryUsage = new Map();
const memoryKey = (uid) => `${uid}:${today()}`;

const cleanupMemory = () => {
  const prefix = today();
  for (const k of memoryUsage.keys()) {
    if (!k.endsWith(`:${prefix}`)) {
      memoryUsage.delete(k);
    }
  }
};
setInterval(cleanupMemory, 60 * 60_000).unref();

const redisKey = (uid) => `ai:budget:${uid}:${today()}`;

const readUsage = async (uid) => {
  if (!uid) return 0;
  if (isRedisEnabled()) {
    const redis = getRedis();
    if (!redis) return 0;
    try {
      const raw = await redis.get(redisKey(uid));
      return raw ? Number(raw) || 0 : 0;
    } catch (err) {
      log.warn('aiBudget Redis read failed', { error: err?.message });
      return memoryUsage.get(memoryKey(uid)) || 0;
    }
  }
  return memoryUsage.get(memoryKey(uid)) || 0;
};

export const recordUsage = async (uid, totalTokens) => {
  if (!uid || !Number.isFinite(totalTokens) || totalTokens <= 0) {
    return;
  }
  const tokens = Math.floor(totalTokens);
  if (isRedisEnabled()) {
    const redis = getRedis();
    if (redis) {
      try {
        const key = redisKey(uid);
        const next = await redis.incrby(key, tokens);
        // Re-set TTL on first write of the day so the key auto-rolls.
        if (Number(next) === tokens) {
          await redis.expire(key, TTL_SECONDS);
        }
        return;
      } catch (err) {
        log.warn('aiBudget Redis incr failed, falling back to memory', {
          error: err?.message,
        });
      }
    }
  }
  const k = memoryKey(uid);
  memoryUsage.set(k, (memoryUsage.get(k) || 0) + tokens);
};

export const usageToday = async (uid) => {
  const used = await readUsage(uid);
  const max = limit();
  return { usedToday: used, limit: max, remaining: Math.max(0, max - used) };
};

export class BudgetExceededError extends Error {
  constructor(uid, used, max) {
    super(`Daily AI token budget exhausted (${used}/${max}).`);
    this.name = 'BudgetExceededError';
    this.uid = uid;
    this.usedToday = used;
    this.limit = max;
  }
}

export const assertWithinBudget = async (uid) => {
  if (!uid) return;
  const used = await readUsage(uid);
  const max = limit();
  if (used >= max) {
    throw new BudgetExceededError(uid, used, max);
  }
};

export const dailyLimit = limit;
