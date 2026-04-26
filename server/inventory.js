import express from 'express';

import { db, ensureAppUserExists } from './db.js';
import { requireSession } from './session.js';
import { callOpenAI, aiErrorToResponse } from './aiFetch.js';
import { ERROR_CODES } from './errors.js';
import { log } from './logger.js';
import {
  buildStoragePath,
  createDownloadSignedUrl,
  createUploadSignedUrl,
  deleteStorageObject,
  isPathOwnedByUser,
  storageEnabled,
} from './storage.js';

const router = express.Router();

const COFFEE_STATUSES = new Set(['active', 'empty', 'archived']);
const TRACKING_MODES = new Set(['manual', 'estimated']);
const BREW_METHODS = new Set(['espresso', 'filter', 'other']);
const APPROVAL_THRESHOLD = 70;
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

const errorResponse = (res, status, code, message, extra) =>
  res.status(status).json({
    error: message,
    code,
    retryable: Boolean(ERROR_CODES[code]?.retryable),
    ...(extra || {}),
  });

const authErrorResponse = (res, error) =>
  errorResponse(res, error.status || 401, 'auth_error', error.message);

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
  actualRating: row.actual_rating ?? null,
  feedbackNotes: row.feedback_notes ?? null,
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
  // Image lives in user_coffee_images now; fetch on demand via GET /api/user-coffee/:id/image.
  labelImageBase64: null,
  hasImage: Boolean(row.has_image),
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
      `SELECT uc.id,
              uc.raw_text,
              uc.corrected_text,
              uc.coffee_profile,
              uc.ai_match_result,
              uc.loved,
              uc.package_size_g,
              uc.remaining_g,
              uc.opened_at,
              uc.status,
              uc.tracking_mode,
              uc.preferred_dose_g,
              uc.brew_method_default,
              uc.last_consumed_at,
              uc.created_at,
              EXISTS (
                SELECT 1 FROM user_coffee_images uci
                WHERE uci.user_coffee_id = uc.id
              ) AS has_image
       FROM user_coffee uc
       WHERE uc.user_id = $1
         AND ($2::boolean = true OR uc.status = 'active')
       ORDER BY uc.created_at DESC`,
      [session.uid, includeInactive],
    );

    return res.status(200).json({
      items: result.rows.map(mapCoffeeRow),
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to load user inventory', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/user-coffee', async (req, res, next) => {
  let client = null;
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
      return errorResponse(res, 400, 'validation_error', 'coffeeProfile is required.');
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
      return errorResponse(res, 400, 'validation_error', 'packageSizeG must be positive integer.');
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
      return errorResponse(res, 400, 'validation_error', 'remainingG must be non-negative integer.');
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
      return errorResponse(res, 400, 'validation_error', 'preferredDoseG must be positive integer.');
    }

    const resolvedStatus =
      typeof status === 'string' && COFFEE_STATUSES.has(status)
        ? status
        : 'active';
    if (typeof status === 'string' && !COFFEE_STATUSES.has(status)) {
      return errorResponse(res, 400, 'validation_error', 'status has unsupported value.');
    }

    const resolvedTrackingMode =
      typeof trackingMode === 'string' && TRACKING_MODES.has(trackingMode)
        ? trackingMode
        : (normalizedPackageSize ? 'manual' : 'estimated');
    if (typeof trackingMode === 'string' && !TRACKING_MODES.has(trackingMode)) {
      return errorResponse(res, 400, 'validation_error', 'trackingMode has unsupported value.');
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
      return errorResponse(res, 400, 'validation_error', 'brewMethodDefault has unsupported value.');
    }

    const normalizedOpenedAt =
      typeof openedAt === 'string' && openedAt.trim().length > 0 ? openedAt : null;

    const resolvedRemaining =
      normalizedRemaining
      ?? (normalizedPackageSize !== null ? normalizedPackageSize : null);

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      log.error('UserCoffee Failed to ensure user in DB', { error: dbError?.message || dbError });
      return errorResponse(res, 500, 'db_error', 'Nepodarilo sa uložiť používateľa do databázy.');
    }

    const normalizedImage =
      typeof labelImageBase64 === 'string' && labelImageBase64.trim().length > 0
        ? labelImageBase64.trim()
        : null;

    client = await db.connect();
    await client.query('BEGIN');

    const insertResult = await client.query(
      `INSERT INTO user_coffee (
          user_id,
          raw_text,
          corrected_text,
          coffee_profile,
          ai_match_result,
          loved,
          package_size_g,
          remaining_g,
          opened_at,
          status,
          tracking_mode,
          preferred_dose_g,
          brew_method_default
        )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, false, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id,
                 raw_text,
                 corrected_text,
                 coffee_profile,
                 ai_match_result,
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
        normalizedPackageSize,
        resolvedRemaining,
        normalizedOpenedAt,
        resolvedStatus,
        resolvedTrackingMode,
        normalizedPreferredDose,
        resolvedBrewMethodDefault,
      ],
    );

    const insertedRow = insertResult.rows[0];

    if (normalizedImage) {
      await client.query(
        `INSERT INTO user_coffee_images (user_coffee_id, user_id, image_base64)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_coffee_id) DO UPDATE
           SET image_base64 = EXCLUDED.image_base64,
               user_id = EXCLUDED.user_id`,
        [insertedRow.id, session.uid, normalizedImage],
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      item: mapCoffeeRow({ ...insertedRow, has_image: Boolean(normalizedImage) }),
    });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_rollbackError) { /* ignore */ }
    }
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Unexpected error', { error: error?.message || error });
    return next(error);
  } finally {
    if (client) { client.release(); }
  }
});

router.patch('/api/user-coffee/:id', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { loved } = req.body || {};

    if (typeof loved !== 'boolean') {
      return errorResponse(res, 400, 'validation_error', 'loved must be boolean.');
    }

    const result = await db.query(
      `UPDATE user_coffee
       SET loved = $3
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, session.uid, loved],
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    return res.status(200).json({ id, loved });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to update coffee', { error: error?.message || error });
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
      return errorResponse(res, 400, 'validation_error', 'consumedG must be positive integer.');
    }

    if (brewMethod && !BREW_METHODS.has(brewMethod)) {
      return errorResponse(res, 400, 'validation_error', 'brewMethod has unsupported value.');
    }

    if (source && !CONSUMPTION_SOURCES.has(source)) {
      return errorResponse(res, 400, 'validation_error', 'source has unsupported value.');
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
      return errorResponse(res, 400, 'validation_error', 'preferredDoseG must be positive integer.');
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
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
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
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at,
                 EXISTS (
                   SELECT 1 FROM user_coffee_images uci
                   WHERE uci.user_coffee_id = user_coffee.id
                 ) AS has_image`,
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
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to consume coffee grams', { error: error?.message || error });
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
      return errorResponse(res, 400, 'validation_error', 'remainingG must be non-negative integer.');
    }

    if (source && !CONSUMPTION_SOURCES.has(source)) {
      return errorResponse(res, 400, 'validation_error', 'source has unsupported value.');
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
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at,
                 EXISTS (
                   SELECT 1 FROM user_coffee_images uci
                   WHERE uci.user_coffee_id = user_coffee.id
                 ) AS has_image`,
      [id, session.uid, normalizedRemaining],
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    return res.status(200).json({
      item: mapCoffeeRow(result.rows[0]),
      source: source ?? 'slider',
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to update remaining grams', { error: error?.message || error });
    return next(error);
  }
});

