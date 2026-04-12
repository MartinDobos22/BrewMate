import { DefaultTheme, Theme } from '@react-navigation/native';

/* ---------------------------------------------------------------------------
 * Material Design 3 — coffee theme
 * ---------------------------------------------------------------------------
 * Hand-picked tonal palettes for the BrewMate brand:
 *   - primary   : espresso (warm dark brown)
 *   - secondary : caramel / latte
 *   - tertiary  : matcha / coffee-leaf green
 *   - neutral   : warm bean neutral
 *
 * Each palette exposes the standard MD3 tones (0 / 10 / 20 / 30 / 40 / 50 /
 * 60 / 70 / 80 / 90 / 95 / 99 / 100). The semantic color schemes that screens
 * consume (`lightColorScheme`, `darkColorScheme`) are built on top of them.
 * ------------------------------------------------------------------------- */

const espresso = {
  0: '#000000',
  10: '#2A1A0F',
  20: '#43291A',
  30: '#5B3D29',
  40: '#6B4F3A',
  50: '#826149',
  60: '#9B7A5F',
  70: '#B59478',
  80: '#D1AE92',
  90: '#EECAAE',
  95: '#FADDC2',
  99: '#FFF8F3',
  100: '#FFFFFF',
} as const;

const caramel = {
  0: '#000000',
  10: '#2F1F0F',
  20: '#4B3520',
  30: '#664A30',
  40: '#86643F',
  50: '#A07D55',
  60: '#BB976D',
  70: '#D6B186',
  80: '#F0CCA0',
  90: '#FFE2BF',
  95: '#FFEFD9',
  99: '#FFFBF6',
  100: '#FFFFFF',
} as const;

const matcha = {
  0: '#000000',
  10: '#0F1E10',
  20: '#1D3420',
  30: '#2D4B30',
  40: '#4A6B4C',
  50: '#60866A',
  60: '#7BA185',
  70: '#96BCA0',
  80: '#B1D8BC',
  90: '#CDF4D8',
  95: '#E5FFEB',
  99: '#F7FFF8',
  100: '#FFFFFF',
} as const;

const neutral = {
  0: '#000000',
  10: '#1C1712',
  20: '#322B24',
  30: '#493F35',
  40: '#615547',
  50: '#7A6E5F',
  60: '#948879',
  70: '#AFA293',
  80: '#CBBDAD',
  90: '#E8D9C9',
  95: '#F6E8D7',
  99: '#FFF8EF',
  100: '#FFFFFF',
} as const;

const neutralVariant = {
  0: '#000000',
  10: '#1E1811',
  20: '#342D24',
  30: '#4B4339',
  40: '#635A4F',
  50: '#7D7366',
  60: '#978C7F',
  70: '#B2A698',
  80: '#CEC1B3',
  90: '#EBDDCE',
  95: '#FAECDD',
  99: '#FFF9F3',
  100: '#FFFFFF',
} as const;

const errorRamp = {
  10: '#410E0B',
  20: '#601410',
  30: '#8C1D18',
  40: '#B3261E',
  80: '#F2B8B5',
  90: '#F9DEDC',
  95: '#FCEEEE',
  99: '#FFFBFA',
} as const;

/* ---------------------------------------------------------------------------
 * Semantic color schemes (the shape screens consume via `appTheme.colors`).
 * ------------------------------------------------------------------------- */

export type ColorScheme = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;

  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;

  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;

  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;

  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;

  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;

  outline: string;
  outlineVariant: string;

  inverseSurface: string;
  inverseOnSurface: string;
  inversePrimary: string;

  shadow: string;
  scrim: string;
  surfaceTint: string;
};

export const lightColorScheme: ColorScheme = {
  primary: espresso[40],
  onPrimary: espresso[100],
  primaryContainer: espresso[90],
  onPrimaryContainer: espresso[10],

  secondary: caramel[40],
  onSecondary: caramel[100],
  secondaryContainer: caramel[90],
  onSecondaryContainer: caramel[10],

  tertiary: matcha[40],
  onTertiary: matcha[100],
  tertiaryContainer: matcha[90],
  onTertiaryContainer: matcha[10],

  error: errorRamp[40],
  onError: '#FFFFFF',
  errorContainer: errorRamp[90],
  onErrorContainer: errorRamp[10],

  background: neutral[99],
  onBackground: neutral[10],
  surface: neutral[99],
  onSurface: neutral[10],
  surfaceVariant: neutralVariant[90],
  onSurfaceVariant: neutralVariant[30],

  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#FFF3E5',
  surfaceContainer: '#F9ECD7',
  surfaceContainerHigh: '#F3E4CB',
  surfaceContainerHighest: '#EDDBBE',

  outline: neutralVariant[50],
  outlineVariant: neutralVariant[80],

  inverseSurface: neutral[20],
  inverseOnSurface: neutral[95],
  inversePrimary: espresso[80],

  shadow: '#000000',
  scrim: '#000000',
  surfaceTint: espresso[40],
};

