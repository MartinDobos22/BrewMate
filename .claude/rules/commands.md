---
description: All dev commands — start, build, lint, test, DB migrations, maintenance scripts
alwaysApply: true
---

Requires **Node ≥ 20**.

```bash
# Client (Metro + native build)
npm start                          # Metro bundler (uses metro.config.cjs)
npm run android
npm run ios                        # First-time iOS: `bundle install && bundle exec pod install`

# Backend
node server.js                     # Listens on $PORT (default 3000), 0.0.0.0

# Quality gates
npm run lint                       # eslint . — @react-native config
npm test                           # client + server tests (runs both configs)
npm run test:client                # jest.config.cjs — RN preset, src/ + __tests__/
npm run test:server                # jest.server.config.cjs — Node/ESM via babel-jest
npm run test:coverage              # coverage into coverage/client + coverage/server
npx jest __tests__/App.test.tsx    # single client file
npx jest --config jest.server.config.cjs server/__tests__/foo.test.js  # single server file
npx jest -t "test name"            # single test by name

# DB migrations (Supabase Postgres)
psql "$DATABASE_URL" -f supabase/<YYYYMMDD_name>.sql
psql "$DATABASE_URL" -f supabase/<YYYYMMDD_name>.down.sql   # rollback (best-effort for DROPs)

# One-shot maintenance
node scripts/backfill-image-storage.js --dry-run --limit 100
```

There is no `tsc` script — TypeScript is only checked via the editor / Metro / Jest. Don't add one without checking with the user.

Server tests use `babel-jest` with `@babel/preset-env` to transpile ESM and handle `import.meta.url`.
