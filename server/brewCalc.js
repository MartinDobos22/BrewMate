// Single source of truth for brew dose / water / yield / ratio normalization.
// IMPORTANT: Keep this module in lockstep with `src/utils/brewCalc.ts` —
// identical constants, rounding, and resolution rules on both sides.

export const DEFAULT_FILTER_RATIO = 15.5;
export const DEFAULT_ESPRESSO_RATIO = 2;

const toPositiveNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const roundOneDecimal = (value) =>
  value == null ? null : Math.round(Number(value) * 10) / 10;

const resolveTriplet = ({ first, second, ratio, defaultRatio, computeFirst, computeSecond }) => {
  const providedFirst = toPositiveNumber(first);
  const providedSecond = toPositiveNumber(second);
  const providedRatio = toPositiveNumber(ratio);

  const effectiveRatio = providedRatio ?? defaultRatio;

  let resolvedFirst = providedFirst;
  let resolvedSecond = providedSecond;

  if (resolvedFirst == null && resolvedSecond != null) {
    resolvedFirst = computeFirst(resolvedSecond, effectiveRatio);
  } else if (resolvedSecond == null && resolvedFirst != null) {
    resolvedSecond = computeSecond(resolvedFirst, effectiveRatio);
  }

  let resolvedRatio = providedRatio;
  if (resolvedRatio == null && resolvedFirst != null && resolvedSecond != null) {
    resolvedRatio = resolvedSecond / resolvedFirst;
  }
  if (resolvedRatio == null) {
    resolvedRatio = effectiveRatio;
  }

  return {
    first: roundOneDecimal(resolvedFirst),
    second: roundOneDecimal(resolvedSecond),
    ratio: roundOneDecimal(resolvedRatio),
    providedByUser: {
      first: providedFirst != null,
      second: providedSecond != null,
      ratio: providedRatio != null,
    },
  };
};

// Filter: `first` = dose (g), `second` = water (g/ml). Ratio = water / dose.
export const normalizeFilterBrew = ({ dose, water, ratio } = {}) => {
  const triplet = resolveTriplet({
    first: dose,
    second: water,
    ratio,
    defaultRatio: DEFAULT_FILTER_RATIO,
    computeFirst: (w, r) => w / r,
    computeSecond: (d, r) => d * r,
  });

  return {
    targetDoseG: triplet.first,
    targetWaterMl: triplet.second,
    targetRatio: triplet.ratio,
    providedByUser: {
      targetDoseG: triplet.providedByUser.first,
      targetWaterMl: triplet.providedByUser.second,
      targetRatio: triplet.providedByUser.ratio,
    },
  };
};

// Espresso: `first` = dose (g), `second` = yield (g). Ratio = yield / dose.
export const normalizeEspressoBrew = ({ dose, yieldG, ratio } = {}) => {
  const triplet = resolveTriplet({
    first: dose,
    second: yieldG,
    ratio,
    defaultRatio: DEFAULT_ESPRESSO_RATIO,
    computeFirst: (y, r) => y / r,
    computeSecond: (d, r) => d * r,
  });

  return {
    targetDoseG: triplet.first,
    targetYieldG: triplet.second,
    targetRatio: triplet.ratio,
    providedByUser: {
      targetDoseG: triplet.providedByUser.first,
      targetYieldG: triplet.providedByUser.second,
      targetRatio: triplet.providedByUser.ratio,
    },
  };
};

export const hasAnyFilterInput = ({ dose, water } = {}) =>
  toPositiveNumber(dose) != null || toPositiveNumber(water) != null;

export const hasAnyEspressoInput = ({ dose, yieldG } = {}) =>
  toPositiveNumber(dose) != null || toPositiveNumber(yieldG) != null;
