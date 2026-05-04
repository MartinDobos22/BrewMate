import {
  parseOptionalPositive,
  normalizeFilterBrew,
  normalizeEspressoBrew,
  hasAnyFilterInput,
  hasAnyEspressoInput,
  DEFAULT_FILTER_RATIO,
  DEFAULT_ESPRESSO_RATIO,
} from '../../../src/utils/brewCalc';

describe('parseOptionalPositive', () => {
  it('parses valid numbers', () => {
    expect(parseOptionalPositive(15)).toBe(15);
    expect(parseOptionalPositive('18.5')).toBe(18.5);
    expect(parseOptionalPositive('18,5')).toBe(18.5);
  });

  it('returns null for non-positive or invalid values', () => {
    expect(parseOptionalPositive(0)).toBeNull();
    expect(parseOptionalPositive(-1)).toBeNull();
    expect(parseOptionalPositive('')).toBeNull();
    expect(parseOptionalPositive(null)).toBeNull();
    expect(parseOptionalPositive(undefined)).toBeNull();
    expect(parseOptionalPositive('abc')).toBeNull();
  });
});

describe('normalizeFilterBrew', () => {
  it('returns defaults when no input provided', () => {
    const result = normalizeFilterBrew({});
    expect(result.targetRatio).toBe(DEFAULT_FILTER_RATIO);
    expect(result.providedByUser.targetRatio).toBe(false);
  });

  it('resolves water from dose and ratio', () => {
    const result = normalizeFilterBrew({ dose: 15, ratio: 16 });
    expect(result.targetDoseG).toBe(15);
    expect(result.targetWaterMl).toBe(240);
    expect(result.targetRatio).toBe(16);
  });

  it('resolves dose from water and ratio', () => {
    const result = normalizeFilterBrew({
      water: 250,
      ratio: DEFAULT_FILTER_RATIO,
    });
    expect(result.targetDoseG).not.toBeNull();
    expect(result.targetWaterMl).toBe(250);
  });

  it('marks user-provided fields', () => {
    const result = normalizeFilterBrew({ dose: 15, water: 250 });
    expect(result.providedByUser.targetDoseG).toBe(true);
    expect(result.providedByUser.targetWaterMl).toBe(true);
  });
});

describe('normalizeEspressoBrew', () => {
  it('returns defaults when no input provided', () => {
    const result = normalizeEspressoBrew({});
    expect(result.targetRatio).toBe(DEFAULT_ESPRESSO_RATIO);
  });

  it('resolves yield from dose and ratio', () => {
    const result = normalizeEspressoBrew({ dose: 18, ratio: 2 });
    expect(result.targetDoseG).toBe(18);
    expect(result.targetYieldG).toBe(36);
  });
});

describe('hasAnyFilterInput', () => {
  it('returns false for empty input', () => {
    expect(hasAnyFilterInput({})).toBe(false);
  });

  it('returns true when any field is provided', () => {
    expect(hasAnyFilterInput({ dose: 15 })).toBe(true);
    expect(hasAnyFilterInput({ water: 250 })).toBe(true);
    // ratio alone does not trigger the flag — implementation only checks dose + water
    expect(hasAnyFilterInput({ ratio: 16 })).toBe(false);
  });
});

describe('hasAnyEspressoInput', () => {
  it('returns false for empty input', () => {
    expect(hasAnyEspressoInput({})).toBe(false);
  });

  it('returns true when any field is provided', () => {
    expect(hasAnyEspressoInput({ dose: 18 })).toBe(true);
  });
});