router.patch('/api/user-coffee/:id/status', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { status } = req.body || {};

    if (typeof status !== 'string' || !COFFEE_STATUSES.has(status)) {
      return errorResponse(res, 400, 'validation_error', 'status has unsupported value.');
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
                 loved,
                 package_size_g,
                 remaining_g,
                 opened_at,
                 status,
                 tracking_mode,
                 preferred_dose_g,
                 brew_method_default,
                 last_consumed_at,
                 created_at,
                 EXISTS (
                   SELECT 1 FROM user_coffee_images uci
                   WHERE uci.user_coffee_id = user_coffee.id
                 ) AS has_image`,
      [id, session.uid, status],
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    return res.status(200).json({
      item: mapCoffeeRow(result.rows[0]),
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to update status', { error: error?.message || error });
    return next(error);
  }
});

router.get('/api/user-coffee/:id/image', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;

    const imgResult = await db.query(
      `SELECT image_base64, content_type, storage_path, content_type_v2
       FROM user_coffee_images
       WHERE user_coffee_id = $1 AND user_id = $2
       LIMIT 1`,
      [id, session.uid],
    );

    if (imgResult.rowCount === 0) {
      return errorResponse(res, 404, 'not_found', 'Káva nemá uloženú fotku etikety.');
    }

    const row = imgResult.rows[0];
    const contentType = row.content_type_v2 ?? row.content_type ?? null;

    // Storage-resident: prefer signed download URL.
    if (row.storage_path && storageEnabled()) {
      const signed = await createDownloadSignedUrl(row.storage_path);
      if (signed?.url) {
        return res.status(200).json({
          url: signed.url,
          expiresIn: signed.expiresIn,
          contentType,
        });
      }
      log.warn('UserCoffee storage download failed, falling back to base64', {
        userCoffeeId: id,
      });
    }

    // Legacy or fallback: inline base64 still in DB.
    if (row.image_base64) {
      return res.status(200).json({
        imageBase64: row.image_base64,
        contentType,
      });
    }

    return errorResponse(res, 404, 'not_found', 'Káva nemá uloženú fotku etikety.');
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to load coffee image', { error: error?.message || error });
    return next(error);
  }
});

// Issues a short-lived signed PUT URL for the client to upload an image
// directly to Supabase Storage. 501 when storage isn't configured — the
// client falls back to inline base64 via `POST /api/user-coffee`.
router.post('/api/user-coffee/:id/image-upload-url', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const contentType =
      typeof req.body?.contentType === 'string' && req.body.contentType.trim().length > 0
        ? req.body.contentType.trim()
        : 'image/jpeg';

    if (!storageEnabled()) {
      return errorResponse(
        res,
        501,
        'config_error',
        'Object storage nie je nakonfigurované; pošli base64 v /api/user-coffee.',
      );
    }

    const ownership = await db.query(
      `SELECT id FROM user_coffee WHERE id = $1 AND user_id = $2`,
      [id, session.uid],
    );
    if (ownership.rowCount === 0) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    const signed = await createUploadSignedUrl({
      userId: session.uid,
      userCoffeeId: id,
      contentType,
    });
    if (!signed?.uploadUrl) {
      return errorResponse(res, 502, 'config_error', 'Storage je dočasne nedostupné.');
    }

    return res.status(200).json({
      uploadUrl: signed.uploadUrl,
      token: signed.token,
      storagePath: signed.storagePath,
      contentType,
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee image-upload-url failed', { error: error?.message || error });
    return next(error);
  }
});

// Records a finished upload: the client tells the server which storage_path
// it just wrote. We validate the path prefix (path must start with the
// caller's uid) before persisting to the row.
router.post('/api/user-coffee/:id/image-confirm', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;
    const { storagePath, contentType } = req.body || {};

    if (typeof storagePath !== 'string' || storagePath.length === 0) {
      return errorResponse(res, 400, 'validation_error', 'storagePath is required.');
    }
    if (!isPathOwnedByUser(storagePath, session.uid)) {
      return errorResponse(res, 400, 'validation_error', 'storagePath does not belong to caller.');
    }
    const expectedPrefix = buildStoragePath(session.uid, id, contentType).split('.')[0];
    if (!storagePath.startsWith(expectedPrefix)) {
      return errorResponse(res, 400, 'validation_error', 'storagePath does not match user-coffee id.');
    }

    const ownership = await db.query(
      `SELECT id FROM user_coffee WHERE id = $1 AND user_id = $2`,
      [id, session.uid],
    );
    if (ownership.rowCount === 0) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    await db.query(
      `INSERT INTO user_coffee_images (user_coffee_id, user_id, image_base64, storage_path, content_type_v2)
       VALUES ($1, $2, NULL, $3, $4)
       ON CONFLICT (user_coffee_id) DO UPDATE
         SET image_base64 = NULL,
             storage_path = EXCLUDED.storage_path,
             content_type_v2 = EXCLUDED.content_type_v2,
             user_id = EXCLUDED.user_id`,
      [id, session.uid, storagePath, typeof contentType === 'string' ? contentType : null],
    );

    return res.status(200).json({ ok: true, storagePath });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee image-confirm failed', { error: error?.message || error });
    return next(error);
  }
});

router.delete('/api/user-coffee/:id', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { id } = req.params;

    // Capture storage paths before the cascade nukes the join rows. We can't
    // rely on RETURNING from the DELETE itself because user_coffee_images
    // disappears via ON DELETE CASCADE, not via this query.
    const { rows: imageRows } = await db.query(
      `SELECT uci.storage_path
         FROM user_coffee_images uci
         JOIN user_coffee uc ON uc.id = uci.user_coffee_id
        WHERE uci.user_coffee_id = $1
          AND uc.user_id = $2
          AND uci.storage_path IS NOT NULL`,
      [id, session.uid],
    );

    const result = await db.query(
      `DELETE FROM user_coffee
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, session.uid],
    );

    if (!result.rowCount) {
      return errorResponse(res, 404, 'not_found', 'Káva nebola nájdená.');
    }

    for (const row of imageRows) {
      try {
        const ok = await deleteStorageObject(row.storage_path);
        if (!ok) {
          log.warn('storage_delete_failed', {
            storagePath: row.storage_path,
            userCoffeeId: id,
          });
        }
      } catch (storageError) {
        log.warn('storage_delete_failed', {
          storagePath: row.storage_path,
          userCoffeeId: id,
          error: storageError?.message || storageError,
        });
      }
    }

    return res.status(204).send();
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserCoffee Failed to delete coffee', { error: error?.message || error });
    return next(error);
  }
});

