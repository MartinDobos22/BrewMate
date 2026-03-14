import { MD3LightTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';

const fontConfig = {
  displayLarge: { fontFamily: 'System', fontSize: 57, lineHeight: 64, fontWeight: '400' as const, letterSpacing: -0.25 },
  displayMedium: { fontFamily: 'System', fontSize: 45, lineHeight: 52, fontWeight: '400' as const, letterSpacing: 0 },
  displaySmall: { fontFamily: 'System', fontSize: 36, lineHeight: 44, fontWeight: '400' as const, letterSpacing: 0 },
  headlineLarge: { fontFamily: 'System', fontSize: 32, lineHeight: 40, fontWeight: '400' as const, letterSpacing: 0 },
  headlineMedium: { fontFamily: 'System', fontSize: 28, lineHeight: 36, fontWeight: '400' as const, letterSpacing: 0 },
  headlineSmall: { fontFamily: 'System', fontSize: 24, lineHeight: 32, fontWeight: '400' as const, letterSpacing: 0 },
  titleLarge: { fontFamily: 'System', fontSize: 22, lineHeight: 28, fontWeight: '500' as const, letterSpacing: 0 },
  titleMedium: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '500' as const, letterSpacing: 0.15 },
  titleSmall: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  bodyLarge: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '400' as const, letterSpacing: 0.5 },
  bodyMedium: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '400' as const, letterSpacing: 0.25 },
  bodySmall: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.4 },
  labelLarge: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '500' as const, letterSpacing: 0.1 },
  labelMedium: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
  labelSmall: { fontFamily: 'System', fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.5 },
};

export const brewMateTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,

    // Primary — soft coffee brown
    primary: '#6B4F3A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#D9C4B0',
    onPrimaryContainer: '#2C1A0E',

    // Secondary — muted sage green
    secondary: '#8A9A5B',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#D6E4A1',
    onSecondaryContainer: '#2E3A10',

    // Tertiary
    tertiary: '#7D5260',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFD8E4',
    onTertiaryContainer: '#31111D',

    // Error
    error: '#B3261E',
    onError: '#FFFFFF',
    errorContainer: '#F9DEDC',
    onErrorContainer: '#410E0B',

    // Background & surface
    background: '#F6F3EE',
    onBackground: '#1C1B1F',
    surface: '#FFFFFF',
    onSurface: '#1C1B1F',
    surfaceVariant: '#EDE8E1',
    onSurfaceVariant: '#49454F',
    surfaceDisabled: 'rgba(28, 27, 31, 0.12)',
    onSurfaceDisabled: 'rgba(28, 27, 31, 0.38)',

    // Outline
    outline: '#C4BDB5',
    outlineVariant: '#E0D9D1',

    // Inverse
    inverseSurface: '#313033',
    inverseOnSurface: '#F4EFF4',
    inversePrimary: '#D9C4B0',

    // Elevation overlays
    elevation: {
      level0: 'transparent',
      level1: '#F9F6F1',
      level2: '#F4F0EA',
      level3: '#EFEBE4',
      level4: '#EDE8E1',
      level5: '#EAE5DD',
    },

    // Other
    shadow: 'transparent',
    scrim: '#000000',
    backdrop: 'rgba(50, 47, 55, 0.4)',
  },
  fonts: configureFonts({ config: fontConfig }),
};

export type AppTheme = typeof brewMateTheme;
