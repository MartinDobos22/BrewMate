import type { ColorValue } from 'react-native';

/**
 * Shared prop contract for every SVG icon in the `icons/` folder. Keeping
 * this minimal lets callers swap any icon for any other without touching
 * surrounding markup.
 */
export type IconProps = {
  /** Square size in pixels. Defaults to 24. */
  size?: number;
  /** Stroke / fill color. Defaults to the current theme's onSurface. */
  color?: ColorValue;
  /** Stroke width. Defaults to 2. */
  strokeWidth?: number;
  /** Render a filled variant (only respected by two-tone icons). */
  filled?: boolean;
};
