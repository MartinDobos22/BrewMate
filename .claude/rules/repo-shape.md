---
description: High-level repo structure — two halves (RN client + Node backend), shared mirrored files, language conventions
alwaysApply: true
---

BrewMate is a single repo with two halves:

- **React Native client** — `App.tsx` + `src/` (TypeScript, RN CLI 0.83.1, **not** Expo despite a `tsconfig` extends).
- **Node backend** — `server.js` + `server/*.js` (Express 5, ESM — `package.json` has `"type": "module"`, every server file uses `import`).

Both share API contract types via `src/constants/apiVersion.ts` ↔ `server/apiVersion.js` and brew-calc rules via `src/utils/brewCalc.ts` ↔ `server/brewCalc.js`. **These mirrored files must stay in lockstep — same constants, rounding, resolution rules.** The client file calls this out explicitly.

User-facing strings (errors, screen titles, AI prompts) are in **Slovak**. Keep new UI / error messages Slovak unless the surrounding code is already English.
