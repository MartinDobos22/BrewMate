import { admin } from './firebase.js';

const SESSION_COOKIE_NAME = 'brewmate_session';

const getCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) {
    return null;
  }

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
};

const verifyFromRequest = async (req) => {
  const sessionCookie = getCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    const error = new Error('Missing session cookie.');
    error.status = 401;
    throw error;
  }

  return admin.auth().verifySessionCookie(sessionCookie, true);
};

// Verifies once per request and caches the result on the request object.
// Subsequent callers (rate limiter, route handler) reuse the same decoded
// token so we pay only one Firebase verify call per request.
const requireSession = async (req) => {
  if (req.__session) {
    return req.__session;
  }
  if (req.__sessionPromise) {
    return req.__sessionPromise;
  }
  req.__sessionPromise = verifyFromRequest(req)
    .then((decoded) => {
      req.__session = decoded;
      return decoded;
    })
    .catch((err) => {
      delete req.__sessionPromise;
      throw err;
    });
  return req.__sessionPromise;
};

// Best-effort variant for middleware (rate limiter, correlation tagging):
// resolves to the decoded token if a valid session cookie is present, or
// null for anonymous / invalid sessions. Never throws.
const tryAttachSession = async (req) => {
  try {
    return await requireSession(req);
  } catch {
    return null;
  }
};

export { SESSION_COOKIE_NAME, getCookieValue, requireSession, tryAttachSession };
