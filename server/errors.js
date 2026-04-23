// Single source of truth for error codes shared across HTTP handlers.
// Keeps validation / auth / AI / DB errors consistent so clients can branch
// on `code` and decide whether to retry based on `retryable`.

export const ERROR_CODES = {
  validation_error: { status: 400, retryable: false },
  auth_error: { status: 401, retryable: false },
  not_found: { status: 404, retryable: false },
  below_threshold: { status: 400, retryable: false },
  rate_limited: { status: 429, retryable: true },
  db_error: { status: 500, retryable: true },
  config_error: { status: 500, retryable: false },
  ocr_error: { status: 502, retryable: true },
  ai_timeout: { status: 502, retryable: true },
  ai_network_error: { status: 502, retryable: true },
  ai_api_error: { status: 502, retryable: true },
  ai_rate_limited: { status: 429, retryable: true },
  ai_invalid_json: { status: 502, retryable: false },
  ai_schema_error: { status: 502, retryable: false },
  ai_empty_response: { status: 502, retryable: true },
  ai_parse_error: { status: 502, retryable: false },
  ai_exhausted: { status: 502, retryable: false },
  ai_error: { status: 502, retryable: false },
  api_error: { status: 502, retryable: false },
};

export const sendError = (res, code, message, extra = {}) => {
  const cfg = ERROR_CODES[code] ?? { status: 500, retryable: false };
  return res.status(cfg.status).json({
    error: message,
    code,
    retryable: cfg.retryable,
    ...extra,
  });
};