const insertMatchFeedback = async ({ res, session, kind, targetId, body }) => {
  const {
    predictedScore,
    predictedTier,
    actualRating,
    notes,
    algorithmVersion,
  } = body || {};

  const normalizedPredicted = toNonNegativeInteger(predictedScore);
  if (normalizedPredicted === null || normalizedPredicted > 100) {
    return errorResponse(
      res,
      400,
      'validation_error',
      'predictedScore must be integer 0-100.',
    );
  }

  const normalizedRating = toRatingInteger(actualRating);
  if (normalizedRating === null) {
    return errorResponse(
      res,
      400,
      'validation_error',
      'actualRating must be integer 1-5.',
    );
  }

  const ownershipTable = kind === 'scan' ? 'user_coffee_scans' : 'user_coffee';
  const notFoundMessage = kind === 'scan' ? 'Sken nebol nájdený.' : 'Káva nebola nájdená.';
  const ownershipCheck = await db.query(
    `SELECT id FROM ${ownershipTable} WHERE id = $1 AND user_id = $2`,
    [targetId, session.uid],
  );
  if (ownershipCheck.rowCount === 0) {
    return errorResponse(res, 404, 'not_found', notFoundMessage);
  }

  try {
    await ensureAppUserExists(session.uid, session.email ?? null);
  } catch (dbError) {
    log.error('CoffeeMatchFeedback Failed to ensure user', { error: dbError?.message || dbError });
    return errorResponse(res, 500, 'db_error', 'Nepodarilo sa uložiť používateľa do databázy.');
  }

  const normalizedTier =
    typeof predictedTier === 'string' && predictedTier.trim().length > 0
      ? predictedTier.trim()
      : null;
  const normalizedNotes =
    typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null;
  const normalizedAlgorithm =
    typeof algorithmVersion === 'string' && algorithmVersion.trim().length > 0
      ? algorithmVersion.trim()
      : null;

  const coffeeId = kind === 'scan' ? null : targetId;
  const scanId = kind === 'scan' ? targetId : null;

  // The two partial unique indexes from
  // `20260424_match_feedback_unique_indexes.sql` let users overwrite their
  // rating in place instead of spawning a new row per tap. xmax=0 on the
  // returned row means "insert", non-zero means the ON CONFLICT branch fired
  // (we map that to HTTP 200 so the client can distinguish).
  const conflictTarget = kind === 'scan'
    ? '(user_id, user_coffee_scan_id) WHERE user_coffee_scan_id IS NOT NULL'
    : '(user_id, user_coffee_id) WHERE user_coffee_id IS NOT NULL';

  const upsertResult = await db.query(
    `INSERT INTO user_coffee_match_feedback (
       user_id,
       user_coffee_id,
       user_coffee_scan_id,
       predicted_score,
       predicted_tier,
       actual_rating,
       notes,
       algorithm_version
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT ${conflictTarget}
     DO UPDATE SET
       predicted_score = EXCLUDED.predicted_score,
       predicted_tier = EXCLUDED.predicted_tier,
       actual_rating = EXCLUDED.actual_rating,
       notes = EXCLUDED.notes,
       algorithm_version = EXCLUDED.algorithm_version,
       created_at = now()
     RETURNING id, created_at, (xmax = 0) AS inserted`,
    [
      session.uid,
      coffeeId,
      scanId,
      normalizedPredicted,
      normalizedTier,
      normalizedRating,
      normalizedNotes,
      normalizedAlgorithm,
    ],
  );

  const row = upsertResult.rows[0];
  const status = row.inserted ? 201 : 200;

  return res.status(status).json({
    feedback: {
      id: row.id,
      userCoffeeId: coffeeId,
      userCoffeeScanId: scanId,
      predictedScore: normalizedPredicted,
      predictedTier: normalizedTier,
      actualRating: normalizedRating,
      notes: normalizedNotes,
      algorithmVersion: normalizedAlgorithm,
      createdAt: row.created_at,
      updated: !row.inserted,
    },
  });
};

