import { ERROR_CODES, sendError } from '../../server/errors.js';

describe('ERROR_CODES', () => {
  it('every code has status and retryable', () => {
    for (const [code, def] of Object.entries(ERROR_CODES)) {
      expect(typeof def.status, `${code}.status`).toBe('number');
      expect(typeof def.retryable, `${code}.retryable`).toBe('boolean');
      expect(def.status, `${code}.status range`).toBeGreaterThanOrEqual(400);
    }
  });

  it('auth_error is 401 non-retryable', () => {
    expect(ERROR_CODES.auth_error).toEqual({ status: 401, retryable: false });
  });

  it('rate_limited is 429 retryable', () => {
    expect(ERROR_CODES.rate_limited).toEqual({ status: 429, retryable: true });
  });

  it('daily_budget_exhausted is 429 non-retryable', () => {
    expect(ERROR_CODES.daily_budget_exhausted.status).toBe(429);
    expect(ERROR_CODES.daily_budget_exhausted.retryable).toBe(false);
  });
});

describe('sendError', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('sends correct status and error shape', () => {
    const res = mockRes();
    sendError(res, 'auth_error', 'Not authenticated');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Not authenticated',
        code: 'auth_error',
        retryable: false,
      }),
    );
  });

  it('includes extra fields when provided', () => {
    const res = mockRes();
    sendError(res, 'rate_limited', 'Too many requests', { retryAfter: 60 });
    const body = res.json.mock.calls[0][0];
    expect(body.retryAfter).toBe(60);
  });

  it('falls back to 500 for unknown code', () => {
    const res = mockRes();
    sendError(res, 'unknown_code_xyz', 'Something went wrong');
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
