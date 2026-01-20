import express from 'express';
import cors from 'cors';

import { corsOptions } from './config.js';
import authRouter from './auth.js';
import ocrRouter from './ocr.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

app.use(cors(corsOptions));


app.get('/', (req, res) => {
  res.send('Google Vision OCR backend beží.');
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(authRouter);
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
