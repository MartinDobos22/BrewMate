// Phase 0 sanity check: the server-side jest pipeline (babel-jest transform,
// env seeding, default mocks) can import the most heavily-mocked modules
// without throwing. If this test breaks, the test infra is broken before
// any real test starts and Fáza 1+ tests would all fail in confusing ways.

import { ERROR_CODES, sendError } from '../../server/errors.js';
import { API_VERSION, API_VERSION_HEADER } from '../../server/apiVersion.js';

describe('server test infra', () => {
  test('errors module exposes the canonical code table', () => {
    expect(ERROR_CODES.auth_error).toEqual({ status: 401, retryable: false });
    expect(ERROR_CODES.rate_limited).toEqual({ status: 429, retryable: true });
    expect(typeof sendError).toBe('function');
  });

  test('apiVersion module exposes calver constant and header name', () => {
    expect(API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(API_VERSION_HEADER).toBe('X-API-Version');
  });

  test('default fetch mock is wired up by setup.js', async () => {
    const res = await fetch('https://example.com');
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  test('firebase-admin is mocked — importing firebase.js does not throw', async () => {
    const mod = await import('../../server/firebase.js');
    expect(typeof mod.admin.auth).toBe('function');
  });
});
