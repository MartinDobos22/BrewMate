// Lightweight API versioning.
//
// Design: header-based, non-breaking. Every response carries `X-API-Version`
// so clients can log / alert when the server has moved forward. Clients may
// also send `X-API-Expected-Version` to assert they were built against a
// specific version; a mismatch returns 426 Upgrade Required with a
// structured error so the app can nudge the user to update.
//
// Version format: `YYYY-MM-DD` (calver). Bumping the version documents a
// breaking request-shape or response-shape change somewhere in the API. It
// is NOT the same as `MATCH_CACHE_VERSION` in `server/ocr.js`, which
// invalidates cached AI responses without changing HTTP contracts.

import { sendError } from './errors.js';

export const API_VERSION = '2026-04-24';

export const API_VERSION_HEADER = 'X-API-Version';
export const API_EXPECTED_VERSION_HEADER = 'x-api-expected-version';

const parse = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
};

// Attach the server version to every response. Runs as a global middleware.
export const attachApiVersion = (_req, res, next) => {
  res.setHeader(API_VERSION_HEADER, API_VERSION);
  next();
};

// Optional guard for individual routes: if the client sends
// `X-API-Expected-Version` and it is older than the server version, reject.
// Missing or malformed header is treated as "no expectation" and passes.
export const requireApiVersion = (req, res, next) => {
  const expected = parse(req.headers[API_EXPECTED_VERSION_HEADER]);
  if (!expected) {
    return next();
  }
  if (expected === API_VERSION) {
    return next();
  }
  if (expected < API_VERSION) {
    res.setHeader('Upgrade', API_VERSION);
    return sendError(
      res,
      'api_version_mismatch',
      `Klient je postavený na staršej verzii API (${expected}), server beží ${API_VERSION}. Aktualizuj aplikáciu.`,
      { expected, serverVersion: API_VERSION },
    );
  }
  // Client newer than server — allow but warn. Happens during a staged
  // server rollback or when the client ships ahead of the backend.
  return next();
};
