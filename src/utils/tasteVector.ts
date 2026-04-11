import { MATCH_SCORE_THRESHOLDS, TOLERANCE_WEIGHTS } from '../constants/business';

export type TasteVector = {
  acidity: number;
  sweetness: number;
  bitterness: number;
  body: number;
  fruity: number;
  roast: number;
  confidence?: number;
};

/** Taste axes excluding meta fields like `confidence`. */
export type TasteAxis = Exclude<keyof TasteVector, 'confidence'>;

export const TASTE_AXES: readonly TasteAxis[] = [
  'acidity',
  'sweetness',
  'bitterness',
  'body',
  'fruity',
  'roast',
] as const;

export const TASTE_LEVELS = [0, 25, 50, 75, 100] as const;

/** Default neutral value for an uninitialized taste axis. */
const DEFAULT_TASTE_AXIS_VALUE = 50;

export const DEFAULT_TASTE_VECTOR: TasteVector = {
  acidity: DEFAULT_TASTE_AXIS_VALUE,
  sweetness: DEFAULT_TASTE_AXIS_VALUE,
  bitterness: DEFAULT_TASTE_AXIS_VALUE,
  body: DEFAULT_TASTE_AXIS_VALUE,
  fruity: DEFAULT_TASTE_AXIS_VALUE,
  roast: DEFAULT_TASTE_AXIS_VALUE,
};

export const snapToTasteLevel = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_TASTE_AXIS_VALUE;
  }
  return TASTE_LEVELS.reduce((closest, level) => {
    const currentDistance = Math.abs(level - value);
    const closestDistance = Math.abs(closest - value);
    if (currentDistance === closestDistance) {
      return level > closest ? level : closest;
    }
    return currentDistance < closestDistance ? level : closest;
  }, DEFAULT_TASTE_AXIS_VALUE as number);
};

const coerceAxisValue = (value: unknown): number => {
  if (value === null || value === undefined) {
    return DEFAULT_TASTE_AXIS_VALUE;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return snapToTasteLevel(numeric);
};

export const normalizeTasteVector = (
  vector?: Partial<TasteVector> | null,
): TasteVector => ({
  acidity: coerceAxisValue(vector?.acidity),
  sweetness: coerceAxisValue(vector?.sweetness),
  bitterness: coerceAxisValue(vector?.bitterness),
  body: coerceAxisValue(vector?.body),
  fruity: coerceAxisValue(vector?.fruity),
  roast: coerceAxisValue(vector?.roast),
});

const parseJsonIfString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('[TasteVector] Failed to parse JSON response', error);
    return null;
  }
};

const normalizeString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

export type ToleranceLevel = 'dislike' | 'neutral' | 'tolerant';

export type ToleranceVector = {
  acidity: ToleranceLevel;
  sweetness: ToleranceLevel;
  bitterness: ToleranceLevel;
  body: ToleranceLevel;
  fruity: ToleranceLevel;
  roast: ToleranceLevel;
};

export type Openness = 'conservative' | 'moderate' | 'adventurous';

export const DEFAULT_TOLERANCE_VECTOR: ToleranceVector = {
  acidity: 'neutral',
  sweetness: 'neutral',
  bitterness: 'neutral',
  body: 'neutral',
  fruity: 'neutral',
  roast: 'neutral',
};

export type MatchTier =
  | 'perfect_match'
  | 'great_choice'
  | 'worth_trying'
  | 'interesting_experiment'
  | 'not_for_you';

export const MATCH_TIER_LABELS: Record<MatchTier, string> = {
  perfect_match: 'Presne tvoj štýl!',
  great_choice: 'Veľmi dobrá voľba',
  worth_trying: 'Stojí za vyskúšanie',
  interesting_experiment: 'Zaujímavý experiment',
  not_for_you: 'Asi nie pre teba',
};

export const MATCH_TIER_COLORS: Record<MatchTier, { bg: string; border: string }> = {
  perfect_match: { bg: '#D8ECBA', border: '#7A9255' },
  great_choice: { bg: '#D8ECBA', border: '#8FAA6B' },
  worth_trying: { bg: '#FFF3D6', border: '#C9A84C' },
  interesting_experiment: { bg: '#FFE8D6', border: '#C4895C' },
  not_for_you: { bg: '#FFDAD6', border: '#BA1A1A' },
};

export type QuestionnaireProfile = {
  profileSummary: string;
  recommendedStyle: string;
  recommendedOrigins: string;
  brewingTips: string;
  tasteVector: TasteVector;
  toleranceVector: ToleranceVector;
  openness: Openness;
  confidence: number;
};

export type CoffeeProfile = {
  flavorNotes: string[];
  tasteProfile: string;
  expertSummary: string;
  laymanSummary: string;
  preferenceHint: string;
  reasoning: string;
  confidence: number;
  source: 'label' | 'inferred' | 'mixed' | 'low_info';
  missingInfo?: string[];
  tasteVector: TasteVector;
};

