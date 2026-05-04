import {
  snapToTasteLevel,
  normalizeTasteVector,
  calculateMatchScore,
  matchScoreToTier,
  DEFAULT_TASTE_VECTOR,
  type TasteVector,
} from '../../../src/utils/tasteVector';

describe('snapToTasteLevel', () => {
  it('snaps to nearest level', () => {
    expect(snapToTasteLevel(0)).toBe(0);
    expect(snapToTasteLevel(12)).toBe(0);
    expect(snapToTasteLevel(13)).toBe(25);
    expect(snapToTasteLevel(50)).toBe(50);
    expect(snapToTasteLevel(100)).toBe(100);
  });

  it('returns default for non-finite values', () => {
    expect(snapToTasteLevel(NaN)).toBe(50);
    expect(snapToTasteLevel(Infinity)).toBe(50);
  });
});

describe('normalizeTasteVector', () => {
  it('fills missing axes with default', () => {
    const result = normalizeTasteVector({});
    expect(result).toEqual(DEFAULT_TASTE_VECTOR);
  });

  it('snaps provided values to valid levels', () => {
    const result = normalizeTasteVector({ acidity: 30 });
    expect(result.acidity).toBe(25);
  });

  it('handles null/undefined values per axis', () => {
    const result = normalizeTasteVector({ acidity: null as unknown as number });
    expect(result.acidity).toBe(50);
  });
});

describe('calculateMatchScore', () => {
  const perfectVector: TasteVector = {
    acidity: 50,
    sweetness: 50,
    bitterness: 50,
    body: 50,
    fruity: 50,
    roast: 50,
  };

  it('returns 100 when user and coffee vectors are identical', () => {
    expect(calculateMatchScore(perfectVector, perfectVector)).toBe(100);
  });

  it('returns null when userVector is missing', () => {
    expect(calculateMatchScore(null, perfectVector)).toBeNull();
  });

  it('returns null when coffeeVector is missing', () => {
    expect(calculateMatchScore(perfectVector, null)).toBeNull();
  });

  it('returns lower score for opposite vectors', () => {
    const low: TasteVector = {
      acidity: 0,
      sweetness: 0,
      bitterness: 0,
      body: 0,
      fruity: 0,
      roast: 0,
    };
    const high: TasteVector = {
      acidity: 100,
      sweetness: 100,
      bitterness: 100,
      body: 100,
      fruity: 100,
      roast: 100,
    };
    const score = calculateMatchScore(low, high);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(50);
  });

  it('returns a number between 0 and 100', () => {
    const a: TasteVector = {
      acidity: 25,
      sweetness: 75,
      bitterness: 50,
      body: 0,
      fruity: 100,
      roast: 25,
    };
    const b: TasteVector = {
      acidity: 75,
      sweetness: 25,
      bitterness: 50,
      body: 100,
      fruity: 0,
      roast: 75,
    };
    const score = calculateMatchScore(a, b);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('matchScoreToTier', () => {
  it('maps high scores to perfect_match', () => {
    expect(matchScoreToTier(100)).toBe('perfect_match');
    expect(matchScoreToTier(95)).toBe('perfect_match');
  });

  it('maps low scores to not_for_you', () => {
    expect(matchScoreToTier(0)).toBe('not_for_you');
    expect(matchScoreToTier(20)).toBe('not_for_you');
  });

  it('covers all tiers', () => {
    const tiers = new Set([
      matchScoreToTier(100), // perfect_match  (>=85)
      matchScoreToTier(75), // great_choice   (>=70, <85)
      matchScoreToTier(55), // worth_trying   (>=50, <70)
      matchScoreToTier(35), // interesting_experiment (>=30, <50)
      matchScoreToTier(20), // not_for_you    (<30)
    ]);
    expect(tiers.size).toBe(5);
  });
});
