import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';

const router = express.Router();

const COFFEE_STATUSES = new Set(['active', 'empty', 'archived']);
const TRACKING_MODES = new Set(['manual', 'estimated']);
const BREW_METHODS = new Set(['espresso', 'filter', 'other']);
const JOURNAL_BREW_METHODS = new Set([
  'espresso',
  'v60',
  'aeropress',
  'french_press',
  'moka',
  'cold_brew',
  'other',
]);
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

const toRatingInteger = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) {
      return parsed;
    }
  }
  return null;
};

const mapJournalRow = (row) => ({
  id: row.id,
  userCoffeeId: row.user_coffee_id,
  method: row.brew_method,
  doseG: row.dose_g,
  brewTimeSeconds: row.brew_time_seconds,
  tasteRating: row.taste_rating,
  notes: row.notes,
  createdAt: row.created_at,
  coffeeName: row.coffee_name,
  origin: row.origin,
  roastLevel: row.roast_level,
});

const buildLocalSummary = ({ days, totals }) => {
  if (!totals.logsCount) {
    return `Za posledných ${days} dní zatiaľ nemáš žiadny záznam prípravy.`;
  }

  const topMethod = totals.methods[0];
  const topOrigin = totals.origins[0];
  const topRoast = totals.roasts[0];
  const bestRatedMethod = totals.bestRatedMethods[0];

  const parts = [
    `Za posledných ${days} dní si zalogoval(a) ${totals.logsCount} príprav.`,
    topMethod ? `Najčastejšie pripravuješ metódou ${topMethod.label} (${topMethod.count}x).` : null,
    bestRatedMethod
      ? `Najlepší priemer hodnotenia má ${bestRatedMethod.label} (${bestRatedMethod.avgRating.toFixed(1)}/5).`
      : null,
    topOrigin ? `Najviac ti chutia kávy z pôvodu ${topOrigin.label}.` : null,
    topRoast ? `Preferované praženie: ${topRoast.label}.` : null,
  ].filter(Boolean);

  return parts.join(' ');
};

const RECIPE_APPROVAL_THRESHOLD = 70;

const mapSavedRecipeRow = (row) => ({
  id: row.id,
  title: row.title,
  method: row.method,
  strengthPreference: row.strength_preference,
  dose: row.dose,
  water: row.water,
  totalTime: row.total_time,
  tasteProfile: row.taste_profile,
  flavorNotes: Array.isArray(row.flavor_notes) ? row.flavor_notes : [],
  likeScore: row.like_score,
  approved: Boolean(row.approved),
  createdAt: row.created_at,
});

const buildRecipeInsightsSummary = ({ days, totals }) => {
  if (!totals.recipesCount) {
    return `Za posledných ${days} dní zatiaľ nemáš uložený žiadny schválený recept.`;
  }

  const topMethod = totals.methods[0];
  const topStrength = totals.strengths[0];
  const topTaste = totals.tasteProfiles[0];

  const parts = [
    `Za posledných ${days} dní máš uložených ${totals.recipesCount} receptov, ktoré majú chutiť.`,
    topMethod ? `Najčastejšie volíš metódu ${topMethod.label} (${topMethod.count}x).` : null,
    topStrength ? `Najviac ti sedí sila ${topStrength.label}.` : null,
    topTaste ? `Preferovaný chuťový profil: ${topTaste.label}.` : null,
  ].filter(Boolean);

  return parts.join(' ');
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

router.get('/api/coffee-journal', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const days = Math.min(toPositiveInteger(req.query.days) ?? 30, 90);

    const result = await db.query(
      `SELECT logs.id,
              logs.user_coffee_id,
              logs.brew_method,
              logs.dose_g,
              logs.brew_time_seconds,
              logs.taste_rating,
              logs.notes,
              logs.created_at,
              coalesce(coffee.corrected_text, coffee.raw_text, 'Neznáma káva') as coffee_name,
              coalesce(coffee.coffee_profile->>'origin', 'Neznámy pôvod') as origin,
              coalesce(coffee.coffee_profile->>'roastLevel', 'Neznáme praženie') as roast_level
       FROM user_coffee_brew_logs logs
       LEFT JOIN user_coffee coffee ON coffee.id = logs.user_coffee_id
       WHERE logs.user_id = $1
         AND logs.created_at >= now() - ($2::int || ' days')::interval
       ORDER BY logs.created_at DESC`,
      [session.uid, days],
    );

    return res.status(200).json({
      items: result.rows.map(mapJournalRow),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeJournal] Failed to load brew logs', error);
    return next(error);
  }
});

