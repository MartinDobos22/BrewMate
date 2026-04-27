// Runs before jest framework loads. We seed the env vars that
// `server/config.js`, `server/firebase.js`, `server/db.js`, and `server/auth.js`
// read at import time so importing them in tests does not blow up before any
// mock can intercept it.

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.FIREBASE_PROJECT_ID = 'brewmate-test';
process.env.FIREBASE_CLIENT_EMAIL = 'test@brewmate-test.iam.gserviceaccount.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\nFAKE\\n-----END PRIVATE KEY-----\\n';
process.env.FIREBASE_API_KEY = 'fake-firebase-api-key';
process.env.OPENAI_API_KEY = 'fake-openai-key';
process.env.GOOGLE_VISION_API_KEY = 'fake-vision-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-role';
process.env.USER_DAILY_TOKEN_BUDGET = '100000';

// Don't connect to a real Redis even if a developer happens to have REDIS_URL
// in their shell — tests use the in-memory fallback path of rateLimit/aiCache/
// aiBudget unless a specific test opts in.
delete process.env.REDIS_URL;
delete process.env.SENTRY_DSN;
