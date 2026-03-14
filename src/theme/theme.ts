import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontFamily: 'System', fontSize: 45, lineHeight: 52, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontFamily: 'System', fontSize: 36, lineHeight: 44, fontWeight: '400' as const, letterSpacing: 0 },
  headlineLarge: { fontFamily: 'System', fontSize: 32, lineHeight: 40, fontWeight: '400' as const, letterSpacing: 0 },
  headlineMedium: { fontFamily: 'System', fontSize: 28, lineHeight: 36, fontWeight: '400' as const, letterSpacing: 0 },
  headlineSmall: { fontFamily: 'System', fontSize: 24, lineHeight: 32, fontWeight: '400' as const, letterSpacing: 0 },
  titleLarge: { fontFamily: 'System', fontSize: 22, lineHeight: 28, fontWeight: '400' as const, letterSpacing: 0 },
  titleMedium: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '500' as const, letterSpacing: 0.15 },
  titleSmall: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  bodyLarge: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  labelLarge: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontFamily: 'System', fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
};

/**
 * Extended theme with extra color tokens not in MD3Theme.colors
 * (surfaceLow, surfaceContainerHigh, surfaceContainerHighest, surfaceInverse, etc.)
 */
export type BrewMateExtraColors = {
  surfaceLow: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceInverse: string;
  primaryAlpha8: string;
  primaryAlpha12: string;
  /** Color token aliases for easy container lookup */
  primaryContainer: string;
  secondaryContainer: string;
  tertiaryContainer: string;
  errorContainer: string;
  onPrimaryContainer: string;
  onSecondaryContainer: string;
  onTertiaryContainer: string;
  onErrorContainer: string;
};

export const brewMateTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 28,
  colors: {
    ...MD3LightTheme.colors,

    // Primary — Espresso
    primary: '#6B4226',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFDCC2',
    onPrimaryContainer: '#241100',

    // Secondary — Macchiato
    secondary: '#77574A',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#FFDBD1',
    onSecondaryContainer: '#2C1510',

    // Tertiary — Cardamom Sage
    tertiary: '#4A6130',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#CBE6AC',
    onTertiaryContainer: '#112000',

    // Error
    error: '#BA1A1A',
    onError: '#FFFFFF',
    errorContainer: '#FFDAD6',
    onErrorContainer: '#410002',

    // Background & surface
    background: '#FFF8F5',
    onBackground: '#1E1410',
    surface: '#FFF8F5',
    onSurface: '#1E1410',
    surfaceVariant: '#F4EAE3',
    onSurfaceVariant: '#4F3F39',
    surfaceDisabled: 'rgba(30, 20, 16, 0.12)',
    onSurfaceDisabled: 'rgba(30, 20, 16, 0.38)',

    // Outline
    outline: '#85736B',
    outlineVariant: '#D7C2BB',

    // Inverse
    inverseSurface: '#382E2A',
    inverseOnSurface: '#FFF8F5',
    inversePrimary: '#FFDCC2',

    // Elevation overlays
    elevation: {
      level0: 'transparent',
      level1: '#FFF8F5',
      level2: '#FBF1EB',
      level3: '#F4EAE3',
      level4: '#EDE3DC',
      level5: '#E6DCD5',
    },

    // Other
    shadow: 'transparent',
    scrim: '#000000',
    backdrop: 'rgba(56, 46, 42, 0.4)',
  },
  fonts: configureFonts({ config: fontConfig }),
};

/**
 * Extra color tokens not in the default MD3Theme.
 * Use these via `import { extraColors } from '../theme/theme'`.
 */
export const extraColors: BrewMateExtraColors = {
  surfaceLow: '#FBF1EB',
  surfaceContainerHigh: '#EDE3DC',
  surfaceContainerHighest: '#E6DCD5',
  surfaceInverse: '#382E2A',
  primaryAlpha8: 'rgba(107,66,38,0.08)',
  primaryAlpha12: 'rgba(107,66,38,0.12)',
  primaryContainer: '#FFDCC2',
  secondaryContainer: '#FFDBD1',
  tertiaryContainer: '#CBE6AC',
  errorContainer: '#FFDAD6',
  onPrimaryContainer: '#241100',
  onSecondaryContainer: '#2C1510',
  onTertiaryContainer: '#112000',
  onErrorContainer: '#410002',
};

export type AppTheme = typeof brewMateTheme;
