# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

BrewMate is a single repo with two halves:

- **React Native client** — `App.tsx` + `src/` (TypeScript, RN CLI 0.83.1, **not** Expo despite a `tsconfig` extends).
- **Node backend** — `server.js` + `server/*.js` (Express 5, ESM — `package.json` has `"type": "module"`, every server file uses `import`).

Both share API contract types via `src/constants/apiVersion.ts` ↔ `server/apiVersion.js` and brew-calc rules via `src/utils/brewCalc.ts` ↔ `server/brewCalc.js`. **These mirrored files must stay in lockstep — same constants, rounding, resolution rules.** The client file calls this out explicitly.

User-facing strings (errors, screen titles, AI prompts) are in **Slovak**. Keep new UI / error messages Slovak unless the surrounding code is already English.

## Commands

```bash
# Client (Metro + native build)
npm start                       # Metro bundler (uses metro.config.cjs)
npm run android
npm run ios                     # First-time iOS: `bundle install && bundle exec pod install`

# Backend
node server.js                  # Listens on $PORT (default 3000), 0.0.0.0

# Quality gates
npm run lint                    # eslint . — @react-native config
npm test                        # jest (react-native preset)
npx jest __tests__/App.test.tsx # single file
npx jest -t "renders correctly" # single test by name

# DB migrations (Supabase Postgres)
psql "$DATABASE_URL" -f supabase/<YYYYMMDD_name>.sql
psql "$DATABASE_URL" -f supabase/<YYYYMMDD_name>.down.sql   # rollback (best-effort for DROPs)

# One-shot maintenance
node scripts/backfill-image-storage.js --dry-run --limit 100
```

There is no `tsc` script — TypeScript is only checked via the editor / Metro / Jest. Don't add one without checking with the user.

## Backend architecture

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

### Cross-cutting modules

- **`session.js`** — `requireSession(req)` verifies once per request and caches the decoded token on `req.__session`; rate-limit middleware and route handler share the same Firebase verify call. Use `tryAttachSession` in middleware (never throws).
- **`db.js`** — single `pg.Pool` against `DATABASE_URL` / `SUPABASE_DB_URL`. `db.query` is monkey-patched to log every query + duration. `ensureAppUserExists(uid, email, { name, client })` is the **only** sanctioned way to create the FK shadow rows in `app_users` + `user_statistics` before inserting into dependent tables — call it before any first write for a new user.
- **`aiFetch.js`** — wraps OpenAI with timeout (30s), exponential-backoff retry on 429/5xx, structured `AIError` (status / code / retryable / details), JSON parsing, schema validation, and **automatic per-uid token recording into `aiBudget`** when `uid` is passed. Use `aiErrorToResponse(err)` to produce HTTP error bodies that match the rest of the API.
- **`aiCache.js`** — sha256(`hashKey([…])`) → JSON. Backend is Redis when `REDIS_URL` is set, in-memory `Map` (LRU-ish, max 500, 24h TTL) otherwise. `cacheStats()` is exposed via `/api/diagnostics/ai-stats`.
- **`aiBudget.js`** — per-user daily token cap (`USER_DAILY_TOKEN_BUDGET`, default 100k). Redis-backed with key `ai:budget:<uid>:<YYYY-MM-DD>` and 25h TTL; in-memory fallback. Throws `BudgetExceededError` → map to `daily_budget_exhausted` (HTTP 429).
- **`rateLimit.js`** — same Redis-or-memory pattern. Always sets `X-RateLimit-*` headers.
- **`storage.js`** — Supabase Storage for coffee label images. Bucket layout `<bucket>/<user_id>/<user_coffee_id>.<ext>`; bucket is private and reads happen via 1h signed URLs returned by `GET /api/user-coffee/:id/image`. Use `isPathOwnedByUser` before any operation on a stored path.
- **`errors.js`** — single `ERROR_CODES` table is the source of truth for `{status, retryable}` per error code. Use `sendError(res, code, message, extra?)` — never hand-roll `res.status(...).json(...)` for known codes. Client `ApiError` (`src/utils/api.ts`) reads `code` and `retryable` from this shape.
- **`correlation.js`** + **`logger.js`** — JSON logs in prod, pretty logs in dev, both auto-inject `correlation_id`. Don't `console.log` in new server code; use `log.info / warn / error / debug`.

