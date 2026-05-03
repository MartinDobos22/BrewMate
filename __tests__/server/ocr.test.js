import {
  AXIS_LABELS,
  CALIBRATION_MAX_OFFSET,
  CALIBRATION_RATING_MAP,
  MATCH_ALGORITHM_VERSION,
  MATCH_CACHE_VERSION,
  MATCH_TIER_THRESHOLDS,
  TASTE_AXES,
  TIER_VERDICTS,
  TOLERANCE_WEIGHTS,
  buildVectorMatchReason,
  clampAxis,
  computeCalibrationOffset,
  extractVisionText,
  matchScoreToTier,
  stripDataUrlPrefix,
  toNumberOrNull,
} from '../../server/ocr.js';

// ---------------------------------------------------------------------------
// Constants — pin business rules so accidental changes break loudly.
// Bumping MATCH_CACHE_VERSION invalidates every cached match in production.
// ---------------------------------------------------------------------------

describe('ocr scoring constants', () => {
  it('TASTE_AXES is exactly the six axes used by client + server', () => {
    expect(TASTE_AXES).toEqual([
      'acidity',
      'sweetness',
      'bitterness',
      'body',
      'fruity',
      'roast',
    ]);
  });

  it('TOLERANCE_WEIGHTS has tolerant < neutral < dislike', () => {
    expect(TOLERANCE_WEIGHTS.tolerant).toBeLessThan(TOLERANCE_WEIGHTS.neutral);
    expect(TOLERANCE_WEIGHTS.neutral).toBeLessThan(TOLERANCE_WEIGHTS.dislike);
    expect(TOLERANCE_WEIGHTS).toEqual({
      tolerant: 0.4,
      neutral: 0.7,
      dislike: 1.0,
    });
  });

  it('MATCH_TIER_THRESHOLDS are strictly descending', () => {
    const { perfect, great, worthTrying, experiment } = MATCH_TIER_THRESHOLDS;
    expect(perfect).toBeGreaterThan(great);
    expect(great).toBeGreaterThan(worthTrying);
    expect(worthTrying).toBeGreaterThan(experiment);
    expect(MATCH_TIER_THRESHOLDS).toEqual({
      perfect: 85,
      great: 70,
      worthTrying: 50,
      experiment: 30,
    });
  });

  it('MATCH_ALGORITHM_VERSION is pinned (DB persists this string)', () => {
    expect(MATCH_ALGORITHM_VERSION).toBe('vector-v1');
  });

  it('MATCH_CACHE_VERSION is pinned (changing it invalidates AI cache)', () => {
    expect(MATCH_CACHE_VERSION).toBe('match-hybrid-v1');
  });

  it('CALIBRATION_RATING_MAP is monotonic in input rating', () => {
    const ratings = Object.keys(CALIBRATION_RATING_MAP)
      .map(Number)
      .sort((a, b) => a - b);
    let prev = -Infinity;
    for (const r of ratings) {
      const v = CALIBRATION_RATING_MAP[r];
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
  });

  it('CALIBRATION_MAX_OFFSET is 15 — cap to avoid runaway corrections', () => {
    expect(CALIBRATION_MAX_OFFSET).toBe(15);
  });

  it('AXIS_LABELS covers every TASTE_AXES entry with Slovak label', () => {
    for (const axis of TASTE_AXES) {
      expect(typeof AXIS_LABELS[axis]).toBe('string');
      expect(AXIS_LABELS[axis].length).toBeGreaterThan(0);
    }
  });

  it('TIER_VERDICTS has Slovak text for every possible tier', () => {
    const tiers = [
      'perfect_match',
      'great_choice',
      'worth_trying',
      'interesting_experiment',
      'not_for_you',
    ];
    for (const tier of tiers) {
      expect(typeof TIER_VERDICTS[tier]).toBe('string');
      expect(TIER_VERDICTS[tier].length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// stripDataUrlPrefix
// ---------------------------------------------------------------------------

describe('stripDataUrlPrefix', () => {
  it('removes a PNG data URL prefix', () => {
    expect(stripDataUrlPrefix('data:image/png;base64,iVBORw0=')).toBe(
      'iVBORw0=',
    );
  });

  it('removes a JPEG data URL prefix', () => {
    expect(stripDataUrlPrefix('data:image/jpeg;base64,/9j/4AA=')).toBe(
      '/9j/4AA=',
    );
  });

  it('returns the input unchanged when no prefix is present', () => {
    expect(stripDataUrlPrefix('iVBORw0=')).toBe('iVBORw0=');
  });
});

// ---------------------------------------------------------------------------
// toNumberOrNull
// ---------------------------------------------------------------------------

describe('toNumberOrNull', () => {
  it('returns the number when input is a positive finite number', () => {
    expect(toNumberOrNull(15)).toBe(15);
    expect(toNumberOrNull(0.5)).toBe(0.5);
  });

  it('parses positive numeric strings', () => {
    expect(toNumberOrNull('250')).toBe(250);
    expect(toNumberOrNull('1.5')).toBe(1.5);
  });

  it('returns null for zero (must be > 0)', () => {
    expect(toNumberOrNull(0)).toBeNull();
    expect(toNumberOrNull('0')).toBeNull();
  });

  it('returns null for negatives', () => {
    expect(toNumberOrNull(-1)).toBeNull();
    expect(toNumberOrNull('-5')).toBeNull();
  });

  it('returns null for NaN, Infinity, garbage', () => {
    expect(toNumberOrNull(NaN)).toBeNull();
    expect(toNumberOrNull(Infinity)).toBeNull();
    expect(toNumberOrNull('abc')).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractVisionText — Google Vision response → text
// ---------------------------------------------------------------------------

describe('extractVisionText', () => {
  it('prefers fullTextAnnotation.text when present', () => {
    const response = {
      responses: [
        {
          fullTextAnnotation: { text: 'Lavazza Crema' },
          textAnnotations: [{ description: 'fallback' }],
        },
      ],
    };
    expect(extractVisionText(response)).toBe('Lavazza Crema');
  });

  it('falls back to textAnnotations[0].description when fullText is missing', () => {
    const response = {
      responses: [
        {
          textAnnotations: [{ description: 'fallback text' }],
        },
      ],
    };
    expect(extractVisionText(response)).toBe('fallback text');
  });

  it('returns empty string for empty/null response', () => {
    expect(extractVisionText(null)).toBe('');
    expect(extractVisionText(undefined)).toBe('');
    expect(extractVisionText({})).toBe('');
    expect(extractVisionText({ responses: [] })).toBe('');
    expect(extractVisionText({ responses: [{}] })).toBe('');
  });
});

// ---------------------------------------------------------------------------
// clampAxis — clamp to [0, 100], default 50 for non-finite
// ---------------------------------------------------------------------------

describe('clampAxis', () => {
  it('passes through values inside the valid range', () => {
    expect(clampAxis(0)).toBe(0);
    expect(clampAxis(50)).toBe(50);
    expect(clampAxis(100)).toBe(100);
    expect(clampAxis(73)).toBe(73);
  });

  it('clamps values above 100 down to 100', () => {
    expect(clampAxis(150)).toBe(100);
    expect(clampAxis(1000)).toBe(100);
  });

  it('clamps values below 0 up to 0', () => {
    expect(clampAxis(-1)).toBe(0);
    expect(clampAxis(-100)).toBe(0);
  });

  it('returns 50 (neutral) for non-finite inputs', () => {
    expect(clampAxis(NaN)).toBe(50);
    expect(clampAxis(Infinity)).toBe(50);
    expect(clampAxis(-Infinity)).toBe(50);
    expect(clampAxis(undefined)).toBe(50);
    expect(clampAxis('not a number')).toBe(50);
  });

  // Documents a JS quirk: Number(null) === 0, which IS finite, so null bypasses
  // the neutral-50 fallback and is treated as 0. If a missing axis ever flows
  // in as `null`, the user appears to "dislike" everything on that axis.
  // Worth revisiting in the scoring engine if this surfaces in real data.
  it('treats null as 0 (Number(null) is finite per JS spec)', () => {
    expect(clampAxis(null)).toBe(0);
  });

  it('coerces numeric strings', () => {
    expect(clampAxis('42')).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// matchScoreToTier — score → tier name
// ---------------------------------------------------------------------------

describe('matchScoreToTier', () => {
  it('returns perfect_match at and above 85', () => {
    expect(matchScoreToTier(85)).toBe('perfect_match');
    expect(matchScoreToTier(100)).toBe('perfect_match');
  });

  it('returns great_choice from 70 to 84', () => {
    expect(matchScoreToTier(70)).toBe('great_choice');
    expect(matchScoreToTier(84)).toBe('great_choice');
    expect(matchScoreToTier(84.99)).toBe('great_choice');
  });

  it('returns worth_trying from 50 to 69', () => {
    expect(matchScoreToTier(50)).toBe('worth_trying');
    expect(matchScoreToTier(69)).toBe('worth_trying');
  });

  it('returns interesting_experiment from 30 to 49', () => {
    expect(matchScoreToTier(30)).toBe('interesting_experiment');
    expect(matchScoreToTier(49)).toBe('interesting_experiment');
  });

  it('returns not_for_you below 30', () => {
    expect(matchScoreToTier(0)).toBe('not_for_you');
    expect(matchScoreToTier(29)).toBe('not_for_you');
    expect(matchScoreToTier(-10)).toBe('not_for_you');
  });

  it('boundary check: 85 is perfect, 84.99 is great', () => {
    // Important — clients render different colors per tier.
    expect(matchScoreToTier(85)).toBe('perfect_match');
    expect(matchScoreToTier(84.99)).toBe('great_choice');
  });
});

// ---------------------------------------------------------------------------
// buildVectorMatchReason — Slovak human-readable explanation
// ---------------------------------------------------------------------------

describe('buildVectorMatchReason', () => {
  const flatVector = value => ({
    acidity: value,
    sweetness: value,
    bitterness: value,
    body: value,
    fruity: value,
    roast: value,
  });
  const noTolerance = {
    acidity: 'tolerant',
    sweetness: 'tolerant',
    bitterness: 'tolerant',
    body: 'tolerant',
    fruity: 'tolerant',
    roast: 'tolerant',
  };

  it('reports matches when axes are within 15 units', () => {
    const text = buildVectorMatchReason(
      flatVector(50),
      flatVector(60),
      noTolerance,
    );
    expect(text).toContain('Zhoda v:');
  });

  it('reports conflicts when axes diverge by 40+ AND tolerance is dislike/neutral', () => {
    const dislikeAll = Object.fromEntries(
      TASTE_AXES.map(axis => [axis, 'dislike']),
    );
    const text = buildVectorMatchReason(
      flatVector(10),
      flatVector(80),
      dislikeAll,
    );
    expect(text).toContain('Väčší rozdiel v:');
  });

  it('does NOT report conflicts when tolerance is "tolerant" even at large diffs', () => {
    const text = buildVectorMatchReason(
      flatVector(10),
      flatVector(80),
      noTolerance,
    );
    expect(text).not.toContain('Väčší rozdiel');
  });

  it('limits matches to top 3 and conflicts to top 2', () => {
    const text = buildVectorMatchReason(
      flatVector(50),
      flatVector(55),
      noTolerance,
    );
    const matchSection = text.split('Zhoda v:')[1] ?? '';
    const commas = (matchSection.match(/,/g) || []).length;
    // 3 items → 2 commas in the joined list
    expect(commas).toBeLessThanOrEqual(2);
  });

  it('returns a fallback message when there are no matches or conflicts', () => {
    // 30 ≤ diff ≤ 39 → neither match nor conflict bucket
    const text = buildVectorMatchReason(
      flatVector(20),
      flatVector(55),
      noTolerance,
    );
    expect(text).toBe(
      'Predikcia je založená na porovnaní tvojho chuťového profilu s touto kávou.',
    );
  });

  it('uses Slovak axis labels', () => {
    const text = buildVectorMatchReason(
      flatVector(50),
      flatVector(55),
      noTolerance,
    );
    // Slovak labels — guard against accidental EN regression
    expect(text).toMatch(/kyslosť|sladkosť|horkosť|telo|ovocnosť|praženie/);
  });
});

// ---------------------------------------------------------------------------
// computeCalibrationOffset — bias correction from feedback history
// ---------------------------------------------------------------------------

describe('computeCalibrationOffset', () => {
  it('returns zero offset when input is empty/null/undefined', () => {
    expect(computeCalibrationOffset([])).toEqual({ offset: 0, sampleSize: 0 });
    expect(computeCalibrationOffset(null)).toEqual({
      offset: 0,
      sampleSize: 0,
    });
    expect(computeCalibrationOffset(undefined)).toEqual({
      offset: 0,
      sampleSize: 0,
    });
  });

  it('returns zero offset when fewer than 2 valid rows (not enough signal)', () => {
    const result = computeCalibrationOffset([
      { predicted_score: 80, actual_rating: 4 },
    ]);
    expect(result).toEqual({ offset: 0, sampleSize: 1 });
  });

  it('returns POSITIVE offset when algorithm over-predicts', () => {
    // Predicted 90 + 90, actual rating 3 (=60) + 3 (=60) → diff = +30 each
    const result = computeCalibrationOffset([
      { predicted_score: 90, actual_rating: 3 },
      { predicted_score: 90, actual_rating: 3 },
    ]);
    expect(result.offset).toBeGreaterThan(0);
    expect(result.sampleSize).toBe(2);
  });

  it('returns NEGATIVE offset when algorithm under-predicts', () => {
    // Predicted 40, actual 5 (=95) → diff = -55 each, clamps to -CALIBRATION_MAX_OFFSET
    const result = computeCalibrationOffset([
      { predicted_score: 40, actual_rating: 5 },
      { predicted_score: 40, actual_rating: 5 },
    ]);
    expect(result.offset).toBe(-CALIBRATION_MAX_OFFSET);
    expect(result.sampleSize).toBe(2);
  });

  it('clamps offset to ±CALIBRATION_MAX_OFFSET', () => {
    const huge = computeCalibrationOffset([
      { predicted_score: 100, actual_rating: 1 }, // diff +90
      { predicted_score: 100, actual_rating: 1 }, // diff +90
    ]);
    expect(huge.offset).toBe(CALIBRATION_MAX_OFFSET);
  });

  it('rounds the offset to an integer', () => {
    const result = computeCalibrationOffset([
      { predicted_score: 70, actual_rating: 4 }, // diff -10
      { predicted_score: 75, actual_rating: 4 }, // diff -5
      { predicted_score: 73, actual_rating: 4 }, // diff -7
    ]);
    expect(Number.isInteger(result.offset)).toBe(true);
  });

  it('skips rows with non-finite predicted_score or unmapped actual_rating', () => {
    const result = computeCalibrationOffset([
      { predicted_score: 'garbage', actual_rating: 4 }, // skipped
      { predicted_score: 80, actual_rating: 99 }, // unmapped rating → skipped
      { predicted_score: 80, actual_rating: 4 }, // valid: diff = 0
      { predicted_score: 80, actual_rating: 4 }, // valid: diff = 0
    ]);
    expect(result.sampleSize).toBe(2);
    expect(result.offset).toBe(0);
  });
});