router.post('/api/user-coffee/:id/match-feedback', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    return await insertMatchFeedback({
      res,
      session,
      kind: 'inventory',
      targetId: req.params.id,
      body: req.body,
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeMatchFeedback Failed to persist feedback', { error: error?.message || error });
    return next(error);
  }
});

const mapScanRow = (row) => ({
  id: row.id,
  rawText: row.raw_text,
  correctedText: row.corrected_text,
  coffeeProfile: row.coffee_profile,
  aiMatchResult: row.ai_match_result,
  algorithmVersion: row.algorithm_version,
  createdAt: row.created_at,
});

router.get('/api/coffee-scans', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const requestedLimit = toPositiveInteger(req.query.limit);
    const limit = Math.min(requestedLimit ?? 50, 200);

    const result = await db.query(
      `SELECT id, raw_text, corrected_text, coffee_profile, ai_match_result,
              algorithm_version, created_at
       FROM user_coffee_scans
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [session.uid, limit],
    );

    return res.status(200).json({
      items: result.rows.map(mapScanRow),
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeScans Failed to load scans', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/coffee-scans', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { rawText, correctedText, coffeeProfile, aiMatchResult } = req.body || {};

    if (!coffeeProfile || typeof coffeeProfile !== 'object') {
      return errorResponse(res, 400, 'validation_error', 'coffeeProfile is required.');
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      log.error('CoffeeScans Failed to ensure user in DB', { error: dbError?.message || dbError });
      return errorResponse(res, 500, 'db_error', 'Nepodarilo sa uložiť používateľa do databázy.');
    }

    const algorithmVersion =
      aiMatchResult && typeof aiMatchResult === 'object'
      && typeof aiMatchResult.algorithmVersion === 'string'
      && aiMatchResult.algorithmVersion.trim().length > 0
        ? aiMatchResult.algorithmVersion.trim()
        : null;

    const insertResult = await db.query(
      `INSERT INTO user_coffee_scans (
         user_id,
         raw_text,
         corrected_text,
         coffee_profile,
         ai_match_result,
         algorithm_version
       )
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
       RETURNING id, raw_text, corrected_text, coffee_profile, ai_match_result,
                 algorithm_version, created_at`,
      [
        session.uid,
        typeof rawText === 'string' ? rawText : null,
        typeof correctedText === 'string' ? correctedText : null,
        JSON.stringify(coffeeProfile),
        aiMatchResult && typeof aiMatchResult === 'object'
          ? JSON.stringify(aiMatchResult)
          : null,
        algorithmVersion,
      ],
    );

    return res.status(201).json({ scan: mapScanRow(insertResult.rows[0]) });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeScans Failed to persist scan', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/coffee-scans/:id/match-feedback', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    return await insertMatchFeedback({
      res,
      session,
      kind: 'scan',
      targetId: req.params.id,
      body: req.body,
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeMatchFeedback Failed to persist scan feedback', { error: error?.message || error });
    return next(error);
  }
});

// Admin-only: triggers `cleanup_user_coffee_scans()` from
// `20260427_user_coffee_scans_retention.sql`. Wire to a Render Scheduled Task
// or pg_cron — see `supabase/MIGRATIONS.md` (Maintenance jobs).
router.post('/api/admin/cleanup-old-scans', async (req, res, next) => {
  try {
    const expected = process.env.ADMIN_TOKEN?.trim();
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!expected || !provided || provided !== expected) {
      return errorResponse(res, 401, 'auth_error', 'Invalid admin token.');
    }

    const result = await db.query('SELECT public.cleanup_user_coffee_scans() AS deleted');
    const deletedRows = Number(result.rows[0]?.deleted ?? 0);
    log.info('admin cleanup-old-scans', { deletedRows });
    return res.status(200).json({ deletedRows });
  } catch (error) {
    log.error('admin cleanup-old-scans failed', { error: error?.message || error });
    return next(error);
  }
});

router.get('/api/user-questionnaire', async (req, res, next) => {
  try {
    const session = await requireSession(req);

    const result = await db.query(
      `SELECT id, answers, questionnaire_profile, taste_profile, created_at
       FROM user_questionnaires
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [session.uid],
    );

    if (result.rows.length === 0) {
      return res.status(200).json({ questionnaire: null });
    }

    const row = result.rows[0];
    const answers = typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers;
    const profile =
      typeof row.questionnaire_profile === 'string'
        ? JSON.parse(row.questionnaire_profile)
        : row.questionnaire_profile;
    const tasteProfile =
      typeof row.taste_profile === 'string'
        ? JSON.parse(row.taste_profile)
        : row.taste_profile;

    return res.status(200).json({
      questionnaire: {
        id: row.id,
        answers,
        profile,
        tasteProfile,
        savedAt: row.created_at,
      },
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('UserQuestionnaire Failed to load latest questionnaire', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/user-questionnaire', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const { answers, profile, tasteProfile } = req.body || {};

    if (!Array.isArray(answers) || answers.length === 0) {
      return errorResponse(res, 400, 'validation_error', 'answers are required.');
    }

    if (!profile || typeof profile !== 'object') {
      return errorResponse(res, 400, 'validation_error', 'profile is required.');
    }

    const resolvedTasteProfile =
      tasteProfile && typeof tasteProfile === 'object' ? tasteProfile : profile.tasteVector;

    if (!resolvedTasteProfile || typeof resolvedTasteProfile !== 'object') {
      return errorResponse(res, 400, 'validation_error', 'tasteProfile is required.');
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      log.error('UserQuestionnaire Failed to ensure user in DB', { error: dbError?.message || dbError });
      return errorResponse(res, 500, 'db_error', 'Nepodarilo sa uložiť používateľa do databázy.');
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
      return authErrorResponse(res, error);
    }
    log.error('UserQuestionnaire Unexpected error', { error: error?.message || error });
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
      return authErrorResponse(res, error);
    }
    log.error('CoffeeJournal Failed to load brew logs', { error: error?.message || error });
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
      return errorResponse(res, 400, 'validation_error', 'method has unsupported value.');
    }

    const normalizedDose = toPositiveInteger(doseG);
    if (!normalizedDose) {
      return errorResponse(res, 400, 'validation_error', 'doseG must be positive integer.');
    }

    const normalizedBrewTime = toPositiveInteger(brewTimeSeconds);
    if (!normalizedBrewTime) {
      return errorResponse(res, 400, 'validation_error', 'brewTimeSeconds must be positive integer.');
    }

    const normalizedRating = toRatingInteger(tasteRating);
    if (!normalizedRating) {
      return errorResponse(res, 400, 'validation_error', 'tasteRating must be integer between 1 and 5.');
    }

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      log.error('CoffeeJournal Failed to ensure user in DB', { error: dbError?.message || dbError });
      return errorResponse(res, 500, 'db_error', 'Nepodarilo sa uložiť používateľa do databázy.');
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
      return authErrorResponse(res, error);
    }
    log.error('CoffeeJournal Failed to create brew log', { error: error?.message || error });
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

        const result = await callOpenAI({
          apiKey: openAiApiKey,
          label: 'CoffeeJournal',
          payload: {
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
          },
        });

        if (typeof result.content === 'string' && result.content.length > 0) {
          aiSummary = result.content;
        }
      } catch (aiError) {
        log.warn('CoffeeJournal Falling back to local summary', { error: aiError?.message || aiError });
      }
    }

    return res.status(200).json({
      days,
      totals,
      aiSummary,
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeJournal Failed to load insights', { error: error?.message || error });
    return next(error);
  }
});


