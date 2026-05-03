import {
  AIError,
  parseAIJson,
  validateAISchema,
  aiErrorToResponse,
  callOpenAI,
} from '../../server/aiFetch.js';

// ---------------------------------------------------------------------------
// AIError
// ---------------------------------------------------------------------------

describe('AIError', () => {
  it('is an instance of Error', () => {
    const err = new AIError('something went wrong');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('AIError');
    expect(err.message).toBe('something went wrong');
  });

  it('has default values for optional fields', () => {
    const err = new AIError('msg');
    expect(err.status).toBe(502);
    expect(err.code).toBe('ai_error');
    expect(err.retryable).toBe(false);
    expect(err.details).toBeNull();
  });

  it('accepts custom status, code, retryable, details', () => {
    const err = new AIError('rate limit', {
      status: 429,
      code: 'ai_rate_limited',
      retryable: true,
      details: { foo: 1 },
    });
    expect(err.status).toBe(429);
    expect(err.code).toBe('ai_rate_limited');
    expect(err.retryable).toBe(true);
    expect(err.details).toEqual({ foo: 1 });
  });
});

// ---------------------------------------------------------------------------
// parseAIJson
// ---------------------------------------------------------------------------

describe('parseAIJson', () => {
  it('parses valid JSON string', () => {
    expect(parseAIJson('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('throws AIError with ai_invalid_json code for invalid JSON', () => {
    expect(() => parseAIJson('not json')).toThrow(AIError);
    try {
      parseAIJson('not json');
    } catch (err) {
      expect(err.code).toBe('ai_invalid_json');
      expect(err.retryable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// validateAISchema
// ---------------------------------------------------------------------------

describe('validateAISchema', () => {
  it('returns the object when all required keys are present', () => {
    const obj = { name: 'coffee', score: 90 };
    expect(validateAISchema(obj, ['name', 'score'])).toBe(obj);
  });

  it('throws AIError with ai_schema_error when keys are missing', () => {
    expect(() =>
      validateAISchema({ name: 'coffee' }, ['name', 'score', 'notes']),
    ).toThrow(AIError);
    try {
      validateAISchema({ name: 'coffee' }, ['name', 'score', 'notes']);
    } catch (err) {
      expect(err.code).toBe('ai_schema_error');
      expect(err.details.missing).toEqual(['score', 'notes']);
    }
  });

  it('treats null values as missing', () => {
    expect(() => validateAISchema({ key: null }, ['key'])).toThrow(AIError);
  });
});

// ---------------------------------------------------------------------------
// aiErrorToResponse
// ---------------------------------------------------------------------------

describe('aiErrorToResponse', () => {
  it('maps AIError to HTTP response shape', () => {
    const err = new AIError('timeout', {
      status: 504,
      code: 'ai_timeout',
      retryable: true,
    });
    const response = aiErrorToResponse(err);
    expect(response.status).toBe(504);
    expect(response.body).toEqual({
      error: 'timeout',
      code: 'ai_timeout',
      retryable: true,
      details: null,
    });
  });

  it('falls back to 502 when error has no status', () => {
    const err = new Error('generic');
    const response = aiErrorToResponse(err);
    expect(response.status).toBe(502);
  });

  it('retryable is always boolean', () => {
    const response = aiErrorToResponse(new AIError('x'));
    expect(typeof response.body.retryable).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// callOpenAI — retry + timeout behavior via mocked fetch
// ---------------------------------------------------------------------------

describe('callOpenAI', () => {
  const validPayload = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'test' }],
  };
  const successBody = {
    choices: [{ message: { content: '{"ok":true}' } }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };

  beforeEach(() => {
    global.fetch = jest.fn();
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it('returns content string on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => successBody,
    });

    const result = await callOpenAI({
      apiKey: 'test-key',
      payload: validPayload,
    });
    expect(result.content).toBe('{"ok":true}');
    expect(result.usage.total_tokens).toBe(15);
  });

  it('throws AIError on non-retryable 400 response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Bad request' } }),
    });

    await expect(
      callOpenAI({ apiKey: 'test-key', payload: validPayload }),
    ).rejects.toThrow(AIError);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limited' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => successBody,
      });

    const result = await callOpenAI({
      apiKey: 'test-key',
      payload: validPayload,
    });
    expect(result.content).toBe('{"ok":true}');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
