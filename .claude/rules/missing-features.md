---
description: Things that don't exist yet in this repo — no e2e tests, no .env.example, no build/release pipeline
alwaysApply: true
---

## Already in place

- **CI** — `.github/workflows/ci.yml` runs lint, client tests, server tests, strict type-check, and `npm audit --audit-level=high` on every PR / push to `main`.
- **Type-check** — `npm run type-check` (`tsc --project tsconfig.check.json`) runs in strict mode against the client. Server (`server/`) and `__tests__/` are excluded.
- **Security review pipeline** — `security-reviewer` subagent + `stop-security-gate.cjs` Stop hook flag server/ changes for review.
- **E2E (smoke) tests** — Maestro flows under `.maestro/flows/` run on an Android emulator in `.github/workflows/e2e.yml` (currently `continue-on-error: true` while the pipeline stabilises). Local: `npm run test:e2e`.
- **Secrets scanning in CI** — `secrets-scan` job in `.github/workflows/ci.yml` runs `gitleaks` on every PR (diff) and push to `main` (full history). Project allowlist is in `.gitleaks.toml`. **Note:** GitHub-native Secret Scanning + Push Protection must be enabled separately in repo Settings → Code security.

## Still missing

- **E2E coverage is minimal** — only app-launch + login→register navigation. No login/scan/match happy-path flow yet. Auth flows need test accounts wired in before they can be exercised in CI.
- **No `.env.example`** — required env vars are inferred from `server/config.js`, `server/firebase.js`, `server/db.js`, `server/storage.js`, `server/redis.js`, `server/aiBudget.js`, and `server/auth.js` (look for `process.env.*`). Source of truth: `.claude/rules/env-vars.md`.
- **No build/release pipeline** — no Fastlane, no automated versioning, no signed-build CI for App Store / Play Store.
