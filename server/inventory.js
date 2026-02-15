import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';

const router = express.Router();

router.get('/api/user-coffee', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const statusFilter = req.query.status === 'all' ? 'all' : 'active';

    const result = await db.query(
      `SELECT id,
              raw_text,
              corrected_text,
              coffee_profile,
              ai_match_result,
              label_image_base64,
              loved,
              coalesce(status, 'active') as status,
              created_at
       FROM user_coffee
       WHERE user_id = $1
         AND ($2 = 'all' OR coalesce(status, 'active') = 'active')
       ORDER BY created_at DESC`,
      [session.uid, statusFilter],
    );

    return res.status(200).json({
      items: result.rows.map((row) => ({
        id: row.id,
        rawText: row.raw_text,
        correctedText: row.corrected_text,
        coffeeProfile: row.coffee_profile,
        aiMatchResult: row.ai_match_result,
        labelImageBase64: row.label_image_base64,
        loved: Boolean(row.loved),
        status: row.status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to load user inventory', error);
    return next(error);
  }
});

router.post('/api/user-coffee', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { rawText, correctedText, coffeeProfile, aiMatchResult, labelImageBase64 } = req.body || {};

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
      `INSERT INTO user_coffee (
          user_id,
          raw_text,
          corrected_text,
          coffee_profile,
          ai_match_result,
          label_image_base64,
          loved
        )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, false)
       RETURNING id`,
      [
        session.uid,
        typeof rawText === 'string' ? rawText : null,
        typeof correctedText === 'string' ? correctedText : null,
        JSON.stringify(coffeeProfile),
        aiMatchResult && typeof aiMatchResult === 'object' ? JSON.stringify(aiMatchResult) : null,
        typeof labelImageBase64 === 'string' ? labelImageBase64 : null,
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

router.patch('/api/user-coffee/:id', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { loved } = req.body || {};

    if (typeof loved !== 'boolean') {
      return res.status(400).json({ error: 'loved must be boolean.' });
    }

    const result = await db.query(
      `UPDATE user_coffee
       SET loved = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, session.uid, loved],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(200).json({ id, loved });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to update coffee', error);
    return next(error);
  }
});

router.post('/api/user-coffee/:id/mark-empty', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;

    const result = await db.query(
      `UPDATE user_coffee
       SET status = 'empty'
       WHERE id = $1 AND user_id = $2
       RETURNING id, status`,
      [id, session.uid],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(200).json({
      id: result.rows[0].id,
      status: result.rows[0].status,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to mark coffee as empty', error);
    return next(error);
  }
});

router.post('/api/user-coffee/:id/archive', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;

    const result = await db.query(
      `UPDATE user_coffee
       SET status = 'archived'
       WHERE id = $1 AND user_id = $2
       RETURNING id, status`,
      [id, session.uid],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(200).json({
      id: result.rows[0].id,
      status: result.rows[0].status,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to archive coffee', error);
    return next(error);
  }
});

router.delete('/api/user-coffee/:id/delete-permanently', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM user_coffee
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, session.uid],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(204).send();
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to permanently delete coffee', error);
    return next(error);
  }
});

router.post('/api/user-questionnaire', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { answers, profile, tasteProfile } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ error: 'answers are required.' });
    }

    if (!profile || typeof profile !== 'object') {
      return res.status(400).json({ error: 'profile is required.' });
    }

    const resolvedTasteProfile =
      tasteProfile && typeof tasteProfile === 'object' ? tasteProfile : profile.tasteVector;

    if (!resolvedTasteProfile || typeof resolvedTasteProfile !== 'object') {
      return res.status(400).json({ error: 'tasteProfile is required.' });
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      console.error('[UserQuestionnaire] Failed to ensure user in DB', dbError);
      return res.status(500).json({
        error: 'Nepodarilo sa uložiť používateľa do databázy.',
      });
    }

    const insertResult = await db.query(
      `INSERT INTO user_questionnaires (user_id, answers, questionnaire_profile, taste_profile)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb)
       RETURNING id`,
      [
        session.uid,
        JSON.stringify(answers),
        JSON.stringify(profile),
        JSON.stringify(resolvedTasteProfile),
      ],
    );

    return res.status(201).json({
      id: insertResult.rows?.[0]?.id ?? null,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserQuestionnaire] Unexpected error', error);
    return next(error);
  }
});

export default router;
