---
description: Express backend architecture — middleware order, routers, cross-cutting modules (session, db, aiFetch, aiCache, aiBudget, rateLimit, storage, errors, logging), optional deps
globs: server/**
alwaysApply: false
---

`server/app.js` builds the Express app; `server.js` only calls `app.listen`. Middleware order matters and is intentional:

1. `runWithCorrelation` (correlation ID via `AsyncLocalStorage` — every `log.*` call and Sentry event in the same async chain reads the same ID; this is how a scan flow is traced across OCR → profile → match → DB).
2. `tagCorrelationId` (Sentry tag).
3. `attachApiVersion` + `requireApiVersion` (header-based calver, currently `2026-04-24`. Client sends `X-API-Expected-Version`; mismatch returns **426** with `code: api_version_mismatch`).
4. `globalRateLimit` (60/min by IP).
5. Per-route `aiRateLimit` (10/min, **keyed by `session.uid`** when a session cookie is present so one user can't drain the AI quota for everyone behind the same NAT).

Routers split by domain:
- `auth.js` — Firebase Auth (email/password via Identity Toolkit REST + Google/Apple ID tokens). Issues a 5-day **session cookie** (`brewmate_session`, `httpOnly`, `secure` in prod, `SameSite=Lax`). All RN calls send `credentials: 'include'`.
- `inventory.js` — `/api/user-coffee*`, `/api/coffee-scans*`, `/api/coffee-journal*`, `/api/coffee-recipes*`, `/api/user-questionnaire*`. Largest module — handles inventory state machine (`active|empty|archived`), gram tracking, journal, saved recipes, match feedback.
- `ocr.js` — Google Vision + OpenAI flows: `/api/ocr-correct`, `/api/coffee-photo-analysis`, `/api/coffee-photo-recipe`, `/api/coffee-profile`, `/api/coffee-questionnaire`, `/api/coffee-match`. All gated by `aiRateLimit` and `assertWithinBudget`.

## Cross-cutting modules

- **`session.js`** — `requireSession(req)` verifies once per request and caches the decoded token on `req.__session`; rate-limit middleware and route handler share the same Firebase verify call. Use `tryAttachSession` in middleware (never throws).
- **`db.js`** — single `pg.Pool` against `DATABASE_URL` / `SUPABASE_DB_URL`. `db.query` is monkey-patched to log every query + duration. `ensureAppUserExists(uid, email, { name, client })` is the **only** sanctioned way to create the FK shadow rows in `app_users` + `user_statistics` before inserting into dependent tables — call it before any first write for a new user.
- **`aiFetch.js`** — wraps OpenAI with timeout (30s), exponential-backoff retry on 429/5xx, structured `AIError` (status / code / retryable / details), JSON parsing, schema validation, and **automatic per-uid token recording into `aiBudget`** when `uid` is passed. Use `aiErrorToResponse(err)` to produce HTTP error bodies that match the rest of the API.
- **`aiCache.js`** — sha256(`hashKey([…])`) → JSON. Backend is Redis when `REDIS_URL` is set, in-memory `Map` (LRU-ish, max 500, 24h TTL) otherwise. `cacheStats()` is exposed via `/api/diagnostics/ai-stats`.
- **`aiBudget.js`** — per-user daily token cap (`USER_DAILY_TOKEN_BUDGET`, default 100k). Redis-backed with key `ai:budget:<uid>:<YYYY-MM-DD>` and 25h TTL; in-memory fallback. Throws `BudgetExceededError` → map to `daily_budget_exhausted` (HTTP 429).
- **`rateLimit.js`** — same Redis-or-memory pattern. Always sets `X-RateLimit-*` headers.
- **`storage.js`** — Supabase Storage for coffee label images. Bucket layout `<bucket>/<user_id>/<user_coffee_id>.<ext>`; bucket is private and reads happen via 1h signed URLs returned by `GET /api/user-coffee/:id/image`. Use `isPathOwnedByUser` before any operation on a stored path.
- **`errors.js`** — single `ERROR_CODES` table is the source of truth for `{status, retryable}` per error code. Use `sendError(res, code, message, extra?)` — never hand-roll `res.status(...).json(...)` for known codes. Client `ApiError` (`src/utils/api.ts`) reads `code` and `retryable` from this shape.
- **`correlation.js`** + **`logger.js`** — JSON logs in prod, pretty logs in dev, both auto-inject `correlation_id`. Don't `console.log` in new server code; use `log.info / warn / error / debug`.

## Optional dependencies

`REDIS_URL` (rate limit, AI cache, AI budget), `SENTRY_DSN`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (storage). All have explicit fallbacks — the server runs in dev without any of them. Keep that contract: every new external dep needs a `isXEnabled()`-style guard.
