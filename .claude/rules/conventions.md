---
description: Coding conventions — API error shape, cache vs API version, OpenAI model env var, AI structured output, log sanitization
alwaysApply: true
---

- **API errors** always have shape `{ error, code, retryable, details? }` and use codes from `server/errors.js`. Client switches on `code`, not on `message`.
- **`MATCH_CACHE_VERSION`** in `server/ocr.js` invalidates AI response caches; **`API_VERSION`** in `server/apiVersion.js` documents HTTP-contract changes. They are independent — don't conflate them.
- The OpenAI model is read from `process.env.OPENAI_MODEL` (default `gpt-4o-mini`). Don't hard-code model strings in new endpoints.
- AI prompts that drive structured output use `response_format: json_schema` with `strict: true`. Validate with `validateAISchema(parsed, requiredKeys, label)` after `parseAIJson`.
- Logs of request/response payloads are sanitized identically on both sides (`server/app.js` `sanitizePayload` ↔ `src/utils/api.ts` `sanitizePayload`). Mirror any change.
