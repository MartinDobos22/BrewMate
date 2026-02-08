import express from 'express';
import cors from 'cors';

import { config, requireEnv } from './config';
import { requestLogger } from './middleware/logger';
import { rateLimit } from './middleware/rateLimit';
import usersRouter from './routes/users';
import internalRouter from './routes/internal';

requireEnv(config.firebaseProjectId, 'FIREBASE_PROJECT_ID');
requireEnv(config.internalSharedSecret, 'INTERNAL_SHARED_SECRET');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api', usersRouter);
app.use('/internal', internalRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error', err);
  res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(config.port, () => {
  console.log(`[API] listening on ${config.port} (${config.env})`);
});
