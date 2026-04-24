// Sentry for the Node backend. Init is a no-op without SENTRY_DSN so dev
// machines don't need an account set up.

import * as Sentry from '@sentry/node';
import { getCorrelationId } from './correlation.js';

let initialized = false;

export const initSentry = () => {
  if (initialized || !process.env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    release: process.env.RENDER_GIT_COMMIT || undefined,
  });
  initialized = true;
};

export const sentryEnabled = () => initialized;

// Express middleware — tags every event with the per-request correlation ID
// so Sentry can be cross-referenced with structured logs.
export const tagCorrelationId = (_req, _res, next) => {
  if (!initialized) {
    return next();
  }
  const correlationId = getCorrelationId();
  if (correlationId) {
    Sentry.getCurrentScope().setTag('correlation_id', correlationId);
  }
  next();
};

export { Sentry };
