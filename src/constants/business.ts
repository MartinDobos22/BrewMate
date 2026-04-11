/**
 * Business / domain thresholds — collected here so a product tweak doesn't
 * require hunting for literals in the UI layer.
 */

/** Grams remaining at or below which an active coffee counts as "low stock". */
export const LOW_STOCK_THRESHOLD_G = 60;

/** Max items to show in each dashboard preview section on the Home screen. */
export const HOME_ACTIVE_PREVIEW_LIMIT = 3;
export const HOME_RECENT_ACTIVITY_LIMIT = 3;
export const HOME_RECENT_INVENTORY_LIMIT = 2;
export const HOME_RECENT_RECIPE_LIMIT = 2;

/** Number of days of recipe history the home dashboard fetches. */
export const HOME_RECIPE_HISTORY_DAYS = 90;

/**
 * Match-score thresholds (in percent) used to label a coffee vs. user profile
 * comparison. Values are inclusive lower bounds.
 */
export const MATCH_SCORE_THRESHOLDS = {
  perfect: 85,
  great: 70,
  worthTrying: 50,
  experiment: 30,
} as const;

/**
 * Weight applied to each taste axis when computing the weighted distance
 * between the user's preferred vector and a coffee's vector. Lower weight
 * means the user tolerates a mismatch on that axis.
 */
export const TOLERANCE_WEIGHTS = {
  tolerant: 0.4,
  neutral: 0.7,
  dislike: 1.0,
} as const;
