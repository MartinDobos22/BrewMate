import {
  getCookieValue,
  requireSession,
  tryAttachSession,
} from '../../server/session.js';
import { admin } from '../../server/firebase.js';

// firebase-admin is mocked globally in setup.js
const mockVerify = admin.auth().verifySessionCookie;

beforeEach(() => {
  mockVerify.mockReset();
});

// ---------------------------------------------------------------------------
// getCookieValue — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('getCookieValue', () => {
  it('extracts a named cookie from the header string', () => {
    expect(
      getCookieValue('brewmate_session=abc123; Path=/', 'brewmate_session'),
    ).toBe('abc123');
  });

  it('returns null when cookie name is not present', () => {
    expect(getCookieValue('other=xyz', 'brewmate_session')).toBeNull();
  });

  it('returns null for empty / missing header', () => {
    expect(getCookieValue(null, 'brewmate_session')).toBeNull();
    expect(getCookieValue('', 'brewmate_session')).toBeNull();
  });

  it('handles URL-encoded values', () => {
    const value = encodeURIComponent('hello world');
    expect(
      getCookieValue(`brewmate_session=${value}`, 'brewmate_session'),
    ).toBe('hello world');
  });

  it('handles multiple cookies and picks the correct one', () => {
    expect(
      getCookieValue('a=1; brewmate_session=tok; b=2', 'brewmate_session'),
    ).toBe('tok');
  });
});

// ---------------------------------------------------------------------------
// requireSession
// ---------------------------------------------------------------------------

describe('requireSession', () => {
  const makeReq = (cookie = null) => ({
    headers: { cookie },
  });

  it('returns decoded session when cookie is valid', async () => {
    const decoded = { uid: 'user-1', email: 'a@b.com' };
    mockVerify.mockResolvedValueOnce(decoded);

    const req = makeReq('brewmate_session=valid-token');
    const result = await requireSession(req);

    expect(result).toEqual(decoded);
    expect(req.__session).toEqual(decoded);
  });

  it('caches the result on req.__session — firebase called only once', async () => {
    const decoded = { uid: 'user-1' };
    mockVerify.mockResolvedValueOnce(decoded);

    const req = makeReq('brewmate_session=valid-token');
    await requireSession(req);
    await requireSession(req); // second call — should reuse cache

    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('throws when session cookie is missing', async () => {
    const req = makeReq(null);
    await expect(requireSession(req)).rejects.toThrow();
  });

  it('throws when firebase rejects the cookie', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Token expired'));
    const req = makeReq('brewmate_session=expired-token');
    await expect(requireSession(req)).rejects.toThrow('Token expired');
  });
});

// ---------------------------------------------------------------------------
// tryAttachSession
// ---------------------------------------------------------------------------

describe('tryAttachSession', () => {
  const makeReq = (cookie = null) => ({ headers: { cookie } });

  it('returns decoded session on success', async () => {
    const decoded = { uid: 'user-1' };
    mockVerify.mockResolvedValueOnce(decoded);

    const result = await tryAttachSession(makeReq('brewmate_session=valid'));
    expect(result).toEqual(decoded);
  });

  it('returns null instead of throwing on invalid cookie', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Invalid'));
    const result = await tryAttachSession(makeReq('brewmate_session=bad'));
    expect(result).toBeNull();
  });

  it('returns null when no cookie is present', async () => {
    const result = await tryAttachSession(makeReq(null));
    expect(result).toBeNull();
  });
});