const normalizeToleranceLevel = (value: unknown): ToleranceLevel => {
  if (value === 'dislike' || value === 'neutral' || value === 'tolerant') {
    return value;
  }
  return 'neutral';
};

const normalizeToleranceVector = (
  vector?: Partial<ToleranceVector> | null,
): ToleranceVector => ({
  acidity: normalizeToleranceLevel(vector?.acidity),
  sweetness: normalizeToleranceLevel(vector?.sweetness),
  bitterness: normalizeToleranceLevel(vector?.bitterness),
  body: normalizeToleranceLevel(vector?.body),
  fruity: normalizeToleranceLevel(vector?.fruity),
  roast: normalizeToleranceLevel(vector?.roast),
});

const normalizeOpenness = (value: unknown): Openness => {
  if (value === 'conservative' || value === 'moderate' || value === 'adventurous') {
    return value;
  }
  return 'moderate';
};

export const ensureQuestionnaireProfile = (value: unknown): QuestionnaireProfile => {
  const parsed = parseJsonIfString(value);
  const fallbackSummary = typeof value === 'string' ? value : '';
  const candidate = parsed && typeof parsed === 'object' ? parsed : {};

  return {
    profileSummary: normalizeString(candidate.profileSummary, fallbackSummary),
    recommendedStyle: normalizeString(candidate.recommendedStyle),
    recommendedOrigins: normalizeString(candidate.recommendedOrigins),
    brewingTips: normalizeString(candidate.brewingTips),
    tasteVector: normalizeTasteVector(candidate.tasteVector),
    toleranceVector: normalizeToleranceVector(candidate.toleranceVector),
    openness: normalizeOpenness(candidate.openness),
    confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0.2,
  };
};

/**
 * Returns the tolerance weight for a single taste axis. Low-weight (tolerant)
 * axes contribute less to the overall mismatch, while dislike axes have full
 * weight — effectively punishing any deviation on them.
 */
const getToleranceWeight = (tolerance: ToleranceVector, axis: TasteAxis): number => {
  const level = tolerance[axis];
  return TOLERANCE_WEIGHTS[level] ?? TOLERANCE_WEIGHTS.neutral;
};

/**
 * Computes a 0–100 match score between a user's preferred taste vector and a
 * coffee's measured taste vector, weighted by the user's per-axis tolerance.
 *
 * Returns `null` when inputs are missing so callers can render a "no data"
 * state instead of a misleading numeric score.
 */
export const calculateMatchScore = (
  userVector?: Partial<TasteVector> | null,
  coffeeVector?: Partial<TasteVector> | null,
  toleranceVector?: Partial<ToleranceVector> | null,
): number | null => {
  if (!userVector || !coffeeVector) {
    return null;
  }

  const user = normalizeTasteVector(userVector);
  const coffee = normalizeTasteVector(coffeeVector);
  const tolerance = normalizeToleranceVector(toleranceVector);

  let totalWeight = 0;
  let weightedDistance = 0;
  for (const axis of TASTE_AXES) {
    const weight = getToleranceWeight(tolerance, axis);
    totalWeight += weight;
    weightedDistance += Math.abs(user[axis] - coffee[axis]) * weight;
  }

  const normalizedDistance = totalWeight > 0 ? weightedDistance / totalWeight : 0;
  return Math.round(100 - normalizedDistance);
};

/**
 * Maps a numeric match score to a human-readable tier. Keeping this logic in
 * one place means the UI layer can simply render the tier label.
 */
export const matchScoreToTier = (score: number): MatchTier => {
  if (score >= MATCH_SCORE_THRESHOLDS.perfect) { return 'perfect_match'; }
  if (score >= MATCH_SCORE_THRESHOLDS.great) { return 'great_choice'; }
  if (score >= MATCH_SCORE_THRESHOLDS.worthTrying) { return 'worth_trying'; }
  if (score >= MATCH_SCORE_THRESHOLDS.experiment) { return 'interesting_experiment'; }
  return 'not_for_you';
};

export const ensureCoffeeProfile = (value: unknown): CoffeeProfile => {
  const parsed = parseJsonIfString(value);
  const candidate = parsed && typeof parsed === 'object' ? parsed : {};

  return {
    flavorNotes: normalizeStringArray(candidate.flavorNotes),
    tasteProfile: normalizeString(candidate.tasteProfile),
    expertSummary: normalizeString(candidate.expertSummary),
    laymanSummary: normalizeString(candidate.laymanSummary),
    preferenceHint: normalizeString(candidate.preferenceHint),
    reasoning: normalizeString(candidate.reasoning),
    confidence: typeof candidate.confidence === 'number' ? candidate.confidence : 0.2,
    source:
      candidate.source === 'label'
      || candidate.source === 'inferred'
      || candidate.source === 'mixed'
      || candidate.source === 'low_info'
        ? candidate.source
        : 'low_info',
    missingInfo: normalizeStringArray(candidate.missingInfo),
    tasteVector: normalizeTasteVector(candidate.tasteVector),
  };
};
