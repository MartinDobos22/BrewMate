import express from 'express';
import cors from 'cors';

import { Sentry, initSentry, sentryEnabled, tagCorrelationId } from './sentry.js';
import { corsOptions } from './config.js';
import { globalRateLimit, rateLimitBackend } from './rateLimit.js';
import authRouter from './auth.js';
import inventoryRouter from './inventory.js';
import ocrRouter from './ocr.js';
import { requireSession } from './session.js';
import * as aiCache from './aiCache.js';
import { runWithCorrelation, getCorrelationId } from './correlation.js';
import { log } from './logger.js';
import { API_VERSION, attachApiVersion, requireApiVersion } from './apiVersion.js';
import { usageToday } from './aiBudget.js';

// Init Sentry before building the Express app so request handlers run with
// the SDK already attached. (`import` is hoisted in ESM, so we call this
// after all `import` statements rather than between them.)
initSentry();

const app = express();
app.use(express.json({ limit: '20mb' }));

app.use(cors(corsOptions));
app.use(runWithCorrelation);
app.use(tagCorrelationId);
app.use(attachApiVersion);
app.use(requireApiVersion);
app.use(globalRateLimit);

const IMAGE_PAYLOAD_KEYS = /image|base64/i;
const SENSITIVE_KEYS = /password|token|secret/i;

const sanitizePayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePayload(item));
  }

  if (payload && typeof payload === 'object') {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (IMAGE_PAYLOAD_KEYS.test(key) && typeof value === 'string') {
        acc[key] = {
          omitted: true,
          length: value.length,
        };
        return acc;
      }
      if (SENSITIVE_KEYS.test(key) && typeof value === 'string') {
        acc[key] = {
          redacted: true,
        };
        return acc;
      }
      acc[key] = sanitizePayload(value);
      return acc;
    }, {});
  }

  return payload;
};

app.use((req, res, next) => {
  const startedAt = Date.now();
  log.info('request started', {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    query: req.query,
    params: req.params,
    body: sanitizePayload(req.body),
  });

  res.on('finish', () => {
    log.info('request completed', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});


app.get('/', (req, res) => {
  res.send('Google Vision OCR backend beží.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(authRouter);
app.use(inventoryRouter);
app.use(ocrRouter);

app.get('/api/diagnostics/ai-stats', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const [stats, budget] = await Promise.all([
      aiCache.cacheStats(),
      usageToday(session.uid),
    ]);
    return res.status(200).json({
      cache: stats,
      rateLimitBackend: rateLimitBackend(),
      sentry: sentryEnabled(),
      correlationId: getCorrelationId(),
      apiVersion: API_VERSION,
      budget,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        error: error.message,
        code: 'auth_error',
        retryable: false,
      });
    }
    return next(error);
  }
});

if (sentryEnabled()) {
  Sentry.setupExpressErrorHandler(app);
}

// Central error handler to surface issues in logs and return coherent JSON.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
  log.error('Unhandled server error', { error: err?.message, stack: err?.stack });
  const status = err?.status || 500;
  const message = err?.message || 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;
