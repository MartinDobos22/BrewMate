import { Router } from 'express';

import { config } from '../config';
import { withUserContext } from '../db';

const router = Router();

const requireInternalSecret = (req: any, res: any, next: any) => {
  const secret = req.header('X-Internal-Secret');
  if (!config.internalSharedSecret || secret !== config.internalSharedSecret) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  return next();
};

router.post('/firebase/onCreate', requireInternalSecret, async (req, res) => {
  const { uid, email, phone_number, displayName, photoURL, provider, claims } = req.body ?? {};
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid.' });
  }

  try {
    const profile = await withUserContext(uid, async (client) => {
      const result = await client.query(
        `INSERT INTO public.profiles
          (firebase_uid, email, phone, display_name, photo_url, provider, raw_claims, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        ON CONFLICT (firebase_uid) DO UPDATE
          SET email = COALESCE(EXCLUDED.email, public.profiles.email),
              phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
              display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
              photo_url = COALESCE(EXCLUDED.photo_url, public.profiles.photo_url),
              provider = COALESCE(EXCLUDED.provider, public.profiles.provider),
              raw_claims = COALESCE(EXCLUDED.raw_claims, public.profiles.raw_claims),
              updated_at = now()
        RETURNING *;`,
        [uid, email ?? null, phone_number ?? null, displayName ?? null, photoURL ?? null, provider ?? null, claims ?? null],
      );
      return result.rows[0];
    });

    return res.status(200).json({ profile });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Conflict while creating profile.' });
    }
    console.error('Failed to process onCreate', error);
    return res.status(500).json({ error: 'Failed to process onCreate.' });
  }
});

router.post('/firebase/onDelete', requireInternalSecret, async (req, res) => {
  const { uid } = req.body ?? {};
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid.' });
  }

  try {
    const profile = await withUserContext(uid, async (client) => {
      const result = await client.query(
        `UPDATE public.profiles
         SET deleted_at = now(), updated_at = now()
         WHERE firebase_uid = $1
         RETURNING *;`,
        [uid],
      );
      return result.rows[0] ?? null;
    });

    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Failed to process onDelete', error);
    return res.status(500).json({ error: 'Failed to process onDelete.' });
  }
});

export default router;
