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

const requireSession = async (req) => {
  const sessionCookie = getCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    const error = new Error('Missing session cookie.');
    error.status = 401;
    throw error;
  }

  return admin.auth().verifySessionCookie(sessionCookie, true);
};

export { SESSION_COOKIE_NAME, getCookieValue, requireSession };
