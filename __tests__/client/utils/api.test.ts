import {
  ApiError,
  parseApiError,
  setOnAuthError,
  apiFetch,
} from '../../../src/utils/api';

// global.fetch is mocked in setup.ts before each test

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe('ApiError', () => {
  it('is an instance of Error with correct name', () => {
    const err = new ApiError({ error: 'Not found' }, 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
  });

  it('defaults code to "unknown" when omitted', () => {
    const err = new ApiError({ error: 'oops' }, 500);
    expect(err.code).toBe('unknown');
  });

  it('maps retryable and details from body', () => {
    const err = new ApiError(
      {
        error: 'busy',
        code: 'rate_limited',
        retryable: true,
        details: { wait: 5 },
      },
      429,
    );
    expect(err.retryable).toBe(true);
    expect(err.details).toEqual({ wait: 5 });
  });

  it('coerces retryable to boolean', () => {
    const err = new ApiError({ error: 'x', retryable: undefined }, 400);
    expect(typeof err.retryable).toBe('boolean');
    expect(err.retryable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseApiError
// ---------------------------------------------------------------------------

describe('parseApiError', () => {
  const makeResponse = (body: object, status: number) => ({
    ok: false,
    status,
    json: async () => body,
  });

  it('parses a standard error body into ApiError', async () => {
    const res = makeResponse(
      { error: 'Unauthorized', code: 'auth_error', retryable: false },
      401,
    );
    const err = await parseApiError(res as unknown as Response);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('auth_error');
  });

  it('falls back gracefully when response body is not JSON', async () => {
    const res = {
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json');
      },
    };
    const err = await parseApiError(res as unknown as Response);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.message).toContain('503');
  });

  it('invokes auth error handler for auth_error code', async () => {
    const handler = jest.fn();
    setOnAuthError(handler);

    const res = makeResponse(
      { error: 'Session expired', code: 'auth_error' },
      401,
    );
    await parseApiError(res as unknown as Response);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(ApiError);

    setOnAuthError(null); // cleanup
  });

  it('does not invoke auth handler for other error codes', async () => {
    const handler = jest.fn();
    setOnAuthError(handler);

    const res = makeResponse(
      { error: 'Rate limited', code: 'rate_limited' },
      429,
    );
    await parseApiError(res as unknown as Response);

    expect(handler).not.toHaveBeenCalled();
    setOnAuthError(null);
  });
});

// ---------------------------------------------------------------------------
// apiFetch — header injection and error propagation
// ---------------------------------------------------------------------------

describe('apiFetch', () => {
  it('injects X-Correlation-Id header on every request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({ data: 'ok' }),
    });

    await apiFetch('/api/test');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toBeTruthy();
  });

  it('injects X-API-Expected-Version header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({}),
    });

    await apiFetch('/api/test');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-Expected-Version']).toBeTruthy();
  });

  it('throws ApiError when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map(),
      json: async () => ({ error: 'Not found', code: 'not_found' }),
    });

    await expect(apiFetch('/api/missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('preserves correlation ID when passed in options', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({}),
    });

    await apiFetch('/api/test', {
      headers: { 'X-Correlation-Id': 'my-id-123' },
    });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toBe('my-id-123');
  });
});
