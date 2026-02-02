import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';

const router = express.Router();

router.post('/api/user-coffee', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { rawText, correctedText, coffeeProfile } = req.body || {};

    if (!coffeeProfile || typeof coffeeProfile !== 'object') {
      return res.status(400).json({ error: 'coffeeProfile is required.' });
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      console.error('[UserCoffee] Failed to ensure user in DB', dbError);
      return res.status(500).json({
        error: 'Nepodarilo sa uložiť používateľa do databázy.',
      });
    }

    const insertResult = await db.query(
      `INSERT INTO user_coffee (user_id, raw_text, corrected_text, coffee_profile)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [
        session.uid,
        typeof rawText === 'string' ? rawText : null,
        typeof correctedText === 'string' ? correctedText : null,
        JSON.stringify(coffeeProfile),
      ],
    );

    return res.status(201).json({
      id: insertResult.rows?.[0]?.id ?? null,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Unexpected error', error);
    return next(error);
  }
});

export default router;
