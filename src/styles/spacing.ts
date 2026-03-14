/**
 * 8pt spacing system for BrewMate MD3 design system.
 * All spacing values are multiples of BASE (8dp).
 */

const BASE = 8;

export const spacing = {
  /** 4dp — micro spacing */
  xs: BASE / 2,
  /** 8dp — small gaps */
  sm: BASE,
  /** 12dp — tile gutters */
  md: BASE * 1.5,
  /** 16dp — standard padding */
  lg: BASE * 2,
  /** 24dp — section spacing */
  xl: BASE * 3,
  /** 32dp — large spacing */
  xxl: BASE * 4,
  /** 48dp — major section breaks */
  xxxl: BASE * 6,
} as const;

/** Card/tile border radius — 16dp globally */
export const radii = {
  /** 8dp — small elements like chips */
  sm: BASE,
  /** 12dp — buttons, inputs */
  md: BASE * 1.5,
  /** 16dp — cards, tiles (default) */
  lg: BASE * 2,
  /** 24dp — large containers */
  xl: BASE * 3,
  /** Full round */
  full: 999,
} as const;

/** Elevation levels (MD3-compliant, minimal) */
export const elevation = {
  none: 0,
  level1: 1,
  level2: 2,
} as const;

export default spacing;
