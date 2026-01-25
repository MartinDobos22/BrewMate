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

export type QuestionnaireProfile = {
  profileSummary: string;
  recommendedStyle: string;
  recommendedOrigins: string;
  brewingTips: string;
  tasteVector: TasteVector;
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
