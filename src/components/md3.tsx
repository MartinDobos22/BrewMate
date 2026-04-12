import React, { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../theme/useTheme';
import { elevation, shape as shapeTokens } from '../theme/theme';

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export type ChipRole = 'neutral' | 'primary' | 'secondary' | 'tertiary' | 'error';

type ChipProps = {
  label: string;
  icon?: ReactNode;
  role?: ChipRole;
  style?: ViewStyle;
};

const CHIP_ROLE_TOKENS: Record<
  ChipRole,
  { bgKey: keyof ReturnType<typeof useTheme>['colors']; onKey: keyof ReturnType<typeof useTheme>['colors'] }
> = {
  neutral: { bgKey: 'surfaceContainerHigh', onKey: 'onSurface' },
  primary: { bgKey: 'primaryContainer', onKey: 'onPrimaryContainer' },
  secondary: { bgKey: 'secondaryContainer', onKey: 'onSecondaryContainer' },
  tertiary: { bgKey: 'tertiaryContainer', onKey: 'onTertiaryContainer' },
  error: { bgKey: 'errorContainer', onKey: 'onErrorContainer' },
};

function ChipInner({ label, icon, role = 'neutral', style }: ChipProps) {
  const { colors, typescale, shape } = useTheme();
  const tokens = CHIP_ROLE_TOKENS[role];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: shape.small,
          backgroundColor: colors[tokens.bgKey],
        },
        label: {
          ...typescale.labelMedium,
          color: colors[tokens.onKey],
        },
      }),
    [colors, shape.small, tokens.bgKey, tokens.onKey, typescale.labelMedium],
  );

  return (
    <View style={[styles.root, style]}>
      {icon}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export const Chip = React.memo(ChipInner);

// ---------------------------------------------------------------------------
// FAB
// ---------------------------------------------------------------------------

type FABProps = {
  icon: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel: string;
};

function FABInner({ icon, onPress, style, accessibilityLabel }: FABProps) {
  const { colors, shape, stateLayer } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          width: 56,
          height: 56,
          borderRadius: shape.large,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          ...elevation.level3.shadow,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onPrimaryContainer,
          opacity: stateLayer.pressed,
          borderRadius: shape.large,
        },
      }),
    [colors.onPrimaryContainer, colors.primaryContainer, shape.large, stateLayer.pressed],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          {icon}
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export const FAB = React.memo(FABInner);

// ---------------------------------------------------------------------------
// MD3Button
// ---------------------------------------------------------------------------

export type MD3ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text';

type MD3ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: MD3ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

function MD3ButtonInner({
  label,
  onPress,
  variant = 'filled',
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: MD3ButtonProps) {
  const { colors, shape, typescale, stateLayer } = useTheme();

  const styles = useMemo(() => {
    const isFilled = variant === 'filled';
    const isTonal = variant === 'tonal';
    const isOutlined = variant === 'outlined';

    const bg = isFilled
      ? colors.primary
      : isTonal
      ? colors.secondaryContainer
      : 'transparent';

    const fg = isFilled
      ? colors.onPrimary
      : isTonal
      ? colors.onSecondaryContainer
      : colors.primary;

    return StyleSheet.create({
      root: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        paddingHorizontal: variant === 'text' ? 12 : 24,
        borderRadius: shape.full,
        backgroundColor: bg,
        borderWidth: isOutlined ? 1 : 0,
        borderColor: colors.outline,
        opacity: disabled ? 0.4 : 1,
      },
      label: {
        ...typescale.labelLarge,
        color: fg,
      },
      pressedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: fg,
        opacity: stateLayer.pressed,
        borderRadius: shape.full,
      },
    });
  }, [colors, disabled, shape.full, stateLayer.pressed, typescale.labelLarge, variant]);

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          {icon}
          {loading ? (
            <ActivityIndicator size="small" color={styles.label.color as string} />
          ) : (
            <Text style={styles.label}>{label}</Text>
          )}
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export const MD3Button = React.memo(MD3ButtonInner);

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

export type TileRole = 'neutral' | 'primary' | 'secondary' | 'tertiary';

type TileProps = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  role?: TileRole;
  shape?: keyof typeof shapeTokens;
  minHeight?: number;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
};

const TILE_ROLE_TOKENS: Record<
  TileRole,
  { bgKey: keyof ReturnType<typeof useTheme>['colors']; onKey: keyof ReturnType<typeof useTheme>['colors'] }
> = {
  neutral: { bgKey: 'surfaceContainer', onKey: 'onSurface' },
  primary: { bgKey: 'primaryContainer', onKey: 'onPrimaryContainer' },
  secondary: { bgKey: 'secondaryContainer', onKey: 'onSecondaryContainer' },
  tertiary: { bgKey: 'tertiaryContainer', onKey: 'onTertiaryContainer' },
};

function TileInner({
  title,
  subtitle,
  icon,
  role = 'neutral',
  shape: shapeKey,
  minHeight,
  style,
  onPress,
  accessibilityLabel,
}: TileProps) {
  const theme = useTheme();
  const { colors, typescale, stateLayer } = theme;

  const tokens = TILE_ROLE_TOKENS[role];
  const bg = colors[tokens.bgKey];
  const onColor = colors[tokens.onKey];

  const radius =
    shapeTokens[shapeKey ?? (role === 'neutral' ? 'large' : 'extraLarge')];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          backgroundColor: bg,
          borderRadius: radius,
          padding: 16,
          minHeight: minHeight ?? 104,
          justifyContent: 'space-between',
        },
        iconWrap: {
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surfaceContainerLowest,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        },
        title: {
          ...typescale.titleMedium,
          color: onColor,
        },
        subtitle: {
          ...typescale.bodySmall,
          color: onColor,
          opacity: 0.78,
          marginTop: 2,
        },
        pressedOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.onSurface,
          opacity: stateLayer.pressed,
          borderRadius: radius,
        },
      }),
    [bg, colors, minHeight, onColor, radius, stateLayer.pressed, typescale],
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={[styles.root, style]}>
      {({ pressed }) => (
        <>
          <View>
            {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          </View>
          <View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {pressed ? <View style={styles.pressedOverlay} /> : null}
        </>
      )}
    </Pressable>
  );
}

export const Tile = React.memo(TileInner);
