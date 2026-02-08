import express from 'express';

import { admin } from './firebase.js';
import { ensureAppUserExists } from './db.js';
import { SESSION_COOKIE_NAME, getCookieValue } from './session.js';

const router = express.Router();

const PASSWORD_MIN_LENGTH = 6;
const SESSION_COOKIE_EXPIRES_IN = 1000 * 60 * 60 * 24 * 5;

const getFirebaseErrorMessage = (error) => {
  switch (error?.code) {
    case 'auth/email-already-exists':
      return 'Email už existuje.';
    case 'auth/invalid-email':
      return 'Email je neplatný.';
    case 'auth/invalid-password':
      return 'Heslo musí mať aspoň 6 znakov.';
    case 'auth/user-not-found':
      return 'Používateľ neexistuje.';
    default:
      return 'Operácia zlyhala.';
  }
};

const mapIdentityErrorMessage = (identityMessage) => {
  switch (identityMessage) {
    case 'INVALID_PASSWORD':
      return 'Nesprávne heslo.';
    case 'EMAIL_NOT_FOUND':
      return 'Používateľ neexistuje.';
    case 'USER_DISABLED':
      return 'Účet je deaktivovaný.';
    default:
      return 'Prihlásenie zlyhalo.';
  }
};

const verifyPassword = async (email, password) => {
  const apiKey = process.env.FIREBASE_API_KEY?.trim()
    || process.env.FIREBASE_WEB_API_KEY?.trim()
    || process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim();
  if (!apiKey) {
    const error = new Error('Missing FIREBASE_API_KEY.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    },
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = mapIdentityErrorMessage(data?.error?.message);
    const error = new Error(message);
    error.status = 401;
    throw error;
  }

  return data;
};

const createSessionForIdToken = async (idToken) => {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  const sessionCookie = await admin.auth().createSessionCookie(idToken, {
    expiresIn: SESSION_COOKIE_EXPIRES_IN,
  });

  return {
    uid: decodedToken.uid,
    sessionCookie,
  };
};

const getSessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: SESSION_COOKIE_EXPIRES_IN,
});

const setSessionCookie = (res, sessionCookie) => {
  res.cookie(SESSION_COOKIE_NAME, sessionCookie, getSessionCookieOptions());
};

const clearSessionCookie = (res) => {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
};

const mapUserRecord = (userRecord) => ({
  id: userRecord.uid,
  email: userRecord.email || '',
  name: userRecord.displayName || null,
});

const ensureSupabaseClaims = async (userRecord) => {
  if (!userRecord?.uid) {
    return;
  }

  const existingClaims = userRecord.customClaims || {};

  if (existingClaims.role === 'authenticated') {
    return;
  }

  await admin.auth().setCustomUserClaims(userRecord.uid, {
    ...existingClaims,
    role: 'authenticated',
    firebase_uid: userRecord.uid,
  });
};

const syncSupabaseUser = async (userRecord) => {
  await ensureSupabaseClaims(userRecord);
  await ensureAppUserExists(userRecord.uid, userRecord.email, {
    name: userRecord.displayName,
  });
};

router.post('/auth/register', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!email) {
      return res.status(400).json({ error: 'Zadaj email.' });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: 'Heslo musí mať aspoň 6 znakov.' });
    }

    const userRecord = await admin.auth().createUser({
      email,
      password,
    });
    try {
      await syncSupabaseUser(userRecord);
    } catch (syncError) {
      console.error('[Auth] Failed to sync new user', syncError);
      return res.status(500).json({
        error: 'Nepodarilo sa synchronizovať používateľa do databázy.',
      });
    }

    let sessionCreated = false;

    try {
      const authData = await verifyPassword(email, password);
      const session = await createSessionForIdToken(authData.idToken);
      setSessionCookie(res, session.sessionCookie);
      sessionCreated = true;
    } catch (sessionError) {
      console.warn('Failed to create session after registration.', sessionError);
    }

    return res.status(201).json({
      user: mapUserRecord(userRecord),
      sessionCreated,
    });
  } catch (error) {
    const message = getFirebaseErrorMessage(error);
    return res.status(400).json({ error: message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!email) {
      return res.status(400).json({ error: 'Zadaj email.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Zadaj heslo.' });
    }

    const authData = await verifyPassword(email, password);

    const userRecord = await admin.auth().getUserByEmail(email);
    try {
      await syncSupabaseUser(userRecord);
    } catch (syncError) {
      console.error('[Auth] Failed to sync user on login', syncError);
      return res.status(500).json({
        error: 'Nepodarilo sa synchronizovať používateľa do databázy.',
      });
    }
    const session = await createSessionForIdToken(authData.idToken);
    setSessionCookie(res, session.sessionCookie);

    return res.status(200).json({
      user: mapUserRecord(userRecord),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }

    const message = getFirebaseErrorMessage(error);
    return res.status(400).json({ error: message });
  }
});

router.post('/auth/google', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken ?? '').trim();

    if (!idToken) {
      return res.status(400).json({ error: 'Chýba Google token.' });
    }

    const session = await createSessionForIdToken(idToken);
    const userRecord = await admin.auth().getUser(session.uid);
    try {
      await syncSupabaseUser(userRecord);
    } catch (syncError) {
      console.error('[Auth] Failed to sync Google user', syncError);
      return res.status(500).json({
        error: 'Nepodarilo sa synchronizovať používateľa do databázy.',
      });
    }
    setSessionCookie(res, session.sessionCookie);
    return res.status(200).json({ user: mapUserRecord(userRecord) });
  } catch (error) {
    const message = error?.message || 'Google prihlásenie zlyhalo.';
    return res.status(401).json({ error: message });
  }
});

router.post('/auth/apple', async (req, res) => {
  try {
    const idToken = String(req.body?.idToken ?? '').trim();

    if (!idToken) {
      return res.status(400).json({ error: 'Chýba Apple token.' });
    }

    const session = await createSessionForIdToken(idToken);
    const userRecord = await admin.auth().getUser(session.uid);
    try {
      await syncSupabaseUser(userRecord);
    } catch (syncError) {
      console.error('[Auth] Failed to sync Apple user', syncError);
      return res.status(500).json({
        error: 'Nepodarilo sa synchronizovať používateľa do databázy.',
      });
    }
    setSessionCookie(res, session.sessionCookie);
    return res.status(200).json({ user: mapUserRecord(userRecord) });
  } catch (error) {
    const message = error?.message || 'Apple prihlásenie zlyhalo.';
    return res.status(401).json({ error: message });
  }
});

router.get('/auth/me', async (req, res) => {
  try {
    const sessionCookie = getCookieValue(req.headers.cookie, SESSION_COOKIE_NAME);

    if (!sessionCookie) {
      return res.status(204).send();
    }

    const decodedToken = await admin.auth().verifySessionCookie(sessionCookie, true);
    const userRecord = await admin.auth().getUser(decodedToken.uid);

    return res.status(200).json({ user: mapUserRecord(userRecord) });
  } catch (error) {
    clearSessionCookie(res);
    return res.status(204).send();
  }
});

router.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  return res.status(204).send();
});

export default router;
