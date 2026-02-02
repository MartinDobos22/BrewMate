import express from 'express';
import cors from 'cors';

import { corsOptions } from './config.js';
import authRouter from './auth.js';
import inventoryRouter from './inventory.js';
import ocrRouter from './ocr.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.use(cors(corsOptions));

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
  console.log('[Request] started', {
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
    console.log('[Request] completed', {
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

// Central error handler to surface issues in logs and return coherent JSON.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('❌ Unhandled server error:', err);
  const status = err?.status || 500;
  const message = err?.message || 'Internal server error';
  res.status(status).json({ error: message });
});

export default app;
