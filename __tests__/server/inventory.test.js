import {
  APPROVAL_THRESHOLD,
  BREW_METHODS,
  COFFEE_STATUSES,
  CONSUMPTION_SOURCES,
  JOURNAL_BREW_METHODS,
  TRACKING_MODES,
  buildLocalSummary,
  buildRecipeInsightsSummary,
  mapCoffeeRow,
  mapJournalRow,
  mapSavedRecipeRow,
  mapScanRow,
  toNonNegativeInteger,
  toPositiveInteger,
  toRatingInteger,
} from '../../server/inventory.js';

// ---------------------------------------------------------------------------
// Business-rule constants — pin them so accidental changes break loudly.
// ---------------------------------------------------------------------------

describe('inventory constants', () => {
  it('COFFEE_STATUSES is exactly active|empty|archived', () => {
    expect([...COFFEE_STATUSES].sort()).toEqual([
      'active',
      'archived',
      'empty',
    ]);
  });

  it('TRACKING_MODES is exactly manual|estimated', () => {
    expect([...TRACKING_MODES].sort()).toEqual(['estimated', 'manual']);
  });

  it('BREW_METHODS is exactly espresso|filter|other', () => {
    expect([...BREW_METHODS].sort()).toEqual(['espresso', 'filter', 'other']);
  });

  it('JOURNAL_BREW_METHODS contains all supported brew methods', () => {
    const expected = [
      'aeropress',
      'cold_brew',
      'espresso',
      'french_press',
      'moka',
      'other',
      'v60',
    ];
    expect([...JOURNAL_BREW_METHODS].sort()).toEqual(expected);
  });

  it('CONSUMPTION_SOURCES covers all UI entry points for gram tracking', () => {
    expect([...CONSUMPTION_SOURCES].sort()).toEqual([
      'adjustment',
      'custom',
      'quick_action',
      'recipe_log',
      'slider',
    ]);
  });

  it('APPROVAL_THRESHOLD is 70 — recipes below this score must be rejected', () => {
    expect(APPROVAL_THRESHOLD).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// toPositiveInteger — coerce to integer > 0 or null
// ---------------------------------------------------------------------------

describe('toPositiveInteger', () => {
  it('returns the value when given a positive integer', () => {
    expect(toPositiveInteger(1)).toBe(1);
    expect(toPositiveInteger(250)).toBe(250);
  });

  it('parses positive integer strings', () => {
    expect(toPositiveInteger('42')).toBe(42);
    expect(toPositiveInteger('1')).toBe(1);
  });

  it('returns null for zero', () => {
    expect(toPositiveInteger(0)).toBeNull();
    expect(toPositiveInteger('0')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(toPositiveInteger(-1)).toBeNull();
    expect(toPositiveInteger('-5')).toBeNull();
  });

  it('returns null for non-integer numbers', () => {
    expect(toPositiveInteger(1.5)).toBeNull();
    expect(toPositiveInteger(NaN)).toBeNull();
    expect(toPositiveInteger(Infinity)).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(toPositiveInteger('abc')).toBeNull();
    expect(toPositiveInteger('')).toBeNull();
  });

  it('returns null for null / undefined / objects', () => {
    expect(toPositiveInteger(null)).toBeNull();
    expect(toPositiveInteger(undefined)).toBeNull();
    expect(toPositiveInteger({})).toBeNull();
    expect(toPositiveInteger([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toNonNegativeInteger — coerce to integer >= 0 or null
// ---------------------------------------------------------------------------

describe('toNonNegativeInteger', () => {
  it('accepts zero (the key difference from toPositiveInteger)', () => {
    expect(toNonNegativeInteger(0)).toBe(0);
    expect(toNonNegativeInteger('0')).toBe(0);
  });

  it('accepts positive integers and integer strings', () => {
    expect(toNonNegativeInteger(7)).toBe(7);
    expect(toNonNegativeInteger('123')).toBe(123);
  });

  it('rejects negatives', () => {
    expect(toNonNegativeInteger(-1)).toBeNull();
    expect(toNonNegativeInteger('-1')).toBeNull();
  });

  it('rejects floats and garbage', () => {
    expect(toNonNegativeInteger(0.5)).toBeNull();
    expect(toNonNegativeInteger('abc')).toBeNull();
    expect(toNonNegativeInteger(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// toRatingInteger — coerce to integer in 1..5 or null
// ---------------------------------------------------------------------------

describe('toRatingInteger', () => {
  it('accepts integers 1 through 5 inclusive', () => {
    [1, 2, 3, 4, 5].forEach(n => expect(toRatingInteger(n)).toBe(n));
  });

  it('parses string ratings', () => {
    expect(toRatingInteger('4')).toBe(4);
  });

  it('rejects 0 and values above 5', () => {
    expect(toRatingInteger(0)).toBeNull();
    expect(toRatingInteger(6)).toBeNull();
    expect(toRatingInteger('10')).toBeNull();
  });

  it('rejects negatives and non-integers', () => {
    expect(toRatingInteger(-1)).toBeNull();
    expect(toRatingInteger(3.5)).toBeNull();
    expect(toRatingInteger(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapCoffeeRow — DB row → DTO
// ---------------------------------------------------------------------------

describe('mapCoffeeRow', () => {
  it('maps snake_case columns to camelCase fields', () => {
    const row = {
      id: 'coffee-1',
      raw_text: 'raw',
      corrected_text: 'corrected',
      coffee_profile: { roast: 'medium' },
      ai_match_result: { score: 90 },
      has_image: true,
      loved: 1, // truthy but not boolean — should be coerced
      package_size_g: 250,
      remaining_g: 100,
      opened_at: '2026-04-01T00:00:00Z',
      status: 'active',
      tracking_mode: 'manual',
      preferred_dose_g: 18,
      brew_method_default: 'espresso',
      last_consumed_at: '2026-04-30T10:00:00Z',
      created_at: '2026-04-01T00:00:00Z',
    };
    const dto = mapCoffeeRow(row);

    expect(dto.id).toBe('coffee-1');
    expect(dto.coffeeProfile).toEqual({ roast: 'medium' });
    expect(dto.aiMatchResult).toEqual({ score: 90 });
    expect(dto.packageSizeG).toBe(250);
    expect(dto.remainingG).toBe(100);
    expect(dto.preferredDoseG).toBe(18);
    expect(dto.brewMethodDefault).toBe('espresso');
  });

  it('coerces loved and has_image to booleans', () => {
    const dto = mapCoffeeRow({ loved: 1, has_image: 0 });
    expect(dto.loved).toBe(true);
    expect(dto.hasImage).toBe(false);
    expect(typeof dto.loved).toBe('boolean');
    expect(typeof dto.hasImage).toBe('boolean');
  });

  it('always returns labelImageBase64=null (image now lives in storage)', () => {
    expect(mapCoffeeRow({}).labelImageBase64).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapJournalRow
// ---------------------------------------------------------------------------

describe('mapJournalRow', () => {
  it('maps brew journal columns', () => {
    const dto = mapJournalRow({
      id: 'j-1',
      user_coffee_id: 'c-1',
      brew_method: 'v60',
      dose_g: 15,
      brew_time_seconds: 180,
      taste_rating: 4,
      notes: 'fruity',
      created_at: '2026-05-01T00:00:00Z',
      coffee_name: 'Ethiopia Yirgacheffe',
      origin: 'Ethiopia',
      roast_level: 'light',
    });

    expect(dto).toEqual({
      id: 'j-1',
      userCoffeeId: 'c-1',
      method: 'v60',
      doseG: 15,
      brewTimeSeconds: 180,
      tasteRating: 4,
      notes: 'fruity',
      createdAt: '2026-05-01T00:00:00Z',
      coffeeName: 'Ethiopia Yirgacheffe',
      origin: 'Ethiopia',
      roastLevel: 'light',
    });
  });
});

// ---------------------------------------------------------------------------
// mapScanRow
// ---------------------------------------------------------------------------

describe('mapScanRow', () => {
  it('maps OCR scan columns', () => {
    const dto = mapScanRow({
      id: 's-1',
      raw_text: 'Lavazza',
      corrected_text: 'Lavazza Crema',
      coffee_profile: { roast: 'medium' },
      ai_match_result: { score: 75 },
      algorithm_version: 'v3',
      created_at: '2026-04-30T00:00:00Z',
    });

    expect(dto).toEqual({
      id: 's-1',
      rawText: 'Lavazza',
      correctedText: 'Lavazza Crema',
      coffeeProfile: { roast: 'medium' },
      aiMatchResult: { score: 75 },
      algorithmVersion: 'v3',
      createdAt: '2026-04-30T00:00:00Z',
    });
  });
});

// ---------------------------------------------------------------------------
// mapSavedRecipeRow
// ---------------------------------------------------------------------------

describe('mapSavedRecipeRow', () => {
  it('maps recipe row including feedback fields', () => {
    const dto = mapSavedRecipeRow({
      id: 'r-1',
      title: 'Morning V60',
      method: 'v60',
      strength_preference: 'medium',
      dose: 15,
      water: 250,
      total_time: 180,
      taste_profile: 'balanced',
      flavor_notes: ['citrus', 'honey'],
      like_score: 85,
      approved: true,
      created_at: '2026-04-30T00:00:00Z',
      actual_rating: 4,
      feedback_notes: 'great',
    });

    expect(dto.flavorNotes).toEqual(['citrus', 'honey']);
    expect(dto.approved).toBe(true);
    expect(dto.actualRating).toBe(4);
    expect(dto.feedbackNotes).toBe('great');
  });

  it('defaults flavorNotes to [] when DB returns non-array', () => {
    expect(mapSavedRecipeRow({ flavor_notes: null }).flavorNotes).toEqual([]);
    expect(mapSavedRecipeRow({ flavor_notes: undefined }).flavorNotes).toEqual(
      [],
    );
    expect(mapSavedRecipeRow({}).flavorNotes).toEqual([]);
  });

  it('defaults actualRating and feedbackNotes to null when missing', () => {
    const dto = mapSavedRecipeRow({});
    expect(dto.actualRating).toBeNull();
    expect(dto.feedbackNotes).toBeNull();
  });

  it('coerces approved to boolean', () => {
    expect(mapSavedRecipeRow({ approved: 1 }).approved).toBe(true);
    expect(mapSavedRecipeRow({ approved: 0 }).approved).toBe(false);
    expect(mapSavedRecipeRow({ approved: null }).approved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildLocalSummary — Slovak journal stats text
// ---------------------------------------------------------------------------

describe('buildLocalSummary', () => {
  const emptyTotals = {
    logsCount: 0,
    methods: [],
    origins: [],
    roasts: [],
    bestRatedMethods: [],
  };

  it('returns the empty-state Slovak message when there are no logs', () => {
    const text = buildLocalSummary({ days: 7, totals: emptyTotals });
    expect(text).toBe(
      'Za posledných 7 dní zatiaľ nemáš žiadny záznam prípravy.',
    );
  });

  it('includes log count in the summary', () => {
    const text = buildLocalSummary({
      days: 30,
      totals: { ...emptyTotals, logsCount: 12 },
    });
    expect(text).toContain('30');
    expect(text).toContain('12');
  });

  it('includes top method when present', () => {
    const text = buildLocalSummary({
      days: 7,
      totals: {
        ...emptyTotals,
        logsCount: 5,
        methods: [{ label: 'V60', count: 3 }],
      },
    });
    expect(text).toContain('V60');
    expect(text).toContain('3x');
  });

  it('includes best-rated method with avg formatted to 1 decimal', () => {
    const text = buildLocalSummary({
      days: 7,
      totals: {
        ...emptyTotals,
        logsCount: 5,
        bestRatedMethods: [{ label: 'AeroPress', avgRating: 4.6666 }],
      },
    });
    expect(text).toContain('AeroPress');
    expect(text).toContain('4.7/5');
  });

  it('skips missing optional fields gracefully', () => {
    const text = buildLocalSummary({
      days: 7,
      totals: { ...emptyTotals, logsCount: 1 },
    });
    expect(text.startsWith('Za posledných 7 dní')).toBe(true);
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});

// ---------------------------------------------------------------------------
// buildRecipeInsightsSummary
// ---------------------------------------------------------------------------

describe('buildRecipeInsightsSummary', () => {
  const emptyTotals = {
    recipesCount: 0,
    methods: [],
    strengths: [],
    tasteProfiles: [],
  };

  it('returns the empty-state Slovak message when no approved recipes', () => {
    const text = buildRecipeInsightsSummary({ days: 14, totals: emptyTotals });
    expect(text).toBe(
      'Za posledných 14 dní zatiaľ nemáš uložený žiadny schválený recept.',
    );
  });

  it('includes recipe count and top picks', () => {
    const text = buildRecipeInsightsSummary({
      days: 7,
      totals: {
        recipesCount: 3,
        methods: [{ label: 'Espresso', count: 2 }],
        strengths: [{ label: 'silná' }],
        tasteProfiles: [{ label: 'sladkokyslý' }],
      },
    });
    expect(text).toContain('3');
    expect(text).toContain('Espresso');
    expect(text).toContain('silná');
    expect(text).toContain('sladkokyslý');
  });

  it('skips missing optional fields gracefully', () => {
    const text = buildRecipeInsightsSummary({
      days: 7,
      totals: { ...emptyTotals, recipesCount: 1 },
    });
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});
