const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 30;

const createStore = () => {
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
    increment(key, windowMs) {
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

const globalStore = createStore();

const resolveKey = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || 'unknown';
  return ip;
};

const rateLimit = ({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX_REQUESTS,
  keyPrefix = 'global',
  keyGenerator,
  message = 'Príliš veľa požiadaviek. Skúste to znova neskôr.',
} = {}) => {
  return (req, res, next) => {
    const baseKey = keyGenerator ? keyGenerator(req) : resolveKey(req);
    const key = `${keyPrefix}:${baseKey}`;
    const { count, resetAt } = globalStore.increment(key, windowMs);
    const remaining = Math.max(0, max - count);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      console.warn('[RateLimit] Blocked', { key, count, max, retryAfter });
      return res.status(429).json({
        error: message,
        code: 'rate_limited',
        retryable: true,
        retryAfterMs: retryAfter * 1000,
      });
    }

    next();
  };
};

const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyPrefix: 'ai',
  message: 'Príliš veľa AI požiadaviek. Počkajte chvíľu.',
});

const globalRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyPrefix: 'global',
});

export { rateLimit, aiRateLimit, globalRateLimit };