router.get('/api/coffee-recipes', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const days = Math.min(toPositiveInteger(req.query.days) ?? 30, 90);

    const result = await db.query(
      `SELECT r.id,
              coalesce(r.recipe->>'title', 'Recipe') as title,
              coalesce(r.recipe->>'method', r.selected_preparation, 'unknown') as method,
              coalesce(r.strength_preference, r.recipe->>'strengthPreference', 'neuvedené') as strength_preference,
              coalesce(r.recipe->>'dose', '-') as dose,
              coalesce(r.recipe->>'water', '-') as water,
              coalesce(r.recipe->>'totalTime', '-') as total_time,
              coalesce(r.analysis->>'tasteProfile', 'Neznámy profil') as taste_profile,
              coalesce((r.analysis->'flavorNotes')::jsonb, '[]'::jsonb) as flavor_notes,
              r.like_score,
              r.approved,
              r.created_at,
              f.actual_rating,
              f.notes as feedback_notes
       FROM user_saved_coffee_recipes r
       LEFT JOIN user_recipe_feedback f
         ON f.recipe_id = r.id AND f.user_id = r.user_id
       WHERE r.user_id = $1
         AND r.approved = true
         AND r.created_at >= now() - ($2::int || ' days')::interval
       ORDER BY r.created_at DESC`,
      [session.uid, days],
    );

    return res.status(200).json({ items: result.rows.map(mapSavedRecipeRow) });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeRecipes Failed to load recipes', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/coffee-recipes', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const {
      analysis,
      recipe,
      selectedPreparation,
      strengthPreference,
      likeScore,
      approved,
      predictionMetadata,
      brewPreferences,
      idempotencyKey,
    } = req.body || {};

    if (!analysis || typeof analysis !== 'object') {
      return res.status(400).json({ error: 'analysis is required.', code: 'validation_error', retryable: false });
    }
    if (!recipe || typeof recipe !== 'object') {
      return res.status(400).json({ error: 'recipe is required.', code: 'validation_error', retryable: false });
    }

    const normalizedLikeScore = toNonNegativeInteger(likeScore);
    if (normalizedLikeScore === null || normalizedLikeScore > 100) {
      return res.status(400).json({ error: 'likeScore must be integer between 0 and 100.', code: 'validation_error', retryable: false });
    }

    if (normalizedLikeScore < APPROVAL_THRESHOLD) {
      return res.status(400).json({
        error: `Skóre je príliš nízke na uloženie (min ${APPROVAL_THRESHOLD}%).`,
        code: 'below_threshold',
        retryable: false,
        threshold: APPROVAL_THRESHOLD,
      });
    }

    // Idempotency: if the client sends the same key twice, return the existing record
    if (typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
      const existing = await db.query(
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
         WHERE user_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [session.uid, idempotencyKey.trim()],
      );
      if (existing.rows.length > 0) {
        log.info('CoffeeRecipes Idempotent duplicate detected', { idempotencyKey });
        return res.status(200).json({ item: mapSavedRecipeRow(existing.rows[0]), duplicate: true });
      }
    }

    const sanitizedPredictionMetadata =
      predictionMetadata && typeof predictionMetadata === 'object' ? predictionMetadata : null;
    const sanitizedBrewPreferences =
      brewPreferences && typeof brewPreferences === 'object' ? brewPreferences : null;

    try {
      await ensureAppUserExists(session.uid, session.email ?? null);
    } catch (dbError) {
      log.error('CoffeeRecipes Failed to ensure user in DB', { error: dbError?.message || dbError });
      return res.status(500).json({ error: 'Nepodarilo sa uložiť používateľa do databázy.', code: 'db_error', retryable: true });
    }

    const insertResult = await db.query(
      `INSERT INTO user_saved_coffee_recipes (
         user_id, analysis, recipe, selected_preparation, strength_preference,
         like_score, approved, prediction_metadata, brew_preferences, idempotency_key
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)
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
        sanitizedPredictionMetadata ? JSON.stringify(sanitizedPredictionMetadata) : null,
        sanitizedBrewPreferences ? JSON.stringify(sanitizedBrewPreferences) : null,
        typeof idempotencyKey === 'string' && idempotencyKey.trim() ? idempotencyKey.trim() : null,
      ],
    );

    return res.status(201).json({ item: mapSavedRecipeRow(insertResult.rows[0]) });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message, code: 'auth_error', retryable: false });
    }
    log.error('CoffeeRecipes Failed to save recipe', { error: error?.message || error });
    return next(error);
  }
});

const RECIPE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.delete('/api/coffee-recipes/:id', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const recipeId = String(req.params.id || '').trim();
    if (!RECIPE_ID_PATTERN.test(recipeId)) {
      return res.status(400).json({ error: 'Invalid recipe id.', code: 'validation_error', retryable: false });
    }

    const result = await db.query(
      `DELETE FROM user_saved_coffee_recipes
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [recipeId, session.uid],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found.', code: 'not_found', retryable: false });
    }

    return res.status(200).json({ ok: true, id: recipeId });
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({ error: error.message, code: 'auth_error', retryable: false });
    }
    log.error('CoffeeRecipes Failed to delete recipe', { error: error?.message || error });
    return next(error);
  }
});

