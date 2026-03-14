import { DefaultTheme, Theme } from '@react-navigation/native';

export const palette = {
  background: '#FAFAFA',
  primary: '#2C2C2C',
  accent: '#8B7355',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F5F5',
  outline: '#E8E8E8',
  outlineLight: '#F0F0F0',
  error: '#D64545',
  success: '#4A9B6E',
  warning: '#C08B3E',
  onPrimary: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textTertiary: '#999999',
  shadow: 'rgba(0, 0, 0, 0.04)',
  shadowMedium: 'rgba(0, 0, 0, 0.08)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const shape = {
  radiusSm: 8,
  radius: 12,
  radiusMd: 16,
  radiusLg: 24,
  radiusFull: 999,
};

export const typography = {
  displayLg: { fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.5 },
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.3 },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const, letterSpacing: -0.2 },
  title: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.3, textTransform: 'uppercase' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMedium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
};

export const appTheme = {
  colors: palette,
  spacing,
  shape,
  typography,
  shadows,
};

export const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.background,
    card: palette.surface,
    border: palette.outline,
    primary: palette.primary,
    text: palette.text,
    notification: palette.error,
  },
};