### Optional dependencies

`REDIS_URL` (rate limit, AI cache, AI budget), `SENTRY_DSN`, `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (storage). All have explicit fallbacks — the server runs in dev without any of them. Keep that contract: every new external dep needs a `isXEnabled()`-style guard.

## Client architecture

- **Auth gate** — `App.tsx` wraps everything in `<AuthProvider>`. `AppNavigator` switches between `MainNavigator` and `AuthNavigator` based on `useAuth().user` (which is hydrated from `GET /auth/me` on mount). Route names live in `src/navigation/types.ts`.
- **API layer** — `src/utils/api.ts`'s `apiFetch` is the only path to the backend. It (a) injects `X-Correlation-Id` (auto-generates one if missing, mirrors it into Sentry tags), (b) injects `X-API-Expected-Version`, (c) sanitizes/redacts logs (`password|token|secret` keys, `image|base64` payloads), and (d) dispatches an `auth_error` to a global handler. `AuthContext` registers that handler so any backend `auth_error` collapses local state and AppNavigator flips back to Login. **Never call `fetch` directly** — go through `apiFetch`.
- **API host resolution** — `Config.EXPO_PUBLIC_API_HOST` (via `react-native-config`), else `__DEV__` → `http://localhost:3000` / `http://10.0.2.2:3000` (Android emulator), else `https://brewmate-fe.onrender.com`.
- **Hooks own feature logic** — `src/hooks/useCoffeeMatch`, `useRecipeGenerator`, `useHomeDashboard`, `usePhotoAnalysis`, `useImagePicker`, `useAutoSaveScan`, `useSignedImageUrl`, etc. Screens are mostly composition; put new business logic in a hook, not a screen.
- **Theme** — `src/theme/theme.ts` exports `appTheme`, `palette`, and `navigationTheme`. Use `useTheme()` rather than importing `appTheme` directly so dark-mode work later is non-breaking. Material 3 primitives live in `src/components/md3.tsx`.

## Database & migrations

- Forward migrations are `.sql` files in `supabase/` prefixed `YYYYMMDD_name.sql`, applied **in lexical order**.
- **Destructive forward migrations** (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... SET NOT NULL`, `DELETE`) **must** ship a `<same_name>.down.sql`. Some forward migrations refuse to run if a prerequisite backfill is incomplete (e.g. `20260421_drop_legacy_label_image.sql` checks the `user_coffee_images` backfill — see `supabase/MIGRATIONS.md`).
- `supabase/setup.sql` is the consolidated clean-environment schema. **Update it in the same PR as any forward migration** so a fresh bootstrap matches.
- Rolling back: run `.down.sql` files in **reverse order** of original application, then `git checkout` the prior `setup.sql`.
- `scripts/backfill-image-storage.js` (legacy `image_base64` → Supabase Storage) is idempotent; safe to re-run, requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Conventions worth preserving

- **API errors** always have shape `{ error, code, retryable, details? }` and use codes from `server/errors.js`. Client switches on `code`, not on `message`.
- **`MATCH_CACHE_VERSION`** in `server/ocr.js` invalidates AI response caches; **`API_VERSION`** in `server/apiVersion.js` documents HTTP-contract changes. They are independent — don't conflate them.
- The OpenAI model is read from `process.env.OPENAI_MODEL` (default `gpt-4o-mini`). Don't hard-code model strings in new endpoints.
- AI prompts that drive structured output use `response_format: json_schema` with `strict: true`. Validate with `validateAISchema(parsed, requiredKeys, label)` after `parseAIJson`.
- Logs of request/response payloads are sanitized identically on both sides (`server/app.js` `sanitizePayload` ↔ `src/utils/api.ts` `sanitizePayload`). Mirror any change.

## Things that don't exist yet

- No CI config in this repo.
- No type-check script.
- No e2e tests — Jest setup has a single smoke test (`__tests__/App.test.tsx`).
- No `.env.example` is checked in; required env vars are inferred from `server/config.js`, `server/firebase.js`, `server/db.js`, `server/storage.js`, `server/redis.js`, `server/aiBudget.js`, and `server/auth.js` (look for `process.env.*`).