router.post('/api/coffee-recipes/:id/feedback', async (req, res, next) => {
  try {
    const session = await requireSession(req);
    const recipeId = String(req.params.id || '').trim();
    if (!RECIPE_ID_PATTERN.test(recipeId)) {
      return errorResponse(res, 400, 'validation_error', 'Invalid recipe id.');
    }

    const { actualRating, notes } = req.body || {};
    const rating = Number(actualRating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return errorResponse(res, 400, 'validation_error', 'actualRating must be integer between 1 and 5.');
    }

    const sanitizedNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : null;

    const recipeRow = await db.query(
      `SELECT like_score, prediction_metadata
       FROM user_saved_coffee_recipes
       WHERE id = $1 AND user_id = $2`,
      [recipeId, session.uid],
    );
    if (recipeRow.rows.length === 0) {
      return errorResponse(res, 404, 'not_found', 'Recipe not found.');
    }

    const predictedScore = Number(recipeRow.rows[0].like_score) || 0;
    const metadata = recipeRow.rows[0].prediction_metadata;
    const parsedMetadata = typeof metadata === 'string' ? (() => {
      try { return JSON.parse(metadata); } catch { return null; }
    })() : metadata;
    const algorithmVersion =
      (parsedMetadata && typeof parsedMetadata.algorithmVersion === 'string'
        ? parsedMetadata.algorithmVersion
        : null) || 'legacy';

    const result = await db.query(
      `INSERT INTO user_recipe_feedback (
         user_id, recipe_id, predicted_score, actual_rating, notes, algorithm_version
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, recipe_id)
       DO UPDATE SET
         actual_rating = excluded.actual_rating,
         notes = excluded.notes,
         predicted_score = excluded.predicted_score,
         algorithm_version = excluded.algorithm_version,
         created_at = now()
       RETURNING id, recipe_id, predicted_score, actual_rating, notes, algorithm_version, created_at`,
      [session.uid, recipeId, predictedScore, rating, sanitizedNotes, algorithmVersion],
    );

    const row = result.rows[0];
    return res.status(201).json({
      feedback: {
        id: row.id,
        recipeId: row.recipe_id,
        predictedScore: row.predicted_score,
        actualRating: row.actual_rating,
        notes: row.notes,
        algorithmVersion: row.algorithm_version,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    if (error?.status) {
      return authErrorResponse(res, error);
    }
    log.error('CoffeeRecipes Failed to save feedback', { error: error?.message || error });
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
      return authErrorResponse(res, error);
    }
    log.error('CoffeeRecipes Failed to load insights', { error: error?.message || error });
    return next(error);
  }
});


export default router;
