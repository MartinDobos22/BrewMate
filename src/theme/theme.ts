import { DefaultTheme, Theme } from '@react-navigation/native';

export const palette = {
  background: '#F6F3EE',
  primary: '#6B4F3A',
  secondary: '#8A9A5B',
  surface: '#FFFFFF',
  outline: '#B7B7B7',
  error: '#B3261E',
  onPrimary: '#FFFFFF',
  text: '#3E2F25',
  mutedText: '#6F6A64',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shape = {
  radius: 16,
};

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  headline: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
};

export const appTheme = {
  colors: palette,
  spacing,
  shape,
  typography,
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
