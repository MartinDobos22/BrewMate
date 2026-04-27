// Per-test-file setup. Runs after jest framework is loaded so `jest.mock` is
// available. We mock the heavy I/O modules globally — individual tests can
// override the implementations on a per-test basis.
//
// Conventions:
// - `pg` is mocked so `new Pool()` returns an object whose `.query` is a
//   jest.fn(). Tests `.mockResolvedValueOnce({ rows: [...], rowCount: N })`.
// - `firebase-admin` is mocked at the module boundary; the auth surface
//   (`verifySessionCookie`, `verifyIdToken`, `createUser`, etc.) returns
//   resolved promises by default.
// - `node:fetch` (global) is mocked per test for Identity Toolkit / OpenAI /
//   Vision; tests override `global.fetch` and assert call args.
// - `@supabase/supabase-js` createClient returns a stub; storage tests can
//   replace it.
// - `ioredis` is mocked — Redis is treated as disabled by default. Tests that
//   want to exercise the Redis path set REDIS_URL and override the mock.

jest.mock('pg', () => {
  const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const connect = jest.fn().mockResolvedValue({
    query,
    release: jest.fn(),
  });
  const end = jest.fn().mockResolvedValue(undefined);
  const Pool = jest.fn().mockImplementation(() => ({ query, connect, end }));
  return { __esModule: true, Pool, default: { Pool } };
});

jest.mock('firebase-admin', () => {
  const auth = {
    verifySessionCookie: jest.fn(),
    verifyIdToken: jest.fn(),
    createSessionCookie: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
    getUserByEmail: jest.fn(),
    deleteUser: jest.fn().mockResolvedValue(undefined),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
  };
  const credential = {
    cert: jest.fn(() => ({})),
  };
  const admin = {
    initializeApp: jest.fn(),
    auth: jest.fn(() => auth),
    credential,
  };
  return { __esModule: true, default: admin, ...admin };
});

jest.mock('@supabase/supabase-js', () => {
  const storageFrom = {
    createSignedUploadUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://test.supabase.co/upload', token: 't', path: 'p' },
      error: null,
    }),
    createSignedUrl: jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://test.supabase.co/download' },
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({ error: null }),
  };
  const client = {
    storage: { from: jest.fn(() => storageFrom) },
  };
  return {
    __esModule: true,
    createClient: jest.fn(() => client),
  };
});

jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    incrby: jest.fn(),
    pexpire: jest.fn(),
    expire: jest.fn(),
    pttl: jest.fn(),
    hgetall: jest.fn(),
    hincrby: jest.fn(),
    status: 'ready',
  }));
  return { __esModule: true, default: Redis };
});

// Default fetch stub. Tests that exercise OpenAI / Vision / Identity Toolkit
// flows override this on a per-test basis.
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});
