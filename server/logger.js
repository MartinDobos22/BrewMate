// Thin structured logger. No external deps.
// - Prod (NODE_ENV=production): JSON lines on stdout/stderr so Render /
//   log aggregators can index `correlation_id`, `level`, `feature`, etc.
// - Dev: readable pretty-print with correlation id tail.
// Auto-injects correlation ID from AsyncLocalStorage (server/correlation.js).

import { getCorrelationId } from './correlation.js';

const isProd = process.env.NODE_ENV === 'production';

const emit = (level, message, data) => {
  const correlationId = getCorrelationId();
  const payload = {
    level,
    message,
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    ...(data && typeof data === 'object' ? data : {}),
  };

  const stream = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';

  if (isProd) {
    console[stream](JSON.stringify(payload));
    return;
  }

  const suffix = correlationId ? ` cid=${correlationId.slice(0, 8)}` : '';
  console[stream](`[${level}]${suffix} ${message}`, data && Object.keys(data).length ? data : '');
};

export const log = {
  info: (msg, data) => emit('info', msg, data),
  warn: (msg, data) => emit('warn', msg, data),
  error: (msg, data) => emit('error', msg, data),
  debug: (msg, data) => {
    if (!isProd) emit('debug', msg, data);
  },
};