router.post('/api/coffee-journal', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const {
      userCoffeeId,
      method,
      doseG,
      brewTimeSeconds,
      tasteRating,
      notes,
    } = req.body || {};

    if (typeof method !== 'string' || !JOURNAL_BREW_METHODS.has(method)) {
      return res.status(400).json({ error: 'method has unsupported value.' });
    }

    const normalizedDose = toPositiveInteger(doseG);
    if (!normalizedDose) {
      return res.status(400).json({ error: 'doseG must be positive integer.' });
    }

    const normalizedBrewTime = toPositiveInteger(brewTimeSeconds);
    if (!normalizedBrewTime) {
      return res.status(400).json({ error: 'brewTimeSeconds must be positive integer.' });
    }

    const normalizedRating = toRatingInteger(tasteRating);
    if (!normalizedRating) {
      return res.status(400).json({ error: 'tasteRating must be integer between 1 and 5.' });
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      console.error('[CoffeeJournal] Failed to ensure user in DB', dbError);
      return res.status(500).json({
        error: 'Nepodarilo sa uložiť používateľa do databázy.',
      });
    }

    const insertResult = await db.query(
      `INSERT INTO user_coffee_brew_logs (
         user_id,
         user_coffee_id,
         brew_method,
         dose_g,
         brew_time_seconds,
         taste_rating,
         notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id,
                 user_coffee_id,
                 brew_method,
                 dose_g,
                 brew_time_seconds,
                 taste_rating,
                 notes,
                 created_at,
                 'Neznáma káva' as coffee_name,
                 'Neznámy pôvod' as origin,
                 'Neznáme praženie' as roast_level`,
      [
        session.uid,
        typeof userCoffeeId === 'string' && userCoffeeId.trim().length > 0 ? userCoffeeId : null,
        method,
        normalizedDose,
        normalizedBrewTime,
        normalizedRating,
        typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null,
      ],
    );

    return res.status(201).json({
      item: mapJournalRow(insertResult.rows[0]),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeJournal] Failed to create brew log', error);
    return next(error);
  }
});

router.get('/api/coffee-journal/insights', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const days = Math.min(toPositiveInteger(req.query.days) ?? 30, 90);

    const logsResult = await db.query(
      `SELECT logs.brew_method,
              logs.taste_rating,
              coalesce(coffee.coffee_profile->>'origin', 'Neznámy pôvod') as origin,
              coalesce(coffee.coffee_profile->>'roastLevel', 'Neznáme praženie') as roast_level
       FROM user_coffee_brew_logs logs
       LEFT JOIN user_coffee coffee ON coffee.id = logs.user_coffee_id
       WHERE logs.user_id = $1
         AND logs.created_at >= now() - ($2::int || ' days')::interval`,
      [session.uid, days],
    );

    const aggregate = (rows, key) => Object.entries(
      rows.reduce((acc, row) => {
        const label = row[key] || 'Neznáme';
        const item = acc[label] || { label, count: 0, ratingSum: 0 };
        item.count += 1;
        item.ratingSum += Number(row.taste_rating) || 0;
        acc[label] = item;
        return acc;
      }, {}),
    )
      .map(([, value]) => ({
        label: value.label,
        count: value.count,
        avgRating: value.count ? value.ratingSum / value.count : 0,
      }))
      .sort((a, b) => b.count - a.count || b.avgRating - a.avgRating)
      .slice(0, 5);

    const methods = aggregate(logsResult.rows, 'brew_method');
    const origins = aggregate(logsResult.rows, 'origin');
    const roasts = aggregate(logsResult.rows, 'roast_level');
    const bestRatedMethods = [...methods]
      .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count)
      .slice(0, 3);

    const totals = {
      logsCount: logsResult.rows.length,
      methods,
      origins,
      roasts,
      bestRatedMethods,
    };

    let aiSummary = buildLocalSummary({ days, totals });
    const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

    if (openAiApiKey && totals.logsCount > 0) {
      try {
        const prompt = {
          days,
          logsCount: totals.logsCount,
          methods,
          origins,
          roasts,
          bestRatedMethods,
        };

        const completion = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'Si coffee coach. Napis stručné 2 vety po slovensky o tom, čo používateľ obľubuje podľa dát. Nepoužívaj markdown.',
              },
              {
                role: 'user',
                content: `Vygeneruj sumár z dát: ${JSON.stringify(prompt)}`,
              },
            ],
          }),
        });

        if (completion.ok) {
          const payload = await completion.json();
          const summary = payload?.choices?.[0]?.message?.content;
          if (typeof summary === 'string' && summary.trim().length > 0) {
            aiSummary = summary.trim();
          }
        }
      } catch (aiError) {
        console.warn('[CoffeeJournal] Falling back to local summary', aiError);
      }
    }

    return res.status(200).json({
      days,
      totals,
      aiSummary,
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeJournal] Failed to load insights', error);
    return next(error);
  }
});


