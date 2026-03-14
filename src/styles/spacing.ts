/**
 * 8pt spacing system for BrewMate MD3 design system.
 * All spacing values are multiples of BASE (8dp).
 */

const BASE = 8;

export const spacing = {
  /** 4dp — micro spacing */
  xs: BASE / 2,
  /** 8dp — small gaps, bento grid gap */
  sm: BASE,
  /** 12dp — tile gutters */
  md: BASE * 1.5,
  /** 16dp — standard padding, bento padding */
  lg: BASE * 2,
  /** 24dp — section spacing */
  xl: BASE * 3,
  /** 32dp — large spacing */
  xxl: BASE * 4,
  /** 48dp — major section breaks */
  xxxl: BASE * 6,
} as const;

/** Shape tokens matching MD3 design spec */
export const radii = {
  /** 4dp — extra small (badges) */
  xs: 4,
  /** 8dp — small elements like chips, badge */
  sm: BASE,
  /** 12dp — buttons, inputs, icons */
  md: BASE * 1.5,
  /** 16dp — medium containers */
  lg: BASE * 2,
  /** 28dp — cards, tiles (default) */
  xl: 28,
  /** Full round (pills, avatars) */
  full: 999,
} as const;

/** Elevation levels (MD3-compliant, minimal) */
export const elevation = {
  none: 0,
  level1: 1,
  level2: 2,
} as const;

export default spacing;