export const darkColorScheme: ColorScheme = {
  primary: espresso[80],
  onPrimary: espresso[20],
  primaryContainer: espresso[30],
  onPrimaryContainer: espresso[90],

  secondary: caramel[80],
  onSecondary: caramel[20],
  secondaryContainer: caramel[30],
  onSecondaryContainer: caramel[90],

  tertiary: matcha[80],
  onTertiary: matcha[20],
  tertiaryContainer: matcha[30],
  onTertiaryContainer: matcha[90],

  error: errorRamp[80],
  onError: errorRamp[20],
  errorContainer: errorRamp[30],
  onErrorContainer: errorRamp[90],

  background: neutral[10],
  onBackground: neutral[90],
  surface: neutral[10],
  onSurface: neutral[90],
  surfaceVariant: neutralVariant[30],
  onSurfaceVariant: neutralVariant[80],

  surfaceContainerLowest: '#0F0B07',
  surfaceContainerLow: '#241D16',
  surfaceContainer: '#28211A',
  surfaceContainerHigh: '#332A21',
  surfaceContainerHighest: '#3E3428',

  outline: neutralVariant[60],
  outlineVariant: neutralVariant[30],

  inverseSurface: neutral[90],
  inverseOnSurface: neutral[20],
  inversePrimary: espresso[40],

  shadow: '#000000',
  scrim: '#000000',
  surfaceTint: espresso[80],
};

/* ---------------------------------------------------------------------------
 * Elevation — MD3 approximates elevation with tonal overlay + shadow. In
 * React Native we ship both: a tint opacity (applied with `surfaceTint`) and
 * a platform-friendly shadow payload that can be spread into a StyleSheet.
 * ------------------------------------------------------------------------- */

export type ElevationLevel = 'level0' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5';

export const elevation: Record<
  ElevationLevel,
  {
    tint: number;
    shadow: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  }
> = {
  level0: {
    tint: 0,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
  },
  level1: {
    tint: 0.05,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  },
  level2: {
    tint: 0.08,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
  },
  level3: {
    tint: 0.11,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  },
  level4: {
    tint: 0.12,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
  },
  level5: {
    tint: 0.14,
    shadow: {
      shadowColor: '#000000',
      shadowOpacity: 0.18,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
  },
};

/* ---------------------------------------------------------------------------
 * Shape scale.
 * ------------------------------------------------------------------------- */

export const shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  extraLarge2: 32,
  full: 9999,
} as const;

/* ---------------------------------------------------------------------------
 * Typescale — MD3 type roles.
 * ------------------------------------------------------------------------- */

export const typescale = {
  displayLarge: { fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontSize: 45, lineHeight: 52, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontSize: 36, lineHeight: 44, fontWeight: '400' as const, letterSpacing: 0 },
  headlineLarge: { fontSize: 32, lineHeight: 40, fontWeight: '600' as const, letterSpacing: 0 },
  headlineMedium: { fontSize: 28, lineHeight: 36, fontWeight: '600' as const, letterSpacing: 0 },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: 0 },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: 0 },
  titleMedium: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.15 },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, letterSpacing: 0.1 },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.5 },
} as const;

/* ---------------------------------------------------------------------------
 * State layer opacities (press / focus / hover overlays).
 * ------------------------------------------------------------------------- */

export const stateLayer = {
  hover: 0.08,
  focus: 0.12,
  pressed: 0.12,
  dragged: 0.16,
} as const;

/* ---------------------------------------------------------------------------
 * Spacing scale.
 * ------------------------------------------------------------------------- */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

/* ---------------------------------------------------------------------------
 * Legacy exports — kept so the 13 other screens that still read `palette`
 * / `typography` do not break while we migrate the app piece-by-piece.
 * ------------------------------------------------------------------------- */

export const palette = {
  background: lightColorScheme.background,
  primary: lightColorScheme.primary,
  secondary: lightColorScheme.secondary,
  surface: lightColorScheme.surface,
  outline: lightColorScheme.outline,
  error: lightColorScheme.error,
  onPrimary: lightColorScheme.onPrimary,
  text: lightColorScheme.onBackground,
  mutedText: lightColorScheme.onSurfaceVariant,
};

export const typography = {
  display: typescale.headlineLarge,
  headline: typescale.headlineSmall,
  title: typescale.titleMedium,
  body: typescale.bodyLarge,
  label: typescale.labelLarge,
};

/* ---------------------------------------------------------------------------
 * Aggregate theme object + navigation theme.
 * ------------------------------------------------------------------------- */

export const appTheme = {
  colors: lightColorScheme,
  elevation,
  shape,
  typescale,
  stateLayer,
  spacing,
  typography,
};

export type AppTheme = typeof appTheme;

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: lightColorScheme.background,
    card: lightColorScheme.surfaceContainerLow,
    border: lightColorScheme.outlineVariant,
    primary: lightColorScheme.primary,
    text: lightColorScheme.onBackground,
    notification: lightColorScheme.error,
  },
};
