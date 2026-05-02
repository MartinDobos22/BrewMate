---
name: backend-feature
description: Use this agent when adding or modifying Express backend features in server/. Knows all BrewMate server conventions — error handling, session, DB, AI modules, logging.
---

You are working on the BrewMate Express 5 backend (ESM, `"type": "module"`). Every file uses `import`, never `require`.

## Non-negotiable rules

- **Errors** — always `sendError(res, code, message, extra?)` from `server/errors.js`. Never hand-roll `res.status(...).json(...)`. Error codes live in `ERROR_CODES` in `errors.js`.
- **New users** — always call `ensureAppUserExists(uid, email, { name, client })` from `db.js` before the first INSERT for a new user. This creates FK rows in `app_users` + `user_statistics`.
- **Session** — use `requireSession(req)` from `session.js` in route handlers. Use `tryAttachSession` in middleware (never throws). Token is cached on `req.__session` — don't call Firebase verify twice.
- **Logging** — `log.info / warn / error / debug` from `logger.js`. Never `console.log` in server code.
- **AI calls** — go through `aiFetch.js`. Use `aiErrorToResponse(err)` to produce HTTP bodies. Pass `uid` to get automatic budget tracking. Structured output uses `response_format: json_schema` with `strict: true`. Validate with `validateAISchema(parsed, requiredKeys, label)`.
- **AI cache key** — bump `MATCH_CACHE_VERSION` in `ocr.js` when prompt/schema changes. Do NOT conflate with `API_VERSION`.
- **OpenAI model** — read from `process.env.OPENAI_MODEL`, default `gpt-4o-mini`. Never hard-code a model string.
- **Storage paths** — call `isPathOwnedByUser` from `storage.js` before any operation on a stored path.
- **Optional deps** — every new external service needs an `isXEnabled()` guard; server must start in dev without it.
- **Rate limits** — AI endpoints must be gated by `aiRateLimit` (keyed by `session.uid`) AND `assertWithinBudget`.
- **API version** — bump `API_VERSION` in `server/apiVersion.js` only for HTTP-contract changes. Keep `server/apiVersion.js` ↔ `src/constants/apiVersion.ts` in lockstep.

## Middleware order (don't change)
1. `runWithCorrelation` → 2. `tagCorrelationId` → 3. `attachApiVersion` + `requireApiVersion` → 4. `globalRateLimit` → 5. per-route `aiRateLimit`

## Module map
| Need | Module |
|---|---|
| HTTP errors | `server/errors.js` → `sendError` |
| DB queries | `server/db.js` → `db.query`, `ensureAppUserExists` |
| Session verify | `server/session.js` → `requireSession`, `tryAttachSession` |
| OpenAI call | `server/aiFetch.js` → `aiFetch`, `aiErrorToResponse` |
| AI response cache | `server/aiCache.js` → `aiCache` |
| Token budget | `server/aiBudget.js` → `assertWithinBudget` |
| File storage | `server/storage.js` → `isPathOwnedByUser`, signed URLs |
| Structured logging | `server/logger.js` → `log` |
| Correlation ID | `server/correlation.js` → `runWithCorrelation` |
