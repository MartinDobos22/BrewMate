import { Router } from 'express';

import { withUserContext } from '../db';
import { requireFirebaseAuth } from '../middleware/requireFirebaseAuth';

const router = Router();

const pickClaims = (claims: Record<string, unknown>) => {
  const allowed = ['sub', 'email', 'email_verified', 'auth_time', 'firebase', 'sign_in_provider'];
  return allowed.reduce<Record<string, unknown>>((acc, key) => {
    if (claims[key] !== undefined) {
      acc[key] = claims[key];
    }
    return acc;
  }, {});
};

router.post('/users/sync', requireFirebaseAuth, async (req, res) => {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const payload = {
    firebase_uid: firebaseUser.uid,
    email: firebaseUser.email ?? null,
    phone: firebaseUser.phone ?? null,
    display_name: firebaseUser.name ?? null,
    photo_url: firebaseUser.picture ?? null,
    provider: firebaseUser.provider ?? null,
    raw_claims: pickClaims(firebaseUser.claims),
  };

  try {
    const profile = await withUserContext(firebaseUser.uid, async (client) => {
      const result = await client.query(
        `INSERT INTO public.profiles
          (firebase_uid, email, phone, display_name, photo_url, provider, raw_claims, updated_at, last_sign_in_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
        ON CONFLICT (firebase_uid) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, public.profiles.email),
              phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
              display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
              photo_url = COALESCE(EXCLUDED.photo_url, public.profiles.photo_url),
              provider = COALESCE(EXCLUDED.provider, public.profiles.provider),
              raw_claims = CASE
                WHEN EXCLUDED.raw_claims IS NULL OR EXCLUDED.raw_claims = '{}'::jsonb
                  THEN public.profiles.raw_claims
                ELSE EXCLUDED.raw_claims
              END,
              updated_at = now(),
              last_sign_in_at = now()
        RETURNING *;`,
        [
          payload.firebase_uid,
          payload.email,
          payload.phone,
          payload.display_name,
          payload.photo_url,
          payload.provider,
          Object.keys(payload.raw_claims).length > 0 ? payload.raw_claims : null,
        ],
      );
      return result.rows[0];
    });

    return res.status(200).json({ profile });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Conflict while syncing profile.' });
    }
    console.error('Failed to sync profile', error);
    return res.status(500).json({ error: 'Failed to sync profile.' });
  }
});

router.get('/me', requireFirebaseAuth, async (req, res) => {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    const profile = await withUserContext(firebaseUser.uid, async (client) => {
      const result = await client.query('SELECT * FROM public.profiles WHERE firebase_uid = $1', [
        firebaseUser.uid,
      ]);
      return result.rows[0] ?? null;
    });

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Failed to fetch profile', error);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

router.patch('/me', requireFirebaseAuth, async (req, res) => {
  const firebaseUser = req.firebaseUser;
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const allowedFields = ['display_name', 'photo_url'];
  const updates = allowedFields.reduce<Record<string, unknown>>((acc, key) => {
    if (req.body?.[key] !== undefined) {
      acc[key] = req.body[key];
    }
    return acc;
  }, {});

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided.' });
  }

  const setClauses = Object.keys(updates)
    .map((key, index) => `${key} = $${index + 2}`)
    .join(', ');

  try {
    const profile = await withUserContext(firebaseUser.uid, async (client) => {
      const result = await client.query(
        `UPDATE public.profiles
         SET ${setClauses}, updated_at = now()
         WHERE firebase_uid = $1
         RETURNING *`,
        [firebaseUser.uid, ...Object.values(updates)],
      );
      return result.rows[0] ?? null;
    });

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Failed to update profile', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

export default router;
