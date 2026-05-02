---
description: Things that don't exist yet in this repo — no CI, no tsc script, no e2e tests, no .env.example
alwaysApply: true
---

- No CI config in this repo.
- No type-check script.
- No e2e tests — Jest setup has a single smoke test (`__tests__/App.test.tsx`).
- No `.env.example` is checked in; required env vars are inferred from `server/config.js`, `server/firebase.js`, `server/db.js`, `server/storage.js`, `server/redis.js`, `server/aiBudget.js`, and `server/auth.js` (look for `process.env.*`).
