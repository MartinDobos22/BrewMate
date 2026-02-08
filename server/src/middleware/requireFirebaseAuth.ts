import type { NextFunction, Request, Response } from 'express';

import { firebaseAdmin, firebaseProjectId } from '../firebaseAdmin';

type FirebaseUser = {
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
  picture?: string;
  provider?: string;
  claims: Record<string, unknown>;
};

const getBearerToken = (req: Request) => {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
};

export const requireFirebaseAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token.' });
  }

  try {
    const decoded = await firebaseAdmin.auth().verifyIdToken(token, true);

    if (decoded.aud !== firebaseProjectId) {
      return res.status(403).json({ error: 'Invalid token audience.' });
    }

    const expectedIssuer = `https://securetoken.google.com/${firebaseProjectId}`;
    if (decoded.iss !== expectedIssuer) {
      return res.status(403).json({ error: 'Invalid token issuer.' });
    }

    const firebaseUser: FirebaseUser = {
      uid: decoded.uid,
      email: decoded.email,
      phone: decoded.phone_number,
      name: decoded.name,
      picture: decoded.picture,
      provider: decoded.firebase?.sign_in_provider,
      claims: decoded,
    };

    req.firebaseUser = firebaseUser;
    return next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or revoked Firebase token.' });
  }
};

declare global {
  namespace Express {
    interface Request {
      firebaseUser?: FirebaseUser;
    }
  }
}
