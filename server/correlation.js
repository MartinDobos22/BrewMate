// Request-scoped correlation ID via AsyncLocalStorage. Every log line and
// Sentry event that fires inside a request's async chain can read the same ID,
// so a single scan flow can be traced across OCR → profile → match → DB.

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage();

export const CORRELATION_HEADER = 'x-correlation-id';

export const runWithCorrelation = (req, res, next) => {
  const incoming = req.headers[CORRELATION_HEADER];
  const id =
    typeof incoming === 'string' && incoming.trim().length > 0 && incoming.trim().length < 128
      ? incoming.trim()
      : randomUUID();
  res.setHeader('X-Correlation-Id', id);
  storage.run({ correlationId: id }, () => next());
};

export const getCorrelationId = () => storage.getStore()?.correlationId || null;
