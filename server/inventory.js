import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';

const router = express.Router();

const COFFEE_STATUSES = new Set(['active', 'empty', 'archived']);
const TRACKING_MODES = new Set(['manual', 'estimated']);
const BREW_METHODS = new Set(['espresso', 'filter', 'other']);
const CONSUMPTION_SOURCES = new Set([
  'quick_action',
  'custom',
  'slider',
  'recipe_log',
  'adjustment',
]);

const toPositiveInteger = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const toNonNegativeInteger = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
};

const mapCoffeeRow = (row) => ({
  id: row.id,
  rawText: row.raw_text,
  correctedText: row.corrected_text,
  coffeeProfile: row.coffee_profile,
  aiMatchResult: row.ai_match_result,
  labelImageBase64: row.label_image_base64,
  loved: Boolean(row.loved),
  packageSizeG: row.package_size_g,
  remainingG: row.remaining_g,
  openedAt: row.opened_at,
  status: row.status,
  trackingMode: row.tracking_mode,
  preferredDoseG: row.preferred_dose_g,
  brewMethodDefault: row.brew_method_default,
  lastConsumedAt: row.last_consumed_at,
  createdAt: row.created_at,
});

router.get('/api/user-coffee', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const includeInactive = req.query.includeInactive === 'true';

    const result = await db.query(
      `SELECT id,
              raw_text,
              corrected_text,
              coffee_profile,
              ai_match_result,
              label_image_base64,
              loved,
              package_size_g,
              remaining_g,
              opened_at,
              status,
              tracking_mode,
              preferred_dose_g,
              brew_method_default,
              last_consumed_at,
              created_at
       FROM user_coffee
       WHERE user_id = $1
         AND ($2::boolean = true OR status = 'active')
       ORDER BY created_at DESC`,
      [session.uid, includeInactive],
    );

    return res.status(200).json({
      items: result.rows.map(mapCoffeeRow),
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
    const {
      rawText,
      correctedText,
      coffeeProfile,
      aiMatchResult,
      labelImageBase64,
      packageSizeG,
      remainingG,
      openedAt,
      status,
      trackingMode,
      preferredDoseG,
      brewMethodDefault,
    } = req.body || {};

    if (!coffeeProfile || typeof coffeeProfile !== 'object') {
      return res.status(400).json({ error: 'coffeeProfile is required.' });
    }

    const normalizedPackageSize =
      packageSizeG === null || typeof packageSizeG === 'undefined'
        ? null
        : toPositiveInteger(packageSizeG);
    if (
      typeof packageSizeG !== 'undefined'
      && packageSizeG !== null
      && normalizedPackageSize === null
    ) {
      return res.status(400).json({ error: 'packageSizeG must be positive integer.' });
    }

    const normalizedRemaining =
      remainingG === null || typeof remainingG === 'undefined'
        ? null
        : toNonNegativeInteger(remainingG);
    if (
      typeof remainingG !== 'undefined'
      && remainingG !== null
      && normalizedRemaining === null
    ) {
      return res.status(400).json({ error: 'remainingG must be non-negative integer.' });
    }

    const normalizedPreferredDose =
      preferredDoseG === null || typeof preferredDoseG === 'undefined'
        ? null
        : toPositiveInteger(preferredDoseG);
    if (
      typeof preferredDoseG !== 'undefined'
      && preferredDoseG !== null
      && normalizedPreferredDose === null
    ) {
      return res.status(400).json({ error: 'preferredDoseG must be positive integer.' });
    }

    const resolvedStatus =
      typeof status === 'string' && COFFEE_STATUSES.has(status)
        ? status
        : 'active';
    if (typeof status === 'string' && !COFFEE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'status has unsupported value.' });
    }

    const resolvedTrackingMode =
      typeof trackingMode === 'string' && TRACKING_MODES.has(trackingMode)
        ? trackingMode
        : (normalizedPackageSize ? 'manual' : 'estimated');
    if (typeof trackingMode === 'string' && !TRACKING_MODES.has(trackingMode)) {
      return res.status(400).json({ error: 'trackingMode has unsupported value.' });
    }

    const resolvedBrewMethodDefault =
      typeof brewMethodDefault === 'string' && BREW_METHODS.has(brewMethodDefault)
        ? brewMethodDefault
        : null;
    if (
      typeof brewMethodDefault !== 'undefined'
      && brewMethodDefault !== null
      && !resolvedBrewMethodDefault
    ) {
      return res.status(400).json({ error: 'brewMethodDefault has unsupported value.' });
    }

    const normalizedOpenedAt =
      typeof openedAt === 'string' && openedAt.trim().length > 0 ? openedAt : null;

    const resolvedRemaining =
      normalizedRemaining
      ?? (normalizedPackageSize !== null ? normalizedPackageSize : null);

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
          loved,
          package_size_g,
          remaining_g,
          opened_at,
          status,
          tracking_mode,
          preferred_dose_g,
          brew_method_default
        )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, false, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id,
                 raw_text,
                 corrected_text,
                 coffee_profile,
                 ai_match_result,
                 label_image_base64,
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at`,
      [
        session.uid,
        typeof rawText === 'string' ? rawText : null,
        typeof correctedText === 'string' ? correctedText : null,
        JSON.stringify(coffeeProfile),
        aiMatchResult && typeof aiMatchResult === 'object' ? JSON.stringify(aiMatchResult) : null,
        typeof labelImageBase64 === 'string' ? labelImageBase64 : null,
        normalizedPackageSize,
        resolvedRemaining,
        normalizedOpenedAt,
        resolvedStatus,
        resolvedTrackingMode,
        normalizedPreferredDose,
        resolvedBrewMethodDefault,
      ],
    );

    return res.status(201).json({
      item: mapCoffeeRow(insertResult.rows[0]),
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

router.patch('/api/user-coffee/:id/consume', async (req, res, next) => {
  const client = await db.connect();

  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { consumedG, brewMethod, source, preferredDoseG } = req.body || {};

    const normalizedConsumed = toPositiveInteger(consumedG);
    if (!normalizedConsumed) {
      return res.status(400).json({ error: 'consumedG must be positive integer.' });
    }

    if (brewMethod && !BREW_METHODS.has(brewMethod)) {
      return res.status(400).json({ error: 'brewMethod has unsupported value.' });
    }

    if (source && !CONSUMPTION_SOURCES.has(source)) {
      return res.status(400).json({ error: 'source has unsupported value.' });
    }

    const normalizedPreferredDose =
      preferredDoseG === null || typeof preferredDoseG === 'undefined'
        ? null
        : toPositiveInteger(preferredDoseG);
    if (
      typeof preferredDoseG !== 'undefined'
      && preferredDoseG !== null
      && normalizedPreferredDose === null
    ) {
      return res.status(400).json({ error: 'preferredDoseG must be positive integer.' });
    }

    await client.query('BEGIN');

    const selectResult = await client.query(
      `SELECT id, remaining_g
       FROM user_coffee
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [id, session.uid],
    );

    if (!selectResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    const item = selectResult.rows[0];
    const currentRemaining = typeof item.remaining_g === 'number' ? item.remaining_g : 0;
    const nextRemaining = Math.max(0, currentRemaining - normalizedConsumed);
    const nextStatus = nextRemaining === 0 ? 'empty' : 'active';

    const updateResult = await client.query(
      `UPDATE user_coffee
       SET remaining_g = $3,
           status = $4,
           tracking_mode = 'manual',
           brew_method_default = COALESCE($5, brew_method_default),
           preferred_dose_g = COALESCE($6, preferred_dose_g),
           last_consumed_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id,
                 raw_text,
                 corrected_text,
                 coffee_profile,
                 ai_match_result,
                 label_image_base64,
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at`,
      [
        id,
        session.uid,
        nextRemaining,
        nextStatus,
        brewMethod ?? null,
        normalizedPreferredDose,
      ],
    );

    await client.query(
      `INSERT INTO user_coffee_consumption_events (
         user_coffee_id,
         user_id,
         consumed_g,
         brew_method,
         source
       )
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        session.uid,
        normalizedConsumed,
        brewMethod ?? null,
        source ?? 'custom',
      ],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      item: mapCoffeeRow(updateResult.rows[0]),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to consume coffee grams', error);
    return next(error);
  } finally {
    client.release();
  }
});

router.patch('/api/user-coffee/:id/remaining', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { remainingG, source } = req.body || {};

    const normalizedRemaining = toNonNegativeInteger(remainingG);
    if (normalizedRemaining === null) {
      return res.status(400).json({ error: 'remainingG must be non-negative integer.' });
    }

    if (source && !CONSUMPTION_SOURCES.has(source)) {
      return res.status(400).json({ error: 'source has unsupported value.' });
    }

    const result = await db.query(
      `UPDATE user_coffee
       SET remaining_g = $3,
           status = CASE WHEN $3 = 0 THEN 'empty' ELSE status END,
           tracking_mode = 'manual',
           last_consumed_at = now()
       WHERE id = $1 AND user_id = $2
       RETURNING id,
                 raw_text,
                 corrected_text,
                 coffee_profile,
                 ai_match_result,
                 label_image_base64,
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at`,
      [id, session.uid, normalizedRemaining],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(200).json({
      item: mapCoffeeRow(result.rows[0]),
      source: source ?? 'slider',
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to update remaining grams', error);
    return next(error);
  }
});

router.patch('/api/user-coffee/:id/status', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { status } = req.body || {};

    if (typeof status !== 'string' || !COFFEE_STATUSES.has(status)) {
      return res.status(400).json({ error: 'status has unsupported value.' });
    }

    const result = await db.query(
      `UPDATE user_coffee
       SET status = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id,
                 raw_text,
                 corrected_text,
                 coffee_profile,
                 ai_match_result,
                 label_image_base64,
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at`,
      [id, session.uid, status],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Káva nebola nájdená.' });
    }

    return res.status(200).json({
      item: mapCoffeeRow(result.rows[0]),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[UserCoffee] Failed to update status', error);
    return next(error);
  }
});

router.delete('/api/user-coffee/:id', async (req, res, next) => {
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
    console.error('[UserCoffee] Failed to delete coffee', error);
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
