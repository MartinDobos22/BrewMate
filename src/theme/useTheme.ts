import { useColorScheme } from 'react-native';

import {
  appTheme,
  AppTheme,
  ColorScheme,
  darkColorScheme,
  lightColorScheme,
} from './theme';

/**
 * Returns the active MD3 theme. Swaps between light and dark color schemes
 * based on the device's color scheme preference. All other tokens
 * (elevation, shape, typescale, spacing, stateLayer) are shared across
 * schemes.
 */
export function useTheme(): AppTheme & { colors: ColorScheme; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColorScheme : lightColorScheme;

  return {
    ...appTheme,
    colors,
    isDark,
  };
}
