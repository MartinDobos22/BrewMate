---
description: Things that don't exist yet in this repo — no e2e tests, no .env.example, no build/release pipeline
alwaysApply: true
---

## Already in place

- **CI** — `.github/workflows/ci.yml` runs lint, client tests, server tests, strict type-check, and `npm audit --audit-level=high` on every PR / push to `main`.
- **Type-check** — `npm run type-check` (`tsc --project tsconfig.check.json`) runs in strict mode against the client. Server (`server/`) and `__tests__/` are excluded.
- **Security review pipeline** — `security-reviewer` subagent + `stop-security-gate.cjs` Stop hook flag server/ changes for review.

## Still missing

- **No e2e tests** — Jest setup has a smoke test (`__tests__/App.test.tsx`) plus targeted unit tests under `__tests__/client/` and `__tests__/server/`. No Detox / Maestro flow.
- **No `.env.example`** — required env vars are inferred from `server/config.js`, `server/firebase.js`, `server/db.js`, `server/storage.js`, `server/redis.js`, `server/aiBudget.js`, and `server/auth.js` (look for `process.env.*`). Source of truth: `.claude/rules/env-vars.md`.
- **No build/release pipeline** — no Fastlane, no automated versioning, no signed-build CI for App Store / Play Store.
