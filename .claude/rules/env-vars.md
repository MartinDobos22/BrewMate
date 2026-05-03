---
description: All environment variables — required vs optional, defaults, where they're read from
alwaysApply: true
---

Source of truth: `server/config.js`. No `.env.example` is checked in.

## Required

| Variable | Used in |
|---|---|
| `DATABASE_URL` or `SUPABASE_DB_URL` | `server/db.js` — Postgres pool |
| `FIREBASE_PROJECT_ID` | `server/firebase.js` |
| `FIREBASE_PRIVATE_KEY` | `server/firebase.js` (PEM, newlines as `\n`) |
| `FIREBASE_CLIENT_EMAIL` | `server/firebase.js` |
| `FIREBASE_WEB_API_KEY` | `server/auth.js` — Identity Toolkit REST |

## Optional (have fallbacks — server starts without them)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP listen port |
| `REDIS_URL` | in-memory fallback | rate limit, AI cache, AI budget |
| `SENTRY_DSN` | disabled | error tracking |
| `SUPABASE_URL` | disabled | Storage signed URLs |
| `SUPABASE_SERVICE_ROLE_KEY` | disabled | Storage admin ops |
| `SUPABASE_STORAGE_BUCKET` | `coffee-label-images` | bucket name |
| `OPENAI_MODEL` | `gpt-4o-mini` | model for all AI endpoints |
| `USER_DAILY_TOKEN_BUDGET` | `100000` | per-user daily token cap |
| `ALLOWED_ORIGINS` | localhost + emulator URLs | CORS allowlist (comma-separated) |
| `RENDER_EXTERNAL_URL` | — | used to set `trust proxy` on Render |

## Client

| Variable | Set via |
|---|---|
| `EXPO_PUBLIC_API_HOST` | `react-native-config` / `.env` |
