// Single source of truth for brew dose / water / yield / ratio normalization.
// IMPORTANT: Keep this module in lockstep with `server/brewCalc.js` —
// identical constants, rounding, and resolution rules on both sides.

export const DEFAULT_FILTER_RATIO = 15.5;
export const DEFAULT_ESPRESSO_RATIO = 2;

export type FilterBrewInput = {
  dose?: string | number | null;
  water?: string | number | null;
  ratio?: string | number | null;
};

export type EspressoBrewInput = {
  dose?: string | number | null;
  yieldG?: string | number | null;
  ratio?: string | number | null;
};

export type FilterBrewPreferences = {
  targetDoseG: number | null;
  targetWaterMl: number | null;
  targetRatio: number | null;
  providedByUser: {
    targetDoseG: boolean;
    targetWaterMl: boolean;
    targetRatio: boolean;
  };
};

export type EspressoBrewPreferences = {
  targetDoseG: number | null;
  targetYieldG: number | null;
  targetRatio: number | null;
  providedByUser: {
    targetDoseG: boolean;
    targetYieldG: boolean;
    targetRatio: boolean;
  };
};

export const parseOptionalPositive = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const raw = typeof value === 'string' ? value.replace(',', '.').trim() : value;
  if (raw === '' || raw === null) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
};

const roundOneDecimal = (value: number | null): number | null =>
  value == null ? null : Math.round(value * 10) / 10;

type ResolveArgs = {
  first: unknown;
  second: unknown;
  ratio: unknown;
  defaultRatio: number;
  computeFirst: (second: number, ratio: number) => number;
  computeSecond: (first: number, ratio: number) => number;
};

type ResolvedTriplet = {
  first: number | null;
  second: number | null;
  ratio: number | null;
  providedByUser: { first: boolean; second: boolean; ratio: boolean };
};

const resolveTriplet = ({
  first,
  second,
  ratio,
  defaultRatio,
  computeFirst,
  computeSecond,
}: ResolveArgs): ResolvedTriplet => {
  const providedFirst = parseOptionalPositive(first);
  const providedSecond = parseOptionalPositive(second);
  const providedRatio = parseOptionalPositive(ratio);

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

export const normalizeFilterBrew = (input: FilterBrewInput = {}): FilterBrewPreferences => {
  const triplet = resolveTriplet({
    first: input.dose,
    second: input.water,
    ratio: input.ratio,
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

export const normalizeEspressoBrew = (input: EspressoBrewInput = {}): EspressoBrewPreferences => {
  const triplet = resolveTriplet({
    first: input.dose,
    second: input.yieldG,
    ratio: input.ratio,
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

export const hasAnyFilterInput = (input: FilterBrewInput = {}): boolean =>
  parseOptionalPositive(input.dose) != null ||
  parseOptionalPositive(input.water) != null;

export const hasAnyEspressoInput = (input: EspressoBrewInput = {}): boolean =>
  parseOptionalPositive(input.dose) != null ||
  parseOptionalPositive(input.yieldG) != null;
