export type TasteVector = {
  acidity: number;
  sweetness: number;
  bitterness: number;
  body: number;
  fruity: number;
  roast: number;
  confidence?: number;
};

export const TASTE_LEVELS = [0, 25, 50, 75, 100] as const;

export const DEFAULT_TASTE_VECTOR: TasteVector = {
  acidity: 50,
  sweetness: 50,
  bitterness: 50,
  body: 50,
  fruity: 50,
  roast: 50,
};

export const snapToTasteLevel = (value: number) => {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return TASTE_LEVELS.reduce((closest, level) => {
    const currentDistance = Math.abs(level - value);
    const closestDistance = Math.abs(closest - value);
    if (currentDistance === closestDistance) {
      return level > closest ? level : closest;
    }
    return currentDistance < closestDistance ? level : closest;
  }, 50);
};

export const normalizeTasteVector = (
  vector?: Partial<TasteVector> | null,
): TasteVector => ({
  acidity: snapToTasteLevel(Number(vector?.acidity)),
  sweetness: snapToTasteLevel(Number(vector?.sweetness)),
  bitterness: snapToTasteLevel(Number(vector?.bitterness)),
  body: snapToTasteLevel(Number(vector?.body)),
  fruity: snapToTasteLevel(Number(vector?.fruity)),
  roast: snapToTasteLevel(Number(vector?.roast)),
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
