// Rate limiting with two backends:
// - In-memory (default, dev-friendly, single-instance)
// - Redis via INCR+EXPIRE (multi-instance safe, opt-in via REDIS_URL)
//
// AI endpoints key by session.uid when a valid session cookie is present so
// one user can't exhaust the OpenAI quota for everyone on the same IP.

import { tryAttachSession } from './session.js';
import { getRedis, isRedisEnabled } from './redis.js';
import { log } from './logger.js';

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

const createMemoryStore = () => {
  const hits = new Map();

  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) {
        hits.delete(key);
      }
    }
  };

  setInterval(cleanup, 60_000).unref();

  return {
    backend: 'memory',
    async increment(key, windowMs) {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return { count: entry.count, resetAt: entry.resetAt };
    },
  };
};

const createRedisStore = () => ({
  backend: 'redis',
  async increment(key, windowMs) {
    const redis = getRedis();
    if (!redis) {
      return memoryStore.increment(key, windowMs);
    }
    try {
      const redisKey = `rl:${key}`;
      const count = await redis.incr(redisKey);
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs);
      }
      const pttl = await redis.pttl(redisKey);
      const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs);
      return { count, resetAt };
    } catch (err) {
      log.warn('RateLimit Redis backend failed, falling back to memory', {
        error: err?.message,
      });
      return memoryStore.increment(key, windowMs);
    }
  },
});

const memoryStore = createMemoryStore();
const store = isRedisEnabled() ? createRedisStore() : memoryStore;

const resolveIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
};

const defaultKeyGenerator = (req) => `ip:${resolveIp(req)}`;

const rateLimit = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX_REQUESTS,
  keyPrefix = 'global',
  keyGenerator = defaultKeyGenerator,
  message = 'Príliš veľa požiadaviek. Skúste to znova neskôr.',
} = {}) => {
  return async (req, res, next) => {
    let baseKey;
    try {
      baseKey = await keyGenerator(req);
    } catch (err) {
      log.warn('RateLimit keyGenerator failed, falling back to IP', { error: err?.message });
      baseKey = defaultKeyGenerator(req);
    }
    const key = `${keyPrefix}:${baseKey}`;
    const { count, resetAt } = await store.increment(key, windowMs);
    const remaining = Math.max(0, max - count);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      log.warn('RateLimit blocked', { key, count, max, retryAfter });
      return res.status(429).json({
        error: message,
        code: 'rate_limited',
        retryable: true,
        retryAfterMs: retryAfter * 1000,
      });
    }

    return next();
  };
};

// AI endpoints: prefer per-user keying so one abusive session cannot drain
// the project-wide OpenAI / Vision quota.
const aiKeyGenerator = async (req) => {
  const session = await tryAttachSession(req);
  if (session?.uid) {
    return `user:${session.uid}`;
  }
  return `ip:${resolveIp(req)}`;
};

const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: 'ai',
  keyGenerator: aiKeyGenerator,
  message: 'Príliš veľa AI požiadaviek. Počkajte chvíľu.',
});

const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: 'global',
});

const rateLimitBackend = () => store.backend;

export { rateLimit, aiRateLimit, globalRateLimit, rateLimitBackend };
