// Version of the server API this client was built against. Must match
// `API_VERSION` in `server/apiVersion.js`. Bump both when shipping a breaking
// request/response shape change.
//
// Format: `YYYY-MM-DD` (calver).
export const API_VERSION = '2026-04-24';

export const API_VERSION_REQUEST_HEADER = 'X-API-Expected-Version';
export const API_VERSION_RESPONSE_HEADER = 'X-API-Version';