router.get('/api/coffee-recipes', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const days = Math.min(toPositiveInteger(req.query.days) ?? 30, 90);

    const result = await db.query(
      `SELECT id,
              coalesce(recipe->>'title', 'Recipe') as title,
              coalesce(recipe->>'method', selected_preparation, 'unknown') as method,
              coalesce(strength_preference, recipe->>'strengthPreference', 'neuvedené') as strength_preference,
              coalesce(recipe->>'dose', '-') as dose,
              coalesce(recipe->>'water', '-') as water,
              coalesce(recipe->>'totalTime', '-') as total_time,
              coalesce(analysis->>'tasteProfile', 'Neznámy profil') as taste_profile,
              coalesce((analysis->'flavorNotes')::jsonb, '[]'::jsonb) as flavor_notes,
              like_score,
              approved,
              created_at
       FROM user_saved_coffee_recipes
       WHERE user_id = $1
         AND approved = true
         AND created_at >= now() - ($2::int || ' days')::interval
       ORDER BY created_at DESC`,
      [session.uid, days],
    );

    return res.status(200).json({ items: result.rows.map(mapSavedRecipeRow) });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeRecipes] Failed to load recipes', error);
    return next(error);
  }
});

router.post('/api/coffee-recipes', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { analysis, recipe, selectedPreparation, strengthPreference, likeScore, approved } = req.body || {};

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({ error: 'analysis is required.' });
    }
    if (!recipe || typeof recipe !== 'object') {
      return res.status(400).json({ error: 'recipe is required.' });
    }

    const normalizedLikeScore = toNonNegativeInteger(likeScore);
    if (normalizedLikeScore === null || normalizedLikeScore > 100) {
      return res.status(400).json({ error: 'likeScore must be integer between 0 and 100.' });
    }

    if (normalizedLikeScore < RECIPE_APPROVAL_THRESHOLD) {
      return res.status(400).json({ error: `Recipe can be saved only if likeScore is at least ${RECIPE_APPROVAL_THRESHOLD}.` });
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      console.error('[CoffeeRecipes] Failed to ensure user in DB', dbError);
      return res.status(500).json({ error: 'Nepodarilo sa uložiť používateľa do databázy.' });
    }

    const insertResult = await db.query(
      `INSERT INTO user_saved_coffee_recipes (
         user_id, analysis, recipe, selected_preparation, strength_preference, like_score, approved
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7)
       RETURNING id,
                 coalesce(recipe->>'title', 'Recipe') as title,
                 coalesce(recipe->>'method', selected_preparation, 'unknown') as method,
                 coalesce(strength_preference, recipe->>'strengthPreference', 'neuvedené') as strength_preference,
                 coalesce(recipe->>'dose', '-') as dose,
                 coalesce(recipe->>'water', '-') as water,
                 coalesce(recipe->>'totalTime', '-') as total_time,
                 coalesce(analysis->>'tasteProfile', 'Neznámy profil') as taste_profile,
                 coalesce((analysis->'flavorNotes')::jsonb, '[]'::jsonb) as flavor_notes,
                 like_score,
                 approved,
                 created_at`,
      [
        session.uid,
        JSON.stringify(analysis),
        JSON.stringify(recipe),
        typeof selectedPreparation === 'string' ? selectedPreparation : null,
        typeof strengthPreference === 'string' ? strengthPreference : null,
        normalizedLikeScore,
        approved !== false,
      ],
    );

    return res.status(201).json({ item: mapSavedRecipeRow(insertResult.rows[0]) });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeRecipes] Failed to save recipe', error);
    return next(error);
  }
});

router.get('/api/coffee-recipes/insights', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const days = Math.min(toPositiveInteger(req.query.days) ?? 30, 90);

    const rowsResult = await db.query(
      `SELECT coalesce(recipe->>'method', selected_preparation, 'unknown') as method,
              coalesce(strength_preference, recipe->>'strengthPreference', 'neuvedené') as strength_preference,
              coalesce(analysis->>'tasteProfile', 'Neznámy profil') as taste_profile,
              like_score
       FROM user_saved_coffee_recipes
       WHERE user_id = $1
         AND approved = true
         AND created_at >= now() - ($2::int || ' days')::interval`,
      [session.uid, days],
    );

    const aggregate = (rows, key) => Object.entries(
      rows.reduce((acc, row) => {
        const label = row[key] || 'Neznáme';
        const item = acc[label] || { label, count: 0, likeSum: 0 };
        item.count += 1;
        item.likeSum += Number(row.like_score) || 0;
        acc[label] = item;
        return acc;
      }, {}),
    )
      .map(([, value]) => ({
        label: value.label,
        count: value.count,
        avgLikeScore: value.count ? value.likeSum / value.count : 0,
      }))
      .sort((a, b) => b.count - a.count || b.avgLikeScore - a.avgLikeScore)
      .slice(0, 5);

    const totals = {
      recipesCount: rowsResult.rows.length,
      methods: aggregate(rowsResult.rows, 'method'),
      strengths: aggregate(rowsResult.rows, 'strength_preference'),
      tasteProfiles: aggregate(rowsResult.rows, 'taste_profile'),
    };

    return res.status(200).json({
      days,
      totals,
      aiSummary: buildRecipeInsightsSummary({ days, totals }),
    });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('[CoffeeRecipes] Failed to load insights', error);
    return next(error);
  }
});


export default router;
