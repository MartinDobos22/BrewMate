// Resilient wrapper for OpenAI API calls with timeout, retry, and schema validation.

const AI_REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);

class AIError extends Error {
  constructor(message, { status = 502, code = 'ai_error', retryable = false, details = null } = {}) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options, timeoutMs = AI_REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AIError('AI request timed out.', {
        code: 'ai_timeout',
        retryable: true,
      });
    }
    throw new AIError('AI request failed (network error).', {
      code: 'ai_network_error',
      retryable: true,
      details: err.message,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

// Call OpenAI with automatic retry on transient failures.
const callOpenAI = async ({ apiKey, payload, label = 'AI' }) => {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[${label}] Retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1}) after ${delay}ms`);
      await sleep(delay);
    }

    const requestStart = Date.now();
    let response;

    try {
      response = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
    } catch (err) {
      lastError = err instanceof AIError ? err : new AIError(err.message, { retryable: true });
      console.warn(`[${label}] Request failed (attempt ${attempt + 1})`, { error: lastError.message });
      if (!lastError.retryable || attempt === MAX_RETRIES) {
        throw lastError;
      }
      continue;
    }

    const durationMs = Date.now() - requestStart;
    let data;
    try {
      data = await response.json();
    } catch {
      throw new AIError('Failed to parse AI response body.', {
        code: 'ai_parse_error',
        retryable: false,
      });
    }

    console.log(`[${label}] Response received`, {
      status: response.status,
      durationMs,
      attempt: attempt + 1,
    });

    if (!response.ok) {
      const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
      lastError = new AIError(
        `OpenAI API returned status ${response.status}.`,
        {
          code: response.status === 429 ? 'ai_rate_limited' : 'ai_api_error',
          retryable: isRetryable,
          details: data,
        },
      );

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw lastError;
      }
      continue;
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AIError('AI returned empty response.', {
        code: 'ai_empty_response',
        retryable: false,
      });
    }

    return { content, raw: data, durationMs };
  }

  throw lastError || new AIError('AI request failed after retries.', { code: 'ai_exhausted', retryable: false });
};

// Parse JSON from AI content with structured error.
const parseAIJson = (content, label = 'AI') => {
  try {
    return JSON.parse(content);
  } catch (err) {
    console.error(`[${label}] Failed to parse AI JSON`, { content: content.slice(0, 500), error: err.message });
    throw new AIError('Failed to parse AI response as JSON.', {
      code: 'ai_invalid_json',
      retryable: false,
      details: { rawContent: content.slice(0, 300) },
    });
  }
};

// Validate a parsed AI object has the required top-level keys.
const validateAISchema = (obj, requiredKeys, label = 'AI') => {
  const missing = requiredKeys.filter((key) => obj[key] === undefined || obj[key] === null);
  if (missing.length > 0) {
    console.error(`[${label}] Schema validation failed`, { missing, keys: Object.keys(obj) });
    throw new AIError(`AI response missing required fields: ${missing.join(', ')}.`, {
      code: 'ai_schema_error',
      retryable: false,
      details: { missing, received: Object.keys(obj) },
    });
  }
  return obj;
};

// Convert an AIError to an HTTP response object.
const aiErrorToResponse = (error) => ({
  status: error.status || 502,
  body: {
    error: error.message,
    code: error.code || 'ai_error',
    retryable: Boolean(error.retryable),
    details: error.details || null,
  },
});

export { AIError, callOpenAI, parseAIJson, validateAISchema, aiErrorToResponse };
